"""Build a concise decision report from completed model runs."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def read(relative):return json.loads((ROOT/relative).read_text(encoding='utf-8-sig'))
def ratio(n,d):return f'{n}/{d}'
def metric(value):return 'not applicable' if value is None else f'{value:.3f}'
def main():
    splits=read('datasets/split-summary.json');audit=read('datasets/audit.json')
    gate=read('runs/existing-stair-gate.json');external=read('runs/existing-two-class-stairs.json')
    direction=read('runs/direction/results.json');combined=read('runs/direction/onnx-and-gate-check.json')
    train=read('runs/pothole-training-summary.json');pothole=read('runs/pothole-evaluation/results.json')
    policy=read('evaluation-policy.json')
    d=direction['results'];p=pothole['public_test'];local=pothole['local_domain_test']
    negative=pothole['per_local_clip']['N1-intact']
    pass_pothole=(p['box_precision'] is not None and p['box_precision']>=.5 and p['box_recall']>=.5
        and local['positive_frames_with_localized_match']>=8
        and all(pothole['per_local_clip'][c]['positive_frames_with_localized_match']>=4 for c in ('P1-pothole','P2-pothole'))
        and negative['negative_frames_alerted']<=1
        and all(r['within_point002'] for r in pothole['onnx_raw_output_check'])
        and all(r['torch_detections']==r['onnx_detections'] for r in pothole['onnx_backend_count_check']))
    decisions={'date':'2026-11-23','dataset_audit_passed':audit['checks_passed'],
               'direction_candidate':'rejected for app integration',
               'pothole_candidate':'experimental screening passed; app integration not performed' if pass_pothole else 'rejected for app integration',
               'app_updated':False,'walking_validation':False,'independent_usage_validation':False}
    (ROOT/'decisions.json').write_text(json.dumps(decisions,indent=2),encoding='utf-8')
    lines=['# PathSignal training and evaluation results','',
           '23 November 2026. Work ran locally on the PC CPU, with no paid compute or uploads of the supplied clips. The website and Expo app have not been modified.','',
           '## Decision','',
           '- Stair direction: **do not integrate the new direction classifier**. It memorised its training scenes and did not generalise adequately. The existing stair gate also misses most new stair frames.',
           '- Potholes: **'+decisions['pothole_candidate']+'**.','',
           'These are small engineering screens, not safety acceptance criteria. Counts refer to correlated saved frames, not independent walking trials. Offline "alerts" mean algorithm decisions, not audible phone alerts. The pothole check measures full-frame recognition/localisation before any future app corridor, encounter or speech logic.','',
           '## Prepared data','',
           '- Stair direction: 20 training frames from the original stairwell, 10 validation frames from tiled flight C, and 10 evaluation frames from brick entrance steps D. Classes balanced within each split. Related clips remain grouped. Exact independent site identity is unverified.',
           '- Road potholes: 720 augmented training images from 240 filename source groups, 29 validation images, 30 evaluation images. Polygon annotations converted to enclosing boxes. One validation near-duplicate of training was excluded; a dHash screen is not an exhaustive duplicate audit.',
           '- Local paving evaluation: 10 missing-paver images with 15 approximate assistant-annotated boxes, plus 5 intact-ground negatives. None were used for training or model selection. These are not the same surface distribution as road potholes.',
           '- Structural audit passed: files, label bounds, source-group separation, cross-split exact hashes, and a validation/test dHash screening check.','',
           '## Stair comparison','',
           '| Candidate | Recorded result | Interpretation |','|---|---|---|',
           f"| Current generic stair detector | {gate['stair_frames_alerted']}/{gate['stair_frames']} stair frames alerted; {gate['nonstair_frames_alerted']}/{gate['nonstair_frames']} non-stair frames alerted | Poor on these new scenes |",
           f"| Downloaded Upstair/Downstair detector | {external['subsets']['all_stairs']['correct_direction']}/40 correct direction alerts; {external['subsets']['all_stairs']['stair_alerts']}/40 stair frames alerted | Does not solve the new views |",
           f"| Trained MobileNetV3 feature + direction head | Train {d['train']['correct']}/20; validation {d['val']['correct']}/10; evaluation {d['test']['correct']}/10 | Training fit does not transfer |",
           f"| Existing stair gate followed by trained head | {combined['combined_generic_gate_direction_summary']['test']['correct_direction_warnings']}/10 correct direction warnings on D | A direction head cannot repair a missing stair detection |",'',
           'The backbone used frozen ImageNet weights; the project trained a new linear head. Three regularisation candidates were selected using validation loss only. A fixed 0.8 confidence rule still accepted wrong evaluation predictions: confidence is not calibrated reliability. Direction output is meaningful only behind a working stair gate.','',
           '## Pothole detector','',
           'YOLOv8n transfer training used public road-pothole boxes at 320-pixel input and a frozen early backbone. It completed 13 CPU epochs, stopping after five passes without improvement; the selected checkpoint is from epoch 8. The standard public test metrics below use that checkpoint; local counts use confidence 0.4, NMS IoU 0.3 and reference matching IoU 0.5 fixed before evaluation.','',
           '| Evaluation | Result |','|---|---|',
           f"| Public held-out images | {p['frames']} |",
           f"| Public box precision at fixed threshold | {metric(p['box_precision'])} |",
           f"| Public box recall at fixed threshold | {metric(p['box_recall'])} |",
           f"| Local defect frames with any prediction | {local['positive_frames_with_any_prediction']}/10 |",
           f"| Local defect frames with a matching defect box | {local['positive_frames_with_localized_match']}/10 |",
           f"| Intact-ground frames incorrectly alerted | {negative['negative_frames_alerted']}/5 |",'',
           'Standard Ultralytics public-test metrics (fractions; distinct from the fixed-threshold measurements above):','',
           *[f'- `{k}`: {v:.6f}' for k,v in train['public_test_metrics'].items()], '',
           'Per local clip:', '',
           *[f"- {name}: "+(f"{value['positive_frames_with_localized_match']}/{value['positive_frames']} positive frames localised." if value['positive_frames'] else f"{value['negative_frames_alerted']}/{value['negative_frames']} intact-ground frames produced a false detection.") for name,value in pothole['per_local_clip'].items()], '',
           '## Runtime checks and files','',
           f"- Direction ONNX export: CPU output parity on {combined['parity_examples']} examples; maximum logit difference {combined['max_logit_difference']:.8f}.",
           '- Pothole ONNX export: five fixed local examples checked against PyTorch for raw numerical outputs and postprocessing detection counts. See `runs/pothole-evaluation/results.json` for exact checks.',
           '- These CPU checks do not establish browser/WASM compatibility, iPhone performance or audible warning delay.',
           '- `runs/direction/`: trained direction checkpoint, ONNX and raw comparison records.',
           '- `runs/pothole/`: detector checkpoint, training history and export.',
           '- `runs/pothole-evaluation/`: predictions, metrics and reference/prediction overlays (green reference, red prediction).',
           '- `datasets/`: fixed manifests, prepared labels and audit. `run-provenance.json` records configuration hashes.',
           '- `ATTRIBUTION.md`: model/data sources, transformations and the Kaggle/origin licence discrepancy.','',
           '## What remains before integration','',
           'Use the failure examples to expand the relevant training distribution. Stair data needs varied up/down views and a stronger stair gate; repeated frames from one flight are not a substitute. Missing-paver data must be evaluated separately from asphalt potholes. Preserve untouched locations for the next final assessment: once these evaluation outcomes influence changes, these scenes become development evidence.','',
           'No result here establishes hole depth, warning distance, prevention of falls or suitability for independent walking.']
    (ROOT/'RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps(decisions,indent=2))

if __name__=='__main__':main()
