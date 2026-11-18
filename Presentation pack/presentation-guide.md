# PathSignal — Presentation guide

## Before the presentation

Live link — https://pathsignal-project.chic-bowl-7588.chatgpt.site

Download `/pathsignal-qr.svg` from the same site to put its QR code in your slides.

1. Open the published link in Safari on the iPhone or Chrome on a laptop. A network connection is required for the initial application and model download.
2. Tap Load AI model and wait for Ready. Keep the page open.
3. Set a comfortable media volume. Tap Test audio and confirm you hear the phrase. Browser and operating-system speech behaviour varies, so confirm this on the actual presentation device.
4. Try Black bottle, then Empty floor. These are labelled saved images processed by the real model.
5. Tap Start camera and grant permission. Stand still. Point at a nearby chair and tap Scan now. Leave the camera stopped when not demonstrating.
6. Keep the Expo Go app available as your already-tested alternative. It is separate from the website.

## Suggested three-minute script

### 0:00–0:30 — Problem

“PathSignal investigates whether an existing phone can turn a possible obstacle in a camera image into a short spoken alert. This release is a stationary prototype and supplements existing mobility tools.”

### 0:30–1:10 — Repeatable demonstration

Tap Test audio. With the model ready, choose Black bottle. Show the model's detection box and spoken alert. Choose Empty floor and show No alert on this scan.

“These images are saved examples, processed by the same model. Silence does not confirm that a path is clear.”

### 1:10–1:50 — Live demonstration

Tap Start camera. Keep the phone still and aim at a chair or person with permission. Tap Scan now. If appropriate, run repeated scans, then Stop.

“The model checks snapshots. It does not measure distance or guide an independent walk. An object class is announced once per encounter and re-armed after two scans without that class.”

### 1:50–2:25 — Architecture

“React and TypeScript handle the interface. A browser worker runs a COCO-pretrained YOLOX-S network with ONNX Runtime WebAssembly. A simple image-space corridor filters detections. The phone requests speech, and the application records the scan locally. No camera frame is uploaded.”

### 2:25–3:00 — Evidence and future work

Open the session log and export CSV. Distinguish user-reported phone observations from automated image checks. State that accuracy, useful warning distance and false-alert rate have not yet been measured. Explain that holes, steps and overhead clearance need additional sensing, models and evaluation.

## Questions examiners may ask

- **Did you train the model?** No. It is the publisher's pretrained YOLOX-S. The project implements the local pipeline, accessible feedback, corridor filtering and logging.
- **Does a 60% box score mean 60% hazard probability?** No. It is a model score and has not been calibrated for this task.
- **Why no alert on an empty floor?** The detector found no qualifying supported object in that scan. This cannot establish path safety.
- **How accurate is it?** There is no defensible task-specific accuracy percentage yet. Present observations and the planned evaluation.
- **Does it use the iPhone LiDAR?** The web and Expo Go releases do not access LiDAR. Native depth work is separate.
- **What happens if processing fails?** The interface pauses scanning and requests a spoken pause message. Audio itself must be checked on the presentation device.

## If a live example fails

Show the failure openly. Record the lighting, angle and object. Use the labelled bottle sample to demonstrate the inference pipeline. A repeatable sample is a fallback demonstration, not evidence that the live test passed.

## On an iPhone home screen

Open the live site in Safari. Use Share, then Add to Home Screen if available. This creates a shortcut to the browser app. It is not an App Store installation and does not enable native LiDAR.
