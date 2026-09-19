"""Pinned reference objects, archive evidence, and gene sets for plan freeze."""
import json
from src.acquisition.download import ROOT, COMMIT, acquire


def main():
    tree=json.loads((ROOT/'data/raw/schmidt/github_tree.json').read_text())
    for item in tree['tree']:
        name=item['path']
        if item['type']=='blob' and name.endswith(('.rds','.html')):
            acquire(f'https://raw.githubusercontent.com/ahoffrichter/Schmidt_et_al_2025/{COMMIT}/{name}',
                'data/raw/schmidt/github/'+name,'MIT (repository LICENSE)',
                '10.7554/eLife.104006.3',COMMIT,expected_git_blob=item['sha'])
    # Existing historical acquisitions retain their original provenance fields.
    manifest=json.loads((ROOT/'metadata/provenance.json').read_text())
    for rec in manifest:
        if '/control_search/' in rec['local_filename']:
            acquire(rec['url'],rec['local_filename'],rec['license'],rec['citation'],rec['version'])
    base='https://api.github.com/repos/ahoffrichter/Schmidt_et_al_2025'
    initial='2f6abf8eabcfff929396fb9baadbce56d9173d2a'
    acquire(base+f'/git/trees/{initial}?recursive=1','data/raw/schmidt/control_search/initial_github_tree.json',
            'Repository metadata','10.7554/eLife.104006.3',initial)
    def directory(sha,local):
        path=ROOT/local
        if not path.exists():
            path=acquire('https://archive.softwareheritage.org/api/1/directory/'+sha+'/',local,
                'Archive metadata; repository content MIT','10.7554/eLife.104006.3',sha)
        entries=json.loads(path.read_text())
        for item in entries:
            if item['type']=='dir':
                directory(item['target'],'data/raw/schmidt/control_search/swh_'+item['target']+'.json')
    directory('c847a8a51074c59d651e3258cf1355936e921048','data/raw/schmidt/control_search/software_heritage_directory.json')
    for name in ['h.all.v2026.1.Hs.symbols.gmt','c2.cp.reactome.v2026.1.Hs.symbols.gmt']:
        acquire('https://data.broadinstitute.org/gsea-msigdb/msigdb/release/2026.1.Hs/'+name,
            'data/raw/gene_sets/'+name,'MSigDB terms: https://www.gsea-msigdb.org/gsea/msigdb/license.jsp; inspect upstream terms before redistribution',
            'MSigDB Human 2026.1.Hs','2026.1.Hs')

if __name__=='__main__': main()
