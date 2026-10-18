"""Criterion: local spreadsheet import (.ods, .xlsx, .csv) via POST /api/sheets/upload.

Covers: multi-tab workbook -> one source per tab named '<file> — <tab>', columns/rows
readable via GET /api/sheets/copy/{id}, long numeric-looking barcode values stay intact
(no '.0' / exponent mangling), and an unsupported extension is rejected with 400.
"""
import io

import pandas as pd
import pytest


def _make_ods_bytes():
    buf = io.BytesIO()
    df1 = pd.DataFrame({"name": ["Alpha", "Beta"], "barcode": ["1234567890123", "1234567890124"]})
    df2 = pd.DataFrame({"name": ["Gamma"], "barcode": ["9999999999999"]})
    with pd.ExcelWriter(buf, engine="odf") as writer:
        df1.to_excel(writer, sheet_name="tscheckTabOne", index=False)
        df2.to_excel(writer, sheet_name="tscheckTabTwo", index=False)
    buf.seek(0)
    return buf.read()


def _make_csv_bytes():
    df = pd.DataFrame({
        "sku": ["tscheck-1", "tscheck-2"],
        "barcode": ["8901234567890", "8901234567891123456"],
    })
    return df.to_csv(index=False).encode("utf-8")


@pytest.fixture
def created_source_ids():
    ids = []
    yield ids


def _cleanup(client, ids):
    for sid in ids:
        try:
            client.delete(f"/sources/{sid}")
        except Exception:
            pass


def test_ods_multi_tab_upload_creates_one_source_per_tab(client, created_source_ids):
    files = {"file": ("tscheck_workbook.ods", _make_ods_bytes(),
                       "application/vnd.oasis.opendocument.spreadsheet")}
    resp = client.post("/sheets/upload", files=files)
    assert resp.status_code == 201, resp.text
    sources = resp.json()
    created_source_ids.extend(s["id"] for s in sources)
    try:
        assert len(sources) == 2
        names = sorted(s["name"] for s in sources)
        assert names == ["tscheck_workbook — tscheckTabOne", "tscheck_workbook — tscheckTabTwo"]

        tab_one = next(s for s in sources if s["tab"] == "tscheckTabOne")
        copy_resp = client.get(f"/sheets/copy/{tab_one['id']}")
        assert copy_resp.status_code == 200, copy_resp.text
        body = copy_resp.json()
        assert body["columns"] == ["name", "barcode"]
        barcodes = [r["cells"]["barcode"] for r in body["rows"]]
        # long barcode-looking numeric strings must stay intact, no '.0' / exponent mangling
        assert "1234567890123" in barcodes
        assert "1234567890124" in barcodes
        assert not any(b.endswith(".0") or "e+" in b.lower() for b in barcodes)
    finally:
        _cleanup(client, created_source_ids)


def test_csv_upload_preserves_long_barcode_numbers(client, created_source_ids):
    files = {"file": ("tscheck_barcodes.csv", _make_csv_bytes(), "text/csv")}
    resp = client.post("/sheets/upload", files=files)
    assert resp.status_code == 201, resp.text
    sources = resp.json()
    created_source_ids.extend(s["id"] for s in sources)
    try:
        assert len(sources) == 1
        assert sources[0]["name"] == "tscheck_barcodes"
        copy_resp = client.get(f"/sheets/copy/{sources[0]['id']}")
        assert copy_resp.status_code == 200, copy_resp.text
        body = copy_resp.json()
        barcodes = [r["cells"]["barcode"] for r in body["rows"]]
        assert "8901234567890" in barcodes
        assert "8901234567891123456" in barcodes
        assert not any(b.endswith(".0") or "e+" in b.lower() for b in barcodes)
    finally:
        _cleanup(client, created_source_ids)


def test_unsupported_extension_rejected(client):
    files = {"file": ("tscheck_notes.pdf", b"not a spreadsheet", "application/pdf")}
    resp = client.post("/sheets/upload", files=files)
    assert resp.status_code == 400
    assert "detail" in resp.json()
