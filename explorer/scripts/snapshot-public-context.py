#!/usr/bin/env python3
"""Explicit maintainer task: freeze public context; never run during app builds."""
import concurrent.futures,datetime,hashlib,json,os,subprocess,sys,time,urllib.request,urllib.parse
from pathlib import Path
root=Path(__file__).resolve().parents[1]
work=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/atlas-public-context');work.mkdir(parents=True,exist_ok=True)
def request(url,payload=None):
 for attempt in range(4):
  try:
   req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload is not None else None,headers={'Accept':'application/json','Content-Type':'application/json','User-Agent':'PsilocinAtlas-public-context-snapshot/1.0'})
   with urllib.request.urlopen(req,timeout=180) as r:return r.read(),dict(r.headers)
  except Exception:
   if attempt==3:raise
   time.sleep(2**attempt)
genes=json.loads((root/'src/data/genes.json').read_text());ids=sorted({g['id'].split('.')[0] for g in genes})
chunks=[ids[i:i+500] for i in range(0,len(ids),500)]
def batch(pair):
 i,chunk=pair;p=work/f'ensembl-{i:03}.json'
 if not p.exists():
  raw,_=request('https://rest.ensembl.org/lookup/id',{'ids':chunk});value=json.loads(raw)
  assert set(value)==set(chunk),'Incomplete lookup response'
  p.write_bytes(raw)
 print('Ensembl batch',i+1,'/',len(chunks),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(batch,enumerate(chunks)))
fields='accession,id,reviewed,protein_name,organism_id,sequence,version,xref_ensembl,xref_pdb,ft_domain,ft_region,ft_motif,ft_act_site,ft_binding,ft_transmem,ft_topo_dom,ft_signal,ft_transit,ft_disulfid,ft_zn_fing,ft_dna_bind,ft_repeat,ft_coiled'
query='(organism_id:9606) AND (database:ensembl) AND ((reviewed:true) OR (proteome:UP000005640))'
url='https://rest.uniprot.org/uniprotkb/stream?'+urllib.parse.urlencode({'query':query,'format':'json','fields':fields})
p=work/'uniprot.json'
if not p.exists():
 print('Retrieving human reference-proteome and reviewed protein records…',flush=True)
 raw,headers=request(url);json.loads(raw);p.write_bytes(raw);(work/'uniprot-headers.json').write_text(json.dumps(headers))
print('Protein source bytes',p.stat().st_size,flush=True)
meta={'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ensemblSource':'https://rest.ensembl.org/lookup/id','uniprotSource':url,'geneCount':len(ids),'scope':'All archived study gene IDs; exact human Ensembl matches from reviewed UniProt entries and the human reference proteome UP000005640. Other proteomes and isoforms are not exhaustive.'}
(work/'metadata.json').write_text(json.dumps(meta))
subprocess.run(['node',str(root/'scripts/normalize-public-context.mjs'),str(work)],check=True)
