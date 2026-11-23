/** Experimental 416px YOLOv8 contract. No live app imports until evaluation. */
export const TARGETED_SIZE = 416
export const TARGETED_COUNT = 3549
export type Box = [number, number, number, number]
export type Prediction = { class: string; score: number; bbox: Box }
export type Letterbox = { scale: number; left: number; top: number; resizedWidth: number; resizedHeight: number }
export function letterbox(width: number, height: number): Letterbox {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw Error('Invalid image dimensions')
  const scale = Math.min(TARGETED_SIZE / width, TARGETED_SIZE / height)
  const resizedWidth = Math.round(width * scale), resizedHeight = Math.round(height * scale)
  return { scale, resizedWidth, resizedHeight, left: Math.max(0,Math.round((TARGETED_SIZE-resizedWidth)/2-.1)), top: Math.max(0,Math.round((TARGETED_SIZE-resizedHeight)/2-.1)) }
}
export function prepareTargetedInput(data: Uint8Array | Uint8ClampedArray, width: number, height: number) {
  const geometry = letterbox(width, height)
  if (data.length !== width * height * 4) throw Error('Invalid RGBA image')
  const plane = TARGETED_SIZE ** 2, tensor = new Float32Array(plane * 3).fill(114/255)
  const {left,top,resizedWidth:rw,resizedHeight:rh} = geometry
  for (let y=0;y<rh;y++) {
    const sy=Math.max(0,Math.min(height-1,(y+.5)*height/rh-.5)), y0=Math.floor(sy), y1=Math.min(height-1,y0+1), wy=sy-y0
    for (let x=0;x<rw;x++) {
      const sx=Math.max(0,Math.min(width-1,(x+.5)*width/rw-.5)), x0=Math.floor(sx), x1=Math.min(width-1,x0+1), wx=sx-x0
      for (let c=0;c<3;c++) {
        const a=data[(y0*width+x0)*4+c]*(1-wx)+data[(y0*width+x1)*4+c]*wx
        const b=data[(y1*width+x0)*4+c]*(1-wx)+data[(y1*width+x1)*4+c]*wx
        // OpenCV INTER_LINEAR rounds to uint8 before normalization.
        tensor[c*plane+(y+top)*TARGETED_SIZE+x+left]=Math.round(a*(1-wy)+b*wy)/255
      }
    }
  }
  return {tensor,geometry}
}
export function inCorridor([x,y,w,h]:Box,width:number,height:number) {
  const bottom=(y+h)/height
  if(bottom<.28)return false
  const half=.15+(Math.min(.94,bottom)-.28)*.24
  return Math.min((x+w)/width,.5+half)-Math.max(x/width,.5-half)>=Math.min(.035,w/width*.55)
}
export function decodeTargetedOutput(output: Float32Array,dims:readonly number[],width:number,height:number,classes:readonly string[]) {
  const g=letterbox(width,height),count=TARGETED_COUNT
  if (!classes.length || dims.length!==3 || dims[0]!==1 || dims[1]!==4+classes.length || dims[2]!==count || output.length!==(4+classes.length)*count) throw Error('Unexpected targeted model output')
  const candidates:Prediction[]=[]
  for(let i=0;i<count;i++) {
    let ci=0,score=-Infinity
    for(let c=0;c<classes.length;c++){const v=output[(4+c)*count+i];if(v>score){score=v;ci=c}}
    if(!Number.isFinite(score)||score<.4||score>1)continue
    const cx=output[i],cy=output[count+i],w=output[2*count+i],h=output[3*count+i]
    if(![cx,cy,w,h].every(Number.isFinite)||w<=0||h<=0)continue
    const l=(cx-w/2-g.left)/g.scale,t=(cy-h/2-g.top)/g.scale
    const r=(cx+w/2-g.left)/g.scale,b=(cy+h/2-g.top)/g.scale
    if(r>l&&b>t)candidates.push({class:classes[ci],score,bbox:[l,t,r-l,b-t]})
  }
  candidates.sort((a,b)=>b.score-a.score)
  const selected:Prediction[]=[]
  for(const p of candidates.slice(0,30000)) {
    const [x,y,w,h]=p.bbox
    if(selected.some(q=>{
      if(q.class!==p.class)return false
      const [u,v,a,b]=q.bbox
      const intersection=Math.max(0,Math.min(x+w,u+a)-Math.max(x,u))*Math.max(0,Math.min(y+h,v+b)-Math.max(y,v))
      return intersection/Math.max(1e-9,w*h+a*b-intersection)>.3
    }))continue
    selected.push(p);if(selected.length>=300)break
  }
  // Ultralytics suppresses before clipping to the source-image bounds.
  const detections:Prediction[]=selected.map(p=>{
    const [x,y,w,h]=p.bbox,l=Math.max(0,x),t=Math.max(0,y),r=Math.min(width,x+w),b=Math.min(height,y+h)
    return {...p,bbox:[l,t,r-l,b-t] as Box}
  }).filter(p=>p.bbox[2]>0&&p.bbox[3]>0)
  return {detections,hazards:detections.filter(p=>inCorridor(p.bbox,width,height))}
}
export function stairDirection(hazards:Prediction[]) {
  const ranked=hazards.filter(p=>p.class==='upstairs'||p.class==='downstairs').sort((a,b)=>b.score-a.score)
  if(!ranked.length||ranked[0].score<.6)return null
  const competing=Math.max(0,...ranked.filter(p=>p.class!==ranked[0].class).map(p=>p.score))
  return ranked[0].score-competing>=.15?ranked[0].class:null
}
