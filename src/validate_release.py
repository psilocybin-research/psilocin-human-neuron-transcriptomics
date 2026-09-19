#!/usr/bin/env python3
"""Validate public-release metadata, licenses and the exact output allowlist."""

from __future__ import annotations

import json
import fnmatch
import hashlib
import re
from pathlib import Path

import tomli
import yaml


HERE = Path(__file__).resolve()
ROOT = HERE.parents[1] if HERE.parent.name == "src" else HERE.parents[2]
INTEGRITY_FILES = {"PUBLICATION_MANIFEST.json", "SHA256SUMS"}
RUNTIME_PREFIXES = (
    ".git/", ".venv/", ".Rlib/", "renv/library/", "renv/staging/",
    "node_modules/", "explorer/node_modules/", "explorer/dist/",
    "explorer/src/.observablehq/", "artifacts/", "data/raw/",
    "data/interim/", "data/processed/",
)
RUNTIME_NAMES = {".Rhistory", ".RData", ".env", ".curated-public-repository"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def release_files() -> dict[str, Path]:
    """Return curated files while excluding documented local/runtime state."""
    files: dict[str, Path] = {}
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative in RUNTIME_NAMES or relative.startswith(RUNTIME_PREFIXES):
            continue
        if "__pycache__" in path.parts or ".pytest_cache" in path.parts:
            continue
        files[relative] = path
    return files


def validate_metadata() -> None:
    cff = yaml.safe_load((ROOT / "CITATION.cff").read_text(encoding="utf-8"))
    zenodo = json.loads((ROOT / ".zenodo.json").read_text(encoding="utf-8"))

    require(cff["cff-version"] == "1.2.0", "Unsupported CFF version")
    for field in ("title", "version"):
        require(cff[field] == zenodo[field], f"CFF/Zenodo mismatch: {field}")
    require(cff["doi"] == zenodo["doi"] == "10.5281/zenodo.22843281", "Reserved Zenodo DOI mismatch")
    require(str(cff["date-released"]) == zenodo["publication_date"] == "2026-09-19", "Release date mismatch")
    require(cff["type"] == "software" and zenodo["upload_type"] == "software", "Resource type mismatch")
    require(len(cff["authors"]) == 1 and cff["authors"][0]["family-names"] == "Germann", "CFF creator mismatch")
    require(len(zenodo["creators"]) == 1 and zenodo["creators"][0]["name"] == "Germann, Christopher B.", "Zenodo creator mismatch")
    cff_orcid = cff["authors"][0]["orcid"].removeprefix("https://orcid.org/")
    require(cff_orcid == zenodo["creators"][0]["orcid"], "ORCID mismatch")
    require(cff["authors"][0]["affiliation"] == zenodo["creators"][0]["affiliation"], "Affiliation mismatch")
    relations = {
        (item["identifier"], item["relation"], item["resource_type"])
        for item in zenodo["related_identifiers"]
    }
    expected_relations = {
        (cff["repository-code"], "isSupplementTo", "software"),
        ("10.7554/eLife.104006", "isDerivedFrom", "publication-article"),
        ("10.5061/dryad.xsj3tx9w3", "isDerivedFrom", "dataset"),
        (
            "https://github.com/ahoffrichter/Schmidt_et_al_2025/tree/c565709affafbea09406bd7b42fe494f08db6cce",
            "isDerivedFrom",
            "software",
        ),
        (
            "https://archive.softwareheritage.org/swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048/",
            "isDerivedFrom",
            "software",
        ),
    }
    require(expected_relations <= relations, "Zenodo provenance relationships are incomplete")
    cff_references = {(item["type"], item.get("doi"), item.get("url")) for item in cff["references"]}
    require(("article", "10.7554/eLife.104006", None) in cff_references, "CFF Schmidt article reference missing")
    require(("data", "10.5061/dryad.xsj3tx9w3", None) in cff_references, "CFF Dryad reference missing")
    require(
        any(kind == "software" and url and "swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048" in url for kind, _, url in cff_references),
        "CFF Software Heritage reference missing",
    )
    discoverability = {"psychedelics", "neuroplasticity", "mitochondria"}
    require(discoverability <= set(cff["keywords"]), "CFF discoverability keywords missing")
    require(discoverability <= set(zenodo["keywords"]), "Zenodo discoverability keywords missing")

    # A single CFF license would incorrectly imply a repository-wide license.
    require("license" not in cff, "CFF must defer mixed licensing to the file-level map")
    require(zenodo["license"] == "other-open", "Zenodo must identify the mixed-license archive as Other Open")
    description = zenodo["description"].lower()
    require("mixed-license" in description and "license.md" in description, "Zenodo mixed-license scope is incomplete")
    for statement in (
        "independent secondary analysis",
        "original experiment and data generation",
        "original analysis",
        "newly generated reproducibility code",
        "not creators of this research object",
        "dryad's cc0 framework",
    ):
        require(statement in description, f"Zenodo provenance statement missing: {statement}")
    require((ROOT / "LICENSE.md").is_file(), "Layered license map missing")
    require((ROOT / "LICENSES/MIT.txt").is_file(), "MIT text missing")
    require((ROOT / "LICENSES/CC-BY-4.0.txt").is_file(), "CC BY text missing")
    for package, years in (("framework-1.13.4", "2023-2024"), ("runtime-6.0.1", "2018-2024"), ("inspector-5.0.1", "2018-2024")):
        notice = ROOT / "third_party_licenses" / f"observable-{package}.txt"
        require(notice.is_file() and f"Copyright {years} Observable, Inc." in notice.read_text(encoding="utf-8"), f"Observable original license notice missing: {package}")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    atlas = "https://psilocybin-research.github.io/psilocin-human-neuron-transcriptomics/"
    for image, view in (("atlas-overview.png", "overview"), ("atlas-landscape.png", "landscape")):
        pattern = rf'<a href="{re.escape(atlas)}#view={view}">\s*<img src="docs/images/{image}"'
        require(re.search(pattern, readme) is not None, f"README image does not target its atlas view: {image}")


def validate_gene_set_rights() -> None:
    frozen = json.loads((ROOT / "config/gene_sets.yaml").read_text(encoding="utf-8"))
    review = json.loads((ROOT / "metadata/gene_set_redistribution_review.json").read_text(encoding="utf-8"))
    frozen_ids = {item["id"] for item in frozen["sets"]}
    reviewed = {item["id"]: item for item in review["frozen_gene_sets"]}
    require(frozen_ids == set(reviewed), "Frozen gene-set license review is incomplete or contains extras")
    require(frozen["release"] == review["msigdb_release"], "Reviewed MSigDB release mismatch")
    require("CC-BY-4.0" in frozen["license"], "Frozen collection license is not CC BY 4.0")
    restricted_prefixes = ("KEGG_", "KEGG_MEDICUS_", "BIOCARTA_", "ST_")
    for set_id in sorted(frozen_ids):
        record = reviewed[set_id]
        require(record["redistribution_approved"] is True, f"Gene set not approved: {set_id}")
        require(record["license"] == "CC-BY-4.0", f"Unexpected gene-set license: {set_id}")
        require(set_id.startswith(("HALLMARK_", "REACTOME_")), f"Unreviewed collection prefix: {set_id}")
        require(not set_id.startswith(restricted_prefixes), f"Restricted MSigDB exception requires review: {set_id}")

    additional_review = {item["id"]: item for item in review["additional_redistributed_sets"]}
    targeted = json.loads((ROOT / "config/targeted_redox_v1.json").read_text(encoding="utf-8"))
    dna = json.loads((ROOT / "config/dna_maintenance_v1.json").read_text(encoding="utf-8"))
    plasticity = json.loads((ROOT / "config/plasticity_overlap_context.json").read_text(encoding="utf-8"))
    extra_ids = {item["id"] for item in targeted["modules"]}
    extra_ids.add(targeted["curated_context_set"])
    extra_ids.update(item["id"] for item in dna["modules"])
    extra_ids.update(plasticity["sets"])
    extra_ids -= frozen_ids
    require(extra_ids == set(additional_review), "Additional redistributed-set review is incomplete or contains extras")
    require(all(item["redistribution_approved"] is True for item in additional_review.values()), "Additional set not approved")


def validate_output_manifest() -> None:
    manifest = json.loads((ROOT / "config/public_release_outputs.json").read_text(encoding="utf-8"))
    approved = manifest["approved_outputs"]
    require(len(approved) == len(set(approved)), "Duplicate path in approved-output manifest")
    require(all(path.startswith("tables/") for path in approved), "Non-table path in output manifest")
    actual = sorted(path.relative_to(ROOT).as_posix() for path in (ROOT / "tables").rglob("*") if path.is_file())
    require(sorted(approved) == actual, "Exported tables differ from the explicit approved-output manifest")


def validate_integrity_manifests() -> None:
    publication = json.loads((ROOT / "PUBLICATION_MANIFEST.json").read_text(encoding="utf-8"))
    records = publication.get("files", [])
    record_paths = [record.get("path") for record in records]
    require(all(isinstance(path, str) and path for path in record_paths), "Publication manifest contains an invalid path")
    require(len(record_paths) == len(set(record_paths)), "Publication manifest contains duplicate paths")

    actual = release_files()
    expected_paths = set(actual) - INTEGRITY_FILES
    require(set(record_paths) == expected_paths, "Publication manifest file inventory is stale")
    require(publication.get("file_count") == len(records), "Publication manifest file count is stale")
    require(publication.get("total_bytes") == sum(record["bytes"] for record in records), "Publication manifest byte total is stale")
    require(publication.get("status") == "pass" and publication.get("failures") == [], "Publication manifest records a failed audit")

    manifest_hashes: dict[str, str] = {}
    for record in records:
        path = actual[record["path"]]
        require(path.stat().st_size == record.get("bytes"), f"Publication manifest size mismatch: {record['path']}")
        digest = sha256(path)
        require(digest == record.get("sha256"), f"Publication manifest SHA-256 mismatch: {record['path']}")
        manifest_hashes[record["path"]] = digest

    checksum_hashes: dict[str, str] = {}
    for line_number, line in enumerate((ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines(), start=1):
        parts = line.split("  ", 1)
        require(len(parts) == 2 and len(parts[0]) == 64, f"Malformed SHA256SUMS line {line_number}")
        digest, relative = parts
        require(all(character in "0123456789abcdef" for character in digest), f"Invalid SHA-256 on line {line_number}")
        require(relative not in checksum_hashes, f"Duplicate SHA256SUMS path: {relative}")
        checksum_hashes[relative] = digest
    require(checksum_hashes == manifest_hashes, "SHA256SUMS and publication manifest are inconsistent")


def validate_file_licenses() -> None:
    manifest = json.loads((ROOT / "FILE_LICENSES.json").read_text(encoding="utf-8"))
    reuse = tomli.loads((ROOT / "REUSE.toml").read_text(encoding="utf-8"))
    actual = {path for path in release_files() if not path.startswith("LICENSES/")}
    require(set(manifest) == actual, "File-specific license inventory does not match release files")
    for path, entry in manifest.items():
        require(entry.get("spdx") and entry.get("copyright"), f"Incomplete license assignment: {path}")
        # Resolve override annotations in order. A broad later rule must not
        # silently erase a more specific upstream copyright or license.
        effective = None
        for annotation in reuse["annotations"]:
            patterns = annotation["path"] if isinstance(annotation["path"], list) else [annotation["path"]]
            if any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns):
                effective = annotation
        require(effective is not None, f"No REUSE annotation: {path}")
        holders = effective["SPDX-FileCopyrightText"]
        holders = holders if isinstance(holders, list) else [holders]
        require(entry["spdx"] == effective["SPDX-License-Identifier"] and set(entry["copyright"]) == set(holders), f"REUSE/FILE_LICENSES mismatch: {path}")
    for path in ("config/gene_sets.yaml", "config/plasticity_overlap_context.json"):
        require("Germann" not in " ".join(manifest[path]["copyright"]), f"Upstream ownership misassigned: {path}")
    for path in actual:
        if path.startswith("site/_observablehq/"):
            require(manifest[path]["spdx"] == "ISC", f"Observable bundle mislabeled: {path}")
        if path.startswith("metadata/reactome_"):
            require(manifest[path]["spdx"] == "CC0-1.0", f"Reactome annotation mislabeled: {path}")
        if path == "explorer/src/data/atlas.json" or path.startswith("site/_file/data/atlas."):
            require(any("Broad Institute" in holder for holder in manifest[path]["copyright"]), f"MSigDB atlas attribution missing: {path}")
        if path == "explorer/src/data/genes.json" or path.startswith("site/_file/data/genes."):
            require(any("Hoffrichter" in holder for holder in manifest[path]["copyright"]), f"Schmidt-derived gene attribution missing: {path}")
    require(manifest["tables/oxphos_alias/alias_mapping.csv"]["spdx"] == "CC0-1.0", "HGNC mapping mislabeled")


def main() -> None:
    validate_metadata()
    validate_gene_set_rights()
    validate_output_manifest()
    validate_integrity_manifests()
    validate_file_licenses()
    print("release metadata, integrity, licensing and output allowlist: PASS")


if __name__ == "__main__":
    main()
