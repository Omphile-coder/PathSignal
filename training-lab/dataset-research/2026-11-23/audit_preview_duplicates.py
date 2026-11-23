"""Review exact/near duplicates in the saved public previews only."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
import cv2
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent

def signatures(path):
    with Image.open(path) as source:
        im=source.convert('RGB');gray=im.convert('L')
        pixels=hashlib.sha256(str(im.size).encode()+im.tobytes()).hexdigest()
        a=np.asarray(gray.resize((9,8)),dtype=np.float32)
        d=sum(int(v)<<i for i,v in enumerate((a[:,1:]>a[:,:-1]).flat))
        low=cv2.dct(np.asarray(gray.resize((32,32)),dtype=np.float32))[:8,:8]
        threshold=np.median(low.flatten()[1:])
        p=sum(int(v)<<i for i,v in enumerate((low>threshold).flat))
    return {'file_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pixel_sha256':pixels,'dhash':f'{d:016x}','phash':f'{p:016x}'}

def main():
    reports=[]
    for dataset in ('missing-tile-v2','stairs-v1'):
        manifest=json.loads((ROOT/'samples'/dataset/'manifest.json').read_text())
        rows=[]
        for a in manifest['assets']:
            if a['name']!='thumb.jpg':continue
            rows.append({'image':a['path'],'source_image_id':urlparse(a['url']).path.split('/')[-2],**signatures(Path(a['path']))})
        pairs=[]
        for i,a in enumerate(rows):
            for b in rows[i+1:]:
                dh=(int(a['dhash'],16)^int(b['dhash'],16)).bit_count()
                ph=(int(a['phash'],16)^int(b['phash'],16)).bit_count()
                exact=a['pixel_sha256']==b['pixel_sha256']
                if exact or dh<=8 or ph<=8:
                    pairs.append({'a':a['image'],'b':b['image'],'exact_pixels':exact,'dhash_distance':dh,'phash_distance':ph})
        pairs.sort(key=lambda r:(not r['exact_pixels'],r['phash_distance'],r['dhash_distance']))
        report={'dataset':dataset,'scope':'12 publicly visible thumbnails, not the full archive','images':len(rows),
                'exact_duplicate_pairs':sum(p['exact_pixels'] for p in pairs),
                'candidate_similar_pairs':sum(not p['exact_pixels'] for p in pairs),
                'screen_rule':'same RGB pixels, or dHash<=8 bits, or pHash<=8 bits. Similarity flags require visual review; no automatic deletion.',
                'rows':rows,'pairs':pairs,'files_deleted':0,'full_dataset_audited':False}
        reports.append(report)
        if pairs:
            sample=pairs[:6];canvas=Image.new('RGB',(900,len(sample)*250),'#f7ebdf');draw=ImageDraw.Draw(canvas)
            for i,pair in enumerate(sample):
                for j,key in enumerate(('a','b')):
                    with Image.open(pair[key]) as im:
                        im.thumbnail((380,220));canvas.paste(im,(20+j*440,i*250))
                draw.text((20,i*250+227),f"pHash distance {pair['phash_distance']}; dHash distance {pair['dhash_distance']}; exact pixels {pair['exact_pixels']}",fill='black')
            canvas.save(ROOT/f'{dataset}-similarity-review.jpg',quality=93)
    (ROOT/'preview-duplicate-audit.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    print(json.dumps([{k:r[k] for k in ('dataset','images','exact_duplicate_pairs','candidate_similar_pairs','full_dataset_audited')} for r in reports],indent=2))

if __name__=='__main__':main()
