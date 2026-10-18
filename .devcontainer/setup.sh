#!/usr/bin/env bash
# One-time setup when the Codespace is created: install everything and load your labels.
set -e
cd "$(dirname "$0")/.."

echo "==> Backend packages"
# emergentintegrations is only needed for AI features on Emergent; this app doesn't use it.
grep -v '^emergentintegrations' backend/requirements.txt > /tmp/requirements.txt
python -m pip install --upgrade pip -q
python -m pip install -q -r /tmp/requirements.txt

echo "==> Backend settings"
if [ ! -f backend/.env ]; then
  cat > backend/.env <<'ENV'
MONGO_URL=mongodb://localhost:27017
DB_NAME=rapid_labels
CORS_ORIGINS=*
ENV
fi

echo "==> Frontend packages"
cd frontend
corepack enable >/dev/null 2>&1 || npm install -g yarn
yarn install --frozen-lockfile || yarn install
cd ..

echo "==> Loading your labels"
for i in $(seq 1 30); do
  python - <<'PY' && break
import pymongo; pymongo.MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1000).admin.command("ping")
PY
  echo "   waiting for database…"; sleep 2
done
cd backend
python seed.py
python import_seed_data.py
echo "==> Setup complete"
