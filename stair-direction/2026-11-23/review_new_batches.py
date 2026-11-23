"""Record sampled visual review of the two additional stairs and paving clips."""
import csv
import json
import shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REVIEWS = {
    'outdoor-up': {
        'U1-up': ('stairs_up', 'brick_enclosed_daylit_flight_C', 'Clear ascending tiled flight between brick walls; bright lower steps and shaded upper steps. Visually consistent with C-down; grouped conservatively, exact pairing unverified.'),
        'U2-up': ('stairs_up', 'outdoor_brick_entrance_steps_D', 'Clear short ascending brick steps with sun/shadow and parked cars beyond. Grouped conservatively with D-down due similar paving; exact pairing unverified.'),
    },
    'outdoor-down': {
        'C-down': ('stairs_down', 'brick_enclosed_daylit_flight_C', 'Clear descending flight between brick walls; sunlight and bright exit; step edges visible in sampled frames.'),
        'D-down': ('stairs_down', 'outdoor_brick_entrance_steps_D', 'Short descending brick steps toward a paved entrance; shadows and people in the background; sampled full-size frame checked.'),
    },
    'potholes': {
        'P1-pothole': ('missing_paver_depression', 'outdoor_paver_defects_01', 'Missing individual paving blocks with exposed ground; strong shadows; landscape, close downward view. Depth unmeasured.'),
        'P2-pothole': ('missing_paver_depression', 'outdoor_paver_defects_01', 'Larger missing-paver area and exposed ground; shadows and shoes; portrait, close downward view. Depth unmeasured.'),
    },
}
for batch, reviews in REVIEWS.items():
    folder=ROOT/batch
    data=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    rows=[]
    for clip in data['clips']:
        label, group, note=reviews[clip['clip_id']]
        clip.update({'review_status':'five chronological sampled frames visually reviewed', 'observed_label':label,
                     'scene_group':group, 'review_note':note,
                     'split':'unassigned; do not use for training until location-based split is fixed',
                     'independent_location_verified':False})
        for frame in clip['frames']:
            target=folder/'labelled-frames'/label/Path(frame['path']).name
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(folder/frame['path'],target)
            frame.update({'annotation_status':'reviewed image-level label; bounding boxes not annotated',
                          'label':label, 'labelled_path':target.relative_to(folder).as_posix()})
            rows.append({'image':frame['labelled_path'], 'label':label, 'clip_id':clip['clip_id'],
                         'timestamp_seconds':frame['timestamp_seconds'], 'scene_group':group,
                         'split':'unassigned', 'annotation_type':'image_classification'})
    data['review_summary']={'clips':len(data['clips']), 'sampled_frames':len(rows), 'boxes_annotated':False,
                            'model_trained':False, 'app_changed':False, 'negative_examples_in_batch':0}
    (folder/'manifest.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    with (folder/'labels.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    assert len(rows)==10 and all((folder/r['image']).is_file() for r in rows)
    print(batch, data['review_summary'])
