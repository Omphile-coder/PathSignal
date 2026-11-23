"""Save reviewed pothole-negative frames, preserving scene provenance."""
import csv
import json
import shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent
data=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
rows=[]
for clip in data['clips']:
    clip.update({'review_status':'five chronological samples and central full-size frame visually reviewed',
                 'observed_label':'intact_paving_no_visible_pothole',
                 'scene_group':'outdoor_paver_defects_01',
                 'scene_note':'Similar paving and surroundings to outdoor collection; conservatively grouped with missing-paver examples. Exact location not verified.',
                 'split':'unassigned; keep related local pavement scenes together',
                 'review_scope':'No visible hole or missing paver in the sampled frames. This is not a path-clearance or surface-levelness assessment.'})
    for frame in clip['frames']:
        source=ROOT/frame['path']
        target=ROOT/'labelled-frames'/'intact_paving_no_visible_pothole'/source.name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,target)
        # Empty labels mean background only for the proposed pothole/missing-paver task.
        labels=ROOT/'background-labels'/source.with_suffix('.txt').name
        labels.parent.mkdir(parents=True,exist_ok=True)
        labels.write_text('',encoding='utf-8')
        frame.update({'label':'intact_paving_no_visible_pothole',
                      'annotation_status':'reviewed negative for visible potholes/missing pavers only',
                      'labelled_path':target.relative_to(ROOT).as_posix(),
                      'empty_yolo_label':labels.relative_to(ROOT).as_posix()})
        rows.append({'image':frame['labelled_path'],'label':frame['label'],'clip_id':clip['clip_id'],
                     'timestamp_seconds':frame['timestamp_seconds'],'scene_group':clip['scene_group'],
                     'split':'unassigned','annotation_type':'pothole_negative',
                     'empty_yolo_label':frame['empty_yolo_label']})
data['review_summary']={'clips':1,'sampled_frames':5,'negative_frames':5,'model_trained':False,'app_changed':False}
(ROOT/'manifest.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
with (ROOT/'labels.csv').open('w',newline='',encoding='utf-8') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
assert len(rows)==5 and all((ROOT/row['image']).is_file() and (ROOT/row['empty_yolo_label']).stat().st_size==0 for row in rows)
print(json.dumps(data['review_summary'],indent=2))
