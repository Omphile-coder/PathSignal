"""Offline development-frame check of downloaded YOLOv5/v8 ORT models."""
import hashlib
import json
import time
from collections import defaultdict
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps, ImageDraw
from check_access import ROOT, PROJECT, MODELS

CONFIDENCE=.4
IOU=.3
OUTPUT=ROOT/'evaluation'

def resize_float_rgb(image, width, height):
    """Float bilinear stretch with OpenCV-style half-pixel sampling, no antialiasing."""
    source=np.asarray(image,dtype=np.float32)
    sh,sw=source.shape[:2]
    xs=np.clip((np.arange(width)+.5)*sw/width-.5,0,sw-1)
    ys=np.clip((np.arange(height)+.5)*sh/height-.5,0,sh-1)
    x0=np.floor(xs).astype(int);y0=np.floor(ys).astype(int)
    x1=np.minimum(x0+1,sw-1);y1=np.minimum(y0+1,sh-1)
    wx=(xs-x0).astype(np.float32)[None,:,None]
    wy=(ys-y0).astype(np.float32)[:,None,None]
    top=source[y0[:,None],x0[None,:]]*(1-wx)+source[y0[:,None],x1[None,:]]*wx
    bottom=source[y1[:,None],x0[None,:]]*(1-wx)+source[y1[:,None],x1[None,:]]*wx
    return top*(1-wy)+bottom*wy

def tensor_for(image,preprocessing):
    pp=json.loads(preprocessing) if isinstance(preprocessing,str) else preprocessing
    unsupported=set(pp)-{'auto-orient','resize'}
    if unsupported:raise ValueError('Unimplemented preprocessing steps: '+str(unsupported))
    resize=pp['resize']
    if resize.get('format')!='Stretch to':raise ValueError('Unsupported resize format')
    rgb=ImageOps.exif_transpose(image).convert('RGB')
    data=resize_float_rgb(rgb,int(resize['width']),int(resize['height']))
    return np.ascontiguousarray((data/np.float32(255)).transpose(2,0,1)[None]),rgb

def decode(output,model_type,labels,image_size,input_size,threshold=CONFIDENCE):
    if model_type.startswith('yolov5'):
        rows=output[0]
        if rows.shape[1]!=5+len(labels):raise ValueError('Class count / YOLOv5 output mismatch')
        scores=rows[:,4,None]*rows[:,5:]
    elif model_type.startswith('yolov8'):
        rows=output[0].T
        if rows.shape[1]!=4+len(labels):raise ValueError('Class count / YOLOv8 output mismatch')
        scores=rows[:,4:]
    else:raise ValueError('Unsupported model type')
    # One best class per candidate; retain exact version-specific class ordering.
    ids=scores.argmax(axis=1);conf=scores[np.arange(len(rows)),ids]
    valid=np.flatnonzero(np.isfinite(conf)&(conf>=threshold))
    valid=valid[np.argsort(-conf[valid])][:3000]
    width,height=image_size;iw,ih=input_size
    detections=[]
    for i in valid:
        cx,cy,w,h=map(float,rows[i,:4])
        box=[max(0,(cx-w/2)*width/iw),max(0,(cy-h/2)*height/ih),min(width,(cx+w/2)*width/iw),min(height,(cy+h/2)*height/ih)]
        if not all(np.isfinite(box)) or box[2]<=box[0] or box[3]<=box[1]:continue
        cid=int(ids[i]);overlap=False
        for previous in detections:
            if previous['class_id']!=cid:continue
            a,b,c,d=previous['xyxy']
            intersection=max(0,min(c,box[2])-max(a,box[0]))*max(0,min(d,box[3])-max(b,box[1]))
            union=(c-a)*(d-b)+(box[2]-box[0])*(box[3]-box[1])-intersection
            if intersection/max(union,1e-9)>IOU:overlap=True;break
        if overlap:continue
        x,y,right,bottom=box
        by=bottom/height
        half=.15+(min(.94,by)-.28)*.24
        corridor_overlap=min(right/width,.5+half)-max(x/width,.5-half)
        in_path=by>=.28 and corridor_overlap>=min(.035,(right-x)/width*.55)
        detections.append({'class_id':cid,'class':labels[cid],'score':round(float(conf[i]),6),
                           'xyxy':box,'in_image_space_corridor':in_path})
        if len(detections)>=300:break
    return detections

def contact_sheet(model_id,rows):
    selected=[r for r in rows if Path(r['file']).stem.endswith('-0')]
    canvas=Image.new('RGB',(960,290*((len(selected)+2)//3)),'#eeeeee');draw=ImageDraw.Draw(canvas)
    for i,row in enumerate(selected):
        with Image.open(PROJECT/row['file']) as image:
            im=ImageOps.exif_transpose(image).convert('RGB');original=im.size
            im=ImageOps.contain(im,(310,235));pen=ImageDraw.Draw(im)
            for det in row['detections']:
                a,b,c,d=det['xyxy'];sx=im.width/original[0];sy=im.height/original[1]
                pen.rectangle((a*sx,b*sy,c*sx,d*sy),outline='red',width=2)
                pen.text((a*sx,b*sy),det['class']+' '+str(round(det['score'],2)),fill='red')
            x=(i%3)*320;y=(i//3)*290;canvas.paste(im,(x,y))
            draw.text((x+3,y+238),Path(row['file']).name,fill='black')
            draw.text((x+3,y+253),'Observed: '+row['observed_stair_view'][:35],fill='black')
    canvas.save(OUTPUT/(model_id.replace('/','--')+'-contact.jpg'))

def main():
    OUTPUT.mkdir(exist_ok=True)
    manifest=json.loads((ROOT/'development-manifest.json').read_text(encoding='utf-8'))
    results=[]
    for name,model_id in MODELS:
        folder=ROOT/'artifacts'/model_id.replace('/','--')
        environment=json.loads((folder/'environment.json').read_text())
        labels=json.loads((folder/'classes.json').read_text())
        artifact=json.loads((folder/'artifact.json').read_text())
        if hashlib.sha256((folder/'weights.onnx').read_bytes()).hexdigest()!=artifact['weights']['sha256']:
            raise ValueError('Artifact hash mismatch')
        options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
        session=ort.InferenceSession(str(folder/'weights.onnx'),options,providers=['CPUExecutionProvider'])
        pp=environment['PREPROCESSING'];parsed=json.loads(pp) if isinstance(pp,str) else pp
        input_size=(parsed['resize']['width'],parsed['resize']['height'])
        rows=[]
        for item in manifest['frames']:
            path=PROJECT/item['file']
            if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Frame hash mismatch')
            start=time.perf_counter()
            with Image.open(path) as image:tensor,rgb=tensor_for(image,pp)
            output=session.run([session.get_outputs()[0].name],{session.get_inputs()[0].name:tensor})[0]
            detections=decode(output,environment['MODEL_NAME'],labels,rgb.size,input_size)
            row={**item,'detections':detections,'processing_ms':round((time.perf_counter()-start)*1000),
                 'stair_labels_detected':[d['class'] for d in detections if d['class'].lower() in ('stairs','downstair','upstair')]}
            rows.append(row)
        groups=defaultdict(list)
        for row in rows:groups[row['source_clip_group']].append(row)
        summary=[]
        for group,frames in groups.items():
            expected=frames[0]['observed_stair_view']
            expected_label={'upstairs':'Upstair','downstairs':'Downstair'}.get(expected)
            summary.append({'clip_group':group,'observed_stair_view':expected,'frames':len(frames),
                            'frames_with_stair_detection':sum(bool(r['stair_labels_detected']) for r in frames),
                            'frames_with_correct_direction':sum(expected_label in r['stair_labels_detected'] for r in frames) if expected_label and expected_label in labels else None,
                            'frames_with_stair_in_corridor':sum(any(d['class'].lower() in ('stairs','downstair','upstair') and d['in_image_space_corridor'] for d in r['detections']) for r in frames),
                            'detected_labels':sorted({d['class'] for r in frames for d in r['detections']})})
        result={'name':name,'model_id':model_id,'model_type':environment['MODEL_NAME'],'classes':labels,
                'weights_sha256':artifact['weights']['sha256'],'threshold':CONFIDENCE,'nms_iou':IOU,
                'preprocessing':'EXIF transpose, RGB float bilinear stretch per environment, NCHW, divide by 255',
                'summary':summary,'rows':rows,'median_processing_ms':float(np.median([r['processing_ms'] for r in rows]))}
        (OUTPUT/(model_id.replace('/','--')+'.json')).write_text(json.dumps(result,indent=2),encoding='utf-8')
        contact_sheet(model_id,rows);results.append({k:v for k,v in result.items() if k!='rows'})
        print(json.dumps({k:v for k,v in result.items() if k in ('name','classes','summary','median_processing_ms')}),flush=True)
        del session
    report={'development_only':True,'independent_trial_count':None,'images_uploaded':False,'network_used':False,
            'note':'24 correlated frames from 8 existing clips; no held-out accuracy, warning-distance or walking-safety claim. Threshold fixed at 0.4 before evaluating. No box ground truth. Baseline segmentation coverage and box detector corridor overlap are different rules.',
            'models':results}
    (OUTPUT/'comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

if __name__=='__main__':main()
