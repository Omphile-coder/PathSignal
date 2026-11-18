# PathSignal on Expo Go

Double-click **Start PathSignal Phone.cmd** in the Desktop PathSignal folder. Keep the terminal open. Put the phone and PC on the same Wi-Fi, then scan the Expo QR code with the iPhone Camera app or the scanner in Expo Go on Android. This project uses Expo SDK 58.

On iPhone, sign into the same Expo account in Expo Go and the Expo CLI. To sign in on the PC, open a terminal in this folder and run `npx.cmd expo login`.

Tap **Test audio** and **Start camera**. Grant permission, stand still and centre the black bottle on the tile. Tap **Scan now**. Move the bottle away and scan the same floor again. Each tap processes a photo locally and can play a spoken alert.

The phone build tests stationary snapshots. Continuous, low-latency camera-frame processing for a walking test requires a separate native development build. Verify the camera and sound on your phone.

[Expo Go setup and QR troubleshooting](https://docs.expo.dev/get-started/start-developing/)

## Object detection

**Object detection** uses the bundled pretrained YOLOX-S model through ONNX Runtime WebAssembly in an embedded processing view. Wait for **Object model ready · YOLOX-S** before scanning. The larger model makes the initial load slower. Once the app assets are loaded, inference runs on the phone. It passes no camera images to a server. **Black bottle baseline** selects the original tile detector.

The object detector can flag bottles, cups, bags, balls, skateboards, furniture, pets, people, and bicycles or motorcycles. Detections need a minimum score and must overlap an image-space walking corridor. In **Start repeated scans**, the app captures one image at a time and re-arms alerts for an object class after two scans without that class. Use this mode while stationary.

The model has no depth estimate. Its object labels do not cover curbs, steps, holes, raised slabs, or many overhead hazards. A detection box in the corridor is a visual cue only. Real-device performance and supervised field trials are pending. The TACO and Kaggle datasets reviewed earlier were not used for additional training.

[Model and implementation](https://github.com/Megvii-BaseDetection/YOLOX) · [Current update and restart instructions](../Object%20Detection%20Update.md)

## iPhone LiDAR development build

**Build PathSignal LiDAR.cmd** opens the Expo Build setup on this PC. A first build needs an Expo project, your iPhone registered for internal distribution, and Apple Developer signing. If the terminal asks you to register the iPhone, follow its registration link on the iPhone. Use your Apple account in the official prompt. After Expo Build finishes, open its installation link on the registered iPhone and enable Developer Mode if iOS requests it.

After installing, double-click **Start PathSignal LiDAR.cmd** on the PC. Keep both devices on the same network and open the project in the installed PathSignal development client. The LiDAR screen is available from the monitor with its camera stopped.

1. Select **LiDAR distance**, then **Start LiDAR preview**.
2. Stand still and aim at a broad, matte target, such as a wall or cardboard panel. Centre the target in the ring.
3. Tap **Read LiDAR distance**. Compare the reading to a tape measurement from the camera plane along the viewing direction. Start with approximately 0.5 m, 1 m and 2 m, with the phone facing the target squarely. Turn off Silent Mode if the speech is inaudible.
4. Try the black bottle after verifying a broad target. If the centre patch is split between the bottle and background or confidence is low, try repositioning the target.

The native module samples ARKit scene depth at the centre of the camera frame. It requires medium-or-high confidence across enough pixels and consistent measurements across three frames. It reports camera-axis depth in metres. This is a stationary reading tool, separate from obstacle alerts.

[Install a development build on a physical iPhone](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/) · [ARKit scene depth](https://developer.apple.com/documentation/arkit/ardepthdata)

### Checking the LiDAR corridor

The corridor feature changes the Swift module, so install a fresh iOS development build after updating. Open **LiDAR distance** and start the preview. Stand still, aim at a clear patch of level floor and choose **Set floor reference**. ARKit must find a horizontal surface and its depth must agree with the centre LiDAR reading. Aim forward from the same level and choose **Check corridor**. Tracking interruptions clear the reference.

The scanner projects depth pixels into ARKit world coordinates, then checks a corridor extending roughly 0.35–2.8 m in front of the phone and 0.45 m either side. It uses returns below the reference floor for a possible drop-off, returns from 9 cm to below 1.15 m above it for a possible raised surface or object, and returns 1.15–2.10 m above it for a possible upper-body obstruction. The app lists consistent candidates and speaks the nearest one. The result gives horizontal distance ahead of the phone. The **Read LiDAR distance** button still gives camera-axis depth at the centre.

These thresholds are starting values for a supervised indoor trial. The scanner requires stable depth evidence across three frames. A hole with no visible return, a thin slab, or a hazard outside the camera view can be missed. The upper band uses a fixed height range and gives no clearance measurement. A wall in that band may be flagged as an obstruction.

For the first supervised checks, record a level-floor scan, a raised foam block or box, a controlled lowered surface viewed from a stationary position, and a soft object at upper-body height. Keep people away from test hazards. Record the observed candidate, any false alert, and the tape-measured horizontal distance. The code and bundling checks can run on Windows. Swift compilation and physical LiDAR checks require the signed iPhone build.

### Save and replay a LiDAR trial

After a distance reading or corridor check, enter the tape measurement and an optional note. For a corridor check, you can also select the observed condition. Tap **Save trial** before starting the next scan. The app stores saved trials on the iPhone. An unsaved reading is replaced by the next scan.

Tap **Export saved trials** to share a JSON file through the iPhone share sheet. The file contains the readings, annotations you entered, and three sets of sampled 3D points per completed corridor check. It contains no camera photos or video. Share it only where you want the scene geometry and notes to be available.

On the PC, drag the exported JSON onto **Replay PathSignal LiDAR Trials.cmd**. The desktop replay applies the same corridor code, lists matches and misses against the observed condition, and reports absolute distance error where a matching candidate and a tape measurement are available. A scan with insufficient depth is recorded separately. If you want a saved report, run `node replay-lidar.cjs <file>` in the phone folder and redirect the output to a JSON file.

From the phone folder, `node check-lidar.cjs` runs the synthetic corridor checks. These checks exercise the classifier given 3D points. They do not check ARKit projection, physical distance accuracy, or whether the iPhone obtains enough depth returns.

### Repeated stationary checks

After setting the floor reference, tap **Repeat stationary checks** and keep the phone still. Tap **Stop repeated checks** to keep the last result available for saving. A candidate kind speaks again after two usable checks without that kind. Low depth coverage and tracking interruptions pause repeated checks. The phone needs a fresh signed development build for the native changes. Use **YOLOX comparison** to try the newer detector on the iPhone when the native module is present.


The preview shows an alert count and **Repeat last announcement**. If you stop repeated checks after an alert, the trial form keeps the latest alert-producing sample even if subsequent checks were quiet. If the session produced no alert, the form keeps the most recent completed sample. Depth coverage failures and tracking interruptions have their own spoken messages.
### Object detection processing update

The model runs independently of the React Native UI. Loading and inference have status messages and timeouts. Stop camera can cancel a pending scan. Rebuild the bundled detector after changes with `npm run build:detector`.

Desktop Chromium and WebKit checks recognized chairs in both supplied office images and a person in the first. WebKit also recognized the bottle in the saved sample and returned no hazard on the empty-floor sample and a blank image. These checks used the camera-preview crops and the same model, preprocessing and decoder as the app. The model is pretrained, with no additional training on these images. Physical iPhone performance remains to be confirmed.
