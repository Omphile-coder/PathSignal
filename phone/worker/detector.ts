import { decodeYolo, makeYoloInput, YOLOX_SIZE } from '../yoloxDecode'
import { pathHazards } from '../objectPath'
import type * as Ort from 'onnxruntime-web'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void }
    PATHSIGNAL_MODEL: { model: string; wasm: string; engine: string }
    ort: typeof Ort
  }
}
const send = (message: object) => window.ReactNativeWebView?.postMessage(JSON.stringify(message))
const ort = window.ort
let model: Ort.InferenceSession
let busy = false
let lastId = 0

function bytes(encoded: string) {
  const binary = atob(encoded)
  const decoded = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) decoded[i] = binary.charCodeAt(i)
  return decoded
}

async function initialise() {
  let engineUrl: string | undefined
  try {
    send({ type: 'progress', text: 'Preparing YOLOX-S' })
    const data = window.PATHSIGNAL_MODEL
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmBinary = bytes(data.wasm)
    data.wasm = ''
    engineUrl = URL.createObjectURL(new Blob([data.engine], { type: 'text/javascript' }))
    ort.env.wasm.wasmPaths = { mjs: engineUrl }
    data.engine = ''
    send({ type: 'progress', text: 'Loading YOLOX-S object model' })
    const modelBytes = bytes(data.model)
    data.model = ''
    model = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    send({ type: 'progress', text: 'Preparing first scan' })
    const warmup = new ort.Tensor('float32', new Float32Array(3 * YOLOX_SIZE ** 2).fill(114),
      [1, 3, YOLOX_SIZE, YOLOX_SIZE])
    const results = await model.run({ [model.inputNames[0]]: warmup })
    warmup.dispose()
    Object.values(results).forEach(tensor => tensor.dispose())
    send({ type: 'ready', backend: 'wasm', model: 'YOLOX-S' })
  } catch (error) {
    send({ type: 'failed', error: error instanceof Error ? error.message : String(error) })
  } finally {
    if (engineUrl) URL.revokeObjectURL(engineUrl)
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
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw Error('Image processing canvas unavailable')
    context.drawImage(image, 0, 0)
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height)
    const prepared = makeYoloInput({ data: new Uint8Array(rgba.data.buffer), width: rgba.width, height: rgba.height })
    tensor = new ort.Tensor('float32', prepared.tensor, [1, 3, YOLOX_SIZE, YOLOX_SIZE])
    send({ type: 'progress', id: input.id, text: 'Detecting objects with YOLOX-S' })
    results = await model.run({ [model.inputNames[0]]: tensor })
    const output = results[model.outputNames[0]]?.data
    if (!(output instanceof Float32Array)) throw Error('Object predictions unavailable')
    const all = decodeYolo(output, prepared.ratio, canvas.width, canvas.height)
    const hazards = pathHazards(all, canvas.width, canvas.height, .25)
    send({ type: 'result', id: input.id, hazards, seen: [...new Set(all.map(item => item.class))],
      milliseconds: Math.round(performance.now() - start), model: 'YOLOX-S' })
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
document.addEventListener('message', receive as EventListener)
void initialise()
