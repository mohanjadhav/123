# RAPID LABELS by MOHAN — run it free on GitHub

GitHub runs this app for free with **GitHub Codespaces** (a computer in your browser).
A personal GitHub account gets about **60 free hours per month** — the app only uses hours while it is open.

## First time (about 3–5 minutes)

1. Put this project on GitHub (in Emergent: **Save → Save to GitHub**). Keep the repository **Private**.
2. Open the repository on github.com.
3. Click the green **`<> Code`** button → **Codespaces** tab → **Create codespace on main**.
4. Wait while it sets up (it installs everything and loads your labels automatically).
5. When you see *"RAPID LABELS is running"*, the app opens in a new browser tab.
   If it does not open: click the **PORTS** tab at the bottom → hover port **3000** → click the 🌐 globe icon.

## Every next time

1. Go to **github.com/codespaces** → click your codespace. It resumes with all your labels and data.
2. The app starts by itself. If not, type in the terminal: `bash start.sh`

## Good to know

- **Save free hours:** when you finish, go to github.com/codespaces → `…` → **Stop codespace**
  (it also stops by itself after 30 minutes of no use). Your data is kept.
- **Your data** (labels, imported sheets, image library) is saved inside the codespace. Deleting the codespace deletes that data.
- **Google Sheets:** import your sheet link again once (Import button) — sheets are not bundled for privacy.
- **Printing:** use the app's Print button as usual; the browser print window goes to your own printer.
- **Problem?** Run `bash start.sh` in the terminal, or check `/tmp/rapid-backend.log` and `/tmp/rapid-frontend.log`.

## Run on your own computer instead (optional)

Needs Python 3.11, Node 20+, and MongoDB Community Server installed.

```bash
cd backend && pip install -r requirements.txt   # skip the emergentintegrations line if it fails
# create backend/.env with:
#   MONGO_URL=mongodb://localhost:27017
#   DB_NAME=rapid_labels
#   CORS_ORIGINS=*
python seed.py && python import_seed_data.py
python -m uvicorn server:app --port 8001

# in a second terminal
cd frontend && yarn install && yarn dev     # open http://localhost:3000
```
