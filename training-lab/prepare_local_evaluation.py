"""Create a boxed local domain-check dataset, never used in training."""
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
LOCAL=ROOT.parent/'stair-direction'/'2026-11-23'
annotations=json.loads((ROOT/'local_boxes.json').read_text())
dest=ROOT/'datasets'/'local-paving-test'
rows=[]
for sub in ('potholes','intact-ground'):
    manifest=json.loads((LOCAL/sub/'manifest.json').read_text())
    for clip in manifest['clips']:
        for frame in clip['frames']:
            source=LOCAL/sub/frame['labelled_path']
            target=dest/'images'/source.name;target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(source,target)
            boxes=annotations['boxes'].get(source.name,[])
            assert (sub=='intact-ground') == (not bool(boxes))
            labels=dest/'labels'/source.with_suffix('.txt').name;labels.parent.mkdir(parents=True,exist_ok=True)
            with Image.open(source) as im:
                w,h=im.size;lines=[];review=im.copy();draw=ImageDraw.Draw(review)
                for x1,y1,x2,y2 in boxes:
                    assert 0<=x1<x2<=w and 0<=y1<y2<=h
                    lines.append('0 '+' '.join(f'{x:.8f}' for x in [(x1+x2)/2/w,(y1+y2)/2/h,(x2-x1)/w,(y2-y1)/h]))
                    draw.rectangle([x1,y1,x2,y2],outline='#ff3030',width=4)
                labels.write_text('\n'.join(lines)+('\n' if lines else ''),encoding='utf-8')
                preview=dest/'annotation-review'/source.name;preview.parent.mkdir(exist_ok=True)
                review.save(preview,quality=90)
            rows.append({'image':str(target),'label':str(labels),'boxes_xyxy':boxes,'width':w,'height':h,
                         'clip':clip['clip_id'],'expected_defect':bool(boxes),'split':'local_domain_test',
                         'group':'outdoor_paver_defects_01','region_class':'missing_paver_depression'})
(dest/'manifest.json').write_text(json.dumps({'annotation_method':annotations['annotation_method'],'images':rows},indent=2),encoding='utf-8')
print(json.dumps({'frames':len(rows),'positive_frames':sum(r['expected_defect'] for r in rows),'boxes':sum(len(r['boxes_xyxy']) for r in rows)},indent=2))
