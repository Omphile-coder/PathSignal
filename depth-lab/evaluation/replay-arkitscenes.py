"""Convert one public ARKitScenes raw scan into PathSignal trial frames."""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image


def camera_pose(row):
    axis_angle = row[1:4]
    angle = np.linalg.norm(axis_angle)
    rotation = np.eye(3)
    if angle:
        x, y, z = axis_angle / angle
        cross = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
        rotation += np.sin(angle) * cross + (1 - np.cos(angle)) * (cross @ cross)
    camera_to_world = rotation.T
    return camera_to_world, -camera_to_world @ row[4:7]


def image(archive, name):
    with Image.open(BytesIO(archive.read(name))) as pixels:
        return np.asarray(pixels).copy()


def timestamps(archive, ending):
    return {float(Path(name).stem.split('_')[-1]): name for name in archive.namelist() if name.endswith(ending)}


def projected(depth, confidence, intrinsics, rotation, position):
    width, height, fx, fy, cx, cy = intrinsics
    y, x = np.mgrid[1:depth.shape[0]:3, 1:depth.shape[1]:3]
    z = depth[y, x] / 1000
    keep = (z >= .20) & (z <= 4) & (confidence[y, x] >= 1)
    z = z[keep]
    u = (x[keep] + .5) * width / depth.shape[1]
    v = (y[keep] + .5) * height / depth.shape[0]
    rays = np.column_stack(((u - cx) * z / fx, (v - cy) * z / fy, z))
    return rays @ rotation.T + position


def to_path(points, rotation, position, floor):
    heading = rotation[:2, 2]
    length = np.linalg.norm(heading)
    if length <= .35:
        return None
    heading = heading / length
    side = np.array([heading[1], -heading[0]])
    relative = points[:, :2] - position[:2]
    ahead, lateral, height = relative @ heading, relative @ side, points[:, 2] - floor
    keep = ((ahead >= .30) & (ahead <= 3) & (np.abs(lateral) <= .60) &
            (height >= -.75) & (height <= 2.20))
    return np.rint(np.column_stack((ahead[keep], lateral[keep], height[keep])) * 100).astype(int).ravel().tolist()


def floor_reference(points, position):
    values = points[:, 2]
    values = values[(values <= position[2] - .45) & (values >= position[2] - 2.2)]
    if len(values) < 60:
        return None
    bins = np.arange(position[2] - 2.2, position[2] - .42, .04)
    counts, edges = np.histogram(values, bins)
    index = int(counts.argmax())
    if counts[index] < 35:
        return None
    centre = (edges[index] + edges[index + 1]) / 2
    return float(np.median(values[np.abs(values - centre) < .04]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('assets', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    trajectory = np.loadtxt(args.assets / 'lowres_wide.traj')
    with ExitStack() as stack:
        depth = stack.enter_context(ZipFile(args.assets / 'lowres_depth.zip'))
        confidence = stack.enter_context(ZipFile(args.assets / 'confidence.zip'))
        intrinsics = stack.enter_context(ZipFile(args.assets / 'lowres_wide_intrinsics.zip'))
        depth_files = timestamps(depth, '.png')
        confidence_files = timestamps(confidence, '.png')
        intrinsics_files = timestamps(intrinsics, '.pincam')
        available = np.array(sorted(set(depth_files) & set(confidence_files) & set(intrinsics_files)))
        trials = []
        for start in range(0, len(trajectory) - 5, 12):
            points, rotations, positions, used = [], [], [], []
            for row in trajectory[start:start + 5:2]:
                rotation, position = camera_pose(row)
                closest = float(available[np.abs(available - row[0]).argmin()])
                if abs(closest - row[0]) > .02:
                    break
                depths = image(depth, depth_files[closest])
                qualities = image(confidence, confidence_files[closest])
                calibration = np.fromstring(intrinsics.read(intrinsics_files[closest]).decode(), sep=' ')
                points.append(projected(depths, qualities, calibration, rotation, position))
                rotations.append(rotation)
                positions.append(position)
                used.append(closest)
            if len(used) != 3 or np.max(np.linalg.norm(np.array(positions) - positions[0], axis=1)) > .09:
                continue
            if min(np.dot(r[:, 2], rotations[0][:, 2]) for r in rotations) < .99:
                continue
            floor = floor_reference(np.vstack(points), positions[0])
            if floor is None:
                continue
            frames = [to_path(p, r, c, floor) for p, r, c in zip(points, rotations, positions)]
            if any(frame is None for frame in frames):
                continue
            trials.append({
                'kind': 'corridor', 'capturedAt': datetime.now(timezone.utc).isoformat(), 'expected': None,
                'measuredMetres': None, 'notes': 'Public ARKitScenes 47333462, timestamps ' + ', '.join(map(str, used)) +
                '. Floor reference derived offline from a dominant horizontal depth band. No verified hazard labels.',
                'frames': frames,
            })
            if len(trials) == 6:
                break
    if not trials:
        raise SystemExit('No stable public frame groups matched.')
    args.output.write_text(json.dumps({'format': 'pathsignal-lidar-v1', 'trials': trials}), encoding='utf-8')
    print(f'Exported {len(trials)} public frame groups.')


if __name__ == '__main__':
    main()
