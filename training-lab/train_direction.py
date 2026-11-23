"""Train small direction heads on frozen ImageNet features; never tune on test."""
import copy
import json
import os
import random
import time
from pathlib import Path
os.environ.setdefault('TORCH_HOME', str(Path(__file__).resolve().parent/'cache'/'torch'))
import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import torch
from torch import nn
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from torchvision.transforms import functional as TF

ROOT=Path(__file__).resolve().parent
CLASSES=['stairs_down','stairs_up']

def tensor(image):
    return TF.pil_to_tensor(image.convert('RGB').resize((224,224),Image.Resampling.BILINEAR)).float()/255

class DirectionModel(nn.Module):
    def __init__(self, backbone, head):
        super().__init__();self.features=backbone.features;self.pool=backbone.avgpool;self.head=head
        self.register_buffer('mean',torch.tensor([.485,.456,.406]).reshape(1,3,1,1))
        self.register_buffer('std',torch.tensor([.229,.224,.225]).reshape(1,3,1,1))
    def embedding(self,x):
        return self.pool(self.features((x-self.mean)/self.std)).flatten(1)
    def forward(self,x):
        return self.head(self.embedding(x))

def stats(logits, rows):
    p=logits.softmax(1).numpy();truth=np.array([CLASSES.index(r['class']) for r in rows]);pred=p.argmax(1)
    confusion=[[int(((truth==i)&(pred==j)).sum()) for j in range(2)] for i in range(2)]
    accepted=p.max(1)>=.8
    return {'count':len(rows),'correct':int((pred==truth).sum()),'confusion_rows_truth_cols_prediction':confusion,
            'accepted_at_fixed_point8':int(accepted.sum()),'accepted_correct':int(((pred==truth)&accepted).sum()),
            'rows':[{'image':r['image'],'clip':r['clip'],'truth':r['class'],'prediction':CLASSES[int(pred[i])],
                     'confidence':float(p[i].max()),'direction_output':CLASSES[int(pred[i])] if accepted[i] else 'unknown'} for i,r in enumerate(rows)]}

def main():
    random.seed(23);np.random.seed(23);torch.manual_seed(23);torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    out=ROOT/'runs'/'direction';out.mkdir(parents=True,exist_ok=True)
    data=json.loads((ROOT/'datasets'/'direction'/'manifest.json').read_text())
    rows=data['images'];backbone=mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT)
    model=DirectionModel(backbone,nn.Linear(576,2)).eval()
    for p in model.features.parameters():p.requires_grad=False
    feats={};targets={};splitrows={}
    for split in ('train','val','test'):
        part=[r for r in rows if r['split']==split];images=[];labels=[]
        for row in part:
            with Image.open(row['image']) as im:
                variants=[im.copy()]
                if split=='train':variants += [ImageOps.mirror(im),ImageEnhance.Brightness(im).enhance(.8),ImageEnhance.Brightness(im).enhance(1.2)]
                for image in variants:images.append(tensor(image));labels.append(CLASSES.index(row['class']))
        with torch.no_grad():feats[split]=torch.cat([model.embedding(torch.stack(images[i:i+8])) for i in range(0,len(images),8)])
        targets[split]=torch.tensor(labels);splitrows[split]=part
    # Feature standardisation uses the training partition only.
    mean=feats['train'].mean(0);scale=feats['train'].std(0).clamp(min=.1)
    normal={k:(v-mean)/scale for k,v in feats.items()}
    candidates=[];best=None
    for decay in (.001,.01,.1):
        torch.manual_seed(23);head=nn.Linear(576,2);opt=torch.optim.AdamW(head.parameters(),lr=.01,weight_decay=decay)
        for step in range(250):
            opt.zero_grad();loss=nn.functional.cross_entropy(head(normal['train']),targets['train']);loss.backward();opt.step()
        with torch.no_grad():
            val_logits=head(normal['val']);val_loss=float(nn.functional.cross_entropy(val_logits,targets['val']))
        entry={'weight_decay':decay,'steps':250,'validation_loss':val_loss,'validation':stats(val_logits,splitrows['val'])}
        candidates.append(entry)
        if best is None or val_loss<best[0]:best=(val_loss,copy.deepcopy(head.state_dict()),decay)
    selected=nn.Linear(576,2);selected.load_state_dict(best[1])
    # Fold train-only feature scaling into a single exported linear layer.
    with torch.no_grad():
        model.head.weight.copy_(selected.weight/scale)
        model.head.bias.copy_(selected.bias-(selected.weight*mean/scale).sum(1))
    model.eval()
    results={}
    with torch.no_grad():
        for split in ('train','val','test'):
            results[split]=stats(model.head(feats[split]) if split!='train' else model.head(feats[split][::4]),splitrows[split])
    torch.save({'state_dict':model.state_dict(),'classes':CLASSES,'input':'RGB float32 [0,1], NCHW 224x224, full-frame bilinear stretch',
                'backbone':'torchvision MobileNetV3-small ImageNet1K-V1, frozen','head_steps':250,'weight_decay':best[2]},out/'direction.pt')
    report={'task':'conditional stair direction only; requires a separate positive stair gate',
            'pretrained_backbone':'MobileNetV3-small ImageNet1K-V1; frozen',
            'selected_weight_decay':best[2],'selection':'lowest validation cross-entropy; test excluded from selection',
            'fixed_abstention_threshold':.8,'candidates':candidates,'results':results,
            'counts_are_correlated_frames':True,'independent_site_identity_unverified':True,'app_updated':False}
    (out/'results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:{a:v for a,v in val.items() if a!='rows'} for k,val in results.items()},indent=2),flush=True)
    import importlib.util
    if importlib.util.find_spec('onnx'):
        torch.onnx.export(model,torch.zeros(1,3,224,224),str(out/'direction.onnx'),opset_version=17,input_names=['images'],output_names=['logits'],dynamo=False)
    else:
        print('ONNX export deferred until training environment installation completes.',flush=True)

if __name__=='__main__':main()
