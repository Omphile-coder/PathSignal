import hashlib,json,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
archive=ROOT/'presentation-site/public/source/pathsignal-source.zip'
stage=ROOT/'model-comparison/source-package-check'
stage.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    names=z.namelist()
    assert not any(any(p in ('node_modules','.expo','.vercel','.git') for p in Path(n).parts) or Path(n).name.startswith('.env') for n in names)
    hashes=json.loads(z.read('SOURCE-FILE-HASHES.json'))
    for name,digest in hashes.items():
        assert hashlib.sha256(z.read(name)).hexdigest()==digest,name
        assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,'Current source changed: '+name
    required=['source-setup.mjs','presentation-site/source-model/manifest.json','presentation-site/source-model/stairs-yolov8n.onnx','presentation-site/source-model/stairs-yolov8n-manifest.json']
    meta=json.loads(z.read('presentation-site/source-model/manifest.json'))
    required+=['presentation-site/source-model/'+p['file'] for p in meta['parts']]
    for name in required:
        target=(stage/name).resolve();target.relative_to(stage.resolve())
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
subprocess.run(['node',str(stage/'source-setup.mjs')],check=True)
assert hashlib.sha256((stage/'phone/assets/model/stairs-yolov8n.onnx').read_bytes()).hexdigest()==hashlib.sha256((ROOT/'phone/assets/model/stairs-yolov8n.onnx').read_bytes()).hexdigest()
assert hashlib.sha256((stage/'phone/assets/model/yolox_s.onnx').read_bytes()).hexdigest()==hashlib.sha256((ROOT/'phone/assets/model/yolox_s.onnx').read_bytes()).hexdigest()
print('Source archive verified:',len(hashes),'files; no excluded credential/cache files; both phone weights restored with matching hashes.')
