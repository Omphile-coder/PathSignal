"""Package current shipped application source, excluding secrets and private clips."""
import hashlib
import json
import os
import zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DEST=ROOT/'presentation-site/public/source'
SKIP={'node_modules','.git','.expo','.openai','.vercel','__pycache__','.build','verification'}

def selected():
    for name in ('source-setup.mjs','SOURCE-README.md','package_source.py'):
        yield ROOT/name
    for top in ('phone','presentation-site'):
        for directory,dirs,files in os.walk(ROOT/top):
            dirs[:]=[d for d in dirs if d not in SKIP and not d.startswith('dist')]
            folder=Path(directory);relative=folder.relative_to(ROOT).as_posix()
            if relative.startswith(('phone/assets/model','presentation-site/public/model','presentation-site/public/runtime','presentation-site/public/source')):
                dirs[:]=[];continue
            for name in files:
                if name.startswith('.env') or name.endswith(('.local','.lnk','.partial','.pyc')):continue
                if relative=='presentation-site/source-model' and name in ('stairs.onnx','stairs-manifest.json'):continue
                yield folder/name

def main():
    DEST.mkdir(exist_ok=True)
    source=sorted(set(selected()))
    manifest={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in source}
    archive=DEST/'pathsignal-source.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as output:
        for path in source:output.write(path,path.relative_to(ROOT).as_posix())
        output.writestr('SOURCE-FILE-HASHES.json',json.dumps(manifest,indent=2))
    report={'file':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
            'source_files':len(source),'licence':'AGPL-3.0-or-later for application source; retain third-party notices',
            'contents':'Current browser/Expo/native module source, lockfiles, models, audio, public samples and build scripts',
            'excludes':'Credentials, dependency caches, generated bundles, private clips and historical research datasets'}
    (DEST/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))

if __name__=='__main__':main()
