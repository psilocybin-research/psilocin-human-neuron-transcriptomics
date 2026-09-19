import pandas as pd
import pytest
from openpyxl import Workbook

from src.audit.inventory import align_samples, require_unique, read_block


def test_alignment_uses_ids_not_row_order():
    meta = pd.DataFrame({'ODCF_name': ['b', 'a'], 'condition': ['control', 'treated']})
    assert align_samples(meta, ['a', 'b']).condition.tolist() == ['treated', 'control']


@pytest.mark.parametrize('ids', [['a', 'a'], ['a', 'c'], ['a']])
def test_invalid_count_identity_is_rejected(ids):
    with pytest.raises(ValueError):
        align_samples(pd.DataFrame({'ODCF_name': ['a', 'b']}), ids)


def test_repeated_participants_require_composite_key():
    frame = pd.DataFrame({'id': [1, 1], 'time': [1, 2]})
    require_unique(frame, ['id', 'time'])
    with pytest.raises(ValueError):
        require_unique(frame, ['id'])


def test_missing_key_is_rejected():
    with pytest.raises(ValueError):
        require_unique(pd.DataFrame({'id': [1, None]}), ['id'])


def test_adjacent_workbook_blocks_stay_separate():
    sheet = Workbook().active
    sheet.append(['title'])
    sheet.append(['id', 'value', None, 'unrelated'])
    sheet.append([1, None, None, 123])
    sheet.append([None, None, None, 456])
    frame = read_block(sheet, 2, 1, 2)
    assert len(frame) == 1
    assert frame.iloc[0]['id'] == 1
    assert pd.isna(frame.iloc[0]['value'])
