export type DetectorMode = 'objects' | 'automatic'
export type Hazard = { class: string; score: number; bbox: [number, number, number, number] }

export const PAVING_DEV_ROUTE = '/pathsignal-dev/footpath/automatic.html'
export const BUNDLED_OBJECT_WEIGHTS_MARKER = '<!-- pathsignal-object-weights -->'
export const AUTOMATIC_MODEL = 'Everyday objects, stairs, street objects and damaged paving'

export function hazardLabel(label: string) {
  const name = label.trim().toLowerCase()
  if (name === 'teraffic barrel') return 'traffic barrel'
  if (name === 'bike') return 'bicycle'
  if (name === 'plant pot') return 'potted plant'
  return name
}

const priority = (label: string) => label === 'stairs' ? 2 : label === 'damaged paving' ? 1 : 0

export function rankAutomaticHazards(hazards: readonly Hazard[]) {
  const byLabel = new Map<string, Hazard>()
  for (const hazard of hazards) {
    const label = hazardLabel(hazard.class)
    const previous = byLabel.get(label)
    if (label && (!previous || hazard.score > previous.score)) {
      byLabel.set(label, { ...hazard, class: label })
    }
  }
  return [...byLabel.values()].sort((a, b) => priority(b.class) - priority(a.class) || b.score - a.score)
}
