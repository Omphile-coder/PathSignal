"""Train and evaluate the prepared 25-class ROD detector.

Run this on a CUDA-capable GPU machine (for example, a Kaggle notebook), not on
the current CPU-only desktop. The test split is evaluated once after training.
"""
import argparse
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import torch
import ultralytics
from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True, help="Prepared dataset data.yaml")
    parser.add_argument("--weights", default="yolov8n.pt", help="Pretrained starting weights")
    parser.add_argument("--output", type=Path, default=Path("runs/rod"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=-1, help="-1 lets Ultralytics estimate GPU batch size")
    parser.add_argument("--device", default="0", help="CUDA device index; use cpu only for smoke tests")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    data = args.data.resolve()
    output = args.output.resolve()
    if not data.is_file():
        raise SystemExit(f"Dataset config not found: {data}")
    if not torch.cuda.is_available() and args.device != "cpu":
        raise SystemExit("No CUDA GPU is available. Use Kaggle GPU or pass --device cpu only for a smoke test.")

    prep_path = data.parent / "PREPARATION.json"
    preparation = json.loads(prep_path.read_text(encoding="utf-8")) if prep_path.is_file() else {}
    model = YOLO(args.weights)
    train_result = model.train(
        data=str(data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        project=str(output),
        name="rod-yolov8n",
        patience=10,
        seed=42,
        deterministic=True,
        close_mosaic=10,
        cache=False,
        plots=True,
    )
    best_path = Path(train_result.save_dir) / "weights" / "best.pt"
    if not best_path.is_file():
        raise SystemExit(f"Training did not produce the expected checkpoint: {best_path}")

    # Keep the test set untouched until the selected checkpoint is fixed.
    best = YOLO(str(best_path))
    test_batch = args.batch if args.batch > 0 else 32
    test_result = best.val(data=str(data), split="test", imgsz=args.imgsz,
                           batch=test_batch, device=args.device, workers=args.workers,
                           plots=True, project=str(output), name="rod-yolov8n-test")
    export_path = best.export(format="onnx", imgsz=args.imgsz, opset=12, dynamic=False,
                              simplify=False, device=args.device)
    report = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_preparation": preparation,
        "training": {"weights": args.weights, "epochs_requested": args.epochs,
                     "imgsz": args.imgsz, "batch": args.batch, "device": args.device,
                     "seed": 42, "ultralytics": ultralytics.__version__,
                     "torch": torch.__version__, "cuda": torch.cuda.is_available(),
                     "platform": platform.platform()},
        "checkpoint": str(best_path),
        "onnx_export": str(export_path),
        "held_out_test_metrics": test_result.results_dict,
        "claim_limit": "Metrics apply only to this dataset and split; they do not establish safe walking or universal hazard recognition.",
    }
    (Path(train_result.save_dir) / "pathsignal-rod-training-report.json").write_text(
        json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(json.dumps({"best_checkpoint": str(best_path), "onnx": str(export_path),
                      "test_metrics": test_result.results_dict}, indent=2, default=float))


if __name__ == "__main__":
    main()
