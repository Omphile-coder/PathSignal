"""Local development check, not an independent accuracy evaluation."""
import json
import time
import sys
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parent
variant = sys.argv[1] if len(sys.argv) > 1 else 'segformer'
config = json.loads((ROOT / variant / 'config.json').read_text(encoding='utf-8-sig'))
labels = {int(k): v for k, v in config['id2label'].items()}
stair_ids = [k for k, v in labels.items() if v in ('stairs', 'stairway')]
options = ort.SessionOptions()
options.intra_op_num_threads = 3
model = ort.InferenceSession(str(ROOT / variant / 'model_quantized.onnx'), options, providers=['CPUExecutionProvider'])
print('Input', [(i.name, i.shape) for i in model.get_inputs()], 'stair labels', {k: labels[k] for k in stair_ids}, flush=True)
rows = []
for path in sorted(ROOT.glob('*-frame.jpg')):
    image = Image.open(path).convert('RGB')
    resized = np.asarray(image.resize((512, 512), Image.Resampling.BILINEAR), dtype=np.float32) / 255
    tensor = ((resized - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)).transpose(2, 0, 1)[None]
    start = time.perf_counter()
    output = model.run(None, {model.get_inputs()[0].name: tensor})[0][0]
    milliseconds = round((time.perf_counter() - start) * 1000)
    classes = output.argmax(axis=0)
    height, width = classes.shape
    yy, xx = np.mgrid[:height, :width]
    ny = (yy + .5) / height
    half = .15 + (ny - .28) * .24
    corridor = (ny >= .28) & (ny <= .94) & (np.abs((xx + .5) / width - .5) <= half)
    stair_mask = np.isin(classes, stair_ids)
    coverage = float((stair_mask & corridor).sum() / corridor.sum())
    counts = np.bincount(classes.ravel(), minlength=len(labels))
    top = sorted(range(len(labels)), key=lambda k: -int(counts[k]))[:5]
    result = dict(file=path.name, milliseconds=milliseconds, stair_corridor_fraction=coverage,
                  top_classes={labels[k]: round(float(counts[k] / classes.size), 4) for k in top},
                  image_size=image.size)
    rows.append(result)
    print(json.dumps(result), flush=True)
    mask = Image.fromarray((stair_mask * 255).astype(np.uint8)).resize(image.size, Image.Resampling.NEAREST)
    overlay = Image.new('RGB', image.size, '#ff8833')
    visual = Image.blend(image, overlay, .45)
    Image.composite(visual, image, mask).save(ROOT / variant / (path.stem + '-stairs.jpg'))
(ROOT / (variant + '-results.json')).write_text(json.dumps(dict(model=variant + ' ADE20K, quantized ONNX',
    pretrained=True, extra_training=False, note='Development still frames. Camera height unknown. No distance estimates.', results=rows), indent=2))
