"""Uploading a non-csv/xlsx file is rejected with the expected message, and nothing is saved
(criterion: 'Invalid upload / private link errors are shown')."""
import httpx


def test_upload_invalid_extension_rejected(client: httpx.Client):
    before = client.get("/sources")
    assert before.status_code == 200
    before_ids = {s["id"] for s in before.json()}

    resp = client.post(
        "/sheets/upload",
        files={"file": ("tscheck-notes.json", b'{"a": 1}', "application/json")},
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"] == "Upload a .csv, .xlsx, .xls or .ods file"

    after = client.get("/sources")
    assert after.status_code == 200
    after_ids = {s["id"] for s in after.json()}
    assert after_ids == before_ids, "invalid upload must not create any source"
