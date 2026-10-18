"""Web entry point for one-container hosting (Render etc.): /api routes + the built React app on one port.
    uvicorn serve_web:app --host 0.0.0.0 --port $PORT
"""
import os
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from server import app  # every /api route is already registered

DIST = Path(os.environ.get("FRONTEND_DIST", Path(__file__).resolve().parent.parent / "frontend" / "dist"))


class SPA(StaticFiles):
    """Serve files from the React build; unknown non-API paths (/data/…, /queue, /history) get index.html."""

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api"):
                return await super().get_response("index.html", scope)
            raise


app.mount("/", SPA(directory=str(DIST), html=True), name="spa")  # after /api, so /api always wins
