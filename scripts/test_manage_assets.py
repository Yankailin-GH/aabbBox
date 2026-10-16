import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('manage_assets', Path(__file__).with_name('manage_assets.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Library = module.Library

class AssetLibraryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write('frontend/index.html', '<img src="素材库/游戏/active.png">')
        self.write('frontend/素材库/游戏/active.png', b'current PNG bytes')
        self.write('frontend/素材库/游戏/README.md', '# 素材索引')
        self.write('frontend/素材库/游戏/制作记录/old.png', b'historical PNG bytes')
    def write(self, name, content):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(content if isinstance(content,bytes) else content.encode())
        return p
    def test_cli_sizes_show_decimal_mb_without_changing_internal_bytes(self):
        raw={'onlineBytes':38016130,'offlineBytes':137734481,'unpackedBytes':41235843,'archiveBytes':39194370,'archiveFiles':178,'archive':'/tmp/package.tar.gz'}
        shown=module.format_sizes(raw)
        self.assertEqual(shown['onlineSize'],'38.02 MB')
        self.assertEqual(shown['archiveSize'],'39.19 MB')
        self.assertEqual(shown['unpackedSize'],'41.24 MB')
        self.assertEqual(shown['offlineSize'],'137.73 MB')
        self.assertEqual(shown['archiveFiles'],178)
        self.assertEqual(raw['archiveBytes'],39194370)
        self.assertEqual(module.format_sizes({'archiveBytes':0})['archiveSize'],'0.00 MB')
    def test_only_runtime_assets_and_associated_metadata_stay_online(self):
        self.write('frontend/素材库/游戏/active.json', '{"width":10}')
        self.write('设计说明/文档.md', '[历史](../frontend/素材库/游戏/制作记录/old.png)')
        Library(self.root).sync()
        self.assertTrue((self.root/'frontend/素材库/游戏/active.json').exists())
        self.assertFalse((self.root/'frontend/素材库/游戏/制作记录/old.png').exists())
        self.assertEqual((self.root/'离线素材库/游戏/制作记录/old.png').read_bytes(),b'historical PNG bytes')
        self.assertIn('../离线素材库/游戏/制作记录/old.png',(self.root/'设计说明/文档.md').read_text())
    def test_new_reference_restores_original_url_automatically(self):
        lib=Library(self.root);lib.sync()
        self.write('frontend/src/new.js', "const image='../素材库/游戏/制作记录/old.png';")
        lib.sync()
        self.assertTrue((self.root/'frontend/素材库/游戏/制作记录/old.png').exists())
        self.assertFalse((self.root/'离线素材库/游戏/制作记录/old.png').exists())
        history=json.loads((self.root/'离线素材库/迁移记录.json').read_text())
        self.assertEqual(history[0]['moves'][0]['from'],'frontend/素材库/游戏/制作记录/old.png')
        self.assertEqual(history[0]['moves'][0]['to'],'离线素材库/游戏/制作记录/old.png')
    def test_explicit_offline_reference_is_rebased_to_online(self):
        lib=Library(self.root);lib.sync()
        self.write('frontend/src/new.js', "const image='../../离线素材库/游戏/制作记录/old.png';")
        lib.sync()
        self.assertIn('../素材库/游戏/制作记录/old.png',(self.root/'frontend/src/new.js').read_text())
        self.assertEqual(lib.audit()['movedFiles'],0)
    def test_same_basename_in_another_folder_is_not_a_runtime_reference(self):
        self.write('frontend/素材库/游戏/unused/active.png',b'unused')
        Library(self.root).sync()
        self.assertTrue((self.root/'离线素材库/游戏/unused/active.png').exists())
    def test_dynamic_references_are_preserved_and_rule_drift_fails(self):
        self.write('frontend/src/art.js', "image.src=root+'dynamic.png';")
        self.write('frontend/素材库/游戏/dynamic.png', b'dynamic')
        self.write('scripts/asset-rules.json',json.dumps({'dynamicReferences':[{'source':'frontend/src/art.js','guard':'image.src=root','assets':['游戏/dynamic.png']}]}))
        lib=Library(self.root);lib.sync()
        self.assertTrue((self.root/'frontend/素材库/游戏/dynamic.png').exists())
        self.write('frontend/src/art.js','changed')
        with self.assertRaises(ValueError):lib.sync()
    def test_unregistered_dynamic_root_aborts_instead_of_archiving_unknown_dependencies(self):
        self.write('frontend/src/new-art.js', "const root='../素材库/游戏/'; image.src=root+type+'.png';")
        with self.assertRaisesRegex(ValueError,'未登记'):
            Library(self.root).sync()
        self.assertTrue((self.root/'frontend/素材库/游戏/制作记录/old.png').exists())
    def test_missing_reference_aborts_before_any_move(self):
        self.write('frontend/src/broken.js', "image.src='../素材库/游戏/missing.png';")
        with self.assertRaises(ValueError):Library(self.root).sync()
        self.assertTrue((self.root/'frontend/素材库/游戏/制作记录/old.png').exists())
    def test_moved_document_links_to_runtime_assets_and_local_history(self):
        self.write('frontend/素材库/游戏/制作记录/README.md','[当前](../active.png) [历史](old.png)')
        Library(self.root).sync()
        text=(self.root/'离线素材库/游戏/制作记录/README.md').read_text()
        self.assertIn('../../../frontend/素材库/游戏/active.png',text)
        self.assertIn('(old.png)',text)
    def test_pack_excludes_offline_is_repeatable_and_can_unpack_active_assets(self):
        lib=Library(self.root);out=self.root/'打包文件/test.tar.gz';lib.pack(out)
        with tarfile.open(out) as archive:
            names=archive.getnames()
            self.assertFalse(any('离线素材库' in p or 'old.png' in p for p in names))
            self.assertEqual(archive.extractfile('./素材库/游戏/active.png').read(),b'current PNG bytes')
        self.assertEqual(lib.sync()['movedFiles'],0)
        with self.assertRaises(ValueError):lib.pack(self.root/'frontend/bad.tar.gz')

if __name__=='__main__':unittest.main()
