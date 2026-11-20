# Object detection update

The Expo Go **Object detection** mode now uses the pretrained YOLOX-S model. It runs in an embedded processing view through ONNX Runtime WebAssembly, independently of React Native's UI thread. The model and runtime are bundled. No camera frame is sent to a server.

## Open on iPhone

1. Stop the existing Expo server with Ctrl+C.
2. In PowerShell, run **cd C:\Users\lucas\Desktop\PathSignal\phone**.
3. Run **npx expo start --go --clear**.
4. Close and reopen Expo Go on the iPhone, then scan the new QR code.
5. Select **Object detection** and **Start camera**.
6. Wait for **Object model ready · YOLOX-S**. The first load is larger and can take longer.
7. Tap **Scan now**. A completed scan shows the recognized classes and scan duration. If a recognized object is outside the image-space corridor, it is listed without an alert.

The recognition score threshold is 0.25, following the PC YOLOX comparison. A score threshold trades missed detections against false detections. This model has no distance or height estimate. It does not identify steps, holes or raised paving as dedicated classes.

## Verification

The two supplied office screenshots were cropped to their camera previews, resized to the app's image size, and processed with the same WebAssembly model, preprocessing and decoder. Both desktop Chromium and WebKit recognized chairs in both images and a person in the first image. The earlier lightweight COCO-SSD model missed the chairs. A blank image produced no alert.

These are desktop browser checks on supplied images. Physical iPhone performance and live camera recognition remain to be confirmed. No training or fine-tuning used those images. The model is the publisher's COCO pretrained YOLOX-S checkpoint.

[YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) · [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)

The WebKit check also recognized the bottle in depth-lab/sample-target.jpg and returned no hazard on depth-lab/sample-reference.jpg. TypeScript checking and an iOS Expo export passed. These few images do not establish recognition accuracy.
