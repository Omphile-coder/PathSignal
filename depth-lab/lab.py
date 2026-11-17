"""Local PathSignal depth and fixed-view comparison lab."""
import base64
import binascii
from collections import deque
from http.server import BaseHTTPRequestHandler, HTTPServer
from io import BytesIO
import json
from pathlib import Path
import threading
import webbrowser

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError

from object_detector import HAZARD_CLASSES, YoloX, overlaps_corridor

ROOT = Path(__file__).resolve().parent
GRID = (128, 96)
MAX_UPLOAD = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 28_000_000
MEAN = np.array([.485, .456, .406], dtype=np.float32)
STD = np.array([.229, .224, .225], dtype=np.float32)


def read_image(encoded):
    if not isinstance(encoded, str) or len(encoded) > (MAX_UPLOAD * 4 // 3 + 4):
        raise ValueError("Choose a JPEG or PNG smaller than 8 MB.")
    try:
        binary = base64.b64decode(encoded, validate=True)
        if len(binary) > MAX_UPLOAD:
            raise ValueError("Choose a JPEG or PNG smaller than 8 MB.")
        with Image.open(BytesIO(binary), formats=["JPEG", "PNG"]) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, binascii.Error, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Could not read that JPEG or PNG.") from exc
    if min(image.size) < 96:
        raise ValueError("The image must be at least 96 pixels on each side.")
    image.thumbnail((900, 900))
    return image


def estimate(session, image):
    pixels = np.asarray(image.resize((518, 518), Image.Resampling.BICUBIC), dtype=np.float32) / 255
    rgb = np.ascontiguousarray(((pixels - MEAN) / STD).transpose(2, 0, 1)[None])
    result = session.run(["predicted_depth"], {"pixel_values": rgb})[0][0]
    if not np.all(np.isfinite(result)) or np.any(result <= 0):
        raise ValueError("The model returned invalid depth estimates.")
    return np.asarray(Image.fromarray(result).resize(GRID, Image.Resampling.BILINEAR))


def components(mask):
    remaining = mask.copy()
    h, w = mask.shape
    for y, x in zip(*np.nonzero(mask)):
        if not remaining[y, x]:
            continue
        pending = deque([(y, x)])
        remaining[y, x] = False
        points = []
        while pending:
            row, col = pending.popleft()
            points.append((row, col))
            for yy, xx in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
                if 0 <= yy < h and 0 <= xx < w and remaining[yy, xx]:
                    remaining[yy, xx] = False
                    pending.append((yy, xx))
        if len(points) >= 30:
            yield np.array(points).T


def compare(reference, current, reference_rgb, current_rgb, view):
    w, h = GRID
    y, x = np.mgrid[:h, :w]
    x = (x + .5) / w
    y = (y + .5) / h
    anchors = ((x < .20) | (x > .80)) & (y > .15) & (y < .88)

    def anchor_luma(image):
        luma = np.asarray(image.convert("L").resize(GRID, Image.Resampling.BILINEAR), dtype=np.float32)
        luma = luma[anchors]
        return luma - np.median(luma)

    if np.mean(np.abs(anchor_luma(reference_rgb) - anchor_luma(current_rgb))) > 16:
        raise ValueError("The images differ at the sides. Retake both with the camera fixed in place.")
    scale = float(np.median(reference[anchors] / current[anchors]))
    if not .78 <= scale <= 1.28:
        raise ValueError("Depth at the sides changed too much. Check the camera position and reference.")
    aligned = current * scale
    mismatch = np.median(np.abs(aligned[anchors] - reference[anchors]) / reference[anchors])
    if mismatch > .14:
        raise ValueError("The background depth does not match. Use a fresh reference from the same position.")

    delta = aligned - reference
    if view == "upper":
        region = (y >= .08) & (y <= .58) & (np.abs(x - .5) <= .23)
        modes = ((delta < -np.maximum(.28, reference * .20), "Possible upper-path obstruction"),)
    else:
        region = (y >= .28) & (y <= .94) & (np.abs(x - .5) <= .15 + (y - .28) * .24)
        gap = np.maximum(.12, reference * .13)
        modes = (
            (delta < -gap, "Possible raised surface or object"),
            (delta > gap, "Possible depression or drop-off"),
        )
    results = []
    for mask, label in modes:
        for rows, cols in components(mask & region):
            if rows.max() - rows.min() < 2 or cols.max() - cols.min() < 3:
                continue
            results.append({
                "label": label,
                "box": [int(cols.min()), int(rows.min()), int(cols.max() + 1), int(rows.max() + 1)],
                "depth": round(float(np.median(current[rows, cols])), 2),
                "delta": round(float(np.median(delta[rows, cols])), 2),
                "area": len(rows),
            })
    return sorted(results, key=lambda item: -item["area"])[:6]


def data_uri(image):
    stream = BytesIO()
    image.save(stream, format="JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(stream.getvalue()).decode("ascii")


def analyse(session, current, reference=None, view="floor"):
    depth = estimate(session, current)
    findings = []
    if reference is not None:
        if abs(current.width / current.height - reference.width / reference.height) > .02:
            raise ValueError("Use images with the same framing and orientation.")
        findings = compare(estimate(session, reference), depth, reference, current, view)
    near, far = np.percentile(depth, [5, 95])
    shade = np.clip((depth - near) / max(.01, far - near), 0, 1)
    heat = np.stack([1 - shade * .75, .18 + .44 * shade, .16 + .82 * shade], axis=-1)
    heatmap = Image.fromarray((heat * 255).astype("uint8")).resize(current.size, Image.Resampling.BILINEAR)
    preview = current.copy()
    draw = ImageDraw.Draw(preview)
    for item in findings:
        x0, y0, x1, y1 = item["box"]
        rect = (x0 * preview.width / GRID[0], y0 * preview.height / GRID[1],
                x1 * preview.width / GRID[0], y1 * preview.height / GRID[1])
        draw.rectangle(rect, outline="#ffc474", width=3)
    return {"preview": data_uri(preview), "heatmap": data_uri(heatmap),
            "depth": np.round(depth.astype(np.float64), 2).tolist(), "findings": findings,
            "compared": reference is not None}


def analyse_objects(detector, image):
    objects = detector.detect(image, HAZARD_CLASSES)
    preview = image.copy()
    draw = ImageDraw.Draw(preview)
    for item in objects:
        item["inPath"] = overlaps_corridor(item["box"], image.size)
        x0, y0, _, _ = item["box"]
        colour = "#ffc474" if item["inPath"] else "#a6b5b5"
        draw.rectangle(item["box"], outline=colour, width=3)
        label = item["label"] + " " + str(round(item["score"] * 100)) + "%"
        position = (x0 + 2, max(0, y0 - 14))
        draw.rectangle(draw.textbbox(position, label), fill="#101517")
        draw.text(position, label, fill=colour)
    return {"preview": data_uri(preview), "objects": objects}


def main():
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 3
    opts.inter_op_num_threads = 1
    session = ort.InferenceSession(str(ROOT / "model.onnx"), sess_options=opts,
                                   providers=["CPUExecutionProvider"])

    detector = None

    class Handler(BaseHTTPRequestHandler):
        def send_body(self, status, mime, data):
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", len(data))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            routes = {"/": ("index.html", "text/html; charset=utf-8"),
                      "/sample-target": ("sample-target.jpg", "image/jpeg"),
                      "/sample-reference": ("sample-reference.jpg", "image/jpeg")}
            route = routes.get(self.path)
            if not route:
                self.send_error(404)
                return
            name, mime = route
            self.send_body(200, mime, (ROOT / name).read_bytes())

        def do_POST(self):
            nonlocal detector
            if self.path not in {"/analyse", "/objects"}:
                self.send_error(404)
                return
            try:
                if self.headers.get_content_type() != "application/json":
                    raise ValueError("Expected a JSON image request.")
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 2 * (MAX_UPLOAD * 4 // 3 + 4) + 4096:
                    raise ValueError("The images are too large.")
                request = json.loads(self.rfile.read(length))
                if not isinstance(request, dict) or request.get("view") not in {"floor", "upper"}:
                    raise ValueError("Choose floor or upper path.")
                target = read_image(request.get("target"))
                if self.path == "/objects":
                    if detector is None:
                        detector = YoloX(ROOT / "yolox_s.onnx", score=.25)
                    status, response = 200, analyse_objects(detector, target)
                else:
                    reference = read_image(request["reference"]) if request.get("reference") else None
                    status, response = 200, analyse(session, target, reference, request["view"])
            except (ValueError, TypeError) as exc:
                status, response = 400, {"error": str(exc)}
            except Exception as exc:
                self.log_error("Analysis failed: %s", exc)
                status, response = 500, {"error": "Depth analysis could not finish."}
            self.send_body(status, "application/json", json.dumps(response).encode("utf-8"))

    with HTTPServer(("127.0.0.1", 8768), Handler) as server:
        url = "http://127.0.0.1:8768/"
        print("PathSignal depth lab: " + url, flush=True)
        threading.Thread(target=webbrowser.open, args=(url,), daemon=True).start()
        server.serve_forever()


if __name__ == "__main__":
    main()

