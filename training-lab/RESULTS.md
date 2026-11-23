# PathSignal training and evaluation results

23 November 2026. Work ran locally on the PC CPU, with no paid compute or uploads of the supplied clips. The website and Expo app have not been modified.

## Decision

- Stair direction: **do not integrate the new direction classifier**. It memorised its training scenes and did not generalise adequately. The existing stair gate also misses most new stair frames.
- Potholes: **rejected for app integration**.

These are small engineering screens, not safety acceptance criteria. Counts refer to correlated saved frames, not independent walking trials. Offline "alerts" mean algorithm decisions, not audible phone alerts. The pothole check measures full-frame recognition/localisation before any future app corridor, encounter or speech logic.

## Prepared data

- Stair direction: 20 training frames from the original stairwell, 10 validation frames from tiled flight C, and 10 evaluation frames from brick entrance steps D. Classes balanced within each split. Related clips remain grouped. Exact independent site identity is unverified.
- Road potholes: 720 augmented training images from 240 filename source groups, 29 validation images, 30 evaluation images. Polygon annotations converted to enclosing boxes. One validation near-duplicate of training was excluded; a dHash screen is not an exhaustive duplicate audit.
- Local paving evaluation: 10 missing-paver images with 15 approximate assistant-annotated boxes, plus 5 intact-ground negatives. None were used for training or model selection. These are not the same surface distribution as road potholes.
- Structural audit passed: files, label bounds, source-group separation, cross-split exact hashes, and a validation/test dHash screening check.

## Stair comparison

| Candidate | Recorded result | Interpretation |
|---|---|---|
| Current generic stair detector | 3/40 stair frames alerted; 1/15 non-stair frames alerted | Poor on these new scenes |
| Downloaded Upstair/Downstair detector | 0/40 correct direction alerts; 1/40 stair frames alerted | Does not solve the new views |
| Trained MobileNetV3 feature + direction head | Train 20/20; validation 2/10; evaluation 5/10 | Training fit does not transfer |
| Existing stair gate followed by trained head | 0/10 correct direction warnings on D | A direction head cannot repair a missing stair detection |

The backbone used frozen ImageNet weights; the project trained a new linear head. Three regularisation candidates were selected using validation loss only. A fixed 0.8 confidence rule still accepted wrong evaluation predictions: confidence is not calibrated reliability. Direction output is meaningful only behind a working stair gate.

## Pothole detector

YOLOv8n transfer training used public road-pothole boxes at 320-pixel input and a frozen early backbone. It completed 13 CPU epochs, stopping after five passes without improvement; the selected checkpoint is from epoch 8. The standard public test metrics below use that checkpoint; local counts use confidence 0.4, NMS IoU 0.3 and reference matching IoU 0.5 fixed before evaluation.

| Evaluation | Result |
|---|---|
| Public held-out images | 30 |
| Public box precision at fixed threshold | 0.689 |
| Public box recall at fixed threshold | 0.560 |
| Local defect frames with any prediction | 1/10 |
| Local defect frames with a matching defect box | 1/10 |
| Intact-ground frames incorrectly alerted | 1/5 |

Standard Ultralytics public-test metrics (fractions; distinct from the fixed-threshold measurements above):

- `metrics/precision(B)`: 0.697799
- `metrics/recall(B)`: 0.593407
- `metrics/mAP50(B)`: 0.666958
- `metrics/mAP50-95(B)`: 0.356536
- `fitness`: 0.356536

Per local clip:

- P1-pothole: 0/5 positive frames localised.
- P2-pothole: 1/5 positive frames localised.
- N1-intact: 1/5 intact-ground frames produced a false detection.

## Runtime checks and files

- Direction ONNX export: CPU output parity on 55 examples; maximum logit difference 0.00005180.
- Pothole ONNX export: five fixed local examples checked against PyTorch for raw numerical outputs and postprocessing detection counts. See `runs/pothole-evaluation/results.json` for exact checks.
- These CPU checks do not establish browser/WASM compatibility, iPhone performance or audible warning delay.
- `runs/direction/`: trained direction checkpoint, ONNX and raw comparison records.
- `runs/pothole/`: detector checkpoint, training history and export.
- `runs/pothole-evaluation/`: predictions, metrics and reference/prediction overlays (green reference, red prediction).
- `datasets/`: fixed manifests, prepared labels and audit. `run-provenance.json` records configuration hashes.
- `ATTRIBUTION.md`: model/data sources, transformations and the Kaggle/origin licence discrepancy.

## What remains before integration

Use the failure examples to expand the relevant training distribution. Stair data needs varied up/down views and a stronger stair gate; repeated frames from one flight are not a substitute. Missing-paver data must be evaluated separately from asphalt potholes. Preserve untouched locations for the next final assessment: once these evaluation outcomes influence changes, these scenes become development evidence.

No result here establishes hole depth, warning distance, prevention of falls or suitability for independent walking.
