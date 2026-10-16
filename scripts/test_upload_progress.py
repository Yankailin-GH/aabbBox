import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
WRAPPER = ROOT / 'scripts/upload_progress.py'
TTY_PROGRESS = '''
import os,sys
assert os.isatty(1) and os.isatty(2)
assert 'DEPLOY_UPLOAD_PASS' not in os.environ
sys.stdout.write('file 0% 0KB\\rfile 12% 1KB\\rfile 56% 2KB\\rfile 100% 3KB\\r');sys.stdout.flush()
'''

class UploadProgressTest(unittest.TestCase):
    def run_upload(self, program, password='', timeout=180):
        env=os.environ.copy();env['DEPLOY_UPLOAD_PASS']=password
        return subprocess.run([sys.executable,str(WRAPPER),'--label','package with spaces.tar.gz','--idle-timeout',str(timeout),'--',sys.executable,'-c',program],env=env,capture_output=True,text=True,timeout=5)
    def test_piped_output_receives_percentages_from_forced_terminal(self):
        r=self.run_upload(TTY_PROGRESS)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertIn('package with spaces.tar.gz 0%',r.stdout)
        self.assertIn('package with spaces.tar.gz 12%',r.stdout)
        self.assertIn('package with spaces.tar.gz 56%',r.stdout)
        self.assertTrue(r.stdout.rstrip().endswith('100%'))
        self.assertEqual(r.stdout.count('100%'),1)
    def test_password_prompt_split_across_reads_is_answered_without_logging_secret(self):
        secret='sample $() `quotes` password'
        code='''import sys,termios,time,os
settings=termios.tcgetattr(0);settings[3]&=~termios.ECHO;termios.tcsetattr(0,termios.TCSANOW,settings)
sys.stdout.write('Pass');sys.stdout.flush();time.sleep(.03);sys.stdout.write('word: ');sys.stdout.flush()
password=sys.stdin.readline().rstrip('\\n')
if password!="sample $() `quotes` password":sys.exit(7)
sys.stdout.write('\\nfile 30% 1KB\\rfile 100% 3KB\\r');sys.stdout.flush()
'''
        r=self.run_upload(code,secret)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertIn('30%',r.stdout);self.assertIn('100%',r.stdout)
        self.assertNotIn(secret,r.stdout+r.stderr)
        self.assertNotIn('word:',r.stdout)
    def test_failure_propagates_and_does_not_claim_100_percent(self):
        r=self.run_upload("import sys;print('file 100% 3KB');print('Permission denied',file=sys.stderr);sys.exit(9)")
        self.assertEqual(r.returncode,9)
        self.assertIn('Permission denied',r.stdout)
        self.assertNotIn('100%',r.stdout)
    def test_unexpected_password_without_secret_fails_promptly(self):
        r=self.run_upload("import sys;sys.stdout.write('Password: ');sys.stdout.flush();sys.stdin.readline()")
        self.assertEqual(r.returncode,1);self.assertIn('未提供',r.stderr)
        self.assertNotIn('100%',r.stdout)
    def test_idle_timeout_kills_stalled_child_and_does_not_claim_success(self):
        r=self.run_upload('import time;time.sleep(10)',timeout=.1)
        self.assertEqual(r.returncode,124);self.assertNotIn('100%',r.stdout)
    def test_unsorted_repeated_and_invalid_percentages_do_not_regress(self):
        r=self.run_upload("print('file 25% 1KB\\rfile 25% 1KB\\rfile 12% 1KB\\rfile 999% 1KB\\rfile 80% 2KB\\r')")
        self.assertEqual(r.returncode,0)
        self.assertEqual(re.findall(r' (\d+)%',r.stdout),['0','25','80','100'])
    def test_actual_deploy_function_uses_same_helper_for_key_and_password_modes(self):
        function=re.search(r'scp_run\(\) \{[\s\S]*?\n\}',(ROOT/'deploy.sh').read_text())[0]
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);mock=base/'scp';capture=base/'args.json'
            mock.write_text('#!'+sys.executable+'\nimport sys,json,os\nopen(os.environ["CAPTURE"],"w").write(json.dumps(sys.argv[1:]))\nassert os.isatty(2)\nprint("file 50% 1KB\\rfile 100% 2KB\\r")\n')
            mock.chmod(0o755)
            payload=base/'package with spaces.tar.gz';payload.write_bytes(b'payload')
            for mode in ['keyless','password']:
                script='set -euo pipefail\nSCRIPT_DIR="$1"\nAUTH_MODE="$2"\nPASS=""\nSSH_HOST=example.test\nSSH_OPTS=(-o ConnectTimeout=10)\nPW_OPTS=(-o PubkeyAuthentication=no)\n'+function+'\nscp_run "$3"\n'
                env=os.environ.copy();env['PATH']=str(base)+os.pathsep+env['PATH'];env['CAPTURE']=str(capture)
                r=subprocess.run(['bash','-c',script,'test',str(ROOT),mode,str(payload)],env=env,capture_output=True,text=True,timeout=5)
                self.assertEqual(r.returncode,0,r.stderr);self.assertIn('50%',r.stdout);self.assertIn('100%',r.stdout)
                args=json.loads(capture.read_text());self.assertNotIn('-q',args);self.assertIn(str(payload),args)
                self.assertEqual('PubkeyAuthentication=no' in args,mode=='password')

if __name__=='__main__':unittest.main()
