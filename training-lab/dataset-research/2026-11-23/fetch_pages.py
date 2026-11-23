"""Inspect public dataset cards and their embedded metadata; no authentication."""
import concurrent.futures
import json
import re
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parent
URLS={
 'up-down-stairs':'https://universe.roboflow.com/stairs-n9kkx/up-down-stairs',
 'missing-tile':'https://universe.roboflow.com/aoqiangma/missing_tile',
 'sidewalk-dongeui':'https://universe.roboflow.com/dongeui-university/sidewalk-exydy',
 'damaged-sidewalk':'https://universe.roboflow.com/meliss-workspace-oniq8/damaged-sidewalk',
 'pothole-workspace':'https://universe.roboflow.com/potholesemanticsdataset',
}
def fetch(item):
    name,url=item
    try:
        with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:html=r.read().decode()
        raw=ROOT/'raw';raw.mkdir(exist_ok=True)
        (raw/f'{name}.html').write_text(html,encoding='utf-8')
        match=re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',html,re.S)
        data=json.loads(match.group(1)) if match else {}
        (raw/f'{name}.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
        links=re.findall(r'href="([^"]+)"',html)
        return {'name':name,'url':url,'html_bytes':len(html),'next_data_keys':list(data.get('props',{}).get('pageProps',{})),
                'links':[x for x in links if any(y in x.lower() for y in ('browse','dataset','pave','craft','missing'))][:30]}
    except Exception as e:return {'name':name,'error':type(e).__name__}
if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(fetch,URLS.items()))
    (ROOT/'page-fetch.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2))
