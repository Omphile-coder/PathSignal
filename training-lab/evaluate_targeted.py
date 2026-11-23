"""Evaluate second-round detectors without adding local frames to training."""
import argparse
import json
import os
import time
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('YOLO_CONFIG_DIR',str(ROOT/'cache'/'ultralytics'))
from evaluate_pothole import iou,summary

def corridor(box,w,h):
    x,y,right,bottom=box
    bottom/=h
    if bottom<.28:return False
    half=.15+(min(.94,bottom)-.28)*.24
    return min(right/w,.5+half)-max(x/w,.5-half)>=min(.035,(right-x)/w*.55)

def main(name):
    import torch
    from ultralytics import YOLO
    from PIL import Image,ImageDraw
    torch.set_num_threads(4)
    training=json.loads((ROOT/'runs'/f'{name}-summary.json').read_text())
    policy=json.loads((ROOT/'targeted-policy.json').read_text())
    model=YOLO(training['checkpoint'])
    out=ROOT/'runs'/(name+'-evaluation');out.mkdir(exist_ok=True)
    public=json.loads((ROOT/'datasets'/name/'manifest.json').read_text())
    paving=json.loads((ROOT/'datasets'/'local-paving-test'/'manifest.json').read_text())['images']
    stairs=json.loads((ROOT/'datasets'/'direction'/'manifest.json').read_text())['images']
    samples=[]
    for r in public['rows']:
        if r['split']=='test':samples.append({'image':r['prepared_image'],'partition':'public_test','label':str(Path(r['prepared_image']).parent.parent/'labels'/ (Path(r['prepared_image']).stem+'.txt'))})
    for r in paving:
        samples.append(dict(r,partition='local_paving',truth_boxes=r['boxes_xyxy'] if name=='missing-tile-v2' else [],expected_direction=None))
    for r in stairs:
        samples.append(dict(r,partition='local_stairs',truth_boxes=[],expected_direction=r['class'].replace('stairs_down','downstairs').replace('stairs_up','upstairs')))
    older=json.loads((ROOT.parent/'model-comparison'/'development-manifest.json').read_text())['frames']
    for r in older:
        if r['source_clip_group'].startswith('stairs'):continue
        samples.append({'image':str(ROOT.parent/r['file']),'partition':'older_surface_review' if r['source_clip_group']=='dark-markings' else 'older_negative_check',
            'clip':r['source_clip_group'],'truth_boxes':[],'expected_direction':None})
    rows=[]
    for row in samples:
        with Image.open(row['image']) as image:w,h=image.size
        truth=row.get('truth_boxes',[]);truth_classes=[]
        if row['partition']=='public_test':
            for line in Path(row['label']).read_text().splitlines():
                cid,x,y,bw,bh=map(float,line.split());truth.append([(x-bw/2)*w,(y-bh/2)*h,(x+bw/2)*w,(y+bh/2)*h]);truth_classes.append(int(cid))
        else:truth_classes=[0]*len(truth)
        start=time.perf_counter()
        result=model.predict(row['image'],imgsz=416,conf=policy['prediction_confidence'],iou=policy['nms_iou'],device='cpu',rect=False,verbose=False)[0]
        predictions=[{'xyxy':b[:4].tolist(),'score':float(b[4]),'class_id':int(b[5]),'class':model.names[int(b[5])],
            'in_corridor':corridor(b[:4],w,h)} for b in result.boxes.data.cpu().numpy()]
        matched=set();tp=0
        for pred in sorted(predictions,key=lambda p:-p['score']):
            options=[(iou(pred['xyxy'],box),j) for j,box in enumerate(truth) if j not in matched and truth_classes[j]==pred['class_id']]
            if options and max(options)[0]>=policy['box_matching_iou']:matched.add(max(options)[1]);tp+=1
        hazards=[p for p in predictions if p['in_corridor']]
        ranked=sorted(hazards,key=lambda p:-p['score'])
        direction=None
        if name=='stairs-v1' and ranked and ranked[0]['score']>=policy['direction_confidence']:
            competing=max((p['score'] for p in ranked if p['class']!=ranked[0]['class']),default=0)
            if ranked[0]['score']-competing>=policy['direction_competing_score_margin']:direction=ranked[0]['class']
        record={**row,'width':w,'height':h,'truth_boxes':truth,'predictions':predictions,'hazards':hazards,'spoken_direction':direction,
            'tp':tp,'fp':len(predictions)-tp,'fn':len(truth)-tp,'milliseconds':round((time.perf_counter()-start)*1000,1)}
        rows.append(record)
        if row['partition']!='public_test':
            with Image.open(row['image']) as im:
                draw=ImageDraw.Draw(im)
                for box in truth:draw.rectangle(box,outline='#00bb55',width=4)
                for p in predictions:
                    draw.rectangle(p['xyxy'],outline='#ff3030',width=3)
                    draw.text(p['xyxy'][:2],f"{p['class']} {p['score']:.2f}",fill='#ff3030')
                im.save(out/Path(row['image']).name)
    def st(rs):
        return {'frames':len(rs),'generic_stair_alerts':sum(bool(r['hazards']) for r in rs),
            'correct_direction':sum(r['spoken_direction']==r.get('expected_direction') and r['spoken_direction'] is not None for r in rs),
            'wrong_direction':sum(r['spoken_direction'] is not None and r['spoken_direction']!=r.get('expected_direction') for r in rs)}
    localstairs=[r for r in rows if r['partition']=='local_stairs'];localpavers=[r for r in rows if r['partition']=='local_paving']
    byclip=defaultdict(list)
    for r in localstairs+localpavers:byclip[r['clip']].append(r)
    report={'dataset':name,'policy':policy,'public_test_fixed_threshold':summary([r for r in rows if r['partition']=='public_test']),
        'local_paving':summary(localpavers),'local_stairs':st(localstairs),
        'per_clip':{k:(st(v) if name=='stairs-v1' else summary(v)) for k,v in byclip.items()},
        'nonstair_false_alert_frames':sum(bool(r['hazards']) for r in localpavers),
        'older_negative_check':{'frames':sum(r['partition']=='older_negative_check' for r in rows),
            'frames_alerted':sum(r['partition']=='older_negative_check' and bool(r['hazards']) for r in rows)},
        'dark_marking_review':{'frames':3,'frames_alerted':sum(r['partition']=='older_surface_review' and bool(r['hazards']) for r in rows),
            'note':'Cracked/marked surface: geometry unknown; not labelled as a safe path or used for a false-positive acceptance count.'},
        'rows':rows,'app_updated':False,'local_frames_are_correlated':True,'local_boxes_single_assistant_annotations':True}
    if name=='stairs-v1':
        groups=defaultdict(list)
        for r in localstairs:groups[r['group']].append(r)
        report['local_stair_groups']={k:st(v) for k,v in groups.items()}
        outdoor=[v for k,v in groups.items() if k!='supplied_brick_tile_stairwell_01']
        report['passes_local_screen']=len(outdoor)==2 and all(st(v)['correct_direction']>=8 for v in outdoor) and st(localstairs)['wrong_direction']<=1 and report['nonstair_false_alert_frames']<=1
    else:
        pub=report['public_test_fixed_threshold']
        report['stair_frames_falsely_labelled_missing_paver']=sum(bool(r['hazards']) for r in localstairs)
        report['passes_local_screen']=all(report['per_clip'][c]['positive_frames_with_localized_match']>=4 for c in ['P1-pothole','P2-pothole']) and report['per_clip']['N1-intact']['negative_frames_alerted']<=1 and report['stair_frames_falsely_labelled_missing_paver']<=2 and (pub['box_precision'] or 0)>=.5 and (pub['box_recall'] or 0)>=.5
    report['passes_local_screen']=report['passes_local_screen'] and report['older_negative_check']['frames_alerted']<=1
    (out/'results.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k not in ('rows','policy')},indent=2),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('name',choices=['stairs-v1','missing-tile-v2']);main(p.parse_args().name)
