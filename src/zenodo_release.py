#!/usr/bin/env python3
"""Create, inspect, upload and publish a checked Zenodo software release.

Uses Zenodo's current InvenioRDM API. Credentials are read from a mode-0600
file and are never printed. Destructive publication is a separate subcommand
that revalidates the draft, archive checksum, record ID and reserved DOI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TOKEN = Path.home() / ".config/psilocybin-bridge/zenodo_token"
API = "https://zenodo.org/api"
RIGHTS = ["mit", "cc-by-4.0", "isc", "cc0-1.0"]
TITLE = "Psilocin human-neuron transcriptomics: reproducibility code and interactive atlas"
VERSION = "1.0.0"
REPOSITORY = "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics"
ATLAS = "https://psilocybin-research.github.io/psilocin-human-neuron-transcriptomics/"
CREATOR = {
    "person_or_org": {
        "type": "personal",
        "family_name": "Germann",
        "given_name": "Christopher B.",
        "identifiers": [{"scheme": "orcid", "identifier": "0000-0002-1573-4651"}],
    },
    "affiliations": [{"name": "Faculty of Health, School of Medicine, University of Witten/Herdecke"}],
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_token(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"Zenodo token file is absent: {path}")
    mode = path.stat().st_mode & 0o777
    if mode & 0o077:
        raise SystemExit(f"Zenodo token file must be private (chmod 600): {path}")
    token = path.read_text(encoding="utf-8").strip()
    if not token:
        raise SystemExit(f"Zenodo token file is empty: {path}")
    return token


def api(method: str, url: str, token: str, payload: object | None = None, binary: bytes | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif binary is not None:
        data = binary
        headers["Content-Type"] = "application/octet-stream"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Zenodo API {method} failed ({exc.code}): {detail[:2000]}") from None
    return json.loads(body) if body else {}


def payload() -> dict:
    description = (
        "<p>Reproducibility code, frozen specifications, complete derived results, publication figures, "
        "and a static interactive atlas for a secondary RNA-seq analysis of human iPSC-derived cortical "
        "neurons after a 10-minute psilocin pulse followed by washout.</p>"
        "<p>This is a mixed-license archive. Original software is MIT licensed; original documentation, "
        "figures and derived result tables are CC BY 4.0; Observable runtime assets are ISC; directly "
        "redistributed Reactome and HGNC data are CC0. Upstream material retains its original terms. "
        "The authoritative path-level map is in <code>LICENSE.md</code>, <code>REUSE.toml</code>, and "
        "<code>FILE_LICENSES.json</code> inside the archive.</p>"
        f"<p>Source: <a href=\"{REPOSITORY}\">{REPOSITORY}</a><br>"
        f"Interactive atlas: <a href=\"{ATLAS}\">{ATLAS}</a></p>"
    )
    return {
        "access": {"record": "public", "files": "public"},
        "files": {"enabled": True},
        "pids": {},
        "metadata": {
            "title": TITLE,
            "publication_date": date.today().isoformat(),
            "publisher": "Zenodo",
            "resource_type": {"id": "software"},
            "creators": [CREATOR],
            "description": description,
            "version": VERSION,
            "languages": [{"id": "eng"}],
            "rights": [{"id": item} for item in RIGHTS],
            "subjects": [{"subject": item} for item in [
                "psilocin", "psilocybin", "psychedelics", "transcriptomics", "RNA-seq",
                "human iPSC-derived cortical neurons", "oxidative phosphorylation",
                "mitochondrial metabolism", "mitochondria", "neuroplasticity", "redox biology", "reproducible research",
            ]],
            "related_identifiers": [
                {"identifier": REPOSITORY, "scheme": "url", "relation_type": {"id": "issupplementto"}, "resource_type": {"id": "software"}},
                {"identifier": "10.7554/eLife.104006.3", "scheme": "doi", "relation_type": {"id": "isderivedfrom"}, "resource_type": {"id": "publication-article"}},
                {"identifier": "10.5061/dryad.xsj3tx9w3", "scheme": "doi", "relation_type": {"id": "isderivedfrom"}, "resource_type": {"id": "dataset"}},
            ],
        },
    }


def concise(record: dict) -> dict:
    metadata = record.get("metadata", {})
    doi = metadata.get("doi") or record.get("pids", {}).get("doi", {}).get("identifier")
    rights = metadata.get("rights") or ([metadata["license"]] if metadata.get("license") else [])
    right_ids = [item.get("id") for item in rights]
    files = record.get("files", {})
    entries = files.get("entries", {}) if isinstance(files, dict) else {}
    return {
        "id": record.get("id"), "status": record.get("status"), "is_published": record.get("is_published"),
        "title": metadata.get("title"), "version": metadata.get("version"), "doi": doi,
        "rights": right_ids, "file_keys": sorted(entries),
        "links": {k: v for k, v in record.get("links", {}).items() if k in {"self_html", "preview_html", "doi", "publish"}},
    }


def validate_record(record: dict, archive: Path | None = None, expected_sha: str | None = None) -> str:
    summary = concise(record)
    errors = []
    if summary["title"] != TITLE: errors.append("title mismatch")
    if summary["version"] != VERSION: errors.append("version mismatch")
    if set(summary["rights"]) != set(RIGHTS): errors.append(f"rights mismatch: {summary['rights']}")
    doi = summary["doi"]
    if not doi or not doi.startswith("10.5281/zenodo."): errors.append(f"reserved DOI absent or invalid: {doi}")
    if archive is not None:
        actual = sha256(archive)
        if expected_sha and actual != expected_sha: errors.append(f"local archive SHA-256 mismatch: {actual}")
        entries = record.get("files", {}).get("entries", {})
        entry = entries.get(archive.name)
        if not entry: errors.append(f"uploaded archive absent: {archive.name}")
        elif entry.get("status") not in {"completed", "committed"}: errors.append(f"uploaded archive not committed: {entry.get('status')}")
    if errors:
        raise SystemExit("Zenodo draft validation failed:\n- " + "\n- ".join(errors))
    return doi


def write_state(path: Path, record: dict, archive: Path | None = None) -> None:
    state = concise(record)
    state["checked_utc"] = datetime.now(timezone.utc).isoformat()
    if archive:
        state["archive"] = {"path": str(archive), "bytes": archive.stat().st_size, "sha256": sha256(archive)}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, default=DEFAULT_TOKEN)
    parser.add_argument("--state", type=Path, default=ROOT / "provenance/zenodo_release_v1.0.0.json")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("payload")
    sub.add_parser("create-draft")
    inspect_p = sub.add_parser("inspect"); inspect_p.add_argument("record_id")
    upload_p = sub.add_parser("upload"); upload_p.add_argument("record_id"); upload_p.add_argument("archive", type=Path)
    publish_p = sub.add_parser("publish"); publish_p.add_argument("record_id"); publish_p.add_argument("archive", type=Path); publish_p.add_argument("--expected-doi", required=True); publish_p.add_argument("--expected-sha256", required=True)
    args = parser.parse_args()

    if args.command == "payload":
        print(json.dumps(payload(), indent=2)); return
    token = read_token(args.token_file)
    if args.command == "create-draft":
        record = api("POST", f"{API}/records", token, payload=payload())
        # Ensure a DataCite DOI is reserved before any repository identifiers are updated.
        if not concise(record)["doi"]:
            record = api("POST", record["links"]["reserve_doi"], token, payload={})
        validate_record(record)
        write_state(args.state, record)
        print(json.dumps(concise(record), indent=2)); return
    record = api("GET", f"{API}/records/{args.record_id}/draft", token)
    if args.command == "inspect":
        validate_record(record)
        write_state(args.state, record)
        print(json.dumps(concise(record), indent=2)); return
    archive = args.archive.resolve()
    if not archive.is_file(): raise SystemExit(f"Archive absent: {archive}")
    if args.command == "upload":
        api("POST", record["links"]["files"], token, payload=[{"key": archive.name}])
        file_url = f"{record['links']['files']}/{archive.name}"
        api("PUT", file_url + "/content", token, binary=archive.read_bytes())
        api("POST", file_url + "/commit", token, payload={})
        record = api("GET", f"{API}/records/{args.record_id}/draft", token)
        validate_record(record, archive)
        write_state(args.state, record, archive)
        print(json.dumps(concise(record), indent=2)); return
    if args.command == "publish":
        doi = validate_record(record, archive, args.expected_sha256)
        if doi != args.expected_doi: raise SystemExit(f"DOI confirmation mismatch: draft has {doi}")
        published = api("POST", record["links"]["publish"], token, payload={})
        write_state(args.state, published, archive)
        print(json.dumps(concise(published), indent=2))


if __name__ == "__main__":
    main()
