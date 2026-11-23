import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname,join } from 'node:path'
import { fileURLToPath,pathToFileURL } from 'node:url'
import { mkdirSync,writeFileSync } from 'node:fs'
const root=dirname(fileURLToPath(import.meta.url))
const require=createRequire(join(root,'../presentation-site/package.json'))
const {build}=require('esbuild')
mkdirSync(join(root,'cache'),{recursive:true})
const file=join(root,'cache/targeted-decoder.mjs')
await build({entryPoints:[join(root,'targetedDetector.ts')],outfile:file,bundle:true,format:'esm',platform:'browser'})
const {letterbox,prepareTargetedInput,decodeTargetedOutput,stairDirection,TARGETED_COUNT:n}=await import(pathToFileURL(file))
assert.deepEqual(letterbox(1280,720),{scale:.325,left:0,top:91,resizedWidth:416,resizedHeight:234})
assert.deepEqual(letterbox(720,1280),{scale:.325,left:91,top:0,resizedWidth:234,resizedHeight:416})
assert.throws(()=>letterbox(0,20))
const white=new Uint8Array([255,255,255,255,255,255,255,255])
const prepared=prepareTargetedInput(white,2,1)
assert.equal(prepared.tensor[104*416],1)
assert.ok(Math.abs(prepared.tensor[0]-114/255)<1e-7)
assert.equal(prepared.tensor[416**2+104*416],1)
assert.throws(()=>prepareTargetedInput(new Uint8Array(1),2,1))
const raw=new Float32Array(6*n)
// Two overlapping downstairs anchors, one upstairs anchor. Expected NMS is class-aware.
for(let i=0;i<3;i++){raw[i]=208;raw[n+i]=208;raw[2*n+i]=208;raw[3*n+i]=117}
raw[4*n]=.9;raw[4*n+1]=.8;raw[5*n+2]=.7
const decoded=decodeTargetedOutput(raw,[1,6,n],1280,720,['downstairs','upstairs'])
assert.equal(decoded.detections.length,2)
assert.deepEqual(decoded.detections[0].bbox,[320,180,640,360])
assert.equal(decoded.hazards.length,2)
assert.equal(stairDirection(decoded.hazards),'downstairs')
assert.equal(stairDirection([{class:'upstairs',score:.8,bbox:[0,0,1,1]},{class:'downstairs',score:.75,bbox:[0,0,1,1]}]),null)
assert.equal(stairDirection([{class:'upstairs',score:.59,bbox:[0,0,1,1]}]),null)
assert.throws(()=>decodeTargetedOutput(raw,[1,5,n],1280,720,['downstairs','upstairs']))
raw[4*n]=NaN;raw[4*n+1]=NaN;raw[5*n+2]=NaN
assert.equal(decodeTargetedOutput(raw,[1,6,n],1280,720,['downstairs','upstairs']).detections.length,0)
writeFileSync(join(root,'targeted-decoder-check.json'),JSON.stringify({passed:true,checks:['portrait and landscape letterbox','RGB and padding','invalid inputs','coordinate restoration','class-aware suppression','corridor','direction abstention','output shape and NaN rejection'],real_model_browser_parity:'pending'},null,2))
console.log('Targeted decoder contract checks passed; real-model browser parity is still required.')
