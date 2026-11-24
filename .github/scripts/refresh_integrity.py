"""Deterministically refresh/check inventories; never alter scientific artifacts."""
import argparse
import fnmatch
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("release_validation", ROOT / "src/validate_release.py")
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


def encoded(value):
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def refresh(write=False):
    paths = validation.release_files()
    annotations = validation.tomli.loads((ROOT / "REUSE.toml").read_text())["annotations"]
    licenses = {}
    for name in sorted(paths):
        if name.startswith("LICENSES/"):
            continue
        effective = None
        for item in annotations:
            patterns = item["path"] if isinstance(item["path"], list) else [item["path"]]
            if any(fnmatch.fnmatchcase(name, pattern) for pattern in patterns):
                effective = item
        if effective is None:
            raise ValueError(f"No effective REUSE assignment: {name}")
        holders = effective["SPDX-FileCopyrightText"]
        licenses[name] = {"spdx": effective["SPDX-License-Identifier"], "copyright": holders if isinstance(holders, list) else [holders]}
    license_text = encoded(licenses)
    rows = []
    import hashlib
    for name, path in sorted(paths.items()):
        if name in validation.INTEGRITY_FILES:
            continue
        content = license_text.encode() if name == "FILE_LICENSES.json" else path.read_bytes()
        rows.append({"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    manifest = json.loads((ROOT / "PUBLICATION_MANIFEST.json").read_text())
    manifest.update(file_count=len(rows), total_bytes=sum(row["bytes"] for row in rows), status="pass", failures=[], files=rows)
    outputs = {"FILE_LICENSES.json": license_text, "PUBLICATION_MANIFEST.json": encoded(manifest),
               "SHA256SUMS": "".join(f"{row['sha256']}  {row['path']}\n" for row in rows)}
    stale = [name for name, content in outputs.items() if (ROOT / name).read_text() != content]
    if write:
        for name in stale:
            (ROOT / name).write_text(outputs[name])
    elif stale:
        raise ValueError("Stale inventories: " + ", ".join(stale) + "; run python .github/scripts/refresh_integrity.py --write")
    print(f"Integrity inventories {'updated' if write else 'current'} ({len(rows)} files)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    refresh(args.write)
