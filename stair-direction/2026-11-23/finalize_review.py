"""Apply human visual review labels; this does not run or train a detector."""
import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CORRECTED = {'A-up':'stairs_down', 'A-down':'stairs_up', 'B-up':'stairs_down', 'B-down':'stairs_up'}

def main():
    data = json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    rows = []
    for clip in data['clips']:
        label = CORRECTED[clip['clip_id']]
        clip.update({'review_status':'five sampled frames visually reviewed', 'observed_direction':label,
                     'label_correction':'user direction label reversed relative to camera view',
                     'scene_group':'supplied_brick_tile_stairwell_01',
                     'independent_location_verified':False,
                     'scene_note':'Visually similar brick walls, white tiled steps, dark nosings and railings. A/B independence not established.',
                     'split':'development_only; keep all four clips together until location independence is established'})
        target = ROOT/'labelled-frames'/label
        target.mkdir(parents=True, exist_ok=True)
        for frame in clip['frames']:
            source = ROOT/frame['path']
            destination = target/source.name
            shutil.copy2(source, destination)
            frame.update({'annotation_status':'image-level direction visually reviewed; no bounding box annotation',
                          'direction_label':label, 'usable_for_direction_review':True,
                          'labelled_path':destination.relative_to(ROOT).as_posix()})
            rows.append({'image':frame['labelled_path'], 'direction_label':label, 'original_clip_id':clip['clip_id'],
                         'original_user_direction':clip['user_label'], 'timestamp_seconds':frame['timestamp_seconds'],
                         'scene_group':clip['scene_group'], 'split':'development_only', 'annotation_type':'image_classification'})
    data['review_summary'] = {'clips':4, 'sampled_frames':20, 'stairs_up_frames':10, 'stairs_down_frames':10,
                              'image_level_labels_only':True, 'model_trained':False, 'app_changed':False,
                              'independent_test_set':False, 'negative_examples_in_this_batch':0}
    (ROOT/'manifest.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
    with (ROOT/'labels.csv').open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    assert len(rows)==20 and all((ROOT/row['image']).is_file() for row in rows)
    assert {row['scene_group'] for row in rows}=={'supplied_brick_tile_stairwell_01'}
    assert sum(row['direction_label']=='stairs_up' for row in rows)==10
    print(json.dumps(data['review_summary'], indent=2))

if __name__=='__main__':
    main()
