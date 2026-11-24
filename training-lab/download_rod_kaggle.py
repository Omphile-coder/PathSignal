"""Fetch and extract the public ROD dataset via KaggleHub."""
from pathlib import Path
import kagglehub

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "dataset-research" / "2026-11-23" / "incoming" / "rod-kaggle"


if __name__ == "__main__":
    DEST.mkdir(parents=True, exist_ok=True)
    path = kagglehub.dataset_download(
        "abtinzandi/obstacle-detection-dataset",
        output_dir=str(DEST),
    )
    print(f"ROD dataset downloaded and extracted at: {path}")
