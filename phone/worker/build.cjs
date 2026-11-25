const { build } = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')
;(async () => {
  const result = await build({
    entryPoints: [path.join(__dirname,'detector.ts')], bundle: true, write: false,
    platform: 'browser', format: 'iife', minify: true, target: 'safari16',
  })
  const directory = path.join(__dirname,'../assets/model')
  const runtime = path.join(__dirname,'../node_modules/onnxruntime-web/dist')
  const requested = process.argv.slice(2)
  const available = ['objects', 'stairs', 'rod', 'footpath', 'wall', 'dual']
  if (requested.some(mode => !available.includes(mode))) throw Error('Unknown detector mode')
  for (const mode of requested.length ? requested : available) {
  const modelFile = mode === 'stairs' ? 'stairs-yolov8n.onnx' : mode === 'rod' ? 'rod-yolov8n.onnx' : 'yolox_s.onnx'
  const payload = {
    mode,
    model: ['footpath', 'wall', 'dual'].includes(mode) ? '' : fs.readFileSync(path.join(directory,modelFile)).toString('base64'),
    wasm: fs.readFileSync(path.join(runtime,'ort-wasm-simd-threaded.wasm')).toString('base64'),
    engine: fs.readFileSync(path.join(runtime,'ort-wasm-simd-threaded.mjs'),'utf8'),
  }
  const escapeScript = text => text.replaceAll('</script','<\/script')
  const ort = fs.readFileSync(path.join(runtime,'ort.wasm.min.js'),'utf8')
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; connect-src blob:' +
    (mode === 'footpath' ? " 'self' https://pathsignal-six.vercel.app" : mode === 'dual' ? " 'self' file:" : mode === 'wall' ? " 'self'" : '') +
    '; img-src data:; style-src \'unsafe-inline\'">' +
    '</head><body><script>'+escapeScript(ort)+'</script><script>window.PATHSIGNAL_MODEL='+
    JSON.stringify(payload).replaceAll('<','\u003c')+';</script><script>'+
    escapeScript(result.outputFiles[0].text)+'</script></body></html>'
  const outputName = mode === 'objects' ? 'detector.html' : mode + '-detector.html'
  fs.writeFileSync(path.join(directory,outputName),html)
  console.log('Bundled offline ' + mode + ' detector',Math.round(Buffer.byteLength(html)/1024/1024)+' MB')
  }
})().catch(error=>{console.error(error);process.exitCode=1})
