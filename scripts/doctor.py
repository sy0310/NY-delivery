"""Read-only checks against the real local editor and project."""
import json
import platform
from pathlib import Path
import shutil
import subprocess
from creator import find_creator

root = Path(__file__).resolve().parents[1]
creator = find_creator()
project = json.loads((root / 'game/package.json').read_text())
print(platform.platform(), platform.machine())
print('空闲 GiB', round(shutil.disk_usage(root).free / 1024 ** 3, 1))
print('Creator', creator)
print('工程引擎版本', project['creator']['version'])
assert project['creator']['version'] == '3.8.8'
subprocess.run(['git', '-C', str(root), 'remote', 'get-url', 'origin'], check=True)
missing = [str(path) for path in (root / 'game/assets').rglob('*')
           if not path.name.endswith('.meta') and not Path(str(path) + '.meta').is_file()]
if missing:
    raise SystemExit('资源缺少 .meta，请用 Creator 导入后提交。\n' + '\n'.join(missing))
print('资源 .meta 完整。')
