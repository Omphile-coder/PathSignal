"""Fail fast on missing labels, cross-split group overlap and invalid local boxes."""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent

def disjoint(rows,group):
    sets={s:{r[group] for r in rows if r['split']==s} for s in ('train','val','test')}
    for i,a in enumerate(sets):
        for b in list(sets)[i+1:]:assert not sets[a]&sets[b],(group,a,b)

def main():
    direction=json.loads((ROOT/'datasets'/'direction'/'manifest.json').read_text())['images']
    public=json.loads((ROOT/'datasets'/'pothole'/'manifest.json').read_text())['images']
    local=json.loads((ROOT/'datasets'/'local-paving-test'/'manifest.json').read_text())['images']
    disjoint(direction,'group');disjoint(direction,'sha256');disjoint(public,'source_group');disjoint(public,'sha256')
    assert Counter(r['split'] for r in direction)=={'train':20,'val':10,'test':10}
    for split in ('train','val','test'):
        counts=Counter(r['class'] for r in direction if r['split']==split)
        assert counts['stairs_up']==counts['stairs_down']>0
    for row in public:
        assert Path(row['image']).is_file() and Path(row['label']).is_file()
        for line in Path(row['label']).read_text().splitlines():
            values=list(map(float,line.split()));assert len(values)==5 and values[0]==0
            _,cx,cy,w,h=values
            assert all(math.isfinite(v) for v in values) and w>0 and h>0
            assert min(cx-w/2,cy-h/2)>=-1e-7 and max(cx+w/2,cy+h/2)<=1+1e-7
    assert len(local)==15 and sum(r['expected_defect'] for r in local)==10
    for row in local:
        with Image.open(row['image']) as im:assert im.size==(row['width'],row['height'])
        for a,b,c,d in row['boxes_xyxy']:assert 0<=a<c<=row['width'] and 0<=b<d<=row['height']
        assert bool(Path(row['label']).read_text().strip())==row['expected_defect']
    local_hashes={hashlib.sha256(Path(r['image']).read_bytes()).hexdigest() for r in local}
    assert not local_hashes&{r['sha256'] for r in public}
    val=[r for r in public if r['split']=='val'];test=[r for r in public if r['split']=='test']
    assert not [(a,b) for a in val for b in test if (int(a['dhash'],16)^int(b['dhash'],16)).bit_count()<=4]
    report={'checks_passed':True,'direction_frames':len(direction),'public_pothole_frames':len(public),
            'local_paving_frames':len(local),'local_reference_boxes':sum(len(r['boxes_xyxy']) for r in local),
            'scope':'structural integrity and fixed-group separation; not independent annotation or field validation'}
    (ROOT/'datasets'/'audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
