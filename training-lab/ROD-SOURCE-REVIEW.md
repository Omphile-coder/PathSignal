# ROD dataset intake — 23 November 2026

## Download

Fetched with KaggleHub from `abtinzandi/obstacle-detection-dataset`. The extracted files are stored under `dataset-research/2026-11-23/incoming/rod-kaggle/ROD-Dataset/dataset/`. The incoming directory is Git-ignored; do not add the raw dataset to the PathSignal repository. `download_rod_kaggle.py` reproduces the download. Install `requirements-dataset-download.txt` first.

The Kaggle citation file is at `dataset-research/2026-11-23/incoming/rod-kaggle/citation_kaggle.md`; source citations are in `citations.txt`. The dataset contains 24,326 images, 40,195 boxes, and 25 classes. Published splits are 19,186 train, 3,511 validation, and 1,629 test images.

## Useful coverage and gaps

ROD includes pedestrian-view examples of stairs, bikes, vehicles, people, electrical poles and boxes, dustbins, dogs, manholes, trees, guard rails, benches, traffic cones/barrels, fire hydrants, plant pots, chairs, and bicycle racks. It has no explicit pothole, rock, wall, raised-slab, or missing-paver class. `Building` is not a reliable stand-in for a wall that blocks the walking line. `Road` and `Pedestrian crosswalk` are scene/surface classes and should not automatically trigger obstacle speech.

The project already has a separate pothole dataset at `datasets/pothole/`: 720 training images and 30 test images, with no validation split. Its existing manifest groups related source filenames; create validation data by source group before combining. Keep a test split out of training and score reporting.

## Licensing and attribution

The dataset card declares MIT for the merged dataset, while explicitly stating that the integrated Roboflow collections retain their original licenses. The package includes `citations.txt` and `citation_kaggle.md`; preserve these with the research records. Check source-level license and attribution terms before redistributing merged data or trained weights. This intake is for the academic prototype and does not certify redistribution rights.

## Audit and detector preparation

`audit_rod_dataset.py` checks every image/label pair, image decoding, mixed YOLO box/polygon formats, normalized geometry, manifest object counts, and exact-pixel duplicates. The audit passed all 24,326 images with 0 malformed labels. It found 470 extra copies, including 77 duplicate pairs across published splits. Perceptual near-duplicate detection was not run, so differently compressed or resized copies may remain.

`prepare_rod_detection.py` creates `datasets/rod-detection-cleaned/` (Git-ignored) for detector training. It converts polygons to enclosing boxes, removes exact duplicate images with test > validation > training priority, and excludes 15 exact-image groups whose annotations materially disagree. The prepared counts are 18,732 train, 3,480 validation, and 1,629 test images, with 39,604 boxes. It retains Kaggle citations. The downloaded source stays untouched.

The current PC has CPU-only PyTorch, and a full 24K-image training run here is impractically slow. `Kaggle-ROD-Train.ipynb` is the ready-to-import GPU notebook: attach the public Kaggle dataset, select a GPU, and run all cells. It repeats the label/duplicate cleanup in Kaggle, trains YOLOv8n, evaluates the held-out test split once, exports ONNX, and saves a report. `train_rod_detector.py` provides the same training/evaluation flow when the cleaned dataset is already available locally. Do not use test images for tuning. The selected model still needs device-side latency and class-specific false-alert/miss evaluation before app integration.

Rare classes such as Bicycle Rack and Fire Hydrant have only a few hundred boxes. ROD has no explicit pothole, rock, missing-paver, raised-slab, or wall-collision class. The separate pothole dataset must be prepared and validated before combining it as a 26th class. Do not claim universal hazard recognition. Distance estimation remains deferred; a bounding box is not a metric distance.

## Sources

- Kaggle dataset: https://www.kaggle.com/datasets/abtinzandi/obstacle-detection-dataset
- Dataset overview and class list: https://walksentry.com/dataset
- Hugging Face copy: https://huggingface.co/datasets/Abtinzandi/Obstacle-Detection-Dataset-YOLO
- Paper: https://arxiv.org/abs/2611.00681
- Existing pothole source dataset record: `datasets/pothole/manifest.json`
