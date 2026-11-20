import { Asset } from 'expo-asset'
import { requireOptionalNativeModule } from 'expo'
import { fromByteArray, toByteArray } from 'base64-js'
import { pathHazards } from './objectPath'
import { decodeYolo, makeYoloInput } from './yoloxDecode'

const detector = requireOptionalNativeModule<{ run(uri: string, input: string): Promise<string> }>('PathSignalYolo')
export const hasNativeDetector = detector != null
let model: Promise<Asset> | undefined

export async function scanYolo(frame: { data: Uint8Array; width: number; height: number }) {
  if (!detector) throw new Error('Install a PathSignal development build to use YOLOX.')
  model ??= Asset.fromModule(require('./assets/model/yolox_s.onnx')).downloadAsync().catch(error => {
    model = undefined
    throw error
  })
  const asset = await model
  if (!asset.localUri) throw new Error('YOLOX model asset is unavailable.')
  const { tensor, ratio } = makeYoloInput(frame)
  const output = toByteArray(await detector.run(asset.localUri, fromByteArray(new Uint8Array(tensor.buffer))))
  const predictions = new Float32Array(output.buffer, output.byteOffset, output.byteLength / 4)
  return pathHazards(decodeYolo(predictions, ratio, frame.width, frame.height), frame.width, frame.height, .25)
}
