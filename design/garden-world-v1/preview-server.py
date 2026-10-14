"""Local development preview with bounded Canvas PNG export endpoints."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os,sys
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        destinations={'/__crystal_flower_export__':ROOT/'design/crystal-flower-v2/combat-preview.png',
                      '/__garden_world_export__':ROOT/'design/garden-world-v1/world-preview.png',
                      '/__world_battle_export__':ROOT/'design/garden-world-v1/battle-preview.png',
                      '/__garden_towers_export__':ROOT/'design/garden-towers-v1/combat-preview.png'}
        length=int(self.headers.get('Content-Length','0'))
        if self.path not in destinations or not 0<length<3000000:self.send_error(400);return
        data=self.rfile.read(length)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):self.send_error(400);return
        destinations[self.path].write_bytes(data);self.send_response(200);self.end_headers();self.wfile.write(b'OK')
os.chdir(ROOT/'frontend')
ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1]) if len(sys.argv)>1 else 8769),Handler).serve_forever()
