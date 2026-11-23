# Intact-ground negative example

23 November 2026. Source IMG_1302.mov, duration 11.50 seconds. Original video unchanged.

Five frames at 10%, 30%, 50%, 70% and 90% of the clip were visually reviewed, with the central image also inspected at full size. The images show laid paving blocks, colour variations, joints and strong shadows. No hole or missing paving block is visible in these sampled frames. This is not a continuous-video review or a claim that the ground is level or safe to traverse.

Saved class: `intact_paving_no_visible_pothole`. Five image copies, labels.csv and five empty YOLO label files are prepared. Empty labels apply only to a pothole/missing-paver detection task; they do not mean no object or hazard of any kind exists in the image. Positive defect examples still need region annotations before a detector can be trained on them.

The five samples are highly correlated observations of one view, not five independent ground locations. Similar paving and setting lead to conservative grouping with the other local paver scenes; location identity is not verified. The split remains unassigned. Do not randomly separate these neighbouring frames into training and testing.

No model training, accuracy measurement or app integration was performed in this preparation. This clip supplies the requested initial intact-ground negative example; more varied negatives can be added as failure cases appear.
