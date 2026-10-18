#!/usr/bin/env bash
# Start RAPID LABELS: API server (port 8001) + app screen (port 3000).
# Codespaces runs this automatically; you can also run:  bash start.sh
cd "$(dirname "$0")"

pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "vite" 2>/dev/null

(cd backend && nohup python -m uvicorn server:app --host 0.0.0.0 --port 8001 > /tmp/rapid-backend.log 2>&1 &)
(cd frontend && DISABLE_VISUAL_EDITS=true DISABLE_EMERGENT_OVERLAY=true nohup yarn dev > /tmp/rapid-frontend.log 2>&1 &)

echo "Starting RAPID LABELS…"
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000 && curl -s -o /dev/null http://localhost:8001/api/templates; then
    echo "RAPID LABELS is running -> open the PORTS tab and click the globe icon next to port 3000"
    exit 0
  fi
  sleep 2
done
echo "Still starting. Check logs: /tmp/rapid-backend.log and /tmp/rapid-frontend.log"
