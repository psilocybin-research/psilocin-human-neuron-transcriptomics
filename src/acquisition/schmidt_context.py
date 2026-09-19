"""Acquire and extract Schmidt supplements needed to interpret replication."""

import json
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

from src.acquisition.download import ROOT, acquire, sha256

WORD = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def extract_docx(path: Path) -> str:
    """Extract paragraph text without executing or broadly extracting an archive."""
    with ZipFile(path) as archive:
        document = ElementTree.fromstring(archive.read('word/document.xml'))
    return '\n'.join(''.join(node.itertext()) for node in document.iter(WORD + 'p'))


def main() -> None:
    metadata = json.loads((ROOT / 'data/raw/schmidt/article.json').read_text())
    target = ROOT / 'data/interim/schmidt/supplements'
    target.mkdir(parents=True, exist_ok=True)
    transformations = []
    for item in metadata['additionalFiles']:
        path = acquire(item['uri'], 'data/raw/schmidt/supplements/' + item['filename'],
                       'CC-BY-4.0 article supplement', '10.7554/eLife.104006.3')
        if path.suffix != '.docx':
            continue
        output = target / (path.stem + '.txt')
        output.write_text(extract_docx(path))
        transformations.append({'input': str(path.relative_to(ROOT)), 'input_sha256': sha256(path),
                                'output': str(output.relative_to(ROOT)), 'output_sha256': sha256(output),
                                'script': 'src/acquisition/schmidt_context.py'})
    (ROOT / 'metadata/supplement_extractions.json').write_text(json.dumps(transformations, indent=2) + '\n')


if __name__ == '__main__':
    main()
