"""Build conservative group-disjoint public splits from audited YOLO archives.

Similarity candidates are grouped, not asserted to be duplicates. Keep one
representative per group to avoid overweighting repeated views. Originals stay
in the ZIP; no source files are deleted. Local videos remain evaluation only.
"""
import argparse
import hashlib
import json
import random
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESEARCH = ROOT / 'dataset-research' / '2026-11-23'

def prepare(name):
    audit_folder=RESEARCH / f'{name}-audit-corrected'
    if not (audit_folder/'audit.json').exists(): audit_folder=RESEARCH / f'{name}-audit'
    audit = json.loads((audit_folder / 'audit.json').read_text())
    if audit['issues']:
        raise ValueError('Resolve archive issues before preparing training data')
    rows = {r['member']: r for r in audit['images']}
    parent = {m: m for m in rows}
    def find(m):
        while parent[m] != m:
            parent[m] = parent[parent[m]]
            m = parent[m]
        return m
    for pair in audit['duplicate_pairs']:
        parent[find(pair['a'])] = find(pair['b'])
    groups = defaultdict(list)
    for member in rows:
        groups[find(member)].append(member)
    # Group source-name variants (for example, *_flipped and *flip) even when
    # perceptual similarity is too weak to catch a transformed copy.
    normalized = defaultdict(list)
    for member,row in rows.items(): normalized[row['normalized_source_name']].append(member)
    for members in normalized.values():
        root=members[0]
        for member in members[1:]: parent[find(member)]=find(root)
    groups=defaultdict(list)
    for member in rows: groups[find(member)].append(member)
    selected = []
    with zipfile.ZipFile(audit['archive']) as archive:
        for members in groups.values():
            representative = sorted(members)[0]
            row = dict(rows[representative])
            row['related_members'] = sorted(members)
            row['group_id'] = hashlib.sha256('\n'.join(sorted(members)).encode()).hexdigest()
            text = archive.read(row['label_member']).decode('utf-8-sig')
            converted = []
            for line in text.splitlines():
                if not line.strip(): continue
                values = list(map(float,line.split()))
                if len(values) != 5:
                    # Roboflow exports many rectangular annotations as closed
                    # polygons. Use their enclosing box, preserving class IDs.
                    xs, ys = values[1::2], values[2::2]
                    x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
                    values=[values[0],(x0+x1)/2,(y0+y1)/2,x1-x0,y1-y0]
                converted.append(str(int(values[0]))+' '+' '.join(f'{x:.9f}' for x in values[1:]))
            row['converted_labels']='\n'.join(converted)+ ('\n' if converted else '')
            row['class_ids'] = sorted({int(line.split()[0]) for line in text.splitlines() if line.strip()})
            selected.append(row)
        # Stratify groups by label composition; use fixed seed before training.
        buckets = defaultdict(list)
        for row in selected:
            buckets[tuple(row['class_ids'])].append(row)
        rng = random.Random(2311)
        for key in sorted(buckets):
            bucket = sorted(buckets[key], key=lambda r:r['group_id'])
            rng.shuffle(bucket)
            n = len(bucket)
            nt = max(1, round(n*.15)) if n >= 6 else 0
            nv = max(1, round(n*.15)) if n >= 6 else 0
            for i, row in enumerate(bucket):
                row['split'] = 'test' if i < nt else 'valid' if i < nt+nv else 'train'
        output = ROOT / 'datasets' / (name+'-corrected')
        if output.exists():
            raise FileExistsError('Refusing to overwrite an existing prepared dataset')
        for row in selected:
            stem = row['group_id'][:24]
            image = output / row['split'] / 'images' / (stem+Path(row['member']).suffix.lower())
            label = output / row['split'] / 'labels' / (stem+'.txt')
            image.parent.mkdir(parents=True, exist_ok=True)
            label.parent.mkdir(parents=True, exist_ok=True)
            image.write_bytes(archive.read(row['member']))
            label.write_text(row.pop('converted_labels'))
            row['prepared_image'] = str(image)
    classes = [audit['classes'][str(i)] for i in range(len(audit['classes']))]
    (output/'data.yaml').write_text('path: '+output.as_posix()+'\ntrain: train/images\nval: valid/images\ntest: test/images\nnames: '+json.dumps(classes)+'\n')
    summary = {'dataset':name,'archive_sha256':audit['archive_sha256'],
        'original_images':len(rows),'selected_images':len(selected),
        'excluded_similar_views':len(rows)-len(selected),'split_counts':dict(Counter(r['split'] for r in selected)),
        'classes':classes,'local_clips_in_training':False,
            'policy':'Connected components of exact, perceptual and normalized-source-name candidates (including flipped filename variants); one representative per component; stratified group split seed 2311, approximately 70/15/15. Publisher splits replaced. Polygons converted to enclosing boxes. No original files deleted.',
        'limitation':'Visual similarity does not establish scene independence. New splits are preliminary public benchmarks, not field validation.',
        'rows':selected}
    (output/'manifest.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps({k:v for k,v in summary.items() if k!='rows'},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('name',choices=['stairs-v1','missing-tile-v2'])
    prepare(p.parse_args().name)
