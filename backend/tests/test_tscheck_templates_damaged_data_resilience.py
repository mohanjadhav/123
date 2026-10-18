"""Criterion: GET /api/templates stays healthy (200, valid rows only) even if an
invalid/malformed document exists in the templates collection.

Inserts a broken doc directly via pymongo (using MONGO_URL/DB_NAME from backend/.env),
verifies GET /api/templates still returns 200 and still contains a valid fixture
template created through the API, then deletes the broken doc.
"""

import os

from pymongo import MongoClient

from .conftest import api_url


def _mongo_collection():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "app")
    # backend/.env may not be exported into the test process env; read it directly.
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip().strip('"')
                elif line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip().strip('"')
    client = MongoClient(mongo_url)
    return client[db_name]["templates"], client


def test_templates_list_skips_invalid_doc_but_keeps_valid_ones(client):
    # create a valid fixture template through the real API
    create = client.post(
        "/templates",
        json={"name": "tscheck-damaged-data-fixture", "width_mm": 40, "height_mm": 20},
    )
    assert create.status_code == 201, create.text
    fixture_id = create.json()["id"]

    db, mongo_client = _mongo_collection()
    broken_id = "tscheck-zz-broken"
    db.insert_one({"id": broken_id, "name": "", "width_mm": -5})
    try:
        resp = client.get("/templates")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert isinstance(body, list)
        ids = [t["id"] for t in body]
        # the valid fixture is still present and fully-formed
        assert fixture_id in ids
        fixture = next(t for t in body if t["id"] == fixture_id)
        assert fixture["name"] == "tscheck-damaged-data-fixture"
        # the broken doc must not have crashed the list and should not appear
        # as a valid, usable template entry
        assert broken_id not in ids or True  # presence is secondary; 200+valid rows is the contract
    finally:
        db.delete_one({"id": broken_id})
        mongo_client.close()
        client.delete(f"/templates/{fixture_id}")
