"""Record literal URLs in built assets alongside the browser's request audit."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];dist=ROOT/'explorer/dist'
assets=[]
for p in sorted(dist.rglob('*')):
 if p.is_file() and p.suffix in {'.js','.css','.html'}:
  s=p.read_text();assert 'fonts.googleapis.com' not in s and 'fonts.gstatic.com' not in s,p
  urls=sorted(set(re.findall(r'https?://[^\s\"\x27<>`\\)]+',s)))
  assets.append(dict(path=str(p.relative_to(dist)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),url_literals=urls))
browser=json.loads((ROOT/'explorer/screenshots/browser-check.json').read_text())
assert browser['passed'] and not browser['externalRequests'] and not browser['failedRequests']
report=dict(assets=assets,browser=browser,scope='Built HTML/CSS/JS literals plus desktop/mobile interaction suite with all off-origin requests blocked. SVG namespace identifiers are not fetches; provenance JSON source links are deliberate outbound navigation.',limits='Requires HTTP serving; clean source installation/build may need npm network access. No service-worker caching or file URL support. Not a public-host deployment test.')
(ROOT/'provenance/explorer_runtime_audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('No Google-font references in built assets; browser recorded only local-origin requests and no failures.')
