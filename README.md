# AI Foundry — Club Website

A frontend-only, animated, scroll-driven website for the AI Foundry club (Universal AI University).
Plain HTML + CSS + JavaScript. No build step, no frameworks, no installs.

## Run it
- **Quick:** double-click `index.html`.
- **Local server (recommended):** `npx serve .` or `python3 -m http.server`, then open the shown address.
- **Needs internet** for the Google Fonts (Inter, DM Mono) and, for the first-visit intro, a CDN script (see Intro and back to top). Everything else works offline.

## Folder structure
```
index.html        page structure + fixed text (hero, vision, footer)
css/style.css     all styling (colours are at the top in :root)
js/data.js        ALL editable content  <-- edit this for events, members, etc.
js/main.js        animations + rendering (you rarely need to touch this)
js/forge.js       the "forge the logo" first-visit intro (see Intro and back to top)
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

## Intro and back to top
- **First visit of a session: "forge the logo".** The logo is built piece by piece (anvil, flame, letters) with synthesized
  sound, then flies into the hero badge and the page opens from it in a glowing circle. About 5 seconds; **Skip** or `Esc`
  ends it early. Code: `js/forge.js` (+ `js/forge-layers.js`, `css/forge.css`, `assets/forge/`). Settings at the top of
  `js/forge.js`: `SPEED` (1.1 = about 5 s, higher = faster), `SOUND` (true/false), `VOLUME` (0-1).
- **Repeat visits in the same session, the weakest performance tier, reduced motion:** the old lamp intro (a lamp drops,
  flickers on and lights the logo; repeat visits get a short version). The lamp intro is also the automatic fallback if the
  forge animation can't load or start (see below).
- **Back-to-top arrow and the footer "Re-ignite" link: the anvil strike (about 2.8 s).** A short cinematic made from the logo itself:
  the screen dims and letterbox bars slide in while the camera slowly pushes in; the anvil (`assets/forge/anvil.webp`) drops and
  slams down with a flash, a lens streak, a freeze-frame, a hard shake and a synthesized clang; the logo's **flame**
  (`assets/forge/flame.webp`) rises out of the anvil with molten droplets, sparks and the logo's drifting **pixel squares**; then a wall
  of **lava** with flame-tongue edges climbs the whole screen while the camera cranes up. The page jumps to the top while the lava
  fully covers the screen (you never see the jump), the lava drains out through the top, the bars slide away and the hero particles
  fly in again. **Skip** or `Esc` ends it early, a 6 s safety timer finishes it even if something breaks, and tapping again while it
  plays does nothing. Reduced-motion users get a plain smooth scroll.
  Code: the "ANVIL STRIKE" section in `js/forge.js` (`AIForge.strike()`), its styling at the bottom of `css/forge.css`, and
  `arrowToTop()` in `js/main.js`. It reuses the forge intro's sound, sparks, ring and flash helpers. Timings are in the `STRIKE`
  object at the top of that section (`HIT`, `LAVA0`, `LAVA1`, `END`, ...); lava height and flame size are the `LAVA` and `FLAME`
  comments inside `strike()`; sound uses the same `SOUND` / `VOLUME` settings as the forge intro.
  **Why it is smooth:** the lava body (heat gradient, crust, cracks) is baked once into a texture while the browser is idle, so each frame
  only clips that texture to the animated flame-tongue edge; every DOM write is skipped when the value did not change; sparks are drawn in
  16 batched strokes; the heavy impact work is spread over two frames; the audio graph is prepared on the visitor's first interaction, not
  inside the tap. The strongest tier also gets a 3D camera tilt and a vignette; weaker tiers skip those (they force per-frame resampling
  of big layers on weak GPUs). If the frame time stays high during the heavy part, an automatic quality fallback lowers the lava resolution
  and drops the extras (speed streaks, glow layers, fewer particles). Add `?nolod` to the URL to switch that fallback off when testing.
- **The lamp replay is still in the code.** `lampIntro(true)` in `js/main.js` is now only the fallback when the strike can't
  start (anime.js not loaded yet, e.g. the CDN is blocked); the lamp is also still one of the two random intros on open.
- **Needs internet for the forge intro and the anvil strike:** anime.js (and three.js on strong devices) load from the jsDelivr CDN. If that
  fails or takes over ~2.5 s, the lamp intro plays instead (and back-to-top uses the lamp replay). To run offline, download `animejs@3.2.1/lib/anime.min.js` into
  `js/` and change `ANIME_URL` in `js/forge.js` to `"js/anime.min.js"`.
- Only one animation can play at a time. "Reduce motion" users get a plain fade / smooth scroll.
- Debug: `?replay` plays the full first-visit intro again, `?lamp` forces the lamp intro, `?slowmo` slows the lamp 3x, `?nolod` turns off the strike's automatic quality fallback,
  `AIForge.start({ tier: 0 })` in the console plays the forge animation from anywhere, `AIForge.strike({ tier: 0 })` plays the anvil strike.

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
