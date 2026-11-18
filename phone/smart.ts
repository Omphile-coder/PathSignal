import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import { load } from '@tensorflow-models/coco-ssd'
import type { ObjectDetection, DetectedObject } from '@tensorflow-models/coco-ssd'
import { corridor } from './vision'
import { ensureTensorPlatform } from './tensorPlatform'

const manifest = require('./assets/model/model.json')
const shards = [
  require('./assets/model/group1-shard1of5.bin'),
  require('./assets/model/group1-shard2of5.bin'),
  require('./assets/model/group1-shard3of5.bin'),
  require('./assets/model/group1-shard4of5.bin'),
  require('./assets/model/group1-shard5of5.bin'),
]
const modelUrl = 'pathsignal://coco-ssd'
tf.io.registerLoadRouter(url => url === modelUrl ? {
  load: async () => {
    const chunks = await Promise.all(shards.map(async moduleId => {
      const asset = await Asset.fromModule(moduleId).downloadAsync()
      if (!asset.localUri) throw new Error('Model asset unavailable')
      return new File(asset.localUri).bytes()
    }))
    const weightData = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      weightData.set(chunk, offset)
      offset += chunk.length
    }
    return {
      modelTopology: manifest.modelTopology,
      weightSpecs: manifest.weightsManifest.flatMap((group: { weights: tf.io.WeightsManifestEntry[] }) => group.weights),
      weightData: weightData.buffer,
    }
  },
} : null!)

const hazardClasses = new Set([
  'backpack', 'handbag', 'suitcase', 'umbrella', 'bottle', 'cup', 'bowl',
  'sports ball', 'skateboard', 'chair', 'bench', 'couch', 'bed', 'dining table',
  'potted plant', 'person', 'dog', 'cat', 'bicycle', 'motorcycle',
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

let loading: Promise<ObjectDetection> | undefined

export async function scanObjects(frame: { data: Uint8Array; width: number; height: number }) {
  ensureTensorPlatform()
  loading ??= (async () => {
    await tf.setBackend('cpu')
    await tf.ready()
    return load({ base: 'lite_mobilenet_v2', modelUrl })
  })().catch(error => {
    loading = undefined
    throw error
  })

  const detector = await loading
  const { data, width, height } = frame
  const rgb = new Int32Array(width * height * 3)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]
    rgb[j + 1] = data[i + 1]
    rgb[j + 2] = data[i + 2]
  }
  const pixels = tf.tensor3d(rgb, [height, width, 3], 'int32')
  try {
    return pathHazards(await detector.detect(pixels, 20, .45), width, height)
  } finally {
    pixels.dispose()
  }
}
