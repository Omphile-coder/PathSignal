"""Extract samples from the intact-ground candidate; preserve original video."""
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('clip_preparation', ROOT.parent/'prepare_clips.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ROOT = ROOT
module.CLIPS = [('N1-intact', '00EC36D7-FAFB-43D5-8147-EDB60D1FBCE5/1-IMG_1302.mov')]
if __name__ == '__main__':
    module.main()
