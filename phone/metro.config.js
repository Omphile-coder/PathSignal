const { getDefaultConfig } = require('expo/metro-config')
const { createReadStream } = require('node:fs')
const path = require('node:path')

const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('bin', 'onnx')

// Serve the development model on the same LAN port as the Expo bundle.
const modelRoot = path.resolve(__dirname, '../presentation-site/source-model/footpath-damage')
const detectorPage = path.join(__dirname, 'assets/model/footpath-detector.html')
const wallPage = path.join(__dirname, 'assets/model/wall-detector.html')
const wallModel = path.resolve(__dirname, '../calibration-review/2026-11-20/segformer-b2/model_quantized.onnx')
const dualPage = path.join(__dirname, 'assets/model/dual-detector.html')
const dualModels = path.join(__dirname, 'assets/model/dual')
const enhanceMiddleware = config.server.enhanceMiddleware
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhanceMiddleware?.(middleware, server) ?? middleware
  return (request, response, done) => {
    const route = request.url?.split('?')[0]
    const paving = route?.match(/^\/pathsignal-dev\/footpath\/(detector\.html|manifest\.json|footpath-damage-deeplabv3\.onnx|footpath-data-\d{2}\.bin)$/)?.[1]
    const wall = route?.match(/^\/pathsignal-dev\/wall\/(detector\.html|segformer-b2\.onnx)$/)?.[1]
    const dual = route?.match(/^\/pathsignal-dev\/dual\/(detector\.html|objects\.onnx|depth\.onnx)$/)?.[1]
    const asset = paving ?? wall ?? dual
    if (!asset) return next(request, response, done)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }

    const assetPath = dual ? (dual === 'detector.html' ? dualPage : path.join(dualModels, dual))
      : wall ? (wall === 'detector.html' ? wallPage : wallModel)
      : (asset === 'detector.html' ? detectorPage : path.join(modelRoot, asset))
    const file = createReadStream(assetPath)
    file.once('open', () => {
      const contentType = asset.endsWith('.html') ? 'text/html; charset=utf-8'
        : asset.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/octet-stream'
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' })
      if (request.method === 'HEAD') {
        file.destroy()
        response.end()
      } else {
        file.pipe(response)
      }
    })
    file.on('error', error => {
      if (response.headersSent) response.destroy(error)
      else response.writeHead(error.code === 'ENOENT' ? 404 : 500).end()
    })
    response.on('close', () => file.destroy())
  }
}

module.exports = config
