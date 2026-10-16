#!/usr/bin/env python3
"""Run scp in a terminal and relay simple percentages even when deployment logs are piped."""
import argparse
import codecs
import errno
import os
import pty
import re
import select
import signal
import sys
import time

ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
PERCENT = re.compile(r'(?<!\d)(\d{1,3})%')
PASSWORD = re.compile(r'(?:password|passphrase[^\r\n]*):\s*$', re.I)


def upload(command, label, password='', idle_timeout=300):
    last_percent = -1
    def progress(percent):
        nonlocal last_percent
        if percent > last_percent:
            print(f'[upload] {label} {percent}%', flush=True)
            last_percent = percent

    def safe(text):
        return text.replace(password, '[REDACTED]') if password else text

    def line(text):
        text = ANSI.sub('', text).strip()
        if not text or PASSWORD.search(text):
            return
        match = PERCENT.search(text)
        if match:
            # scp may report 100% before remote close fails; success is confirmed below.
            percent = int(match[1])
            if 0 <= percent < 100:
                progress(percent)
        else:
            print(safe(text), flush=True)

    progress(0)
    pid, master = pty.fork()
    if pid == 0:
        # Password travels only through the terminal, never in argv or the child environment.
        for name in ('DEPLOY_UPLOAD_PASS', 'DEPLOY_PASS', 'ykl'):
            os.environ.pop(name, None)
        try:
            os.execvp(command[0], command)
        except OSError as exc:
            print(str(exc), file=sys.stderr, flush=True)
            os._exit(127)
    decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')
    pending = ''
    last_activity = time.monotonic()
    waited = False
    try:
        while True:
            if time.monotonic() - last_activity > idle_timeout:
                print('[upload] 上传长时间无响应，已停止', file=sys.stderr, flush=True)
                return 124
            ready, _, _ = select.select([master], [], [], .25)
            if not ready:
                continue
            try:
                data = os.read(master, 65536)
            except OSError as exc:
                if exc.errno == errno.EIO:  # PTY EOF after child exits.
                    break
                raise
            if not data:
                break
            last_activity = time.monotonic()
            pending += decoder.decode(data)
            if PASSWORD.search(ANSI.sub('', pending)):
                if not password:
                    print('[upload] 上传需要密码，但未提供可用密码', file=sys.stderr, flush=True)
                    return 1
                os.write(master, password.encode() + b'\n')
                pending = ''
            parts = re.split(r'[\r\n]', pending)
            pending = parts.pop()
            for part in parts:
                line(part)
            if len(pending) > 65536:
                line(pending)
                pending = ''
        line(pending + decoder.decode(b'', final=True))
        _, status = os.waitpid(pid, 0)
        waited = True
        code = os.waitstatus_to_exitcode(status)
        if code == 0:
            progress(100)
        return code if code >= 0 else 128 - code
    except KeyboardInterrupt:
        return 130
    finally:
        os.close(master)
        if not waited:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            os.waitpid(pid, 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--idle-timeout', type=float, default=300)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('需要指定 scp 命令')
    if args.idle_timeout <= 0:
        parser.error('idle-timeout 必须大于0')
    return upload(command, args.label, os.environ.get('DEPLOY_UPLOAD_PASS', ''), args.idle_timeout)


if __name__ == '__main__':
    raise SystemExit(main())
