"""Download the public ROD obstacle dataset into the ignored research incoming folder."""
from pathlib import Path
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "dataset-research" / "2026-11-23" / "incoming" / "rod-dataset"

if __name__ == "__main__":
    DEST.mkdir(parents=True, exist_ok=True)
    path = snapshot_download(
        repo_id="Abtinzandi/Obstacle-Detection-Dataset-YOLO",
        repo_type="dataset",
        local_dir=str(DEST),
        max_workers=48,
    )
    print(f"Downloaded ROD dataset to: {path}")
