#!/usr/bin/env python3
"""Freeze representative reusable OXPHOS coordinate models; no model generation."""
import concurrent.futures,datetime,hashlib,json,threading,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'src/assets/public-context';index=json.loads((out/'index.json').read_text());resources=index.get('resources',{});failures=[];lock=threading.Lock();pending={}
retrieved=datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(url,kind):
 with lock:
  if url in resources:return resources[url]
  event=pending.get(url)
  if event is None:event=pending[url]=threading.Event();owner=True
  else:owner=False
 if not owner:
  event.wait()
  return resources.get(url)
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'PsilocinAtlas-structure-snapshot/1.0','Accept':'application/json' if kind=='metadata' else 'text/plain'})
  with urllib.request.urlopen(req,timeout=35) as response:data=response.read(10000001)
  if len(data)>10000000:raise ValueError('Exceeds the compact viewer 10 MB limit')
  if kind!='metadata' and b'_atom_site.' not in data:raise ValueError('No mmCIF atom table')
  directory='models' if kind=='pdb' else 'predictions';(out/directory).mkdir(exist_ok=True)
  name=f'{directory}/{hashlib.sha256(data).hexdigest()[:24]}.{ "json" if kind=="metadata" else "cif"}'
  (out/name).write_bytes(data)
  record={'path':name,'source':url,'retrievedAt':retrieved,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'license':'CC0-1.0' if kind=='pdb' else 'CC-BY-4.0'}
  with lock:resources[url]=record
  return record
 except Exception as error:
  with lock:failures.append({'source':url,'reason':str(error)})
  return None
 finally:event.set()
genes=json.loads((root/'src/data/genes.json').read_text());atlas=json.loads((root/'src/data/atlas.json').read_text());symbols={row['gene'] for row in atlas['landscape']};ids=sorted({g['id'].split('.')[0] for g in genes if g['symbol'] in symbols and g['selected']})
def gene(id):
 shard=json.loads((out/index['shards'][id[-2:]]).read_text());proteins=shard['proteins'].get(id,[]);reviewed=[p for p in proteins if p['reviewed']]
 if not reviewed:return
 protein=reviewed[0]
 for model in protein['pdb'][:3]:
  if get(f'https://files.rcsb.org/download/{model["id"]}.cif','pdb'):break
 url=f'https://alphafold.ebi.ac.uk/api/prediction/{protein["accession"]}';meta=get(url,'metadata')
 if meta:
  payload=json.loads((out/meta['path']).read_text())
  for model in payload if isinstance(payload,list) else []:
   if (model.get('uniprotAccession')==protein['accession'] and model.get('taxId')==9606 and model.get('isComplex') is not True and (model.get('sequence') or model.get('uniprotSequence'))==protein['sequence'] and model.get('sequenceStart')==1 and model.get('sequenceEnd')==len(protein['sequence']) and str(model.get('cifUrl','')).startswith('https://alphafold.ebi.ac.uk/files/')):get(model['cifUrl'],'prediction');break
 print('Model snapshot',id,protein['accession'],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(gene,ids))
index.update(resources=resources,structureScope='One reviewed protein accession per archived OXPHOS gene where available; first downloadable PDB reference among the first three and one exact-sequence human AlphaFold prediction. Compact viewer limit 10 MB per model. This is a representative library, not all known structures or proof of the expressed isoform.',structureFailures=failures)
(out/'index.json').write_text(json.dumps(index,separators=(',',':')))
print('Saved resources',len(resources),'unique bytes',sum(p.stat().st_size for directory in ['models','predictions'] for p in (out/directory).glob('*')),'unavailable/oversize',len(failures),flush=True)
