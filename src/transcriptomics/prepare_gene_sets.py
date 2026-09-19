"""Prepare outcome-independent memberships; frozen configurations are immutable."""
import hashlib,json
from src.acquisition.download import ROOT,sha256

PRIMARY=['HALLMARK_OXIDATIVE_PHOSPHORYLATION','HALLMARK_GLYCOLYSIS','HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY','HALLMARK_MTORC1_SIGNALING','HALLMARK_PI3K_AKT_MTOR_SIGNALING']
SECONDARY=['REACTOME_RESPIRATORY_ELECTRON_TRANSPORT','REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING','REACTOME_AUTOPHAGY','REACTOME_MITOPHAGY','REACTOME_ATF4_ACTIVATES_GENES_IN_RESPONSE_TO_ENDOPLASMIC_RETICULUM_STRESS','REACTOME_SIGNALING_BY_NTRK2_TRKB','HALLMARK_FATTY_ACID_METABOLISM']
EXPLORATORY=['HALLMARK_DNA_REPAIR','REACTOME_TELOMERE_MAINTENANCE']


def parse_gmt(path):
    result={}
    for line in path.read_text().splitlines():
        name,url,*genes=line.split('\t')
        if name in result or not genes:raise ValueError('Invalid or duplicated GMT set')
        result[name]={'url':url,'genes':sorted(set(genes))}
    return result


def main():
    paths=[ROOT/'data/raw/gene_sets'/n for n in ['h.all.v2026.1.Hs.symbols.gmt','c2.cp.reactome.v2026.1.Hs.symbols.gmt']]
    allsets={}; origins={}
    for p in paths:
        parsed=parse_gmt(p); allsets.update(parsed);origins.update({k:str(p.relative_to(ROOT)) for k in parsed})
    sets=[]
    for tier,names in [('primary',PRIMARY),('secondary',SECONDARY),('exploratory',EXPLORATORY)]:
        for name in names:
            item=allsets[name]
            sets.append(dict(id=name,tier=tier,source_file=origins[name],source_release='2026.1.Hs',
                member_count=len(item['genes']),membership_sha256=hashlib.sha256(('\n'.join(item['genes'])+'\n').encode()).hexdigest(),**item))
    config=dict(version='1.0',database='MSigDB Human',release='2026.1.Hs',
        license='CC-BY-4.0; Broad Institute, MIT and Regents of University of California; https://www.gsea-msigdb.org/gsea/msigdb_license_terms.jsp',
        source_checksums={str(p.relative_to(ROOT)):sha256(p) for p in paths},sets=sets)
    target=ROOT/'config/gene_sets.yaml'; text=json.dumps(config,indent=2)+'\n'
    if target.exists() and target.read_text()!=text:raise ValueError('Gene set configuration already exists; use an explicit amendment')
    target.write_text(text)

if __name__=='__main__':main()
