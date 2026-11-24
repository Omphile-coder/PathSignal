# StreetSurfaceVis candidate — source-test result

**Result:** a MobileNetV3-Small surface-quality classifier trained on Kaggle (Tesla T4) and evaluated once on the dataset's held-out source test split. The classifier distinguishes images labelled `bad`/`very_bad` from other quality labels. It does not localize a pothole, missing slab, raised edge, or obstacle.

- Test set: 776 images; 86 labelled bad/very bad.
- Validation-selected threshold: 0.65.
- Confusion counts: 71 true positives, 21 false positives, 15 false negatives, 669 true negatives.
- Precision 77.2%; recall 82.6%; F1 79.8%; specificity 97.0%.
- Training stopped after 7 epochs under validation-based early stopping. Two unreadable archive images were excluded after full image decode checks.

## Paving-specific limitation

The held-out `paving_stones` group had 113 images but **zero** bad/very-bad examples. It therefore cannot tell us whether the model recognizes damaged paving stones; it produced two false positive predictions in that all-negative group. The model is a candidate for further evaluation, not a replacement for the existing obstacle alert model.

Per-type test counts: asphalt 530 (8 positives; TP 3, FP 11, FN 5, TN 511); concrete 16 (0 positives); paving stones 113 (0 positives); sett 32 (14 positives; TP 7, FP 2, FN 7, TN 16); unpaved 85 (64 positives; TP 61, FP 6, FN 3, TN 15).

## Other limits

StreetSurfaceVis is mostly German street-level imagery, with some footways. Its labels describe perceived smoothness, not trip risk. No local South African trial was run. The result does not establish distance estimation, hazard localization, or safe unsupervised walking. The model was not integrated into PathSignal. ONNX export did not complete because Kaggle lacked `onnxscript`; the trained checkpoint and evaluation report were available in the active Kaggle runtime output at the time of this run; ONNX export did not complete because the Kaggle environment lacks `onnxscript`.

Dataset citation: Kapp et al. (2024), *StreetSurfaceVis: a dataset of street-level imagery annotated by road surface type and quality*, [Zenodo DOI 10.5281/zenodo.11449977](https://doi.org/10.5281/zenodo.11449977), CC BY-SA 4.0.