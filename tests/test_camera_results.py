"""Check actual CAMERA exports, family multiplicity and frozen-input integrity."""
import csv,hashlib,json,math,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read_rows(p):
 with p.open() as f:return list(csv.DictReader(f))
class CameraResults(unittest.TestCase):
 def test_frozen_inputs(self):
  for name in ['camera_sensitivity_freeze_v1.json','camera_sensitivity_freeze_v1_1.json']:
   for p,h in json.loads((ROOT/'provenance'/name).read_text())['sha256'].items():
    if p.startswith('data/raw/software/') and not (ROOT/p).exists():
     package='limma' if 'limma_' in p else 'statmod'
     item=json.loads((ROOT/f'metadata/camera_{package}_source.json').read_text())
     self.assertEqual(item['path'],p);self.assertEqual(item['sha256'],h)
    else:self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)
 def test_complete_family_and_bh(self):
  rows=read_rows(ROOT/'tables/camera_sensitivity/all_tests.csv')
  self.assertEqual(len(rows),30)
  self.assertEqual(len({(r['mode'],r['pathway'],r['contrast']) for r in rows}),30)
  cfg=json.loads((ROOT/'config/camera_sensitivity_v1.json').read_text())
  for mode in ['estimated','fixed_0.01']:
   group=[r for r in rows if r['mode']==mode]
   self.assertEqual({(r['pathway'],r['contrast']) for r in group},{(p,c) for p in cfg['pathways'] for c in cfg['contrasts']})
   ranked=sorted(group,key=lambda r:float(r['PValue']));running=1.
   for i in range(14,-1,-1):
    running=min(running,float(ranked[i]['PValue'])*15/(i+1))
    self.assertAlmostEqual(float(ranked[i]['family_fdr']),running,places=12)
   for r in group:
    self.assertEqual(int(r['residual_df']),4)
    self.assertAlmostEqual(float(r['variance_inflation_factor']),1+(int(r['NGenes'])-1)*max(0,float(r['Correlation'])),places=10)
 def test_universe_and_memberships(self):
  r=read_rows(ROOT/'tables/camera_sensitivity/membership.csv')
  self.assertEqual(len({(x['pathway'],x['symbol']) for x in r}),len(r))
  gs=json.loads((ROOT/'config/gene_sets.yaml').read_text())['sets']
  for s in [x for x in gs if x['tier']=='primary']:
   sub=[x for x in r if x['pathway']==s['id']]
   self.assertEqual({x['symbol'] for x in sub},set(s['genes']))
  ox=[x for x in r if x['pathway']=='HALLMARK_OXIDATIVE_PHOSPHORYLATION' and x['mapped']=='TRUE']
  self.assertEqual(len(ox),182)
 def test_finite_gene_exports_and_normalization(self):
  rows=read_rows(ROOT/'tables/camera_sensitivity/normalization.csv')
  self.assertEqual(len(rows),9);self.assertEqual(len({r['profile'] for r in rows}),9)
  sizes=[float(r['size_factor']) for r in rows];effective=[float(r['effective_library_size']) for r in rows]
  for i in range(1,9):self.assertAlmostEqual(sizes[i]/sizes[0],effective[i]/effective[0],places=12)
  for co in ['day1_vs_control','day3_vs_control','day3_vs_day1']:
   rs=read_rows(ROOT/f'tables/camera_sensitivity/genes_{co}.csv')
   self.assertEqual(len(rs),21098);self.assertEqual(len({r['symbol'] for r in rs}),21098)
   self.assertTrue(all(math.isfinite(float(r[k])) for r in rs for k in ['log2FC','moderated_t','PValue']))
if __name__=='__main__':unittest.main()
