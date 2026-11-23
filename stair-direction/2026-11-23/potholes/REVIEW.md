# Missing-paver recordings supplied as potholes

23 November 2026. Five chronological samples per clip and the central full-size frames were visually inspected, not continuous playback.

| Review ID | Source | Duration | Observed surface |
|---|---|---:|---|
| P1-pothole | IMG_1294.mov | 10.63 seconds | Individual missing paving blocks and exposed ground |
| P2-pothole | IMG_1295.mov | 11.80 seconds | Larger missing-paver area with exposed ground |

These are useful damaged-paving examples. The image-level label is `missing_paver_depression`, rather than assuming interchangeability with asphalt-road potholes or every type of hole. The depth, dimensions and severity are not measured. Landscape orientation in P1 is retained as decoded from the source; P2 is portrait. Both show strong shadows, providing useful visual variation but also a potential shortcut for a classifier.

The camera is close and directed mostly down at the defect, with shoes visible. These clips cannot establish advance warning for a person approaching the defect. No detection accuracy or depth estimate is implied.

Both defects have similar paving and are conservatively grouped together (`outdoor_paver_defects_01`) until independent locations are established. Their frames must not be randomly distributed across training and testing. All splits remain unassigned. A model also needs intact paving, shadows without missing blocks, drains, leaves and other confusing views. No negative examples are included in this batch.

Saved here: ten extracted frames, two contact sheets, image-level `labels.csv`, original hashes/metadata in `manifest.json`, and labelled frame copies. Boxes/masks have not been drawn and no model has been trained or deployed by this review.
