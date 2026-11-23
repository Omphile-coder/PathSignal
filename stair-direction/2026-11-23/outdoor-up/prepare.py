"""Sample new upstairs recordings without changing source videos."""
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('clip_preparation', ROOT.parent/'prepare_clips.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ROOT = ROOT
module.CLIPS = [
    ('U1-up', '0002023C-C4ED-4A88-A7CB-7553D162E948/1-IMG_1297.mov'),
    ('U2-up', '0002023C-C4ED-4A88-A7CB-7553D162E948/2-IMG_1291.mov'),
]
if __name__ == '__main__':
    module.main()
