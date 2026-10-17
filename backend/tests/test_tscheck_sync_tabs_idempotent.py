import httpx

BASE_URL = "http://localhost:8001/api"
CORRADO_SHEET1_ID = "586de90c-e040-43b4-abb6-ff21c1473263"


def test_sync_tabs_is_idempotent_no_duplicate_sources():
    """POST /api/sources/{id}/sync-tabs should not create duplicate sources
    when called repeatedly on the same Google Sheet-linked source."""
    with httpx.Client(timeout=30) as client:
        before = client.get(f"{BASE_URL}/sources")
        assert before.status_code == 200, before.text
        before_ids = {s["id"] for s in before.json()}
        corrado_before = [s for s in before.json() if s.get("workbook_name") == "CORRADO V2"]
        assert len(corrado_before) >= 3, f"expected >=3 CORRADO tabs seeded, got {corrado_before}"

        # Call sync-tabs twice; each call must return the same tab set (idempotent)
        resp1 = client.post(f"{BASE_URL}/sources/{CORRADO_SHEET1_ID}/sync-tabs")
        assert resp1.status_code == 200, resp1.text
        tabs1 = resp1.json()

        resp2 = client.post(f"{BASE_URL}/sources/{CORRADO_SHEET1_ID}/sync-tabs")
        assert resp2.status_code == 200, resp2.text
        tabs2 = resp2.json()

        assert [t["id"] for t in tabs1] == [t["id"] for t in tabs2], (
            f"sync-tabs returned different source ids on repeated calls: {tabs1} vs {tabs2}"
        )

        after = client.get(f"{BASE_URL}/sources")
        assert after.status_code == 200, after.text
        after_ids = {s["id"] for s in after.json()}
        corrado_after = [s for s in after.json() if s.get("workbook_name") == "CORRADO V2"]

        assert after_ids == before_ids, "sync-tabs created/removed sources unexpectedly"
        assert len(corrado_after) == len(corrado_before), (
            f"sync-tabs changed CORRADO tab count: before={len(corrado_before)} after={len(corrado_after)}"
        )
