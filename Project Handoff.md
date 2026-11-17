# PathSignal development handoff

PathSignal is an iPhone-first assistive prototype. Its current build covers camera object detection, LiDAR distance readings, stationary hazard monitoring, spoken alerts, a local trial journal, and desktop replay. The safety and performance of moving or independent navigation still need evidence.

## Install the phone build

1. On the PC, open **Desktop → PathSignal → Build PathSignal LiDAR.cmd**.
2. Complete Apple signing and iPhone registration when Expo prompts. Open the installation link on the registered iPhone.
3. Run **Start PathSignal LiDAR.cmd** on the PC. Open the project in the installed PathSignal development client.

## Use the phone features

- **Object detection** opens the original multi-object detector. **YOLOX comparison** selects the newer model in the iOS development build. Both run on the phone. The **Black bottle baseline** remains available for the original tile setup.
- **LiDAR distance** reads the centre of the camera frame and speaks camera-axis depth. Aim at a broad surface and hold still.
- **Set floor reference**, then **Check corridor**, to scan for raised objects and surfaces, visible drop-offs, and upper-body obstructions. For repeated checks, keep the phone stationary. Each candidate supplies an estimated horizontal distance ahead. The screen and speech report insufficient coverage when the scan cannot be scored.
- **Save trial** stores the depth result and optional tape measurement and notes. **Export saved trials** shares a replay file. When repeated checks produce an alert, the form keeps the most recent alert-producing scan for review.

## Review on Windows

Open **Start PathSignal.cmd**, choose **LiDAR replay**, then load a trial export or open the synthetic examples. The replay shows return locations, matching candidates and distance errors where a measurement is available. It can export CSV.

Open **Start PathSignal Depth Lab.cmd** to compare still images and run the desktop object detector. The replay of the supplied clips produced 8 bottle detections in 8 sampled bottle frames and zero in 7 empty-floor frames with YOLOX-S. These are samples from two clips. The TACO comparison was limited to a small sample and still showed many missed bottles. See **depth-lab/README.md** for counts and methods.

## What remains for validation

The build is intended for stationary, supervised trials. A drop-off requires visible LiDAR returns below the floor reference. Holes without returns and hazards outside the camera view may be missed. Test LiDAR, spoken alerts, object inference and export on the signed iPhone build when ready. The phone README has the trial procedure.

## Build verification

The Windows production bundle and Chrome replay checks passed, including trial import, frame display, CSV export and the public ARKitScenes sample. The phone TypeScript check, 13 synthetic corridor checks and repeated-alert checks passed. The current iOS simulator build compiled successfully.

Expo could not start the physical-device build in unattended mode because internal-distribution signing credentials are missing. The interactive launcher above is the remaining installation step.

[Current iOS simulator build](https://expo.dev/accounts/omphilebuilds/projects/pathsignal-phone/builds/501fa462-ef89-432c-90fa-76f4582344c7)

## Windows and iPhone without Apple Developer membership

For camera-based spoken alerts on your iPhone, run **Start PathSignal Phone.cmd** and open the project in Expo Go as before. Use **Black bottle baseline** for the original bottle and tile setup or **Object detection** for the COCO model.

For actual LiDAR data, install the free [Stray Scanner app](https://apps.apple.com/za/app/stray-scanner/id1557051662). Hold the phone stationary at a measured height, point it ahead at the test scene and record 5–10 seconds. Open the recording in Stray Scanner and tap **Share**. Transfer the ZIP to Windows, extract it, and drag the folder containing **odometry.csv**, **rgb.mp4**, **depth**, and **confidence** onto **Import Stray Scanner Recording.cmd**.

Enter the measured height of the rear camera above the floor. The converter writes a replay JSON in the recording folder. Open **Start PathSignal.cmd → LiDAR replay** and select that JSON. The replay analyses sampled LiDAR points after capture. It leaves the observed condition unlabelled and infers the floor reference from the height you entered. Use a level floor at the start and keep the camera steady. The conversion and replay path passed a synthetic format check. A capture from the physical iPhone remains to be checked.

This workflow uses Expo Go for live camera alerts and Windows for reviewing recorded LiDAR. Expo Go cannot load the custom native LiDAR module.

[Stray Scanner recording format](https://github.com/strayrobots/scanner/blob/main/docs/format.md)
