# Local hazard collection

Reviewed samples collected on 23 November 2026:

| Folder | Clips | Frames | Reviewed image labels |
|---|---:|---:|---|
| Original frames and labelled-frames | 4 | 20 | 10 stairs_up, 10 stairs_down; uploaded directions corrected |
| outdoor-down | 2 | 10 | stairs_down |
| outdoor-up | 2 | 10 | stairs_up |
| potholes | 2 | 10 | missing_paver_depression |
| intact-ground | 1 | 5 | intact_paving_no_visible_pothole |

Total: 11 local videos, 55 sampled frames. These are correlated samples, not 55 independent scenes. Each folder contains a manifest, contact sheets and a review note. Original video paths and hashes are retained in manifests.

Kaggle candidate archive and inspection: potholes/kaggle-research. It contains 720 augmented training images from 240 filename source groups and 60 validation images, with YOLO polygon labels. Its metadata and originating export list different licences; preserve both and establish attribution before distribution.

Next model preparation: fix location/source-group splits, annotate local positive hazard regions if training a detector, combine compatible public data with the selected local development scenes, and retain untouched locations for evaluation. The intact-ground batch supplies empty background labels for the pothole task. Labels for stair direction are currently whole-image labels. No direction or pothole model has been trained or added to the app by this collection work.
