# Targeted dataset search and sample review

23 November 2026. The search and public-sample inspection are complete. Two candidates are selected for a full-archive audit. They have not been merged into training, trained or deployed. Full ZIP downloads require a free Roboflow sign-in; the research browser is not signed in.

## 1. Missing paving: missing_tile, version 2

Publisher: aoqiangma. [Dataset version](https://universe.roboflow.com/aoqiangma/missing_tile/dataset/2). Listed licence: CC BY 4.0. Object detection, class `missing_tile`.

The version card reports **432 images: 384 training, 48 validation, no test set**, with no augmentations applied. These are publisher counts, not a verified archive inventory. The export auto-orients and stretches images to 640x640.

Twelve public preview images and their twelve annotation overlays were saved and visually reviewed. They show missing areas within outdoor paving-tile grids, a closer visual match to the user's missing pavers than the previously used asphalt-road data. An individual image-detail view (`21.jpg`) showed two `missing_tile` annotations. This is a suitability inference, not evidence of improved PathSignal detection.

Important limitations: the previews have very similar paving, lighting and backgrounds. They may contain related scenes. Real scene independence, physical depth and whether any examples were edited cannot be established from these images. The whole dataset must not be treated as 432 independent scenes. There is no publisher test set, and intact-paving negatives still need checking/adding. A full export is needed to audit actual labels and source relationships.

Preview: `missing-tile-v2-preview.jpg`. Public preview assets and URL attribution: `samples/missing-tile-v2/manifest.json`.

## 2. Stair directions: up-down stairs, version 1

Publisher: stairs. [Dataset version](https://universe.roboflow.com/stairs-n9kkx/up-down-stairs/dataset/1). Listed licence: CC BY 4.0. Object detection.

The selected **v1** reports **1,289 images: 952 training, 225 validation and 112 test**, with no augmentation. The project also has larger later versions; do not merge versions because they may share originals. The project card lists `upstairs`, `downstairs` and `object`. The actual v1 class mapping must be confirmed from its data.yaml; the project card may reflect later content.

Twelve public images with rendered annotation overlays were saved and visually inspected. They include an indoor descending view and outdoor ascending flights in stone, concrete and other finishes, with different surroundings and viewpoints. The individual image-detail view for `4692452521_output.jpg` showed an `upstairs` box. The previews are more varied than our first single-stairwell training set, but some are small, some may be related, and the selected previews are not a representative class-balance audit.

The publisher's model metrics are not PathSignal evaluation results. We are selecting data, not accepting that trained model as reliable.

Preview: `stairs-v1-preview.jpg`. Public preview assets and URL attribution: `samples/stairs-v1/manifest.json`.

## Alternatives checked

- [Dongeui University sidewalk](https://universe.roboflow.com/dongeui-university/sidewalk-exydy/dataset/1): card reports 6,038 semantic-segmentation images, classes `blocks` and `damaged`, CC BY 4.0. Potential additional damaged-surface data, but semantic masks are a different annotation type and a `damaged` class is not proof of missing paving blocks. Not selected over the more specific missing_tile candidate; image-level suitability not audited.
- [Meliss Workspace damaged sidewalk](https://universe.roboflow.com/meliss-workspace-oniq8/damaged-sidewalk): card lists `crack` and `damaged-sidewalk`, CC BY 4.0, and 220 project images. A model card mentions a different generated count; version/export inventory must resolve it. Broad damage is not automatically a hole. Not selected for this first targeted import.
- [Stairs Blind Up_Down_Stairs_v2](https://universe.roboflow.com/stairs-blind/up_down_stairs_v2): despite the name, the inspected card has only a generic `stairs` class. It does not directly supply direction labels.
- [Detailed block pavement distress study](https://www.tandfonline.com/doi/abs/10.1080/10298436.2025.2569616): the paper explicitly includes missing pavers among 10,298 images, but states that data/code are available upon request. This is not a verified immediately downloadable free archive. No author was contacted.
- Sensor-only human-activity datasets with upstairs/downstairs labels were excluded: they classify motion while someone is using stairs, not visual hazards ahead of the phone.

## Required next action to obtain the full files

1. Sign in to your existing free Roboflow account in your normal browser.
2. Open the [missing_tile v2 YOLOv8 download](https://universe.roboflow.com/aoqiangma/missing_tile/dataset/2/download/yolov8).
3. Choose the ZIP download option, if offered. Keep the original ZIP.
4. Open the [up-down stairs v1 YOLOv8 download](https://universe.roboflow.com/stairs-n9kkx/up-down-stairs/dataset/1/download/yolov8) and download that ZIP too.
5. Save both ZIPs under `PathSignal/training-lab/dataset-research/2026-11-23/incoming/`, or attach them to this chat. Do not paste your API key into chat. A hosted-training purchase or an image-upload workflow is not needed to obtain the dataset exports.

`DOWNLOADS.html` contains the two exact links in one page. The ZIPs are not present yet; downloaded previews are not substitutes for those files.

## Audit and retraining plan after access

- Check archive paths, files, actual class ordering, every annotation's coordinates, empty negatives, corrupt images and licence notices before importing.
- Group duplicates and related source scenes across all publisher splits. Do not randomly split adjacent video frames, duplicated exports or multiple augmentations of one original.
- Keep `missing_tile` distinct from asphalt `pothole`. Confirm whether YOLOv8 export supplies axis-aligned boxes or another shape format, and document any conversion.
- Use the user's already inspected failure examples for development only if deliberately reassigned; they cease to be unseen evaluation evidence. Keep the earlier failed results unchanged as the first-round record.
- Select models and thresholds on validation only. Freeze an untouched public test partition and, when available, new local scenes for the next final check.
- Train and compare locally before any change to the app. Dataset selection alone does not demonstrate recognition accuracy or complete either capability.
