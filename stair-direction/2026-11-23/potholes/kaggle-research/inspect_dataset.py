"""Audit the downloaded public archive; no training or application changes."""
import hashlib, io, json, math, zipfile
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
archive=ROOT/'pothole-image-segmentation-dataset.zip'
report={'source':'https://www.kaggle.com/datasets/farzadnekouei/pothole-image-segmentation-dataset',
        'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(), 'splits':{}, 'invalid_labels':[], 'model_trained':False}
with zipfile.ZipFile(archive) as z:
    names=z.namelist()
    for name in names:
        if name.endswith(('data.yaml','README.dataset.txt','README.roboflow.txt')):
            text=z.read(name).decode('utf-8-sig')
            (ROOT/Path(name).name).write_text(text,encoding='utf-8')
            if name.endswith('data.yaml'):report['data_yaml']=text
            if name.endswith('README.roboflow.txt'):report['publisher_readme']=text
    origins={}
    for split in ('train','valid','test'):
        images=[n for n in names if f'/{split}/images/' in n and n.lower().endswith(('.jpg','.png','.jpeg'))]
        labels=[n for n in names if f'/{split}/labels/' in n and n.endswith('.txt')]
        count=empty=missing=0
        origins[split]={Path(n).name.split('.rf.')[0] for n in images}
        for image in images:
            label=str(Path(image).with_suffix('.txt')).replace('\\','/').replace('/images/','/labels/')
            if label not in names:missing+=1;continue
            lines=z.read(label).decode().strip().splitlines()
            if not lines:empty+=1
            for line in lines:
                values=list(map(float,line.split()));count+=1
                if len(values)<7 or (len(values)-1)%2 or values[0]!=0 or not all(math.isfinite(x) and 0<=x<=1 for x in values[1:]):
                    report['invalid_labels'].append(label)
        report['splits'][split]={'images':len(images),'labels':len(labels),'polygons':count,'empty_labels':empty,'missing_labels':missing,
                                'source_name_groups':len(origins[split])}
    report['train_valid_source_name_overlap']=sorted(origins['train']&origins['valid'])
    samples=[n for n in names if '/valid/images/' in n and n.endswith('.jpg')][:6]
    sheet=Image.new('RGB',(960,700),'#f7ebdf');draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(samples):
        image=Image.open(io.BytesIO(z.read(n))).convert('RGB');image.thumbnail((300,300))
        x=(i%3)*320+10;y=(i//3)*350+10;sheet.paste(image,(x,y));draw.text((x,y+310),Path(n).name[:37],fill='black')
    sheet.save(ROOT/'validation-preview.jpg',quality=90)
(ROOT/'inspection.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
