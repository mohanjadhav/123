"""Criterion: Google Sheet tab names refresh from Google when stale in Mongo.

Simulates a user renaming tabs in Google (we can't edit the real sheet, so we make
one of our app's saved sources stale directly in Mongo) then calls
POST /api/sources/{id}/sync-tabs and asserts the real Google tab name/order wins.

Also checks POST /api/sources/{bad-id}/sync-tabs -> 404.
"""

import os

from pymongo import MongoClient

from .conftest import api_url


def _collection(name: str):
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "app")
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip().strip('"')
                elif line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip().strip('"')
    mc = MongoClient(mongo_url)
    return mc[db_name][name], mc


SPREADSHEET_ID = "13Ph00qpvmXj1Tm6RT99apE0mVl-Idg2aXA7gSEgO5pQ"


def _find_tab0_and_tab1(client):
    resp = client.get("/sources")
    assert resp.status_code == 200, resp.text
    sources = [s for s in resp.json() if SPREADSHEET_ID in s["url"]]
    assert len(sources) >= 2, "expected the seeded CORRADO/SAMPLE spreadsheet sources"
    by_index = {s["tab_index"]: s for s in sources}
    assert 0 in by_index and 1 in by_index
    return by_index[0], by_index[1]


def test_sync_tabs_restores_stale_name_in_correct_order(client):
    tab0_before, tab1_before = _find_tab0_and_tab1(client)
    real_tab_name = tab1_before["tab"]  # the real Google name, e.g. "BRAND 2"
    real_workbook_name = tab1_before["workbook_name"]
    tab1_id = tab1_before["id"]

    coll, mongo_client = _collection("sheet_sources")
    try:
        # make it stale, like a leftover name from before the user renamed tabs in Google
        stale = coll.find_one({"id": tab1_id})
        assert stale is not None
        coll.update_one(
            {"id": tab1_id},
            {"$set": {"tab": "Sheet2", "name": f"{real_workbook_name} — Sheet2"}},
        )
        got_stale = coll.find_one({"id": tab1_id}, {"_id": 0})
        assert got_stale["tab"] == "Sheet2"

        resp = client.post(f"/sources/{tab1_id}/sync-tabs")
        assert resp.status_code == 200, resp.text
        tabs = resp.json()
        assert len(tabs) >= 3

        # restored to the real Google name + correct tab_index + name
        restored = next(t for t in tabs if t["id"] == tab1_id)
        assert restored["tab"] == real_tab_name, f"expected restored tab name {real_tab_name!r}, got {restored['tab']!r}"
        assert restored["tab_index"] == 1
        assert restored["name"] == f"{real_workbook_name} — {real_tab_name}"

        # Google order preserved: tab_index 0 is still the first tab (e.g. BRAND 1)
        ordered = sorted(tabs, key=lambda t: t["tab_index"])
        assert ordered[0]["tab_index"] == 0
        assert ordered[0]["tab"] == tab0_before["tab"]
        assert ordered[1]["id"] == tab1_id
    finally:
        # defensive: make sure Mongo ends up with the real name regardless of assertion outcome
        coll.update_one({"id": tab1_id}, {"$set": {"tab": real_tab_name, "name": f"{real_workbook_name} — {real_tab_name}"}})
        mongo_client.close()


def test_sync_tabs_unknown_id_returns_404(client):
    resp = client.post("/sources/tscheck-does-not-exist/sync-tabs")
    assert resp.status_code == 404, resp.text
