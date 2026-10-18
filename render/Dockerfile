# RAPID LABELS by MOHAN — one container: React app + FastAPI server (database = MongoDB Atlas via MONGO_URL)

# ---- 1. build the app screens
FROM node:22-slim AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN corepack enable && (yarn install --frozen-lockfile || yarn install)
COPY frontend/ ./
RUN yarn build

# ---- 2. server
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FRONTEND_DIST=/app/frontend_dist DB_NAME=rapid_labels CORS_ORIGINS=*
WORKDIR /app/backend
COPY backend/requirements.txt /tmp/requirements.txt
# emergentintegrations is only for AI features on Emergent; this app doesn't use it
RUN grep -v '^emergentintegrations' /tmp/requirements.txt > /tmp/req.txt && pip install --no-cache-dir -r /tmp/req.txt
COPY backend/ ./
COPY --from=web /src/frontend/dist /app/frontend_dist

# load starter + your bundled labels (safe to repeat), then serve on Render's $PORT
CMD ["sh", "-c", "python seed.py && python import_seed_data.py && exec uvicorn serve_web:app --host 0.0.0.0 --port ${PORT:-8000}"]
