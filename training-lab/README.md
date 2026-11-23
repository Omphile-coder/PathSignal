# PathSignal training and evaluation lab

This directory contains offline model experiments. The live website and Expo app are not modified by these scripts. Results describe the saved datasets and hardware, not independent walking performance.

The targeted second round is documented in [SECOND-ROUND.md](SECOND-ROUND.md).
It downloads full Roboflow stair-direction and missing-paver archives, groups
similar images before splitting, and trains new detection models. The sections
below describe the preserved first round; its test results remain historical.

## Fixed datasets

- Stair direction: original visually related stairwell is training (20 correlated frames); new tiled flight C is validation (10); outdoor brick steps D are evaluation (10). Exact site independence is unverified. Labels describe the direction of the steps ahead and preserve corrections to the user's original upload names.
- Public potholes: 720 publisher-augmented training images, 29 model-selection images and 30 evaluation images. One near-duplicate validation image is excluded. The 720 training images have 240 filename source groups. Public segmentation polygons are converted to boxes.
- Local paving: ten positive missing-paver frames with 15 approximate assistant-drawn region boxes, and five intact-ground frames with empty labels. All remain excluded from training and model selection for a domain check. These are different from asphalt-road potholes.

## Reproduce on this PC

Use PowerShell in `C:\Users\lucas\Desktop\PathSignal\training-lab` and the local `.venv\Scripts\python.exe` interpreter. Environment versions are saved after installation in `requirements-lock.txt`.

1. Run `prepare_datasets.py` to create the fixed source-group splits and public boxes.
2. Run `prepare_local_evaluation.py` to create local evaluation boxes and review images.
3. Run `evaluate_stair_gate.py` and `evaluate_existing_direction.py` with the existing depth-lab interpreter, which already has the compatible ONNX dependencies. These scripts use the original downloaded models.
4. Run `train_direction.py` with the training interpreter. It compares three regularisation settings using validation loss, then evaluates the selected candidate once on D. The classifier only makes sense behind a working stair detector; it cannot identify arbitrary non-stair scenes.
5. Run `train_pothole.py` with the training interpreter. It trains YOLOv8n locally on CPU, selects a checkpoint using public validation, evaluates public test metrics, and exports ONNX. A run directory already present is not silently overwritten.
6. Run `evaluate_pothole.py` after training. It uses fixed confidence 0.4, NMS IoU 0.3 and matching IoU 0.5. Green boxes in output review images are approximate local reference annotations; red boxes are predictions.

The public weights and Python dependencies must download on the first run. Keep test images out of future model-selection decisions; after viewing the test results, any further tuning turns these scenes into development data and requires a fresh final test set.

## Reading results

`datasets/split-summary.json` records split counts. `runs/` holds models, raw predictions, metrics and examples. `pothole-status.json` records training progress. The final `RESULTS.md` records the decision about app integration. A trained file existing on disk is not evidence it should ship.

See `ATTRIBUTION.md` for sources, transformations and the mirror/origin licence discrepancy.
