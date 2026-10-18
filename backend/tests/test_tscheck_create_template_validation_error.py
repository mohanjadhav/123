"""Criterion: POST /api/templates with invalid data (name '' and width_mm 0) returns
422 with a detail list describing the reason, instead of a silent/opaque failure."""

from .conftest import api_url


def test_create_template_invalid_payload_returns_422_with_detail(client):
    resp = client.post("/templates", json={"name": "", "width_mm": 0, "height_mm": 0})
    assert resp.status_code == 422, resp.text
    body = resp.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)
    assert len(body["detail"]) > 0
    # each error should name the offending field and a human-readable reason
    locs = [tuple(err.get("loc", [])) for err in body["detail"]]
    msgs = " ".join(err.get("msg", "") for err in body["detail"])
    assert any("name" in loc for loc in locs) or any("width_mm" in loc for loc in locs)
    assert msgs  # non-empty reason text present


def test_create_template_valid_payload_succeeds(client):
    resp = client.post(
        "/templates", json={"name": "tscheck-valid-create", "width_mm": 50, "height_mm": 30}
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "tscheck-valid-create"
    client.delete(f"/templates/{body['id']}")
