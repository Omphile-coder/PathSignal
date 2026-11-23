"""Compare the previously downloaded two-class stair detector without tuning."""
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'model-comparison'))
from evaluate_models import tensor_for,decode
from PIL import Image
import onnxruntime as ort

def main():
    artifact=ROOT.parent/'model-comparison'/'artifacts'/'staircase-detection-mrpt2--1'
    env=json.loads((artifact/'environment.json').read_text())
    classes=json.loads((artifact/'classes.json').read_text())
    base=json.loads((ROOT/'runs'/'existing-stair-gate.json').read_text())['rows']
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
    session=ort.InferenceSession(str(artifact/'weights.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
    mapped={'Downstair':'stairs_down','Upstair':'stairs_up'};rows=[]
    for row in base:
        with Image.open(row['image']) as im:data,image=tensor_for(im,env['PREPROCESSING'])
        output=session.run(None,{session.get_inputs()[0].name:data})[0]
        detections=decode(output,'yolov5',classes,image.size,(640,640))
        corridor=[d for d in detections if d['in_image_space_corridor']]
        pred=mapped[max(corridor,key=lambda d:d['score'])['class']] if corridor else 'no_alert'
        rows.append({'image':row['image'],'clip':row['clip'],'split':row['split'],'truth':row['class'],
                     'expected_stairs':row['expected_stairs'],'prediction':pred,'detections':detections})
    subsets={}
    for split in ('train','val','test','all_stairs','local_domain_check'):
        part=[r for r in rows if (r['expected_stairs'] if split=='all_stairs' else r['split']==split)]
        subsets[split]={'frames':len(part),'stair_alerts':sum(r['prediction']!='no_alert' for r in part),
                        'correct_direction':sum(r['prediction']==r['truth'] for r in part)}
    report={'model_id':'staircase-detection-mrpt2/1','confidence':.4,'nms_iou':.3,
            'selection_rule':'highest-score detection overlapping the existing image corridor; no threshold tuning',
            'classes':classes,'subsets':subsets,'rows':rows,'app_updated':False}
    (ROOT/'runs'/'existing-two-class-stairs.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(subsets,indent=2))

if __name__=='__main__':main()
