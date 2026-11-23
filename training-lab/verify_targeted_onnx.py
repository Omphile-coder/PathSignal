"""Create private local browser fixtures and verify exported CPU graph parity."""
import argparse
import hashlib
import json
import os
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('YOLO_CONFIG_DIR',str(ROOT/'cache'/'ultralytics'))

def main(name):
    import cv2
    import numpy as np
    import onnxruntime as ort
    import torch
    from PIL import Image
    from ultralytics import YOLO
    from ultralytics.data.augment import LetterBox
    torch.set_num_threads(4)
    run=json.loads((ROOT/'runs'/f'{name}-summary.json').read_text())
    model=YOLO(run['checkpoint'])
    evaluation=json.loads((ROOT/'runs'/(name+'-evaluation')/'results.json').read_text())
    clips=['A-up','A-down','C-down','U1-up','D-down','U2-up','P1-pothole','P2-pothole','N1-intact','empty-tile','ordinary-ground']
    selected=[next(r for r in evaluation['rows'] if r.get('clip')==c) for c in clips]
    options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
    session=ort.InferenceSession(run['onnx'],sess_options=options,providers=['CPUExecutionProvider'])
    out=ROOT/'cache'/'browser-targeted'/name;out.mkdir(parents=True,exist_ok=True)
    onnx_bytes=Path(run['onnx']).read_bytes();(out/'model.onnx').write_bytes(onnx_bytes)
    checks=[];fixtures=[]
    for i,row in enumerate(selected):
        image=cv2.imread(row['image']);padded=LetterBox(new_shape=(416,416),auto=False)(image=image)
        x=np.ascontiguousarray(padded[:,:,::-1].transpose(2,0,1)[None],dtype=np.float32)/255
        with torch.no_grad():expected=model.model(torch.from_numpy(x))[0].cpu().numpy()
        actual=session.run(None,{session.get_inputs()[0].name:x})[0]
        diff=float(np.max(np.abs(expected-actual)))
        checks.append({'clip':row['clip'],'shape':list(actual.shape),'max_absolute_raw_difference':diff,'passed':diff<.002})
        x.tofile(out/f'{i}-input.bin');actual.tofile(out/f'{i}-raw.bin')
        with Image.open(row['image']) as im:
            im.convert('RGBA').save(out/f'{i}.png')
        fixtures.append({'id':i,'clip':row['clip'],'width':row['width'],'height':row['height'],'predictions':row['predictions']})
    report={'dataset':name,'model_sha256':hashlib.sha256(onnx_bytes).hexdigest(),
        'input_shape':session.get_inputs()[0].shape,'output_shape':session.get_outputs()[0].shape,
        'classes':[model.names[i] for i in range(len(model.names))],
        'checks':checks,'all_passed':all(c['passed'] for c in checks),'fixtures':fixtures,
        'physical_iphone_tested':False}
    (out/'fixtures.json').write_text(json.dumps(report,indent=2))
    (ROOT/'runs'/(name+'-evaluation')/'onnx-check.json').write_text(json.dumps({k:v for k,v in report.items() if k!='fixtures'},indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='fixtures'},indent=2))
    if not report['all_passed']:raise SystemExit('ONNX numerical check failed')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('name',choices=['stairs-v1','missing-tile-v2']);main(p.parse_args().name)
