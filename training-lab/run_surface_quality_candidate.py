from pathlib import Path
import json
import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(r"C:\Users\lucas\Desktop\PathSignal")
ART = ROOT / "training-lab/dataset-research/2026-11-24/artifacts"
MODEL = ART / "surface-quality-mobilenetv3.onnx"
THRESHOLD = 0.65
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[None, :, None, None]
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[None, :, None, None]

session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
in_name = session.get_inputs()[0].name
out_name = session.get_outputs()[0].name
print("ONNX input:", in_name, session.get_inputs()[0].shape)
print("ONNX output:", out_name, session.get_outputs()[0].shape)

sets = [
    ("pothole", ROOT / "stair-direction/2026-11-23/potholes/labelled-frames/missing_paver_depression", 1),
    ("intact", ROOT / "stair-direction/2026-11-23/intact-ground/labelled-frames/intact_paving_no_visible_pothole", 0),
]
rows = []
for label, folder, truth in sets:
    for path in sorted(folder.glob("*.jpg")):
        with Image.open(path) as im:
            im = im.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
            x = np.asarray(im, dtype=np.float32) / 255.0
        x = ((x.transpose(2, 0, 1)[None] - MEAN) / STD).astype(np.float32)
        prob = float(np.asarray(session.run([out_name], {in_name: x})).reshape(-1)[0])
        rows.append({"group": label, "image": str(path.relative_to(ROOT)), "expected_label": truth, "bad_quality_probability": prob, "predicted_bad_quality_at_0.65": prob >= THRESHOLD, "correct_at_threshold": (prob >= THRESHOLD) == bool(truth)})

summary = {}
for group in ("pothole", "intact"):
    subset = [r for r in rows if r["group"] == group]
    summary[group] = {"n_frames": len(subset), "mean_probability": float(np.mean([r["bad_quality_probability"] for r in subset])) if subset else None, "scores": [round(r["bad_quality_probability"], 4) for r in subset], "predicted_bad_count_at_0.65": sum(r["predicted_bad_quality_at_0.65"] for r in subset)}
report = {"model": MODEL.name, "threshold_from_public_validation": THRESHOLD, "local_user_recorded_frames": len(rows), "summary_by_group": summary, "frames": rows, "caveat": "Qualitative check only: frames are sampled from two pothole clips and one intact-paving clip at a single location. Adjacent video frames are correlated. This does not measure independent accuracy, generalization, hazard localization, or walking safety."}
(ART / "local-paving-frame-check.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"summary_by_group": summary, "report": str(ART / 'local-paving-frame-check.json')}, indent=2))
