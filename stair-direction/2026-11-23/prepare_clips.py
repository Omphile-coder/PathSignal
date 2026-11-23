"""Extract review frames without altering the supplied source videos."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ATTACH = Path(r'C:\Users\lucas\.codex\codex-remote-attachments\01a1cb75-c927-78d3-992c-6742da228f58')
FFMPEG = next(Path(r'C:\Users\lucas\Documents\Codex\2026-11-11\am\work\python\imageio_ffmpeg\binaries').glob('*.exe'))
CLIPS = [
    ('A-up', 'B546A9C4-E4FD-4AE6-A4B4-E3EC6155F27F/1-IMG_1286.mov'),
    ('A-down', 'AB6C612F-D0C3-4618-98A5-B45A4AB5A475/1-IMG_1289.mov'),
    ('B-up', '83EA3285-53DB-4777-8576-16C634F88CCA/1-IMG_1287.mov'),
    ('B-down', '3DEC5F3F-3B7A-4898-BEA3-FA8ED902AF0B/1-IMG_1288.mov'),
]

def main():
    records = []
    for label, relative in CLIPS:
        path = ATTACH / relative
        out = ROOT / 'frames' / label
        out.mkdir(parents=True, exist_ok=True)
        details = subprocess.run([str(FFMPEG), '-hide_banner', '-i', str(path)], capture_output=True, text=True).stderr
        (out / 'video-metadata.txt').write_text(details, encoding='utf-8')
        match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', details)
        if not match:
            raise RuntimeError(f'Cannot read duration: {label}')
        h, m, s = match.groups()
        duration = int(h)*3600 + int(m)*60 + float(s)
        record = {'clip_id':label, 'staircase_group':label[0], 'user_label':label.split('-')[1],
                  'source_path':str(path), 'source_sha256':hashlib.file_digest(path.open('rb'), 'sha256').hexdigest(),
                  'duration_seconds':duration, 'frames':[], 'review_status':'pending',
                  'split':'unassigned; keep every frame from one staircase together'}
        sheet = Image.new('RGB', (1300, 535), '#f7ebdf')
        draw = ImageDraw.Draw(sheet)
        draw.text((12, 12), f'{label} | original user label | five chronological review frames', fill='#1c1b1a')
        for i, fraction in enumerate((.1, .3, .5, .7, .9)):
            timestamp = round(duration*fraction, 3)
            frame = out / f'{label}-{i+1:02d}.jpg'
            subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(timestamp), '-i', str(path),
                            '-vf', "scale='if(gte(iw,ih),1280,-2)':'if(gte(iw,ih),-2,1280)'",
                            '-frames:v', '1', '-q:v', '2', str(frame)], check=True)
            with Image.open(frame) as image:
                thumb = image.copy()
                thumb.thumbnail((250, 450))
                sheet.paste(thumb, (i*260+(260-thumb.width)//2, 48+(450-thumb.height)//2))
                draw.text((i*260+12, 508), f'{timestamp:.2f}s | {frame.name}', fill='#1c1b1a')
                record['frames'].append({'path':str(frame.relative_to(ROOT)), 'timestamp_seconds':timestamp,
                                         'width':image.width, 'height':image.height, 'annotation_status':'pending visual review'})
        sheet.save(ROOT / f'{label}-contact-sheet.jpg', quality=92)
        records.append(record)
    (ROOT / 'manifest.json').write_text(json.dumps({'purpose':'stair-direction development review; not a trained model or independent benchmark',
                                                  'clips':records}, indent=2), encoding='utf-8')
    print(json.dumps([{'clip':r['clip_id'], 'seconds':r['duration_seconds'], 'frames':len(r['frames'])} for r in records], indent=2))

if __name__ == '__main__':
    main()
