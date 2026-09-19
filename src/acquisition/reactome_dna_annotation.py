"""Snapshot telomere pathway hierarchy for annotation, never replace frozen memberships."""
import datetime,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/raw/context/reactome_dna';OUT.mkdir(parents=True,exist_ok=True)
manifest=ROOT/'metadata/reactome_dna_annotation.json'
if manifest.exists():
 record=json.loads(manifest.read_text())
 for x in record['assets']:
  assert hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['sha256']
 print('Verified cached Reactome annotation snapshot.');raise SystemExit
assets=[]
def get(endpoint,name):
 url='https://reactome.org/'+endpoint;p=OUT/name
 if p.exists():raise RuntimeError(f'Unmanifested asset: {p}')
 resolved=subprocess.check_output(['curl','-fsSL','--max-time','45','-o',str(p),'-w','%{url_effective}',url],text=True)
 data=p.read_bytes()
 assets.append(dict(url=url,resolved_url=resolved,path=str(p.relative_to(ROOT)),retrieved_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
 return data
version=get('ContentService/data/database/version','version.txt').decode()
get('license','license.html')
nodes=[]
def walk(stid,parent=None):
 d=json.loads(get('ContentService/data/query/'+stid,stid+'.json'))
 node={k:d.get(k) for k in ['stId','stIdVersion','displayName','schemaClass']};node['parent']=parent;nodes.append(node)
 for e in d.get('hasEvent',[]):
  if e['schemaClass']=='Pathway':walk(e['stId'],stid)
walk('R-HSA-157579')
record=dict(database_version=version,license='CC0 for annotation data; CC BY 4.0 for website content; see saved license.html',license_url='https://reactome.org/license',role='Current hierarchy/stable-ID annotation only; gene membership remains MSigDB 2026.1.Hs',assets=assets,nodes=nodes)
manifest.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(nodes,indent=2))
