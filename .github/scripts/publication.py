"""Validate an explicit, single-use publication request without publishing."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

REQUEST = ".github/publication-request.json"
ALLOWED = {REQUEST, "PUBLICATION_MANIFEST.json", "SHA256SUMS"}
REPOSITORY = "psilocybin-research/psilocin-human-neuron-transcriptomics"


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def validate_request(request, parent, changed, previous_ids):
    if request.get("intent") == "none":
        return False
    if set(request) != {"intent", "source_sha", "request_id", "authorized_by_owner"}:
        raise ValueError("Unexpected publication request fields")
    if request["intent"] != "publish" or request["authorized_by_owner"] is not True:
        raise ValueError("Publication requires explicit owner authorization")
    if request["source_sha"] != parent or not re.fullmatch(r"[a-f0-9]{40}", parent):
        raise ValueError("Publication source must be this request commit's immediate parent")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}", request["request_id"] or ""):
        raise ValueError("Use a unique 8–80 character publication request ID")
    if request["request_id"] in previous_ids:
        raise ValueError("Publication request ID was already used")
    if REQUEST not in changed or not set(changed) <= ALLOWED:
        raise ValueError("A publication request commit may change only the request and integrity inventories")
    return True


def evaluate():
    request = json.loads(Path(REQUEST).read_text())
    head = git("rev-parse", "HEAD")
    parent = git("rev-parse", "HEAD^")
    changed = git("diff", "--name-only", parent, head).splitlines()
    # An old request left in place cannot publish subsequent development commits.
    if REQUEST not in changed:
        return False
    ids = set()
    for revision in git("rev-list", parent, "--", REQUEST).splitlines():
        old = subprocess.run(["git", "show", f"{revision}:{REQUEST}"], capture_output=True, text=True)
        if old.returncode == 0:
            ids.add(json.loads(old.stdout).get("request_id"))
    return validate_request(request, parent, changed, ids)


def deploy_preflight():
    if os.environ.get("GITHUB_REPOSITORY") != REPOSITORY or os.environ.get("GITHUB_REF") != "refs/heads/main" or os.environ.get("GITHUB_EVENT_NAME") != "push":
        raise ValueError("Production publication requires a push to the canonical main branch")
    if os.environ.get("GITHUB_RUN_ATTEMPT") != "1":
        raise ValueError("Publication requests are single-use; create a fresh request instead of rerunning")
    if not evaluate():
        raise ValueError("This revision has no new valid publication request")
    remote = git("ls-remote", "--exit-code", "origin", "refs/heads/main").split()[0]
    if remote != os.environ.get("GITHUB_SHA") or remote != git("rev-parse", "HEAD"):
        raise ValueError("Publication request was superseded by newer main commits")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--deploy-preflight", action="store_true")
    args = parser.parse_args()
    if args.deploy_preflight:
        deploy_preflight()
        print("Current, authorized single-use publication request: PASS")
    else:
        enabled = evaluate()
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                output.write(f"publish={str(enabled).lower()}\n")
        print(f"Publication requested: {enabled}")
