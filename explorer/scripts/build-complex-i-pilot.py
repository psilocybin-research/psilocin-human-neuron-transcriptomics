#!/usr/bin/env python3
"""Freeze a C-alpha-only human complex-I assembly and auditable SIFTS mappings.

The 9TI4 deposited assembly is identity-only. Preserve its complete protein chain
set and geometry. No invented bonds, coordinates, orthology or gene-name rescue.
"""
import argparse
import gzip
import hashlib
import json
import re
import shlex
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def build(source):
    raw = (source/'9TI4.cif.gz').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == 'f76d56197bbc69b93096d0b9f37629b08afbff37d587b9716c2bf52879e6dcd2', 'Coordinate source changed'
    cif = gzip.decompress(raw).decode()
    # This pilot is intentionally specific: fail if deposition needs symmetry expansion.
    assert re.search(r'_pdbx_struct_assembly\.oligomeric_count\s+45\b',cif)
    assert re.search(r'_pdbx_struct_assembly_gen\.oper_expression\s+1\s',cif)
    for a in range(1,4):
        for b in range(1,4):
            match = re.search(rf'_pdbx_struct_oper_list\.matrix\[{a}\]\[{b}\]\s+([-\d.]+)',cif)
            assert match and float(match[1]) == int(a==b)
        assert float(re.search(rf'_pdbx_struct_oper_list\.vector\[{a}\]\s+([-\d.]+)',cif)[1]) == 0
    lines=iter(cif.splitlines()); headers=[]; atoms={}; seen=set()
    for line in lines:
        if line.startswith('_atom_site.'):
            headers.append(line.split()[0].split('.')[1])
            break
    for line in lines:
        if line.startswith('_atom_site.'):
            headers.append(line.split()[0].split('.')[1]);continue
        break
    indices={key:headers.index(key) for key in ['group_PDB','label_atom_id','label_alt_id','label_asym_id','auth_asym_id','auth_seq_id','pdbx_PDB_ins_code','Cartn_x','Cartn_y','Cartn_z','pdbx_PDB_model_num']}
    def read_atom(line):
        if not line.startswith('ATOM '):return
        values=line.split()
        if len(values)!=len(headers):values=shlex.split(line)
        assert len(values)==len(headers)
        get=lambda k:values[indices[k]]
        if get('label_atom_id')!='CA' or get('label_alt_id') not in ['.','A'] or get('pdbx_PDB_model_num')!='1':return
        label=get('label_asym_id'); author=get('auth_asym_id'); residue=int(get('auth_seq_id')); insertion=get('pdbx_PDB_ins_code')
        if insertion in ['.','?']:insertion=''
        key=(label,residue,insertion)
        if key in seen:return
        seen.add(key)
        chain=atoms.setdefault(label,{'label':label,'author':author,'residues':[]})
        chain['residues'].append([residue,insertion,*[float(get('Cartn_'+axis)) for axis in 'xyz']])
    read_atom(line)
    for line in lines:
        if line.startswith('#'):break
        read_atom(line)
    assert len(atoms)==45
    annotation=json.loads((ROOT/'explorer/src/assets/mitochondria/annotations.json').read_text())
    sifts_raw=(source/'9ti4-sifts.json').read_bytes()
    assert hashlib.sha256(sifts_raw).hexdigest() == '68fe78f6496cd2cf1055dce74b855d1d4c9f12426f0412d3e88fe2578aa01ea6', 'SIFTS source changed'
    sifts=json.loads(sifts_raw)['9ti4']['UniProt']
    for chain in atoms.values():
        chain['mappings']=[]
        for accession, protein in sorted(sifts.items()):
            for mapping in protein['mappings']:
                if mapping['struct_asym_id']!=chain['label']:continue
                assert mapping['chain_id']==chain['author']
                candidates=[e for e in annotation['entries'] if accession in e['uniprot']]
                chain['mappings'].append({'uniprot':accession,'identity':mapping.get('identity'),'coverage':mapping.get('coverage'),
                    'uniprotRange':[mapping['unp_start'],mapping['unp_end']], 'mitocartaKeys':[e['key'] for e in candidates],
                    'archivedIds':sorted({id for e in candidates for id in e['archivedIds']})})
        assert len(chain['mappings'])==1,chain['label']
    metadata={'pdb':'9TI4','assembly':'1','assemblyOperation':'Identity; no symmetry expansion required','retrievedAt':'2026-11-21',
        'title':'Human mitochondrial complex I','structureSource':'https://www.rcsb.org/structure/9TI4',
        'coordinateSource':'https://files.rcsb.org/download/9TI4.cif.gz','coordinateSha256':hashlib.sha256(raw).hexdigest(),
        'mappingSource':'https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/9ti4','mappingSha256':hashlib.sha256(sifts_raw).hexdigest(),
        'annotationSha256':hashlib.sha256((ROOT/'explorer/src/assets/mitochondria/annotations.json').read_bytes()).hexdigest(),
        'representation':'Deposited protein Cα positions; continuous backbone traces only across adjacent resolved residues. No atomic surface, chemical bond or simulated motion.',
        'license':'CC0-1.0 (PDB coordinates); SIFTS source attribution; MitoCarta-derived mappings CC-BY-NC-4.0',
        'scope':'RNA estimates mapped onto an external reference assembly. This experiment did not measure protein abundance, conformation, assembly or respiratory activity.'}
    result={'metadata':metadata,'chains':sorted(atoms.values(),key=lambda c:c['label'])}
    out=ROOT/'explorer/src/assets/mitochondria/complex-i.json'
    out.write_text(json.dumps(result,sort_keys=True,separators=(',',':'))+'\n')
    print(json.dumps({'chains':len(atoms),'residues':sum(len(c['residues']) for c in atoms.values()),
        'mappedChains':sum(len(c['mappings'][0]['archivedIds'])==1 for c in atoms.values()),'bytes':out.stat().st_size}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source-dir',required=True,type=Path)
    build(parser.parse_args().source_dir)
