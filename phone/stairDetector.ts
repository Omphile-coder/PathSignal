// PathSignal stair integration, AGPL-3.0-or-later. See source/licence offer.
export const STAIR_SIZE = 640
export const STAIR_MODEL = 'YOLOv8n stairs'
export type StairDetection = { class: string; score: number; bbox: [number, number, number, number] }
export function prepareStairInput(data: Uint8Array, width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw Error('Invalid stair image')
  const plane = STAIR_SIZE ** 2, tensor = new Float32Array(plane * 3)
  for (let y = 0; y < STAIR_SIZE; y++) {
    const sy = Math.max(0, Math.min(height - 1, (y + .5) * height / STAIR_SIZE - .5))
    const y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), wy = sy - y0
    for (let x = 0; x < STAIR_SIZE; x++) {
      const sx = Math.max(0, Math.min(width - 1, (x + .5) * width / STAIR_SIZE - .5))
      const x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), wx = sx - x0
      for (let c = 0; c < 3; c++) {
        const top = data[(y0 * width + x0) * 4 + c] * (1 - wx) + data[(y0 * width + x1) * 4 + c] * wx
        const bottom = data[(y1 * width + x0) * 4 + c] * (1 - wx) + data[(y1 * width + x1) * 4 + c] * wx
        tensor[c * plane + y * STAIR_SIZE + x] = (top * (1 - wy) + bottom * wy) / 255
      }
    }
  }
  return tensor
}
export function decodeStairOutput(output: Float32Array, dims: readonly number[], width: number, height: number) {
  if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== 5 || dims[2] !== 8400 || output.length !== 42000) throw Error('Unexpected stair model output')
  const candidates: StairDetection[] = [], count = 8400
  for (let i = 0; i < count; i++) {
    const score = output[4 * count + i]
    if (!Number.isFinite(score) || score < .4) continue
    const cx = output[i], cy = output[count + i], w = output[2 * count + i], h = output[3 * count + i]
    if (![cx, cy, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue
    const left = Math.max(0, (cx - w / 2) * width / STAIR_SIZE), top = Math.max(0, (cy - h / 2) * height / STAIR_SIZE)
    const right = Math.min(width, (cx + w / 2) * width / STAIR_SIZE), bottom = Math.min(height, (cy + h / 2) * height / STAIR_SIZE)
    if (right > left && bottom > top) candidates.push({ class: 'stairs', score, bbox: [left, top, right - left, bottom - top] })
  }
  candidates.sort((a, b) => b.score - a.score)
  const detections: StairDetection[] = []
  for (const item of candidates.slice(0, 3000)) {
    const [x, y, w, h] = item.bbox
    if (detections.some(other => {
      const [u, v, p, q] = other.bbox
      const overlap = Math.max(0, Math.min(x + w, u + p) - Math.max(x, u)) * Math.max(0, Math.min(y + h, v + q) - Math.max(y, v))
      return overlap / Math.max(1e-9, w * h + p * q - overlap) > .3
    })) continue
    detections.push(item)
    if (detections.length >= 300) break
  }
  const hazards = detections.filter(({ bbox: [x, y, w, h] }) => {
    const bottom = (y + h) / height
    if (bottom < .28) return false
    const half = .15 + (Math.min(.94, bottom) - .28) * .24
    const overlap = Math.min((x + w) / width, .5 + half) - Math.max(x / width, .5 - half)
    return overlap >= Math.min(.035, w / width * .55)
  })
  return { detections, hazards }
}
