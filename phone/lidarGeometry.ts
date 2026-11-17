export const hazardLabels = {
  raised: 'Possible raised surface or object',
  drop: 'Possible drop-off',
  upper: 'Possible upper-body obstruction',
} as const

export type HazardKind = keyof typeof hazardLabels
export type Hazard = { kind: HazardKind; metresAhead: number }
export type CorridorResult = { hazards: Hazard[]; usableFrames: number; sampledReturns: number }
const kinds = Object.keys(hazardLabels) as HazardKind[]

function kindAt(height: number): HazardKind | undefined {
  if (height >= -65 && height <= -15) return 'drop'
  if (height >= 9 && height < 115) return 'raised'
  if (height >= 115 && height <= 210) return 'upper'
}

type Cell = { ahead: number; side: number; distances: number[] }

function nearestCluster(cells: Map<string, Cell>) {
  const occupied = new Map([...cells].filter(([, cell]) => cell.distances.length >= 3))
  let nearest = Infinity
  for (const [key, start] of occupied) {
    occupied.delete(key)
    const pending = [start]
    const distances: number[] = []
    for (let index = 0; index < pending.length; index++) {
      const cell = pending[index]
      distances.push(...cell.distances)
      for (const [a, s] of [[cell.ahead - 1, cell.side], [cell.ahead + 1, cell.side],
        [cell.ahead, cell.side - 1], [cell.ahead, cell.side + 1]]) {
        const key = a + ',' + s
        const next = occupied.get(key)
        if (next) {
          occupied.delete(key)
          pending.push(next)
        }
      }
    }
    if (distances.length >= 10) {
      distances.sort((a, b) => a - b)
      nearest = Math.min(nearest, distances[Math.floor(distances.length / 2)])
    }
  }
  return nearest
}

function scanFrame(frame: number[]) {
  const cells: Record<HazardKind, Map<string, Cell>> = {
    raised: new Map(), drop: new Map(), upper: new Map(),
  }
  let returns = 0
  for (let i = 0; i + 2 < frame.length; i += 3) {
    const ahead = frame[i], side = frame[i + 1], height = frame[i + 2]
    if (!Number.isFinite(ahead) || !Number.isFinite(side) || !Number.isFinite(height) ||
        ahead < 35 || ahead > 280 || Math.abs(side) > 45 || height < -65 || height > 210) continue
    returns++
    const kind = kindAt(height)
    if (!kind) continue
    const a = Math.floor(ahead / 20), s = Math.floor(side / 20)
    const key = a + ',' + s
    let cell = cells[kind].get(key)
    if (!cell) {
      cell = { ahead: a, side: s, distances: [] }
      cells[kind].set(key, cell)
    }
    cell.distances.push(ahead)
  }
  return { returns, distances: kinds.map(kind => nearestCluster(cells[kind])) }
}

/** Each frame is a flat list of [forward, lateral, height above reference] triples in centimetres. */
export function evaluateCorridor(frames: number[][]): CorridorResult {
  const scanned = frames.map(scanFrame)
  const usable = scanned.filter(frame => frame.returns >= 30)
  const hazards: Hazard[] = []
  if (frames.length === 3 && usable.length === 3) {
    for (const [index, kind] of kinds.entries()) {
      const distances = usable.map(frame => frame.distances[index]).sort((a, b) => a - b)
      if (Number.isFinite(distances[2]) && distances[2] - distances[0] <= 35) {
        hazards.push({ kind, metresAhead: distances[1] / 100 })
      }
    }
  }
  return {
    hazards: hazards.sort((a, b) => a.metresAhead - b.metresAhead),
    usableFrames: usable.length,
    sampledReturns: scanned.reduce((count, frame) => count + frame.returns, 0),
  }
}
