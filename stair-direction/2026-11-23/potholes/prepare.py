"""Sample the user-supplied pothole candidates for visual review."""
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('clip_preparation', ROOT.parent/'prepare_clips.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ROOT = ROOT
module.CLIPS = [
    ('P1-pothole', 'E7C7734F-B80C-4A16-91DF-200D705C4F05/1-IMG_1294.mov'),
    ('P2-pothole', 'E7C7734F-B80C-4A16-91DF-200D705C4F05/2-IMG_1295.mov'),
]
if __name__ == '__main__':
    module.main()
