import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs'
const root=dirname(fileURLToPath(import.meta.url))
const require=createRequire(join(root,'../presentation-site/package.json'))
const {build}=require('esbuild')
const out=join(root,'cache/browser-targeted');mkdirSync(join(out,'runtime'),{recursive:true})
const runtime=join(root,'../presentation-site/node_modules/onnxruntime-web/dist')
for(const f of ['ort.wasm.min.js','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])copyFileSync(join(runtime,f),join(out,'runtime',f))
await build({entryPoints:[join(root,'browser-targeted.ts')],outfile:join(out,'check.js'),bundle:true,format:'iife',platform:'browser',target:'safari16'})
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PathSignal internal model verification</title>
<style>body{background:#fff1cf;color:#242235;font:18px system-ui;padding:28px;max-width:1100px;margin:auto}h1{font-size:38px}button,select,a{font:inherit;border:3px solid #242235;padding:12px;border-radius:8px;background:#c7a7f9;color:#242235;box-shadow:4px 4px #242235;margin:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;border:3px solid #242235;padding:20px;border-radius:8px}button:disabled{opacity:.6}a[hidden]{display:none}</style>
<h1>PathSignal · Model verification</h1><p>Internal development check using recorded frames. This does not run the camera or establish walking performance.</p>
<label for="dataset">Experimental candidate</label><select id="dataset"><option value="stairs-v1">Stair direction</option><option value="missing-tile-v2">Missing pavers</option></select>
<button>Run browser checks</button><a id="save" download="targeted-browser-results.json" hidden>Save results</a><pre aria-live="polite">Ready. Models must finish training and fixture preparation first.</pre>
<script src="/runtime/ort.wasm.min.js"></script><script src="/check.js"></script></html>`)
console.log('Built local browser verification harness. No live app was changed.')
