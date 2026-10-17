"""Pasting an unreachable/non-public Google Sheets link to /sheets/fetch returns an error
about the sheet not being publicly readable, and no source gets saved for it (criterion:
'Invalid upload / private link errors are shown')."""
import httpx


def test_fetch_private_or_missing_google_sheet_errors(client: httpx.Client):
    url = "https://docs.google.com/spreadsheets/d/1abcDEFfakeIdThatDoesNotExist123/edit#gid=0"

    before = client.get("/sources")
    assert before.status_code == 200
    before_count = len(before.json())

    resp = client.post("/sheets/fetch", json={"url": url})
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "publicly readable" in detail.lower(), detail

    after = client.get("/sources")
    assert after.status_code == 200
    assert len(after.json()) == before_count, "a failed fetch must not persist a source"
