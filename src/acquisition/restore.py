"""Explicit byte-verified restoration of tracked inputs into a fresh checkout."""
import argparse,json
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from src.acquisition.download import ROOT,MANIFEST,sha256


def restore_record(record,root=ROOT):
    target=root/record['local_filename']
    if not target.resolve().is_relative_to(root.resolve()): raise ValueError('Destination escapes project')
    if target.exists():
        if sha256(target)!=record['sha256']:raise ValueError('Changed existing input: '+str(target))
        return False
    target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_name(target.name+'.part')
    try:
        with urlopen(Request(record['url'],headers={'User-Agent':'psilocybin-bridge-restore/1.0'}),timeout=90) as response,tmp.open('wb') as out:
            for chunk in iter(lambda:response.read(1024*1024),b''):out.write(chunk)
        if sha256(tmp)!=record['sha256']:raise ValueError('Source bytes changed: '+record['url'])
        tmp.rename(target)
    finally:tmp.unlink(missing_ok=True)
    return True


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--scope',choices=['rna','all'],default='rna');args=parser.parse_args()
    records=json.loads(MANIFEST.read_text());events=[]
    for r in records:
        p=r['local_filename']
        if args.scope=='rna' and not (p.startswith('data/raw/schmidt/github/') or p.startswith('data/raw/gene_sets/')):continue
        changed=restore_record(r)
        if changed:events.append({'file':p,'sha256':r['sha256'],'restored_utc':datetime.now(timezone.utc).isoformat()})
    log=ROOT/'provenance/restorations.jsonl'
    if events:
        with log.open('a') as out:
            for e in events:out.write(json.dumps(e)+'\n')
    print(f'{len(events)} files restored; all selected inputs verified')

if __name__=='__main__':main()
