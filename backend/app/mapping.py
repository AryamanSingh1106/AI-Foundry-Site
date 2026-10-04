"""
Converts database rows into the exact shape the website's main.js expects.

The database uses readable column names (title, short, long, ...).
The frontend uses short keys (t, x, l, ...). This file is the translator,
so you never have to touch main.js.
"""


def event_out(r: dict) -> dict:
    return {
        "id": r["id"],
        "k": r["kind"],
        "d": r.get("date_label") or "",
        "tm": r.get("time_label") or "",
        "v": r.get("venue") or "",
        "t": r["title"],
        "x": r.get("short") or "",
        "l": r.get("long") or "",
        "hl": r.get("highlights") or [],
        "r": r.get("link") or "",
        "img": r.get("img") or "",
        "gallery": r.get("gallery") or [],
    }


def project_out(r: dict) -> dict:
    out = {
        "id": r["id"],
        "k": r["kind"],
        "type": r["type"],
        "t": r["title"],
        "x": r.get("short") or "",
        "l": r.get("long") or "",
        "tech": r.get("tech") or [],
        "lead": r.get("lead") or "",
        "d": r.get("date_label") or "",
        "hl": r.get("highlights") or [],
        "r": r.get("link") or "",
        "img": r.get("img") or "",
        "gallery": r.get("gallery") or [],
    }
    # Stage + progress only make sense for ongoing projects.
    if r["kind"] == "on":
        out["st"] = r.get("stage") or 0
        out["p"] = r.get("progress") or 0
    return out


def member_out(r: dict) -> dict:
    return {"name": r["name"], "role": r.get("role") or "", "photo": r.get("photo") or ""}


def leader_out(r: dict) -> dict:
    return {
        "name": r["name"],
        "role": r.get("role") or "",
        "email": r.get("email") or "",
        "photo": r.get("photo") or "",
    }


def collab_out(r: dict) -> dict:
    return {"name": r["name"], "real": bool(r.get("is_real")), "logo": r.get("logo") or ""}


def build_site_payload(events, projects, members, leaders, collabs, settings) -> dict:
    """
    Assemble the full JSON for GET /api/site.

    Any section that is EMPTY in the database is left out on purpose:
    main.js merges this over js/data.js, so a missing key just falls back
    to the local file. That means the site never breaks if a table is empty.
    """
    payload = {}
    if events:
        payload["EVENTS"] = [event_out(r) for r in events]
    if projects:
        payload["PROJECTS"] = [project_out(r) for r in projects]
    if members:
        payload["MEMBERS"] = [member_out(r) for r in members]
    if leaders:
        payload["LEADERS"] = [leader_out(r) for r in leaders]
    if collabs:
        payload["COLLABS"] = [collab_out(r) for r in collabs]
    if "PATRON" in settings:
        payload["PATRON"] = settings["PATRON"]
    if "MANIFESTO" in settings:
        payload["MANIFESTO"] = settings["MANIFESTO"]
    return payload
