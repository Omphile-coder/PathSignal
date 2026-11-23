"""Verify prepared splits and render unpainted-source annotation QA sheets."""
import json
from collections import Counter
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent

def main():
    reports=[]
    for name in ['stairs-v1','missing-tile-v2']:
        folder=ROOT/'datasets'/name
        manifest=json.loads((folder/'manifest.json').read_text())
        seen_groups=set();seen_pixels=set();counts=Counter();issues=[]
        for row in manifest['rows']:
            assert row['group_id'] not in seen_groups
            assert row['pixel_sha256'] not in seen_pixels
            seen_groups.add(row['group_id']);seen_pixels.add(row['pixel_sha256'])
            path=Path(row['prepared_image'])
            label=path.parent.parent/'labels'/(path.stem+'.txt')
            assert path.is_file() and label.is_file()
            for line in label.read_text().splitlines():
                c,x,y,w,h=map(float,line.split())
                assert int(c)==c and 0<=c<len(manifest['classes']) and w>0 and h>0
                assert min(x-w/2,y-h/2)>=-1e-6 and max(x+w/2,y+h/2)<=1+1e-6
                counts[(row['split'],manifest['classes'][int(c)])]+=1
        # Evenly spaced by stable manifest order, covering all partitions.
        samples=manifest['rows'][::max(1,len(manifest['rows'])//24)][:24]
        sheet=Image.new('RGB',(4*288,6*244),'#fff2cc');draw=ImageDraw.Draw(sheet)
        for i,row in enumerate(samples):
            path=Path(row['prepared_image']);im=Image.open(path).convert('RGB');w,h=im.size
            d=ImageDraw.Draw(im)
            for line in (path.parent.parent/'labels'/(path.stem+'.txt')).read_text().splitlines():
                c,x,y,bw,bh=map(float,line.split());box=[(x-bw/2)*w,(y-bh/2)*h,(x+bw/2)*w,(y+bh/2)*h]
                d.rectangle(box,outline='#ff0055',width=4);d.text(box[:2],manifest['classes'][int(c)],fill='#ff0055')
            im.thumbnail((280,210));x=(i%4)*288;y=(i//4)*244
            sheet.paste(im,(x+(280-im.width)//2,y));draw.text((x+5,y+213),row['split']+' '+row['group_id'][:12],fill='#171717')
        destination=ROOT/'dataset-research'/'2026-11-23'/f'{name}-annotation-qa.jpg'
        sheet.save(destination,quality=90)
        reports.append({'dataset':name,'groups':len(seen_groups),'images':len(manifest['rows']),
            'class_annotations':{f'{s}/{c}':n for (s,c),n in counts.items()},'issues':issues,
            'contact_sheet':str(destination),'source_files_deleted':0})
    (ROOT/'dataset-research'/'2026-11-23'/'prepared-data-check.json').write_text(json.dumps(reports,indent=2))
    print(json.dumps(reports,indent=2))
if __name__=='__main__':main()
