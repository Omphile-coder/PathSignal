# PathSignal

Start with [Project Handoff.md](Project%20Handoff.md) for the current phone, LiDAR and desktop workflows.

PathSignal is an assessment prototype for one question. How consistently does a downward-facing phone camera warn before a foam block on a controlled indoor path?

## Open on this PC

Double-click **Start PathSignal.cmd**. Keep the terminal open while using the app. Close the terminal to stop the local server. From a terminal in this folder, you can also run `npm.cmd run dev` and open the localhost address Vite prints.

Select **Test audio**, then **Start replay**. Choose **Empty path** for a negative control and **Orange floor marking** to see a false alert. **Upload clip** plays a real recording you supply from this device. Choose **Live camera** and **Start camera** to try the actual camera if one is available. Use a sighted operator who can stop before the foam block.

## Run on a phone

Build with `npm.cmd run build` and serve the contents of `dist` from an HTTPS origin trusted by the phone. Open that address in the phone browser, grant camera permission, and check that the rear camera is active. Camera access works on localhost for desktop review. A phone opening the PC's plain HTTP LAN address can use replay but browsers generally restrict live camera access on that origin. See [MDN's camera API requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## How the detector works

A logistic regression model scores pixel colour from two normalized channel differences. The app limits detection to a trapezoid on the preview, groups adjacent matches, and requires a minimum group size. Three consecutive positive samples trigger one alert. Five consecutive misses re-arm detection. The app samples about ten times per second when the feed provides frames.

The baseline model uses labelled orange and neutral RGB examples. For a different contrasting foam colour or floor, use **Calibrate camera model** in a live session. Capture both labels with the centre guide filled, and vary the lighting and exposure. Calibration stays in memory for that page and live mode uses it immediately. Restart the camera to reset encounter tracking before scoring. Replays always use the baseline for repeatability.

This is a colour model. A flat orange marking can trigger it, and a foam block close in colour to the floor can be missed. The corridor is defined in screen coordinates. Keep the phone height, pitch and orientation consistent. Distance in the trial log is operator-measured. Local processing uses no account, API key, LLM, or frame upload.

Alerts use bundled spoken recordings with browser speech synthesis as a fallback. Start and Repeat are user-triggered controls. Check the audio on the actual phone before moving. Camera denial, disconnected tracks, and a stalled feed pause the session and request a spoken pause message. The event timestamp is when the detector requested the alert. Measure from audible onset if evaluating end-to-end warning distance.

## Assessment procedure

1. Pick a minimum warning distance before scoring and mark it from the foam block. The app starts with an editable 1 m example. Choose the distance for your test setup.
2. Use a consistent starting point, camera mount or grip, angle and walking pace. Capture a short block-present clip and a short empty-path clip for comparison. Keep tuning clips separate from scored trials.
3. Start a live trial in **Trial lab**. Use a sighted operator and a separate observer if available. Approach the foam block and stop with room to spare. At the floor mark, have the observer click **Log distance mark**. If you stop before the mark on hearing the alert, enter the measured distance instead.
4. Finish the trial with a lighting and position note. An alert before the mark scores **Before mark**. An alert at or after the mark scores **Late**. A block trial with a logged mark and no alert scores **Missed**. An empty-path alert scores **False alert**. Save interrupted sessions as **Incomplete**.
5. Repeat with the block centred, offset, and under different lighting. Include empty-path trials at the same pace and camera angle. Export both CSVs and report counts, distances where measured, and at least one failure with its conditions. Keep synthetic replays separate from physical trial counts.

Use existing mobility tools. Silence carries no information about path conditions.

## Reference notes

- Lazarillo's spoken environmental cues informed the short alert wording. [Lazarillo app](https://lazarillo.app/theapp/)
- WeWALK's guidance on audible controls and obstacle-detection settings informed the audio check and explicit monitor status. [WeWALK support](https://wewalk.io/en/support-articles/)
- Clew3D relates detected landmarks to a recorded trajectory and converts them into concise orientation instructions. PathSignal uses that idea at a smaller scale by looking for an obstacle within the camera's walking corridor. A later version could attach an operator-confirmed hazard note to a route checkpoint. [Clew3D research paper](https://dragan.ahmetovic.it/pdf/harriman2021clew3d.pdf)

## Seven-day assessment

| Days | Work |
| --- | --- |
| 1–2 | Set up the phone, measure the path and capture labelled clips. Check audio and screen-reader controls. |
| 3–4 | Tune on the setup clips, then freeze calibration and select the repeatable recorded demo. |
| 5–6 | Run physical block-present and empty trials. Check lighting, offset, camera interruption and a same-colour distractor. |
| 7 | Export and report results. Rehearse the supervised block and empty-path demonstration. |

The four bundled MP4 clips were generated from `src/replay.ts`. They are synthetic test fixtures. The phone, physical foam block, measured warning distance, and screen-reader behaviour still need hands-on testing. Saved route reminders are deferred until after physical trials.

## Verification on this PC

| Check | Result |
| --- | --- |
| Production build | TypeScript and Vite passed. |
| Synthetic foam block in corridor | One alert at about 1.30 s into the clip. |
| Synthetic empty path | Zero alerts. |
| Synthetic foam block outside corridor | Zero alerts. |
| Synthetic orange floor marking | One false alert at about 1.71 s into the clip. |
| Desktop webcam | Chrome opened the real HP webcam, received frames, and released the camera on Stop. |
| Camera denial | An injected permission denial produced the Paused status and started the pause recording. |
| Live trial workflow | With an injected video stream, Chrome detected the block, saved a trial as Before mark, and restored it after reload. |
| Audio and export | Chrome started the test and obstacle recordings, replayed the last message on request, and downloaded the alert CSV. |
| Mobile layout | Checked in Chrome at 390 CSS pixels with no page-level horizontal overflow. |

The replay timings refer to when the detector requested an alert in one browser run. They are not warning distances or physical trial results.

## Black bottle on light tile

To replay the two phone clips, use **Upload clip** and select either MP4 from **Sample clips**. Choose **Black bottle on light tile** under **Detector profile**, then select **Start replay**. The same profile is available in **Live camera**. The built-in simulations use the orange foam profile. The phone clips were converted to silent H.264 MP4s for browser playback and are outside the public build.

The bottle profile uses logistic regression on the brightness of a 3×3 pixel patch relative to the centre of the frame. It was trained with labelled patches from the bottle, bare tile and grout at 0.5 seconds in the supplied clips. Its purpose is to flag a dark patch of sufficient size in the corridor. A dark shadow or other dark object can also trigger it.

Chrome logged one alert at 0.31 seconds in the bottle replay and zero alerts in the empty-floor replay. Both clips contributed training examples. The bottle was already visible when the clip started, so the replay result measures alert timing within that clip. Testing generalization or warning distance requires fresh footage and a measured setup.
