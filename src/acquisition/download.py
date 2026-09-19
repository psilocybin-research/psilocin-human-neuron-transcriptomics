"""Acquire public audit inputs without overwriting or silently refreshing them."""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'metadata/provenance.json'
COMMIT = 'c565709affafbea09406bd7b42fe494f08db6cce'
DRYAD_VERSION = '434510'


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def acquire(url: str, local: str, license: str, citation: str,
            version: str = '', expected_sha256: str = '',
            expected_git_blob: str = '') -> Path:
    """Verify cached inputs or download atomically and record provenance."""
    path = ROOT / local
    if not path.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError(f'Destination escapes project: {local}')
    entries = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    previous = next((r for r in entries if r['local_filename'] == local), None)
    if path.exists():
        if previous is None or sha256(path) != previous['sha256']:
            raise ValueError(f'Untracked or changed input: {local}')
        if previous['url'] != url or previous['version'] != version:
            raise ValueError(f'Source changed; use a new destination: {local}')
        return path
    if previous is not None:
        raise ValueError(f'Tracked input missing: {local}; restore explicitly')
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.part')
    try:
        request = Request(url, headers={'User-Agent': 'psilocybin-bridge-audit/0.1'})
        with urlopen(request, timeout=60) as response, temporary.open('wb') as out:
            resolved = response.url
            for chunk in iter(lambda: response.read(1024 * 1024), b''):
                out.write(chunk)
        digest = sha256(temporary)
        if expected_sha256 and digest != expected_sha256:
            raise ValueError(f'Upstream SHA-256 mismatch: {local}')
        if expected_git_blob:
            payload = temporary.read_bytes()
            blob = hashlib.sha1(f'blob {len(payload)}\0'.encode() + payload).hexdigest()
            if blob != expected_git_blob:
                raise ValueError(f'Git blob mismatch: {local}')
        temporary.rename(path)
    except Exception as error:
        log = ROOT / 'provenance/download_errors.jsonl'
        log.parent.mkdir(parents=True, exist_ok=True)
        with log.open('a') as out:
            out.write(json.dumps({'url': url, 'error': str(error),
                                 'utc': datetime.now(timezone.utc).isoformat()}) + '\n')
        temporary.unlink(missing_ok=True)
        raise
    entries.append(dict(url=url, resolved_url=resolved, local_filename=local,
                        original_filename=path.name,
                        retrieved_utc=datetime.now(timezone.utc).isoformat(),
                        license=license, citation=citation, version=version,
                        size_bytes=path.stat().st_size, sha256=digest,
                        upstream_sha256=expected_sha256, git_blob=expected_git_blob,
                        modified=False, transformation_script=''))
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    pending = MANIFEST.with_suffix('.part')
    pending.write_text(json.dumps(entries, indent=2) + '\n')
    pending.replace(MANIFEST)
    print(f'Acquired {local} ({path.stat().st_size:,} bytes)', flush=True)
    return path


def main() -> None:
    failures = []
    article = acquire('https://api.elifesciences.org/articles/104006',
                      'data/raw/schmidt/article.json', 'CC-BY-4.0',
                      '10.7554/eLife.104006.3')
    metadata = json.loads(article.read_text())
    acquire(metadata['xml'], 'data/raw/schmidt/article.xml', 'CC-BY-4.0',
            '10.7554/eLife.104006.3')
    dryad = 'https://datadryad.org'
    dryad_metadata = acquire(dryad + '/api/v2/datasets/doi%3A10.5061%2Fdryad.xsj3tx9w3',
            'data/raw/schmidt/dryad_metadata.json', 'CC0-1.0',
            '10.5061/dryad.xsj3tx9w3', DRYAD_VERSION)
    if json.loads(dryad_metadata.read_text())['_links']['stash:version']['href'] != f'/api/v2/versions/{DRYAD_VERSION}':
        raise ValueError('Dryad metadata version differs from pinned version')
    listing = acquire(dryad + f'/api/v2/versions/{DRYAD_VERSION}/files',
                      'data/raw/schmidt/dryad_files.json', 'CC0-1.0',
                      '10.5061/dryad.xsj3tx9w3', DRYAD_VERSION)
    inventory = json.loads(listing.read_text())
    files = inventory['_embedded']['stash:files']
    if len(files) != inventory['total']:
        raise ValueError('Dryad inventory requires pagination')
    for item in files:
        file_id = item['_links']['self']['href'].rsplit('/', 1)[-1]
        try:
            acquire(dryad + '/downloads/file_stream/' + file_id,
                    'data/raw/schmidt/dryad/' + item['path'], 'CC0-1.0',
                    '10.5061/dryad.xsj3tx9w3', DRYAD_VERSION, item['digest'])
        except HTTPError as error:
            failures.append(f"{item['path']}: HTTP {error.code}")
            print(f'Unavailable: {failures[-1]}', flush=True)
    acquire('https://datadryad.org/dataset/doi:10.5061/dryad.xsj3tx9w3',
            'data/raw/schmidt/dryad_landing.html', 'CC0-1.0 dataset description',
            '10.5061/dryad.xsj3tx9w3', DRYAD_VERSION)
    repo = 'https://api.github.com/repos/ahoffrichter/Schmidt_et_al_2025'
    listing = acquire(repo + f'/git/trees/{COMMIT}?recursive=1',
                      'data/raw/schmidt/github_tree.json', 'Repository metadata',
                      repo, COMMIT)
    tree = json.loads(listing.read_text())
    if tree['truncated']:
        raise ValueError('GitHub tree is incomplete')
    # Download source scripts, metadata and all count tables. Cached fitted RDS
    # objects and rendered HTML are inventoried but unnecessary for structural audit.
    for item in tree['tree']:
        name = item['path']
        if item['type'] != 'blob' or '/~$' in name:
            continue
        if name.endswith(('.html', '.rds')):
            continue
        acquire(f'https://raw.githubusercontent.com/ahoffrichter/Schmidt_et_al_2025/{COMMIT}/{name}',
                'data/raw/schmidt/github/' + name, 'MIT (repository LICENSE)',
                '10.7554/eLife.104006.3', COMMIT, expected_git_blob=item['sha'])
    lyons_article = acquire('https://www.nature.com/articles/s41467-026-71962-3',
            'data/raw/lyons/article.html', 'CC-BY-4.0; see rights section',
            '10.1038/s41467-026-71962-3')
    if 'Client Challenge' in lyons_article.read_text() or 'Data availability' not in lyons_article.read_text():
        failures.append('Lyons article response is not verified full text; use publisher browser evidence')
    acquire('https://media.springernature.com/original/springer-static/esm/'
            'art%3A10.1038%2Fs41467-026-71962-3/MediaObjects/41467_2026_71962_MOESM4_ESM.xlsx',
            'data/raw/lyons/41467_2026_71962_MOESM4_ESM.xlsx',
            'Article CC-BY-4.0; verify third-party exceptions in source workbook',
            '10.1038/s41467-026-71962-3')
    if failures:
        raise SystemExit('Acquisition incomplete: ' + '; '.join(failures))


if __name__ == '__main__':
    main()
