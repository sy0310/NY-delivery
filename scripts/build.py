"""Build through the installed Creator and verify its real output."""
import argparse
import json
from pathlib import Path
import subprocess
from creator import find_creator

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, default=root / 'game')
parser.add_argument('--build-path', type=Path)
arguments = parser.parse_args()
project = arguments.project.resolve()
creator = find_creator()
log_dir = root / '.local/build'
log_dir.mkdir(parents=True, exist_ok=True)
config = json.loads((root / 'scripts/build-config.json').read_text())
build_path = arguments.build_path.resolve() if arguments.build_path else project / 'build'
config['buildPath'] = str(build_path)
config_path = log_dir / 'config.json'
config_path.write_text(json.dumps(config, indent=2))
log_path = log_dir / 'creator.log'
print(f'Creator 3.8.8 — {creator}', flush=True)
print(f'构建日志 — {log_path}', flush=True)
with log_path.open('w') as log:
    result = subprocess.run([str(creator), '--project', str(project), '--build',
                             f'platform=web-desktop;configPath={config_path}'],
                            stdout=log, stderr=subprocess.STDOUT)
output = build_path / config['outputName']
required = [output / 'index.html', output / 'application.js', output / 'src/settings.json']
if result.returncode not in (0, 36) or not all(path.is_file() for path in required):
    raise SystemExit(f'构建失败，Creator 退出码 {result.returncode}，查看 {log_path}')
settings = json.loads((output / 'src/settings.json').read_text())
scene_urls = [scene['url'] for scene in config['scenes'] if scene['uuid'] == config['startScene']]
if settings.get('launch', {}).get('launchScene') not in [config['startScene']] + scene_urls:
    raise SystemExit('产物启动场景与共享构建配置不一致，请检查日志。')
revision = subprocess.check_output(['git', '-C', str(project), 'rev-parse', 'HEAD'], text=True).strip()
dirty = bool(subprocess.check_output(['git', '-C', str(project), 'status', '--porcelain', '--untracked-files=no'], text=True).strip())
(output / 'build-info.json').write_text(json.dumps({'commit': revision, 'dirty': dirty, 'engine': '3.8.8'}, indent=2))
print(f'构建已验证 — Creator 退出码 {result.returncode}，产物 {output}')
