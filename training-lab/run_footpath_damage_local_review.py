from pathlib import Path
import json
import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "presentation-site" / "source-model" / "footpath-damage" / "footpath-damage-deeplabv3.onnx"
OUT = ROOT / "training-lab" / "runs" / "footpath-damage-local-review"
SIZE = 512
ALERT_THRESHOLD = 0.05  # Exploratory trigger, predeclared for this local review only.
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[None, :, None, None]
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[None, :, None, None]

sources = [
    ("P1-pothole", "P1-pothole-", ROOT / "stair-direction/2026-11-23/potholes/labelled-frames/missing_paver_depression"),
    ("P2-pothole", "P2-pothole-", ROOT / "stair-direction/2026-11-23/potholes/labelled-frames/missing_paver_depression"),
    ("N1-intact", "N1-intact-", ROOT / "stair-direction/2026-11-23/intact-ground/labelled-frames/intact_paving_no_visible_pothole"),
]

OUT.mkdir(parents=True, exist_ok=True)
session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
in_name = session.get_inputs()[0].name
out_name = session.get_outputs()[0].name
print("ONNX input:", in_name, session.get_inputs()[0].shape)
print("ONNX output:", out_name, session.get_outputs()[0].shape)
rows = []
ys, xs = np.mgrid[0:SIZE, 0:SIZE]
y_fraction = ys / SIZE
half_width = 0.15 + (np.clip(y_fraction, 0.28, 0.94) - 0.28) * 0.24
corridor = (y_fraction >= 0.28) & (y_fraction <= 0.94) & (np.abs(xs / SIZE - 0.5) <= half_width)
for group, prefix, folder in sources:
    group_dir = OUT / group
    group_dir.mkdir(exist_ok=True)
    for path in sorted(folder.glob(f"{prefix}*.jpg")):
        with Image.open(path) as source:
            original = source.convert("RGB")
            resized = original.resize((SIZE, SIZE), Image.Resampling.BILINEAR)
            x = np.asarray(resized, dtype=np.float32) / 255.0
        x = ((x.transpose(2, 0, 1)[None] - MEAN) / STD).astype(np.float32)
        prob = np.asarray(session.run([out_name], {in_name: x})[0]).squeeze()
        if prob.shape != (SIZE, SIZE):
            raise ValueError(f"Unexpected output shape {prob.shape} for {path.name}")
        mask = prob >= 0.5  # Same binary decision as argmax for the model's two-class softmax.
        area_fraction = float(mask.mean())
        corridor_damage_fraction = float(mask[corridor].mean())
        resized_mask = Image.fromarray((mask.astype(np.uint8) * 255)).resize(original.size, Image.Resampling.NEAREST)
        overlay = Image.new("RGB", original.size, (255, 0, 0))
        blended = Image.blend(original, overlay, 0.35)
        blended.paste(original, mask=Image.eval(resized_mask, lambda v: 255 - v))
        blended.save(group_dir / f"{path.stem}-overlay.jpg", quality=90)
        rows.append({
            "group": group,
            "image": str(path.relative_to(ROOT)),
            "mean_damage_probability": float(prob.mean()),
            "damage_mask_area_fraction_at_0.5": area_fraction,
            "corridor_damage_fraction_at_0.5": corridor_damage_fraction,
            "candidate_trigger": corridor_damage_fraction >= ALERT_THRESHOLD,
            "candidate_alert_text": "Possible damaged paving ahead." if corridor_damage_fraction >= ALERT_THRESHOLD else None,
        })

summary = {}
for group, _, _ in sources:
    subset = [r for r in rows if r["group"] == group]
    summary[group] = {
        "frames": len(subset),
        "mean_damage_probability": float(np.mean([r["mean_damage_probability"] for r in subset])) if subset else None,
        "mean_mask_area_fraction_at_0.5": float(np.mean([r["damage_mask_area_fraction_at_0.5"] for r in subset])) if subset else None,
        "mean_corridor_damage_fraction_at_0.5": float(np.mean([r["corridor_damage_fraction_at_0.5"] for r in subset])) if subset else None,
        "frames_with_candidate_trigger": sum(r["candidate_trigger"] for r in subset),
        "per_frame_area_fraction": [round(r["damage_mask_area_fraction_at_0.5"], 5) for r in subset],
        "per_frame_corridor_damage_fraction": [round(r["corridor_damage_fraction_at_0.5"], 5) for r in subset],
    }
report = {
    "model": MODEL.name,
    "task": "binary footpath-damage pixel segmentation",
    "exploratory_candidate_alert": {
        "message": "Possible damaged paving ahead.",
        "pixel_threshold": 0.5,
        "corridor_damage_fraction_threshold": ALERT_THRESHOLD,
        "status": "Not calibrated; threshold was chosen after inspecting local sample outputs and is evaluated on those same correlated recordings.",
    },
    "local_review_frame_count": len(rows),
    "summary_by_clip_group": summary,
    "frames": rows,
    "limitations": [
        "These user-recorded frames were kept on this PC and were not uploaded to Kaggle.",
        "Only two damaged-paver clips and one intact-paving clip from one location are represented.",
        "Adjacent frames are correlated; this is a qualitative domain check, not an independent accuracy estimate.",
        "The model predicts generic visible footpath damage pixels, not a pothole class, depth, distance, warning time, or safe path.",
    ],
}
(OUT / "local-review.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"summary_by_clip_group": summary, "report": str(OUT / 'local-review.json'), "overlays": str(OUT)}, indent=2))
