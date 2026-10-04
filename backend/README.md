# AI Foundry — Backend

FastAPI + Supabase (Postgres + Storage). Two public endpoints:

| Endpoint | What it does |
|---|---|
| `GET /api/site` | Sends events, projects, members, leaders, collabs, patron, manifesto to the website |
| `POST /api/join` | Receives the Join form: name, phone, email, resume file |

```
app/
  main.py        app setup, CORS, rate limiting
  config.py      reads secrets from .env
  db.py          Supabase connection
  mapping.py     DB columns -> the short keys main.js expects (t, x, l, hl ...)
  validation.py  server-side checks for the Join form (incl. real file-type check)
  routes/site.py GET /api/site
  routes/join.py POST /api/join
schema.sql       tables (run once in Supabase)
seed.py          copies your old data.js content into the tables
seed_data.json   your data.js exported as JSON
tests/           python -m unittest discover tests
```

## Setup (about 20 minutes)

### 1. Create the Supabase project
1. supabase.com -> New project (remember the DB password, pick the nearest region).
2. **SQL Editor -> New query**, paste all of `schema.sql`, click **Run**.
   You should now see the tables under *Table Editor* and a private `resumes` bucket under *Storage*.
3. **Project Settings -> API**: copy the **Project URL** and the **service_role** key.
   The service_role key is a SECRET (full access). Never put it in the website or on GitHub.

### 2. Run the backend locally
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Mac/Linux: cp .env.example .env   -> then fill in the 2 Supabase values
python seed.py                  # loads your current site content into the database
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/docs — you can try both endpoints right there.
`http://127.0.0.1:8000/api/site` should show your content as JSON.

### 3. Connect the website
In `js/data.js`, inside `CONFIG`:
```js
DATA_URL: "http://127.0.0.1:8000/api/site",
FORM_ENDPOINT: "http://127.0.0.1:8000/api/join",
```
Serve the site (`python -m http.server 3000`) and make sure its address is in `ALLOWED_ORIGINS` in `.env`
(otherwise the browser blocks the calls — that's CORS).

### 4. Editing content / viewing applications
No admin panel yet: use Supabase **Table Editor**.
- Edit an event/project row, or untick `published` to hide it. Site updates within ~60 seconds.
- `sort_order` controls ordering (lower = first).
- Applications are in the `applications` table; open a resume from Storage -> resumes (private; use "Get signed URL").

## Deploy
1. Push `backend/` to GitHub. On **Render**: New Web Service -> root dir `backend`.
   Build: `pip install -r requirements.txt`  Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
2. Add env vars on Render: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGINS` (your live site URL).
3. Change `DATA_URL` / `FORM_ENDPOINT` in data.js to your Render URL.
   (Render's free tier sleeps when idle, so the first request can take ~30-50s. The site falls back to data.js meanwhile.)

## Safety notes
- `.env` is in `.gitignore`. Keep it that way.
- RLS is on with no policies, so only this server can touch the data.
- The Join endpoint is limited to 5 requests/hour per IP and re-validates everything.
- Before editable content goes public: main.js puts text into the page with `innerHTML`.
  Only trusted people should have Supabase dashboard access until that's escaped.

## Next steps
1. Admin routes + login (Supabase Auth) if you want a proper panel.
2. Email notification to the club inbox on each new application.
3. Replace placeholder members / social links.
