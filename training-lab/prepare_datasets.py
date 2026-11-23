"""Freeze source-group splits and convert public segmentation polygons to boxes."""
import csv
import hashlib
import json
import random
import shutil
import zipfile
from collections import Counter
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parent
LOCAL=ROOT.parent/'stair-direction'/'2026-11-23'
ARCHIVE=LOCAL/'potholes'/'kaggle-research'/'pothole-image-segmentation-dataset.zip'

def save_json(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,indent=2),encoding='utf-8')

def dhash(path):
    with Image.open(path) as im:
        a=np.asarray(im.convert('L').resize((9,8)))
    return sum(int(v)<<i for i,v in enumerate((a[:,1:]>a[:,:-1]).flatten()))

def main():
    direction=[]
    for sub,split in [('', 'train'),('outdoor-up','mixed'),('outdoor-down','mixed')]:
        folder=LOCAL/sub
        data=json.loads((folder/'manifest.json').read_text())
        for clip in data['clips']:
            group=clip['scene_group']
            part=split if split!='mixed' else ('val' if group=='brick_enclosed_daylit_flight_C' else 'test')
            for f in clip['frames']:
                label=f.get('direction_label',f.get('label'))
                assert label in ('stairs_up','stairs_down')
                path=folder/f['labelled_path']
                direction.append({'image':str(path),'class':label,'group':group,'split':part,'clip':clip['clip_id'],
                                  'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    for split in ('train','val','test'):
        assert Counter(r['class'] for r in direction if r['split']==split)['stairs_up']>0
    assert not any(a['group']==b['group'] and a['split']!=b['split'] for a in direction for b in direction)
    save_json(ROOT/'datasets'/'direction'/'manifest.json',{'classes':['stairs_down','stairs_up'],'images':direction,
       'split_policy':'original brick stairwell train; new tiled flight C validation; brick entrance steps D test. Visual scene grouping, exact site independence unverified.'})

    dest=ROOT/'datasets'/'pothole'
    public=[]
    with zipfile.ZipFile(ARCHIVE) as z:
        members=z.namelist()
        valid=sorted(n for n in members if '/valid/images/' in n and n.endswith('.jpg'))
        random.Random(23).shuffle(valid)
        assignments={n:('val' if i<30 else 'test') for i,n in enumerate(valid)}
        for name in sorted(n for n in members if '/images/' in n and n.endswith('.jpg')):
            split='train' if '/train/' in name else assignments[name]
            image_path=dest/'images'/split/Path(name).name
            image_path.parent.mkdir(parents=True,exist_ok=True)
            image_path.write_bytes(z.read(name))
            label_name=str(Path(name).with_suffix('.txt')).replace('\\','/').replace('/images/','/labels/')
            boxes=[]
            for line in z.read(label_name).decode().splitlines():
                numbers=list(map(float,line.split()))
                assert numbers[0]==0 and len(numbers)>=7 and (len(numbers)-1)%2==0
                points=np.array(numbers[1:]).reshape(-1,2)
                lo=points.min(0);hi=points.max(0)
                assert np.all(lo>=0) and np.all(hi<=1) and np.all(hi>lo)
                center=(lo+hi)/2;size=hi-lo
                boxes.append('0 '+' '.join(f'{v:.8f}' for v in [*center,*size]))
            label_path=dest/'labels'/split/image_path.with_suffix('.txt').name
            label_path.parent.mkdir(parents=True,exist_ok=True)
            label_path.write_text('\n'.join(boxes)+'\n',encoding='utf-8')
            public.append({'image':str(image_path),'label':str(label_path),'split':split,
                           'source_group':Path(name).name.split('.rf.')[0],
                           'sha256':hashlib.sha256(image_path.read_bytes()).hexdigest(),
                           'dhash':f'{dhash(image_path):016x}','boxes':len(boxes)})
    # Exclude held-out images with an exact or close dHash match in training.
    # dHash is a screening heuristic, not a proof of independence.
    train=[r for r in public if r['split']=='train'];kept=[];excluded=[]
    for row in public:
        if row['split']=='train':kept.append(row);continue
        matches=[t for t in train if row['sha256']==t['sha256'] or (int(row['dhash'],16)^int(t['dhash'],16)).bit_count()<=4]
        if matches:
            row['reason']='exact or near dHash match with training';row['matched_training_images']=[x['image'] for x in matches]
            excluded.append(row)
            # Move to a separate audit folder instead of deleting evidence.
            for key,kind in [('image','images'),('label','labels')]:
                path=Path(row[key]);audit=dest/'excluded'/kind/path.name;audit.parent.mkdir(parents=True,exist_ok=True)
                path.replace(audit)
        else:kept.append(row)
    assert not any(a['source_group']==b['source_group'] and a['split']!=b['split'] for a in kept for b in kept)
    assert not any(a['sha256']==b['sha256'] and a['split']!=b['split'] for a in kept for b in kept)
    yaml=f"path: {dest.as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n  0: pothole\n"
    (dest/'data.yaml').write_text(yaml,encoding='utf-8')
    summary={'direction':dict(Counter(r['split'] for r in direction)),
             'public_pothole':dict(Counter(r['split'] for r in kept)),
             'public_train_source_groups':len({r['source_group'] for r in train}),
             'public_excluded_heldout':len(excluded),
             'local_paving_policy':'All 10 defect and 5 intact frames reserved for local domain evaluation; no local paving used in training.',
             'test_policy':'Test partitions fixed before training. Do not tune thresholds or select models on test results.',
             'public_label_conversion':'Each segmentation polygon converted to its enclosing bounding box.',
             'dhash_policy':'Heldout samples with <=4 bit dHash distance to any training sample excluded; not an exhaustive duplicate check.'}
    save_json(dest/'manifest.json',{'archive_sha256':hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),'images':kept,'excluded':excluded})
    save_json(ROOT/'datasets'/'split-summary.json',summary)
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
