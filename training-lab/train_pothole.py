"""CPU transfer training on public pothole boxes, with untouched local evaluation."""
import json
import os
import time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('YOLO_CONFIG_DIR',str(ROOT/'cache'/'ultralytics'))
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'cache'/'matplotlib'))
os.environ.setdefault('YOLO_AUTOINSTALL','false')
os.environ.setdefault('OMP_NUM_THREADS','4')

def main():
    import torch
    from ultralytics import YOLO, settings
    torch.set_num_threads(4)
    preferences={'sync':False,'wandb':False,'mlflow':False,'clearml':False,'comet':False,'dvc':False,'neptune':False,'raytune':False}
    settings.update({k:v for k,v in preferences.items() if k in settings})
    weights=ROOT/'weights';weights.mkdir(exist_ok=True)
    os.chdir(weights)
    model=YOLO('yolov8n.pt')
    started=time.time()
    def status(trainer):
        info={'state':'training','epoch_completed':trainer.epoch+1,'epochs_planned':15,
              'elapsed_seconds':round(time.time()-started),'metrics':{k:float(v) for k,v in trainer.metrics.items()}}
        (ROOT/'pothole-status.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    model.add_callback('on_fit_epoch_end',status)
    model.train(data=str(ROOT/'datasets'/'pothole'/'data.yaml'),epochs=15,patience=5,imgsz=320,batch=8,
                device='cpu',workers=0,seed=23,deterministic=True,amp=False,cache=False,freeze=10,
                optimizer='AdamW',lr0=.001,lrf=.1,mosaic=0,close_mosaic=0,mixup=0,copy_paste=0,
                degrees=0,translate=.05,scale=.2,fliplr=.5,hsv_s=.3,hsv_v=.2,
                project=str(ROOT/'runs'),name='pothole',exist_ok=False,plots=True,verbose=False)
    checkpoint=Path(model.trainer.best)
    best=YOLO(str(checkpoint))
    # Report standard benchmark metrics separately from the fixed-threshold local checks.
    test=best.val(data=str(ROOT/'datasets'/'pothole'/'data.yaml'),split='test',imgsz=320,batch=8,
                  device='cpu',workers=0,conf=.001,project=str(ROOT/'runs'),name='pothole-public-test',plots=True)
    exported=best.export(format='onnx',imgsz=320,opset=17,simplify=False,dynamic=False,nms=False,device='cpu')
    result={'state':'complete','checkpoint':str(checkpoint),'onnx':str(exported),
            'elapsed_seconds':round(time.time()-started),'public_test_metrics':{k:float(v) for k,v in test.results_dict.items()},
            'model_selection':'best checkpoint on public validation only','public_test_used_for_tuning':False,
            'local_clips_used_for_training':False,'app_updated':False}
    (ROOT/'runs'/'pothole-training-summary.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    (ROOT/'pothole-status.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2),flush=True)

if __name__=='__main__':main()
