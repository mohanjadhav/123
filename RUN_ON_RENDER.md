# RAPID LABELS by MOHAN — run it free on the web with Render

Free, no credit card: **Render** (runs the app) + **MongoDB Atlas** (stores your data).
About 15–20 minutes the first time.

> ⚠ There is **no password** on this web version — anyone who has the link can open it and change data.
> Don't share the link publicly. (A password screen can be added any time.)

## Step 1 — Put the code on GitHub
In Emergent: **Save → Save to GitHub** (a private repository is fine).

## Step 2 — Free database (MongoDB Atlas)
1. Go to **mongodb.com/cloud/atlas/register** and sign up (Google login works).
2. Create a cluster → choose **M0 (Free)** → any region close to you (e.g. Mumbai) → **Create**.
3. **Database user**: type a username and password (avoid `@ : / ?` in the password) → **Create user**.
4. **Network access**: click **Add IP address → Allow access from anywhere** (`0.0.0.0/0`) → Confirm.
   (Render's free servers don't have a fixed address, so this is needed.)
5. Click **Connect → Drivers** and copy the link. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Put your real password in place of `<db_password>`.

## Step 3 — Free app server (Render)
1. Go to **render.com** → sign up with **GitHub**.
2. Click **New + → Blueprint** → choose your repository → Render reads `render.yaml`.
3. It asks for **MONGO_URL** → paste the Atlas link from Step 2 → **Apply / Deploy**.
4. Wait 5–10 minutes for the first build. When it says **Live**, open the link at the top
   (like `https://rapid-labels.onrender.com`). Your labels are already there.

## Good to know
- **Sleeps when unused:** after 15 minutes with no visits the free server sleeps; the next visit takes about
  1 minute to wake up. Your data is safe in Atlas.
- **Updates:** every time you save the code to GitHub, Render rebuilds the app automatically.
- **Move your data from Emergent / the Windows app:** there, *Settings → Download backup file*;
  on Render, *Settings → Load backup file*.
- **Free limits:** about 750 hours/month and 5 GB downloads/month on Render; 512 MB storage on Atlas
  (thousands of labels and sheets; very large images use it up fastest).
- **Problem?** In Render open your service → **Logs**. "Authentication failed" = wrong Atlas password;
  "timed out" = Step 2.4 (network access) is missing.
