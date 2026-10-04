"""
One-time script: copies the content from your old data.js (seed_data.json)
into the Supabase tables.

Run from the backend/ folder:   python seed.py
Safe to re-run: it only seeds tables that are still EMPTY.
"""
import json
from pathlib import Path

from app.db import get_db

data = json.loads(Path("seed_data.json").read_text(encoding="utf-8"))
db = get_db()


def is_empty(table: str) -> bool:
    return not db.table(table).select("id").limit(1).execute().data


def seed(table: str, rows: list[dict]):
    if not is_empty(table):
        print(f"- {table}: already has data, skipped")
        return
    db.table(table).insert(rows).execute()
    print(f"+ {table}: inserted {len(rows)} rows")


seed("events", [
    {
        "kind": e["k"], "date_label": e["d"], "time_label": e["tm"], "venue": e["v"],
        "title": e["t"], "short": e["x"], "long": e["l"], "highlights": e["hl"],
        "link": e.get("r", ""), "img": e.get("img", ""), "gallery": e.get("gallery", []),
        "sort_order": i,
    }
    for i, e in enumerate(data["EVENTS"])
])

seed("projects", [
    {
        "kind": p["k"], "type": p["type"], "title": p["t"], "short": p["x"], "long": p["l"],
        "stage": p.get("st"), "progress": p.get("p"), "tech": p["tech"], "lead": p["lead"],
        "date_label": p["d"], "highlights": p["hl"], "link": p.get("r", ""),
        "img": p.get("img", ""), "gallery": p.get("gallery", []), "sort_order": i,
    }
    for i, p in enumerate(data["PROJECTS"])
])

seed("members", [
    {"name": m["name"], "role": m["role"], "photo": m.get("photo", ""), "sort_order": i}
    for i, m in enumerate(data["MEMBERS"])
])

seed("leaders", [
    {"name": l["name"], "role": l["role"], "email": l["email"], "photo": l["photo"], "sort_order": i}
    for i, l in enumerate(data["LEADERS"])
])

seed("collabs", [
    {"name": c["name"], "is_real": c["real"], "logo": c.get("logo", ""), "sort_order": i}
    for i, c in enumerate(data["COLLABS"])
])

if not db.table("site_settings").select("key").limit(1).execute().data:
    db.table("site_settings").insert([
        {"key": "PATRON", "value": data["PATRON"]},
        {"key": "MANIFESTO", "value": data["MANIFESTO"]},
    ]).execute()
    print("+ site_settings: inserted PATRON, MANIFESTO")
else:
    print("- site_settings: already has data, skipped")

print("Done.")
