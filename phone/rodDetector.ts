// PathSignal ROD YOLOv8n adapter. Input is RGB, letterboxed to 640x640.
export const ROD_SIZE = 640
export const ROD_MODEL = 'ROD YOLOv8n · 25 classes'

export const ROD_CLASSES = [
  'Bike', 'Building', 'Car', 'Person', 'Stairs', 'Traffic sign', 'Electrical Pole', 'Road',
  'Motorcycle', 'Dustbin', 'Dog', 'Manhole', 'Tree', 'Guard rail', 'Pedestrian crosswalk',
  'Truck', 'Bus', 'Bench', 'Traffic Cone', 'Fire hydrant', 'Teraffic Barrel', 'Plant Pot',
  'Electrical Box', 'Chair', 'Bicycle Rack',
]

type Detection = { class: string; score: number; bbox: [number, number, number, number] }

export function prepareRodInput(data: Uint8Array, width: number, height: number, size = ROD_SIZE) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw Error('Invalid ROD image')
  const scale = Math.min(size / width, size / height)
  const resizedWidth = Math.max(1, Math.round(width * scale)), resizedHeight = Math.max(1, Math.round(height * scale))
  const padX = Math.floor((size - resizedWidth) / 2), padY = Math.floor((size - resizedHeight) / 2)
  const plane = size ** 2, tensor = new Float32Array(plane * 3).fill(114 / 255)
  for (let y = 0; y < resizedHeight; y++) {
    const sy = Math.max(0, Math.min(height - 1, (y + .5) * height / resizedHeight - .5))
    const y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), wy = sy - y0
    for (let x = 0; x < resizedWidth; x++) {
      const sx = Math.max(0, Math.min(width - 1, (x + .5) * width / resizedWidth - .5))
      const x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), wx = sx - x0
      const pixel = ((y + padY) * size) + x + padX
      for (let channel = 0; channel < 3; channel++) {
        const top = data[(y0 * width + x0) * 4 + channel] * (1 - wx) + data[(y0 * width + x1) * 4 + channel] * wx
        const bottom = data[(y1 * width + x0) * 4 + channel] * (1 - wx) + data[(y1 * width + x1) * 4 + channel] * wx
        tensor[channel * plane + pixel] = (top * (1 - wy) + bottom * wy) / 255
      }
    }
  }
  return { tensor, scale: resizedWidth / width, padX, padY }
}

function iou(a: Detection, b: Detection) {
  const [x, y, w, h] = a.bbox, [u, v, p, q] = b.bbox
  const overlap = Math.max(0, Math.min(x + w, u + p) - Math.max(x, u)) * Math.max(0, Math.min(y + h, v + q) - Math.max(y, v))
  return overlap / Math.max(1e-6, w * h + p * q - overlap)
}

export function decodeRodOutput(output: Float32Array, dims: readonly number[], width: number, height: number, transform: { scale: number; padX: number; padY: number }) {
  if (dims.length !== 3 || dims[0] !== 1) throw Error('Unexpected ROD model output rank')
  const channels = ROD_CLASSES.length + 4
  const channelFirst = dims[1] === channels
  const count = channelFirst ? dims[2] : dims[1]
  if ((!channelFirst && dims[2] !== channels) || output.length !== count * channels || count < 1 || count > 100000) throw Error('Unexpected ROD model output shape')
  const value = (candidate: number, channel: number) => output[channelFirst ? channel * count + candidate : candidate * channels + channel]
  const candidates: Detection[] = []
  for (let i = 0; i < count; i++) {
    let classId = 0, score = value(i, 4)
    for (let c = 1; c < ROD_CLASSES.length; c++) {
      const next = value(i, 4 + c)
      if (next > score) { score = next; classId = c }
    }
    if (!Number.isFinite(score) || score < .3) continue
    const cx = value(i, 0), cy = value(i, 1), w = value(i, 2), h = value(i, 3)
    if (![cx, cy, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue
    const left = Math.max(0, (cx - w / 2 - transform.padX) / transform.scale)
    const top = Math.max(0, (cy - h / 2 - transform.padY) / transform.scale)
    const right = Math.min(width, (cx + w / 2 - transform.padX) / transform.scale)
    const bottom = Math.min(height, (cy + h / 2 - transform.padY) / transform.scale)
    if (right > left && bottom > top) candidates.push({ class: ROD_CLASSES[classId], score, bbox: [left, top, right - left, bottom - top] })
  }
  const kept: Detection[] = []
  for (const item of candidates.sort((a, b) => b.score - a.score)) {
    if (!kept.some(other => other.class === item.class && iou(other, item) > .45)) kept.push(item)
    if (kept.length >= 40) break
  }
  return kept
}

// Road, building and painted crosswalk regions are scene context, not obstacle alerts.
const hazardClasses = new Set(ROD_CLASSES.filter(name => !['Building', 'Road', 'Pedestrian crosswalk'].includes(name)))
export function rodPathHazards(detections: Detection[], width: number, height: number) {
  return detections.filter(({ bbox: [x, y, w, h], class: label, score }) => {
    if (!hazardClasses.has(label) || score < .35 || w <= 0 || h <= 0) return false
    const bottom = (y + h) / height
    if (bottom < .28) return false
    const half = .15 + (Math.min(.94, bottom) - .28) * .24
    const overlap = Math.min((x + w) / width, .5 + half) - Math.max(x / width, .5 - half)
    return overlap >= Math.min(.035, (w / width) * .55)
  }).sort((a, b) => b.score - a.score)
}
