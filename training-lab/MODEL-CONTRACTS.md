# Experimental model interface contracts

These are lab artifacts, not drop-in replacements for the currently shipped stair worker. Do not overwrite the existing model chunks or manifests without implementing and checking the matching decoder.

## Direction classifier

- File: `runs/direction/direction.onnx`.
- Input `images`: float32 `[1,3,224,224]`, RGB in `[0,1]`. Resize the entire oriented frame with bilinear interpolation to 224x224. This experiment stretches the frame; it does not use the pretrained model's default centre-crop transform.
- ImageNet mean/std normalisation is embedded in the graph. Do not apply it twice.
- Output `logits`: float32 `[1,2]`, class order `stairs_down`, `stairs_up`. Apply a numerically stable softmax before reading confidence.
- Intended pipeline: only consider direction after a separate positive stair detection. A classifier always chooses between its known classes and cannot establish that stairs exist.
- The fixed experiment confidence cutoff is 0.8. Wrong held-out predictions exceed that cutoff, so it does not make this candidate reliable. The measured result rejects the current candidate for integration.

## Pothole detector

- Export is saved alongside the best training checkpoint; see `runs/pothole-training-summary.json` for the exact path.
- Input `images`: float32 `[1,3,320,320]`, RGB in `[0,1]`. Preserve aspect ratio with Ultralytics LetterBox padding to a fixed square (padding value 114); do not stretch the input as the existing generic stairs worker does.
- Expected YOLOv8 raw output: float32 `[1,5,2100]`, four centre/size coordinates plus one pothole score. Verify the actual exported shape before integration. This is a one-class detection graph, not a segmentation-mask graph.
- Reverse padding and resize before mapping boxes to the displayed camera image. Filter at confidence 0.4, use NMS IoU 0.3, and treat image-corridor filtering separately from recognition.
- This model is trained on road potholes. Its name or class ID must not imply recognition of every hole, missing paving block or drop-off. The local-domain results determine whether it even merits an experimental app mode.

## Targeted second-round detection models

- `stairs-v1`: classes in order `downstairs`, `upstairs`; expected raw output `[1,6,3549]`.
- `missing-tile-v2`: class `missing_tile`; expected raw output `[1,5,3549]`.
- Both use RGB float32 `[1,3,416,416]` in `[0,1]`, fixed square letterbox padding 114. Resize with bilinear interpolation, restore coordinates by undoing padding and scale. Actual export shapes must be verified.
- Class-aware NMS IoU 0.3, detection score 0.4. Stair direction additionally requires score >= 0.6 and a margin >= 0.15 above a competing opposite-direction box in the corridor. Otherwise the intended message is generic stairs, not a guessed direction.
- `targetedDetector.ts` implements this separate interface. Its existence does not change the live web or phone app. `check_targeted_decoder.mjs` checks geometry and decoder behavior; `verify_targeted_onnx.py` prepares real-model CPU/browser parity fixtures after training and evaluation.
- A fixed image-space corridor is an experimental display heuristic. It does not establish the walking route, camera pose or metric warning distance.

## Integration checks still required for any accepted future candidate

1. Verify RGB conversion, orientation, resizing, class order, score handling, NMS and overlay coordinates on saved samples.
2. Run the exported graph in the actual browser/WASM and Expo processing view. CPU ONNX Runtime success is a different runtime check.
3. Measure camera-to-audible-alert delay on the physical phone. Include model errors, unavailable camera, repeated scans, stop/cancel and stale-result handling.
4. Keep an unknown/generic stair warning when direction cannot be established. Do not announce path clearance from an empty detection result.
5. Retain existing object mode and separate model loading, status, provenance and encounter suppression for added hazard modes.

These notes document future implementation requirements; no application changes were made in this lab task.
