"""Export the saved head without retraining and check numerical parity and gate flow."""
import json
import time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torchvision.models import mobilenet_v3_small
from PIL import Image
import onnxruntime as ort
from train_direction import DirectionModel,tensor,CLASSES
ROOT=Path(__file__).resolve().parent

def main():
    torch.set_num_threads(4)
    out=ROOT/'runs'/'direction'
    state=torch.load(out/'direction.pt',map_location='cpu',weights_only=True)
    model=DirectionModel(mobilenet_v3_small(weights=None),nn.Linear(576,2))
    model.load_state_dict(state['state_dict']);model.eval()
    torch.onnx.export(model,torch.zeros(1,3,224,224),str(out/'direction.onnx'),opset_version=17,
                      input_names=['images'],output_names=['logits'],dynamo=False)
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
    session=ort.InferenceSession(str(out/'direction.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
    gate=json.loads((ROOT/'runs'/'existing-stair-gate.json').read_text())['rows']
    checks=[]
    for row in gate:
        with Image.open(row['image']) as im:x=tensor(im).unsqueeze(0)
        start=time.perf_counter();a=session.run(None,{'images':x.numpy()})[0]
        with torch.no_grad():b=model(x).numpy()
        difference=float(np.max(np.abs(a-b)))
        assert difference<.001, difference
        probs=torch.from_numpy(a).softmax(1).numpy()[0];pred=CLASSES[int(probs.argmax())];conf=float(probs.max())
        warning=pred if row['stair_alert'] and conf>=.8 else ('generic_stairs' if row['stair_alert'] else 'no_alert')
        checks.append({'image':row['image'],'clip':row['clip'],'split':row['split'],'truth':row['class'],
                       'expected_stairs':row['expected_stairs'],'raw_prediction':pred,'confidence':conf,
                       'generic_gate_alert':row['stair_alert'],'combined_warning':warning,
                       'logit_max_abs_difference':difference,'torch_plus_ort_ms':round((time.perf_counter()-start)*1000,1)})
    summaries={}
    for split in ('train','val','test','local_domain_check'):
        rows=[r for r in checks if r['split']==split]
        summaries[split]={'frames':len(rows),'any_warning':sum(r['combined_warning']!='no_alert' for r in rows),
                          'correct_direction_warnings':sum(r['combined_warning']==r['truth'] for r in rows)}
    report={'opset':17,'input_shape':[1,3,224,224],'parity_examples':len(checks),
            'max_logit_difference':max(r['logit_max_abs_difference'] for r in checks),
            'combined_generic_gate_direction_summary':summaries,'rows':checks,
            'runtime':'ONNX Runtime CPU; does not establish browser/iPhone compatibility or latency',
            'app_updated':False}
    (out/'onnx-and-gate-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2),flush=True)

if __name__=='__main__':main()
