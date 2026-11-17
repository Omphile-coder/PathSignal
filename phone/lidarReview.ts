import type { CorridorResult } from './lidarGeometry'

type Core = { capturedAt: string; measuredMetres: number | null; expected: 'clear' | 'raised' | 'drop' | 'upper' | null; notes: string }
export type ReviewTrial = Core & (
  { kind: 'distance'; metres: number } |
  { kind: 'corridor'; frames: number[][]; result?: CorridorResult }
)

export function parseTrialExport(raw: string): ReviewTrial[] {
  const file: unknown = JSON.parse(raw)
  if (!file || typeof file !== 'object' || !('format' in file) || file.format !== 'pathsignal-lidar-v1' ||
      !('trials' in file) || !Array.isArray(file.trials) || file.trials.length > 500) {
    throw new Error('Choose a PathSignal LiDAR trial export with up to 500 trials.')
  }
  return file.trials.map((trial, index) => {
    if (!trial || typeof trial !== 'object' || typeof trial.capturedAt !== 'string' ||
        !Number.isFinite(Date.parse(trial.capturedAt)) || typeof trial.notes !== 'string' ||
        (trial.measuredMetres !== null && (!Number.isFinite(trial.measuredMetres) || trial.measuredMetres <= 0)) ||
        ![null, 'clear', 'raised', 'drop', 'upper'].includes(trial.expected)) {
      throw new Error('Invalid metadata for trial ' + (index + 1) + '.')
    }
    if (trial.kind === 'distance' && Number.isFinite(trial.metres) && trial.metres > 0) return trial
    if (trial.kind === 'corridor' && Array.isArray(trial.frames) && trial.frames.length === 3 &&
        trial.frames.every((frame: unknown) => Array.isArray(frame) && frame.length <= 60000 &&
          frame.length % 3 === 0 && frame.every(Number.isFinite))) return trial
    throw new Error('Invalid reading for trial ' + (index + 1) + '.')
  })
}

export function reviewTrial(trial: ReviewTrial, evaluate: (frames: number[][]) => CorridorResult) {
  const row = { time: trial.capturedAt, kind: trial.kind, expected: trial.expected, note: trial.notes }
  const error = (estimate: number | undefined) => estimate !== undefined && trial.measuredMetres !== null
    ? Number(Math.abs(estimate - trial.measuredMetres).toFixed(3)) : null
  if (trial.kind === 'distance') {
    return { ...row, measuredMetres: trial.measuredMetres, cameraDepth: trial.metres,
      absoluteErrorMetres: error(trial.metres), outcome: 'distance reading' }
  }
  const result = evaluate(trial.frames)
  const matching = result.hazards.find(hazard => hazard.kind === trial.expected)
  let outcome = 'unlabelled'
  if (result.usableFrames !== 3) outcome = 'insufficient coverage'
  else if (trial.expected === 'clear') outcome = result.hazards.length ? 'false alert' : 'no alert'
  else if (trial.expected) outcome = matching ? 'matched' : 'missed'
  return { ...row, outcome, ...result, absoluteErrorMetres: error(matching?.metresAhead),
    matchesSavedResult: trial.result ? JSON.stringify(result.hazards) === JSON.stringify(trial.result.hazards) : null }
}
