"""Reproducible local CPU training; never auto-promotes weights into the app."""
import argparse
import json
import os
import time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('YOLO_CONFIG_DIR',str(ROOT/'cache'/'ultralytics'))
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'cache'/'matplotlib'))
os.environ.setdefault('YOLO_AUTOINSTALL','false')
os.environ.setdefault('OMP_NUM_THREADS','4')

def main(name,epochs):
    import torch
    from ultralytics import YOLO,settings
    torch.set_num_threads(4)
    settings.update({k:False for k in ['sync','wandb','mlflow','clearml','comet','dvc','neptune','raytune'] if k in settings})
    os.chdir(ROOT/'weights')
    started=time.time()
    status_path=ROOT/f'{name}-status.json'
    model=YOLO(str(ROOT/'weights'/'yolov8n.pt'))
    def progress(trainer):
        status_path.write_text(json.dumps({'state':'training','dataset':name,
            'epoch_completed':trainer.epoch+1,'epochs_planned':epochs,
            'elapsed_seconds':round(time.time()-started),
            'metrics':{k:float(v) for k,v in trainer.metrics.items()}},indent=2))
    model.add_callback('on_fit_epoch_end',progress)
    model.train(data=str(ROOT/'datasets'/name/'data.yaml'),epochs=epochs,patience=10,imgsz=416,batch=8,
        device='cpu',workers=0,seed=2311,deterministic=True,amp=False,cache=False,
        optimizer='AdamW',lr0=.001,lrf=.1,freeze=0,mosaic=.3,close_mosaic=5,mixup=0,copy_paste=0,
        degrees=3,translate=.08,scale=.25,fliplr=.5,flipud=0,hsv_s=.3,hsv_v=.25,
        project=str(ROOT/'runs'),name=name,exist_ok=False,plots=True,verbose=False)
    checkpoint=Path(model.trainer.best)
    best=YOLO(str(checkpoint))
    result=best.val(data=str(ROOT/'datasets'/name/'data.yaml'),split='test',imgsz=416,batch=8,
        device='cpu',workers=0,conf=.001,project=str(ROOT/'runs'),name=name+'-test',plots=True)
    onnx=best.export(format='onnx',imgsz=416,opset=17,simplify=False,dynamic=False,nms=False,device='cpu')
    summary={'state':'complete','dataset':name,'checkpoint':str(checkpoint),'onnx':str(onnx),
        'elapsed_seconds':round(time.time()-started),'public_test_metrics':{k:float(v) for k,v in result.results_dict.items()},
        'selection':'Best validation checkpoint. Public test used once after selection.',
        'local_clips_used_for_training':False,'app_updated':False}
    status_path.write_text(json.dumps(summary,indent=2))
    (ROOT/'runs'/f'{name}-summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary,indent=2),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('name',choices=['stairs-v1','missing-tile-v2']);p.add_argument('--epochs',type=int,default=40)
    a=p.parse_args();main(a.name,a.epochs)
