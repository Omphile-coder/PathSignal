"""Repackage external ONNX tensors into Git/Vercel-friendly files.

Usage:
  python prepare_footpath_onnx_chunks.py input.onnx input.onnx.data output-folder

Requires `pip install onnx`. Tensors stay byte-identical; only their external
file location metadata changes. Each output file is kept below MAX_CHUNK_BYTES.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import onnx

MAX_CHUNK_BYTES = 24_000_000


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    model_path, data_path, output_dir = map(Path, sys.argv[1:])
    output_dir.mkdir(parents=True, exist_ok=True)
    model = onnx.load(str(model_path), load_external_data=False)
    source_size = data_path.stat().st_size
    tensors = []
    for tensor in model.graph.initializer:
        if tensor.data_location != onnx.TensorProto.EXTERNAL:
            continue
        entries = {entry.key: entry.value for entry in tensor.external_data}
        if Path(entries.get("location", "")).name != data_path.name:
            raise ValueError(f"Unexpected external data location in {tensor.name}")
        offset = int(entries.get("offset", "0"))
        length = int(entries.get("length", "0"))
        if length <= 0 or offset < 0 or offset + length > source_size:
            raise ValueError(f"Invalid external tensor range in {tensor.name}")
        tensors.append((offset, length, tensor))
    tensors.sort(key=lambda item: item[0])
    if not tensors:
        raise ValueError("No external tensors found")

    chunks: list[dict[str, object]] = []
    source = data_path.open("rb")
    try:
        part_index = -1
        part_size = 0
        part_file = None
        for source_offset, length, tensor in tensors:
            if length > MAX_CHUNK_BYTES:
                raise ValueError(f"Tensor {tensor.name} exceeds chunk size")
            if part_file is None or part_size + length > MAX_CHUNK_BYTES:
                if part_file:
                    part_file.close()
                part_index += 1
                part_size = 0
                filename = f"footpath-data-{part_index:02d}.bin"
                part_file = (output_dir / filename).open("wb")
                chunks.append({"file": filename, "bytes": 0})
            source.seek(source_offset)
            payload = source.read(length)
            if len(payload) != length:
                raise IOError(f"Could not read external tensor {tensor.name}")
            tensor_offset = part_size
            part_file.write(payload)
            part_size += length
            chunks[-1]["bytes"] = part_size
            del tensor.external_data[:]
            tensor.data_location = onnx.TensorProto.EXTERNAL
            for key, value in (("location", str(chunks[-1]["file"])), ("offset", str(tensor_offset)), ("length", str(length))):
                entry = tensor.external_data.add()
                entry.key = key
                entry.value = value
    finally:
        source.close()
        if part_file:
            part_file.close()

    graph_name = "footpath-damage-deeplabv3.onnx"
    graph_path = output_dir / graph_name
    onnx.save_model(model, str(graph_path))
    for item in chunks:
        item["sha256"] = sha256(output_dir / str(item["file"]))
    manifest = {
        "name": "DeepLabV3-ResNet50 footpath damage segmentation",
        "version": "2026-11-24-candidate-1",
        "task": "experimental visible footpath-damage segmentation",
        "graph": {"file": graph_name, "bytes": graph_path.stat().st_size, "sha256": sha256(graph_path)},
        "input": {"name": "images", "shape": [1, 3, 512, 512], "color": "RGB", "scale": "0..1", "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
        "output": {"name": "damage_probability", "shape": [1, 1, 512, 512]},
        "weights_bytes": sum(int(item["bytes"]) for item in chunks),
        "chunks": chunks,
        "alert": {"pixel_probability_threshold": 0.5, "corridor_fraction_threshold": 0.05, "message": "Possible damaged paving ahead."},
        "limits": ["Experimental prototype; alert threshold was selected on the same local clips used for the initial review.", "Not a pothole, trip-risk, depth, distance, or safe-path detector.", "Local inference requires downloading approximately 151 MiB of model files."],
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"graph": str(graph_path), "weights_bytes": manifest["weights_bytes"], "chunks": len(chunks), "manifest": str(output_dir / "manifest.json")}, indent=2))


if __name__ == "__main__":
    main()
