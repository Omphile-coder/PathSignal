# PathSignal — Technical notes and credits

## Experimental stair extension

`src/stairVision.ts` implements RGB preprocessing and pixel-wise decoding. `src/stairs.worker.ts` runs the quantized SegFormer-B0 model. `source-model/stairs.onnx` and its SHA-256 manifest are the tracked model source. Mode changes unload the previous model and stop camera capture. Exports now identify the model and mode per scan. No distance estimate is generated. Read `/stair-development-notes.md` and `/licenses/SEGFORMER-LICENSE.txt` for the known downward-view miss and the component's research/evaluation license.


## Project layout

- `src/App.tsx` — responsive presentation and camera controls.
- `src/useMonitor.ts` — media lifecycle, speech, encounter gating and local scan logs.
- `src/useDetector.ts` — worker initialization, request tracking, timeouts and cancellation.
- `src/detector.worker.ts` — model loading, SHA-256 validation, inference and result filtering.
- `src/yoloxDecode.ts` — shared Expo preprocessing and decoding implementation.
- `src/path.ts` — image-space corridor filter, corresponding to the phone implementation.
- `source-model/` — pretrained model split into two parts and SHA-256 manifest.
- `scripts/prepare-model.mjs` — checks model parts and prepares static model/runtime assets.
- `.openai/hosting.json` — site identity and static deployment configuration.

## Run locally

Install Node.js, then run `npm ci`, `npm run build` and `npm run preview`. Use the printed localhost address on that PC. A phone needs a trusted HTTPS site for camera access. The published site provides HTTPS.

## Deployment

The application is a static site. It has no API keys, user accounts, model server, image-upload endpoint or database. Model and runtime assets are served from the same origin. Model loading uses one worker and one WASM thread. Large model weights are split into files below 25 MB for hosting compatibility. Browser speech is requested through the Web Speech API.

The browser shell includes a web manifest for home-screen shortcuts. This release has no service worker or guaranteed offline mode. Do not rely on browser caching for a disconnected presentation. Network access is needed for the first load.

No analytics SDK is included. The font stylesheet is requested from Google Fonts and can fall back to system fonts. Ordinary hosting requests can be logged by infrastructure. Camera and chosen-image pixels are processed locally by application code and are not uploaded.

## Selected classes

Person, bicycle, motorcycle, cat, dog, backpack, umbrella, handbag, suitcase, sports ball, skateboard, bottle, cup, bowl, chair, couch, potted plant, bed and dining table. Other COCO labels are excluded by the task-specific decoder. Detection quality varies across classes and conditions.

## Licensing and attribution

- YOLOX, Megvii-BaseDetection, Apache License 2.0. Publisher source and model information at https://github.com/Megvii-BaseDetection/YOLOX. The included model weights are the same checkpoint used in the local phone project. The publisher license is retained in `source-model/YOLOX-LICENSE.txt` and provided at `/licenses/YOLOX-LICENSE.txt`.
- ONNX Runtime Web, Microsoft, MIT License. https://github.com/microsoft/onnxruntime and https://onnxruntime.ai/docs/tutorials/web/. License provided at `/licenses/ONNX-RUNTIME-LICENSE.txt`.
- React and React DOM, Meta and contributors, MIT License. https://github.com/facebook/react. License provided at `/licenses/REACT-LICENSE.txt`.
- Browser samples are the user's supplied floor and black-bottle images. They are development examples and are not an independent test set.
- Illustration and icons are project vector artwork. The hero diagram is labelled as an illustration.

## Research status

The Expo application was tested by the user on their iPhone and reported to detect chairs and people, with no alert on the tested empty floor. The browser release needs its own physical-device confirmation. Model reuse does not establish identical browser performance. See the project brief and evaluation worksheet for the boundaries of present claims.
