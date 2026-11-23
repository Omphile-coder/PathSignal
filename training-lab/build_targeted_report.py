"""Write measured second-round outcomes, never infer deployment from training."""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def main():
    records=[]
    for name in ['stairs-v1','missing-tile-v2']:
        training=json.loads((ROOT/'runs'/f'{name}-summary.json').read_text())
        evaluation=json.loads((ROOT/'runs'/(name+'-evaluation')/'results.json').read_text())
        onnx=json.loads((ROOT/'runs'/(name+'-evaluation')/'onnx-check.json').read_text())
        browser_path=ROOT/'runs'/(name+'-evaluation')/'browser-check.json'
        browser=json.loads(browser_path.read_text()) if browser_path.exists() else None
        artifacts=[]
        for kind in ['checkpoint','onnx']:
            p=Path(training[kind]);data=p.read_bytes()
            artifacts.append({'kind':kind,'path':str(p),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        passed=bool(evaluation['passes_local_screen'])
        runtime=bool(onnx['all_passed'] and browser and browser['passed'])
        decision='rejected_for_live_integration' if not passed else 'runtime_check_failed_or_pending' if not runtime else 'qualifies_for_experimental_integration'
        records.append({'dataset':name,'decision':decision,'passes_local_screen':passed,'passes_runtime_screen':runtime,
            'training':training,'evaluation':{k:v for k,v in evaluation.items() if k not in ['rows','policy']},
            'cpu_onnx_passed':onnx['all_passed'],'browser_passed':browser['passed'] if browser else None,
            'artifacts':artifacts,'app_updated':False,'physical_iphone_tested':False})
    (ROOT/'targeted-decisions.json').write_text(json.dumps(records,indent=2))
    stairs,pavers=records
    s=stairs['evaluation'];p=pavers['evaluation']
    lines=['# Targeted model results — 23 November 2026','',
        'These results concern recorded development frames and internal public-dataset benchmarks. They do not establish walking safety, warning distance, general hole detection or independent use. No local video frames were used for this round’s training or checkpoint selection.','',
        '## Downloads and duplicate checks','',
        'Full Roboflow archives were downloaded: 1,289 stair images and 432 missing-tile images. Audits found no exact pixel duplicates or invalid annotations. Similarity screening found 381 cross-split candidate stair pairs and seven cross-split candidate paver pairs. Connected-component grouping and representative selection produced 544 stair images and 406 paver images. Source ZIPs were preserved. See SECOND-ROUND.md for licences, class maps and limitations.','',
        'The missing-paver images share very similar tiled backgrounds. A public benchmark score is not evidence of performance on new paving locations. Local reference boxes are approximate single-assistant annotations, without independent adjudication.','',
        '## Stair direction','',
        f"- Decision: **{stairs['decision']}**.",
        f"- Generic stair warnings: **{s['local_stairs']['generic_stair_alerts']}/40** stair frames.",
        f"- Correct directional warnings: **{s['local_stairs']['correct_direction']}/40**; wrong directional warnings: **{s['local_stairs']['wrong_direction']}/40**. Other frames abstained from direction.",
        f"- Non-stair paver/intact frames warned: **{s['nonstair_false_alert_frames']}/15**.",
        f"- Older non-stair checks warned: **{s['older_negative_check']['frames_alerted']}/{s['older_negative_check']['frames']}**.",'',
        '| Local clip | Frames | Generic warning | Correct direction | Wrong direction |','|---|---:|---:|---:|---:|']
    for c,v in s['per_clip'].items():
        if c in ['P1-pothole','P2-pothole','N1-intact']:continue
        lines.append(f"| {c} | {v['frames']} | {v['generic_stair_alerts']} | {v['correct_direction']} | {v['wrong_direction']} |")
    lines+=['','Stair predictions require a detection score of 0.4. Direction additionally requires score 0.6 and a 0.15 margin above the competing direction. Generic warnings and direction are scored separately. Frame counts are correlated views, not independent trials.','',
        '## Missing pavers','',
        f"- Decision: **{pavers['decision']}**.",
        f"- Local defect frames with a matching box: **{p['local_paving']['positive_frames_with_localized_match']}/10**.",
        f"- Intact-ground frames producing a prediction: **{p['per_clip']['N1-intact']['negative_frames_alerted']}/5**.",
        f"- Stair frames falsely warned as missing pavers in the corridor: **{p['stair_frames_falsely_labelled_missing_paver']}/40**.",
        f"- Older negative checks warned: **{p['older_negative_check']['frames_alerted']}/{p['older_negative_check']['frames']}**.",'',
        '| Local clip | Frames | Frames with matched defect | Negative frames predicted |','|---|---:|---:|---:|']
    for c in ['P1-pothole','P2-pothole','N1-intact']:
        v=p['per_clip'][c]
        lines.append(f"| {c} | {v['frames']} | {v['positive_frames_with_localized_match']} | {v['negative_frames_alerted']} |")
    lines+=['','Local box matching uses IoU 0.5, confidence 0.4, NMS IoU 0.3. Detection/localization and corridor warning counts are distinct. The general road-pothole model from the first round matched 1/10 local defect frames; that prior result remains preserved in RESULTS.md.','',
        '## Export and runtime checks','',
        '| Model | CPU ONNX parity | Browser WASM parity | Physical iPhone |','|---|---|---|---|']
    for r in records:
        lines.append(f"| {r['dataset']} | {r['cpu_onnx_passed']} | {r['browser_passed']} | Not tested |")
    lines+=['','Per-image predictions and failures are saved in each `runs/<dataset>-evaluation/` folder. Weight paths, hashes and exact decisions are in `targeted-decisions.json`. The report does not claim an app deployment; that must be verified separately after an accepted integration.','',
        '## What this supports','',
        'A candidate passing these small checks qualifies only for an explicitly experimental app feature. A rejected candidate remains in the lab rather than replacing working object detection. Further tuning on these known scenes requires fresh locations for a final assessment.','']
    (ROOT/'TARGETED-RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
    print(json.dumps([{'dataset':r['dataset'],'decision':r['decision']} for r in records],indent=2))

if __name__=='__main__':main()
