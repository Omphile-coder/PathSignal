"""Audit a user-downloaded YOLO ZIP before any extraction, training or app update."""
import argparse
import hashlib
import io
import json
import math
import os
import re
from collections import Counter,defaultdict
from pathlib import Path,PurePosixPath
import zipfile
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('YOLO_CONFIG_DIR',str(ROOT/'cache'/'ultralytics'))
import cv2
import numpy as np
from PIL import Image
from ultralytics.utils import YAML

def fingerprints(im):
    rgb=im.convert('RGB');gray=rgb.convert('L')
    pixels=hashlib.sha256(str(rgb.size).encode()+rgb.tobytes()).hexdigest()
    a=np.asarray(gray.resize((9,8)),dtype=np.float32)
    d=sum(int(v)<<i for i,v in enumerate((a[:,1:]>a[:,:-1]).flat))
    low=cv2.dct(np.asarray(gray.resize((32,32)),dtype=np.float32))[:8,:8]
    p=sum(int(v)<<i for i,v in enumerate((low>np.median(low.flatten()[1:])).flat))
    return pixels,d,p

def audit(archive,output):
    output.mkdir(parents=True,exist_ok=True)
    report={'archive':str(archive),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
            'images':[],'issues':[],'duplicate_pairs':[],'class_annotations':{},
            'files_deleted':0,'training_started':False,'app_changed':False}
    with zipfile.ZipFile(archive) as z:
        entries=z.infolist();names=set(z.namelist())
        if len(entries)>50000 or sum(e.file_size for e in entries)>4*1024**3:raise ValueError('Archive exceeds audit size limit')
        for entry in entries:
            p=PurePosixPath(entry.filename.replace('\\','/'))
            if p.is_absolute() or '..' in p.parts or ':' in entry.filename or '\\' in entry.filename:
                raise ValueError('Unsafe/nonstandard member path')
        configs=[n for n in names if n.endswith('data.yaml')]
        if len(configs)!=1:raise ValueError('Expected exactly one data.yaml')
        config=output/'publisher-data.yaml';config.write_bytes(z.read(configs[0]))
        meta=YAML.load(str(config));raw=meta.get('names')
        classes={i:v for i,v in enumerate(raw)} if isinstance(raw,list) else {int(i):v for i,v in raw.items()}
        assert classes and sorted(classes)==list(range(len(classes)))
        report['classes']=classes
        counts=Counter()
        for name in sorted(names):
            if '/images/' not in name or not name.lower().endswith(('.jpg','.jpeg','.png','.webp')):continue
            info=z.getinfo(name)
            if info.file_size>64*1024**2:raise ValueError('Single image exceeds limit')
            label=str(PurePosixPath(name).with_suffix('.txt')).replace('/images/','/labels/')
            split=PurePosixPath(name).parts[-3]
            payload=z.read(name)
            try:
                with Image.open(io.BytesIO(payload)) as im:
                    im.load();w,h=im.size;pixels,dhash,phash=fingerprints(im)
            except Exception as e:
                report['issues'].append({'image':name,'error':'image decode failed: '+type(e).__name__});continue
            source_name=PurePosixPath(name).name.split('.rf.')[0].lower()
            normalized_source=re.sub(r'(?:_output|_jpg|_jpeg|_png|\.jpg|\.jpeg|\.png|_?flipped?)','',source_name)
            row={'member':name,'label_member':label,'split':split,'width':w,'height':h,
                 'byte_sha256':hashlib.sha256(payload).hexdigest(),'pixel_sha256':pixels,
                 'dhash':f'{dhash:016x}','phash':f'{phash:016x}',
                 'source_name_group':PurePosixPath(name).name.split('.rf.')[0],
                 'normalized_source_name':normalized_source,'annotations':0,'label_formats':[]}
            if label not in names:report['issues'].append({'image':name,'error':'missing label file; not automatically treated as a negative'})
            else:
                for number,line in enumerate(z.read(label).decode('utf-8-sig').strip().splitlines(),1):
                    try:
                        v=list(map(float,line.split()));cid=int(v[0])
                        assert v[0]==cid and cid in classes and all(math.isfinite(x) for x in v)
                        if len(v)==5:
                            _,x,y,bw,bh=v
                            assert bw>0 and bh>0 and min(x-bw/2,y-bh/2)>=-.00001 and max(x+bw/2,y+bh/2)<=1.00001
                            kind='box'
                        else:
                            assert len(v)>=7 and (len(v)-1)%2==0 and all(0<=x<=1 for x in v[1:])
                            kind='polygon_or_other_even_coordinate_shape; inspect before conversion'
                        row['annotations']+=1;row['label_formats'].append(kind);counts[str(classes[cid])]+=1
                    except Exception:
                        report['issues'].append({'label':label,'line':number,'error':'invalid or unsupported annotation'})
            report['images'].append(row)
        images=report['images']
        by_name=defaultdict(list)
        for row in images:by_name[row['normalized_source_name']].append(row)
        for group in by_name.values():
            for i,a in enumerate(group):
                for b in group[i+1:]:
                    if a['split']!=b['split']:
                        report['duplicate_pairs'].append({'a':a['member'],'b':b['member'],
                            'exact_pixels':a['pixel_sha256']==b['pixel_sha256'],
                            'same_source_name':True,'normalized_source_name':a['normalized_source_name'],
                            'dhash_distance':(int(a['dhash'],16)^int(b['dhash'],16)).bit_count(),
                            'phash_distance':(int(a['phash'],16)^int(b['phash'],16)).bit_count(),
                            'cross_publisher_split':True,'name_variant_group':True})
        for i,a in enumerate(images):
            for b in images[i+1:]:
                if any(p['a']==a['member'] and p['b']==b['member'] for p in report['duplicate_pairs']):continue
                exact=a['pixel_sha256']==b['pixel_sha256']
                same_source=a['source_name_group']==b['source_name_group']
                dh=(int(a['dhash'],16)^int(b['dhash'],16)).bit_count()
                ph=(int(a['phash'],16)^int(b['phash'],16)).bit_count()
                if exact or same_source or dh<=8 or ph<=8:
                    report['duplicate_pairs'].append({'a':a['member'],'b':b['member'],'exact_pixels':exact,
                         'same_source_name':same_source,'dhash_distance':dh,'phash_distance':ph,
                         'cross_publisher_split':a['split']!=b['split']})
        report['class_annotations']=dict(counts)
        report['summary']={'decoded_images':len(images),'split_counts':dict(Counter(r['split'] for r in images)),
            'empty_existing_labels':sum(r['annotations']==0 and r['label_member'] in names for r in images),
            'issues':len(report['issues']),
            'exact_pixel_duplicate_pairs':sum(p['exact_pixels'] for p in report['duplicate_pairs']),
            'candidate_related_pairs':len(report['duplicate_pairs']),
            'cross_split_related_pairs':sum(p['cross_publisher_split'] for p in report['duplicate_pairs'])}
        report['limitations']='Similarity is a screening flag, not proof of duplicate scenes. Review flagged pairs and group related originals across splits before training. No automatic deletion or training.'
    (output/'audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('archive',type=Path);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();result=audit(args.archive,args.output)
    print(json.dumps({'classes':result['classes'],'summary':result['summary']},indent=2))
