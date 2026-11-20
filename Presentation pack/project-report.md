# PathSignal — Project brief

## Experimental stair update — 20 November 2026

The browser release now includes a separate SegFormer-B0 research mode that requests a stair warning. It recognised the supplied view facing upstairs but missed the supplied view looking downstairs. Larger candidate variants also missed that view. Both samples are available, including the labelled failure. Distance is explicitly unavailable because the supplied camera setup is uncalibrated. The original YOLOX mode remains available. See [stair-development-notes.md](stair-development-notes.md) for method, evidence and licensing. This addition does not establish reliable step, hole or independent-walking performance.


Final-year software project. Presentation release, 18 November 2026.

## Abstract

PathSignal explores whether a phone camera can provide a short spoken warning when a supported object overlaps an image-space corridor. A React and TypeScript interface captures a stationary snapshot, runs a pretrained YOLOX-S object detector locally, filters predictions and requests speech. A local event record makes each completed scan observable. The project includes an Expo Go application and a browser demonstration for sharing with examiners.

The current evidence consists of development checks on supplied images and the user's report from an iPhone test. It does not establish a warning distance, detection accuracy or suitability for independent travel.

## Problem and objective

A bottle, bag or piece of furniture in a walking path can present an obstacle to a blind or low-vision traveller. The objective is to investigate an accessible, low-cost supplemental warning interface on an existing phone. The assessment question is how consistently the prototype warns about an obstacle under a defined setup.

## Delivered scope

- Rear-camera access with explicit Start and Stop controls.
- Pretrained YOLOX-S inference on the device, using ONNX Runtime WebAssembly.
- A fixed image-space corridor, score filtering and class-aware non-maximum suppression.
- Manual scans and repeated sequential scans, with a pause between completed scans.
- Short spoken alerts, Test audio and Repeat last alert controls.
- One announcement per class encounter, re-armed after two usable scans without that class.
- Explicit paused states for camera or processing failures and backgrounding.
- Bottle and empty-floor sample images, labelled separately from live input.
- Local scan history and CSV or JSON export, without saving camera images.
- Public project showcase, technical notes, presentation guide and evaluation worksheet.

## Technical approach

The interface resizes the frame to a maximum long side of 480 pixels. Preprocessing letterboxes to 640 × 640 with padding value 114 and BGR planar float data. YOLOX-S produces object predictions. The decoder applies objectness multiplied by class score, a 0.25 threshold and class-aware suppression at an intersection-over-union threshold of 0.45. Selected relevant object classes are retained.

For a detection to qualify, the bottom of its box must extend below 28% of image height, and its box must overlap the trapezoid at that height. This is an image heuristic, with no camera pose, floor segmentation, physical height or depth estimate. A chair partly outside the centre can still qualify through its bounding box. Recognition scores are model outputs and are not measured probabilities of a hazard.

Browser inference runs in a separate worker so it does not synchronously block the interface. Model parts are checked using SHA-256 before initialization. The runtime uses one WASM thread to avoid requiring cross-origin isolation. Initial network access downloads the application, model and runtime. Camera frames remain in local memory and are not uploaded by the application. The browser may cache downloaded assets, but this release does not guarantee offline use.

## AI contribution and attribution

YOLOX-S is an existing COCO-pretrained model from its publisher. No additional training or fine-tuning used the user's clips, screenshots, or Kaggle datasets. PathSignal's work is the integration, accessible interaction, local image pipeline, corridor logic, encounter handling and evaluation instrumentation. Do not present the neural network as an original model trained by the student.

Earlier work included a simple black-bottle appearance baseline and a lightweight COCO-SSD integration. YOLOX-S was adopted after the earlier detector missed visible chairs in supplied office images.

## Evidence available

| Evidence source | Observation | Limit |
| --- | --- | --- |
| User report from iPhone Expo build | Detected chairs and people. No alert on the empty floor tested. | Trial counts and conditions were not recorded. |
| Desktop Chromium and WebKit checks | Recognised chairs in both supplied office screenshots and a person in the first. | Still images checked during development, not an independent test set. |
| Desktop WebKit sample check | Recognised the bottle sample and returned no hazard for the empty-floor sample and a blank image. | Small number of development examples. |

Build success is a software check, not recognition evidence. Successful examples must not be converted into an accuracy percentage. The existing samples must not be counted as held-out trials after tuning.

## Limitations and ethics

This is a stationary research demonstration that supplements existing mobility tools. Silence does not confirm a clear path. Missed detections, incorrect classes, false alerts, slow scans and camera interruptions remain possible. The model has no dedicated labels for holes, steps or raised paving. Thin overhead hazards can be missed. Distance and safe clearance are not measured.

The website is a hosted presentation release. Publishing it does not establish readiness for unsupervised walking or replace a mobility assessment. The native iPhone LiDAR experiment remains a separate, signed-build research path and is not active in this website or Expo Go.

Logs are saved only in this browser, capped at 200 scans. They contain timestamps, source labels, object classes, processing duration and whether speech was requested. They contain no captured image, GPS coordinates or account information. Downloaded exports are controlled by the person using the page. Hosting infrastructure necessarily handles ordinary requests for application files.

## Evaluation to complete

Freeze the model, threshold, corridor, camera angle and phone. Choose the minimum useful warning distance before collecting scores. Collect fresh obstacle-present and empty-path trials under defined lighting and positions. Record early, late, missed and false alerts. Report counts, measurable warning distances, audible latency and at least one failure example. Keep replay and still-image checks separate from physical approach trials. Use a supervised operator who can see the path.

## Presentation

Demonstrate the audio check, a real-model bottle sample, the empty-floor sample and a stationary camera scan. Export the log. Explain both successful behaviour and the boundaries of the evidence. Add your institution, degree programme, name, student number, supervisor and required academic declaration in your university submission. This brief is supporting material and has not been adapted to an institution's rubric.

## References

- YOLOX model and source — https://github.com/Megvii-BaseDetection/YOLOX
- YOLOX ONNX inference reference — https://github.com/Megvii-BaseDetection/YOLOX/tree/main/demo/ONNXRuntime
- ONNX Runtime Web — https://onnxruntime.ai/docs/tutorials/web/
- Browser camera API — https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Lazarillo, project inspiration — https://lazarillo.app/theapp/
- WeWALK, project inspiration — https://wewalk.io/en/support-articles/

The inspiration references are not endorsements or evidence of equivalent functionality.
