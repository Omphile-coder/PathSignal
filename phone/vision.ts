type PixelFrame = { data: Uint8Array | Uint8ClampedArray }

export const WIDTH = 192
export const HEIGHT = 108
export type Profile = 'foam' | 'bottle'
export type Sample = [number, number, number, number]
export type Box = { x: number; y: number; w: number; h: number }
export const corridor = (y: number) => .15 + (y - .28) * .24

function features(r: number, g: number, b: number) {
  const total = Math.max(1, r + g + b)
  return [1, 4 * (r - g) / total, 4 * (g - b) / total]
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export function train(samples: Sample[]) {
  const rows = samples.map(([r, g, b, label]) => ({ x: features(r, g, b), label }))
  return fit(rows)
}

function fit(rows: { x: number[]; label: number }[]) {
  const weights = rows[0].x.map(() => 0)
  for (let step = 0; step < 250; step++) {
    const gradient = weights.map(() => 0)
    for (const { x, label } of rows) {
      const error = sigmoid(weights.reduce((sum, w, i) => sum + w * x[i], 0)) - label
      for (let i = 0; i < weights.length; i++) gradient[i] += error * x[i]
    }
    for (let i = 0; i < weights.length; i++) weights[i] -= .4 * (gradient[i] / rows.length + .005 * weights[i])
  }
  return weights
}

export const defaultModel = train([
  [235, 111, 42, 1], [180, 76, 31, 1], [251, 150, 67, 1], [127, 55, 26, 1],
  [163, 153, 142, 0], [103, 104, 97, 0], [223, 220, 207, 0], [78, 79, 80, 0],
])

// Patch ratios labelled at 0.5 seconds in the two supplied phone clips.
const bottleModel = fit([
  ...[.05, .322, .445, .438, .303, .215, .344, .306].map(ratio => ({ x: [1, 4 * ratio - 2], label: 1 })),
  ...[1.007, .890, .894, .947, 1.038, 1.006, .920, 1.042].map(ratio => ({ x: [1, 4 * ratio - 2], label: 0 })),
])

function bottleScores(frame: PixelFrame) {
  const luma = new Float32Array(WIDTH * HEIGHT)
  let total = 0
  let count = 0
  for (let p = 0; p < luma.length; p++) {
    const i = p * 4
    luma[p] = .2126 * frame.data[i] + .7152 * frame.data[i + 1] + .0722 * frame.data[i + 2]
    const x = p % WIDTH, y = Math.floor(p / WIDTH)
    if (x >= 65 && x < 127 && y >= 30 && y < 101) {
      total += luma[p]
      count++
    }
  }
  const reference = Math.max(1, total / count)
  return (p: number) => {
    let patch = 0
    for (const row of [p - WIDTH, p, p + WIDTH]) patch += luma[row - 1] + luma[row] + luma[row + 1]
    return bottleModel[0] + bottleModel[1] * (4 * patch / (9 * reference) - 2)
  }
}

export function takeSamples(frame: PixelFrame, label: number): Sample[] {
  const samples: Sample[] = []
  for (let y = 49; y < 59; y++) {
    for (let x = 91; x < 101; x++) {
      const i = (y * WIDTH + x) * 4
      samples.push([frame.data[i], frame.data[i + 1], frame.data[i + 2], label])
    }
  }
  return samples
}

export function detect(frame: PixelFrame, weights: number[], profile: Profile = 'foam'): Box | null {
  const scoreBottle = profile === 'bottle' ? bottleScores(frame) : null
  const mask = new Uint8Array(WIDTH * HEIGHT)
  for (let y = Math.ceil(HEIGHT * .28); y < HEIGHT * .94; y++) {
    const half = corridor(y / HEIGHT)
    for (let x = Math.ceil(WIDTH * (.5 - half)); x < WIDTH * (.5 + half); x++) {
      const p = y * WIDTH + x
      if (scoreBottle) {
        if (scoreBottle(p) > .75) mask[p] = 1
      } else {
        const i = p * 4
        const [, a, b] = features(frame.data[i], frame.data[i + 1], frame.data[i + 2])
        if (weights[0] + weights[1] * a + weights[2] * b > .75) mask[p] = 1
      }
    }
  }
  let best: Box | null = null
  let largest = 0
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const stack = [p]
    mask[p] = 0
    let left = WIDTH, right = 0, top = HEIGHT, bottom = 0, size = 0
    while (stack.length) {
      const next = stack.pop()!
      const x = next % WIDTH, y = Math.floor(next / WIDTH)
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
      size++
      for (const neighbor of [next - 1, next + 1, next - WIDTH, next + WIDTH]) {
        if (!mask[neighbor]) continue
        mask[neighbor] = 0
        stack.push(neighbor)
      }
    }
    const w = right - left + 1, h = bottom - top + 1
    if (size >= 32 && w >= 6 && h >= 3 && size > largest) {
      largest = size
      best = { x: left / WIDTH, y: top / HEIGHT, w: w / WIDTH, h: h / HEIGHT }
    }
  }
  return best
}

export class Encounter {
  private hits = 0
  private misses = 0
  private alerted = false

  update(found: boolean) {
    this.hits = found ? this.hits + 1 : 0
    this.misses = found ? 0 : this.misses + 1
    if (this.misses >= 5) this.alerted = false
    if (this.hits < 3 || this.alerted) return false
    this.alerted = true
    return true
  }
}
