import json
import pytest
from src.acquisition import download


def test_modified_cached_input_is_rejected_without_network(tmp_path, monkeypatch):
    monkeypatch.setattr(download, 'ROOT', tmp_path)
    monkeypatch.setattr(download, 'MANIFEST', tmp_path / 'manifest.json')
    path = tmp_path / 'data.tsv'
    path.write_text('original')
    download.MANIFEST.write_text(json.dumps([{
        'local_filename': 'data.tsv', 'sha256': download.sha256(path),
        'url': 'https://example.invalid/data.tsv', 'version': '1'}]))
    path.write_text('changed')
    with pytest.raises(ValueError, match='changed'):
        download.acquire('https://example.invalid/data.tsv', 'data.tsv', '', '', '1')


def test_untracked_existing_file_is_not_overwritten(tmp_path, monkeypatch):
    monkeypatch.setattr(download, 'ROOT', tmp_path)
    monkeypatch.setattr(download, 'MANIFEST', tmp_path / 'manifest.json')
    path = tmp_path / 'data.tsv'
    path.write_text('user content')
    with pytest.raises(ValueError, match='Untracked'):
        download.acquire('https://example.invalid/data.tsv', 'data.tsv', '', '')
    assert path.read_text() == 'user content'


def test_download_destination_cannot_escape_project(tmp_path, monkeypatch):
    monkeypatch.setattr(download, 'ROOT', tmp_path)
    with pytest.raises(ValueError, match='escapes'):
        download.acquire('https://example.invalid/file', '../outside', '', '')


def test_explicit_restore_verifies_bytes_and_rejects_changed_source(tmp_path):
    from src.acquisition.restore import restore_record
    source=tmp_path/'source';source.write_bytes(b'known data')
    destination=tmp_path/'checkout';destination.mkdir()
    rec={'local_filename':'data/raw/example','url':source.as_uri(),'sha256':download.sha256(source)}
    assert restore_record(rec,destination)
    assert not restore_record(rec,destination)
    (destination/rec['local_filename']).unlink()
    source.write_bytes(b'changed remote bytes')
    with pytest.raises(ValueError,match='Source bytes changed'):
        restore_record(rec,destination)
    assert not (destination/rec['local_filename']).exists()
    assert not (destination/(rec['local_filename']+'.part')).exists()
