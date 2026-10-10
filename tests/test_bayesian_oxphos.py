"""Structural safeguards for paired pathway sensitivity, not scientific evidence."""
import unittest
import numpy as np
import pandas as pd
from src.transcriptomics.bayesian_oxphos import paired_scores

class PairedScores(unittest.TestCase):
    def setUp(self):
        self.profiles=pd.DataFrame({'block':['a']*3+['b']*3,'condition':['control','d1','d3']*2,'score':[10,12,9,100,103,104]})
    def test_pairing_sign_shared_control_and_treated_difference(self):
        y=paired_scores(self.profiles.sample(frac=1,random_state=1),['b','a'],['d1','d3'])
        np.testing.assert_array_equal(y,[[3,4],[2,-1]])
        np.testing.assert_array_equal(y[:,1]-y[:,0],[1,-3])
    def test_duplicate_profiles_rejected(self):
        with self.assertRaisesRegex(ValueError,'Duplicate'):
            paired_scores(pd.concat([self.profiles,self.profiles.iloc[[0]]]),['a','b'],['d1','d3'])
    def test_missing_control_rejected(self):
        with self.assertRaisesRegex(ValueError,'Incomplete'):
            paired_scores(self.profiles.iloc[1:],['a','b'],['d1','d3'])
    def test_nonfinite_rejected(self):
        self.profiles.loc[0,'score']=np.nan
        with self.assertRaisesRegex(ValueError,'Nonfinite'):
            paired_scores(self.profiles,['a','b'],['d1','d3'])

class FreezeIntegrity(unittest.TestCase):
    def test_tampered_input_is_rejected(self):
        import tempfile
        import json
        import hashlib
        from pathlib import Path
        from src.transcriptomics.bayesian_oxphos import verify_freeze
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'provenance').mkdir()
            (root/'input.txt').write_text('original')
            digest=hashlib.sha256((root/'input.txt').read_bytes()).hexdigest()
            (root/'provenance/bayesian_oxphos_freeze_v1.json').write_text(json.dumps({'files':{},'input_sha256':{'input.txt':digest}}))
            verify_freeze(root)
            (root/'input.txt').write_text('changed')
            with self.assertRaisesRegex(ValueError,'Frozen file changed'):
                verify_freeze(root)

if __name__=='__main__':
    unittest.main()
