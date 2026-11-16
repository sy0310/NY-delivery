"""Open the pinned project using the installed editor's supported offline mode."""
from pathlib import Path
import subprocess
from creator import find_creator

project = Path(__file__).resolve().parents[1] / 'game'
subprocess.run([str(find_creator()), '--project', str(project), '--nologin'], check=False)
