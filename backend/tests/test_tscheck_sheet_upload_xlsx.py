"""Uploading a multi-tab .xlsx creates one saved SheetSource per tab (criterion: imported sheet
disappeared complaint + sheets stay saved/appear in Print Studio)."""
import httpx


def test_upload_brands_xlsx_creates_two_sources(client: httpx.Client):
    with open("/tmp/brands.xlsx", "rb") as f:
        resp = client.post(
            "/sheets/upload",
            files={"file": ("brands.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert len(created) == 2, f"expected 2 tabs imported, got {created}"
    names = sorted(s["name"] for s in created)
    assert names == ["brands — AURA Studio", "brands — OmniParts"], names

    # Each created source must be independently fetchable and persisted (list_sources) and the
    # columns of its tab must come back correctly (this is the "sheet disappeared" regression).
    list_resp = client.get("/sources")
    assert list_resp.status_code == 200
    listed_ids = {s["id"] for s in list_resp.json()}
    for src in created:
        assert src["id"] in listed_ids, f"source {src['id']} not present in /sources after upload"
        fetch_resp = client.post("/sheets/fetch", json={"url": src["url"]})
        assert fetch_resp.status_code == 200, fetch_resp.text
        data = fetch_resp.json()
        if src["name"].endswith("AURA Studio"):
            assert data["columns"] == ["SKU", "Product Name", "Barcode", "Price"], data["columns"]
        else:
            assert data["columns"] == ["Part No", "Desc", "Code"], data["columns"]
        assert len(data["rows"]) >= 1
