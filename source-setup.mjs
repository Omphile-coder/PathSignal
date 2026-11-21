// Restore phone model files from the model source included in the release archive.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const base=new URL('./',import.meta.url)
const read=p=>readFileSync(new URL(p,base))
const sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=JSON.parse(read('presentation-site/source-model/manifest.json').toString())
const object=Buffer.concat(manifest.parts.map(p=>{
  const b=read('presentation-site/source-model/'+p.file)
  if(b.length!==p.bytes||sha(b)!==p.sha256)throw Error('Object model part mismatch')
  return b
}))
const stairs=read('presentation-site/source-model/stairs-yolov8n.onnx')
const stairMeta=JSON.parse(read('presentation-site/source-model/stairs-yolov8n-manifest.json').toString().replace(/^\uFEFF/,''))
if(sha(stairs)!==stairMeta.sha256)throw Error('Stair model mismatch')
mkdirSync(new URL('phone/assets/model/',base),{recursive:true})
writeFileSync(new URL('phone/assets/model/yolox_s.onnx',base),object)
writeFileSync(new URL('phone/assets/model/stairs-yolov8n.onnx',base),stairs)
console.log('Restored phone model files. See SOURCE-README.md for build commands.')
