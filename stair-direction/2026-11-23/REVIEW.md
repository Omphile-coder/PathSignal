# Stair-direction clip review

Reviewed 23 November 2026. Five chronological frames were extracted per clip at 10%, 30%, 50%, 70% and 90% of its duration. This is a sampled visual review, not continuous playback or a detector evaluation.

## Corrected direction labels

Direction describes the stairs ahead from the camera's viewpoint, not the camera's tilt or the name supplied with the upload.

| Supplied clip label | Original video | Duration | Observed view | Usable sampled frames |
|---|---|---:|---|---:|
| A-up | IMG_1286.mov | 11.04 s | Looking downstairs: stairs_down | 5 |
| A-down | IMG_1289.mov | 10.74 s | Facing upstairs: stairs_up | 5 |
| B-up | IMG_1287.mov | 10.51 s | Looking downstairs: stairs_down | 5 |
| B-down | IMG_1288.mov | 10.71 s | Facing upstairs: stairs_up | 5 |

All sampled frames show recognisable steps, rails and surrounding landings. There is little viewpoint change within each clip. Bright windows are present, but stair edges remain visible in the sampled images. These clips do not need to be discarded because their upload labels were reversed.

## Files prepared

- `frames/`: extracted review frames under the original clip labels, plus FFmpeg metadata.
- `*-contact-sheet.jpg`: five chronological frames per source clip. Headings preserve original user labels, not corrected direction.
- `labelled-frames/stairs_up/`: ten frames assigned the reviewed upstairs class.
- `labelled-frames/stairs_down/`: ten frames assigned the reviewed downstairs class.
- `labels.csv`: image-level labels, source clip, timestamps, scene group and split.
- `manifest.json`: original paths, source hashes, review findings and corrected labels.
- `prepare_clips.py` and `finalize_review.py`: extraction and review-record scripts. Running extraction resets review fields; apply the review script afterwards.

Original videos have not been modified. Copies of the labelled images retain source clip names for traceability.

## Dataset limits and next work

Twenty frames are twenty correlated observations from four videos, not twenty independent locations. All clips have visually similar brickwork, tiled stairs, dark stair-edge strips and railings. They may show the same stairwell or flights in the same building. A/B labels do not establish independent locations, so all four clips have been assigned one scene group and development-only status. Do not split neighbouring frames or these visually related clips between training and an independent test set.

The annotations are whole-image direction labels, not boxes or masks. A direction classifier can use this type of annotation; a multi-class obstacle detector would additionally require reviewed stair-region boxes. The existing generic stair detector and shipped application have not been changed or trained by this preparation.

There are no flat-ground, ambiguous-view or other negative examples in this batch. Next work is to combine suitable annotated public data with these development frames, include negative/uncertain views, and reserve genuinely different stair locations for evaluation. A model must not infer up/down solely from this building's walls, windows or railings. Direction-uncertain cases should keep a generic stair warning.

No recognition accuracy, generalisation, walking reliability or safety claim follows from this review. Holes and distance are outside this batch.
