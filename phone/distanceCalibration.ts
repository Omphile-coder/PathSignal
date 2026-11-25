import { File, Paths } from 'expo-file-system'

export type DistanceCalibration = { referenceMetres: number; scale: number }

// The scale applies to this depth checkpoint and camera workflow.
const storageFile = 'pathsignal-depth252-calibration-v1.json'

function validCalibration(value: unknown): value is DistanceCalibration {
  if (typeof value !== 'object' || value === null) return false
  const { referenceMetres, scale } = value as Partial<DistanceCalibration>
  return typeof referenceMetres === 'number' && referenceMetres >= .2 && referenceMetres <= 8 &&
    typeof scale === 'number' && scale >= .2 && scale <= 5
}

export async function loadCalibration() {
  const file = new File(Paths.document, storageFile)
  if (!file.exists) return null
  const value: unknown = JSON.parse(await file.text())
  return validCalibration(value) ? value : null
}

export async function saveCalibration(value: DistanceCalibration | null) {
  if (value !== null && !validCalibration(value)) throw Error('Invalid measured calibration')
  const next = new File(Paths.document, storageFile + '.tmp')
  await next.write(JSON.stringify(value))
  await next.move(new File(Paths.document, storageFile), { overwrite: true })
}
