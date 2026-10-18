"""Criterion: GET /api/sources has exactly one source per Google tab (gid) for the
seeded 32-tab spreadsheet after a sync-tabs call — no duplicate entries of the same tab.
"""

import re

from .conftest import api_url

SPREADSHEET_ID = "13Ph00qpvmXj1Tm6RT99apE0mVl-Idg2aXA7gSEgO5pQ"


def _gid(url: str):
    m = re.search(r"[#&?]gid=(\d+)", url)
    return m.group(1) if m else None


def test_no_duplicate_sources_for_same_spreadsheet_tab(client):
    resp = client.get("/sources")
    assert resp.status_code == 200, resp.text
    sources = [s for s in resp.json() if SPREADSHEET_ID in s["url"]]
    assert len(sources) >= 1

    # trigger a sync via any one of them to make sure the backend has deduped
    sync_resp = client.post(f"/sources/{sources[0]['id']}/sync-tabs")
    assert sync_resp.status_code == 200, sync_resp.text

    resp2 = client.get("/sources")
    assert resp2.status_code == 200, resp2.text
    sources2 = [s for s in resp2.json() if SPREADSHEET_ID in s["url"]]

    assert len(sources2) == 32, f"expected 32 tabs for the seeded spreadsheet, got {len(sources2)}"

    gids = [_gid(s["url"]) for s in sources2]
    assert all(gids), "every source for this spreadsheet must carry a gid"
    assert len(gids) == len(set(gids)), f"duplicate gid(s) found: {gids}"

    indices = sorted(s["tab_index"] for s in sources2)
    assert indices == list(range(32)), f"tab_index should be 0..31 with no gaps/dupes, got {indices}"
