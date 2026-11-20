"""Bounded, repeatable dataset audit. Downloads data, never executes dataset code."""
import csv, hashlib, io, json, re, zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
META = ROOT / 'metadata'
SAMPLES = ROOT / 'samples'
SAMPLES.mkdir(exist_ok=True)

def save(name, obj):
    (ROOT / name).write_text(json.dumps(obj, indent=2), encoding='utf-8')

def fetch(url, path):
    if not path.exists():
        with urlopen(Request(url, headers={'User-Agent': 'PathSignal-dataset-audit'}), timeout=45) as r:
            path.write_bytes(r.read())
    return path

def groups_with_multiple_splits(groups):
    return [v for v in groups.values() if len({x['split'] for x in v}) > 1]

def audit_ewaste():
    counts, ext, dims = Counter(), Counter(), Counter()
    byte_groups, pixel_groups = defaultdict(list), defaultdict(list)
    errors, preview = [], []
    with zipfile.ZipFile(ROOT / 'ewaste.zip') as z:
        files = [x for x in z.infolist() if not x.is_dir()]
        label_files = []
        for item in files:
            p = Path(item.filename)
            ext[p.suffix.lower()] += 1
            if p.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
                label_files.append(item.filename)
                continue
            parts = p.parts
            split = next((x for x in parts if x in ('train', 'test', 'validation', 'valid', 'val')), 'unknown')
            cls = p.parent.name
            counts[(split, cls)] += 1
            raw = z.read(item)
            entry = {'split': split, 'path': item.filename}
            byte_groups[hashlib.sha256(raw).hexdigest()].append(entry)
            try:
                with Image.open(io.BytesIO(raw)) as im:
                    im = ImageOps.exif_transpose(im).convert('RGB')
                    dims[str(im.size)] += 1
                    digest = hashlib.sha256(str(im.size).encode() + im.tobytes()).hexdigest()
                    pixel_groups[digest].append(entry)
                    if cls not in {v[0] for v in preview}:
                        target = SAMPLES / ('ewaste-' + cls.replace(' ', '-') + '.jpg')
                        im.save(target)
                        preview.append((cls, target))
            except Exception as e:
                errors.append({'path': item.filename, 'error': str(e)})
    out = {'archive_sha256': hashlib.sha256((ROOT/'ewaste.zip').read_bytes()).hexdigest(),
           'file_count': len(files), 'extensions': dict(ext), 'image_count': sum(counts.values()),
           'counts': [{'split': s, 'class': c, 'images': n} for (s,c),n in sorted(counts.items())],
           'dimensions': dict(dims), 'non_image_files': label_files, 'image_read_errors': errors,
           'exact_byte_cross_split_groups': groups_with_multiple_splits(byte_groups),
           'exact_decoded_pixel_cross_split_groups': groups_with_multiple_splits(pixel_groups),
           'near_duplicate_audit': 'Not performed. Exact hashes do not establish scene independence.',
           'decision': 'Classification folders only; not detection-training-ready without localisation annotation.'}
    save('ewaste-audit.json', out)
    return preview, out

def audit_rod():
    manifest = list(csv.DictReader((META/'rod-images_manifest.csv').open(encoding='utf-8-sig')))
    rename = list(csv.DictReader((META/'rod-rename_map.csv').open(encoding='utf-8-sig')))
    names = re.search(r'names:\s*(\[.*\])', (META/'rod-data.yaml').read_text(encoding='utf-8')).group(1)
    import ast
    names = ast.literal_eval(names)
    lineage = defaultdict(list)
    for row in rename:
        base = re.sub(r'\.rf\.[a-fA-F0-9]+$', '', row['old_stem'])
        lineage[base].append({'split': row['split'], 'image': row['new_stem'], 'old_stem': row['old_stem']})
    conflicts = groups_with_multiple_splits(lineage)
    save('rod-potential-lineage-leakage.json', conflicts)
    selected = []
    for split in ('train', 'valid', 'test'):
        for cid in (4,11,22,23):
            row = next((r for r in manifest if r['split']==split and str(cid) in re.split(r'[;|, ]+', r['classes_present'])), None)
            if row: selected.append(row)
    def get_pair(row):
        split, img, lab = row['split'], row['image_filename'], row['label_filename']
        base = 'https://huggingface.co/datasets/Abtinzandi/Obstacle-Detection-Dataset-YOLO/resolve/main/'
        stem = 'rod-' + split + '-' + Path(img).stem
        def get_sharded(kind, filename, target):
            if split != 'train': return fetch(base+split+'/'+kind+'/'+filename,target)
            for shard in ('0','1'):
                try: return fetch(base+split+'/'+kind+'/'+shard+'/'+filename,target)
                except Exception as e:
                    if getattr(e,'code',None)!=404: raise
            raise ValueError('Not found in either train shard')
        image = get_sharded('images', img, SAMPLES/(stem+'.jpg'))
        label = get_sharded('labels', lab, SAMPLES/(stem+'.txt'))
        boxes, errors, polygons = [], [], 0
        for number, line in enumerate(label.read_text().splitlines(),1):
            fields = line.split()
            try:
                cid = int(fields[0])
                if len(fields)==5:
                    x,y,w,h = map(float,fields[1:])
                else:
                    assert len(fields)>=7 and len(fields)%2==1, 'neither YOLO box nor polygon fields'
                    coordinates=list(map(float,fields[1:])); xs=coordinates[::2]; ys=coordinates[1::2]
                    assert all(0<=v<=1 for v in coordinates), 'polygon coordinates out of range'
                    x,y=(min(xs)+max(xs))/2,(min(ys)+max(ys))/2
                    w,h=max(xs)-min(xs),max(ys)-min(ys)
                    polygons+=1
                assert 0 <= cid < len(names), 'class out of range'
                assert 0<=x<=1 and 0<=y<=1 and 0<w<=1 and 0<h<=1, 'coordinates out of range'
                assert x-w/2>=-0.001 and y-h/2>=-0.001 and x+w/2<=1.001 and y+h/2<=1.001, 'box crosses boundary'
                boxes.append((cid,x,y,w,h))
            except Exception as e: errors.append({'line':number, 'error':str(e)})
        with Image.open(image) as im:
            im=im.convert('RGB'); width,height=im.size
            draw=ImageDraw.Draw(im)
            for cid,x,y,w,h in boxes:
                draw.rectangle(((x-w/2)*width,(y-h/2)*height,(x+w/2)*width,(y+h/2)*height),outline='red',width=3)
                draw.text(((x-w/2)*width,(y-h/2)*height),names[cid],fill='red',stroke_width=1)
            overlay=SAMPLES/(stem+'-boxes.jpg'); im.save(overlay)
        return {'split':split,'image':img,'boxes':len(boxes),'polygon_rows_converted_for_preview':polygons,'errors':errors, 'overlay':str(overlay), 'sha256':hashlib.sha256(image.read_bytes()).hexdigest()}
    pairs=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for row,result in zip(selected,pool.map(lambda r: safe_pair(get_pair,r),selected)):
            pairs.append(result)
    out={'manifest_images':len(manifest),'manifest_split_counts':dict(Counter(r['split'] for r in manifest)),
         'manifest_objects':sum(int(r['num_objects']) for r in manifest),'class_names_in_order':names,
         'manifest_duplicate_split_filename_keys':len(manifest)-len({(r['split'],r['image_filename']) for r in manifest}),
         'rename_map_rows':len(rename), 'potential_same_source_stem_cross_split_groups':len(conflicts),
         'potential_same_source_stem_cross_split_images':sum(map(len,conflicts)),
         'lineage_method':'Strip final .rf.<hex> suffix from old_stem; potential common source, not proof of pixel duplicates.',
         'sample_pairs':pairs,'full_image_hash_audit':False,'full_label_validation':False,
         'format_warning':'Sample includes polygon rows as well as five-field bounding boxes. Explicit normalisation is needed for a box-only training loader. Train mirror uses images/0 and images/1 shards.',
         'licence':'Kaggle/HF MIT metadata is not blanket permission for all source images. Paper Appendix 6 lists mixed source terms and one source without a stated licence.',
         'decision':'Conditional candidate; regroup source-related examples and resolve image provenance before training/release.'}
    save('rod-audit.json',out)
    return [(r['split']+' '+r['image'],Path(r['overlay'])) for r in pairs if 'overlay' in r],out

def safe_pair(fn,row):
    try: return fn(row)
    except Exception as e: return {'split':row['split'],'image':row['image_filename'],'error':str(e)}

def audit_cables():
    tree=json.loads((META/'cable-tree.json').read_text(encoding='utf-8-sig'))
    blobs={x['path']:x for x in tree['tree'] if x['type']=='blob'}
    images=sorted(p for p in blobs if p.startswith('real_images/images/'))
    masks=sorted(p for p in blobs if p.startswith('real_images/masks/'))
    preview=[]; samples=[]
    for p in images[:3]:
        m=p.replace('/images/','/masks/')
        if m not in blobs: continue
        base='https://raw.githubusercontent.com/pablomalvido/cables_segmentation/main/'
        ip=fetch(base+p,SAMPLES/('cable-'+Path(p).name))
        mp=fetch(base+m,SAMPLES/('cable-mask-'+Path(p).name))
        with Image.open(ip) as im, Image.open(mp) as mask:
            samples.append({'image':p,'mask':m,'image_size':im.size,'mask_size':mask.size,'mask_mode':mask.mode,
                            'mask_distinct_colours':len(mask.convert('RGB').getcolors(2000000) or [])})
        preview.extend([(Path(p).name,ip),('mask '+Path(p).name,mp)])
    out={'git_tree_sha':tree['sha'],'tree_truncated':tree.get('truncated'),
         'real_image_files':len(images),'real_mask_files':len(masks),
         'unpaired_images':[p for p in images if p.replace('/images/','/masks/') not in blobs],
         'licence_named_paths':[p for p in blobs if re.search(r'(^|/)(licen[sc]e|copying)',p,re.I)],
         'sample_pairs':samples,'decision':'Research candidate only: no repository licence file found; masks and floor-view relevance need review before use.'}
    save('cables-audit.json',out)
    return preview,out

def sheet(items,name):
    tilew,tileh=320,270
    canvas=Image.new('RGB',(tilew*3,tileh*((len(items)+2)//3)), '#eeeeee')
    draw=ImageDraw.Draw(canvas)
    for i,(caption,path) in enumerate(items):
        with Image.open(path) as im:
            im=ImageOps.contain(ImageOps.exif_transpose(im).convert('RGB'),(310,235))
            x=(i%3)*tilew; y=(i//3)*tileh
            canvas.paste(im,(x,y)); draw.text((x+4,y+239),caption[:45],fill='black')
    canvas.save(ROOT/name)

def audit_taco():
    source=Path(r'C:\Users\lucas\Documents\Codex\2026-11-11\am\work\taco-annotations.json')
    raw=source.read_bytes(); data=json.loads(raw)
    images={i['id']:i for i in data['images']}
    counts=Counter(a['category_id'] for a in data['annotations'])
    image_counts=defaultdict(set); errors=[]
    for ann in data['annotations']:
        image_counts[ann['category_id']].add(ann['image_id'])
        im=images.get(ann['image_id']); box=ann.get('bbox',[])
        if im is None or len(box)!=4:
            errors.append({'annotation_id':ann['id'],'error':'missing image or bbox'}); continue
        x,y,w,h=box
        if not (w>0 and h>0 and x>=0 and y>=0 and x+w<=im['width']+1 and y+h<=im['height']+1):
            errors.append({'annotation_id':ann['id'],'error':'invalid/outside bbox'})
    categories=[{'id':c['id'],'name':c['name'],'annotations':counts[c['id']],'images':len(image_counts[c['id']])} for c in data['categories']]
    out={'annotation_source':str(source),'sha256':hashlib.sha256(raw).hexdigest(),
         'images_referenced':len(images),'annotations':len(data['annotations']),'categories':categories,
         'bbox_errors':errors,'image_bytes_audited_here':False,
         'licence_records_in_annotation':data.get('licenses',[]),
         'decision':'Annotation inventory only. Food waste is not a dedicated banana-peel label. Previous 32-image sample remains development data, not training or held-out evaluation.'}
    save('taco-audit.json',out)
    print('taco',len(images),'referenced images',len(data['annotations']),'annotations; bbox errors',len(errors),flush=True)

if __name__=='__main__':
    e,es=audit_ewaste(); sheet(e,'ewaste-contact-sheet.jpg')
    print('ewaste',es['image_count'],'images;',len(es['non_image_files']),'non-image files;',len(es['exact_decoded_pixel_cross_split_groups']),'cross-split pixel duplicate groups',flush=True)
    r,rs=audit_rod()
    if r: sheet(r,'rod-contact-sheet.jpg')
    print('rod',rs['manifest_split_counts'],'potential source-family overlap groups',rs['potential_same_source_stem_cross_split_groups'],'sample pairs',len(r),flush=True)
    c,cs=audit_cables(); sheet(c,'cables-contact-sheet.jpg')
    print('cables',cs['real_image_files'],'images',cs['real_mask_files'],'masks; licence files',cs['licence_named_paths'],flush=True)
    audit_taco()
