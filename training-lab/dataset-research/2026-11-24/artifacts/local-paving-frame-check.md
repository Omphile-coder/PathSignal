# Local paving frame check — 2026-11-24

## Outcome

The downloaded MobileNetV3-Small ONNX candidate loaded successfully in ONNX Runtime CPU and processed 15 locally saved frames.

At the threshold selected on the public dataset's validation split (0.65):

- Pothole / damaged-paver clips: **0 of 10 frames** were classified as bad surface quality. Mean score: **0.459**.
- Intact paving clip: **0 of 5 frames** were classified as bad surface quality. Mean score: **0.285**.

The scores for the 10 pothole frames ranged from 0.230 to 0.612; all were below 0.65. Lowering the threshold after seeing these local results would be retuning on this small check, so this result does not justify changing the threshold.

## Interpretation

This candidate did **not** pass this quick local pothole-frame check. It separates the five sampled intact frames from the damaged-paver frames only weakly at the published threshold, and it produced no alerts for the pothole frames. Do not integrate it as a PathSignal hazard alert model based on these results.

The public held-out StreetSurfaceVis score (precision 77.2%, recall 82.6%, F1 79.8%, specificity 97.0% at 0.65 on 776 images) measures an image-level perceived-surface-quality label, not pothole or trip-hazard detection. Its test subset for paving stones contained no positive examples, so it did not establish damaged-paving recall.

## Limits of this local check

These frames come from two user-recorded pothole clips and one intact-paving clip from a single location. Neighboring video frames are correlated, and only five intact frames are available. This is a small qualitative check, not an independent accuracy estimate, proof of generalization, localization, distance measurement, or walking safety.

## Files

- `surface-quality-mobilenetv3.onnx` and its external weights `surface-quality-mobilenetv3.onnx.data`
- `best-mobilenetv3-small.pth`
- `evaluation-report.json` and `training-history.json`
- `local-paving-frame-check.json` (per-frame model scores)
- Runner: `training-lab/run_surface_quality_candidate.py`
