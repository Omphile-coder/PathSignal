import type { Hazard, HazardKind } from './lidarGeometry'

/** An observed kind can alert again after two usable checks without it. */
export class LidarAlertGate {
  private present = new Map<HazardKind, number>()

  update(candidates: Hazard[]) {
    const seen = new Set(candidates.map(candidate => candidate.kind))
    const fresh = candidates.filter(candidate => !this.present.has(candidate.kind))
    for (const [kind, misses] of this.present) {
      if (seen.has(kind)) continue
      if (misses >= 1) this.present.delete(kind)
      else this.present.set(kind, misses + 1)
    }
    for (const kind of seen) this.present.set(kind, 0)
    return fresh
  }

  reset() {
    this.present.clear()
  }
}
