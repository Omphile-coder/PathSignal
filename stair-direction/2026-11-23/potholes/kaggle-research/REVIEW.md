# Kaggle pothole candidate downloaded and inspected

23 November 2026. Source: https://www.kaggle.com/datasets/farzadnekouei/pothole-image-segmentation-dataset

The public archive was downloaded without uploading the user's recordings. `inspection.json` records its SHA-256 hash and structural checks; `inspect_dataset.py` reproduces those checks. The archive is retained unmodified. No training or app integration was performed.

## Contents actually checked

- 720 training images with 720 matching YOLO polygon label files.
- 60 validation images with 60 matching label files.
- No separate test split.
- 1,846 training polygons and 201 validation polygons. All parsed labels pass the implemented class, finite-coordinate, coordinate-range and polygon-length checks. This is structural validity, not verified annotation accuracy.
- Training filenames identify 240 source-name groups with three augmented images per group. The 720 training images must not be reported as 720 independent scenes.
- No source-name overlap was found between train and validation. This is not a visual duplicate/near-duplicate audit.
- No empty-label negative images in either supplied split.
- Six validation previews were visually reviewed: road/asphalt pothole scenes, different from the user's missing paving blocks.

## Licence discrepancy to preserve

The Kaggle metadata lists Apache 2.0, while the downloaded `data.yaml` states CC BY 4.0 for its Roboflow source. Keep both records. The originating project is https://universe.roboflow.com/farzad/pothole_segmentation_yolov8/dataset/1 . Confirm originating terms and include the appropriate dataset attribution before distributing a trained model or a repackaged dataset. Do not silently relabel all the material as Apache 2.0.

## Proposed use

Use as a road-pothole training candidate alongside separately reviewed missing-paver examples. The user's close-downward videos are useful for a local domain check but do not establish approaching-hazard warning. Fix the location/source-group split before mixing local frames into training. Add intact paving and confusing shadows/marks/drains as negatives. Reserve a genuine held-out local scene for evaluation.

Training, model export/compatibility checks, comparison on held-out scenes and integration into PathSignal remain future work. Merely downloading this archive does not add pothole detection to the shipped application.

Other metadata candidates saved here: chitholian/annotated-potholes-dataset (XML annotations) and andrewmvd/pothole-detection (VOC annotations). They were not downloaded, and overlap with this dataset or each other has not been ruled out. Do not combine them blindly.
