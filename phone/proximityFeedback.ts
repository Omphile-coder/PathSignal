import type { Bearing, Hazard } from './nearestHazard'

type Zone = 'awareness' | 'approach' | 'immediate'
export const MAX_READING_AGE_MS = 4000
// The camera frame is captured before JPEG processing and both models run.
// Feedback starts when that completed result reaches the phone, then expires
// if another result does not arrive. The scan itself has a 45 s timeout.
const MAX_CAPTURE_AGE_MS = 45000
const SPEECH_COOLDOWN_MS = 4000

export type Pulse = {
  bearing: Bearing
  interval: number
  speed: number
  volume: number
  vibration: number
  expiresAt: number
}

export type Encounter = {
  label: string | null
  zone: Zone | null
  misses: number
  announced: boolean
  lastSpoken: Map<string, number>
}

export function newEncounter(): Encounter {
  return { label: null, zone: null, misses: 0, announced: false, lastSpoken: new Map() }
}

function zoneAt(metres: number, previous: Zone | null): Zone | null {
  if (metres > (previous ? 3.75 : 3.5)) return null
  if (metres < (previous === 'immediate' ? 1.15 : 1)) return 'immediate'
  if (metres < (previous === 'approach' || previous === 'immediate' ? 2.7 : 2.5)) return 'approach'
  return 'awareness'
}

function pulseFor(zone: Zone, metres: number, bearing: Bearing, expiresAt: number): Pulse {
  if (zone === 'awareness') return { bearing, interval: 1000, speed: .85, volume: .35, vibration: 35, expiresAt }
  if (zone === 'approach') {
    const fraction = Math.max(0, Math.min(1, (metres - 1) / 1.5))
    return { bearing, interval: Math.round(360 + fraction * 440), speed: 1.22 - fraction * .26,
      volume: .44, vibration: 60, expiresAt }
  }
  const fraction = Math.min(1, metres)
  return { bearing, interval: Math.round(170 + fraction * 110), speed: 1.5 - fraction * .22,
    volume: .55, vibration: 105, expiresAt }
}

function shortAlert(hazard: Hazard) {
  if (hazard.source === 'barrier') return 'Possible wall ahead.'
  const label = hazard.label[0].toUpperCase() + hazard.label.slice(1)
  return hazard.bearing === 'left' || hazard.bearing === 'right'
    ? `${label} on your ${hazard.bearing}.`
    : `${label} ahead.`
}

export function updateEncounter(state: Encounter, hazard: Hazard | null, metres: number | null,
  capturedAt: number, now: number): { speech: string | null; pulse: Pulse | null } {
  const expiresAt = now + MAX_READING_AGE_MS
  const same = state.label === hazard?.label
  const distance = metres !== null && Number.isFinite(metres) && metres > 0 ? metres : null
  const zone = distance === null ? null : zoneAt(distance, same ? state.zone : null)
  if (!hazard?.label || now - capturedAt >= MAX_CAPTURE_AGE_MS || (distance !== null && !zone)) {
    if (++state.misses >= 2) {
      state.label = null
      state.zone = null
      state.announced = false
    }
    return { speech: null, pulse: null }
  }

  if (!same) state.announced = false
  state.label = hazard.label
  state.zone = zone
  state.misses = 0
  let speech = null
  if (!state.announced && now - (state.lastSpoken.get(hazard.label) ?? -Infinity) >= SPEECH_COOLDOWN_MS) {
    state.announced = true
    state.lastSpoken.set(hazard.label, now)
    speech = shortAlert(hazard)
  }
  return { speech, pulse: zone && distance !== null
    ? pulseFor(zone, distance, hazard.bearing ?? 'centre', expiresAt) : null }
}
