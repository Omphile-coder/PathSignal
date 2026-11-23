"""Create a deduplicated YOLO-detection copy from ROD's mixed box/polygon labels.

Duplicate priority is test > valid > train so an exact image is retained in only
one split. Polygon segmentation annotations are converted to enclosing boxes.
The downloaded source directory is read-only from this script's perspective.
"""
import argparse
import json
import os
import shutil
from pathlib import Path

PRIORITY = {"test": 0, "valid": 1, "train": 2}


def box_line(line):
    values = [float(v) for v in line.split()]
    if len(values) == 5:
        cid, x, y, w, h = values
        x1, x2 = x - w / 2, x + w / 2
        y1, y2 = y - h / 2, y + h / 2
    else:
        cid, *coords = values
        xs, ys = coords[0::2], coords[1::2]
        x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
    x1, x2 = max(0.0, x1), min(1.0, x2)
    y1, y2 = max(0.0, y1), min(1.0, y2)
    w, h = x2 - x1, y2 - y1
    if w <= 0 or h <= 0:
        raise ValueError("annotation has zero-area bounds")
    return f"{int(cid)} {(x1+x2)/2:.8f} {(y1+y2)/2:.8f} {w:.8f} {h:.8f}"


def link_or_copy(source, destination):
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def parsed_boxes(label_path):
    result = []
    for line in label_path.read_text(encoding="utf-8").splitlines():
        values = [float(v) for v in line.split()]
        cid = int(values[0])
        if len(values) == 5:
            _, x, y, w, h = values
            box = (x-w/2, y-h/2, x+w/2, y+h/2)
        else:
            xs, ys = values[1::2], values[2::2]
            box = (min(xs), min(ys), max(xs), max(ys))
        result.append((cid, box))
    return result


def labels_compatible(left, right):
    """Require every box on both exact-pixel copies to match class and IoU >= .70."""
    a, b = parsed_boxes(Path(left)), parsed_boxes(Path(right))
    if len(a) != len(b):
        return False
    candidates = []
    for ai, (ca, aa) in enumerate(a):
        for bi, (cb, bb) in enumerate(b):
            if ca != cb:
                continue
            ix = max(0.0, min(aa[2], bb[2]) - max(aa[0], bb[0]))
            iy = max(0.0, min(aa[3], bb[3]) - max(aa[1], bb[1]))
            inter = ix * iy
            union = ((aa[2]-aa[0])*(aa[3]-aa[1]) + (bb[2]-bb[0])*(bb[3]-bb[1]) - inter)
            overlap = inter / union if union > 0 else 0
            if overlap >= 0.70:
                candidates.append((overlap, ai, bi))
    candidates.sort(reverse=True)
    used_a, used_b = set(), set()
    for _, ai, bi in candidates:
        if ai not in used_a and bi not in used_b:
            used_a.add(ai)
            used_b.add(bi)
    return len(used_a) == len(a) == len(b)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="Extracted ROD dataset folder")
    parser.add_argument("--audit", type=Path, required=True, help="Output from audit_rod_dataset.py")
    parser.add_argument("--destination", type=Path, required=True, help="New derived dataset directory; must not exist")
    args = parser.parse_args()
    source, destination = args.source.resolve(), args.destination.resolve()
    if destination.exists():
        raise SystemExit(f"Destination already exists; remove or choose another path: {destination}")

    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    if audit["label_errors"]:
        raise SystemExit(f"Audit has {len(audit['label_errors'])} label errors; fix or review before preparing training data")
    records = audit["image_records"]
    grouped = {}
    for record in records:
        grouped.setdefault(record["sha256"], []).append(record)
    chosen, conflicting = [], 0
    for group in grouped.values():
        group.sort(key=lambda r: PRIORITY[r["split"]])
        reference = group[0]
        if any(not labels_compatible(group[i]["label"], group[j]["label"])
               for i in range(len(group)) for j in range(i + 1, len(group))):
            conflicting += 1
            continue
        chosen.append(reference)
    selected = sorted(chosen, key=lambda r: (r["split"], Path(r["image"]).name))
    yaml_text = (source / "data.yaml").read_text(encoding="utf-8")
    names = json.loads(audit["class_names_json"])

    counts, labels_written = {}, 0
    for record in selected:
        split = record["split"]
        stem = Path(record["image"]).stem
        target_image = destination / split / "images" / f"{stem}.jpg"
        target_label = destination / split / "labels" / f"{stem}.txt"
        target_image.parent.mkdir(parents=True, exist_ok=True)
        target_label.parent.mkdir(parents=True, exist_ok=True)
        link_or_copy(Path(record["image"]), target_image)
        raw = Path(record["label"]).read_text(encoding="utf-8").splitlines()
        converted = [box_line(line) for line in raw if line.strip()]
        target_label.write_text("\n".join(converted) + ("\n" if converted else ""), encoding="utf-8")
        counts[split] = counts.get(split, 0) + 1
        labels_written += len(converted)

    class_names = ", ".join(json.dumps(name, ensure_ascii=False) for name in names)
    (destination / "data.yaml").write_text(
        f"path: {destination.as_posix()}\ntrain: train/images\nval: valid/images\ntest: test/images\n"
        f"nc: {len(names)}\nnames: [{class_names}]\n",
        encoding="utf-8",
    )
    (destination / "PREPARATION.json").write_text(json.dumps({
        "source": str(source),
        "audit": str(args.audit.resolve()),
        "images_by_split_after_exact_hash_dedup": counts,
        "unique_source_images": len(selected),
        "exact_duplicate_groups_with_conflicting_labels_excluded": conflicting,
        "converted_detection_boxes": labels_written,
        "duplicate_selection_priority": ["test", "valid", "train"],
        "polygon_conversion": "axis-aligned enclosing bounding boxes",
        "near_duplicate_audit": audit["perceptual_near_duplicate_audit"],
        "note": "Dataset only includes its 25 listed classes; no pothole, rock, missing-paver or wall-collision class.",
    }, indent=2), encoding="utf-8")
    # Preserve source attribution and license notes with the derived working copy.
    for name in ("citation_kaggle.md", "citations.txt"):
        p = source.parent / name
        if p.is_file():
            shutil.copy2(p, destination / name)
    print(json.dumps({"destination": str(destination), "images_by_split": counts,
                      "unique_source_images": len(selected), "conflicting_duplicate_groups_excluded": conflicting,
                      "converted_detection_boxes": labels_written}, indent=2))


if __name__ == "__main__":
    main()
