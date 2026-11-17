"""YOLOX-S preprocessing and decoding for the local review lab."""
import numpy as np
import onnxruntime as ort
from PIL import Image

# COCO indices from the YOLOX model class list.
HAZARD_CLASSES = {
    0: 'person', 1: 'bicycle', 3: 'motorcycle', 15: 'cat', 16: 'dog',
    24: 'backpack', 25: 'umbrella', 26: 'handbag', 28: 'suitcase',
    32: 'sports ball', 36: 'skateboard', 39: 'bottle', 41: 'cup', 45: 'bowl',
    56: 'chair', 57: 'couch', 58: 'potted plant', 59: 'bed', 60: 'dining table',
}


def box_iou(box, others):
    overlap = np.maximum(0, np.minimum(box[2:], others[:, 2:]) - np.maximum(box[:2], others[:, :2]))
    intersection = np.prod(overlap, axis=1)
    union = np.prod(box[2:] - box[:2]) + np.prod(others[:, 2:] - others[:, :2], axis=1) - intersection
    return intersection / np.maximum(1e-8, union)


class YoloX:
    def __init__(self, weights, score):
        options = ort.SessionOptions()
        options.intra_op_num_threads = 3
        self.session = ort.InferenceSession(str(weights), sess_options=options, providers=['CPUExecutionProvider'])
        model_input = self.session.get_inputs()[0]
        self.input_name = model_input.name
        _, _, self.height, self.width = model_input.shape
        self.score = score
        grids, strides = [], []
        for stride in (8, 16, 32):
            y, x = np.mgrid[:self.height // stride, :self.width // stride]
            grids.append(np.stack([x, y], axis=-1).reshape(-1, 2))
            strides.extend([stride] * x.size)
        self.grid = np.concatenate(grids).astype(np.float32)
        self.strides = np.array(strides, dtype=np.float32)[:, None]

    def detect(self, image, classes):
        ratio = min(self.width / image.width, self.height / image.height)
        resized = image.convert('RGB').resize((int(image.width * ratio), int(image.height * ratio)),
                                               Image.Resampling.BILINEAR)
        pixels = np.full((self.height, self.width, 3), 114, dtype=np.float32)
        pixels[:resized.height, :resized.width] = np.asarray(resized)[:, :, ::-1]
        tensor = np.ascontiguousarray(pixels.transpose(2, 0, 1)[None])
        out = self.session.run(None, {self.input_name: tensor})[0][0]
        class_ids = out[:, 5:].argmax(axis=1)
        scores = out[:, 4] * out[np.arange(len(out)), class_ids + 5]
        valid = (scores >= self.score) & np.isin(class_ids, list(classes))
        xy = (out[valid, :2] + self.grid[valid]) * self.strides[valid]
        wh = np.exp(out[valid, 2:4]) * self.strides[valid]
        boxes = np.concatenate([xy - wh / 2, xy + wh / 2], axis=1) / ratio
        boxes[:, (0, 2)] = np.clip(boxes[:, (0, 2)], 0, image.width)
        boxes[:, (1, 3)] = np.clip(boxes[:, (1, 3)], 0, image.height)
        scores = scores[valid]
        labels = class_ids[valid]
        order = np.argsort(-scores)
        predictions = []
        while len(order):
            best = order[0]
            predictions.append({'box': boxes[best].tolist(), 'score': float(scores[best]),
                                'label': classes[int(labels[best])]})
            rest = order[1:]
            keep = (box_iou(boxes[best], boxes[rest]) <= .45) | (labels[rest] != labels[best])
            order = rest[keep]
        return predictions


def overlaps_corridor(box, image_size):
    x0, _, x1, y1 = box
    width, height = image_size
    bottom = y1 / height
    if bottom < .28 or x1 <= x0:
        return False
    half_width = .15 + (min(.94, bottom) - .28) * .24
    overlap = min(x1 / width, .5 + half_width) - max(x0 / width, .5 - half_width)
    return overlap >= min(.035, ((x1 - x0) / width) * .55)
