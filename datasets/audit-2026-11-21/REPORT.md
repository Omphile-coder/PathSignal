# PathSignal: 09:00–11:00 dataset audit

Audit date: 21 November 2026. This is the deliverable for the scheduled work block, not a claim that two hours elapsed or that model training is complete.

## Decision

Keep the working detector as the baseline. First expose and assess useful electronics classes already present in its COCO checkpoint. Prepare a separate, narrowly scoped banana-peel training experiment once an annotated export is obtained. ROD is a conditional stair/urban-obstacle source, requiring split repair, format normalisation and source-permission review. The downloaded electronics collection is not suitable as a ready-made detection training set. The cable collection remains a research candidate.

No weights were trained or changed during this audit. Downloaded datasets are not automatically part of the application. The app currently enables 19 object classes in its pretrained YOLOX-S decoder; banana peels and loose cables are not among them. Existing downstairs misses, uncalibrated distance, holes and independent walking remain unresolved.

## Findings from actual files

| Source | What was inspected locally | Finding | Readiness |
|---|---|---|---|
| [ROD on Kaggle](https://www.kaggle.com/datasets/abtinzandi/obstacle-detection-dataset), [publisher mirror](https://huggingface.co/datasets/Abtinzandi/Obstacle-Detection-Dataset-YOLO) | Complete image manifest, rename map, class counts and YAML; 12 image/label pairs covering stairs, manholes, electrical boxes and chairs across all three splits | Manifest: 24,326 images, 40,195 objects, 25 classes. Train 19,186 / validation 3,511 / test 1,629. 536 possible source families, containing 3,017 images, span splits. Three sampled label rows are polygons rather than five-field boxes. | Conditional; not training-ready as supplied for our pipeline |
| [Kaggle e-waste](https://www.kaggle.com/datasets/akshat103/e-waste-image-dataset) | Full 12,412,492-byte ZIP; all 3,000 images decoded and hashed; ten class previews visually inspected | All images 150×150; train 2,400 / val 300 / test 300. No annotation or other non-image files. Seven groups of identical decoded images span splits. Classification labels come from folders, not bounding boxes. | Reject as a ready-to-train object detector dataset |
| [Banana peel by Gustas](https://universe.roboflow.com/gustas/banana-peel-c1fyr), [related fork](https://universe.roboflow.com/object-detection-38j6n/banana-peel-c1fyr-ghpdh/dataset/1) | Public indexed project/version information only | Original lists one banana-peel class, 1,262 images and CC BY 4.0. The related fork lists a 1,240-image version. Full pages/export could not be obtained through the research fetches in this audit. | Export access and actual labels still unverified; not downloaded or trained |
| [Cable segmentation research](https://github.com/pablomalvido/cables_segmentation) | Complete repository tree at recorded commit; three real image/mask pairs downloaded and visually inspected | 100 real images and 100 matching mask paths. Samples are 512×512, with cables against workbenches or patterned backgrounds. JPEG masks have compression greys rather than strictly two values. No licence-named file found in the tree. | Research candidate; resolve permission and floor-view relevance |
| [TACO](https://github.com/pedropro/TACO) | Existing complete official annotation JSON, not all image bytes | 1,500 referenced images, 4,784 annotations. Food waste: eight annotations in seven images; rope/strings: 29 in 28. No dedicated banana-peel category. Seven boxes fail the audit's positive-size/in-image-boundary check and need inspection. | Useful litter inventory; not enough evidence for a peel detector |

### Interpretation and limitations

- ROD overlap detection removes the final `.rf.<hex>` suffix from original filenames. It flags possible common source images, not proven exact duplicates. No byte-identical pairs were found among the 12 downloaded samples. Visual review nevertheless shows closely related chair and electrical-box views across splits. The full image corpus has not been hashed, and different filenames can conceal further related examples.
- ROD samples include both a view down a staircase and views facing upstairs. A general `Stairs` box does not encode direction, a drop edge, distance, or sufficient warning time. Sampled `Manhole` images show covers; they are not labels for open holes.
- E-waste previews mostly show isolated objects/product-style or tabletop views. Their folder names alone do not teach where an object is in a walking path. Exact duplicate checks do not exclude further near duplicates.
- Cable masks could be thresholded for a segmentation experiment after permission is resolved. Neither mask conversion nor a cable bounding box establishes whether the cable is underfoot.
- Dataset-fork independence is unverified. Do not merge the peel original and forks as independent data. Publisher model scores are not PathSignal measurements.
- The user's existing clips and the prior TACO 32-image check are development data. They must not be reported as a fresh independent test set.

## Licences and attribution

ROD's card says MIT, but its README explicitly preserves underlying source licences. The [paper's source table](https://arxiv.org/html/2611.00681v1#S6) lists mixed terms and one source with no stated licence. Preserve original attribution and identify/exclude unlicensed source images before releasing a training corpus. A rename map alone does not fully resolve source ownership. The card describes 26 integrated collections while the paper describes 29; record this discrepancy rather than assuming a single provenance count.

E-waste's card says Apache 2.0 but describes a mixture of open, repository and proprietary source images without per-image provenance. Its licence metadata does not resolve those gaps. Banana-peel project pages list CC BY 4.0; actual export attribution and image provenance still need checking. No cable repository licence was located; public download access is not a permission grant. TACO's toolkit licence should not be substituted for each source image's licence; the annotation audit retains its licence records.

## Frozen priorities for the next build stage

1. **Preserve the working baseline:** current 19 labels, camera failure announcements, once-per-encounter alerts and scan logs.
2. **Electronics already in the checkpoint:** television, laptop, mouse, remote, keyboard and cell phone. Update both phone and web mappings consistently, then check whether each newly enabled label produces useful warnings in the configured path region. This is decoder configuration, not training. Do not claim every electronic item is supported.
3. **Banana peel:** obtain one annotated export from the selected provenance chain; inspect class mapping, floor-view coverage, tiny boxes and related images; prepare a narrow experiment with independent evaluation groups. A banana category is not a peel category.
4. **Stairs:** assess a separate ROD stair experiment only after normalising labels, repairing source-family splits and resolving provenance. Keep the known downstairs failure visible until independently improved.
5. **Loose cable:** hold the inspected research collection pending permission and suitable floor-view examples. Do not spend the deadline or disk space on a huge unrelated cable corpus.
6. **Open holes, raised slabs, metric distance and overhead clearance:** no audited, installed capability is established here. These require additional data or calibrated/native sensing and their own evaluation. Recognition alone cannot establish safe independent travel.

## Steps for the next stage

1. Implement the supported electronics mappings and run decoder/build checks for phone and web.
2. Obtain the banana-peel annotated export. If the normal download page requires sign-in, the user can sign in personally; never paste passwords or API keys into chat. Select YOLO detection or COCO detection export, retain the supplied licence, and save the ZIP in the project's `datasets` folder. No payment is authorised or required by this audit.
3. Validate and normalise annotations, retaining originals. Quarantine invalid/ambiguous items; inspect a contact sheet with boxes.
4. Use source groups, original images and video sessions to split before augmentation. Deduplicate before splitting. Do not use images from the user's development clips for final held-out results.
5. Train only after a usable corpus exists. This PC has Intel Iris Xe graphics and no NVIDIA GPU. A free hosted GPU session is a possibility, with availability and account access still unverified; no Sunday completion promise depends on it.
6. Compare any new checkpoint with the current baseline, export and test the actual mobile/browser artifact before replacing it. Keep the baseline available if the new model regresses.

See `priority-classes.json` and `split-policy.json` for machine-readable scope. Audit scripts and raw metadata are retained beside this report. Contact sheets are local review material, not public website assets.

## Reproduce

Run `audit_data.py` with the project's `depth-lab/.venv/Scripts/python.exe`. It reads the downloaded e-waste archive, ROD metadata, cable tree and existing TACO annotations, and downloads only the bounded ROD/cable samples if missing. It does not execute code from any dataset. The script records hashes and errors in individual audit JSON files. Full ROD image download, full label validation, near-duplicate search and peel export validation remain outstanding.
