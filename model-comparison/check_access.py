"""Check official Roboflow model access; never upload images or save credentials."""
import argparse
import getpass
import hashlib
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlencode, quote, quote_plus

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
MODELS = [
    ('Staircase Detection', 'staircase-detection-mrpt2/1'),
    ('Accessibility Street', 'accesibility-street/11'),
    ('Obstacle Detection', 'obstacle-detection-n3eec/1'),
]

def make_manifest():
    baseline = json.loads((PROJECT/'presentation-site/verification/stair-development-frames.json').read_text(encoding='utf-8-sig'))
    old = {r['file']:r for r in baseline['rows']}
    rows = []
    for path in sorted((PROJECT/'calibration-review/2026-11-20/frames').glob('*.jpg')):
        # Historical filenames were based on user descriptions; observed views differ.
        if path.name.startswith('stairs-up-'):
            direction = 'downstairs'
        elif path.name.startswith('stairs-down-'):
            direction = 'upstairs'
        else:
            direction = 'no staircase labelled in development review'
        rows.append({'file':str(path.relative_to(PROJECT)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                     'source_clip_group':path.stem.rsplit('-',1)[0], 'observed_stair_view':direction,
                     'baseline_segformer_stair_alert':old.get(path.name,{}).get('alert'),
                     'ground_hazard_geometry':'unverified', 'metric_distance_ground_truth':None})
    manifest={'purpose':'Development comparison, not independent trials or final accuracy',
              'frames':rows, 'frame_count':len(rows),
              'notes':['Three correlated frames per supplied clip.', 'Dark markings/damaged paving are not verified open holes.',
                       'Historical stairs-up filename shows downstairs; stairs-down shows upstairs.',
                       'Model access check does not perform inference or upload these files.']}
    (ROOT/'development-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return manifest

def safe_error_message(payload, key):
    error=payload.get('error', {}) if isinstance(payload,dict) else {}
    message=error.get('message') if isinstance(error,dict) else error
    if not isinstance(message,str) and isinstance(payload,dict): message=payload.get('message')
    if not isinstance(message,str): return 'No readable API error message'
    if key:
        for value in {key,quote(key,safe=''),quote_plus(key)}:
            message=message.replace(value,'[REDACTED]')
    message=re.sub(r'https?://[^\s<>"\']+', '[URL omitted]', message, flags=re.I)
    message=re.sub(r'(?i)\bBearer\s+\S+', 'Bearer [REDACTED]', message)
    message=re.sub(r'(?i)(api[_ -]?key\s*[:=]\s*)[^\s,;]+', r'\1[REDACTED]', message)
    return ' '.join(message.split())[:300]

def check_model(name, model_id, key, device_id=None):
    headers={'User-Agent':'PathSignal-model-access-check'}
    if key: headers['Authorization']='Bearer '+key
    # Match the public Inference SDK's model-artifact request parameters.
    # The credential stays in the header, never in the URL.
    params=urlencode({'nocache':'true','device':device_id or str(uuid.uuid4()),'dynamic':'true'})
    request=Request('https://api.roboflow.com/ort/'+model_id+'?'+params,headers=headers)
    try:
        with urlopen(request,timeout=30) as response:
            payload=json.load(response)
            # Signed artifact URLs and arbitrary API payloads must not enter reports.
            return {'name':name,'model_id':model_id,'http_status':response.status,
                    'state':'metadata_accessible; weights and compatibility still unverified',
                    'response_top_level_fields':[k for k in payload if isinstance(k,str) and key not in k] if key else list(payload),
                    'inference_run':False}
    except HTTPError as error:
        reason={400:'Request rejected; see API diagnostic',401:'API key required or invalid',403:'Key lacks model access',402:'Credits/payment required; stop without purchasing',404:'Model artifact endpoint not found',429:'Rate limit reached; retry later'}.get(error.code,'API request failed')
        try:
            with error: diagnostic=safe_error_message(json.loads(error.read(16384)),key)
        except (ValueError,OSError): diagnostic='No readable API error message'
        return {'name':name,'model_id':model_id,'http_status':error.code,'state':reason,'diagnostic':diagnostic,'inference_run':False}
    except (URLError, TimeoutError, OSError, ValueError):
        return {'name':name,'model_id':model_id,'state':'Network or response error; no exception details logged','inference_run':False}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--no-prompt',action='store_true',help='Use existing environment key or check unauthenticated access')
    parser.add_argument('--manifest-only',action='store_true',help='Prepare frame inventory without network requests')
    args=parser.parse_args()
    manifest=make_manifest()
    print('Prepared',manifest['frame_count'],'development frames across',len({r['source_clip_group'] for r in manifest['frames']}),'clip groups.')
    if args.manifest_only: return 0
    key=os.environ.get('ROBOFLOW_API_KEY','').strip()
    if not key and not args.no_prompt:
        if not sys.stdin.isatty():
            print('Open the launcher directly to enter your key privately.');return 2
        print('Paste the PRIVATE API key from https://app.roboflow.com/settings/api')
        print('Input is hidden. The key is used only for these requests and is not saved.')
        key=getpass.getpass('Roboflow API key (press Enter to cancel): ').strip()
        if not key: print('Cancelled.');return 2
    results=[]
    device_file=ROOT/'device-id.txt'
    if not device_file.exists(): device_file.write_text(str(uuid.uuid4()),encoding='utf-8')
    device_id=str(uuid.UUID(device_file.read_text(encoding='utf-8').strip()))
    for name,model_id in MODELS:
        result=check_model(name,model_id,key,device_id); results.append(result)
        print(name+': HTTP '+str(result.get('http_status','unavailable'))+' - '+result['state'])
        if result.get('diagnostic'): print('  API: '+result['diagnostic'])
    authenticated=bool(key)
    key=''
    report={'checked_at':datetime.now(timezone.utc).isoformat(),'authenticated_request':authenticated,
            'credential_saved':False,'images_uploaded':False,'models_downloaded':False,'inference_run':False,
            'models':results,'next':'After successful access, inspect supported model artifacts and prepare the appropriate local runtime before running the frame comparison.'}
    output=ROOT/('access-results.json' if authenticated else 'unauthenticated-access-results.json')
    output.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Saved:',output)
    return 0 if all(r.get('http_status')==200 for r in results) else 1

if __name__=='__main__':
    try: raise SystemExit(main())
    except KeyboardInterrupt: print('\nCancelled. No key saved.');raise SystemExit(2)
