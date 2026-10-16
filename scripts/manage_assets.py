#!/usr/bin/env python3
"""Split runtime assets from local production files; pack only frontend/ (stdlib only)."""
import argparse
from collections import defaultdict
from datetime import datetime
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile

TEXT = {'.md', '.txt', '.json', '.html', '.css', '.js', '.mjs', '.cjs', '.py', '.sh', '.m', '.svg'}
MEDIA = {'.png', '.svg', '.gif', '.jpg', '.jpeg', '.webp', '.avif', '.ico', '.json', '.woff', '.woff2', '.mp3', '.wav'}
QUOTED = re.compile(r'''(["'`])((?:\\.|(?!\1)[^\n])*?)\1''')
LINK = re.compile(r'(\]\()(<[^>]+>|[^)\s]+)(\))')
INLINE = re.compile(r'`([^`\n]+)`')
SKIP_DIRS = {'.git', '.idea', '.claude', '__pycache__', '打包文件'}


def text_files(root):
    for parent, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            p = Path(parent) / name
            if p.suffix in TEXT or name == 'AGENTS.md':
                yield p


def write_changed(path, content):
    if not path.exists() or path.read_text() != content:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


class Library:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.online = self.root / 'frontend/素材库'
        self.offline = self.root / '离线素材库'
        config = self.root / 'scripts/asset-rules.json'
        self.rules = json.loads(config.read_text()) if config.exists() else {}

    def inventory(self):
        found = {}
        for base in [self.online, self.offline]:
            if not base.exists():
                continue
            for p in base.rglob('*'):
                if not p.is_file():
                    continue
                rel = p.relative_to(base)
                if '__pycache__' in rel.parts:
                    continue
                # Root/game indexes are maintained in both libraries, not moved back and forth.
                if len(rel.parts) < 2 or (len(rel.parts) == 2 and p.name == 'README.md'):
                    continue
                if p.is_symlink():
                    raise ValueError(f'素材不可使用外部符号链接: {p}')
                key = rel.as_posix()
                if key in found:
                    raise ValueError(f'在线与离线库存在同名文件，请先处理冲突: {key}')
                found[key] = p
        return found

    def source_files(self):
        return [self.root / 'frontend/index.html', *sorted((self.root / 'frontend/src').rglob('*'))]

    def referenced_assets(self, inventory):
        from urllib.parse import unquote, urlsplit
        used = defaultdict(set)
        missing = []
        sources = {p: p.read_text() for p in self.source_files()
                   if p.is_file() and p.suffix in {'.html', '.js', '.css', '.svg'}}

        def key_from_path(path):
            for base in (self.online, self.offline):
                try:
                    return path.relative_to(base).as_posix()
                except ValueError:
                    pass
            return None

        def scan(source, content):
            for match in QUOTED.finditer(content):
                value = match[2]
                if not value or '${' in value or value.startswith(('data:', 'http:', 'https:', '#')):
                    continue
                value = unquote(urlsplit(value).path)
                if Path(value).suffix.lower() not in MEDIA:
                    continue
                if value.startswith(('frontend/', '离线素材库/')):
                    target = self.root / value
                elif value.startswith('/'):
                    target = self.root / 'frontend' / value.lstrip('/')
                else:
                    target = source.parent / value
                key = key_from_path(target.resolve())
                if not key:
                    continue
                if key in inventory:
                    used[key].add(str(source.relative_to(self.root)))
                else:
                    missing.append(f'{source.relative_to(self.root)} → {value}')

        registered = {rule['source'] for rule in self.rules.get('dynamicReferences', [])}
        for source, content in sources.items():
            relative = str(source.relative_to(self.root))
            for match in QUOTED.finditer(content):
                value = match[2]
                if '素材库/' in value and ('${' in value or value.endswith('/')) and relative not in registered:
                    raise ValueError('检测到未登记的动态素材路径，请更新 scripts/asset-rules.json: ' + relative)
            scan(source, content)
        for rule in self.rules.get('dynamicReferences', []):
            source = self.root / rule['source']
            content = sources.get(source, '')
            if rule['guard'] not in content:
                raise ValueError(f"动态引用规则已失效，请复核: {rule['source']} / {rule['guard']}")
            for pattern in rule['assets']:
                matches = [key for key in inventory if fnmatch.fnmatchcase(key, pattern)]
                if not matches:
                    missing.append(f"{rule['source']} → {pattern}")
                for key in matches:
                    used[key].add(rule['source'] + '（动态引用）')
        # Follow external references in active SVGs; provenance JSON is not runtime loading.
        scanned = set()
        while True:
            pending = [k for k in used if k.endswith('.svg') and k not in scanned]
            if not pending:
                break
            for key in pending:
                scanned.add(key)
                scan(self.online / key, inventory[key].read_text())
        for key in list(used):
            companion = str(Path(key).with_suffix('.json'))
            if companion in inventory:
                used[companion].add('在用素材的同名元数据: ' + key)
        for rule in self.rules.get('associatedMetadata', []):
            if rule['asset'] in used:
                for key in rule['files']:
                    if key not in inventory:
                        missing.append('关联元数据: ' + key)
                    else:
                        used[key].add('在用素材的关联元数据: ' + rule['asset'])
        if missing:
            raise ValueError('素材引用缺失，未进行迁移或打包:\n' + '\n'.join(sorted(set(missing))))
        return used

    def plan(self):
        inventory = self.inventory()
        used = self.referenced_assets(inventory)
        destinations = {p: (self.online if key in used else self.offline) / key
                        for key, p in inventory.items()}
        return inventory, used, destinations

    def rebase_references(self, originals, destinations):
        from urllib.parse import unquote
        directories = set()
        for p in destinations:
            directories.update(p.parents)

        def final_target(target):
            target = target.resolve()
            if target in destinations:
                return destinations[target]
            # Only a completely evacuated folder changes location.
            for before, after in ((self.online, self.offline), (self.offline, self.online)):
                try:
                    rel = target.relative_to(before)
                except ValueError:
                    continue
                if target in directories and not target.exists() and (after / rel).exists():
                    return after / rel
            return target

        replacements = {}
        for before, after in destinations.items():
            if before != after:
                replacements[str(before.relative_to(self.root))] = str(after.relative_to(self.root))
        for folder in directories:
            if folder.is_relative_to(self.root):
                after = final_target(folder)
                if after != folder:
                    replacements[str(folder.relative_to(self.root))] = str(after.relative_to(self.root))
        # A single pass prevents accidentally rewriting already-rebased paths twice.
        pattern = re.compile('|'.join(re.escape(k) for k in sorted(replacements, key=len, reverse=True))) if replacements else None

        for old, content in originals.items():
            new = destinations.get(old, old)

            def rewrite(value):
                clean = value.strip('<>')
                if not clean or clean.startswith(('https:', 'http:', 'data:', '#')):
                    return value
                path, mark, anchor = clean.partition('#')
                path, querymark, query = path.partition('?')
                decoded = unquote(path.removeprefix('file://'))
                if decoded.startswith(('frontend/', '离线素材库/')):
                    return value  # Root-relative mentions are rewritten in the single pass below.
                if len(decoded)>500 or any(c in decoded for c in '\n{}<>') or ('/' not in decoded and Path(decoded).suffix.lower() not in TEXT | MEDIA):
                    return value
                target = Path(decoded) if decoded.startswith('/') else old.parent / decoded
                target = target.resolve()
                if target not in destinations and target not in directories and not target.exists():
                    return value
                target = final_target(target)
                if new == old and target == (old.parent / decoded).resolve():
                    return value
                updated = os.path.relpath(target, new.parent)
                updated += ('?' + query if querymark else '') + ('#' + anchor if mark else '')
                return '<' + updated + '>' if value.startswith('<') else updated

            # Resolve links and quoted file names using the document's ORIGINAL location first.
            content = LINK.sub(lambda m: m[1] + rewrite(m[2]) + m[3], content)
            content = INLINE.sub(lambda m: '`' + rewrite(m[1]) + '`', content)
            if new.suffix in {'.json', '.html', '.svg', '.js', '.mjs', '.cjs', '.css'}:
                content = QUOTED.sub(lambda m: m[1] + rewrite(m[2]) + m[1], content)
            if pattern:
                content = pattern.sub(lambda m: replacements[m[0]], content)
            write_changed(new, content)

    def sync(self):
        inventory, used, destinations = self.plan()
        moves = {old: new for old, new in destinations.items() if old != new}
        generated = {self.offline / name for name in ['素材清单.json', '迁移记录.json', '校验结果.json']}
        originals = {p: p.read_text() for p in text_files(self.root) if p not in generated} if moves else {}
        # Check all moves before changing any file. Binary data is moved intact.
        for old, new in moves.items():
            if new.exists():
                raise ValueError(f'目标已存在: {new}')
        moved = []
        for old, new in moves.items():
            new.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old), str(new))
            moved.append({'from': str(old.relative_to(self.root)), 'to': str(new.relative_to(self.root))})
        for base in (self.online, self.offline):
            if base.exists():
                for directory in sorted((p for p in base.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
                    if not any(directory.iterdir()):
                        directory.rmdir()
        if moves:
            self.rebase_references(originals, destinations)
        catalog = []
        for key, original in sorted(inventory.items()):
            p = destinations[original]
            catalog.append({'asset': key, 'location': str(p.relative_to(self.root)),
                            'online': key in used, 'bytes': p.stat().st_size,
                            'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
                            'references': sorted(used.get(key, []))})
        self.offline.mkdir(exist_ok=True)
        previous = self.offline / '迁移记录.json'
        history = json.loads(previous.read_text()) if previous.exists() else []
        if moved:
            history.append({'time': datetime.now().astimezone().isoformat(), 'moves': moved})
            write_changed(previous, json.dumps(history, ensure_ascii=False, indent=2) + '\n')
        write_changed(self.offline / '素材清单.json', json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
        return self.summary(catalog, len(moved))

    @staticmethod
    def summary(catalog, moves=0):
        online = [a for a in catalog if a['online']]
        offline = [a for a in catalog if not a['online']]
        return {'movedFiles': moves, 'onlineFiles': len(online), 'onlineBytes': sum(a['bytes'] for a in online),
                'offlineFiles': len(offline), 'offlineBytes': sum(a['bytes'] for a in offline)}

    def audit(self):
        inventory, used, destinations = self.plan()
        catalog = [{'online': k in used, 'bytes': p.stat().st_size} for k, p in inventory.items()]
        result = self.summary(catalog, sum(a != b for a, b in destinations.items()))
        result['offlineCandidates'] = [k for k in inventory if k not in used]
        return result

    def pack(self, output):
        output = Path(output).resolve()
        if output.is_relative_to(self.root / 'frontend'):
            raise ValueError('压缩包必须放在 frontend 目录之外')
        result = self.sync()
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_name(output.name + '.partial')
        def include(info):
            parts = Path(info.name).parts
            if any(p in {'离线素材库', '__pycache__', '.DS_Store'} or p.startswith('._') for p in parts):
                return None
            if info.issym() or info.islnk():
                raise ValueError('打包目录包含符号链接，请先核对: ' + info.name)
            return info
        try:
            with tarfile.open(temporary, 'w:gz') as archive:
                archive.add(self.root / 'frontend', arcname='.', filter=include)
            with tarfile.open(temporary, 'r:gz') as archive:
                members = [m for m in archive.getmembers() if m.isfile()]
                result.update(archiveFiles=len(members), unpackedBytes=sum(m.size for m in members))
            os.replace(temporary, output)
        finally:
            temporary.unlink(missing_ok=True)
        result.update(archive=str(output), archiveBytes=output.stat().st_size)
        return result


def format_sizes(result):
    """Keep byte counts numeric internally; render CLI sizes in decimal MB."""
    return {(key[:-5] + 'Size' if key.endswith('Bytes') else key):
            (f'{value / 1_000_000:.2f} MB' if key.endswith('Bytes') else value)
            for key, value in result.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['audit', 'sync', 'pack'])
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    library = Library(args.root)
    try:
        if args.command == 'pack':
            output = args.output or args.root / '打包文件' / ('aabbbox_frontend_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.tar.gz')
            result = library.pack(output)
        else:
            result = library.sync() if args.command == 'sync' else library.audit()
        print(json.dumps(format_sizes(result), ensure_ascii=False, indent=2))
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
