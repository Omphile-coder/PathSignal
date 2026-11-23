"""Review batch of two new user-labelled downstairs recordings."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('clip_preparation', ROOT.parent/'prepare_clips.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ROOT = ROOT
module.CLIPS = [
    ('C-down', '1DEAF2F5-21DE-4FFE-A4B8-83DF8B9D8600/1-IMG_1298.mov'),
    ('D-down', '1DEAF2F5-21DE-4FFE-A4B8-83DF8B9D8600/2-IMG_1293.mov'),
]
if __name__ == '__main__':
    module.main()
