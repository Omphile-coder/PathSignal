# PathSignal review

## Try on this PC

- Double-click **Start PathSignal.cmd**, choose **LiDAR replay**, then **Open synthetic examples**. The replay shows usable frames, detected candidates, and the tape-measure error where available. It accepts a saved trial export from the iPhone and downloads a CSV.
- To see a replay from recorded depth data, open **depth-lab/evaluation/arkitscenes-lidar-replay.json** in the same screen. It contains two groups from one public ARKitScenes sequence. The groups have no verified hazard labels. They exercise the data path.
- Double-click **Start PathSignal Depth Lab.cmd** and select **Check sample bottle**. The YOLOX-S model draws a box around the bottle. The depth comparison remains available from the same screen.

## What the detector checks showed

YOLOX-S found the black bottle in all 8 sampled bottle frames and in none of the 7 empty-floor frames. At the same score threshold, COCO-SSD and YOLOX-Nano found none in either clip. These frames come from two clips. In a small TACO sample, YOLOX-S matched 11 of 36 annotated bottles and produced 2 unmatched predictions. The full sample results are in **depth-lab/evaluation**. This is an exploratory comparison, with no additional model training.

## What changed on the iPhone side

- The corridor check uses confidence-filtered LiDAR points, groups adjacent returns, and requires agreement across three frames.
- **Repeat stationary checks** announces a candidate once per encounter. Two usable checks without that category re-arm it. Poor depth coverage pauses repeated checks and speaks the reason.
- **Save trial** keeps the last reading on the iPhone. You can add a tape measurement and an observed condition. **Export saved trials** opens the iOS share sheet. The export contains depth points and notes, with no photos or video.
- The native **YOLOX comparison** mode uses the same model and decoding as the PC comparison. The Expo Go modes remain available.

## Physical checks

Use **Build PathSignal LiDAR.cmd** for a signed iPhone development build. Apple signing and installation remain separate from the simulator compilation. In the installed app, first compare centre depth against a tape measure, then try a stationary corridor scan with a floor reference. Record empty-path and single-hazard checks before considering any moving trial. The iPhone camera, sensor performance, audio and file sharing still need physical checks.

[YOLOX model](https://github.com/Megvii-BaseDetection/YOLOX/tree/main/demo/ONNXRuntime) · [TACO](https://github.com/pedropro/TACO) · [ARKitScenes](https://github.com/apple/ARKitScenes)

## Build status

The latest iOS simulator build completed successfully, including the direct ONNX Runtime binding. The first YOLOX build failed because the React Native wrapper referenced removed bridge APIs. It was replaced with a local Swift module using ONNX Runtime's Objective-C interface. The JavaScript bundle, 12 synthetic corridor checks, repeated-alert checks, and desktop replay checks passed.

The physical iPhone build stopped at signing. Expo found no signing credentials suitable for internal distribution. Run **Build PathSignal LiDAR.cmd** interactively to register the device and set up Apple signing.

[Successful simulator build](https://expo.dev/accounts/omphilebuilds/projects/pathsignal-phone/builds/5301ac3d-dae9-428e-a3c2-ffeb610a58fa)
