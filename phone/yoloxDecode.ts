export const YOLOX_SIZE = 640
const modelClasses: Record<number, string> = {
  0: 'person', 1: 'bicycle', 3: 'motorcycle', 15: 'cat', 16: 'dog',
  24: 'backpack', 25: 'umbrella', 26: 'handbag', 28: 'suitcase',
  32: 'sports ball', 36: 'skateboard', 39: 'bottle', 41: 'cup', 45: 'bowl',
  56: 'chair', 57: 'couch', 58: 'potted plant', 59: 'bed', 60: 'dining table',
  62: 'tv', 63: 'laptop', 64: 'mouse', 65: 'remote', 66: 'keyboard', 67: 'cell phone',
}

type Detection = { class: string; score: number; bbox: [number, number, number, number] }
type Frame = { data: Uint8Array; width: number; height: number }
const rowLength = 85

export function makeYoloInput({ data, width, height }: Frame) {
  const ratio = Math.min(YOLOX_SIZE / width, YOLOX_SIZE / height)
  const resizedWidth = Math.floor(width * ratio), resizedHeight = Math.floor(height * ratio)
  const plane = YOLOX_SIZE ** 2
  const tensor = new Float32Array(plane * 3).fill(114)

  for (let y = 0; y < resizedHeight; y++) {
    const sourceY = Math.max(0, (y + .5) * height / resizedHeight - .5)
    const y0 = Math.floor(sourceY), y1 = Math.min(height - 1, y0 + 1), wy = sourceY - y0
    for (let x = 0; x < resizedWidth; x++) {
      const sourceX = Math.max(0, (x + .5) * width / resizedWidth - .5)
      const x0 = Math.floor(sourceX), x1 = Math.min(width - 1, x0 + 1), wx = sourceX - x0
      const i = y * YOLOX_SIZE + x
      for (let channel = 0; channel < 3; channel++) {
        const bgr = 2 - channel
        const top = data[(y0 * width + x0) * 4 + bgr] * (1 - wx) + data[(y0 * width + x1) * 4 + bgr] * wx
        const bottom = data[(y1 * width + x0) * 4 + bgr] * (1 - wx) + data[(y1 * width + x1) * 4 + bgr] * wx
        tensor[channel * plane + i] = top * (1 - wy) + bottom * wy
      }
    }
  }
  return { tensor, ratio }
}

function iou(a: Detection, b: Detection) {
  const [x, y, w, h] = a.bbox, [u, v, p, q] = b.bbox
  const overlap = Math.max(0, Math.min(x + w, u + p) - Math.max(x, u)) *
    Math.max(0, Math.min(y + h, v + q) - Math.max(y, v))
  return overlap / Math.max(1e-6, w * h + p * q - overlap)
}

export function decodeYolo(output: Float32Array, ratio: number, width: number, height: number) {
  const strides = [8, 16, 32]
  const count = strides.reduce((total, stride) => total + (YOLOX_SIZE / stride) ** 2, 0)
  if (output.length !== rowLength * count) throw new Error('Unexpected YOLOX output shape.')
  const detections: Detection[] = []
  let row = 0
  for (const stride of strides) {
    const grid = YOLOX_SIZE / stride
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++, row++) {
        const offset = row * rowLength
        const objectness = output[offset + 4]
        if (objectness < .25) continue
        let classId = 0
        for (let label = 1; label < 80; label++) {
          if (output[offset + 5 + label] > output[offset + 5 + classId]) classId = label
        }
        const score = objectness * output[offset + 5 + classId]
        const name = modelClasses[classId]
        if (!name || score < .25 || !Number.isFinite(score)) continue
        const centreX = (output[offset] + x) * stride / ratio
        const centreY = (output[offset + 1] + y) * stride / ratio
        const halfW = Math.exp(output[offset + 2]) * stride / (2 * ratio)
        const halfH = Math.exp(output[offset + 3]) * stride / (2 * ratio)
        const left = Math.max(0, centreX - halfW), right = Math.min(width, centreX + halfW)
        const top = Math.max(0, centreY - halfH), bottom = Math.min(height, centreY + halfH)
        if (right > left && bottom > top) detections.push({ class: name, score, bbox: [left, top, right - left, bottom - top] })
      }
    }
  }
  const kept: Detection[] = []
  for (const candidate of detections.sort((a, b) => b.score - a.score)) {
    if (!kept.some(other => other.class === candidate.class && iou(other, candidate) > .45)) kept.push(candidate)
    if (kept.length >= 30) break
  }
  return kept
}
