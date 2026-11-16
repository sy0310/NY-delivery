"""Find the pinned local Creator without embedding a developer's absolute path."""
import os
from pathlib import Path
import plistlib


def find_creator():
    configured = os.environ.get('COCOS_CREATOR')
    candidates = [Path(configured).expanduser()] if configured else []
    for folder in [Path('/Applications'), Path.home() / 'Applications']:
        candidates.extend(folder.glob('Cocos*/**/CocosCreator.app/Contents/MacOS/CocosCreator'))
    for candidate in candidates:
        if candidate.suffix == '.app':
            candidate = candidate / 'Contents/MacOS/CocosCreator'
        if not candidate.is_file():
            continue
        info = candidate.parent.parent / 'Info.plist'
        with info.open('rb') as source:
            version = plistlib.load(source).get('CFBundleShortVersionString')
        if version == '3.8.8':
            return candidate.resolve()
    raise SystemExit('找不到 Cocos Creator 3.8.8。请设置 COCOS_CREATOR 为应用或可执行文件路径。')
