# Targeted stair and missing-paver training — 23 November 2026

This round addresses the failures recorded in RESULTS.md. That historical report
and its rejected models remain unchanged. Training completion is recorded in
`stairs-v1-status.json` and `missing-tile-v2-status.json`; a missing completion
record means training has not finished. New weights are not automatically
installed into PathSignal.

## Downloads and attribution

Both full YOLOv8 archives were downloaded through the user's signed-in Roboflow
session. No user videos or photos were uploaded and no paid training was used.
Original archives are preserved under
`dataset-research/2026-11-23/incoming/`.

| Source | Version | Images | Classes | Licence |
|---|---|---:|---|---|
| [stairs / up-down-stairs](https://universe.roboflow.com/stairs-n9kkx/up-down-stairs/dataset/1) | 1 | 1,289 | downstairs, upstairs | CC BY 4.0 |
| [aoqiangma / missing_tile](https://universe.roboflow.com/aoqiangma/missing_tile/dataset/2) | 2 | 432 | missing_tile | CC BY 4.0 |

These are public computer-vision datasets, not evidence of validated pedestrian
assistance. Attribute the original authors when distributing model artefacts.
The YOLOv8 training/runtime integration uses Ultralytics' AGPL-3.0 software;
preserve the existing source/licence offer when distributing the app.

## Duplicate and annotation checks

`audit_targeted_archive.py` checked image decoding, safe archive paths, label
coordinates and class IDs. Both archives had zero structural issues and zero
exact decoded-pixel duplicate pairs. That does **not** mean zero related images.

| Dataset | Perceptual/source-name candidate pairs | Across publisher splits | Representative groups | Train / validation / test |
|---|---:|---:|---:|---|
| Stairs | 1,132 | 381 | 544 | 382 / 81 / 81 |
| Missing pavers | 39 | 7 | 406 | 284 / 61 / 61 |

Candidate pairs use dHash or pHash distance <= 8, exact pixels or identical
source names. Connected components are kept together. One representative is
selected from each group, excluding 745 stair and 26 paver views from the
prepared data. Nothing is deleted from the source archives. New group splits
replace publisher splits; seed 2311, approximately 70/15/15, stratified by labels.
YOLO polygon annotations are converted to enclosing detection boxes.

Annotation contact sheets were visually inspected. The paver collection repeats
a distinctive square-grid tiled surface extensively; some examples look edited,
but their creation process is unverified. Perceptual hashing does not prove
independence of these backgrounds. Public test results are therefore **internal
dataset benchmarks**, not estimates for unseen paving sites. The stair samples
include watermarks, some rotated images and inconsistent box extents. The full
collection has not been manually relabelled or independently adjudicated.

A later audit pass found filename variants such as `15flip` and `15_output`
that were not caught by the initial similarity pass. The first stair training
attempt is invalidated and its metrics will not be used. The corrected pipeline
groups normalized filename variants before splitting and training again.

## Training and evaluation

Local CPU training starts with COCO-pretrained YOLOv8n, fine-tunes the whole
network at 416 x 416, and selects the best validation checkpoint. Up to 40 epochs
with patience 10. Small geometric/colour augmentations are enabled; vertical
flips are disabled. All cloud tracking integrations are disabled.

The user's 55 previously inspected frames are **excluded from this round's
training and checkpoint selection**. They are known development/regression
material from the first round, not a fresh blind test. Forty stair frames cover
three conservative location groups; ten missing-paver frames cover two clips
from one paving area; five intact-ground frames are a very small negative set.

`targeted-policy.json` fixes confidence, NMS, matching and preliminary integration
screening before this round's local predictions are inspected.
`evaluate_targeted.py` reports fixed-threshold box results, per-clip outcomes,
stair direction abstentions, wrong directions, and image-space corridor results.
Boxes on the local missing pavers are approximate single-assistant annotations.

Further browser ONNX checks are required for any candidate that passes this
small engineering screen. Passing does not validate warning distance, general
holes, depth, walking, stair traversal or independent mobility. Physical iPhone
testing remains a separate step.

## Reproduce

Use `training-lab/.venv/Scripts/python.exe` to run these scripts from this folder:

1. `audit_targeted_archive.py <archive.zip> --output <audit-folder>`
2. `prepare_targeted.py stairs-v1` and `prepare_targeted.py missing-tile-v2`
3. `verify_targeted_data.py`
4. `train_targeted.py stairs-v1 --epochs 40`
5. `train_targeted.py missing-tile-v2 --epochs 40`
6. `evaluate_targeted.py stairs-v1` and `evaluate_targeted.py missing-tile-v2`

Prepared-dataset and training run folders deliberately refuse overwrites. Use
separate versioned folders for a changed experiment, rather than mixing runs.
