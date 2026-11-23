"""Evaluate the existing generic stair gate on new local frames; no model tuning."""
import json
import sys
import time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'model-comparison'))
from evaluate_models import tensor_for, decode
import onnxruntime as ort
from PIL import Image

def main():
    artifact=ROOT.parent/'model-comparison'/'artifacts'/'obstacle-detection-n3eec--1'
    pp=json.loads((artifact/'environment.json').read_text())['PREPROCESSING']
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
    session=ort.InferenceSession(str(artifact/'weights.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
    direction=json.loads((ROOT/'datasets'/'direction'/'manifest.json').read_text())['images']
    samples=[dict(r,expected_stairs=True) for r in direction]
    local=ROOT.parent/'stair-direction'/'2026-11-23'
    for sub in ('potholes','intact-ground'):
        data=json.loads((local/sub/'manifest.json').read_text())
        for clip in data['clips']:
            for f in clip['frames']:
                samples.append({'image':str(local/sub/f['labelled_path']),'clip':clip['clip_id'],
                                'split':'local_domain_check','class':f['label'],'expected_stairs':False})
    rows=[]
    for row in samples:
        with Image.open(row['image']) as image:
            tensor,rgb=tensor_for(image,pp)
        start=time.perf_counter();output=session.run(None,{session.get_inputs()[0].name:tensor})[0]
        detections=decode(output,'yolov8n',['stairs'],rgb.size,(640,640))
        alert=any(d['in_image_space_corridor'] for d in detections)
        rows.append(dict(row,stair_alert=alert,detections=detections,milliseconds=round((time.perf_counter()-start)*1000,1)))
        print(row['clip'],alert,flush=True)
    report={'model':'current YOLOv8n generic stairs','confidence':.4,'nms_iou':.3,'rows':rows,
            'stair_frames':sum(r['expected_stairs'] for r in rows),
            'stair_frames_alerted':sum(r['expected_stairs'] and r['stair_alert'] for r in rows),
            'nonstair_frames':sum(not r['expected_stairs'] for r in rows),
            'nonstair_frames_alerted':sum(not r['expected_stairs'] and r['stair_alert'] for r in rows),
            'counts_are_correlated_frames':True,'app_updated':False}
    dest=ROOT/'runs';dest.mkdir(exist_ok=True)
    (dest/'existing-stair-gate.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2),flush=True)

if __name__=='__main__':main()
