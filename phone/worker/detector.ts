import { decodeYolo, makeYoloInput, YOLOX_SIZE } from '../yoloxDecode'
import { pathHazards } from '../objectPath'
import { prepareStairInput, decodeStairOutput, STAIR_SIZE, STAIR_MODEL } from '../stairDetector'
import { prepareRodInput, decodeRodOutput, rodPathHazards, ROD_SIZE, ROD_MODEL } from '../rodDetector'
import { FOOTPATH_MODEL_BASE_URL, FOOTPATH_MODEL, FOOTPATH_SIZE, prepareFootpathInput, decodeFootpathOutput } from '../../presentation-site/src/footpath'
import { fetchFootpathGraph, fetchFootpathManifest, fetchFootpathWeights } from '../../presentation-site/src/footpathModel'
import { decodeWallReading, prepareWallInput, WALL_IMAGE_SIZE, WALL_MODEL } from '../wallDistance'
import { DEPTH_SIZE, OBJECT_SIZE, nearestHazard, prepareDepthInput } from '../nearestHazard'
import type * as Ort from 'onnxruntime-web'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void }
    PATHSIGNAL_MODEL: { model: string; wasm: string; engine: string; mode: 'objects' | 'stairs' | 'rod' | 'footpath' | 'wall' | 'dual' }
    ort: typeof Ort
  }
}
const send = (message: object) => window.ReactNativeWebView?.postMessage(JSON.stringify(message))
const ort = window.ort
const stairs = window.PATHSIGNAL_MODEL.mode === 'stairs'
const rod = window.PATHSIGNAL_MODEL.mode === 'rod'
const footpath = window.PATHSIGNAL_MODEL.mode === 'footpath'
const wall = window.PATHSIGNAL_MODEL.mode === 'wall'
const dual = window.PATHSIGNAL_MODEL.mode === 'dual'
const modelName = dual ? 'YOLOv8n and Depth Anything V2' : stairs ? STAIR_MODEL : rod ? ROD_MODEL : footpath ? FOOTPATH_MODEL : wall ? WALL_MODEL : 'YOLOX-S'
let model: Ort.InferenceSession
let depthModel: Ort.InferenceSession
let busy = false
let lastId = 0

function bytes(encoded: string) {
  const binary = atob(encoded)
  const decoded = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) decoded[i] = binary.charCodeAt(i)
  return decoded
}

async function loadLocalModel(file: string) {
  const url = new URL(file, window.location.href)
  let bytes: ArrayBuffer
  if (url.protocol === 'file:') {
    bytes = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('GET', url.href)
      request.responseType = 'arraybuffer'
      request.onload = () => {
        if (request.response?.byteLength) resolve(request.response)
        else reject(Error('Bundled model file is empty: ' + file))
      }
      request.onerror = () => reject(Error('Could not read bundled model: ' + file))
      request.send()
    })
  } else {
    const response = await fetch(url)
    if (!response.ok) throw Error(`Could not load ${file} from the PC (HTTP ${response.status}).`)
    bytes = await response.arrayBuffer()
  }
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
}

async function initialise() {
  let engineUrl: string | undefined
  try {
    send({ type: 'progress', text: 'Preparing ' + modelName })
    const data = window.PATHSIGNAL_MODEL
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmBinary = bytes(data.wasm)
    data.wasm = ''
    engineUrl = URL.createObjectURL(new Blob([data.engine], { type: 'text/javascript' }))
    ort.env.wasm.wasmPaths = { mjs: engineUrl }
    data.engine = ''
    send({ type: 'progress', text: 'Loading ' + modelName })
    if (footpath) {
      const baseUrl = window.location.pathname === '/pathsignal-dev/footpath/detector.html'
        ? new URL('.', window.location.href).href : FOOTPATH_MODEL_BASE_URL
      const manifest = await fetchFootpathManifest(baseUrl)
      const total = manifest.graph.bytes + manifest.weights_bytes
      const [graph, externalData] = await Promise.all([
        fetchFootpathGraph(baseUrl, manifest),
        fetchFootpathWeights(baseUrl, manifest, (loaded, all) => send({ type: 'progress', text: `Downloading footpath model · ${Math.round(loaded / all * 100)}%` })),
      ])
      send({ type: 'progress', text: `Loading ${Math.round(total / 1024 / 1024)} MiB footpath model` })
      model = await ort.InferenceSession.create(graph, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', externalData })
    } else if (wall) {
      model = await loadLocalModel('segformer-b2.onnx')
    } else if (dual) {
      send({ type: 'progress', text: 'Loading object detector' })
      model = await loadLocalModel('objects.onnx')
      send({ type: 'progress', text: 'Loading depth estimator' })
      depthModel = await loadLocalModel('depth.onnx')
    } else {
      const modelBytes = bytes(data.model)
      data.model = ''
      model = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      send({ type: 'progress', text: 'Preparing first scan' })
      const size = stairs ? STAIR_SIZE : rod ? ROD_SIZE : YOLOX_SIZE
      const warmup = new ort.Tensor('float32', new Float32Array(3 * size ** 2).fill(stairs || rod ? 0 : 114), [1, 3, size, size])
      try {
        const results = await model.run({ [model.inputNames[0]]: warmup })
        Object.values(results).forEach(tensor => tensor.dispose())
      } finally {
        warmup.dispose()
      }
    }
    // Footpath inference starts with the user's first photo.
    send({ type: 'ready', backend: 'wasm', model: modelName })
  } catch (error) {
    send({ type: 'failed', error: error instanceof Error ? error.message : String(error) })
  } finally {
    if (engineUrl) URL.revokeObjectURL(engineUrl)
  }
}

async function scanPair(context: CanvasRenderingContext2D, image: HTMLImageElement, pixels: ImageData) {
  const { width, height } = pixels
  const prepared = prepareRodInput(new Uint8Array(pixels.data.buffer), width, height, OBJECT_SIZE)
  const input = new ort.Tensor('float32', prepared.tensor, [1, 3, OBJECT_SIZE, OBJECT_SIZE])
  let detections
  try {
    const results = await model.run({ [model.inputNames[0]]: input })
    try {
      const output = results[model.outputNames[0]]
      if (!(output.data instanceof Float32Array)) throw Error('Object predictions unavailable')
      detections = rodPathHazards(decodeRodOutput(output.data, output.dims, width, height, prepared),
        width, height)
    } finally {
      Object.values(results).forEach(output => output.dispose())
    }
  } finally {
    input.dispose()
  }

  context.canvas.width = context.canvas.height = DEPTH_SIZE
  context.drawImage(image, 0, 0, DEPTH_SIZE, DEPTH_SIZE)
  const rgba = context.getImageData(0, 0, DEPTH_SIZE, DEPTH_SIZE)
  const depthInput = new ort.Tensor('float32', prepareDepthInput(rgba.data), [1, 3, DEPTH_SIZE, DEPTH_SIZE])
  try {
    const results = await depthModel.run({ [depthModel.inputNames[0]]: depthInput })
    try {
      const output = results[depthModel.outputNames[0]].data
      if (!(output instanceof Float32Array)) throw Error('Depth prediction unavailable')
      return nearestHazard(detections, output, width, height)
    } finally {
      Object.values(results).forEach(output => output.dispose())
    }
  } finally {
    depthInput.dispose()
  }
}

async function receive(event: MessageEvent) {
  let input: { id: number; jpeg: string }
  try { input = JSON.parse(event.data) } catch { return }
  if (!input || !Number.isSafeInteger(input.id) || input.id <= lastId || typeof input.jpeg !== 'string') return
  if (busy || !model) return
  busy = true
  lastId = input.id
  const start = performance.now()
  let tensor: Ort.Tensor | undefined
  let results: Ort.InferenceSession.OnnxValueMapType | undefined
  try {
    send({ type: 'progress', id: input.id, text: 'Reading camera image' })
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(Error('Camera JPEG could not open'))
      image.src = 'data:image/jpeg;base64,' + input.jpeg
    })
    const canvas = document.createElement('canvas')
    canvas.width = wall ? WALL_IMAGE_SIZE : image.naturalWidth
    canvas.height = wall ? WALL_IMAGE_SIZE : image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw Error('Image processing canvas unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height)
    if (dual) {
      send({ type: 'progress', id: input.id, text: 'Checking objects and depth' })
      const nearest = await scanPair(context, image, rgba)
      send({ type: 'result', id: input.id, nearest, milliseconds: Math.round(performance.now() - start), model: modelName })
      canvas.width = canvas.height = 0
      return
    }
    const frame = { data: new Uint8Array(rgba.data.buffer), width: rgba.width, height: rgba.height }
    const prepared = wall ? { tensor: prepareWallInput(rgba.data) }
      : stairs ? { tensor: prepareStairInput(frame.data, frame.width, frame.height), ratio: 1 }
      : rod ? prepareRodInput(frame.data, frame.width, frame.height)
        : footpath ? { tensor: prepareFootpathInput(frame.data, frame.width, frame.height) } : makeYoloInput(frame)
    const size = wall ? WALL_IMAGE_SIZE : stairs ? STAIR_SIZE : rod ? ROD_SIZE : footpath ? FOOTPATH_SIZE : YOLOX_SIZE
    tensor = new ort.Tensor('float32', prepared.tensor, [1, 3, size, size])
    send({ type: 'progress', id: input.id, text: footpath ? 'Analysing paving on this phone…' : 'Detecting with ' + modelName })
    results = await model.run({ [model.inputNames[0]]: tensor })
    const output = results[model.outputNames[0]]?.data
    if (!(output instanceof Float32Array)) throw Error('Object predictions unavailable')
    const prediction = results[model.outputNames[0]]
    if (wall) {
      const reading = decodeWallReading(output, prediction.dims, { width: image.naturalWidth, height: image.naturalHeight })
      send({ type: 'result', id: input.id, wall: reading, hazards: [], seen: [],
        milliseconds: Math.round(performance.now() - start), model: modelName })
      canvas.width = canvas.height = 0
      return
    }
    const stairResult = stairs ? decodeStairOutput(output, prediction.dims, canvas.width, canvas.height) : null
    const footpathResult = footpath ? decodeFootpathOutput(output, prediction.dims, canvas.width, canvas.height) : null
    const all = footpathResult?.detections ?? stairResult?.detections ?? (rod
      ? decodeRodOutput(output, prediction.dims, canvas.width, canvas.height, prepared as ReturnType<typeof prepareRodInput>)
      : decodeYolo(output, (prepared as ReturnType<typeof makeYoloInput>).ratio, canvas.width, canvas.height))
    const hazards = footpathResult?.hazards ?? stairResult?.hazards ?? (rod ? rodPathHazards(all, canvas.width, canvas.height) : pathHazards(all, canvas.width, canvas.height, .25))
    send({ type: 'result', id: input.id, hazards, seen: [...new Set(all.map(item => item.class))],
      milliseconds: Math.round(performance.now() - start), model: modelName })
    image.src = ''
    canvas.width = canvas.height = 0
  } catch (error) {
    send({ type: 'error', id: input.id, error: error instanceof Error ? error.message : String(error) })
  } finally {
    tensor?.dispose()
    if (results) Object.values(results).forEach(output => output.dispose())
    busy = false
  }
}
window.addEventListener('message', receive)
document.addEventListener('message', event => {
  if ('data' in event) void receive(event as MessageEvent)
})
void initialise()
