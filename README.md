# AI Foundry — Club Website

A frontend-only, animated, scroll-driven website for the AI Foundry club (Universal AI University).
Plain HTML + CSS + JavaScript. No build step, no frameworks, no installs.

## Run it
- **Quick:** double-click `index.html`.
- **Local server (recommended):** `npx serve .` or `python3 -m http.server`, then open the shown address.
- **Needs internet** for the Google Fonts (Inter, DM Mono) and, the first time you use it, the back-to-top animation (see below). Everything else works offline.

## Folder structure
```
index.html        page structure + fixed text (hero, vision, footer)
css/style.css     all styling (colours are at the top in :root)
js/data.js        ALL editable content  <-- edit this for events, members, etc.
js/main.js        animations + rendering (you rarely need to touch this)
js/forge.js       the "forge the logo" back-to-top animation (see below)
js/forge-layers.js  markup of the logo pieces used by forge.js (loaded on demand)
css/forge.css     styling of that animation
assets/           logo, patron photo, signature, lead-team photos
assets/forge/     the WebP pieces of the logo (anvil, flame, legs, apex)
```

## Editing content (js/data.js)
Everything below is a plain list/object. Add, remove or edit entries; the page re-draws itself.

| Section | Key | Fields |
|---|---|---|
| Events (upcoming + past) | `EVENTS` | `k` ('up'/'past'), `d` date, `tm` time, `v` venue, `t` title, `x` short line, `l` full description, `hl` highlights list, `r` optional link |
| Projects & research | `PROJECTS` | `k` ('on'/'done'), `type` ('Project'/'Research'), `t`, `x`, `l`, `st` stage 0-3 (ongoing), `p` progress % (ongoing), `tech` tags, `lead`, `d`, `hl`, `r` optional link |
| Collaborations | `COLLABS` | `name`, `real` (true = bright) |
| Members | `MEMBERS` | `name`, `role` |
| Lead team | `LEADERS` | `name`, `role`, `email`, `photo` |
| Patron | `PATRON` | `name`, `role`, `photo`, `signature`, `message` (list of paragraphs) |
| Why / What / Programs / Stages / Missions | `WHY`, `PAN`, `INS`, `PIPE`, `MIS` | `title`, `text` (PAN also `num`) |
| Scroll sentence | `MANIFESTO` | words in `*stars*` turn orange |
| Settings | `CONFIG` | `EMAIL`, `FORM_ENDPOINT`, `DATA_URL` |

Photos: drop new images in `assets/` and point to them (e.g. `"photo": "assets/new-member.jpg"`). Square or 3:4 portraits work best.

Fixed text (hero tagline, vision paragraph, footer line) is in `index.html`.

## Making it dynamic later
The page already reads from one data object, so moving to a database is a small step.

1. Host a JSON file or API that returns the same shape as `js/data.js`. You can send only the parts that change, e.g.
   `{ "EVENTS": [...], "MEMBERS": [...] }`; anything missing falls back to `data.js`.
2. Put its URL in `CONFIG.DATA_URL` inside `js/data.js`.

Easy sources: a JSON file on GitHub/Netlify, Google Sheets published as JSON (e.g. via Apps Script),
Firebase / Supabase / Airtable, or a small Node/Express API.
The server must allow cross-origin requests (CORS). If the remote fetch fails the site silently uses `data.js`.

## The "Join AI Foundry" form
Collects name, phone, email and a resume (PDF/DOC/DOCX, max 5 MB).
- **Without setup:** it opens the visitor's email app with their details filled in (they attach the resume manually).
- **With a form service (recommended):** create a form at Formspree / Getform / a Google Apps Script web app, paste its URL into
  `CONFIG.FORM_ENDPOINT`. The page then POSTs `name`, `phone`, `email`, `resume` (file) as multipart form-data.
  Check that your service accepts file uploads on its plan.

## Deploy (free)
Upload the whole folder to Netlify (drag-and-drop), GitHub Pages, or Vercel. No build command needed.

## Back to top: "forge the logo"
Click the round arrow (or "Re-ignite" in the footer) and the logo is forged piece by piece while the page climbs back
to the top, with synthesized sound. It then flies into the hero badge, the page opens from it in a glowing circle and the
hero particles fly in again. About 5 seconds; **Skip** or `Esc` ends it early.
- The arrow button itself is the original one in `index.html` / `style.css` (`#up`), so it keeps the site's look.
- Settings are at the top of `js/forge.js`: `SPEED` (1.1 = about 5 s, higher = faster), `SOUND` (true/false), `VOLUME` (0-1),
  `TARGET.selector` (the round logo it lands on).
- Colours and fonts come from `css/forge.css` and use the site's tokens (`--ac`, `--fg`, Inter, DM Mono).
- It follows the site's performance tiers: full tier = WebGL background + all 3D depth; middle tier = lighter 3D, no WebGL;
  lowest tier or "reduce motion" = the old ember scroll / a plain smooth scroll.
- **Needs internet the first time it is used**: anime.js (and three.js on strong devices) load from the jsDelivr CDN.
  If they can't load, the page just scrolls up with the old ember effect. To run fully offline, download
  `animejs@3.2.1/lib/anime.min.js` into `js/` and change `ANIME_URL` in `js/forge.js` to `"js/anime.min.js"`.
- Debug: run `AIForge.start({ tier: 0 })` in the browser console to play it from anywhere on the page.

## Customising the look
- Colours: `:root` at the top of `css/style.css` (`--ac` is the orange).
- Hero title: `size()` in `js/main.js` (the italic lean is the `-.22` in `setTransform`).
- Reduce effects on slow devices: lower the particle step in `size()` or remove the `.gf` / `.scan` elements.

## Adding photos
Put image files in `assets/events/`, `assets/projects/`, `assets/members/`, `assets/collabs/` and point to them in `js/data.js`:
- Events and projects: `"img": "assets/events/launch.jpg"` (cover, 16:9 works best) and optional `"gallery": ["assets/events/a.jpg", "assets/events/b.jpg"]` shown in the detail card.
- Members: `"photo": "assets/members/riya.jpg"` (square-ish). Collaborations: `"logo": "assets/collabs/partner.png"`.
Without a photo, a default orange pattern is shown. Tip: keep each photo under ~300 KB (resize to ~1200 px wide) so the page stays fast.

## Footer: Follow + Contact
In `js/data.js` → `CONFIG`: set `SOCIAL.instagram`, `SOCIAL.discord`, `SOCIAL.linkedin` (empty one = icon hidden) and `CLUB_EMAIL`.

## Updating your existing GitHub repo (Windows)
1. Unzip this package to a temporary folder, e.g. `C:\Users\YOU\Downloads\ai-foundry-site`.
2. Copy the files over your cloned repo folder (this keeps `.git` and deletes nothing):
```
robocopy "C:\Users\YOU\Downloads\ai-foundry-site" "C:\Users\YOU\path\to\your-repo" /E /XD .git
```
3. Commit and push:
```
cd "C:\Users\YOU\path\to\your-repo"
git add .
git commit -m "Add projects, photos, join form, footer links"
git push
```
Robocopy exit codes 0-7 mean success. Only add `/MIR` if you want files you removed from the package to be deleted in the repo too, and then ALWAYS keep `/XD .git`.
