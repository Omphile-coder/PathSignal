import type { DetectedObject } from '@tensorflow-models/coco-ssd'
import { corridor } from './vision'

const hazardClasses = new Set([
  'backpack', 'handbag', 'suitcase', 'umbrella', 'bottle', 'cup', 'bowl',
  'sports ball', 'skateboard', 'chair', 'bench', 'couch', 'bed', 'dining table',
  'potted plant', 'person', 'dog', 'cat', 'bicycle', 'motorcycle',
  'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
])

export function pathHazards(detections: DetectedObject[], width: number, height: number, threshold = .45) {
  return detections.filter(({ bbox: [x, y, w, h], class: label, score }) => {
    if (!hazardClasses.has(label) || score < threshold || w <= 0 || h <= 0) return false
    const bottom = (y + h) / height
    if (bottom < .28) return false
    const half = corridor(Math.min(.94, bottom))
    const overlap = Math.min((x + w) / width, .5 + half) - Math.max(x / width, .5 - half)
    return overlap >= Math.min(.035, (w / width) * .55)
  }).sort((a, b) => b.score - a.score)
}

