# Additional upstairs recordings

23 November 2026. Five chronological frames per clip were visually inspected. Both supplied direction labels agree with the sampled views. This is not continuous playback or model evaluation.

| Review ID | Source | Duration | Reviewed class | Visible conditions |
|---|---|---:|---|---|
| U1-up | IMG_1297.mov | 10.53 seconds | stairs_up | Ascending tiled flight, brick walls, bright lower steps and shaded upper flight |
| U2-up | IMG_1291.mov | 10.54 seconds | stairs_up | Ascending outdoor brick steps, paved approach, sunlight and tree shadows |

All ten sampled frames show rising steps and are usable for image-level direction review. Adjacent samples have little viewpoint change and remain correlated.

U1 visually resembles the enclosed tiled flight in C-down, so it shares that scene group conservatively. U2 shares the outdoor brick-step group with D-down. These are leakage-prevention grouping decisions, not verified statements that the recordings are exact opposite views of the same flights. Original upload names and identifiers are preserved. Do not put related up/down views or neighbouring video frames on opposite sides of a training/test split.

The labelled frame copies, `labels.csv`, contact sheets and `manifest.json` are saved here. Labels are image-level classes, not stair-region boxes. Original recordings are unchanged; no direction model has been trained and the app has not changed as part of this review.

The complete 23 November collection now has 40 reviewed stair frames from eight clips (20 upstairs, 20 downstairs), plus ten missing-paver frames from two clips. This does not represent 40 distinct staircases or a trained model. Intact-ground/confusing negative examples and a fixed location-based evaluation split remain needed.
