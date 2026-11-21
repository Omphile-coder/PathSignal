# Downloaded model comparison — 21 November 2026

All three downloaded models ran locally through ONNX Runtime CPU. No images were uploaded and no API key was needed for evaluation. The model files and frame files were checked against their saved SHA-256 hashes before use.

## Results

The fixed threshold was 0.40 and same-class nonmaximum suppression IoU was 0.30. Thresholds were set before running these frames and were not tuned to make a model pass.

| Downloaded model | View facing upstairs: stair detections | View looking downstairs: stair detections | Stair detections in other frames | PC median preprocessing/inference/decoding |
|---|---:|---:|---:|---:|
| Staircase Detection, YOLOv5 nano | 0 / 3 | 0 / 3 | 0 / 18 | 126.5 ms |
| Obstacle Detection, YOLOv8 nano | 3 / 3 | 3 / 3 | 0 / 18 | 143.5 ms |
| Accessibility Street, YOLOv5 nano | Not a stair-labelled model | Not a stair-labelled model | Not applicable | 126.0 ms |

The previously checked SegFormer-B0 model warned on the three facing-upstairs frames and missed the three looking-downstairs frames. Its pixel-coverage alert rule differs from the new model's bounding-box corridor rule; this is a development comparison of observed behavior, not a controlled architecture benchmark.

The YOLOv8 stair boxes overlap the configured image-space corridor in all six stair frames. Scores range from approximately 0.51 to 0.68. Visual inspection of the contact sheet shows boxes around the stair regions. These scores are model outputs, not probabilities that a route is safe.

## What the downloaded models actually contain

- `staircase-detection-mrpt2/1`: exactly `Downstair`, `Upstair`. The output shape is `[1, 25200, 7]`, consistent with two YOLOv5 classes plus box and objectness values. No detections survived the fixed threshold on these six stair frames. This does not establish that the model fails on all staircases.
- `obstacle-detection-n3eec/1`: exactly one class, `stairs`, and output `[1, 5, 8400]`. The downloaded weights do **not** have a separate hole or curb class, or ascending/descending direction labels. The embedded model metadata lists AGPL-3.0, whereas the Universe project card lists Public Domain for its dataset; those are different artefacts/terms and must not be conflated when preparing distribution.
- `accesibility-street/11`: five labels: `dificulta el paso` (obstructs passage), `inaccesible por obras` (inaccessible due to construction), `necesita rampa` (needs a ramp), `rampa inaccesible` (inaccessible ramp), `suelo inestable` (unstable ground). Its actual version is not the broad 94-class taxonomy shown on the project overview. It produced some obstruction, ramp-needed and unstable-ground labels on development clips. There is no verified geometry or boxed ground truth to score those as correct hazard alerts.

## Recommendation

Carry forward the one-class YOLOv8 stairs model for the next app integration experiment. Keep its announcement generic: “Possible stairs ahead.” Do not announce upstairs/downstairs, holes, curbs, metres or safe passage from this model. Retain the current everyday-object detector separately; the new stair model does not replace its object vocabulary.

App integration is not yet performed. Next work is to implement the version-specific RGB stretch preprocessing, YOLOv8 decoder and alert handling in the browser/phone runtimes; verify browser WASM and iPhone behavior; preserve attribution and review weight/source distribution requirements before publishing that artifact. No APK/Expo/website change is implied by these local CPU results.

## Evaluation limits

There are only eight existing development clips, with three correlated frames per clip. Six stair frames represent two staircase recordings, not six independent walking trials. No bounding-box ground truth, independent test set, walking-warning delay, metric distance, depth or physical iPhone timing is established. The other 18 frames are non-stair examples in this review; absence of stairs in an image is not proof of an obstacle-free path. Dark markings/damaged paving are not treated as verified holes.

The RGB tensor uses float bilinear stretch without antialiasing, EXIF orientation, NCHW layout and division by 255, following the downloaded preprocessing settings and Roboflow's public implementation. The evaluator supports only the actual `auto-orient`/`Stretch to` configuration present in these files and stops on unsupported preprocessing or class/output mismatches. Four offline unit checks cover channel normalisation, box scaling, YOLOv5 objectness, YOLOv8 output layout, suppression, corridor inclusion and mapping mismatch rejection. The numerical pipeline was not compared against a hosted Roboflow response.

## Review artifacts

- `comparison.json`: combined summary, exact class lists, thresholds, model hashes and timing.
- One JSON per model: all 24 frame results, boxes, scores and corridor flags.
- One contact sheet per model: first frame from each of the eight clips, with predicted boxes. Full numerical results include the other frames.
- `../evaluate_models.py`: reproducible local evaluator. Run with the project's `depth-lab/.venv/Scripts/python.exe`; it requires no key and makes no network requests.

Source implementation references: https://github.com/roboflow/inference/blob/main/inference/core/models/object_detection_base.py , https://github.com/roboflow/inference/blob/main/inference/core/models/roboflow.py , https://github.com/roboflow/inference/blob/main/inference/models/yolov8/yolov8_object_detection.py .
