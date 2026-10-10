"""Meaningful failure checks for the portable score-input audit."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from src.transcriptomics.reproduce_bayesian_scores import ROOT, verified_inputs

class PortableScoreIntegrity(unittest.TestCase):
    def test_supplied_scores_match_archived_gene_differences(self):
        cfg, y = verified_inputs()
        self.assertEqual(y.shape, (3, 2))
        self.assertEqual(len(cfg['blocks']), 3)

    def test_missing_and_changed_score_inputs_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'provenance').mkdir()
            (root/'provenance/bayesian_score_inputs_v1.json').write_text(json.dumps(
                {'files': {'score.csv': hashlib.sha256(b'original').hexdigest()}}))
            with self.assertRaisesRegex(ValueError, 'missing or changed'):
                verified_inputs(root)
            (root/'score.csv').write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'missing or changed'):
                verified_inputs(root)

if __name__ == '__main__':
    unittest.main()
