"""Descriptive follow-up exports from frozen results and versioned annotations."""
import csv,hashlib,json,math,re,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'tables/dna_maintenance';OUT.mkdir(parents=True,exist_ok=True)
def read(p):
 with (ROOT/p).open() as f:return list(csv.DictReader(f))
def write(name,rows):
 with (OUT/name).open('w') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def num(v):
 try:return float(v) if math.isfinite(float(v)) else None
 except (ValueError,TypeError):return None
def rank(x):
 order=sorted(range(len(x)),key=lambda i:x[i]);r=[0.]*len(x);start=0
 while start<len(x):
  end=start+1
  while end<len(x) and x[order[end]]==x[order[start]]:end+=1
  for i in order[start:end]:r[i]=(start+end+1)/2
  start=end
 return r
def rho(x,y):return statistics.correlation(rank(x),rank(y)) if len(x)>2 and len(set(x))>1 and len(set(y))>1 else None
cfg=json.loads((ROOT/'config/dna_maintenance_v1.json').read_text())
for p,h in json.loads((ROOT/'provenance/dna_maintenance_freeze_v1.json').read_text())['sha256'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h,p
gs={s['id']:set(s['genes']) for s in json.loads((ROOT/'config/gene_sets.yaml').read_text())['sets']}
for f,h in cfg['source_checksums'].items():
 assert hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h
 for l in (ROOT/f).read_text().splitlines():
  k,u,*g=l.split('\t');gs[k]=set(g)
D='HALLMARK_DNA_REPAIR';T='REACTOME_TELOMERE_MAINTENANCE';cs=cfg['contrasts'];results=read('tables/transcriptomics/enrichment_primary_model.csv')
frozen=[r for r in results if r['tier']=='exploratory'];write('frozen_exploratory.csv',frozen)
le={(r['pathway'],r['contrast']):set(filter(None,r['leadingEdge'].split(';'))) for r in frozen}
uni={p:le[p,cs[0]]|le[p,cs[1]] for p in [D,T]}
ids={r['symbol']:r['gene_id'] for r in read('tables/transcriptomics/gene_mapping.csv') if r['selected']=='TRUE'}
effects={c:{r['symbol']:r for r in read(f'tables/transcriptomics/primary_{c}_genes.csv') if ids.get(r['symbol'])==r['gene_id']} for c in cs}
annotation=json.loads((ROOT/'metadata/reactome_dna_annotation.json').read_text());reactions=json.loads((ROOT/'metadata/reactome_dna_reactions.json').read_text())
children=[]
for n in annotation['nodes']:
 k='REACTOME_'+re.sub('[^A-Z0-9]+','_',n['displayName'].upper()).strip('_')
 if n['parent'] is None:continue
 children.append({**n,'set_id':k,'membership_available':k in gs,'genes':sorted(gs.get(k,set()))})
# Display groups follow verified child memberships, remain overlapping, and are not tested sets.
groups={
 'Packaging / protection':'REACTOME_PACKAGING_OF_TELOMERE_ENDS',
 'Telomerase extension / RNP':'REACTOME_TELOMERE_EXTENSION_BY_TELOMERASE',
 'C-strand synthesis':'REACTOME_TELOMERE_C_STRAND_LAGGING_STRAND_SYNTHESIS',
 'Recombination / chromatin / TERRA':'REACTOME_INHIBITION_OF_DNA_RECOMBINATION_AT_TELOMERE'}
# Packaging is absent from this GMT; report current Reactome annotation explicitly.
gs['REACTOME_PACKAGING_OF_TELOMERE_ENDS']=set(next(r['genes'] for r in reactions['reactions'] if r['id']=='R-HSA-171306'))
rows=[]
for g in sorted(uni[T]):
 r=dict(gene=g,gene_id=ids[g],day1_le=g in le[T,cs[0]],day3_le=g in le[T,cs[1]],dna_member=g in gs[D],dna_day1_le=g in le[D,cs[0]],dna_day3_le=g in le[D,cs[1]])
 r['modules']=';'.join(k for k,v in groups.items() if g in gs[v]) or 'Unassigned'
 r['reactome_children']=';'.join(n['stId'] for n in children if g in n['genes'])
 r['child_names']=';'.join(n['displayName'] for n in children if g in n['genes'])
 r['reaction_annotations']=';'.join(n['label'] for n in reactions['reactions'] if g in n['genes'])
 r['reaction_ids']=';'.join(n['id'] for n in reactions['reactions'] if g in n['genes'])
 r['annotation_basis']='MSigDB 2026.1.Hs available child memberships; packaging and reaction annotations: Reactome 97 (packaging absent from GMT)'
 for prefix,c in zip(['day1','day3','day3_minus_day1'],cs):
  for key,source in [('log2fc','log2FoldChange'),('SE','lfcSE'),('stat','stat'),('gene_fdr','padj')]:r[prefix+'_'+key]=num(effects[c][g][source])
 rows.append(r)
write('telomere_decomposition.csv',rows)
def overlap(scope,a,b):return dict(scope=scope,dna_n=len(a),telomere_n=len(b),shared_n=len(a&b),union_n=len(a|b),jaccard=len(a&b)/len(a|b),fraction_dna=len(a&b)/len(a),fraction_telomere=len(a&b)/len(b),shared_genes=';'.join(sorted(a&b)))
overlaps=[overlap('source memberships',gs[D],gs[T]),overlap('ranked primary universe',gs[D]&set(ids),gs[T]&set(ids))]
for c in cs:overlaps.append(overlap(c+' leading edges',le[D,c],le[T,c]))
overlaps.append(overlap('day1/day3 leading-edge unions',uni[D],uni[T]));write('overlap.csv',overlaps)
concord=[];land=[]
for p,symbols in [(D,uni[D]),(T,uni[T]),('DNA_REPAIR_TELOMERE_UNION',uni[D]|uni[T])]:
 for field in ['log2FoldChange','stat']:
  xy=[(num(effects[cs[0]][g][field]),num(effects[cs[1]][g][field])) for g in sorted(symbols)]
  xy=[(x,y) for x,y in xy if x is not None and y is not None]
  concord.append(dict(selection=p,statistic=field,n=len(xy),spearman=rho([x for x,y in xy],[y for x,y in xy]),same_sign_n=sum(x*y>0 for x,y in xy),positive_both_n=sum(x>0 and y>0 for x,y in xy),zero_either_n=sum(x*y==0 for x,y in xy),same_sign_fraction=sum(x*y>0 for x,y in xy)/len(xy),interpretation='Selected genes; shared controls; descriptive, no p-value'))
write('concordance.csv',concord)
for g in sorted(uni[D]|uni[T]):
 r=dict(gene=g,in_dna_le_union=g in uni[D],in_telomere_le_union=g in uni[T])
 for pre,c in zip(['day1','day3'],cs[:2]):
  for k in ['log2FoldChange','stat','padj']:r[pre+'_'+k]=num(effects[c][g][k])
 land.append(r)
write('concordance_genes.csv',land)
panel=[]
for g in cfg['panel']:
 for c in cs:
  v=effects[c].get(g,{});panel.append(dict(gene=g,contrast=c,gene_id=v.get('gene_id',''),availability='retained source symbol' if v else 'absent source symbol; not a null',log2FoldChange=num(v.get('log2FoldChange')),lfcSE=num(v.get('lfcSE')),gene_fdr=num(v.get('padj')),telomere_le=g in le[T,c],dna_repair_le=g in le[D,c]))
write('canonical_panel.csv',panel)
(OUT/'annotation_dictionary.json').write_text(json.dumps(dict(groups=groups,children=children,reactions=reactions['reactions'],hierarchy_release=annotation['database_version'],membership_release='MSigDB 2026.1.Hs',notes='Groups overlap; reaction membership includes complex participants and does not establish activity.'),indent=2)+'\n')
print('Telomere:',len(le[T,cs[0]]),len(le[T,cs[1]]),'shared',len(le[T,cs[0]]&le[T,cs[1]]),'union',len(uni[T]));print(overlaps);print(concord)
follow=read('tables/dna_maintenance/primary_tests.csv')
def tab(rs,cols):
 return '\n'.join(['| '+' | '.join(t for k,t in cols)+' |','| '+' | '.join('---' for _ in cols)+' |']+['| '+' | '.join(str(r.get(k,'')) for k,t in cols)+' |' for r in rs])
def short(r):
 r=r.copy()
 for k in ['NES','family_fdr']:r[k]=f'{float(r[k]):.4g}' if r.get(k) else 'Not estimable'
 return r
report='''# DNA-maintenance follow-up results

## Status and scope

The original six-test exploratory family is distinct from this post hoc, 24-test follow-up. The follow-up was locally hash-frozen at the time in `provenance/dna_maintenance_freeze_v1.json`, before its new enrichment outputs, after parent results and specific gene findings were known. It is not an external preregistration. All 24 primary-model tests and all 240 variant results are retained; the original primary analysis was not changed.

## Interpretation

The originally frozen DNA-repair and telomere sets are positively enriched and directionally robust at both sampled days. Both treated-day comparisons are block-dependent. This is exploratory evidence from existing RNA-seq, not new experimental evidence of repair or telomere protection.

Removing the entire telomere membership leaves DNA repair robust at both days (NES 2.014/2.008, new-family q approximately 5.51e-6 each). Removing the entire DNA-repair membership leaves 37 ranked telomere genes: positive at both days, robust at Day 1 (NES 1.546, q=0.0430), but below the support threshold at Day 3 (NES 1.395, q=0.111). Day-3 sensitivity directions agree, but this does not make its new-family q significant. This weakens a claim that the original telomere result is wholly distinct from broader DNA-maintenance transcription.

Removing OXPHOS/ROS membership leaves both parent sets robust and positive at both days. Only one source telomere member and five DNA-repair members are removed by that operation; it is therefore a limited overlap check, not evidence of mechanistic independence.

Reactome DNA replication is positively enriched at both days (NES 1.850/1.856, q=9.65e-5/5.44e-5), robust at Day 1 and block-dependent at Day 3. E2F targets, G2M checkpoint and mitotic spindle do not pass the 24-test threshold at either day. These mixed controls neither establish proliferation nor isolate a repair-specific mechanism. No new treated-time set is robust.

## Composition, overlap and concordance

The telomere leading edges contain 27 and 25 genes, 22 shared, 30 in their union. Three union genes (ACD, TERF2, TINF2) are annotated to packaging/protection. The same union also includes C-strand synthesis, telomerase/RNP-related components and RNA polymerase II genes in the recombination/TERRA branch. Memberships overlap and are not disjoint functional modules; branch or reaction membership is not an activity assay. The entire source sets overlap by 25 genes (150 DNA repair; 112 telomere; Jaccard 0.105). Their leading edges overlap by 13/27 telomere genes at Day 1 and 11/25 at Day 3. Rank mapping retains 62 of the 112 source telomere symbols: substantial literal-symbol/retention losses must remain visible, not silently repaired.

The telomere union has 29/30 genes positive at both days, with descriptive log2FC Spearman rho 0.791. The combined DNA-repair/telomere union has 84/88 positive at both days, rho 0.769 (Wald-statistic rho 0.680). Shared controls and leading-edge selection inflate apparent agreement; these summaries are not independent validation or a formal persistence test. The canonical panel retains absent and mixed results, including absent TERT and negative POT1 at both days. Source-symbol checks H2AX/H2AFX are explicit and do not double-count a biological gene.

## Annotation evidence

Gene memberships for available child pathways come from the original MSigDB 2026.1.Hs GMT. Reactome release 97 provides a separately timestamped hierarchy/stable-ID snapshot and descriptive reaction annotations. Packaging of telomere ends and flap removal are absent as individual sets from this GMT. Packaging/protection is therefore explicitly annotated from Reactome 97 participants; flap removal is retained in the hierarchy with membership unavailable and is not assigned from invented data. TERRA and RNP reaction annotations include associated-complex participants; they do not identify telomere-specific expression effects. Reactome identifiers, mapping coverage, complete row annotations and all overlapping assignments are downloadable. No descendant-set enrichment was tested.

## Frozen exploratory results

'''+tab([short(r) for r in frozen],[('pathway','Pathway'),('contrast','Contrast'),('NES','NES'),('family_fdr','6-test q'),('robustness','Direction class')])+'''\n\n## All post hoc results\n\n'''+tab([short(r) for r in follow],[('module','Set'),('contrast','Contrast'),('mapped','Mapped'),('NES','NES'),('family_fdr','24-test q'),('robustness','Direction class')])+'''

## Reproduction and stopping rule

`Rscript src/transcriptomics/dna_maintenance.R` verifies the original and follow-up freezes and uses saved ranks. `python -m src.transcriptomics.report_dna_maintenance` verifies the follow-up inputs and regenerates descriptive tables. `src/acquisition/reactome_dna_annotation.py` and `reactome_dna_reactions.py` acquire or verify annotation snapshots. Source provenance and licenses are in `metadata/reactome_dna_*.json`. Full memberships are in the local plan/config, warnings and software versions in provenance, and complete results in `tables/dna_maintenance/`.

The bounded stopping rule has been reached. No further same-dataset pathway expansion is needed. The results belong in this manuscript's exploratory context; independent data or direct functional measurements would be needed for stronger DNA-maintenance or telomere claims.
'''
(ROOT/'reports/dna_maintenance_results.md').write_text(report)
