"""GET /api/site - public content for the website."""
from fastapi import APIRouter, Response

from ..db import get_db
from ..mapping import build_site_payload

router = APIRouter()


def _rows(table: str, order: str = "sort_order", published_only: bool = True):
    q = get_db().table(table).select("*")
    if published_only:
        q = q.eq("published", True)
    return q.order(order).execute().data


@router.get("/site")
def get_site(response: Response):
    events = _rows("events")
    projects = _rows("projects")
    members = _rows("members")
    leaders = _rows("leaders", published_only=False)   # these tables have no 'published' column
    collabs = _rows("collabs", published_only=False)
    settings = {r["key"]: r["value"] for r in get_db().table("site_settings").select("*").execute().data}

    # Browsers/CDNs may reuse this answer for 60s -> far fewer database hits.
    response.headers["Cache-Control"] = "public, max-age=60"
    return build_site_payload(events, projects, members, leaders, collabs, settings)
