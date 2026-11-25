export const WALL_MODEL = 'SegFormer B2'
export const WALL_IMAGE_SIZE = 512

// The fixed 42 cm iPhone calibration from the 60 and 180 cm bottle photos.
const lensHeightCm = 42
const tiltTangent = Math.tan(32.0397940819608 * Math.PI / 180)
const focalInImageHeights = 0.7562285024807895
const wallClass = 0
const floorClass = 3
const classCount = 150

export type WallReading = { distanceCm: number | null }

export function wallAlert(reading: WallReading) {
  return reading.distanceCm === null
    ? 'Possible wall ahead. Distance unavailable.'
    : `Possible wall ahead, about ${Math.round(reading.distanceCm / 10) * 10} centimetres away.`
}

export function prepareWallInput(rgba: Uint8ClampedArray) {
  const area = WALL_IMAGE_SIZE ** 2
  const output = new Float32Array(3 * area)
  const mean = [.485, .456, .406]
  const deviation = [.229, .224, .225]
  for (let channel = 0; channel < 3; channel++) {
    for (let pixel = 0; pixel < area; pixel++) {
      output[channel * area + pixel] = (rgba[pixel * 4 + channel] / 255 - mean[channel]) / deviation[channel]
    }
  }
  return output
}

function percentile(sorted: number[], fraction: number) {
  const index = (sorted.length - 1) * fraction
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

export function decodeWallReading(scores: Float32Array, dims: readonly number[], imageSize: { width: number; height: number }): WallReading | null {
  const [batch, classes, height, width] = dims
  const area = height * width
  if (dims.length !== 4 || batch !== 1 || classes !== classCount || width < 5 || height < 12 || scores.length !== classes * area) {
    throw Error('Unexpected wall model output')
  }
  const firstColumn = Math.floor(.4 * width)
  const lastColumn = Math.floor(.6 * width)
  const contacts: number[] = []
  for (let x = firstColumn; x < lastColumn; x++) {
    const column = new Uint8Array(height)
    for (let y = 0; y < height; y++) {
      const rowIndex = y * width + x
      let best = 0
      for (let cls = 1; cls < classes; cls++) {
        if (scores[cls * area + rowIndex] > scores[best * area + rowIndex]) best = cls
      }
      column[y] = best
    }
    for (let y = 4; y + 7 < height; y++) {
      if (column[y] !== floorClass) continue
      let wallAbove = 0
      let floorBelow = 0
      for (let offset = 1; offset <= 4; offset++) wallAbove += Number(column[y - offset] === wallClass)
      for (let offset = 0; offset < 8; offset++) floorBelow += Number(column[y + offset] === floorClass)
      if (wallAbove >= 3 && floorBelow >= 7) {
        contacts.push(y / height)
        break
      }
    }
  }
  if (contacts.length / (lastColumn - firstColumn) < .80) return null
  contacts.sort((a, b) => a - b)
  if (percentile(contacts, .9) - percentile(contacts, .1) > .04) return null
  const rayY = (percentile(contacts, .5) - .5) / focalInImageHeights
  const denominator = tiltTangent + rayY
  const ratio = imageSize.width / imageSize.height
  // The stills used 4:3 and 16:9 portrait crops. Test only those framings.
  if ((Math.abs(ratio - .75) > .02 && Math.abs(ratio - .5625) > .02) || denominator <= 0) {
    return { distanceCm: null }
  }
  const distanceCm = lensHeightCm * (1 - rayY * tiltTangent) / denominator
  return { distanceCm: distanceCm >= 60 && distanceCm <= 180 ? distanceCm : null }
}
