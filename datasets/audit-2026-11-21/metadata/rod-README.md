---
license: mit
language:
- en
task_categories:
- object-detection
pretty_name: ROD-Dataset — Real-Time Obstacle Detection (YOLO)
size_categories:
- 10K<n<100K
tags:
- yolo
- yolov8
- object-detection
- obstacle-detection
- assistive-technology
- mobile-vision
- edge-ai
- urban-scenes
- autonomous-systems
- computer-vision
- dataset
configs:
- config_name: default
  data_files:
  - split: train
    path: train/metadata.csv
  - split: validation
    path: valid/metadata.csv
  - split: test
    path: test/metadata.csv
---

# ROD-Dataset: Real-Time Obstacle Detection for Smartphone-Based Assistive Vision 

![Total downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fhuggingface.co%2Fapi%2Fdatasets%2FAbtinzandi%2FObstacle-Detection-Dataset-YOLO%3Fexpand%255B%255D%3DdownloadsAllTime&query=%24.downloadsAllTime&label=total%20downloads&color=yellow)

**24,326-image, 25-class YOLO dataset for obstacle detection**

This dataset is the data product of our Real-Time Obstacle Detection (ROD) project at Amirkabir University of Technology, Tehran. The project addresses two related public-safety problems on the city sidewalk: the limited situational awareness of people living with visual impairments, and the elevated collision and fall risk for pedestrians who walk while looking at their phones. The deployed system runs an optimized YOLOv8n detector directly on a mid-range Android phone, pairs it with ARCore for monocular distance estimation, and delivers feedback as Text-to-Speech for visually impaired users and as vibration cues for distracted ones. The whole pipeline is built to run on consumer hardware, so no LiDAR, depth camera, or external sensor is required.

The release contains 24,326 annotated images and 40,195 bounding boxes across 25 obstacle categories, split 19,186 / 3,511 / 1,629 into train, validation, and test. Annotations follow the standard YOLO Darknet TXT format (one line per box, normalized coordinates), and the class-index mapping is fixed in `data.yaml`. The 25 classes cover vehicles (Car, Bus, Truck, Motorcycle, Bike), street users (Person, Dog), built-environment elements (Building, Tree, Stairs, Manhole, Guard rail, Pedestrian crosswalk, Road), and the kinds of street furniture that general-purpose detectors typically miss in practice (Dustbin, Bench, Chair, Plant Pot, Electrical Pole, Electrical Box, Bicycle Rack, Traffic Cone, Traffic Barrel, Traffic Sign, Fire Hydrant). Files are numbered sequentially from `IMG_00001.jpg` to `IMG_24326.jpg`, with each image paired to a same-stem `.txt` label.

The dataset was built in two parallel tracks. First, we integrated twenty-six publicly available collections from Roboflow Universe (full reference list in the paper) and unified their taxonomies into a single 25-class schema scoped to what a phone-carrying pedestrian actually encounters; class indices were reconciled by hand across sources because the same object name often maps to different IDs in the originals. Second, we collected our own street-level imagery in Canadian and Iranian cities to cover scenes and street-furniture variants that the public Roboflow sources under-represent, then annotated those images using CVAT for the bounding-box drawing pass and Roboflow workflows for preprocessing, augmentation, version control, and YOLO-format export. Image–label pairing was verified end-to-end after the merge, and we deliberately preserved variety in lighting, weather, viewing height, and region rather than over-fitting to a single capture setup. The resulting distribution is long-tailed and reflects the realities of urban scenes: `Person`, `Car`, and `Manhole` are heavily represented, while rarer but safety-relevant classes such as `Bicycle Rack` and `Fire Hydrant` are kept on purpose so that compact detectors can still learn them.

## Dataset Structure

```
.
├── data.yaml                 # YOLO config: paths, nc=25, class names
├── class_distribution.csv    # Per-class bbox counts (train / valid / test / total)
├── images_manifest.csv       # Per-image: split, filenames, num_objects, classes
├── train/
│   ├── images/IMG_00001.jpg .. IMG_19186.jpg
│   ├── labels/IMG_00001.txt .. IMG_19186.txt
│   └── metadata.csv          # HF Dataset Viewer index for this split
├── test/
│   ├── images/IMG_19187.jpg .. IMG_20815.jpg
│   ├── labels/IMG_19187.txt .. IMG_20815.txt
│   └── metadata.csv
└── valid/
    ├── images/IMG_20816.jpg .. IMG_24326.jpg
    ├── labels/IMG_20816.txt .. IMG_24326.txt
    └── metadata.csv
```

## Data Fields

Each row in a split's `metadata.csv` contains:

- `file_name` — relative path to the image inside the split folder
- `label_file` — relative path to the matching YOLO label
- `num_objects` — total bounding boxes in the image
- `class_ids` — comma-separated list of unique class IDs present
- `class_names` — comma-separated list of unique class names present
- `bboxes_yolo` — JSON array of all boxes; each box is `{class_id, x_center, y_center, width, height}` with coordinates normalized to `[0, 1]`

YOLO label files (`labels/IMG_*.txt`) follow the standard Darknet format: one box per line, `class_id x_center y_center width height`, all coordinates normalized.

## Splits

| Split | Images | Bounding Boxes |
|-------|-------:|---------------:|
| train | 19,186 | 32,251 |
| valid | 3,511  | 5,572  |
| test  | 1,629  | 2,372  |
| **Total** | **24,326** | **40,195** |

## Classes

| ID | Name | ID | Name | ID | Name |
|---:|------|---:|------|---:|------|
| 0 | Bike | 9 | Dustbin | 18 | Traffic Cone |
| 1 | Building | 10 | Dog | 19 | Fire hydrant |
| 2 | Car | 11 | Manhole | 20 | Traffic Barrel |
| 3 | Person | 12 | Tree | 21 | Plant Pot |
| 4 | Stairs | 13 | Guard rail | 22 | Electrical Box |
| 5 | Traffic sign | 14 | Pedestrian crosswalk | 23 | Chair |
| 6 | Electrical Pole | 15 | Truck | 24 | Bicycle Rack |
| 7 | Road | 16 | Bus | | |
| 8 | Motorcycle | 17 | Bench | | |

Per-class counts per split are in `class_distribution.csv`.

## Usage

### Train a YOLOv8 model directly

```bash
pip install ultralytics
# Edit data.yaml paths if needed, then:
yolo detect train data=data.yaml model=yolov8n.pt epochs=100 imgsz=640
```

### Load with the `datasets` library

```python
from datasets import load_dataset

ds = load_dataset("Abtinz/Obstacle-Detection-Dataset-YOLO")
print(ds)
# DatasetDict with 'train', 'validation', 'test' splits
# Each row has file_name, num_objects, class_ids, class_names, bboxes_yolo
```

## Research Paper & Citation

This dataset is introduced and documented in our research paper, *ROD-Dataset: A Pedestrian-Perspective Benchmark of Urban Obstacle Classes for YOLO-Based Detection* (Zandi et al., 2026), available on arXiv. If you use this dataset in your research, experiments, or applications, please cite our paper to acknowledge the dataset and its contributors.

**Paper:** https://arxiv.org/abs/2611.00681

## Source Data

- **Public sources:** twenty-six obstacle / street-object collections aggregated from [Roboflow Universe](https://universe.roboflow.com); full citation list is in the accompanying paper.
- **In-house capture:** original sidewalk-level imagery photographed by the project team in Canadian and Iranian cities to cover scenes that public sources under-represent (regional street furniture, mixed signage conventions, and varied weather).
- **Annotation pipeline:** in-house images were boxed in [CVAT](https://www.cvat.ai); preprocessing, augmentation, dataset versioning, and YOLO-format export were managed through [Roboflow](https://roboflow.com) workflows.

## Citation

If you use this dataset, please cite the accompanying paper:

```bibtex
@article{zandi2026rod,
  title   = {Real-Time Obstacle Detection and Distance Estimation on Smartphones for Visually Impaired and Distracted Pedestrians},
  author  = {Abtin Zandi, Ariyan Azami, Parsa Abbasian, Sarvin Nami, Roza Ganjipour, Bardia Sabagh Kermani, and Dr. Hamed Farbeh},
  affiliation = {Department of Computer Engineering and Information Technology, Amirkabir University of Technology, Tehran, Iran},
  year    = {2026}
}
```

## License

Released under the MIT License. The integrated Roboflow Universe sources retain their original licenses.

## Contact

- Abtin Zandi — abtinzandi@gmail.com
- Sarvin Nami — srvn0nm@gmail.com
- Hamed Farbeh (corresponding) — farbeh@aut.ac.ir

Issues, missed labels, and collaboration inquiries are welcome.