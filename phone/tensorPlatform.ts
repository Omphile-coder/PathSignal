import * as tf from '@tensorflow/tfjs-core'
import { Buffer } from 'buffer'

/** Hermes has neither the browser nor Node platform TFJS registers automatically. */
export function ensureTensorPlatform() {
  if (tf.env().platform) return
  tf.env().setPlatform('pathsignal-react-native', {
    fetch: (path, init) => fetch(path, init),
    now: () => performance.now(),
    encode: (text, encoding) => {
      if (encoding !== 'utf-8' && encoding !== 'utf8') throw new Error('Unsupported text encoding: ' + encoding)
      return new Uint8Array(Buffer.from(text, 'utf8'))
    },
    decode: (bytes, encoding) => {
      if (encoding !== 'utf-8' && encoding !== 'utf8') throw new Error('Unsupported text encoding: ' + encoding)
      return Buffer.from(bytes).toString('utf8')
    },
    isTypedArray: (value): value is Float32Array | Int32Array | Uint8Array | Uint8ClampedArray =>
      value instanceof Float32Array || value instanceof Int32Array ||
      value instanceof Uint8Array || value instanceof Uint8ClampedArray,
  })
}
