export const OBJECT_SIZE = 416
export const DEPTH_SIZE = 252
type Box = { class: string; score: number; bbox: [number, number, number, number] }
export type Bearing = 'left' | 'centre' | 'right'
export type Hazard = { label: string; depth: number | null; source: 'object' | 'barrier'; bearing?: Bearing }

function bearing(box: Box, width: number): Bearing {
  const centre = (box.bbox[0] + box.bbox[2] / 2) / width
  return centre < .43 ? 'left' : centre > .57 ? 'right' : 'centre'
}

export function prepareDepthInput(rgba: Uint8ClampedArray) {
  const area = DEPTH_SIZE ** 2
  const tensor = new Float32Array(3 * area)
  const mean = [.485, .456, .406], std = [.229, .224, .225]
  for (let channel = 0; channel < 3; channel++) {
    for (let i = 0; i < area; i++) tensor[channel * area + i] = (rgba[i * 4 + channel] / 255 - mean[channel]) / std[channel]
  }
  return tensor
}

function quantile(values: number[], fraction: number) {
  if (!values.length) return null
  values.sort((a, b) => a - b)
  return values[Math.floor(fraction * (values.length - 1))]
}

const validDepth = (value: number) => Number.isFinite(value) && value > .05 && value <= 20

function objectLabel(name: string) {
  if (name === 'Electrical Pole') return 'pole'
  if (name === 'Teraffic Barrel') return 'traffic barrel'
  return name.toLowerCase()
}

function frontWallDepth(point: (x: number, y: number) => number) {
  const rows = [.14, .22, .30, .38, .46, .54, .62, .70, .78, .86].map(y => {
    const across = [.22, .29, .36, .43, .50, .57, .64, .71, .78].map(x => point(x, y))
    const valid = across.every(validDepth)
    const low = quantile(across, .15)!
    const high = quantile(across, .85)!
    const spread = Math.max(high, point(.5, y)) / low
    return { depth: quantile(across, .5)!, spread, valid }
  })
  const foreground = quantile(rows.slice(-3).map(row => row.depth).filter(validDepth), .5)
  for (let start = 2; start >= 0; start--) {
    const upper = rows.slice(start, start + 4)
    if (!upper.every(row => row.valid && row.spread <= 1.18) || foreground === null) continue
    const depths = upper.map(row => row.depth)
    const wall = quantile([...depths], .5)!
    // A frontal wall can have roughly level or increasing depth before the
    // floor becomes nearer. Open ground generally gets nearer all the way down.
    if (wall <= 6 && depths[3] >= .97 * depths[0] &&
      Math.max(...depths) / Math.min(...depths) <= 1.24 && foreground <= .84 * wall) {
      return { depth: wall, fillsFrame: false }
    }
  }

  // When a nearby wall fills the frame, there may be no floor transition.
  // Require a broad, smoothly receding surface. A flat or broken depth map
  // alone can't distinguish a very close wall from a view of an empty floor.
  const surface = rows.slice(1)
  if (!surface.every(row => row.valid && row.spread <= 1.12)) return null
  const first = (surface[0].depth + surface[1].depth) / 2
  const last = (surface[7].depth + surface[8].depth) / 2
  if (last > 3.5 || last / first < 1.06 || last / first > 1.5) return null
  if (!surface.slice(1).every((row, i) => row.depth >= .965 * surface[i].depth && row.depth <= 1.14 * surface[i].depth)) return null
  return { depth: quantile(surface.map(row => row.depth), .5)!, fillsFrame: true }
}

export function nearestHazard(detections: readonly Box[], depth: Float32Array, width: number, height: number) {
  if (depth.length !== DEPTH_SIZE ** 2) throw Error('Unexpected depth map size')
  const point = (x: number, y: number) => depth[
    Math.max(0, Math.min(DEPTH_SIZE - 1, Math.floor(y * DEPTH_SIZE))) * DEPTH_SIZE +
    Math.max(0, Math.min(DEPTH_SIZE - 1, Math.floor(x * DEPTH_SIZE)))]
  let nearest: Hazard | null = null
  let unmeasured: Box | null = null
  for (const object of detections) {
    const [x, y, w, h] = object.bbox
    const values: number[] = []
    for (const v of [.34, .44, .54, .64, .74]) {
      for (const u of [.35, .43, .5, .57, .65]) {
        const reading = point((x + u * w) / width, (y + v * h) / height)
        if (validDepth(reading)) values.push(reading)
      }
    }
    if (values.length < 17) {
      if (!unmeasured || object.score > unmeasured.score) unmeasured = object
      continue
    }
    const depthM = quantile(values, .35)!
    if (nearest?.depth == null || depthM < nearest.depth) {
      nearest = { label: objectLabel(object.class), depth: depthM, source: 'object', bearing: bearing(object, width) }
    }
  }

  const wall = frontWallDepth(point)
  if (wall) {
    // A broad continuous surface can look like stairs to the detector.
    // Resolve the overlap only when the two estimates describe the same range.
    const matchStairs = wall.fillsFrame && nearest?.label === 'stairs' && nearest.depth !== null &&
      Math.abs(wall.depth - nearest.depth) <= .10 * wall.depth
    if (nearest?.depth == null || wall.depth < nearest.depth || matchStairs) {
      return { label: 'wall or wide barrier', depth: wall.depth, source: 'barrier', bearing: 'centre' } satisfies Hazard
    }
  }
  if (!nearest && unmeasured) return {
    label: objectLabel(unmeasured.class), depth: null, source: 'object', bearing: bearing(unmeasured, width),
  } satisfies Hazard
  return nearest
}

export function estimatedMetres(hazard: Hazard, scale: number | null) {
  if (scale === null || hazard.depth === null) return null
  const estimate = hazard.depth * scale
  return Number.isFinite(estimate) && estimate > 0 ? estimate : null
}

export function estimatePhrase(hazard: Hazard, scale: number | null) {
  const estimated = estimatedMetres(hazard, scale)
  const label = hazard.source === 'barrier' ? 'Possible wall or wide barrier'
    : hazard.depth === null ? `Possible ${hazard.label} ahead` : `Closest detected hazard: ${hazard.label}`
  if (estimated === null || estimated < .20 || estimated > 8) return label + '. Distance unavailable.'
  const rounded = Math.round(estimated * 10) / 10
  return label + `, about ${rounded} ${rounded === 1 ? 'metre' : 'metres'} away.`
}
