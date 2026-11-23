# Corrected targeted-model decision report — 23 November 2026

## Decision

Neither corrected candidate qualifies for PathSignal app integration under the predeclared local engineering screens. Both CPU ONNX exports match their PyTorch outputs on the checked frames. Browser and iPhone tests were not run because the candidates failed the local screen. The existing app was not changed.

These are small, correlated development-frame checks. They do not establish safe walking use, warning distance, depth measurement, general hole detection, or performance at unseen locations.

## Corrected datasets and training

The first stair run was invalidated after a later filename-variant audit found related images across publisher splits. Corrected runs grouped normalized filenames, perceptual candidates, and exact duplicates before splitting. Local user clips were excluded from training and checkpoint selection.

| Candidate | Source images | Selected | Train / validation / test | Public test mAP50 | CPU ONNX parity | Decision |
|---|---:|---:|---:|---:|---|---|
| stairs-v1-corrected | 1289 | 543 | 381 / 81 / 81 | 0.762 | True | rejected_for_app_integration |
| missing-tile-v2-corrected | 432 | 406 | 284 / 61 / 61 | 0.950 | True | rejected_for_app_integration |

The missing-tile public test has highly repetitive tiled backgrounds. Its strong public score is not representative of different outdoor paving. The local labels are approximate, single-assistant box annotations.

## Stair direction

- Stair frames with a generic stair alert: **31/40**.
- Correct direction alerts: **14/40**; wrong direction alerts: **7/40**.
- Non-stair paving/intact frames with alerts: **3/15**; older negative checks with alerts: **1/15**.

| Stair clip | Frames | Generic alerts | Correct direction | Wrong direction |
|---|---:|---:|---:|---:|
| A-up | 5 | 4 | 3 | 0 |
| A-down | 5 | 5 | 5 | 0 |
| B-up | 5 | 5 | 0 | 2 |
| B-down | 5 | 5 | 4 | 0 |
| U1-up | 5 | 5 | 2 | 0 |
| U2-up | 5 | 2 | 0 | 0 |
| C-down | 5 | 5 | 0 | 5 |
| D-down | 5 | 0 | 0 | 0 |

Direction fails the preset screen: seven wrong-direction alerts (limit one), plus three alerts across the 15 non-stair paving/intact frames (limit one). This model should not be used to tell a traveler whether stairs go up or down.

## Missing-paver localization

- Local defect frames with any model box: **6/10**.
- Local defect frames with a box matching the saved reference at IoU 0.5: **0/10**.
- Intact-ground frames with a corridor alert: **0/5**.
- Stair frames with a false missing-paver corridor alert: **3/40**; older negative checks alerted: **0/15**.

| Defect clip | Frames | Frames with any box | Frames with matched box |
|---|---:|---:|---:|
| P1-pothole | 5 | 1 | 0 |
| P2-pothole | 5 | 5 | 0 |

The corrected evaluator attaches the frozen local reference boxes to the corrected model run and records all prediction boxes and scores in `runs/missing-tile-v2-corrected-evaluation/results.json`. The model did not localize any annotated defect box at the fixed IoU threshold, so it fails the local screen despite public test performance. This is a failed detection/localization check, not evidence that the road defects are absent.

## Reproduction and artifacts

Run `training-lab/.venv/Scripts/python.exe training-lab/build_corrected_report.py` from the project root to regenerate this report and `training-lab/corrected-model-decisions.json`. Per-frame predictions, evaluation policy, ONNX parity checks, checkpoints and exported ONNX files remain in the corresponding `training-lab/runs/*-corrected*` folders.

Next model iteration should add independently sourced outdoor missing-paver scenes and stair scenes, then reserve unseen locations for evaluation. Do not integrate either current candidate until it passes a fixed local screen and browser decoder/runtime parity. iPhone validation remains a later, supervised prototype test.
