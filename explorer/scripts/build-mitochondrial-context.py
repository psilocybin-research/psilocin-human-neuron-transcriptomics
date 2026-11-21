#!/usr/bin/env python3
"""Build a pinned external annotation snapshot. Never run during app builds.

Requires xlrd. Downloads can be supplied in --source-dir; all bytes are verified.
No study estimates are modified and no symbol-based identity guesses are made.
"""
import argparse
import csv
import hashlib
import json
import math
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    'human.mitocarta3.0.xls': ('https://sites.broadinstitute.org/files/mitocarta/files/documents/human.mitocarta3.0.xls', 'ac297e10b3e3d07715f22ac72edd4a1e89a9ec6e2208c1b94bdcd7b95906ddcd'),
    'human.mitopathways3.0.gmx.txt': ('https://sites.broadinstitute.org/files/mitocarta/files/documents/human.mitopathways3.0.gmx_.txt', 'fef0f6e4bc9231ec4a33fa02f6f1ae998e438735e5ece94e3efbdc7728b92dff'),
}

def text(value):
    return value.strip() if isinstance(value, str) else ''

def build(source_dir):
    import xlrd
    for name, (url, sha) in SOURCES.items():
        path = source_dir / name
        if not path.exists():
            with urllib.request.urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        assert hashlib.sha256(path.read_bytes()).hexdigest() == sha, f'Source changed: {name}'
    book = xlrd.open_workbook(source_dir / 'human.mitocarta3.0.xls')
    sheet = book.sheet_by_name('A Human MitoCarta3.0')
    records = [dict(zip(sheet.row_values(0), sheet.row_values(i))) for i in range(1, sheet.nrows)]
    assert len(records) == 1136
    genes = json.loads((ROOT / 'explorer/src/data/genes.json').read_text())
    by_stable = {}
    for gene in genes:
        by_stable.setdefault(gene['id'].split('.')[0], []).append(gene)
    entries = []
    by_symbol = {}
    for record in records:
        ids = sorted(set(re.findall(r'ENSG\d{11}', text(record['EnsemblGeneID_mapping_version_20200130']))))
        matches = sorted(g['id'] for stable in ids for g in by_stable.get(stable, []))
        status = 'exact archived ID' if len(matches) == 1 else ('ambiguous archived IDs' if matches else 'absent from archived results')
        paths = sorted(set(p.strip() for p in text(record['MitoCarta3.0_MitoPathways']).split('|') if p.strip()))
        roles = []
        for complex_id in ['I', 'II', 'III', 'IV', 'V']:
            if f'OXPHOS > Complex {complex_id} > C{complex_id} subunits' in paths:
                roles.append({'complex': complex_id, 'role': 'Structural subunit'})
            if f'OXPHOS > Complex {complex_id} > C{complex_id} assembly factors' in paths:
                roles.append({'complex': complex_id, 'role': 'Assembly factor'})
        entry = {
            'key': str(int(record['HumanGeneID'])) if isinstance(record['HumanGeneID'], (int, float)) else text(record['HumanGeneID']), 'symbol': text(record['Symbol']),
            'name': text(record['Description']), 'synonyms': sorted(set(filter(None, text(record['Synonyms']).split('|')))),
            'ensembl': ids, 'uniprot': sorted(set(re.findall(r'[A-Z0-9]+', text(record['UniProt'])))),
            'compartment': text(record['MitoCarta3.0_SubMitoLocalization']) or 'Not supplied',
            'evidence': text(record['MitoCarta3.0_Evidence']), 'pathways': paths, 'roles': roles,
            'archivedIds': matches, 'mappingStatus': status,
        }
        entries.append(entry)
        assert entry['symbol'] not in by_symbol
        by_symbol[entry['symbol']] = entry
    rows = list(csv.reader((source_dir / 'human.mitopathways3.0.gmx.txt').open(), delimiter='\t'))
    pathways = []
    for col, name in enumerate(rows[0]):
        symbols = sorted(set(row[col].strip() for row in rows[2:] if len(row) > col and row[col].strip()))
        missing = sorted(set(symbols) - by_symbol.keys())
        assert not missing, (name, missing)
        pathways.append({'id': name, 'hierarchy': rows[1][col], 'members': [by_symbol[s]['key'] for s in symbols]})
    assert len(pathways) == 149
    metadata = {
        'database': 'MitoCarta', 'release': '3.0 (2020)', 'retrievedAt': '2026-11-21',
        'ensemblMappingRelease': '2020-01-30 (source workbook)',
        'source': 'https://www.broadinstitute.org/mitocarta/mitocarta30-inventory-mammalian-mitochondrial-proteins-and-pathways',
        'documentation': 'https://www.broadinstitute.org/mitocarta30-documentation',
        'citation': 'Rath et al. Nucleic Acids Research 49(D1):D1541–D1547 (2021).',
        'doi': 'https://doi.org/10.1093/nar/gkaa1011',
        'license': 'CC-BY-NC-4.0',
        'licenseSource': 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7778944/',
        'copyright': 'The Author(s) 2020; MitoCarta authors, Broad Institute',
        'scope': 'External curated localization and pathway context, not a measured protein response. Source mappings are preserved, including one-to-many IDs. Absence from archived results does not identify the reason for absence.',
        'sources': [{'url': url, 'sha256': sha} for url, sha in SOURCES.values()],
        'studySha256': hashlib.sha256((ROOT / 'explorer/src/data/genes.json').read_bytes()).hexdigest(),
    }
    snapshot = {'schemaVersion': 1, 'metadata': metadata, 'entries': sorted(entries, key=lambda e: e['symbol']), 'pathways': pathways}
    output = ROOT / 'explorer/src/assets/mitochondria'
    output.mkdir(exist_ok=True)
    (output / 'annotations.json').write_text(json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(',', ':'))+'\n')
    with (output / 'mapping-audit.csv').open('w') as stream:
        writer = csv.writer(stream)
        writer.writerow(['MitoCarta_symbol', 'MitoCarta_source_gene_ID', 'source_Ensembl_IDs', 'archived_IDs', 'mapping_status'])
        writer.writerows([e['symbol'],e['key'],';'.join(e['ensembl']),';'.join(e['archivedIds']),e['mappingStatus']] for e in snapshot['entries'])
    print(json.dumps({'entries': len(entries), 'pathways': len(pathways), 'mapping': {s: sum(e['mappingStatus']==s for e in entries) for s in sorted({e['mappingStatus'] for e in entries})}}, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    build(args.source_dir)
