# PathSignal Depth Lab

Double-click **Start PathSignal Depth Lab.cmd** in the Desktop PathSignal folder. Keep the terminal open while reviewing the lab. It listens on this PC at http://127.0.0.1:8768 and processes the images locally.

- **Estimate depth.** Add an indoor JPEG or PNG and select **Analyse**. Click the result image, or enter the coordinates as percentages, to read the local estimated depth in metres. A patch median smooths isolated pixels. The colours indicate relative depth within each image.
- **Compare for a floor change.** Fix the rear camera position, height, orientation, and lighting. Take a reference with the floor empty and another image with the test object or surface in view. Load both and choose **Floor and lower path**. A nearer region can be a raised object or surface. A deeper region can be a depression or drop-off.
- **Compare for an upper-path change.** Use a level, fixed view at the height relevant to the intended test. Provide an empty reference with the same view and choose **Upper path, level camera**. This flags nearer regions in the selected part of the image. It does not measure head clearance.

The comparison uses the side regions to check for some framing or depth changes. Keep the phone fixed even if an image pair passes those checks. Model estimates can shift with lighting, floor texture, camera pitch and different objects. A small height difference can be missed. A slab, step, or hole is a possible explanation for a candidate region, and the app does not identify the hazard type or guarantee a safe path. Point depth is a model estimate from the camera view. It is not measured walking distance.

## What was checked

- **Object detector replay:** With the current thresholds, COCO-SSD missed the black bottle on all eight sampled frames. It logged zero detections on seven sampled empty-floor frames. These are 1 fps frame samples from two clips, not independent trials. The earlier black-bottle baseline did alert on the bottle, and it remains available in the Expo app. Raw replay results are in `replay-results.json`.
- **Depth model and browser:** The model returned a depth map and point estimate on the sample bottle photo. An identical empty photo pair gave zero candidate regions. The supplied bottle versus empty photo pair also gave zero candidate regions, despite the visible bottle. The two original clips were handheld.
- **Comparison logic:** Artificial depth grids exercised nearer floor changes, deeper floor changes, upper obstructions, and unchanged views. These fixtures check how the comparison responds to given depth data. They do not measure how accurately the depth model sees real hazards.

## Measured trial

Before judging accuracy, set the phone on a fixed mount, mark distances with a tape measure, and place a soft object on the path. Record the actual distance and the lab estimate at the same visible point. Collect an empty reference at each camera position. Use controlled, supervised images of a step or a simulated depression and of a soft overhead obstruction. Log misses, false candidates, and absolute depth error. Keep the phone still and keep people away from the test hazards.

The depth lab runs on the PC. The Expo Go app still runs its object and black-bottle detectors independently.

Model: [Depth Anything V2 metric indoor Small](https://github.com/DepthAnything/Depth-Anything-V2/tree/main/metric_depth) using the [ONNX export by 77ukhtar](https://huggingface.co/77ukhtar/depth-anything-v2-metric-onnx).

## Object comparison

Use **Check sample bottle** for the supplied example or **Check objects** with an uploaded still image. The PC lab uses YOLOX-S with a score threshold of 0.25. Amber boxes overlap the image-space corridor. The score is a model output, and the box alone gives no height or distance.

On the 15 sampled phone frames, YOLOX-S detected a bottle in 8 of 8 bottle frames and in 0 of 7 empty-floor frames. COCO-SSD and YOLOX-Nano detected no bottles in these frames at the same score threshold. The samples come from two clips. Consecutive samples are not independent trials.

| Model | Matched TACO bottles | Unmatched predictions | Missed TACO bottles |
| --- | ---: | ---: | ---: |
| COCO-SSD | 8 | 2 | 28 |
| YOLOX-Nano | 8 | 4 | 28 |
| YOLOX-S | 11 | 2 | 25 |

The exploratory TACO sample contains 32 public thumbnails, 24 with annotated bottles and 8 without an annotated bottle. A prediction matches at box IoU of at least 0.50. Bottle examples were sampled from images with at least one bottle box covering more than 1.2% of the original image, so the results do not estimate performance on the full dataset. The JSON in **evaluation** records the sample IDs, source URLs, annotations and outputs. No model was retrained. The YOLOX-S path runs in the PC lab. Phone object mode still runs COCO-SSD.

[Original TACO annotations](https://github.com/pedropro/TACO) · [YOLOX model and preprocessing reference](https://github.com/Megvii-BaseDetection/YOLOX/tree/main/demo/ONNXRuntime)
