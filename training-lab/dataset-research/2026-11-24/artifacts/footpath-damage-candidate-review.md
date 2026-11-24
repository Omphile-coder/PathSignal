# Footpath damage segmentation candidate — 2026-11-24

## Candidate and source

A DeepLabV3-ResNet50 binary semantic segmentation model was trained on the Indian Footpath Damage Segmentation Dataset (583 images: 411 train, 85 validation, 87 test). The source declares CC BY 4.0. Training stopped early after 6 epochs; checkpoint selection used validation foreground IoU (best at epoch 3). The held-out test split was evaluated once. Dataset: [Zenodo record 15414238](https://doi.org/10.5281/zenodo.15414238). Citation: Chakurkar, P. et al. (2025), *Indian Footpath Damage Segmentation Dataset*.

## Held-out source test result

- Foreground IoU: **0.514**
- Pixel precision: **0.622**
- Pixel recall: **0.746**
- Test images: **87**

These are pixel-segmentation metrics on the dataset's own test split. They do not measure detection distance, warning time, object-level recall, or safety. The source imagery is from Pune, India, not a held-out South African location.

## Local qualitative check

The exported ONNX model and its external weights file loaded in ONNX Runtime on this PC and processed 15 previously supplied frames. Frames are consecutive samples from two damaged-paver clips and one intact-paving clip, all from one location. Local footage remained on this PC and was not uploaded to Kaggle.

| Clip group | Frames | Mean predicted damaged-pixel area at 0.5 | Mean pixel probability |
| --- | ---: | ---: | ---: |
| P1 damaged paving | 5 | 8.9% | 0.109 |
| P2 damaged paving | 5 | 19.7% | 0.227 |
| N1 intact paving | 5 | 1.1% | 0.019 |

The candidate marked substantially more image area in both damaged clips than in the intact clip. Visual overlays show some activation around the damaged paving, but also spill onto shadows, debris, and the operator's shoes. This is evidence of a useful research direction, not a reliable hazard alert. Since adjacent frames are correlated and all clips are from one site, these values are not independent accuracy estimates.

## Experimental alert-rule check on the same clips

I added an offline PathSignal-style trigger rule to the local evaluator: “Possible damaged paving ahead.” It fires when at least 5% of the image-space corridor is marked as damage at pixel probability 0.5.

| Clip group | Candidate alert frames |
| --- | ---: |
| P1 damaged paving | 5/5 |
| P2 damaged paving | 5/5 |
| N1 intact paving | 0/5 |

**This is not an independent evaluation.** I chose the 5% corridor threshold after reviewing these same clips and model outputs. The result is only a feasibility demonstration that the model output can drive an alert decision. At the time of this initial evaluation, the app had not yet played the alert. A later feature branch adds it as an opt-in experimental mode; the rule is not calibrated for new locations, lighting, camera angles, or ground conditions.
## Decision

**Integrate only as an opt-in experimental mode; do not make it a default or imply production reliability.** Feature branch `feature/footpath-damage-alert` adds the same model version, preprocessing and corridor trigger to the presentation site and phone app. Model files are downloaded once and inference is local; the live site and phone will have the mode after the branch is committed, pushed and deployed. This release mode is still not an independent evaluation: the threshold was selected on those same clips, and the dataset task is generic visible damage rather than a calibrated trip-risk label.

Before integration, gather varied damaged and intact paving from multiple locations, label pixel masks, test with a split by recording/site, define a permitted false-alert rate and required detection recall, and verify full on-device inference latency and alert behavior. Distance and depth remain unsupported.

## Artifacts

- `footpath-damage-evaluation-report.json` — Kaggle test metrics and stated limits
- `footpath-damage-training-history.json` — per-epoch training/validation log
- `footpath-damage-deeplabv3.onnx` plus `footpath-damage-deeplabv3.onnx.data` — ONNX model and required external tensor data
- `local-review.json` — per-frame results
- `../runs/footpath-damage-local-review/` — red-overlay visual outputs
- Runner: `training-lab/run_footpath_damage_local_review.py`


