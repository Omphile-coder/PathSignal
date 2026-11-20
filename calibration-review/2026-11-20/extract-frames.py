import json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent
ffmpeg = next(Path(r'C:\Users\lucas\Documents\Codex\2026-11-11\am\work\python\imageio_ffmpeg\binaries').glob('*.exe'))
metadata = json.loads((ROOT / 'clips.json').read_text(encoding='utf-8-sig'))
target = ROOT / 'frames'
target.mkdir(exist_ok=True)
for clip in metadata['clips']:
    details = subprocess.run([str(ffmpeg), '-hide_banner', '-i', clip['path']], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', details).groups()
    duration = int(h) * 3600 + int(m) * 60 + float(s)
    clip['duration_seconds'] = duration
    if clip['label'] == 'stairs-up': clip['observed_view'] = 'looking downstairs; original user label retained'
    if clip['label'] == 'stairs-down': clip['observed_view'] = 'facing upstairs; original user label retained'
    if clip['label'] == 'dark-markings': clip['surface_geometry'] = 'cracked or patched paving; actual unevenness unverified'
    for i, fraction in enumerate((.2, .5, .8)):
        subprocess.run([str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(duration * fraction), '-i', clip['path'],
            '-vf', "scale='if(gte(iw,ih),480,-2)':'if(gte(iw,ih),-2,480)'", '-frames:v', '1', '-q:v', '2', str(target / f"{clip['label']}-{i}.jpg")], check=True)
(ROOT / 'clips.json').write_text(json.dumps(metadata, indent=2))
print('Extracted 3 development frames per supplied clip; heights remain unknown')
