"""GET /api/site - public content for the website."""
from fastapi import APIRouter, Response

from ..cache import SWRCache
from ..db import get_db
from ..mapping import build_site_payload

router = APIRouter()

# Content changes rarely, so reuse one answer for 30s (see app/cache.py for how staleness is handled).
_cache = SWRCache(ttl=30)


def _rows(table: str, order: str = "sort_order", published_only: bool = True):
    q = get_db().table(table).select("*")
    if published_only:
        q = q.eq("published", True)
    return q.order(order).execute().data


def _build_payload() -> dict:
    events = _rows("events")
    projects = _rows("projects")
    members = _rows("members")
    leaders = _rows("leaders", published_only=False)   # these tables have no 'published' column
    collabs = _rows("collabs", published_only=False)
    settings = {r["key"]: r["value"] for r in get_db().table("site_settings").select("*").execute().data}
    return build_site_payload(events, projects, members, leaders, collabs, settings)


@router.get("/site")
def get_site(response: Response):
    # Browsers may also reuse the answer for 30s.
    response.headers["Cache-Control"] = "public, max-age=30"
    return _cache.get(_build_payload)
