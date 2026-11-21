# Roboflow model comparison: access preparation

## Completed local evaluation

All three artifacts have now downloaded and run on the 24 development frames. See `evaluation/RESULTS.md` and `evaluation/comparison.json`. The one-class YOLOv8 stair model detected stair regions in all six stair frames and none in the other 18 frames at the fixed 0.40 threshold. These are correlated development examples, not independent accuracy results. The direction model missed the six stair frames. The broad outdoor model's actual version contains five Spanish accessibility labels, not the project overview's broad taxonomy. The phone and live app have not been changed by this evaluation.

The following access/download sections are retained as setup history and instructions for reproducing missing artifacts.

Current state: the three model artifact metadata endpoints returned HTTP 401 without a key. No model weights have been obtained and no model inference has run. The public app and current model are unchanged.

Update: the user's authenticated rerun returned HTTP 200 for all three models, recorded in `access-results.json`. Credentials were not retained. A separate downloader is now ready; actual weights are not present yet.

## Download the models after the successful access check

1. Close the access-check terminal.
2. In the main PathSignal folder, double-click `Download Roboflow Models.cmd`.
3. Enter the same private key at its hidden prompt and keep the window open until all three attempts finish.
4. Tell the assistant when it finishes. The downloader saves weights, sanitised preprocessing metadata, available class names, SHA-256 hashes and CPU session inspection under `model-comparison/artifacts`; its summary is `download-results.json`.

The API key and signed URLs are not saved. The downloader sends no test images, buys no credits and does not alter the app. Each model download is capped at 256 MB. Five mocked regression checks pass for request shape, safe error reporting, key redaction, artifact transport without API credentials, metadata sanitising and partial-file cleanup. Opening the existing YOLOX model verifies the local inspection helper, not the new models. New model inference and mobile compatibility remain unverified.

After successful downloads, artifact inspection and local frame comparisons can proceed without asking for the key again unless a required artifact is missing or a new authorised request is needed.

## One-time account setup

1. Visit https://app.roboflow.com and create a free account. Complete account verification/workspace setup if requested. No card or paid upgrade is needed for this access check.
2. Open https://app.roboflow.com/settings/api in that workspace. Copy a private API key (or generate one if none exists). Treat it as a password.
3. In `C:\Users\lucas\Desktop\PathSignal`, double-click `Check Roboflow Model Access.cmd`.
4. Paste the key into the terminal's hidden prompt and press Enter. You will not see the pasted characters. The tool sends authentication only to Roboflow and does not save the key, log API response bodies, upload images or buy credits.
5. Tell the assistant the check finished. It can read `model-comparison/access-results.json`; do not send the key in chat.

The access checker is not the model comparison itself. A successful metadata request does not prove compatible downloadable weights exist. Once access is established, supported artifacts, preprocessing, class mapping and runtime must be inspected before inference and app integration.

## Prepared comparison

`development-manifest.json` inventories 24 existing frames from eight clip groups with SHA-256 hashes and previous SegFormer alert results. Historical stair filenames were opposite to the observed stair direction, so original names remain and the observed direction is recorded separately. Frames from a clip are correlated development examples, not independent trials. No measured camera height or distance is assumed. Dark markings are not treated as verified holes.

Compare stair presence and direction first, then inspect false stair detections in non-stair clips. Keep generic compound `stairs-holes-curbs` predictions distinct from specific hole or direction claims. Do not automatically switch the published detector based on a few positive examples.

The current environment has Python 3.14, ONNX Runtime and Pillow but no Roboflow Inference package. Heavy runtime installation is deferred until model access and supported formats are known. No paywall workaround or browser credentials are used.

Official references: https://docs.roboflow.com/deployment/self-hosted/self-hosted and https://docs.roboflow.com/reference/authentication/authentication/find-your-roboflow-api-key .
