"""Uploading a CSV in Print Studio adds a source named after the file and its row data is
fetchable (criterion: 'Upload CSV in Print Studio')."""
import httpx


def test_upload_one_csv_creates_source_named_one(client: httpx.Client):
    with open("/tmp/one.csv", "rb") as f:
        resp = client.post("/sheets/upload", files={"file": ("one.csv", f, "text/csv")})
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert len(created) == 1, created
    src = created[0]
    assert src["name"] == "one", src

    list_resp = client.get("/sources")
    assert list_resp.status_code == 200
    assert any(s["id"] == src["id"] for s in list_resp.json())

    fetch_resp = client.post("/sheets/fetch", json={"url": src["url"]})
    assert fetch_resp.status_code == 200, fetch_resp.text
    data = fetch_resp.json()
    assert data["columns"] == ["item", "code"], data["columns"]
    assert data["rows"] == [{"item": "Widget", "code": "123456"}], data["rows"]
