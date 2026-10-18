"""Criterion: GET/PUT /api/workspace/state is the source of truth for the last-used
label (active_tab), surviving a lost localStorage; PUT with a bad body -> 422.
"""

from .conftest import api_url


def test_workspace_state_roundtrip_and_validation_error(client):
    original = client.get("/workspace/state")
    assert original.status_code == 200, original.text
    saved = original.json()

    try:
        new_state = {"open_tabs": ["tscheck-ws-a", "tscheck-ws-b"], "active_tab": "tscheck-ws-b"}
        put_resp = client.put("/workspace/state", json=new_state)
        assert put_resp.status_code == 200, put_resp.text
        assert put_resp.json()["active_tab"] == "tscheck-ws-b"

        get_resp = client.get("/workspace/state")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["active_tab"] == "tscheck-ws-b"
        assert get_resp.json()["open_tabs"] == ["tscheck-ws-a", "tscheck-ws-b"]

        bad_resp = client.put("/workspace/state", json={"open_tabs": "not-a-list", "active_tab": 123})
        assert bad_resp.status_code == 422, bad_resp.text
    finally:
        client.put("/workspace/state", json=saved)
