# Experimental stair detection — 20 November 2026

This update uses the clips already supplied. It does not require a new recording session or an assumed camera height.

## What changed

The browser demo has two selectable modes. Everyday objects retains YOLOX-S. Stairs (experimental) loads a separate COCO-independent semantic segmentation model, SegFormer-B0 pretrained on ADE20K, using Xenova's quantized ONNX conversion. Switching modes stops the camera and unloads the previous model. The same camera, sample-image controls, speech requests, local logs and exports can be used with either mode. Each new log entry identifies its model and mode.

The stair mode requests “Possible stairs ahead.” It makes no upward/downward classification and provides no distance estimate. The box encloses predicted stair pixels and does not measure a physical step edge or clearance.

## Observed behaviour and a known failure

The supplied view facing upstairs produced a stair region. The supplied view looking downstairs was missed by the first candidate and both larger variants checked. The small model was selected for this experimental release because the larger downloads did not resolve that important failure.

The website includes both views. The looking-downstairs sample is explicitly labelled “Known missed example.” A quiet result on it is a missed detection, not evidence of a clear path.

The ordinary-ground, dark-marking and empty-tile examples are useful checks for false stair alerts. The dark-marking video also shows cracked or patched paving. Its actual surface unevenness is unknown, so it must not be labelled a verified safe path or a negative example for every hazard.

These are development examples used while selecting the approach. Multiple frames of one clip are correlated. They are not independent trials or a held-out evaluation, and no task accuracy percentage is claimed.

## Labels and camera calibration

Original filenames and user labels are retained locally. IMG_1246, supplied as “upward,” visually looks down a staircase. IMG_1248, supplied as “downward,” visually faces up a staircase. The public sample names describe the visible view, rather than inferring direction of travel.

The three bottle distances remain user-reported horizontal floor distances of 60, 120 and 180 cm. Rear-camera height and a fixed pose were not established. No value is inferred from the user's body height. Metre estimates remain disabled. These recordings can still be used to check object recognition.

No verified hole examples were supplied. This update does not add hole detection, depth estimation or permission for unsupervised walking.

## Method

Frames are processed locally. The input is RGB, resized to 512 by 512, scaled by 1/255 and normalized with the publisher's mean [0.485, 0.456, 0.406] and standard deviation [0.229, 0.224, 0.225]. Output labels 53 (stairs) and 59 (stairway) are considered. A pixel is retained only when its winning label is a stair label and its softmax support is at least 0.5. A candidate must cover at least 5% of the fixed image-space corridor to request a warning. These are experimental thresholds. Pixel support is not a calibrated probability of a physical hazard.

The browser uses a worker and a single WASM thread. The model file is approximately 4.4 MB and is checked against a saved SHA-256 manifest. Initial use also downloads the approximately 12.4 MB runtime if it is not already cached. Camera frames are not uploaded by the application.

## Attribution and use

- Original model — https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512
- Quantized ONNX conversion — https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512
- Publisher code and license — https://github.com/NVlabs/SegFormer
- Full license included at `/licenses/SEGFORMER-LICENSE.txt`.

The SegFormer component is provided for non-commercial research and evaluation under its publisher's license. No additional training on the supplied videos was performed. The original YOLOX object-detection mode remains separate.


## Browser worker development-frame check

Twenty-four still frames were extracted, three from each supplied clip. With the released browser worker and thresholds, the view facing upstairs triggered on 3 of 3 frames. The view looking downstairs triggered on 0 of 3 frames, so all three were misses. The remaining 18 frames, from bottle, floor and marking clips, requested 0 stair alerts. This is a small development check with correlated frames, not an independent accuracy estimate.
