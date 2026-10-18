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
         "--logpath", str(LOGS / "mongod.log"), "--logappend"],
        creationflags=flags,
    )
    import pymongo
    client = pymongo.MongoClient(f"mongodb://127.0.0.1:{port}", serverSelectionTimeoutMS=500)
    for _ in range(120):
        if proc.poll() is not None:
            raise RuntimeError(f"Database failed to start (see {LOGS / 'mongod.log'})")
        try:
            client.admin.command("ping")
            return proc
        except Exception:
            time.sleep(0.5)
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
    mongo = start_mongo(db_port)
    srv = None
    try:
        app = build_app()
        srv, thread = run_server(app, app_port)
        for _ in range(150):
            if _app_alive(url):
                break
            time.sleep(0.2)
        print("running at", url)
        if serve_only:
            try:
                while thread.is_alive():
                    time.sleep(0.5)
            except KeyboardInterrupt:
                pass
        else:
            open_ui(url, browser)  # blocks until the window is closed
    except KeyboardInterrupt:
        pass
    finally:
        if srv:
            srv.should_exit = True
            time.sleep(0.5)
        stop_mongo(mongo, db_port)
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
