"""RAPID LABELS by MOHAN — Windows desktop launcher.

Starts a private MongoDB (bundled mongod.exe) + the FastAPI server (which also serves the built
React app) on 127.0.0.1, then opens the app in its own window (pywebview / Edge WebView2).

  RapidLabels.exe            -> app window
  RapidLabels.exe --browser  -> opens in the default browser, small "running" window to stop it
  python launcher.py --serve-only  (dev/CI smoke test: no window, Ctrl+C to stop)

All data lives in %LOCALAPPDATA%\\RapidLabels (database, logs, window storage).
"""
from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

APP_NAME = "RAPID LABELS by MOHAN"
APP_PORT, DB_PORT = 47811, 47812  # fixed so window storage (theme, drafts) survives restarts
FROZEN = getattr(sys, "frozen", False)
BUNDLE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))  # repo root in dev
DATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local" / "share")) / "RapidLabels"
LOGS = DATA / "logs"


def _load_build_info() -> None:
    """app.json is written by the GitHub build: {"version": "1.0.12", "repo": "owner/repo"}."""
    import json
    f = BUNDLE / "app.json"
    info = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    os.environ.setdefault("APP_VERSION", str(info.get("version") or "1.0.0-dev"))
    os.environ.setdefault("APP_REPO", str(info.get("repo") or ""))


def _log_to_file() -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    if FROZEN or sys.stdout is None:  # windowed exe has no console
        f = open(LOGS / "app.log", "a", buffering=1, encoding="utf-8")
        sys.stdout = sys.stderr = f
    print(f"\n==== {APP_NAME} start {time.ctime()} ====")


def _port_free(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _app_alive(url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/api/templates", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False


def _mongod_path() -> str:
    if os.environ.get("MONGOD_PATH"):
        return os.environ["MONGOD_PATH"]
    exe = BUNDLE / "mongodb" / ("mongod.exe" if os.name == "nt" else "mongod")
    return str(exe) if exe.exists() else "mongod"


def _mongo_alive(port: int) -> bool:
    import pymongo
    try:
        pymongo.MongoClient(f"mongodb://127.0.0.1:{port}", serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except Exception:
        return False


def start_mongo(port: int) -> subprocess.Popen | None:
    if _mongo_alive(port):  # left running by a crash -> reuse it (its data folder is locked anyway)
        print("reusing running database on port", port)
        return None
    dbpath = DATA / "db"
    dbpath.mkdir(parents=True, exist_ok=True)
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    proc = subprocess.Popen(
        [_mongod_path(), "--dbpath", str(dbpath), "--port", str(port), "--bind_ip", "127.0.0.1",
         "--logpath", str(LOGS / "mongod.log"), "--logappend",
         # small private DB: cap memory, skip telemetry/diagnostics work -> faster start, lighter laptop
         "--wiredTigerCacheSizeGB", "0.25", "--setParameter", "diagnosticDataCollectionEnabled=false"],
        creationflags=flags,
    )
    import pymongo
    client = pymongo.MongoClient(f"mongodb://127.0.0.1:{port}", serverSelectionTimeoutMS=300)
    for _ in range(400):
        if proc.poll() is not None:
            raise RuntimeError(f"Database failed to start (see {LOGS / 'mongod.log'})")
        try:
            client.admin.command("ping")
            return proc
        except Exception:
            time.sleep(0.15)
    raise RuntimeError("Database did not start in time")


def stop_mongo(proc: subprocess.Popen | None, port: int) -> None:
    import pymongo
    try:
        pymongo.MongoClient(f"mongodb://127.0.0.1:{port}", serverSelectionTimeoutMS=1000).admin.command("shutdown")
    except Exception:
        pass  # shutdown closes the connection -> raises; that's expected
    if proc is None:
        return
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()


def build_app():
    """Import the backend (env must be set first) and add the React app on top of the /api routes."""
    sys.path.insert(0, str(BUNDLE / "backend") if not FROZEN else str(BUNDLE))
    from fastapi.staticfiles import StaticFiles
    from starlette.exceptions import HTTPException as StarletteHTTPException

    import server  # noqa: E402  (FastAPI app with every /api route)

    class SPA(StaticFiles):
        async def get_response(self, path, scope):
            try:
                return await super().get_response(path, scope)
            except StarletteHTTPException as exc:
                if exc.status_code == 404 and not path.startswith("api"):
                    return await super().get_response("index.html", scope)  # client-side routes (/data/…, /queue)
                raise

    dist = BUNDLE / ("frontend_dist" if FROZEN else "frontend/dist")
    server.app.mount("/", SPA(directory=str(dist), html=True), name="spa")  # after /api, so /api wins
    return server.app


def run_server(app, port: int):
    """Load bundled labels, then serve — all on ONE event loop (the Motor client binds to the first loop it uses)."""
    import uvicorn

    import import_seed_data
    import seed as seed_mod

    cfg = uvicorn.Config(app, host="127.0.0.1", port=port, log_config=None, access_log=False)
    srv = uvicorn.Server(cfg)

    async def go():
        await seed_mod.main()
        await import_seed_data.main()
        await srv.serve()

    t = threading.Thread(target=lambda: asyncio.run(go()), daemon=True)
    t.start()
    return srv, t


def open_ui(url: str, browser: bool) -> None:
    import webview
    webview.settings["ALLOW_DOWNLOADS"] = True  # backups download to the Downloads folder
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # GitHub / update links open in the browser
    storage = str(DATA / "webview")
    if browser:
        webbrowser.open(url)

        class Api:
            def open(self):
                webbrowser.open(url)

        html = f"""<html><body style="font-family:Segoe UI,sans-serif;margin:24px;color:#1F2937">
          <h3 style="margin:0 0 8px">{APP_NAME} is running</h3>
          <p style="margin:0 0 16px;font-size:14px">It opened in your web browser at <b>{url}</b>.<br>Keep this window open while you work — close it to stop the app.</p>
          <button onclick="pywebview.api.open()" style="background:#1A73E8;color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:14px;cursor:pointer">Open in browser again</button>
        </body></html>"""
        webview.create_window(APP_NAME, html=html, js_api=Api(), width=520, height=260, resizable=False)
    else:
        webview.create_window(APP_NAME, url, width=1440, height=900, min_size=(1024, 640), maximized=True, text_select=True)
    webview.start(private_mode=False, storage_path=storage)


SPLASH = """<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#F3F5F8;font-family:Segoe UI,sans-serif;color:#1F2937">
<div style="text-align:center">
  <div style="width:64px;height:64px;margin:0 auto 16px;border-radius:16px;background:#1A73E8;display:grid;place-items:center">
    <div style="width:34px;height:26px;background:repeating-linear-gradient(90deg,#fff 0 3px,transparent 3px 6px)"></div></div>
  <div style="font-size:20px;font-weight:600">RAPID LABELS <span style="font-weight:400;color:#6B7280">by MOHAN</span></div>
  <div id="msg" style="margin-top:10px;font-size:13px;color:#6B7280">Starting…</div>
  <div style="margin:14px auto 0;width:180px;height:4px;border-radius:2px;background:#DDE3EA;overflow:hidden">
    <div style="width:40%;height:100%;background:#1A73E8;border-radius:2px;animation:s 1s ease-in-out infinite alternate"></div></div>
</div><style>@keyframes s{from{margin-left:0}to{margin-left:60%}}</style></body></html>"""


def boot(state: dict, app_port: int, db_port: int, url: str, window=None) -> None:
    """Start database + server; when ready, switch the (already visible) window to the app."""
    def say(text: str):
        if window is not None:
            try:
                window.evaluate_js(f"document.getElementById('msg').textContent = {text!r}")
            except Exception:
                pass
    try:
        say("Starting database…")
        state["mongo"] = start_mongo(db_port)
        say("Loading your labels…")
        app = build_app()
        state["srv"], state["thread"] = run_server(app, app_port)
        for _ in range(300):
            if _app_alive(url):
                break
            time.sleep(0.1)
        print("running at", url)
        if window is not None:
            window.load_url(url)
    except Exception as exc:  # show the problem in the window instead of a silent failure
        import traceback
        traceback.print_exc()
        state["error"] = exc
        if window is not None:
            window.load_html(f"<body style='font-family:Segoe UI;padding:24px'><h3>{APP_NAME} could not start</h3><p>{exc}</p>"
                             f"<p style='color:#6B7280'>Log files: {LOGS}</p></body>")


def main() -> None:
    _log_to_file()
    _load_build_info()
    browser = "--browser" in sys.argv
    serve_only = "--serve-only" in sys.argv
    url = f"http://127.0.0.1:{APP_PORT}"

    if _app_alive(url):  # already running -> just open another window / tab
        if serve_only:
            print("already running at", url)
            return
        open_ui(url, browser)
        return

    app_port = APP_PORT if _port_free(APP_PORT) else _free_port()
    db_port = DB_PORT if (_port_free(DB_PORT) or _mongo_alive(DB_PORT)) else _free_port()
    url = f"http://127.0.0.1:{app_port}"
    os.environ.update({"MONGO_URL": f"mongodb://127.0.0.1:{db_port}", "DB_NAME": "rapid_labels", "CORS_ORIGINS": "*"})

    import signal

    def _term(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _term)  # e.g. Windows shutdown / task kill -> still stop the database cleanly
    state: dict = {}
    try:
        if serve_only or browser:
            boot(state, app_port, db_port, url)
            if "error" in state:
                raise state["error"]
            if serve_only:
                while state["thread"].is_alive():
                    time.sleep(0.5)
            else:
                open_ui(url, browser=True)  # small "running" window; blocks until closed
        else:
            # window appears instantly with a loading screen; servers start behind it
            import webview
            webview.settings["ALLOW_DOWNLOADS"] = True
            webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
            win = webview.create_window(APP_NAME, html=SPLASH, width=1440, height=900, min_size=(1024, 640), maximized=True, text_select=True)
            webview.start(boot, (state, app_port, db_port, url, win), private_mode=False, storage_path=str(DATA / "webview"))
    except KeyboardInterrupt:
        pass
    finally:
        if state.get("srv"):
            state["srv"].should_exit = True
            time.sleep(0.3)
        if "mongo" in state:
            stop_mongo(state["mongo"], db_port)
        print("stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # show a friendly message instead of silently dying
        import traceback
        traceback.print_exc()
        if os.name == "nt" and FROZEN:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, f"{APP_NAME} could not start:\n\n{exc}\n\nLog: {LOGS}", APP_NAME, 0x10)
        raise
