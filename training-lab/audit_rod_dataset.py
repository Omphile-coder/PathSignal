"""Audit the downloaded ROD YOLO segmentation dataset and split leakage."""
import argparse
import csv
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import yaml


def validate_label(info, names):
    split, image, label, item, sha, shape = info
    found, class_counts, errors = [], [0] * len(names), []
    try:
        for line_number, line in enumerate(label.read_text(encoding="utf-8").splitlines(), 1):
            parts = line.split()
            if len(parts) != 5 and (len(parts) < 7 or (len(parts) - 1) % 2):
                raise ValueError(f"line {line_number}: expected a YOLO box or polygon annotation")
            values = list(map(float, parts))
            cidf, coords = values[0], values[1:]
            cid = int(cidf)
            if cidf != cid or cid < 0 or cid >= len(names):
                raise ValueError(f"line {line_number}: invalid class id {cidf}")
            if len(parts) == 5:
                _, x, y, w, h = values
                if not all(-0.001 <= v <= 1.001 for v in (x, y, w, h)) or w <= 0 or h <= 0 or x-w/2 < -0.001 or x+w/2 > 1.001 or y-h/2 < -0.001 or y+h/2 > 1.001:
                    raise ValueError(f"line {line_number}: invalid normalized box")
            elif not all(0 <= x <= 1.00001 for x in coords):
                raise ValueError(f"line {line_number}: polygon coordinate outside normalized image bounds")
            class_counts[cid] += 1
            found.append(cid)
        if len(found) != int(item["num_objects"]):
            errors.append({"image": image.name, "error": "manifest_label_count_mismatch", "manifest": int(item["num_objects"]), "labels": len(found)})
    except Exception as exc:
        errors.append({"image": image.name, "error": str(exc)})
    return errors, class_counts, {"split": split, "image": str(image), "label": str(label), "shape": list(shape), "sha256": sha}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, help="Path to extracted ROD-Dataset/dataset folder")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    root = args.root.resolve()
    cfg = yaml.safe_load((root / "data.yaml").read_text(encoding="utf-8"))
    names = cfg["names"]
    manifest = list(csv.DictReader((root / "images_manifest.csv").open(encoding="utf-8-sig", newline="")))
    rows, errors, exact = [], [], []
    class_boxes = [0] * len(names)
    exact_by_hash = {}

    for item in manifest:
        split = item["split"]
        image = root / split / "images" / item["image_filename"]
        label = root / split / "labels" / item["label_filename"]
        if not image.is_file() or not label.is_file():
            errors.append({"image": item["image_filename"], "error": "missing_image_or_label"})
            continue
        rows.append((split, image, label, item))

    def image_info(row):
        split, image, label, item = row
        data = image.read_bytes()
        hash_value = hashlib.sha256(data).hexdigest()
        decoded = cv2.imread(str(image), cv2.IMREAD_UNCHANGED)
        if decoded is None:
            raise ValueError("image decode failed")
        return split, image, label, item, hash_value, decoded.shape

    validated = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        infos = list(pool.map(image_info, rows))
    print(f"Decoded and hashed {len(infos)} images; validating labels and exact split duplicates.", flush=True)

    for split, image, label, item, sha, shape in infos:
        if sha in exact_by_hash:
            prior = exact_by_hash[sha]
            exact.append({"a": prior["image"], "a_split": prior["split"], "b": str(image), "b_split": split})
        else:
            exact_by_hash[sha] = {"image": str(image), "split": split}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for label_errors, counts, record in pool.map(lambda info: validate_label(info, names), infos):
            errors.extend(label_errors)
            class_boxes = [a + b for a, b in zip(class_boxes, counts)]
            validated.append(record)

    cross_split_exact = [pair for pair in exact if pair["a_split"] != pair["b_split"]]

    split_counts = {s: sum(r[0] == s for r in rows) for s in ("train", "valid", "test")}
    class_counts = {names[i]: n for i, n in enumerate(class_boxes)}
    summary = {
        "dataset": "ROD-Dataset",
        "root": str(root),
        "class_names_json": json.dumps(names, ensure_ascii=False),
        "manifest_images": len(manifest),
        "split_counts": split_counts,
        "paired_and_decoded_images": len(validated),
        "label_errors": errors,
        "exact_duplicate_pairs": exact,
        "exact_cross_split_duplicate_pairs": cross_split_exact,
        "perceptual_near_duplicate_audit": "not_run; exact byte-identical duplicates only",
        "class_box_counts": class_counts,
        "image_records": validated,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    brief = {k: (len(v) if isinstance(v, list) else v) for k, v in summary.items() if k not in ("image_records", "class_box_counts")}
    brief["class_box_counts"] = class_counts
    print(json.dumps(brief, indent=2))


if __name__ == "__main__":
    main()
