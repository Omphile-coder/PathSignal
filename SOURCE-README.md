# PathSignal source release

The browser and Expo application source in this archive is provided under AGPL-3.0-or-later. Full terms are in `presentation-site/LICENSE` and `phone/LICENSE`. Third-party components retain their licences. The stair model's metadata declares AGPL-3.0 and Ultralytics v8.2.0; upstream architecture/training/export source is https://github.com/ultralytics/ultralytics/tree/v8.2.0 . Model publisher: https://universe.roboflow.com/mawarshazleen/obstacle-detection-n3eec . PathSignal did not retrain the publisher checkpoint.

This archive contains the current browser and Expo app code, custom native module source, dependency lockfiles, build scripts, bundled audio, public demonstration images, object model parts and the stair model. It excludes secrets, caches, generated bundles, dependencies and private videos. It is the source for this integration release; historical lab and dataset-research files outside the shipped applications are not part of the release.

## Build the browser application

Use Node.js (the release was built with Node 24 locally). In `presentation-site`, run `npm ci`, `npm run build`, then `npm run preview`. Models are prepared from `source-model` with SHA-256 checks. `public/source/pathsignal-source.zip` is the downloadable source offer and need not be regenerated to build the app.

## Build the Expo application

First run `node source-setup.mjs` from the archive root. This reconstructs the phone model files from the included browser source-model files. In `phone`, run `npm ci`, `npm run build:detector`, `npm run check`, then `npm start -- --clear`. Use Expo Go SDK 58 on the same Wi-Fi. Select Stairs (experimental) while the camera is stopped, start the camera, wait for Model ready, and scan while stationary. An iOS native LiDAR build separately requires Apple signing and is not provided through Expo Go.

The stair recording was generated locally using Windows System.Speech speaking “Possible stairs ahead.” Camera photos and inference run locally. No Roboflow API key is needed after these model files are obtained.

## Verification and limits

Browser verification scripts are under `presentation-site/scripts`. Some development-frame checks require the original user's videos/frames and are intentionally not bundled as private footage. Saved public samples can exercise the app through `scripts/check-stairs.mjs` and the everyday-object acceptance script. The custom decoder handles only the included one-class YOLOv8 output and exact preprocessing; unsupported shapes stop with an error.

The six positive development frames come from two existing clips and are not independent trials. Physical iPhone performance and audio remain to be checked. No reliable direction, hole, distance or independent-walking claim is made.
