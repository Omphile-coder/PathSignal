"""Download authenticated Roboflow ORT artifacts; keep credentials in memory only."""
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
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from check_access import ROOT, MODELS, safe_error_message

ARTIFACTS=ROOT/'artifacts'
MAX_MODEL_BYTES=256*1024*1024

def safe_metadata(value,key=''):
    if isinstance(value,dict):
        return {k:safe_metadata(v,key) for k,v in value.items()
                if not re.search(r'api[_-]?key|password|secret|token|signed.?url',str(k),re.I)}
    if isinstance(value,list): return [safe_metadata(v,key) for v in value]
    if isinstance(value,str):
        if key: value=value.replace(key,'[REDACTED]')
        return re.sub(r'https?://[^\s"<>]+\?[^\s"<>]+','[signed URL omitted]',value)
    return value

def artifact_url(value):
    if not isinstance(value,str): raise ValueError('Missing artifact URL')
    parsed=urlparse(value)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Invalid artifact URL')
    return value

def read_json(url,headers=None):
    with urlopen(Request(url,headers=headers or {}),timeout=60) as response:
        return json.loads(response.read(4*1024*1024))

def fetch_weights(url,target,max_bytes=MAX_MODEL_BYTES):
    url=artifact_url(url)
    partial=target.with_suffix('.partial')
    digest=hashlib.sha256(); size=0; next_progress=8*1024*1024
    try:
        # Artifact links are signed; never forward the API Authorization header.
        with urlopen(Request(url),timeout=60) as response, partial.open('wb') as output:
            length=response.headers.get('Content-Length')
            if length and int(length)>max_bytes: raise ValueError('Model exceeds download size limit')
            while chunk:=response.read(1024*1024):
                size+=len(chunk)
                if size>max_bytes: raise ValueError('Model exceeds download size limit')
                output.write(chunk);digest.update(chunk)
                if size>=next_progress:
                    print('  Downloaded',round(size/1024/1024),'MB',flush=True)
                    next_progress+=8*1024*1024
            if length and size!=int(length): raise ValueError('Incomplete artifact download')
        if size==0: raise ValueError('Empty artifact')
        partial.replace(target)
        return {'file':target.name,'bytes':size,'sha256':digest.hexdigest()}
    finally:
        if partial.exists(): partial.unlink()

def inspect_model(path):
    import onnxruntime as ort
    options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
    session=ort.InferenceSession(str(path),sess_options=options,providers=['CPUExecutionProvider'])
    info={'cpu_session_created':True,
          'inputs':[{'name':v.name,'shape':v.shape,'type':v.type} for v in session.get_inputs()],
          'outputs':[{'name':v.name,'shape':v.shape,'type':v.type} for v in session.get_outputs()],
          'metadata_field_names':list(session.get_modelmeta().custom_metadata_map)}
    del session
    return info

def fetch_model(name,model_id,key,device_id):
    directory=ARTIFACTS/model_id.replace('/','--');directory.mkdir(parents=True,exist_ok=True)
    base={'name':name,'model_id':model_id,'inference_run':False}
    print(name+': fetching model artifacts',flush=True)
    try:
        query=urlencode({'nocache':'true','device':device_id,'dynamic':'true'})
        payload=read_json('https://api.roboflow.com/ort/'+model_id+'?'+query,{'Authorization':'Bearer '+key})
        spec=payload.get('ort',{})
        environment=read_json(artifact_url(spec.get('environment')))
        if not isinstance(environment,dict): raise ValueError('Unexpected preprocessing metadata')
        weights=fetch_weights(spec.get('model'),directory/'weights.onnx')
        (directory/'environment.json').write_text(json.dumps(safe_metadata(environment,key),indent=2),encoding='utf-8')
        if 'classes' in spec:
            (directory/'classes.json').write_text(json.dumps(safe_metadata(spec['classes'],key),indent=2),encoding='utf-8')
        record={**base,'state':'downloaded; inference and mobile compatibility unverified','weights':weights,
                'environment_fields':list(safe_metadata(environment,key)),
                'artifact_source':'Roboflow authenticated ORT endpoint; signed URLs not retained',
                'model_permission_review':'Public card terms recorded separately; not cleared for redistribution by this downloader'}
        (directory/'artifact.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
        try:
            record['inspection']=inspect_model(directory/'weights.onnx')
            print('  Downloaded; ONNX Runtime CPU session opened.',flush=True)
        except Exception as error:
            record['inspection']={'cpu_session_created':False,'error_type':type(error).__name__,
                                  'note':'Downloaded artifact retained; runtime support requires investigation.'}
            print('  Downloaded; local runtime compatibility needs investigation.',flush=True)
        (directory/'inspection.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
        return record
    except HTTPError as error:
        status=error.code
        try:
            with error: diagnostic=safe_error_message(json.loads(error.read(16384)),key)
        except (ValueError,OSError): diagnostic='No readable API error message'
        state={401:'Key required or invalid',402:'Payment/credits required; stopped without purchasing',403:'Artifact access denied',404:'Artifact not found',429:'Rate limit reached'}.get(status,'Artifact request failed')
        print('  HTTP',status,'-',state,flush=True)
        return {**base,'state':state,'http_status':status,'diagnostic':diagnostic}
    except (URLError,TimeoutError,OSError,ValueError,TypeError,KeyError) as error:
        print('  Download/metadata error; see report for error type.',flush=True)
        return {**base,'state':'Download or metadata error','error_type':type(error).__name__}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cached-only',action='store_true',help='Inspect downloaded artifacts without credentials or network access')
    args=parser.parse_args()
    ARTIFACTS.mkdir(exist_ok=True)
    if args.cached_only:
        paths=sorted(ARTIFACTS.glob('*/weights.onnx'))
        for path in paths:
            try: print(path.parent.name, json.dumps(inspect_model(path)))
            except Exception as error: print(path.parent.name,'inspection failed:',type(error).__name__)
        print('Cached model files:',len(paths));return 0
    key=os.environ.get('ROBOFLOW_API_KEY','').strip()
    if not key:
        if not sys.stdin.isatty(): print('Open Download Roboflow Models.cmd to enter the key privately.');return 2
        print('Downloads three model artifacts only. No videos/photos are uploaded; no purchases are made.')
        print('The API key and signed download URLs are not saved. Files can be large; keep this window open.')
        key=getpass.getpass('Private Roboflow API key (hidden; Enter cancels): ').strip()
        if not key: print('Cancelled.');return 2
    device_file=ROOT/'device-id.txt'
    if not device_file.exists():device_file.write_text(str(uuid.uuid4()),encoding='utf-8')
    device_id=str(uuid.UUID(device_file.read_text(encoding='utf-8').strip()))
    rows=[]
    for name,model_id in MODELS: rows.append(fetch_model(name,model_id,key,device_id))
    key=''
    report={'checked_at':datetime.now(timezone.utc).isoformat(),'images_uploaded':False,'credential_saved':False,
            'inference_run':False,'results':rows,'next':'Inspect downloaded preprocessing and class mappings, then implement and compare the correct decoder on development frames.'}
    (ROOT/'download-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    count=sum('weights' in row for row in rows)
    print('Downloaded',count,'of',len(MODELS),'models. Results saved in model-comparison/download-results.json.')
    return 0 if count==len(MODELS) else 1

if __name__=='__main__':
    try:raise SystemExit(main())
    except KeyboardInterrupt:print('\nCancelled; no key saved.');raise SystemExit(2)
