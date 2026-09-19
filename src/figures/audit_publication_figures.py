"""Rebuild current figure scripts in an isolated staging directory and compare outputs."""
import fitz
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NAMES=['primary_enrichment','npp_oxphos_evidence','oxphos_gene_landscape','npp_oxphos_alias']
def sha(b): return hashlib.sha256(b).hexdigest()
def pdf_content(b):
    # Cairo writes the wall clock into metadata. Exclude only that field from comparisons.
    return re.sub(rb'/CreationDate \([^)]*\)',b'/CreationDate (excluded for reproducibility comparison)',b)
def main():
    result={}
    with tempfile.TemporaryDirectory(prefix='npp-figure-audit-') as tmp:
        stage=Path(tmp)
        (stage/'.Rlib').symlink_to(ROOT/'.Rlib',target_is_directory=True)
        for directory in ['config','tables/transcriptomics','tables/oxphos_alias']:
            shutil.copytree(ROOT/directory,stage/directory)
        model=stage/'data/processed/schmidt/models/primary.rds';model.parent.mkdir(parents=True)
        model.symlink_to(ROOT/'data/processed/schmidt/models/primary.rds')
        scripts=stage/'src/transcriptomics';scripts.mkdir(parents=True)
        for name in ['npp_figures.R','oxphos_gene_heatmap.R']:
            shutil.copy2(ROOT/'src/transcriptomics'/name,scripts/name)
        (stage/'src/figures').mkdir()
        shutil.copy2(ROOT/'src/figures/figure_style.R',stage/'src/figures/figure_style.R')
        (stage/'provenance').mkdir()
        for name in ['npp_figures.R','oxphos_gene_heatmap.R']:
            subprocess.run(['Rscript',str(scripts/name)],cwd=stage,check=True,stdout=subprocess.DEVNULL)
        for name in NAMES:
            original=ROOT/'figures/transcriptomics'/name
            rebuilt=stage/'figures/transcriptomics'/name
            record={}
            for ext in ['pdf','png','svg']:
                a=original.with_suffix('.'+ext).read_bytes();b=rebuilt.with_suffix('.'+ext).read_bytes()
                same=pdf_content(a)==pdf_content(b) if ext=='pdf' else a==b
                assert same,f'{name}.{ext} failed isolated rebuild comparison'
                record[ext]={'sha256':sha(a),'rebuilt_sha256':sha(b),'equal':same,'comparison':'bytes except Cairo CreationDate' if ext=='pdf' else 'byte-for-byte'}
            doc=fitz.open(original.with_suffix('.pdf'))
            sizes=[span['size'] for page in doc for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
            record['minimum_reported_font_pt']=min(sizes)
            assert min(sizes)>=7.95,(name,sizes)
            result[name]=record
    (ROOT/'provenance/figure_publication_audit.json').write_text(json.dumps(result,indent=2)+'\n')
    print('Four figures rebuild identically (PDF comparison excludes CreationDate only); all reported PDF text sizes >=8 pt.')
if __name__=='__main__':main()
