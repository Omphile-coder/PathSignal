import { Asset } from 'expo-asset'
import { Directory, File, Paths } from 'expo-file-system'

export async function prepareBundledDetector() {
  const files = [
    ['detector.html', Asset.fromModule(require('./assets/model/dual-detector.html'))],
    ['objects.onnx', Asset.fromModule(require('./assets/model/dual/objects.onnx'))],
    ['depth.onnx', Asset.fromModule(require('./assets/model/dual/depth.onnx'))],
  ] as const
  const fingerprint = files.map(([, asset]) => asset.hash).join('-')
  const directory = new Directory(Paths.cache, 'pathsignal-' + fingerprint)
  directory.create({ intermediates: true, idempotent: true })
  for (const [name, asset] of files) {
    const target = new File(directory, name)
    if (target.exists) continue
    await asset.downloadAsync()
    if (!asset.localUri) throw Error('Bundled model file unavailable: ' + name)
    const temporary = new File(directory, name + '.tmp')
    await new File(asset.localUri).copy(temporary, { overwrite: true })
    await temporary.move(target, { overwrite: true })
  }
  return new File(directory, 'detector.html').uri
}
