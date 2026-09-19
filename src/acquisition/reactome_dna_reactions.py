"""Supplement hierarchy snapshot with two descriptive reaction annotations."""
import datetime,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'data/raw/context/reactome_dna'
p=ROOT/'metadata/reactome_dna_reactions.json'
if p.exists():
 d=json.loads(p.read_text())
 for a in d['assets']:assert hashlib.sha256((ROOT/a['path']).read_bytes()).hexdigest()==a['sha256']
else:d={'assets':[],'reactions':[]}
assets=d['assets'];reactions=d['reactions']
for stid,label in [('R-HSA-9670149','TERRA transcription participants'),('R-HSA-164616','Telomerase RNP assembly participants'),('R-HSA-171306','Packaging / protection')]:
 if any(r['id']==stid for r in reactions):continue
 url=f'https://reactome.org/ContentService/data/participants/{stid}/referenceEntities';target=out/(stid+'_referenceEntities.json');assert not target.exists()
 resolved=subprocess.check_output(['curl','-fsSL','--max-time','45','-o',str(target),'-w','%{url_effective}',url],text=True)
 b=target.read_bytes();assets.append(dict(url=url,resolved_url=resolved,path=str(target.relative_to(ROOT)),retrieved_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
 refs=json.loads(b);reactions.append(dict(id=stid,label=label,genes=sorted({g for r in refs for g in r.get('geneName',[]) if r.get('databaseName')=='UniProt'})))
p.write_text(json.dumps(dict(database_version='97',license='CC0 annotation data',license_evidence='metadata/reactome_dna_annotation.json',role='Descriptive reaction annotations only; no enrichment tests, no frozen membership changes; includes complex participants and recorded aliases',assets=assets,reactions=reactions),indent=2)+'\n')
