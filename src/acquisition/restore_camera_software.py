"""Explicitly restore exact upstream CAMERA software packages; never refresh a mismatch."""
from pathlib import Path
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[2]
for package in ['limma','statmod']:
    item=json.loads((ROOT/f'metadata/camera_{package}_source.json').read_text())
    target=ROOT/item['path'];target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():
        assert hashlib.sha256(target.read_bytes()).hexdigest()==item['sha256'],f'Existing package differs: {target.name}'
        continue
    with urllib.request.urlopen(item['url'],timeout=120) as response: data=response.read()
    assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],f'Upstream package differs: {package}'
    temporary=target.with_suffix(target.suffix+'.part');temporary.write_bytes(data);temporary.replace(target)
    print(f'Checksum-verified {target.name}')
