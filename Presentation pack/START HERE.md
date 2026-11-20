# PathSignal — Presentation release

Updated on 20 November 2026, version 3.

**Live public link**

https://pathsignal-six.vercel.app

Anyone with the link can visit. The PC does not need to keep an Expo or local server running for this website.

## Open and demonstrate

1. Open the link in Safari on the iPhone or Chrome on a laptop.
2. Choose Open demo.
3. Tap Test audio and confirm that sound plays.
4. Tap Load AI model. Wait for Ready. The first download is about 49 MB, so do this before presenting.
5. Tap Black bottle. The sample is processed by the real model.
6. Tap Empty floor. It should show No alert on this scan for this supplied sample.
7. Tap Start camera and grant permission. Stand still, aim at a chair and tap Scan now.
8. Try Start repeated scans if desired, then Stop.
9. Open the session log and export CSV or JSON. Logs contain no images and stay in this browser unless exported.

The website uses the same pretrained YOLOX-S checkpoint and preprocessing as the Expo application. The user has reported successful iPhone tests of the Expo application. The new browser release needs its own physical iPhone camera, sound and VoiceOver check. Desktop automation cannot confirm those.

## Files in this folder

- `PathSignal-source.zip` — reviewable browser source, model parts, licenses and development verification. Extract it, run `npm ci`, then `npm run build` and `npm run preview`.
- `pathsignal-qr.svg` — QR code for the live site, suitable for slides.
- `project-report.md` — project brief, method, evidence and limitations.
- `presentation-guide.md` — demonstration sequence and examiner questions.
- `evaluation-plan.md` — trial worksheet and scoring definitions.
- `technical-notes.md` — implementation details and credits.

Editable browser source is in `C:\Users\lucas\Desktop\PathSignal\presentation-site`. The existing phone app remains in `C:\Users\lucas\Desktop\PathSignal\phone`.

## Status

The presentation release is deployed. Browser checks passed for actual bottle and empty-floor inference in desktop Chromium and WebKit, image selection, speech requests, CSV export, log restoration and a 390-pixel layout. Chromium also passed an injected-stream camera lifecycle and encounter/re-arm test. Speech was stubbed for those automated checks, so the result verifies requests rather than audible sound.

This is a hosted research prototype. It does not measure distance or establish reliable detection of holes, steps, raised slabs or overhead clearance. It is not validated for unsupervised walking. No task-specific accuracy percentage has been measured.

Before academic submission, add your institution's required cover page, identity details, supervisor, formatting, declarations and actual evaluation results. The included brief is supporting material, not a fabricated completed study.

## Release record

- Hosted version — 3
- Source commit — 05b6c5c0fffb222ed24b3ac873e967e49519a479
- Public site project — appgprj_6afd8b73b14081918c3c77b7329f2992

Hosting publication was confirmed successful by the deployment service. No paid Apple Developer account is needed to open the website.

## Experimental stairs, version 2

Select **Stairs (experimental)**, then **Load AI model**. Try **Facing upstairs** for the recognised example and **Looking downstairs** for the known miss. Dark-marking and empty-floor samples are also available. Changing modes stops the camera and unloads the previous model. Choose **Everyday objects** and load its model to return to YOLOX-S.

The mode uses the existing supplied clips and requires no additional recording to try. Camera height remains unknown. No distance in metres is estimated. There is no hole detector or unsupervised-walking validation. The SegFormer component is licensed for non-commercial research and evaluation. Full development results and the known downward-view miss are documented in `stair-development-notes.md`.


## Colourful retro UI, version 3

The live browser UI uses the supplied retro pack as a visual reference. Editable theme styles are in presentation-site/src/retro.css. Object and stair inference behaviour is unchanged. The source ZIP includes the updated theme. The original reference files are kept locally in PathSignal/design-reference/retro-pack.

