# RAPID LABELS by MOHAN — run it free on GitHub

## ⭐ Install as Windows software (Windows 10 / 11, 64-bit)

GitHub builds a normal Windows installer for you, free, every time the code is saved to GitHub.

1. Put this project on GitHub (in Emergent: **Save → Save to GitHub**).
2. Open the repository on github.com → **Actions** tab. The job **"Build Windows installer"** starts by itself
   (or click it → **Run workflow** to build now). It takes about 10–15 minutes.
   *First time only:* if Actions asks, click **"I understand my workflows, enable them"*.
3. When it shows a green ✓, open the repository's **Releases** (right side of the main page) →
   latest **RAPID LABELS v1.0.x** → download **RapidLabels-Setup.exe**.
4. Double-click **RapidLabels-Setup.exe** → Next → Install. No admin password is needed.
   - Windows may show *"Windows protected your PC"* (the installer isn't code-signed): click **More info → Run anyway**.
5. Open **RAPID LABELS** from the Start menu or desktop icon. It opens in its own window and works offline.
   - Prefer Chrome/Edge? Use the Start-menu shortcut **"RAPID LABELS (open in browser)"**.

**Is it safe?** Yes:
- The installer is built automatically by GitHub from *your* repository's code — nobody else touches it.
- Each release includes `RapidLabels-Setup.exe.sha256`. To check your download, open PowerShell in your
  Downloads folder and run `Get-FileHash RapidLabels-Setup.exe` — the number must match the file.
- Right-click `RapidLabels.exe` → Properties → Details shows publisher **MOHAN** and the version.
- For public repositories GitHub also adds a signed *build provenance* record (Actions run → Attestations).
- The "Windows protected your PC / unknown publisher" warning appears only because the app isn't signed with a
  **paid code-signing certificate**. To remove it, buy one (or use Azure Trusted Signing), then add two repository
  secrets — `WINDOWS_CERT_PFX` (the .pfx file as base64) and `WINDOWS_CERT_PASSWORD` — and the build signs automatically.

**Your data** (labels, sheets, images) is saved on the laptop in `%LOCALAPPDATA%\RapidLabels`
and is kept when you update or uninstall. To update, just install the newer RapidLabels-Setup.exe over the old one.
Logs for troubleshooting: `%LOCALAPPDATA%\RapidLabels\logs`.

To put your latest labels into the next installer: `cd backend && python export_seed_data.py`, then save to GitHub.

---

## Or run it in the browser with GitHub Codespaces

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
