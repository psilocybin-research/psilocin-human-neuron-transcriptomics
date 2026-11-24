"""Package and verify one built atlas for all browser and deployment jobs."""
import argparse
import hashlib
import json
import os
import tarfile
from pathlib import Path, PurePosixPath


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(root):
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("Site artifacts cannot contain symlinks")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = sha(path)
    if "index.html" not in result:
        raise ValueError("Built atlas index is missing")
    return result


def pack(root, bundle, revision):
    files = inventory(root)
    bundle.mkdir(parents=True, exist_ok=True)
    archive = bundle / "atlas.tar"
    with tarfile.open(archive, "w") as tar:
        for name in files:
            tar.add(root / name, arcname=name, recursive=False)
    digest = sha(archive)
    (bundle / "manifest.json").write_text(json.dumps({"source_sha": revision, "archive_sha256": digest, "files": files}, sort_keys=True) + "\n")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            output.write(f"digest={digest}\n")
    print(f"Packaged {len(files)} files; SHA-256 {digest}")


def verify(root, bundle, revision, expected):
    manifest = json.loads((bundle / "manifest.json").read_text())
    if manifest["source_sha"] != revision or manifest["archive_sha256"] != expected or sha(bundle / "atlas.tar") != expected:
        raise ValueError("Artifact revision or digest differs from the build job")
    if inventory(root) != manifest["files"]:
        raise ValueError("Built atlas files differ from the validated artifact")
    print(f"Exact atlas artifact verified: {revision}")


def unpack(root, bundle, revision, expected):
    manifest = json.loads((bundle / "manifest.json").read_text())
    if manifest["source_sha"] != revision or manifest["archive_sha256"] != expected or sha(bundle / "atlas.tar") != expected:
        raise ValueError("Artifact revision or digest mismatch")
    if root.exists() and any(root.iterdir()):
        raise ValueError("Artifact extraction requires an empty destination")
    root.mkdir(parents=True, exist_ok=True)
    with tarfile.open(bundle / "atlas.tar") as tar:
        members = tar.getmembers()
        names = [m.name for m in members]
        if len(names) != len(set(names)) or set(names) != set(manifest["files"]):
            raise ValueError("Artifact member inventory mismatch")
        for member in members:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or not member.isfile():
                raise ValueError("Unsafe artifact member")
        tar.extractall(root)
    verify(root, bundle, revision, expected)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["pack", "unpack", "verify"])
    parser.add_argument("--root", type=Path, default=Path("explorer/dist"))
    parser.add_argument("--bundle", type=Path, default=Path("artifacts/site"))
    parser.add_argument("--revision", required=True)
    parser.add_argument("--digest")
    args = parser.parse_args()
    if args.action == "pack":
        pack(args.root, args.bundle, args.revision)
    else:
        globals()[args.action](args.root, args.bundle, args.revision, args.digest)
