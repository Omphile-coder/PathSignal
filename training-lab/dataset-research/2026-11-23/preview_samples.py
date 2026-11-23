"""Make documentary contact sheets from public page preview assets, not training exports."""
import json
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent
for dataset in ('missing-tile-v2','stairs-v1'):
    folder=ROOT/'samples'/dataset
    data=json.loads((folder/'manifest.json').read_text(encoding='utf-8-sig'))
    grouped={}
    for a in data['assets']:
        a['path']=str(folder/Path(a['path']).name)
        group=urlparse(a['url']).path.split('/')[-2]
        grouped.setdefault(group,{})['annotation' if a['name']=='annotation.png' else 'image']=a
    canvas=Image.new('RGB',(1280,1050),'#f7ebdf');draw=ImageDraw.Draw(canvas)
    for i,(identity,pair) in enumerate(grouped.items()):
        if 'image' not in pair:raise RuntimeError('Missing image partner')
        with Image.open(pair['image']['path']) as source:
            im=source.convert('RGBA')
            if 'annotation' in pair:
                with Image.open(pair['annotation']['path']) as overlay:
                    im=Image.alpha_composite(im,overlay.convert('RGBA').resize(im.size))
            im.thumbnail((300,300))
            x=i%4*320+10;y=i//4*350+10
            canvas.paste(im.convert('RGB'),(x+(300-im.width)//2,y+(300-im.height)//2))
            draw.text((x,y+310),f'{i+1:02d} | {identity[:20]}',fill='black')
    canvas.save(ROOT/f'{dataset}-preview.jpg',quality=94)
    data['review_asset_scope']='Twelve public preview images plus their rendered annotation overlays; not a full image/YOLO-label archive.'
    (folder/'manifest.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(dataset,len(grouped),'preview images')
