"""Serve only the published game on a configurable loopback port."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=7457)
parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'game/build/web-desktop')
arguments = parser.parse_args()
directory = arguments.directory.resolve()
if not (directory / 'index.html').is_file():
    raise SystemExit('发布构建不存在，请先运行 npm run build。')
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
with ThreadingHTTPServer(('127.0.0.1', arguments.port), handler) as server:
    print(f'仅供本机访问 http://127.0.0.1:{arguments.port}/', flush=True)
    print('按 Ctrl+C 停止。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
