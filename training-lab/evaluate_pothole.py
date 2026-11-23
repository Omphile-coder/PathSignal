"""Evaluate fixed confidence/IoU on held-out public and local paving images."""
import json
import os
import time
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('YOLO_CONFIG_DIR',str(ROOT/'cache'/'ultralytics'))

def iou(a,b):
    left=max(a[0],b[0]);top=max(a[1],b[1]);right=min(a[2],b[2]);bottom=min(a[3],b[3])
    inter=max(0,right-left)*max(0,bottom-top)
    return inter/max(1e-9,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter)

def summary(rows):
    tp=sum(r['tp'] for r in rows);fp=sum(r['fp'] for r in rows);fn=sum(r['fn'] for r in rows)
    return {'frames':len(rows),'positive_frames':sum(bool(r['truth_boxes']) for r in rows),
            'positive_frames_with_any_prediction':sum(bool(r['truth_boxes']) and bool(r['predictions']) for r in rows),
            'positive_frames_with_localized_match':sum(bool(r['truth_boxes']) and r['tp']>0 for r in rows),
            'negative_frames':sum(not r['truth_boxes'] for r in rows),
            'negative_frames_alerted':sum(not r['truth_boxes'] and bool(r['predictions']) for r in rows),
            'tp_boxes':tp,'fp_boxes':fp,'fn_boxes':fn,
            'box_precision':tp/(tp+fp) if tp+fp else None,'box_recall':tp/(tp+fn) if tp+fn else None,
            'median_pipeline_ms':sorted(r['milliseconds'] for r in rows)[len(rows)//2]}

def main():
    import torch
    from ultralytics import YOLO
    from PIL import Image, ImageDraw
    torch.set_num_threads(4)
    training=json.loads((ROOT/'runs'/'pothole-training-summary.json').read_text())
    model=YOLO(training['checkpoint'])
    out=ROOT/'runs'/'pothole-evaluation';out.mkdir(exist_ok=True)
    public=json.loads((ROOT/'datasets'/'pothole'/'manifest.json').read_text())['images']
    local=json.loads((ROOT/'datasets'/'local-paving-test'/'manifest.json').read_text())['images']
    rows=[]
    for part,items in [('public_test',[r for r in public if r['split']=='test']),('local_domain_test',local)]:
        for row in items:
            with Image.open(row['image']) as im:
                w,h=im.size
            truth=row.get('boxes_xyxy')
            if truth is None:
                truth=[]
                for line in Path(row['label']).read_text().splitlines():
                    _,x,y,bw,bh=map(float,line.split());truth.append([(x-bw/2)*w,(y-bh/2)*h,(x+bw/2)*w,(y+bh/2)*h])
            start=time.perf_counter()
            result=model.predict(row['image'],imgsz=320,conf=.4,iou=.3,device='cpu',rect=False,verbose=False)[0]
            preds=[{'xyxy':b[:4].tolist(),'score':float(b[4])} for b in result.boxes.data.cpu().numpy()]
            matched=set();tp=0
            for pred in sorted(preds,key=lambda b:-b['score']):
                options=[(iou(pred['xyxy'],box),j) for j,box in enumerate(truth) if j not in matched]
                if options and max(options)[0]>=.5:matched.add(max(options)[1]);tp+=1
            record={'image':row['image'],'partition':part,'clip':row.get('clip'),'truth_boxes':truth,'predictions':preds,
                    'tp':tp,'fp':len(preds)-tp,'fn':len(truth)-tp,'milliseconds':round((time.perf_counter()-start)*1000,1)}
            rows.append(record)
            if part=='local_domain_test':
                with Image.open(row['image']) as im:
                    draw=ImageDraw.Draw(im)
                    for b in truth:draw.rectangle(b,outline='#00aa55',width=4)
                    for b in preds:draw.rectangle(b['xyxy'],outline='#ff3030',width=3)
                    im.save(out/Path(row['image']).name,quality=90)
    byclip={}
    for row in [r for r in rows if r['partition']=='local_domain_test']:
        byclip.setdefault(row['clip'],[]).append(row)
    report={'model':training['checkpoint'],'confidence':.4,'nms_iou':.3,'matching_iou':.5,
            'public_test':summary([r for r in rows if r['partition']=='public_test']),
            'local_domain_test':summary([r for r in rows if r['partition']=='local_domain_test']),
            'per_local_clip':{k:summary(v) for k,v in byclip.items()},'rows':rows,
            'local_reference_boxes_are_single_assistant_annotations':True,'thresholds_fixed_before_test':True,'app_updated':False}
    # Compare PyTorch and the exported ONNX backend on five fixed examples.
    onnx_model=YOLO(training['onnx'],task='detect');parity=[]
    for row in local[::3]:
        a=model.predict(row['image'],imgsz=320,conf=.4,iou=.3,rect=False,verbose=False,device='cpu')[0].boxes.data.cpu().numpy()
        b=onnx_model.predict(row['image'],imgsz=320,conf=.4,iou=.3,rect=False,verbose=False,device='cpu')[0].boxes.data.cpu().numpy()
        parity.append({'image':row['image'],'torch_detections':len(a),'onnx_detections':len(b)})
    report['onnx_backend_count_check']=parity
    import cv2
    import numpy as np
    import onnxruntime as ort
    from ultralytics.data.augment import LetterBox
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
    session=ort.InferenceSession(training['onnx'],sess_options=options,providers=['CPUExecutionProvider'])
    raw_checks=[]
    for row in local[::3]:
        im=LetterBox(new_shape=(320,320),auto=False)(image=cv2.imread(row['image']))
        x=np.ascontiguousarray(im[:,:,::-1].transpose(2,0,1)[None],dtype=np.float32)/255
        with torch.no_grad():raw=model.model(torch.from_numpy(x))[0].cpu().numpy()
        exported=session.run(None,{session.get_inputs()[0].name:x})[0]
        difference=float(np.max(np.abs(raw-exported)))
        raw_checks.append({'image':row['image'],'output_shape':list(exported.shape),
                           'max_abs_difference':difference,'within_point002':difference<.002})
    report['onnx_raw_output_check']=raw_checks
    (out/'results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('rows','onnx_backend_count_check')},indent=2),flush=True)

if __name__=='__main__':main()
