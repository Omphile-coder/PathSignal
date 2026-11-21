# Electronics integration and banana-peel access

The phone and web decoder now enable 25 labels, adding TV, laptop, mouse, remote, keyboard and cell phone. The phone path allowlist was updated too. Weights are unchanged. The historical audit report's 19-label count describes the baseline before this change.

Checks completed: both TypeScript builds; rebuilt phone embedded model HTML; Expo iOS export; 25 synthetic class outputs through both decoders and path filters, with off-corridor/high-image/low-confidence rejection; Chromium and WebKit bottle/empty-floor flows. Chromium also checks repeat-alert suppression/re-arm, repeated scans, stop and permission denial. Desktop automation observes speech requests, not audible phone speech.

Actual image diagnostic: of four selected 150-pixel e-waste previews, the keyboard was recognised; TV was labelled bowl, mouse was labelled bottle, and the phone was missed. Laptop and remote were not covered. This is a diagnostic, not a measured class-accuracy result. See `presentation-site/verification/electronics-images.json` and `object-classes.json` in the project.

## Banana-peel export: user action needed

The normal Roboflow export endpoint returned HTTP 401: “This method requires your API key.” The response is saved in `metadata/peel-export-response.json`. No annotated export or trained peel model has been obtained. Browser automation was unavailable during this attempt.

1. Open https://universe.roboflow.com/gustas/banana-peel-c1fyr on your PC.
2. Open a dataset version and choose its download/export option. Sign into a free Roboflow account if requested.
3. Select a YOLO object-detection export (such as YOLOv8) and download the ZIP if available without payment. Retain its README and licence. Do not select a hosted inference API as a substitute for the annotated dataset.
4. Save the ZIP in `C:\Users\lucas\Desktop\PathSignal\datasets` and tell the assistant its filename. Do not paste your API key or password into chat. If download requires payment, report that instead of paying.

The exact download UI and original-version availability could not be verified here. The related fork listed in `REPORT.md` is a fallback from the same unverified provenance chain, not an independent dataset to merge blindly.

Next after receiving the ZIP: inspect images/labels and licence, normalise annotations, group related source images before splitting, prepare training, then evaluate the exported model before replacing the baseline. Banana peel is not interchangeable with the COCO banana label.
