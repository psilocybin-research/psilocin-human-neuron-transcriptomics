"""Publication and artifact rejection cases; no scientific fixtures."""
import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f".github/scripts/{name}.py")
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


publication = module("publication")
artifact = module("site_artifact")


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.request = {"intent": "publish", "authorized_by_owner": True, "source_sha": "a" * 40, "request_id": "release-20261124-unique"}

    def test_explicit_request(self):
        self.assertTrue(publication.validate_request(self.request, "a" * 40, publication.ALLOWED, set()))

    def test_idle_does_not_publish(self):
        self.assertFalse(publication.validate_request({"intent": "none"}, "a" * 40, [], set()))

    def test_rejects_stale_duplicate_unapproved_and_mixed_changes(self):
        cases = [({**self.request, "source_sha": "b" * 40}, publication.ALLOWED, set()),
                 (self.request, publication.ALLOWED, {self.request["request_id"]}),
                 ({**self.request, "authorized_by_owner": False}, publication.ALLOWED, set()),
                 (self.request, publication.ALLOWED | {"explorer/src/index.md"}, set())]
        for request, paths, previous in cases:
            with self.subTest(request=request, paths=paths), self.assertRaises(ValueError):
                publication.validate_request(request, "a" * 40, paths, previous)

    def test_rejects_rerun_and_nonproduction_context(self):
        for env in [{"GITHUB_REPOSITORY": "owner/fork"}, {"GITHUB_REPOSITORY": publication.REPOSITORY, "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "push", "GITHUB_RUN_ATTEMPT": "2"}]:
            with patch.dict(os.environ, env, clear=True), self.assertRaises(ValueError):
                publication.deploy_preflight()

    def test_rejects_superseded_main(self):
        env = {"GITHUB_REPOSITORY": publication.REPOSITORY, "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "push", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": "a" * 40}
        with patch.dict(os.environ, env, clear=True), patch.object(publication, "evaluate", return_value=True), patch.object(publication, "git", return_value="b" * 40 + "\trefs/heads/main"), self.assertRaises(ValueError):
            publication.deploy_preflight()

    def test_old_request_does_not_publish_later_development(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous = Path.cwd()
            try:
                os.chdir(tmp)
                Path(".github").mkdir()
                Path(publication.REQUEST).write_text(json.dumps(self.request))
                with patch.object(publication, "git", side_effect=["b" * 40, "a" * 40, "explorer/src/index.md"]):
                    self.assertFalse(publication.evaluate())
            finally:
                os.chdir(previous)

    def test_same_commit_new_push_is_rejected_but_staging_validation_is_allowed(self):
        current = {"id": 2, "head_sha": "a" * 40, "head_branch": "main", "event": "push"}
        publication.reject_replayed_run([current, {**current, "id": 1, "head_branch": "staging/candidate"}], 2, "a" * 40)
        with self.assertRaises(ValueError):
            publication.reject_replayed_run([current, {**current, "id": 1}], 2, "a" * 40)


class ArtifactTests(unittest.TestCase):
    def test_round_trip_and_tamper_rejection(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {}, clear=True):
            root = Path(tmp)
            site, bundle, destination = root / "site", root / "bundle", root / "output"
            site.mkdir(); (site / "index.html").write_text("fixture")
            artifact.pack(site, bundle, "a" * 40)
            digest = artifact.sha(bundle / "atlas.tar")
            artifact.unpack(destination, bundle, "a" * 40, digest)
            (destination / "index.html").write_text("changed")
            with self.assertRaises(ValueError): artifact.verify(destination, bundle, "a" * 40, digest)
            with self.assertRaises(ValueError): artifact.unpack(root / "wrong", bundle, "b" * 40, digest)
            with self.assertRaises(ValueError): artifact.unpack(root / "wrong", bundle, "a" * 40, "b" * 64)

    def test_symlink_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / "index.html").write_text("fixture")
            (root / "link").symlink_to(root / "index.html")
            with self.assertRaises(ValueError): artifact.inventory(root)

    def test_tar_traversal_rejected_even_with_matching_archive_hash(self):
        import io
        import tarfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); bundle = root / "bundle"; bundle.mkdir()
            with tarfile.open(bundle / "atlas.tar", "w") as tar:
                member = tarfile.TarInfo("../escaped"); member.size = 1; tar.addfile(member, io.BytesIO(b"x"))
            digest = artifact.sha(bundle / "atlas.tar")
            (bundle / "manifest.json").write_text(json.dumps({"source_sha": "a", "archive_sha256": digest, "files": {"../escaped": "x"}}))
            with self.assertRaises(ValueError): artifact.unpack(root / "output", bundle, "a", digest)
            self.assertFalse((root / "escaped").exists())


class WorkflowTests(unittest.TestCase):
    def test_no_independent_pages_bypass_and_only_one_build(self):
        import yaml
        workflow = yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text())
        jobs = workflow["jobs"]
        mandatory = {"publication-request", "test", "build", "browser", "bayesian-inputs"}
        self.assertEqual(set(jobs["release-gate"]["needs"]), mandatory)
        self.assertIn("release-gate", jobs["deploy"]["needs"])
        self.assertIn("needs.publication-request.outputs.publish == 'true'", jobs["deploy"]["if"])
        self.assertIn("github.run_attempt == 1", jobs["deploy"]["if"])
        self.assertEqual(sum("npm --prefix explorer run build" in str(step.get("run", "")) for job in jobs.values() for step in job.get("steps", [])), 1)
        self.assertFalse((ROOT / ".github/workflows/pages.yml").exists())
        self.assertEqual(workflow["permissions"], {"contents": "read"})
        for job in jobs.values():
            if job is not jobs["deploy"]:
                self.assertNotIn("pages", job.get("permissions", {}))

    def test_unsuccessful_required_checks_cannot_pass_gate(self):
        import yaml
        workflow = yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text())
        code = workflow["jobs"]["release-gate"]["steps"][0]["run"].split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        for state in ["failure", "cancelled", "skipped"]:
            env = {**os.environ, "RESULTS": json.dumps({"test": {"result": state}})}
            self.assertNotEqual(subprocess.run([os.sys.executable, "-c", code], env=env, capture_output=True).returncode, 0)


if __name__ == "__main__":
    unittest.main()
