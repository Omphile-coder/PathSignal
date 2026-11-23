import {decodeTargetedOutput,prepareTargetedInput,stairDirection,TARGETED_SIZE} from './targetedDetector'
import type * as Ort from 'onnxruntime-web'
declare global { interface Window {ort:typeof Ort;targetedResults:unknown} }
const button=document.querySelector<HTMLButtonElement>('button')!
const output=document.querySelector<HTMLPreElement>('pre')!
const select=document.querySelector<HTMLSelectElement>('select')!
async function floats(url:string){return new Float32Array(await (await fetch(url)).arrayBuffer())}
function compare(actual:ReturnType<typeof decodeTargetedOutput>,expected:{class:string;score:number;xyxy:number[]}[],scoreTolerance:number,pixelTolerance:number){
  if(actual.detections.length!==expected.length)return false
  const used=new Set<number>()
  return expected.every(e=>{
    const found=actual.detections.findIndex((a,i)=>!used.has(i)&&a.class===e.class&&Math.abs(a.score-e.score)<=scoreTolerance&&
      [a.bbox[0],a.bbox[1],a.bbox[0]+a.bbox[2],a.bbox[1]+a.bbox[3]].every((v,j)=>Math.abs(v-e.xyxy[j])<=pixelTolerance))
    if(found<0)return false
    used.add(found);return true
  })
}
button.onclick=async()=>{
  button.disabled=true
  try{
    const name=select.value,base='/'+name+'/'
    const metadata=await(await fetch(base+'fixtures.json')).json()
    window.ort.env.wasm.numThreads=1
    window.ort.env.wasm.wasmPaths='/runtime/'
    output.textContent='Loading experimental model locally…'
    const model=await window.ort.InferenceSession.create(base+'model.onnx',{executionProviders:['wasm']})
    const rows=[]
    for(const f of metadata.fixtures){
      output.textContent='Checking '+f.clip+'…'
      const input=await floats(base+f.id+'-input.bin'),reference=await floats(base+f.id+'-raw.bin')
      const tensor=new window.ort.Tensor('float32',input,[1,3,TARGETED_SIZE,TARGETED_SIZE])
      const start=performance.now(),result=await model.run({[model.inputNames[0]]:tensor})
      const raw=result[model.outputNames[0]]
      if(!(raw.data instanceof Float32Array))throw Error('Unexpected output type')
      let difference=0
      for(let i=0;i<reference.length;i++)difference=Math.max(difference,Math.abs(reference[i]-raw.data[i]))
      const decoded=decodeTargetedOutput(raw.data,raw.dims,f.width,f.height,metadata.classes)
      const image=new Image();image.src=base+f.id+'.png';await image.decode()
      const canvas=document.createElement('canvas');canvas.width=f.width;canvas.height=f.height
      const context=canvas.getContext('2d',{willReadFrequently:true})!
      context.drawImage(image,0,0)
      const prepared=prepareTargetedInput(context.getImageData(0,0,f.width,f.height).data,f.width,f.height)
      let inputDifference=0
      for(let i=0;i<input.length;i++)inputDifference=Math.max(inputDifference,Math.abs(input[i]-prepared.tensor[i]))
      const imageTensor=new window.ort.Tensor('float32',prepared.tensor,[1,3,TARGETED_SIZE,TARGETED_SIZE])
      const imageResults=await model.run({[model.inputNames[0]]:imageTensor})
      const imageOutput=imageResults[model.outputNames[0]]
      const imageDecoded=decodeTargetedOutput(imageOutput.data as Float32Array,imageOutput.dims,f.width,f.height,metadata.classes)
      const row={clip:f.clip,maxRawDifference:difference,maxInputDifference:inputDifference,
        rawParity:difference<.002,decoderParity:compare(decoded,f.predictions,.002,.02),
        imagePipelineParity:inputDifference<=1.01/255&&compare(imageDecoded,f.predictions,.03,5),
        detections:imageDecoded.detections,hazards:imageDecoded.hazards,spokenDirection:stairDirection(imageDecoded.hazards),milliseconds:Math.round(performance.now()-start)}
      rows.push(row)
      tensor.dispose();imageTensor.dispose();Object.values(result).forEach(t=>t.dispose());Object.values(imageResults).forEach(t=>t.dispose())
    }
    await model.release()
    const report={dataset:name,model_sha256:metadata.model_sha256,executionProvider:'wasm',
      passed:rows.every(r=>r.rawParity&&r.decoderParity&&r.imagePipelineParity),physicalIphoneTested:false,rows}
    window.targetedResults=report;output.textContent=JSON.stringify(report,null,2)
    const link=document.querySelector<HTMLAnchorElement>('#save')!
    link.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));link.hidden=false
  }catch(e){output.textContent='FAILED: '+String(e)}finally{button.disabled=false}
}
