"""Convert a Stray Scanner recording into the existing PathSignal replay format."""
from argparse import ArgumentParser
from bisect import bisect_left
import csv
from datetime import datetime, timezone
import json
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image


def rotation(quaternion):
    length = np.linalg.norm(quaternion)
    if not 0.95 <= length <= 1.05:
        raise ValueError("Invalid pose quaternion in odometry.csv.")
    x, y, z, w = quaternion / length
    return np.array([
        [1 - 2*(y*y + z*z), 2*(x*y - z*w), 2*(x*z + y*w)],
        [2*(x*y + z*w), 1 - 2*(x*x + z*z), 2*(y*z - x*w)],
        [2*(x*z - y*w), 2*(y*z + x*w), 1 - 2*(x*x + y*y)],
    ])


def read_poses(folder):
    with (folder / "odometry.csv").open(encoding="utf-8-sig", newline="") as file:
        rows = csv.DictReader(file, skipinitialspace=True)
        fields = {"frame", "timestamp", "x", "y", "z", "qx", "qy", "qz", "qw"}
        if not fields.issubset(rows.fieldnames or []):
            raise ValueError("This odometry.csv is missing Stray Scanner pose columns.")
        poses = sorted(rows, key=lambda row: float(row["timestamp"]))
    if len(poses) < 3:
        raise ValueError("The recording needs at least three frames.")
    return poses


def read_depth(folder, key):
    path = folder / "depth" / (key + ".png")
    if path.is_file():
        with Image.open(path) as image:
            return np.array(image)
    path = path.with_suffix(".npy")
    if path.is_file():
        return np.load(path, allow_pickle=False)
    raise FileNotFoundError(f"No depth map for frame {key}.")


def frame_points(folder, pose, resolution, floor, fallback):
    key = f'{int(pose["frame"]):06d}'
    depth = read_depth(folder, key)
    with Image.open(folder / "confidence" / (key + ".png")) as image:
        confidence = np.array(image)
    if depth.ndim != 2 or confidence.shape != depth.shape or depth.dtype.kind not in "ui":
        raise ValueError(f"Invalid depth or confidence map in frame {key}.")
    position = np.array([float(pose[k]) for k in ("x", "y", "z")])
    q = np.array([float(pose[k]) for k in ("qx", "qy", "qz", "qw")])
    orientation = rotation(q)
    if not np.isfinite(position).all() or not 0.45 <= position[1] - floor <= 2.2:
        return None

    # Stray Scanner exports a CV camera pose: +X right, +Y down, +Z forward.
    # Its ARKit world coordinates keep +Y gravity-up.
    forward = orientation[[0, 2], 2]
    horizontal = np.linalg.norm(forward)
    if horizontal <= 0.35:
        return None
    forward /= horizontal
    right = np.array([-forward[1], forward[0]])
    intrinsics = [pose.get(name) for name in ("fx", "fy", "cx", "cy")]
    fx, fy, cx, cy = map(float, intrinsics) if all(intrinsics) else fallback
    width, height = resolution
    if not np.isfinite([fx, fy, cx, cy]).all() or min(fx, fy) <= 0 or not (0 < cx < width and 0 < cy < height):
        raise ValueError(f"Camera calibration does not match RGB dimensions in frame {key}.")
    y, x = np.mgrid[1:depth.shape[0]:3, 1:depth.shape[1]:3]
    z = depth[y, x] / 1000
    valid = (z >= .20) & (z <= 4) & (confidence[y, x] >= 1) & (confidence[y, x] <= 2)
    z = z[valid]
    u = (x[valid] + .5) * width / depth.shape[1]
    v = (y[valid] + .5) * height / depth.shape[0]
    rays = np.column_stack(((u - cx) * z / fx, (v - cy) * z / fy, z))
    relative = rays @ orientation.T
    ahead, side = relative[:, [0, 2]] @ forward, relative[:, [0, 2]] @ right
    elevation = relative[:, 1] + position[1] - floor
    keep = ((ahead >= .30) & (ahead <= 3) & (abs(side) <= .60) &
            (elevation >= -.75) & (elevation <= 2.20))
    points = np.rint(np.column_stack((ahead[keep], side[keep], elevation[keep])) * 100)
    return points.astype(int).ravel().tolist(), position, forward


def convert(folder, camera_height):
    poses = read_poses(folder)
    times = [float(row["timestamp"]) for row in poses]
    if not np.isfinite(times).all():
        raise ValueError("Invalid timestamps in odometry.csv.")
    video = imageio_ffmpeg.read_frames(str(folder / "rgb.mp4"))
    try:
        resolution = next(video)["source_size"]
    finally:
        video.close()
    fallback = None
    if not all(all(row.get(k) for k in ("fx", "fy", "cx", "cy")) for row in poses):
        matrix = np.loadtxt(folder / "camera_matrix.csv", delimiter=",")
        if matrix.shape != (3, 3):
            raise ValueError("Expected a 3 by 3 camera_matrix.csv.")
        fallback = matrix[0, 0], matrix[1, 1], matrix[0, 2], matrix[1, 2]
    floor = float(poses[0]["y"]) - camera_height
    if not np.isfinite(floor):
        raise ValueError("Invalid starting camera position.")
    trials = []
    imported_at = datetime.now(timezone.utc).isoformat()
    for offset in range(60):
        start = times[0] + offset
        indices = [bisect_left(times, start + seconds) for seconds in (0, .16, .32)]
        if indices[-1] >= len(poses):
            break
        if len(set(indices)) != 3 or times[indices[-1]] - start > .55:
            continue
        try:
            frames = [frame_points(folder, poses[index], resolution, floor, fallback) for index in indices]
        except FileNotFoundError:
            continue
        if any(frame is None for frame in frames):
            continue
        first = frames[0]
        if any(np.linalg.norm(frame[1] - first[1]) > .08 or frame[2] @ first[2] < .99 for frame in frames[1:]):
            continue
        notes = f"Stray Scanner · {start-times[0]:.1f} s into recording · camera height {camera_height:g} m"
        trials.append({"kind": "corridor", "capturedAt": imported_at, "expected": None,
                       "measuredMetres": None, "notes": notes, "frames": [frame[0] for frame in frames]})
    if not trials:
        raise ValueError("No compatible stationary frame groups. Check paired depth and confidence maps and hold the phone still in the next recording.")
    return {"format": "pathsignal-lidar-v1", "trials": trials}


def main():
    parser = ArgumentParser()
    parser.add_argument("folder", type=Path)
    parser.add_argument("camera_height", nargs="?", type=float)
    parser.add_argument("output", nargs="?", type=Path)
    args = parser.parse_args()
    try:
        camera_height = args.camera_height
        if camera_height is None:
            camera_height = float(input("Height of the rear camera above the floor in metres: ").replace(",", "."))
        if not .45 <= camera_height <= 2.2:
            raise ValueError("Enter the measured camera height in metres (0.45–2.20).")
        result = convert(args.folder, camera_height)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output = args.output or args.folder / f"pathsignal-replay-{stamp}.json"
        with output.open("x", encoding="utf-8") as file:
            json.dump(result, file, separators=(",", ":"))
    except (OSError, ValueError, RuntimeError, TypeError, KeyError, EOFError, StopIteration) as error:
        parser.exit(1, f"Import failed: {error}\n")
    print(f'Converted {len(result["trials"])} frame groups.')
    print(f'Open this file in PathSignal LiDAR replay: {output}')


if __name__ == "__main__":
    main()
