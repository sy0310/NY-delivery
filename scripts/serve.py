"""Serve a published game. LAN exposure is an explicit opt-in."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        resolved = Path(super().translate_path(path)).resolve()
        try:
            resolved.relative_to(Path(self.directory).resolve())
        except ValueError:
            return str(Path(self.directory) / '.outside-published-directory')
        return str(resolved)


def lan_addresses():
    addresses = set()
    try:
        addresses.update(item[4][0] for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
        # UDP connect chooses the outbound interface without sending a packet.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
            route.connect(('192.0.2.1', 9))
            addresses.add(route.getsockname()[0])
    except OSError:
        pass
    return sorted(address for address in addresses if not address.startswith('127.') and address != '0.0.0.0')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=7457)
    parser.add_argument('--lan', action='store_true', help='显式开放同一局域网试玩，默认仅本机')
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'game/build/web-desktop')
    arguments = parser.parse_args()
    directory = arguments.directory.resolve()
    if not all((directory / name).is_file() for name in ['index.html', 'application.js', 'src/settings.json']):
        raise SystemExit('请选择完整发布构建目录，请先运行 npm run build。')
    stamp = directory / 'build-info.json'
    info = json.loads(stamp.read_text()) if stamp.is_file() else {}
    revision = info.get('commit', '未知，请重新构建以记录SHA')
    print(f'构建 SHA {revision}' + (' · 含未提交源码' if info.get('dirty') else ''), flush=True)
    handler = partial(PreviewHandler, directory=str(directory))
    host = '0.0.0.0' if arguments.lan else '127.0.0.1'
    with ThreadingHTTPServer((host, arguments.port), handler) as server:
        print(f'本机 http://127.0.0.1:{server.server_port}/', flush=True)
        if arguments.lan:
            for address in lan_addresses():
                print(f'同一Wi-Fi手机 http://{address}:{server.server_port}/', flush=True)
            print('局域网模式，只提供当前发布目录。手机连接与系统防火墙按实际设备检查。', flush=True)
        print('就绪，按 Ctrl+C 停止。', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
