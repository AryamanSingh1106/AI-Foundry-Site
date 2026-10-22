/* AI FOUNDRY — main script.
   Content shows instantly from js/data.js (or the last good API response cached in this browser),
   then fresh data is fetched in the background and swapped in only if it differs. */
const CACHE_KEY = "af:site:v1";
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
  } catch {
    return null;
  }
}
function writeCache(j) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(j));
  } catch {}
}
function loadSite() {
  const base = window.SITE_DATA || {};
  const url = base.CONFIG && base.CONFIG.DATA_URL;
  const initial = { ...base, ...(readCache() || {}) };
  const fresh = url
    ? (async () => {
        /* generous timeout: a sleeping free-tier server can take ~60s to wake, and nobody is waiting on it */
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 75000);
        try {
          const r = await fetch(url, { signal: ctl.signal });
          if (!r.ok) throw new Error(r.status);
          const j = await r.json();
          writeCache(j);
          return { ...base, ...j };
        } catch (e) {
          console.warn("Remote data failed; keeping current content", e);
          return null;
        } finally {
          clearTimeout(timer);
        }
      })()
    : Promise.resolve(null);
  return { initial, fresh };
}
/* ===== lamp physics (pure functions, no DOM) =====
   A lamp falls on an elastic cord: free fall while the cord is slack, then the cord snaps taut, stretches, the lamp
   bounces once or twice and sways like a pendulum until it settles. Lengths scale with the viewport, times do not,
   so the drop feels the same on a phone and a desktop. */
function createLamp(W, H, P = {}) {
  const s = Math.max(0.45, Math.min(1.25, Math.min(H / 900, W / 520 + 0.2)));
  const prm = { g: 2200, k: 1000, cd: 34, air: 3.0, vx0: 190, ka: 170, ca: 9, ...P };
  const ax = W / 2,
    ay = -200 * s /* the cord hangs from above the screen */,
    yRest = Math.max(H * 0.28, 150 * s) /* where the lamp ends up */,
    L0 = yRest - ay /* cord length at rest */;
  const L = { s, ax, ay, yRest, L0, x: ax, y: -120 * s, vx: prm.vx0 * s, vy: 0, ang: 0, angv: 0, taut: false, snaps: [], t: 0, maxStretch: 0 };
  L.step = function (dt) {
    let fx = 0,
      fy = prm.g * s;
    const dx = L.x - ax,
      dy = L.y - ay,
      d = Math.hypot(dx, dy);
    if (d > L0) {
      const nx = dx / d,
        ny = dy / d,
        ext = d - L0,
        vr = L.vx * nx + L.vy * ny;
      const T = Math.max(0, prm.k * ext + prm.cd * vr); /* a cord can pull, never push */
      fx -= T * nx;
      fy -= T * ny;
      if (ext > L.maxStretch) L.maxStretch = ext;
      if (!L.taut) {
        L.taut = true;
        if (vr > 120 * s) L.snaps.push({ t: L.t, v: vr });
      }
    } else L.taut = false;
    fx -= prm.air * L.vx; /* sideways drag damps the sway */
    L.vx += fx * dt;
    L.vy += fy * dt;
    L.x += L.vx * dt;
    L.y += L.vy * dt;
    const a = Math.atan2(L.x - ax, L.y - ay); /* the shade follows the cord direction with its own small lag */
    L.angv += (-prm.ka * (L.ang - a) - prm.ca * L.angv) * dt;
    L.ang += L.angv * dt;
    L.t += dt;
  };
  return L;
}
/* light intensity 0..1 during the flicker (ms): three soft dips, never a full black<->white strobe */
const FLICKER = [[0, 0], [70, 0.5], [150, 0.1], [260, 0.1], [330, 0.85], [430, 0.2], [520, 0.2], [600, 0.6], [700, 0.35], [800, 1]];
function flickerAt(ms) {
  if (ms <= 0) return 0;
  if (ms >= 800) return 1;
  for (let i = 1; i < FLICKER.length; i++)
    if (ms <= FLICKER[i][0]) {
      const [t0, v0] = FLICKER[i - 1],
        [t1, v1] = FLICKER[i];
      return v0 + ((v1 - v0) * (ms - t0)) / (t1 - t0);
    }
  return 1;
}
/* ===== end lamp physics ===== */
(async () => {
  const { initial, fresh } = loadSite();
  let {
    EVENTS,
    COLLABS,
    MEMBERS,
    LEADERS,
    PATRON,
    MANIFESTO,
    CONFIG,
    WHY,
    PAN,
    INS,
    PIPE,
    MIS,
    PROJECTS,
  } = initial;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /* the hero canvas draws with Inter 900 - wait for it (max 2.5s) so the particle text uses the right font */
  const fontsReady = (
    document.fonts && document.fonts.load
      ? Promise.race([document.fonts.load("900 100px Inter"), sleep(2500)])
      : Promise.resolve()
  ).catch(() => {});
  /* give the API a short head start (max 1.8s) so fresh content is usually in place before the loader lifts */
  const firstData = Promise.race([fresh, sleep(1800)]);

  /* ===== EDIT YOUR CONTENT HERE ===== */
  /* k: 'up' | 'past'.  r: optional link (registration for upcoming, recap for past) */
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  /* All content (data.js or the database) is treated as plain text: escH() makes it safe to place inside HTML.
     U() does the same for links and image addresses, and also drops anything that is not http(s)/mailto/relative
     (for example javascript:), so edited content can never run code on the page. */
  /* a member photo that fails to load is removed, so the initial letter underneath shows (a delegated listener, not an inline onerror) */
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (t && t.tagName === "IMG" && t.closest(".cy-ph")) t.remove();
    },
    true,
  );
  const escH = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const safeUrl = (u) => {
    const v = String(u ?? "").trim();
    const m = v.match(/^([a-z][a-z0-9+.-]*):/i);
    return !m || /^(https?|mailto)$/i.test(m[1]) ? v : "";
  };
  const U = (u) => escH(safeUrl(u));
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const card = (n, t, p, i) =>
    `<div class="card" style="--si:${i}"><span class="num">${escH(n)}</span><h3>${escH(t)}</h3><p>${escH(p)}</p></div>`;
  $("#why").innerHTML = WHY.map(
    (w, i) =>
      `<li class="pr up"><span class="pr-n mono">${String(i + 1).padStart(2, "0")}</span><div class="pr-b"><div class="pr-h"><span class="pr-t">${escH(w.title)}</span><i class="pr-ln"></i></div><p>${escH(w.text)}</p></div></li>`,
  ).join("");
  $("#mis").innerHTML = MIS.map((w, i) =>
    card("M" + (i + 1), w.title, w.text, i),
  ).join("");
  $("#trk").innerHTML =
    PAN.map(
      (p) =>
        `<div class="pn"><b>${escH(p.num)}</b><div><h3>${escH(p.title)}</h3><p>${escH(p.text)}</p></div><i class="pn-dim"></i></div>`,
    ).join("") +
    INS.map(
      (p) =>
        `<div class="pn ins"><b>+</b><div><h3>${escH(p.title)}</h3><p>${escH(p.text)}</p></div><i class="pn-dim"></i></div>`,
    ).join("");
  $("#pipe").insertAdjacentHTML(
    "beforeend",
    PIPE.map(
      (p) => `<div class="s"><h4>${escH(p.title)}</h4><p>${escH(p.text)}</p></div>`,
    ).join(""),
  );
  function renderPeople() {
    $("#col").innerHTML = COLLABS.map(
      (c, i) =>
        `<div class="rv ${c.real ? "real" : ""}" style="--d:${(i % 4) * 0.09}s">${c.logo ? `<img src="${U(c.logo)}" alt="${escH(c.name)}">` : escH(c.name)}</div>`,
    ).join("");
    /* members cylinder: one .cy-p card per member; the 3D layout (angle, radius, scroll length) is set in cyLayout() */
    $("#members").style.display = MEMBERS.length ? "" : "none";
    /* small teams (2-7) are repeated around the ring so it still closes into a full loop (the repeats are hidden from screen readers) */
    const reps = MEMBERS.length > 1 && MEMBERS.length < 8 ? Math.ceil(8 / MEMBERS.length) : 1;
    const slots = [];
    for (let r = 0; r < reps; r++) MEMBERS.forEach((m, i) => slots.push([m, i, r > 0]));
    $("#cyring").innerHTML = slots
      .map(([m, i, dup]) => {
        const name = String(m.name || "Member").trim() || "Member";
        const no = String(i + 1).padStart(2, "0");
        return `<div class="cy-p" style="--h:${8 + ((i * 7) % 26)}" data-nm="${escH(name)}" data-i="${i}" data-t="${MEMBERS.length}"${dup ? ' aria-hidden="true"' : ""}><i class="cy-slot"></i><div class="cy-ph"><span class="cy-in">${escH([...name][0].toUpperCase())}</span>${m.photo ? `<img src="${U(m.photo)}" alt="${escH(name)}" loading="lazy" decoding="async">` : ""}<small class="mono cy-ix">${no}</small><em class="mono cy-mk">AF</em></div><div class="cy-tx"><b>${escH(name)}</b><span class="mono">${escH(m.role || "Member")}</span></div></div>`;
      })
      .join("");
    $("#lead").innerHTML = LEADERS.map(
      (l, i) =>
        `<div class="rv" style="--d:${i * 0.15}s"><div class="ph"><img src="${U(l.photo)}" alt="${escH(l.name)}" loading="lazy" decoding="async"></div><h3>${escH(l.name)}</h3><span class="mono ac">${escH(l.role)}</span><a href="mailto:${escH(l.email)}">${escH(l.email)}</a></div>`,
    ).join("");
  }
  renderPeople();
  const md = $("#md");
  let lastF;
  function openEv(i) {
    const e = EVENTS[i];
    lastF = document.activeElement;
    $("#mk").textContent = (e.k === "up" ? "Upcoming" : "Past") + " event";
    $("#mt").textContent = e.t;
    $("#mm").innerHTML = [
      ["Date", e.d],
      ["Time", e.tm],
      ["Venue", e.v],
    ]
      .filter((m) => m[1])
      .map((m) => `<div><span class="mono">${escH(m[0])}</span><b>${escH(m[1])}</b></div>`)
      .join("");
    $("#ml").textContent = e.l || e.x;
    media(e);
    $("#mh").innerHTML = (e.hl || []).map((h) => `<li>${escH(h)}</li>`).join("");
    const r = $("#mr");
    if (e.k === "up") {
      r.style.display = "";
      r.href =
        safeUrl(e.r) ||
        `mailto:vidhayank.singh@universalai.in?subject=${encodeURIComponent("Interested in " + e.t)}`;
      r.textContent = e.r ? "Register now →" : "Register interest →";
    } else if (e.r) {
      r.style.display = "";
      r.href = safeUrl(e.r);
      r.textContent = "View recap →";
    } else r.style.display = "none";
    md.classList.add("on");
    document.documentElement.style.overflow = "hidden";
    $(".mx").focus();
  }
  function closeEv() {
    md.classList.remove("on");
    document.documentElement.style.overflow = "";
    lastF && lastF.focus();
  }
  $("#evl").onclick = (e) => {
    const r = e.target.closest(".ev");
    r && openEv(+r.dataset.i);
  };
  $("#evl").onkeydown = (e) => {
    if (e.key === "Enter") {
      const r = e.target.closest(".ev");
      r && openEv(+r.dataset.i);
    }
  };
  md.onclick = (e) => {
    if (e.target === md) closeEv();
  };
  $(".mx").onclick = closeEv;
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeEv();
  });
  /* ===== JOIN FORM: paste a form-backend URL (Formspree, Google Apps Script, etc.) to receive applications with the resume. Left empty, it opens the visitor's email app instead. ===== */
  const FORM_ENDPOINT = CONFIG.FORM_ENDPOINT,
    CLUB_EMAIL = CONFIG.EMAIL;
  const jn = $("#jn"),
    jf = $("#jf"),
    rf = $("#rf"),
    dz = $("#dz");
  let file = null;
  const openJ = () => {
    jn.classList.add("on");
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => $("#fn").focus({ preventScroll: true }), 700);
  };
  const closeJ = () => {
    jn.classList.remove("on");
    document.documentElement.style.overflow = "";
  };
  $$('a[href="#join"]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        openJ();
      }),
  );
  $("#jx").onclick = closeJ;
  const reduceMotionMQ = matchMedia("(prefers-reduced-motion: reduce)");
  /* ===== phone menu ===== */
  const mmBtn = $("#mmbtn"),
    mm = $("#mm"),
    phoneMQ = matchMedia("(max-width: 800px)");
  const setMenu = (open) => {
    document.documentElement.classList.toggle("mm-open", open);
    mmBtn.setAttribute("aria-expanded", open);
    mmBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mm.setAttribute("aria-hidden", !open);
  };
  mmBtn.addEventListener("click", () => setMenu(!document.documentElement.classList.contains("mm-open")));
  mm.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    setMenu(false);
    const href = a.getAttribute("href");
    if (href === "#join") return; /* the join handler opens the form */
    e.preventDefault();
    const t = $(href);
    if (t) setTimeout(() => t.scrollIntoView({ behavior: reduceMotionMQ.matches ? "auto" : "smooth", block: "start" }), 120);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
  phoneMQ.addEventListener("change", () => setMenu(false));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeJ();
  });
  const err = (f, m) => {
    const el = $(`[data-f="${f}"]`);
    el.classList.toggle("bad", !!m);
    el.querySelector(".er").textContent = m || "";
  };
  function setF(f) {
    if (!/\.(pdf|docx?)$/i.test(f.name))
      return err("rf", "Please upload a PDF or Word file");
    if (f.size > 5 * 1048576) return err("rf", "File must be under 5 MB");
    file = f;
    err("rf", "");
    $("#dn").textContent =
      f.name + " · " + Math.max(1, (f.size / 1024) | 0) + " KB";
    dz.classList.add("has");
  }
  rf.onchange = () => rf.files[0] && setF(rf.files[0]);
  ["dragenter", "dragover"].forEach((v) =>
    dz.addEventListener(v, (e) => {
      e.preventDefault();
      dz.classList.add("drag");
    }),
  );
  ["dragleave", "drop"].forEach((v) =>
    dz.addEventListener(v, (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
    }),
  );
  dz.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    f && setF(f);
  });
  $("#dr").onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    file = null;
    rf.value = "";
    dz.classList.remove("has");
  };
  ["fn", "fp", "fe"].forEach((i) =>
    $("#" + i).addEventListener("input", () => err(i, "")),
  );
  jf.onsubmit = async (e) => {
    e.preventDefault();
    const n = $("#fn").value.trim(),
      ph = $("#fp").value.trim(),
      em = $("#fe").value.trim();
    let bad = 0;
    const chk = (f, c, m) => {
      err(f, c ? m : "");
      if (c) bad++;
    };
    chk("fn", n.length < 2, "Please enter your full name");
    chk(
      "fp",
      !/^\+?[\d\s-]{10,16}$/.test(ph) || ph.replace(/\D/g, "").length < 10,
      "Enter a valid phone number",
    );
    chk(
      "fe",
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em),
      "Enter a valid email address",
    );
    if (!file) {
      err("rf", "Please attach your resume");
      bad++;
    }
    if (bad) return;
    const b = $("#js");
    b.disabled = true;
    b.textContent = "Sending…";
    const done = (m) => {
      $("#okm").textContent = m;
      $(".jr").classList.add("done");
    };
    if (FORM_ENDPOINT) {
      try {
        const d = new FormData();
        d.append("name", n);
        d.append("phone", ph);
        d.append("email", em);
        d.append("resume", file);
        const r = await fetch(FORM_ENDPOINT, {
          method: "POST",
          body: d,
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw 0;
        done(
          "Thanks " +
            n.split(" ")[0] +
            "! We’ve received your application and will be in touch soon.",
        );
      } catch {
        b.disabled = false;
        b.textContent = "Send application →";
        $("#fo").textContent = "Something went wrong. Please try again.";
      }
    } else {
      location.href = `mailto:${CLUB_EMAIL}?subject=${encodeURIComponent("Join AI Foundry — " + n)}&body=${encodeURIComponent(`Name: ${n}\nPhone: ${ph}\nEmail: ${em}\n\n(Please attach your resume: ${file.name})`)}`;
      done(
        "Your email app should open with your details filled in. Attach " +
          file.name +
          " and hit send.",
      );
    }
  };
  function media(o) {
    $("#mi").innerHTML = o.img ? `<img src="${U(o.img)}" alt="">` : "";
    $("#mg").innerHTML = (o.gallery || [])
      .map(
        (g) =>
          `<a href="${U(g)}" target="_blank" rel="noopener"><img src="${U(g)}" alt="" loading="lazy"></a>`,
      )
      .join("");
  }
  const ICON = {
    instagram:
      '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
    discord:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.293a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4.5 9h3.2v10.5H4.5zM6.1 4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM10 9h3v1.5c.5-.9 1.7-1.7 3.3-1.7 3.2 0 3.7 2.1 3.7 4.8v5.9h-3.2v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.3H10z"/></svg>',
  };
  $("#soc").innerHTML = Object.entries(CONFIG.SOCIAL || {})
    .filter(([k, u]) => ICON[k] && u)
    .map(
      ([k, u]) =>
        `<a href="${U(u)}" target="_blank" rel="noopener" aria-label="${escH(k)}">${ICON[k]}</a>`,
    )
    .join("");
  $("#cmail").textContent = CONFIG.CLUB_EMAIL;
  $("#cmail").href = "mailto:" + CONFIG.CLUB_EMAIL;
  function projs(k) {
    const cur = (p) => (p.k === "done" ? 3 : p.st);
    $("#pgrid").innerHTML = PROJECTS.map((p, i) => [p, i])
      .filter(([p]) => p.k === k)
      .map(
        ([p, i], n) =>
          `<div class="pc rv ${p.k}" data-i="${i}" tabindex="0" role="button" style="--d:${n * 0.1}s;--p:${num(p.p, 100) || 100}%"><div class="cv ${p.img ? "" : "none"}">${p.img ? `<img src="${U(p.img)}" alt="" loading="lazy">` : "<span>✦</span>"}</div><div class="top"><span class="ty mono">${escH(p.type)}</span><span class="mono" style="color:var(--mut)">${String(i + 1).padStart(2, "0")}</span></div>${p.k === "done" ? '<div class="stamp">FORGED</div>' : ""}<h3>${escH(p.t)}</h3><p>${escH(p.x)}</p><div class="tg">${(p.tech || []).map((x) => `<span>${escH(x)}</span>`).join("")}</div>${p.k === "on" ? `<div class="pct mono"><span>Heat</span><b>${num(p.p)}%</b></div><div class="heat"><i></i></div>` : ""}<div class="stg">${PIPE.map((s, j) => `<i class="${j <= cur(p) ? "on" : ""} ${p.k === "on" && j === p.st ? "now" : ""}"></i>`).join("")}</div><div class="stl">${PIPE.map((s, j) => `<span class="${j <= cur(p) ? "on" : ""}">${escH(s.title)}</span>`).join("")}</div></div>`,
      )
      .join("");
    $("#pc1").textContent = PROJECTS.filter((p) => p.k === "on").length;
    $("#pc2").textContent = PROJECTS.filter((p) => p.k === "done").length;
  }
  /* projects carousel: arrows scroll one card at a time */
  const pg = $("#pgrid"),
    pnav = $("#pnav"),
    pprev = $("#pprev"),
    pnext = $("#pnext");
  function pStep() {
    const c = pg.querySelector(".pc");
    if (!c) return 0;
    return c.getBoundingClientRect().width + (parseFloat(getComputedStyle(pg).columnGap) || 0);
  }
  function pUpdate() {
    const cards = pg.querySelectorAll(".pc").length,
      step = pStep() || 1,
      per = Math.max(1, Math.round((pg.clientWidth + 1) / step)),
      max = pg.scrollWidth - pg.clientWidth,
      first = Math.min(cards, Math.round(pg.scrollLeft / step) + 1),
      last = Math.min(cards, first + per - 1);
    pnav.hidden = pprev.hidden = pnext.hidden = cards <= per;
    pprev.disabled = pg.scrollLeft <= 2;
    pnext.disabled = pg.scrollLeft >= max - 2;
    $("#pcount").textContent = cards ? (first === last ? first : first + "–" + last) + " / " + cards : "";
  }
  pprev.onclick = () => pg.scrollBy({ left: -pStep() });
  pnext.onclick = () => pg.scrollBy({ left: pStep() });
  let pRaf = 0;
  pg.addEventListener("scroll", () => {
    cancelAnimationFrame(pRaf);
    pRaf = requestAnimationFrame(pUpdate);
  }, { passive: true });
  addEventListener("resize", pUpdate);
  /* new cards drawn (tab switch / remote data): back to the start */
  new MutationObserver(() => {
    pg.style.scrollBehavior = "auto";
    pg.scrollLeft = 0;
    pg.style.scrollBehavior = "";
    pUpdate();
  }).observe(pg, { childList: true });
  function openP(i) {
    const p = PROJECTS[i];
    lastF = document.activeElement;
    $("#mk").textContent =
      (p.k === "on" ? "Ongoing " : "Completed ") + p.type.toLowerCase();
    $("#mt").textContent = p.t;
    $("#mm").innerHTML = [
      ["Stage", PIPE[p.k === "done" ? 3 : p.st].title],
      ["Progress", p.k === "on" ? num(p.p) + "%" : "Completed"],
      ["Lead", p.lead],
      ["Timeline", p.d],
    ]
      .filter((m) => m[1])
      .map((m) => `<div><span class="mono">${escH(m[0])}</span><b>${escH(m[1])}</b></div>`)
      .join("");
    $("#ml").textContent = p.l || p.x;
    media(p);
    $("#mh").innerHTML = (p.hl || []).map((h) => `<li>${escH(h)}</li>`).join("");
    const r = $("#mr");
    if (p.r) {
      r.style.display = "";
      r.href = safeUrl(p.r);
      r.textContent = p.k === "done" ? "View outcome →" : "Follow progress →";
    } else r.style.display = "none";
    md.classList.add("on");
    document.documentElement.style.overflow = "hidden";
    $(".mx").focus();
  }
  $("#pgrid").onclick = (e) => {
    const c = e.target.closest(".pc");
    c && openP(+c.dataset.i);
  };
  $("#pgrid").onkeydown = (e) => {
    if (e.key === "Enter") {
      const c = e.target.closest(".pc");
      c && openP(+c.dataset.i);
    }
  };
  function evs(k) {
    $("#evl").innerHTML = EVENTS.map((e, i) => [e, i])
      .filter(([e]) => e.k === k)
      .map(
        ([e, i]) =>
          `<div class="ev rv" data-i="${i}" tabindex="0" role="button"><span class="mono ac">${escH(e.d)}</span><div><h3>${escH(e.t)}</h3><p>${escH(e.x)}</p></div>${e.img ? `<div class="th"><img src="${U(e.img)}" alt="" loading="lazy"></div>` : '<div class="th none"><span>✦</span></div>'}<span class="ar">↗</span></div>`,
      )
      .join("");
  }
  function renderPatron() {
    $("#pimg").src = safeUrl(PATRON.photo);
    $("#pimg").alt = PATRON.name;
    $("#pq").innerHTML = PATRON.message
      .map(
        (x, i, a) =>
          `<p${i === a.length - 1 ? ' class="ac"' : ""}>${i === 0 ? "“" : ""}${escH(x)}${i === a.length - 1 ? "”" : ""}</p>`,
      )
      .join("");
    $("#pn").textContent = PATRON.name;
    $("#pr").textContent = PATRON.role;
    $("#ps").src = safeUrl(PATRON.signature);
  }
  renderPatron();
  let evK = "up",
    pK = "on";
  evs(evK);
  $$("#evtabs button").forEach(
    (b) =>
      (b.onclick = () => {
        $$("#evtabs button").forEach((x) => x.classList.toggle("on", x === b));
        evK = b.dataset.k;
        evs(evK);
      }),
  );
  projs(pK);
  $$("#ptabs button").forEach(
    (b) =>
      (b.onclick = () => {
        $$("#ptabs button").forEach((x) => x.classList.toggle("on", x === b));
        pK = b.dataset.k;
        projs(pK);
      }),
  );
  /* manifesto words */
  const words = [];
  function renderManifesto() {
    words.length = 0;
    $("#mtxt").innerHTML = MANIFESTO.split(" ")
      .map((w) => {
        const h = w.startsWith("*");
        return `<i class="${h ? "hot" : ""}">${escH(w.replace("*", ""))}</i> `;
      })
      .join("");
    $$("#mtxt i").forEach((i) => words.push(i));
  }
  renderManifesto();
  /* ===== intro: the hanging lamp =====
     A lamp drops on its cord (snaps taut, stretches, bounces, sways), settles, flickers on and lights the logo; the logo
     glides to its place in the hero badge and the page is revealed in a growing circle around it.
     Repeat visits in a session get a short version. Debug: ?replay plays it again, ?slowmo plays it 3x slower. */
  let introBusy = true;
  const load = $("#load");
  const startHero = () => {
    t0 = performance.now() + 250;
    started = true;
  };
  /* replay: the hero particles fly in again, exactly like on first load */
  const replayHero = () => {
    for (const p of D) {
      p.x = Math.random() * W;
      p.y = H * 1.1 + Math.random() * H * 0.6;
      p.vx = p.vy = 0;
    }
    calm = false;
    startHero();
  };
  function lampIntro(replay = false) {
    /* replay = the back-to-top button: the same intro again (lamp, flicker, logo, circle) with the page jumping to the top behind the dark screen */
    const sp = new URLSearchParams(location.search);
    /* a returning visitor already has this browser's cached content on screen: don't hold the intro for fresh data */
    const gate = replay ? Promise.resolve() : readCache() ? fontsReady.then(() => {}) : Promise.all([fontsReady, firstData]);
    const el = {
      cord: $("#ldcord"), lamp: $("#ldlamp"), cone: $("#ldcone"), rim: $("#ldglowrim"), bulb: $("#ldbulb"),
      glow: $("#ldglow"), disc: $("#lddisc"), cap: $("#ldcap"),
    };
    if (!load || !el.lamp || !el.disc) {
      /* old cached HTML without the lamp markup: just open the page */
      gate.then(() => {
        heroGo();
        introBusy = false;
        if (load) load.classList.add("go");
      });
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem("af:intro") === "1";
      sessionStorage.setItem("af:intro", "1");
    } catch {}
    const slow = sp.has("slowmo") ? 3 : 1;
    const full = !reduced && (replay || scrollY < 40); /* the full lamp intro plays on every open (not only the first of a session) */
    const W = innerWidth,
      H = innerHeight;
    const lamp = createLamp(W, H),
      s = lamp.s;
    const D = Math.round(Math.max(150, Math.min(300, 0.3 * Math.min(W, H)))) /* logo disc diameter */;
    const dcx = W / 2,
      dcy = Math.min(lamp.yRest + 92 * s + 56 * s + D / 2, H - D / 2 - 24);
    const GS = Math.round(Math.min(Math.max(W, H) * 0.9, 1100));
    el.disc.style.width = el.disc.style.height = D + "px";
    el.glow.style.width = el.glow.style.height = GS + "px";
    const coneLen = Math.max(40, (dcy - D * 0.42 - lamp.yRest) / s);
    el.cone.setAttribute("points", `-50,84 50,84 ${(D * 0.46) / s},${coneLen} ${(-D * 0.46) / s},${coneLen}`);
    load.classList.toggle("ld-fast", !full);

    const heroGo = () => (replay ? replayHero() : startHero());
    const root = document.documentElement;
    let jumpTimer = 0, failTimer = 0;

    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const setDisc = (cx, cy, sc) => {
      el.disc.style.transform = `translate3d(${(cx - D / 2).toFixed(1)}px,${(cy - D / 2).toFixed(1)}px,0) scale(${sc.toFixed(4)})`;
    };
    const measureTarget = () => {
      const b = $(".badge img"),
        r = b && b.getBoundingClientRect();
      if (!r || !r.width) return { cx: W * 0.85, cy: H * 0.3, d: D * 0.45 };
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, d: r.width };
    };

    /* timeline (seconds of intro time; ?slowmo stretches it) */
    const TF = 1.35 /* flicker starts */, FL = 0.8 /* flicker length */, FLY = 0.65, OVER = 0.85 /* iris starts at 85% of the flight */, IRIS = 0.8;
    let T = 0, last = 0, acc = 0, stage = full ? "lamp" : "hold", flyAt = 0, irisAt = 0, irisDur = IRIS;
    let gateOk = false, skipped = false, irisOn = false, fadeMode = false, tg = null, rmax = 0, waveT0 = -9, waveAmp = 0, nSnaps = 0, raf = 0, sign = 1, ended = false;
    gate.then(() => (gateOk = true));

    let lastLight = -1; /* the lamp's light is steady for long stretches: only touch the DOM when it actually changed */
    const light = (I) => {
      const lk = Math.round(I * 1000);
      if (lk === lastLight) return;
      lastLight = lk;
      el.bulb.setAttribute("opacity", I.toFixed(3));
      el.rim.setAttribute("opacity", (I * 0.85).toFixed(3));
      el.cone.setAttribute("opacity", (I * 0.9).toFixed(3));
      el.glow.style.opacity = (I * 0.9).toFixed(3);
      el.cap.style.opacity = I.toFixed(3);
    };
    const drawLamp = (lift) => {
      const lx = lamp.x,
        ly = lamp.y - lift,
        ax = lamp.ax,
        ay = lamp.ay;
      const dx = lx - ax,
        dy = ly - ay,
        d = Math.hypot(dx, dy) || 1,
        nx = -dy / d,
        ny = dx / d;
      const slack = Math.max(0, lamp.L0 - Math.hypot(lamp.x - ax, lamp.y - ay));
      const sag = Math.min(60 * s, Math.sqrt((3 * d * slack) / 8)) * sign; /* slack cord hangs in a curve */
      const wt = lamp.t - waveT0,
        A = waveAmp * Math.exp(-wt / 0.35); /* a ripple runs along the cord after each snap */
      let path = "";
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        let off = sag * 4 * u * (1 - u);
        if (A > 0.05) off += A * (Math.sin(Math.PI * u) * Math.cos(2 * Math.PI * 5 * wt) + 0.45 * Math.sin(2 * Math.PI * u) * Math.cos(2 * Math.PI * 11 * wt));
        path += (i ? "L" : "M") + (ax + dx * u + nx * off).toFixed(1) + " " + (ay + dy * u + ny * off).toFixed(1);
      }
      el.cord.setAttribute("d", path);
      el.lamp.setAttribute("transform", `translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(${((-lamp.ang * 180) / Math.PI).toFixed(2)}) scale(${s.toFixed(3)})`);
      const bx = lx + 81 * s * Math.sin(lamp.ang),
        by = ly + 81 * s * Math.cos(lamp.ang);
      el.glow.style.transform = `translate3d(${(bx - GS / 2).toFixed(1)}px,${(by - GS / 2).toFixed(1)}px,0)`;
    };
    const finish = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      load.classList.add("go");
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
      load.removeEventListener("wheel", block);
      load.removeEventListener("touchmove", block);
      introBusy = false;
      if (replay) {
        clearTimeout(jumpTimer);
        clearTimeout(failTimer);
        load.style.transition = load.style.opacity = "";
        root.style.overflow = "";
        root.classList.remove("replay");
        window.__afReplay = false;
        scrollTo(0, 0);
        resetGovernor(); /* don't let the frame-rate governor judge the frames that just played */
      }
    };
    const fadeOut = () => {
      stage = "end";
      load.classList.add("ld-off", "fade");
      el.disc.style.display = "none";
      heroGo();
      setTimeout(finish, 500);
    };
    const beginIris = () => {
      tg = measureTarget();
      if (document.documentElement.classList.contains("lite")) {
        /* weakest tier (or software rendering): a plain cross-fade instead of repainting a growing gradient every frame */
        irisOn = true;
        fadeMode = true;
        load.classList.add("fade");
        heroGo();
        setTimeout(finish, 500);
        return;
      }
      rmax = Math.hypot(Math.max(tg.cx, W - tg.cx), Math.max(tg.cy, H - tg.cy)) + 80;
      load.style.setProperty("--x", tg.cx.toFixed(1) + "px");
      load.style.setProperty("--y", tg.cy.toFixed(1) + "px");
      load.classList.add("iris");
      load.removeEventListener("wheel", block);
      load.removeEventListener("touchmove", block);
      heroGo();
      irisOn = true;
      irisAt = T;
    };
    const beginFly = () => {
      if (scrollY > 40) return fadeOut(); /* the browser restored a scrolled position: the badge isn't on screen */
      tg = measureTarget();
      stage = "fly";
      flyAt = T;
    };
    function skip() {
      if (ended || skipped) return;
      skipped = true;
      irisDur = 0.5;
      if (replay) {
        clearTimeout(jumpTimer);
        load.style.transition = load.style.opacity = "";
        scrollTo(0, 0);
      }
      if (stage === "lamp" || stage === "hold") {
        load.classList.add("ld-off");
        light(0);
        if (scrollY > 40) return fadeOut();
        tg = measureTarget();
        setDisc(tg.cx, tg.cy, tg.d / D);
        el.disc.style.opacity = 1;
        stage = "done";
        beginIris();
      }
    }
    const onKey = (e) => e.key === "Escape" && skip();
    const block = (e) => e.preventDefault();
    addEventListener("keydown", onKey);
    /* a replay ignores the small resizes that mobile browsers fire when the address bar moves */
    const onResize = replay ? () => (Math.abs(innerWidth - W) > 2 || Math.abs(innerHeight - H) > 150) && skip() : skip;
    addEventListener("resize", onResize);
    load.addEventListener("wheel", block, { passive: false });
    load.addEventListener("touchmove", block, { passive: false });

    if (reduced) {
      el.disc.style.display = "none";
      gate.then(fadeOut);
      return;
    }
    if (replay) {
      window.__afReplay = true;
      introBusy = true;
      root.classList.add("replay");
      root.style.overflow = "hidden"; /* nothing can scroll behind the intro */
      load.classList.remove("go", "ld-off", "fade", "iris", "ld-fast");
      load.style.setProperty("--r", "0px");
      el.disc.style.display = "";
      el.disc.style.opacity = 0;
      light(0);
      /* the dark screen fades in over the page, THEN the page jumps to the top underneath it */
      load.style.transition = "none";
      load.style.opacity = "0";
      void load.offsetWidth;
      load.style.transition = "opacity 0.35s ease";
      load.style.opacity = "1";
      jumpTimer = setTimeout(() => {
        scrollTo(0, 0);
        load.style.transition = load.style.opacity = "";
      }, 400);
      failTimer = setTimeout(finish, 14000); /* never trap anyone behind the intro */
    }
    if (!full) {
      tg = measureTarget();
      setDisc(tg.cx, tg.cy, tg.d / D);
      requestAnimationFrame(() => (el.disc.style.opacity = 1));
    } else {
      setDisc(dcx, dcy, 1);
      drawLamp(0);
      load.classList.add("ld-lamp"); /* the lamp now sits above the screen, so it is safe to show */
    }
    function tick(ts) {
      raf = requestAnimationFrame(tick);
      const dtReal = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      T += dtReal / slow;
      if (stage === "lamp" || stage === "fly") {
        acc += dtReal / slow;
        while (acc >= 1 / 240) {
          lamp.step(1 / 240);
          acc -= 1 / 240;
          if (lamp.snaps.length > nSnaps) {
            const sn = lamp.snaps[nSnaps++];
            waveT0 = lamp.t;
            waveAmp = Math.min(14 * s, sn.v * 0.011);
          }
        }
      }
      if (stage === "lamp") {
        const I = flickerAt((T - TF) * 1000);
        light(I);
        el.disc.style.opacity = (I * (1 - 0.04 * Math.sin(T * 90))).toFixed(3);
        drawLamp(0);
        if (T >= TF + FL + 0.05 && gateOk) beginFly();
      } else if (stage === "fly") {
        const p = clamp01((T - flyAt) / FLY),
          e = ease(p);
        const dx = tg.cx - dcx,
          dy = tg.cy - dcy,
          len = Math.hypot(dx, dy) || 1,
          arc = Math.sin(Math.PI * e) * 0.06 * len;
        setDisc(dcx + dx * e + (-dy / len) * arc, dcy + dy * e + (dx / len) * arc, 1 + (tg.d / D - 1) * e);
        el.disc.style.opacity = 1;
        drawLamp(p * p * p * (lamp.y + 160 * s));
        light(1 - clamp01(p * 1.4));
        if (p >= OVER && !irisOn) beginIris();
        if (p >= 1) {
          stage = "done";
          load.classList.add("ld-off"); /* the lamp has left the screen */
        }
      } else if (stage === "hold") {
        if (gateOk && T >= 0.3) {
          stage = "done";
          beginIris();
        }
      }
      if (irisOn && !fadeMode) {
        const p2 = clamp01((T - irisAt) / irisDur),
          r = ease(p2) * rmax;
        load.style.setProperty("--r", r.toFixed(1) + "px");
        if (r > tg.d / 2 + 8) el.disc.style.display = "none"; /* the real badge underneath has taken over */
        if (p2 >= 1) finish();
      }
    }
    raf = requestAnimationFrame(tick);
  }
  /* first visit of a session: the logo is FORGED piece by piece (js/forge.js), then it flies into the hero badge and the
     page opens from it. Everything else (repeat visits, the weakest tier, reduced motion, no CDN / no anime.js, ?lamp)
     uses the lamp intro above, which is also the fallback if the forge animation can't start. ?replay forces the full intro. */
  function intro() {
    const sp = new URLSearchParams(location.search);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem("af:intro") === "1";
    } catch {}
    /* each time the full intro plays, flip a coin: forge the logo, or the lamp. ?forge / ?lamp force one for testing */
    const wantForge = sp.has("forge") ? true : sp.has("lamp") ? false : Math.random() < 0.5;
    const forge = !reduced && scrollY < 40 && wantForge && load && window.AIForge;
    if (!forge) return lampIntro();
    load.classList.add("ld-fast"); /* plain black screen while the animation downloads (normally well under a second) */
    const giveUp = new Promise((r) => setTimeout(() => r(false), 2500));
    /* the intro starts one step lighter on machines that usually struggle with it (fewer than 8 cores, or Intel integrated graphics):
       no WebGL background (so the 3D library is not even downloaded), fewer 3D layers, no heat haze. It also steps down by itself while
       playing if the frame rate drops (see the live governor in forge.js). Strong machines still get the full version. */
    let iq = 0;
    const introTier = () =>
      forced !== null
        ? q
        : Math.max(
            q,
            (navigator.hardwareConcurrency || 8) < 8 || (/intel/i.test(renderer) && !/\barc\b/i.test(renderer)) ? 1 : 0,
          );
    Promise.race([AIForge.load(), giveUp])
      .then((ok) => ((iq = introTier()), ok && iq < 2 ? AIForge.prepare(iq, 1500) : false))
      .catch(() => false)
      .then((ok) => {
        if (!ok) return lampIntro();
        try {
          sessionStorage.setItem("af:intro", "1");
        } catch {}
        /* if the forge animation breaks half way, forge.js tidies up after itself and the lamp intro takes over */
        const lampInstead = () => {
          introBusy = true;
          started = false;
          try {
            sessionStorage.removeItem("af:intro"); /* so the lamp plays its full version, not the short repeat-visit one */
          } catch {}
          load.classList.remove("go");
          lampIntro();
        };
        if (!AIForge.start({ tier: iq, onFail: lampInstead })) lampIntro();
      });
  }
  intro();
  /* Vision / Why we exist: wrap every word so it can rise in one after another (CSS does the animation) */
  $$(".vm p").forEach((p) => {
    let k = 0;
    (function wrap(node) {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const f = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) f.append(" ");
            else {
              const s = document.createElement("span");
              s.className = "w";
              s.style.setProperty("--i", k++);
              s.textContent = t;
              f.append(s);
            }
          });
          n.replaceWith(f);
        } else if (n.nodeType === 1) wrap(n);
      });
    })(p);
  });
  /* reveal */
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.15 },
  );
  const watch = () => $$(".rv:not(.in)").forEach((e) => io.observe(e));
  watch();
  new MutationObserver(watch).observe($("#evl"), { childList: 1 });
  new MutationObserver(watch).observe($("#pgrid"), { childList: 1 });
  /* counters */
  new IntersectionObserver(
    (es, o) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          o.unobserve(e.target);
          const b = e.target,
            t = +b.dataset.n,
            s = performance.now();
          (function f(now) {
            const p = Math.min(1, (now - s) / 1600);
            b.textContent = Math.round(t * (1 - Math.pow(1 - p, 4)));
            if (p < 1) requestAnimationFrame(f);
          })(s);
        }
      }),
    { threshold: 0.6 },
  ).observe &&
    $$("[data-n]").forEach((b) =>
      new IntersectionObserver(
        (es, o) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              o.unobserve(b);
              const t = +b.dataset.n,
                s = performance.now();
              (function f(now) {
                const p = Math.min(1, (now - s) / 1600);
                b.textContent = Math.round(t * (1 - Math.pow(1 - p, 4)));
                if (p < 1) requestAnimationFrame(f);
              })(s);
            }
          }),
        { threshold: 0.6 },
      ).observe(b),
    );
  /* ===== performance tiers =====
     q0 = full effects | q1 = lighter hero + no blend modes / static grid floor | q2 = "lite" (also no noise, tilt, parallax, embers).
     Starts from what the device looks like (GPU, cores, memory, touch, reduced-motion) and then adapts to the REAL
     frame rate: if the page keeps running slower than ~45fps it steps down a tier and remembers it for the session.
     Debug helpers: add ?perf to the URL for a live overlay, ?q=0|1|2 to force a tier. */
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const forced = params.has("q") ? Math.max(0, Math.min(2, +params.get("q") || 0)) : null;
  const coarse = matchMedia("(hover: none)").matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  /* which graphics path is the browser really using? (hardware acceleration off / blocklisted GPU => software rendering) */
  let renderer = "unknown";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "webgl (renderer hidden)";
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    } else renderer = "no webgl";
  } catch {}
  const software = /swiftshader|llvmpipe|basic render|software/i.test(renderer);
  const igpu = /intel.*\b(uhd|hd) graphics/i.test(renderer);
  let q = 0;
  try {
    q = +sessionStorage.getItem("af:q") || 0;
  } catch {}
  q = Math.max(
    q,
    coarse || weak || igpu ? 1 : 0,
    software || matchMedia("(prefers-reduced-motion: reduce)").matches ? 2 : 0,
  );
  if (forced !== null) q = forced;
  root.classList.toggle("mid", q >= 1);
  root.classList.toggle("lite", q >= 2);
  const dprFor = () => (q === 0 ? Math.min(1.25, devicePixelRatio || 1) : 1);

  /* cursor + pointer (pointermove only records; all DOM work happens once per frame in frame()) */
  const cur = $(".cur");
  let mx = innerWidth / 2,
    my = innerHeight / 2,
    cx = mx,
    cy = my,
    pmoved = false,
    touchOn = false, /* a finger is on the screen (phones have no cursor: without this the screen centre acted as a permanent pointer) */
    ptarget = null;
  addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch") return;
      touchOn = true;
      mx = e.clientX;
      my = e.clientY;
      pmoved = true;
    },
    { passive: true },
  );
  addEventListener("pointerup", () => (touchOn = false), { passive: true });
  addEventListener("pointercancel", () => (touchOn = false), { passive: true });
  addEventListener(
    "pointermove",
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      pmoved = true;
      ptarget = e.target;
    },
    { passive: true },
  );
  document.addEventListener("pointerover", (e) => {
    const s = !!e.target.closest(".ph");
    cur.classList.toggle("sm", s);
    cur.classList.toggle(
      "big",
      !s && !!e.target.closest("a,button,.m,.ev,.pc,.kx-scene,.kx-toc li"),
    );
  });
  /* hero particle typography */
  const cv = $("#cv"),
    g = cv.getContext("2d"),
    spot = $(".spot");
  let W,
    H,
    D = [],
    P = [],
    t0 = 0,
    started = false,
    dpr = dprFor(),
    stp = 4,
    calm = false /* true = particles are at rest: skip redrawing until something changes */,
    lastHeroSy = NaN,
    lastHx = NaN,
    lastHy = NaN;
  function size(force) {
    dpr = dprFor();
    const nw = Math.round(cv.offsetWidth * dpr),
      nh = Math.round(cv.offsetHeight * dpr);
    /* mobile browsers fire "resize" when the URL bar hides/shows - don't rebuild everything for that */
    if (!force && nw === W && nh === H) return;
    cv.width = nw;
    cv.height = nh;
    W = nw;
    H = nh;
    calm = false;
    const embers = [Math.min(120, (W / 14) | 0), Math.min(60, (W / 28) | 0), 0][q];
    P = Array.from({ length: embers }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 2 + 0.5) * dpr,
      v: (Math.random() * 0.7 + 0.2) * dpr,
      a: Math.random(),
    }));
    const o = document.createElement("canvas");
    o.width = W;
    o.height = H;
    const c = o.getContext("2d", { willReadFrequently: true });
    let fs = Math.min(W / 4.2, H * 0.34);
    const F = (s) => {
      c.font = `900 ${s}px Inter,Arial,sans-serif`;
      if ("letterSpacing" in c) c.letterSpacing = `${-s * 0.04}px`;
    };
    F(fs);
    const w = c.measureText("FOUNDRY").width;
    if (w + fs * 0.17 > W * 0.88) {
      fs *= (W * 0.88) / (w + fs * 0.17);
      F(fs);
    }
    /* phones: a tall screen, so the wordmark is stretched vertically (bold poster type), "AI" is bigger than "FOUNDRY",
       and the whole thing sits in the middle with the tagline and buttons (real text) underneath */
    const phone = innerWidth <= 800,
      ys = phone ? 2 : 1,
      x0 = W * 0.06,
      b2 = phone ? H - Math.min(300, H * 0.36) : H * 0.8,
      fsAI = phone ? fs * 1.55 : fs,
      b1 = phone ? b2 - fs * 0.73 * ys - 14 : b2 - fs * 0.84;
    c.fillStyle = "#fff";
    [
      ["AI", b1, fsAI],
      ["FOUNDRY", b2, fs],
    ].forEach(([s, y, f]) => {
      F(f);
      c.setTransform(1, 0, -0.22 * ys, ys, x0, y);
      c.fillText(s, 0, 0);
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
    /* whole pixels only (a fractional step breaks the pixel lookup); coarser grid on lighter tiers */
    stp = Math.round(Math.max(3 * dpr, fs / 46) * [1, 1.25, 1.6][q]);
    const d = c.getImageData(0, 0, W, H).data,
      cap = phone ? 1500 : 1e9; /* a particle budget on phones: the grid gets coarser until the count fits */
    for (let tries = 0; ; tries++) {
      D = [];
      for (let y = 0; y < H; y += stp)
        for (let x = 0; x < W; x += stp)
          if (d[(y * W + x) * 4 + 3] > 128) {
            const sx = Math.random() * W,
              sy2 = H * 1.1 + Math.random() * H * 0.6;
            D.push({
              tx: x,
              ty: y,
              x: started ? x : sx,
              y: started ? y : sy2,
              vx: 0,
              vy: 0,
              z: 0.3 + Math.random() * 0.9,
              dl: (x / W) * 700 + Math.random() * 500,
              w: Math.random() < 0.1,
            });
          }
      if (D.length <= cap || tries > 5) break;
      stp += 1;
    }
  }
  size();
  fontsReady.then(() => size(true));
  let rz;
  addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      size();
      needMeasure = true;
    }, 200);
  });
  const B = [[], [], []],
    AB = [[], [], [], []];
  function hero_(t) {
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = q === 0 ? "lighter" : "source-over";
    const noPtr = coarse && !touchOn, /* phone with no finger down: nothing should push the particles */
      lx = noPtr ? -9999 : (mx - cvL) * dpr,
      ly = noPtr ? -9999 : (my - (cvT - scrollY)) * dpr;
    /* ambient embers: sorted into 4 opacity levels -> 4 fills instead of one fill per ember */
    for (let i = 0; i < 4; i++) AB[i].length = 0;
    for (const p of P) {
      p.y -= p.v;
      p.x += Math.sin(t / 900 + p.a * 9) * 0.35 * dpr;
      if (p.y < -10) {
        p.y = H + 10;
        p.x = Math.random() * W;
      }
      const a = 0.2 + 0.6 * Math.abs(Math.sin(t / 700 + p.a * 6));
      AB[Math.min(3, (((a - 0.2) / 0.6) * 4) | 0)].push(p);
    }
    g.fillStyle = "#ff7a2e";
    for (let i = 0; i < 4; i++) {
      if (!AB[i].length) continue;
      g.globalAlpha = 0.2 + (0.6 * (i + 0.5)) / 4;
      g.beginPath();
      for (const p of AB[i]) {
        g.moveTo(p.x + p.r, p.y);
        g.arc(p.x, p.y, p.r, 0, 6.283);
      }
      g.fill();
    }
    const k = cl(sy / innerHeight, 0, 1),
      R = 170 * dpr,
      R2 = R * R,
      thr = 4.84 * dpr * dpr,
      s = stp * 0.62,
      kx = k * W * 0.3,
      ky = k * k * H * 1.4;
    B[0].length = B[1].length = B[2].length = 0;
    let maxV2 = 0;
    for (const p of D) {
      if (!started || t < t0 + p.dl) continue;
      const tx = p.tx + (p.z - 0.7) * kx,
        ty = p.ty - ky * p.z;
      let fx = (tx - p.x) * 0.055,
        fy = (ty - p.y) * 0.055;
      const dx = p.x - lx,
        dy = p.y - ly,
        d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const d = Math.sqrt(d2) || 1,
          f = (1 - d / R) ** 2 * 9 * dpr;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
      p.vx = (p.vx + fx) * 0.84;
      p.vy = (p.vy + fy) * 0.84;
      p.x += p.vx;
      p.y += p.vy;
      const v2 = p.vx * p.vx + p.vy * p.vy;
      if (v2 > maxV2) maxV2 = v2;
      B[v2 > thr ? 1 : p.w ? 2 : 0].push(p);
    }
    g.globalAlpha = 0.95;
    [
      ["#ff4d2e", 0],
      ["#ffd27a", 1],
      ["#f3f1ec", 2],
    ].forEach(([c, i]) => {
      g.fillStyle = c;
      for (const p of B[i]) g.fillRect(p.x | 0, p.y | 0, s, s);
    });
    g.globalAlpha = 0.12;
    g.fillStyle = "#ff4d2e";
    for (const p of B[0])
      if (p.w) g.fillRect((p.x - s) | 0, (p.y - s) | 0, s * 3, s * 3);
    /* nothing is moving (no embers, every particle has started and is at rest) -> following frames can be skipped */
    return P.length === 0 && started && t > t0 + 1300 && maxV2 < 4e-4;
  }
  /* main loop: smoothed scroll */
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  let sy = scrollY;
  const mt = $("#man"),
    hz = $("#hz"),
    trk = $("#trk"),
    pipe = $("#pipe"),
    steps = $$(".pipe .s"),
    fill = $(".pipe .fill"),
    bar = $("#bar"),
    h1 = $("#hero h1"),
    glow = $(".glow");
  let going = false;
  const mq = $(".mq"),
    pns = $$(".pn"),
    pxs = $$("h2").filter((e) => !e.closest("#jn,#md,#cyl,#hw")),
    hzi = $(".hzb i"),
    up = $("#up"),
    ring = $("#ring"),
    fx = $("#fx"),
    fg = fx.getContext("2d"),
    wipe = $("#wipe");
  /* ---- layout cache: measured once (and again on resize / content change), NOT every frame ---- */
  let mtTop = 0,
    mtH = 1,
    hzTop = 0,
    hzH = 1,
    pipeTop = 0,
    maxScroll = 1,
    cvL = 0,
    cvT = 0,
    h2C = [],
    h2H = [],
    h2Off = [];
  let needMeasure = true,
    dirty = true,
    settled = false;
  /* ===== Members cylinder (ported from Motion Lab's 09.2 CYLINDER) =====
     Real CSS 3D ring: scrolling through the pinned #cyl rotates it; the card facing you is lit, the others fade.
     Everything adapts to MEMBERS.length: the angle between cards, the radius (so cards never overlap), and how long
     the section is (so every member gets about the same amount of scrolling). */
  const cyl = $("#cyl"),
    cyRing = $("#cyring"),
    cyNow = $("#cynow");
  let cyP = [],
    cyStep = 40,
    cyDz = 0,
    cyDy = 0,
    cyLast = NaN,
    cyIdx = -1,
    cyTop = 0,
    cyH = 1;
  function cyLayout() {
    cyP = $$(".cy-p");
    const n = cyP.length;
    /* always a FULL ring, so the first member comes right after the last one (a loop) */
    cyStep = 360 / Math.max(1, n);
    const w = n ? cyP[0].offsetWidth : 250;
    const r = n > 2 ? Math.max(w * 1.5, (w / 2 / Math.tan((cyStep * Math.PI) / 360)) * 1.12) : w * 1.5;
    cyRing.style.setProperty("--r", r.toFixed(1) + "px");
    cyDz = w * 1.5 - r; /* keeps the front card at the same apparent size however big the ring is */
    cyDy = -(r - w * 1.5) * Math.sin((9 * Math.PI) / 180); /* ...and at the same height (the ring is tilted 9deg) */
    cyP.forEach((el, i) => el.style.setProperty("--a", (i * cyStep).toFixed(2) + "deg"));
    const total = n ? +cyP[0].dataset.t : 0;
    const vh = n > 16 ? 32 : n > total ? 38 : 50; /* scroll per card; a bit less when a small team is repeated around the ring */
    cyl.style.height = n <= 1 ? "100vh" : 100 + (n - 1) * vh + 40 + "vh";
    cyLast = NaN;
    cyIdx = -1;
  }
  function cylinder(p, force) {
    const n = cyP.length;
    if (!n) return;
    const rot = cl(p / 0.92, 0, 1) * (n - 1) * cyStep;
    if (!force && rot === cyLast) return;
    cyLast = rot;
    cyRing.style.transform = `translate3d(0,${cyDy.toFixed(1)}px,${cyDz.toFixed(1)}px) rotateX(-9deg) rotateY(${(-rot).toFixed(2)}deg)`;
    for (let i = 0; i < n; i++) {
      const diff = ((((i * cyStep - rot + 540) % 360) + 360) % 360) - 180;
      cyP[i].style.setProperty("--f", Math.max(0, Math.cos((diff * Math.PI) / 180)).toFixed(3));
    }
    const idx = cl(Math.round(rot / cyStep), 0, n - 1);
    if (idx !== cyIdx) {
      cyIdx = idx;
      const d = cyP[idx].dataset;
      cyNow.textContent = `${String(+d.i + 1).padStart(2, "0")} / ${String(+d.t).padStart(2, "0")} — ${d.nm}`;
    }
  }
  /* ===== "How we work": pinned, one stage in focus at a time ===== */
  const hw = $("#hw"),
    hwN = $("#hwn");
  let hwTop = 0,
    hwH = 1,
    hwIdx = -1,
    lastHw = NaN;
  function stages(p, force) {
    const N = steps.length;
    if (!N) return;
    /* the line grows evenly across the WHOLE bar for the whole pinned scroll (full width a little before the section unpins).
       Stage i lights up when the line reaches its node, which sits at i/N of the bar, so every stage gets an equal share of scroll. */
    const w = cl(p / 0.94, 0, 1);
    if (!force && w === lastHw) return;
    lastHw = w;
    fill.style.transform = `scaleX(${w.toFixed(4)})`;
    fill.style.setProperty("--pf", w.toFixed(4)); /* the phone layout fills this timeline downwards instead */
    const cur = Math.min(N - 1, Math.floor(w * N + 0.0001));
    steps.forEach((s, i) => {
      s.classList.toggle("on", i <= cur);
      s.classList.toggle("now", i === cur);
    });
    if (cur !== hwIdx) {
      hwIdx = cur;
      hwN.textContent = `STAGE ${String(cur + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
    }
  }
  /* =====================================================================================
     M1-M6 missions: a 3D cube, one face per mission.
     - Scrolling tumbles the cube from face to face. Each turn is a spring: it snaps, overshoots a little and
       settles with a thud (a dip in scale, a pulse and a ripple on the floor).
     - On arrival the six faces fly in from apart and slam together.
     - You can grab and spin it; it flings, then springs back to the current mission. The mouse tilts it.
     - The list on the left is clickable (it scrolls to that mission), and a ring of nodes circles the cube.
     Six missions = a real cube. Any other number becomes a prism with that many faces, so it still works if
     missions are added or removed. Faces, list, ring and scroll length all come from the data.
     ===================================================================================== */
  const ms = $("#ms"),
    msN = $("#msn"),
    kbScene = $("#kxscene"),
    kbTilt = $("#kxtilt"),
    kbCube = $("#kxcube"),
    kbToc = $("#kxtoc"),
    kbRip = $("#kxrip"),
    kbSr = $("#kxsr"),
    kbFloor = $("#kxfloor"),
    kbGl = $("#kxgl"),
    kbRing = $("#kxring"),
    kbHint = $("#kxhint");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let msTop = 0,
    msH = 1,
    msData = [],
    msCur = -1,
    kbSig = "",
    kbFaces = [],
    kbOri = [],
    kbA = 0,
    kbCubeMode = true,
    kbStep = 60,
    kbLand = false,
    kbShade = [],
    kbDots = [],
    kbStarted = false,
    kbPlayed = false,
    kbT0 = 0,
    kbP = 0,
    pinOn = true; /* the pinned scenes are switched off on phones / very short screens (the CSS matches this) */
  const kb = { rx: 0, ry: 0, vx: 0, vy: 0, sc: 1, vs: 0, tx: 0, ty: 0, last: 0, init: false, e: [], ve: [], ox: 0, oy: 0, vox: 0, voy: 0, gx: 0, gy: 0, oa: 0, voa: 0, drag: null, fvy: 0, lp: -1, kp: "", lrx: 1e9, lry: 1e9, rested: false, drawn: false };
  const p2 = (n) => String(n).padStart(2, "0");
  const rnd = (i, k) => {
    const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  /* a spring that overshoots a touch: stepped in small fixed slices so it stays stable at any frame rate */
  const spring = (val, vel, target, k, c, dt) => {
    let n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    while (n--) {
      vel += ((target - val) * k - vel * c) * h;
      val += vel * h;
    }
    return [val, vel];
  };
  function msLayout() {
    msData = $$("#mis .card").map((c) => ({
      k: c.querySelector(".num").textContent,
      t: c.querySelector("h3").textContent.trim(),
      p: c.querySelector("p").textContent,
    }));
    const W = kbScene.clientWidth,
      H = kbScene.clientHeight;
    if (!W || !H || !msData.length) return; /* hidden (phone layout) */
    const S = Math.round(Math.max(220, Math.min(H * 0.68, W * 0.7, 600))),
      sig = [S, msData.map((d) => d.t + d.p).join("|")].join("~");
    if (sig === kbSig) return; /* nothing changed: keep the cube (and the face it is on) */
    kbSig = sig;
    const N = msData.length,
      cube = N === 6,
      F = Math.max(N, 3), /* a prism needs at least 3 faces; with fewer missions the list simply repeats */
      step = 360 / F,
      a = cube ? S / 2 : S / 2 / Math.tan(Math.PI / F);
    kbScene.style.setProperty("--S", S + "px");
    kbScene.style.setProperty("--a", a.toFixed(1) + "px");
    kbA = a;
    kbCubeMode = cube;
    kbStep = 360 / N;
    const fts = cube
        ? ["", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"]
        : Array.from({ length: F }, (_, i) => `rotateY(${(i * step).toFixed(3)}deg)`),
      norms = cube
        ? [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, -1, 0], [0, 1, 0]]
        : Array.from({ length: F }, (_, i) => [Math.sin((i * step * Math.PI) / 180), 0, Math.cos((i * step * Math.PI) / 180)]);
    /* the cube orientation (rotateX, rotateY) that brings each face to the front; top and bottom come last so the text stays upright */
    kbOri = cube
      ? [[0, 0], [0, -90], [0, -180], [0, -270], [-90, -360], [90, -360]]
      : Array.from({ length: F }, (_, i) => [0, -i * step]);
    kbCube.innerHTML = Array.from({ length: F }, (_, i) => {
      const d = msData[i % N];
      return `<div class="kx-f" style="--ft:${fts[i]};--h:${8 + (((i % N) * 7) % 26)};--r:${((rnd(i, 4) - 0.5) * 70).toFixed(1)}deg"${i >= N ? ' aria-hidden="true"' : ""}><div class="kx-in"><div class="kx-top mono"><span>${escH(d.k)}</span><span>${p2((i % N) + 1)} / ${p2(N)}</span></div><b class="kx-n">${p2((i % N) + 1)}</b><div class="kx-tx"><h3>${escH(d.t)}</h3><p>${escH(d.p)}</p></div></div><i class="kx-sh"></i></div>`;
    }).join("");
    kbFaces = [...kbCube.children];
    kbShade = kbFaces.map((f, i) => ({ f, el: f.querySelector(".kx-sh"), n: norms[i], o: "" }));
    kbToc.innerHTML = msData.map((d, i) => `<li tabindex="0" role="button"><i class="mono">${p2(i + 1)}</i><span>${escH(d.t)}</span></li>`).join("");
    /* the ring of nodes around the foot of the cube: one per mission */
    kbRing.innerHTML = msData.map((d, i) => `<i class="kx-od" style="--oa:${(i * kbStep).toFixed(2)}deg"></i>`).join("");
    kbDots = [...kbRing.children];
    kb.e = kbFaces.map(() => (kbPlayed ? 0 : 1));
    kb.ve = kbFaces.map(() => 0);
    kbFaces.forEach((f, i) => f.style.setProperty("--e", kb.e[i]));
    msCur = -1;
    kb.init = false;
    kb.drawn = false;
    kb.rested = false;
    kb.lrx = kb.lry = 1e9;
  }
  function kbChange(cur, first) {
    msCur = cur;
    [...kbToc.children].forEach((e, i) => e.classList.toggle("on", i === cur));
    kbDots.forEach((e, i) => e.classList.toggle("on", i === cur));
    const d = msData[cur];
    msN.textContent = `MISSION ${p2(cur + 1)} / ${p2(msData.length)}`;
    kbSr.textContent = `${d.k}: ${d.t}. ${d.p}`;
    if (!first) kbLand = true; /* the thud happens when the cube actually lands, not when it starts to turn */
  }
  function kbThud() {
    kb.vs = -0.55;
    kbRip.classList.remove("go");
    void kbRip.offsetWidth; /* restart the CSS animation */
    kbRip.classList.add("go");
  }
  /* click a mission in the list: scroll to where the cube shows it */
  const kbGoto = (i) => {
    const N = msData.length;
    scrollTo({ top: msTop + (N > 1 ? (i / (N - 1)) * 0.94 : 0) * (msH - innerHeight) + 1, behavior: "smooth" });
  };
  kbToc.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) kbGoto([...kbToc.children].indexOf(li));
  });
  kbToc.addEventListener("keydown", (e) => {
    const li = e.target.closest("li");
    if (li && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      kbGoto([...kbToc.children].indexOf(li));
    }
  });
  /* grab and spin the cube */
  kbScene.addEventListener("pointerdown", (e) => {
    if (!pinOn || e.button) return;
    kb.drag = { id: e.pointerId, px: e.clientX, py: e.clientY, pt: performance.now() };
    kb.fvy = 0;
    try {
      kbScene.setPointerCapture(e.pointerId);
    } catch {}
    kbHint.classList.add("hide");
  });
  kbScene.addEventListener("pointermove", (e) => {
    const d = kb.drag;
    if (!d || d.id !== e.pointerId) return;
    const now = performance.now(),
      dx = e.clientX - d.px,
      dy = e.clientY - d.py,
      dtm = Math.max(1, now - d.pt) / 1000;
    d.px = e.clientX;
    d.py = e.clientY;
    d.pt = now;
    kb.gy = cl(kb.gy + dx * 0.45, -220, 220);
    kb.gx = cl(kb.gx - dy * 0.45, -80, 80);
    kb.fvy += (cl((dx * 0.45) / dtm, -900, 900) - kb.fvy) * 0.4;
  });
  const kbRelease = (e) => {
    const d = kb.drag;
    if (!d || d.id !== e.pointerId) return;
    kb.drag = null;
    kb.gx = kb.gy = 0; /* springs back to the current mission... */
    kb.voy += kb.fvy * 0.5; /* ...after a fling in the direction you let go */
  };
  kbScene.addEventListener("pointerup", kbRelease);
  kbScene.addEventListener("pointercancel", kbRelease);
  setTimeout(() => kbHint.classList.add("hide"), 9000);
  function msDraw(t, p) {
    const N = msData.length;
    if (!N || !kbFaces.length) return;
    if (!kbStarted && sy < msTop - innerHeight * 0.6) return; /* the cube assembles as it scrolls into view, not before */
    const dt = Math.min(0.05, (t - kb.last) / 1000 || 0.016);
    kb.last = t;
    kbP = cl(p / 0.94, 0, 1);
    const s = kbP * (N - 1),
      i = N > 1 ? Math.min(N - 2, Math.floor(s)) : 0,
      f = N > 1 ? s - i : 0,
      /* hold on each face for the first and last third of its scroll, and turn in the middle: it feels like detents */
      u = cl((f - 0.3) / 0.4, 0, 1),
      fe = u * u * (3 - 2 * u),
      A = kbOri[i],
      B = kbOri[Math.min(kbOri.length - 1, i + 1)],
      trx = A[0] + (B[0] - A[0]) * fe,
      tr_y = A[1] + (B[1] - A[1]) * fe,
      cur = Math.min(N - 1, f >= 0.5 ? i + 1 : i);
    if (!kb.init) {
      kb.init = true;
      kb.rx = trx;
      kb.ry = tr_y;
      kb.vx = kb.vy = 0;
      kb.sc = 1;
      kb.vs = 0;
      kb.oa = 90 - cur * kbStep;
      kb.voa = 0;
    }
    if (cur !== msCur) kbChange(cur, msCur < 0);
    /* arrival: the faces fly in from apart, one after another, and slam together */
    if (!kbStarted) {
      kbStarted = true;
      kbT0 = t;
      kbTilt.style.visibility = "visible";
      if (kbPlayed) kb.e.fill(0);
    }
    if (!kbPlayed) {
      let settled = true;
      for (let k = 0; k < kbFaces.length; k++) {
        if (reduceMotion.matches) kb.e[k] = kb.ve[k] = 0;
        else if (t - kbT0 >= k * 75) [kb.e[k], kb.ve[k]] = spring(kb.e[k], kb.ve[k], 0, 110, 10, dt);
        if (Math.abs(kb.e[k]) > 0.004 || Math.abs(kb.ve[k]) > 0.05) settled = false;
        kbFaces[k].style.setProperty("--e", kb.e[k].toFixed(4));
      }
      if (settled) {
        kbPlayed = true;
        kb.e.fill(0);
        kbFaces.forEach((fc) => fc.style.setProperty("--e", 0));
        if (!reduceMotion.matches) kbThud();
      }
    }
    if (reduceMotion.matches) {
      kb.rx = trx;
      kb.ry = tr_y;
      kb.vx = kb.vy = 0;
      kb.ox = kb.oy = kb.vox = kb.voy = 0;
      kb.oa = 90 - cur * kbStep;
    } else {
      [kb.rx, kb.vx] = spring(kb.rx, kb.vx, trx, 170, 13, dt);
      [kb.ry, kb.vy] = spring(kb.ry, kb.vy, tr_y, 170, 13, dt);
      /* what you grabbed: stiff while you hold it, loose and wobbly when it springs home */
      const kO = kb.drag ? 260 : 80,
        cO = kb.drag ? 28 : 8.5;
      [kb.ox, kb.vox] = spring(kb.ox, kb.vox, kb.gx, kO, cO, dt);
      [kb.oy, kb.voy] = spring(kb.oy, kb.voy, kb.gy, kO, cO, dt);
      [kb.oa, kb.voa] = spring(kb.oa, kb.voa, 90 - cur * kbStep, 70, 9, dt);
    }
    /* landed: a little thud (the cube dips in scale and springs back) and a ripple on the floor */
    if (kbLand && Math.abs(trx - kb.rx) < 1.6 && Math.abs(tr_y - kb.ry) < 1.6 && Math.abs(kb.vx) + Math.abs(kb.vy) < 40) {
      kbLand = false;
      if (!reduceMotion.matches) kbThud();
    }
    [kb.sc, kb.vs] = spring(kb.sc, kb.vs, 1, 260, 14, dt);
    /* mouse tilt (not on touch screens) */
    const ttx = coarse ? 0 : (mx / innerWidth - 0.5) * 12,
      tty = coarse ? 0 : (my / innerHeight - 0.5) * -8;
    kb.tx += (ttx - kb.tx) * 0.06;
    kb.ty += (tty - kb.ty) * 0.06;
    /* Nothing is moving any more? Then do no DOM work at all until something does. (The idle float is pure CSS,
       so a resting cube costs the main thread nothing.) */
    const moving =
      kb.drag ||
      !kb.drawn ||
      kbP !== kb.lp ||
      Math.abs(kb.vx) + Math.abs(kb.vy) + Math.abs(kb.vox) + Math.abs(kb.voy) + Math.abs(kb.voa) + Math.abs(kb.vs) > 0.03 ||
      Math.abs(trx - kb.rx) + Math.abs(tr_y - kb.ry) + Math.abs(kb.gx - kb.ox) + Math.abs(kb.gy - kb.oy) > 0.02 ||
      Math.abs(kb.sc - 1) > 0.0005 ||
      Math.abs(ttx - kb.tx) + Math.abs(tty - kb.ty) > 0.02;
    if (!moving) {
      if (kb.rested) return;
      kb.rested = true; /* draw this last frame, then sleep */
    } else kb.rested = false;
    kb.lp = kbP;
    kb.drawn = true;
    const rxT = kb.rx + kb.ox,
      ryT = kb.ry + kb.oy;
    kbTilt.style.transform = `rotateX(${(-9 + kb.ty).toFixed(2)}deg) rotateY(${(13 + kb.tx).toFixed(2)}deg) rotateZ(${cl(-(kb.vy + kb.voy) * 0.012, -3, 3).toFixed(2)}deg)`;
    kbCube.style.transform = `translateZ(${(-kbA).toFixed(1)}px) rotateX(${rxT.toFixed(3)}deg) rotateY(${ryT.toFixed(3)}deg) scale(${kb.sc.toFixed(4)})`;
    /* the floor pulses when the cube lands, the ring clicks round to the current mission */
    const pulse = 1 - kb.sc;
    kbFloor.style.transform = `scale(${(1 + pulse * 3.5).toFixed(3)})`;
    kbFloor.style.opacity = cl(0.85 + pulse * 4, 0, 1).toFixed(2);
    kbRing.style.transform = `rotateZ(${kb.oa.toFixed(2)}deg)`;
    /* the grid texture slides with the spin (a cheap translate: the pattern repeats every 64px, so it wraps invisibly) */
    kbGl.style.transform = `translate3d(${((-ryT * 1.4) % 64).toFixed(1)}px,${((kbP * 700) % 64).toFixed(1)}px,0)`;
    const kp = kbP.toFixed(3);
    if (kp !== kb.kp) {
      kb.kp = kp;
      kbToc.style.setProperty("--kp", kp);
    }
    /* shade the faces that turn away from the camera (cheap fake lighting): only when the rotation changed */
    if (Math.abs(rxT - kb.lrx) + Math.abs(ryT - kb.lry) > 0.01) {
      kb.lrx = rxT;
      kb.lry = ryT;
      const cosX = Math.cos((rxT * Math.PI) / 180),
        sinX = Math.sin((rxT * Math.PI) / 180),
        cosY = Math.cos((ryT * Math.PI) / 180),
        sinY = Math.sin((ryT * Math.PI) / 180);
      for (const sh of kbShade) {
        const [nx, ny, nz] = sh.n,
          z1 = -nx * sinY + nz * cosY,
          z2 = ny * sinX + z1 * cosX,
          o = ((kbCubeMode ? 0.5 : 0.88) * (1 - cl(z2, 0, 1))).toFixed(2), /* a many-sided prism fades its side faces out almost completely */
          b = cl((z2 - 0.12) / 0.5, 0, 1).toFixed(2); /* the text fades in as a face turns to you, and is gone on faces seen edge-on */
        if (o !== sh.o || b !== sh.b) {
          sh.o = o;
          sh.b = b;
          sh.el.style.opacity = o;
          sh.f.style.setProperty("--b", b);
        }
      }
    }
  }

  /* =====================================================================================
     01-06 problems: a cutting torch burns through each problem in turn, throwing sparks.
     The line, the heat front inside the letters and the torch all follow the scroll; the sparks
     are thrown by how far the torch moves (so fast scrolling = more sparks).
     ===================================================================================== */
  const wy = $("#wy"),
    wyCv = $("#wyc"),
    wyCx = wyCv.getContext("2d"),
    wyN = $("#wyn"),
    wyBig = $("#wybig");
  let wyTop = 0,
    wyH = 1,
    wyRows = [],
    wyGeo = [],
    wyW = 0,
    wyHt = 0,
    wyDpr = 1,
    wyLast = 0,
    wyLbl = "",
    wyInk = false; /* is there anything drawn on the canvas right now? */
  const sparks = [],
    torch = { x: 0, y: 0, pow: 0, init: false };
  function wyLayout() {
    wyRows = $$("#why .pr").map((el) => ({ el, ln: el.querySelector(".pr-ln"), h: el.querySelector(".pr-h"), st: "", f: -1 }));
    wyW = wyCv.offsetWidth;
    wyHt = wyCv.offsetHeight;
    torch.init = false;
    sparks.length = 0;
    if (!wyW || !wyHt) return;
    wyDpr = 1; /* sparks are thin lines: full resolution buys nothing and costs a lot on big screens */
    wyCv.width = Math.round(wyW * wyDpr);
    wyCv.height = Math.round(wyHt * wyDpr);
    /* where each title is, relative to the stage (both move together while pinned, so scroll does not matter) */
    const st = wyCv.parentElement.getBoundingClientRect();
    wyGeo = wyRows.map((r) => {
      const b = r.h.getBoundingClientRect();
      return { x0: b.left - st.left - 6, w: b.width + 12, y: b.top - st.top + b.height * 0.54 };
    });
  }
  function wyDraw(t, p) {
    const N = wyRows.length;
    if (!N || !wyW) return;
    const dt = Math.min(0.05, (t - wyLast) / 1000 || 0.016);
    wyLast = t;
    const gp = cl(p / 0.94, 0, 1) * N,
      done = gp >= N - 0.0001,
      cur = done ? N - 1 : Math.min(N - 1, Math.floor(gp)),
      f = done ? 1 : cl((gp - cur) / 0.82, 0, 1); /* the torch crosses the title in the first 82% of the row's scroll, then rests */
    for (let i = 0; i < N; i++) {
      const r = wyRows[i],
        st = i < cur || (i === cur && done) ? "done" : i === cur ? "burn" : "up",
        fi = st === "done" ? 1 : st === "burn" ? f : 0;
      if (r.st !== st) {
        r.st = st;
        r.el.className = "pr " + st;
      }
      if (fi !== r.f) {
        r.f = fi;
        r.ln.style.transform = `scaleX(${fi.toFixed(4)})`;
        r.h.style.setProperty("--f", fi.toFixed(4));
      }
    }
    const lbl = done ? `ALL ${p2(N)} CROSSED OFF — THIS IS WHY WE EXIST` : `PROBLEM ${p2(cur + 1)} / ${p2(N)}`;
    if (lbl !== wyLbl) {
      wyLbl = lbl;
      wyN.textContent = lbl;
      wyBig.textContent = p2(cur + 1);
      wyBig.classList.toggle("done", done);
    }
    /* the torch glides to the burning point (so it swoops down to the next row), and throws sparks as it moves */
    const geo = wyGeo[cur];
    if (!geo) return;
    const tx = geo.x0 + geo.w * f,
      ty = geo.y;
    if (!torch.init) {
      torch.x = tx;
      torch.y = ty;
      torch.init = true;
    }
    const ox = torch.x,
      oy = torch.y;
    torch.x += (tx - torch.x) * 0.4;
    torch.y += (ty - torch.y) * 0.4;
    const dist = Math.hypot(torch.x - ox, torch.y - oy),
      burning = !done && f < 1 && p > 0.002;
    torch.pow += ((burning ? 1 : 0) - torch.pow) * Math.min(1, dt * 10);
    const live = burning || sparks.length > 0 || torch.pow > 0.02;
    if (!live && !wyInk) return; /* nothing to draw, and nothing left on the canvas to clear */
    wyInk = live;
    const g = wyCx;
    g.setTransform(wyDpr, 0, 0, wyDpr, 0, 0);
    g.clearRect(0, 0, wyW, wyHt);
    if (q < 2) {
      const cap = q === 0 ? 170 : 90;
      if (torch.pow > 0.2) {
        const n = Math.min(10, Math.floor(dist / 4) + (Math.random() < 0.5 ? 1 : 0));
        for (let k = 0; k < n && sparks.length < cap; k++)
          sparks.push({
            x: torch.x,
            y: torch.y,
            vx: (Math.random() - 0.3) * 380,
            vy: -Math.random() * 300 + 40,
            life: 0,
            max: 0.5 + Math.random() * 0.7,
          });
      }
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.max) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 1000 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const k = s.life / s.max;
        g.strokeStyle = `rgba(255,${Math.round(255 - 150 * k)},${Math.round(220 - 200 * k)},${1 - k})`;
        g.lineWidth = 1.7 * (1 - k * 0.5);
        g.beginPath();
        g.moveTo(s.x - s.vx * 0.035, s.y - s.vy * 0.035);
        g.lineTo(s.x, s.y);
        g.stroke();
      }
      if (torch.pow > 0.02) {
        const R = 46 * torch.pow,
          tg = g.createRadialGradient(torch.x, torch.y, 0, torch.x, torch.y, R);
        tg.addColorStop(0, `rgba(255,240,225,${0.95 * torch.pow})`);
        tg.addColorStop(0.3, `rgba(255,120,60,${0.55 * torch.pow})`);
        tg.addColorStop(1, "rgba(255,77,46,0)");
        g.fillStyle = tg;
        g.beginPath();
        g.arc(torch.x, torch.y, R, 0, 6.2832);
        g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }
  }
  /* =====================================================================================
     Phone-only behaviours (the pinned desktop scenes are switched off on phones, so these replace them):
     - missions: cards stack like paper as you scroll (CSS sticky); the one being covered shrinks a little
     - problems: each row's line burns across its title when the row reaches the middle of the screen
     ===================================================================================== */
  let phCards = [],
    phK = [],
    phTop = 0,
    phH = 1,
    phIO = null;
  function phoneSetup() {
    phCards = $$("#mis .card");
    phK = [];
    if (phIO) phIO.disconnect();
    phIO = null;
    if (!phoneMQ.matches) return;
    const rows = $$("#why .pr");
    phIO = new IntersectionObserver(
      (es) => {
        for (const e of es)
          if (e.isIntersecting) {
            const i = rows.indexOf(e.target);
            rows.slice(0, i + 1).forEach((r) => r.classList.add("hit")); /* earlier rows too, if you jumped past them */
          }
      },
      { rootMargin: "-46% 0px -46% 0px" },
    );
    rows.forEach((r) => phIO.observe(r));
  }
  function phoneStack() {
    const n = phCards.length;
    if (n < 2) return;
    const tops = phCards.map((c) => c.getBoundingClientRect().top); /* all reads first, then writes */
    for (let i = 0; i < n - 1; i++) {
      const k = cl((70 + i * 12 + 300 - tops[i + 1]) / 300, 0, 1).toFixed(2); /* how far the next card has slid over this one */
      if (k !== phK[i]) {
        phK[i] = k;
        phCards[i].style.setProperty("--k", k);
      }
    }
  }
  function measure() {
    const sc = scrollY;
    pinOn = !matchMedia("(max-width: 800px), (max-height: 640px)").matches;
    ms.style.height = 100 + Math.max(1, $$("#mis .card").length) * 50 + 20 + "vh"; /* ~50vh of scroll per mission */
    wy.style.height = 100 + Math.max(1, $$("#why .pr").length) * 50 + 20 + "vh"; /* ~50vh of scroll per problem */
    msLayout();
    wyLayout();
    phoneSetup();
    hw.style.height = 100 + Math.max(1, steps.length) * 80 + 20 + "vh"; /* ~80vh of scroll per stage + a short hold at the end */
    cyLayout(); /* first: it changes the page height, which every measurement below depends on */
    cyTop = cyl.getBoundingClientRect().top + sc;
    cyH = cyl.offsetHeight;
    hwTop = hw.getBoundingClientRect().top + sc;
    hwH = hw.offsetHeight;
    msTop = ms.getBoundingClientRect().top + sc;
    msH = ms.offsetHeight;
    const phm = $("#mis").getBoundingClientRect();
    phTop = phm.top + sc;
    phH = phm.height;
    wyTop = wy.getBoundingClientRect().top + sc;
    wyH = wy.offsetHeight;
    mtTop = mt.getBoundingClientRect().top + sc;
    mtH = mt.offsetHeight;
    hzTop = hz.getBoundingClientRect().top + sc;
    hzH = hz.offsetHeight;
    pipeTop = pipe.getBoundingClientRect().top + sc;
    maxScroll = Math.max(1, document.body.scrollHeight - innerHeight);
    const r = cv.getBoundingClientRect();
    cvL = r.left;
    cvT = r.top + sc;
    pxs.forEach((e, i) => {
      const b = e.getBoundingClientRect();
      h2C[i] = b.top + sc + b.height / 2 - (h2Off[i] || 0);
      h2H[i] = b.height;
    });
  }
  const prog = (top, h, y) => cl((y - top) / Math.max(1, h - innerHeight), 0, 1);
  if (window.ResizeObserver)
    new ResizeObserver(() => (needMeasure = true)).observe(document.body);
  addEventListener("load", () => (needMeasure = true));
  fontsReady.then(() => (needMeasure = true));
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(() => (needMeasure = true));
  function setQuality(n) {
    q = n;
    try {
      sessionStorage.setItem("af:q", q);
    } catch {}
    root.classList.toggle("mid", q >= 1);
    root.classList.toggle("lite", q >= 2);
    if (q >= 2) {
      lastStk = NaN; /* the deck keeps working on the lite tier; it just drops the extras */
      pxs.forEach((e, i) => {
        e.style.translate = "";
        h2Off[i] = 0;
      });
      mq.style.transform = "";
      needMeasure = true;
    }
    size(true);
  }
  /* frame-rate governor: if the AVERAGE frame time stays above ~20ms (<50fps) for about a second, drop one tier.
     (a moving average, so a laptop that alternates 16ms/33ms frames is caught, while a single hitch is not) */
  let lastT = 0,
    ema = 16.7,
    slow = 0,
    settle = 0;
  function govern(t) {
    const dt = t - lastT;
    lastT = t;
    if (forced !== null || !started || introBusy || q >= 2 || dt <= 0 || dt > 250) return; /* ignore the intro + backgrounded tabs */
    if (settle > 0) {
      settle--; /* let a tier change settle (rebuild hitch, GC) before judging again */
      return;
    }
    ema = ema * 0.97 + Math.min(dt, 100) * 0.03;
    slow = ema > 20 ? slow + 1 : 0;
    if (slow > 40) {
      slow = 0;
      ema = 16.7;
      settle = 20;
      setQuality(q + 1);
    }
  }
  const resetGovernor = () => {
    settle = 30;
    ema = 16.7;
    slow = 0;
  };
  function launch() {
    if (going) return;
    going = true;
    document.documentElement.style.overflow = "hidden";
    const s0 = scrollY,
      dur = Math.min(4200, 2200 + (s0 / innerHeight) * 220),
      st = performance.now(),
      E = [];
    let re = false;
    fx.width = innerWidth;
    fx.height = innerHeight;
    up.classList.add("go");
    (function f(now) {
      const p = Math.min(1, (now - st) / dur),
        e = -(Math.cos(Math.PI * p) - 1) / 2;
      if (p < 1) scrollTo(0, s0 * (1 - e));
      fg.globalCompositeOperation = "destination-out";
      fg.fillStyle = "rgba(0,0,0,.08)";
      fg.fillRect(0, 0, fx.width, fx.height);
      fg.globalCompositeOperation = "lighter";
      for (let i = p < 1 ? Math.sin(Math.PI * p) * 7 : 0; i > 0; i--)
        E.push({
          x: Math.random() * fx.width,
          y: fx.height + 10,
          v: 5 + Math.random() * 10,
          s: 1 + Math.random() * 2.5,
          h: Math.random(),
        });
      for (let i = E.length - 1; i >= 0; i--) {
        const q = E[i];
        q.y -= q.v;
        q.x += Math.sin(q.y / 60 + q.h * 9) * 1.5;
        if (q.y < -80) {
          E.splice(i, 1);
          continue;
        }
        fg.globalAlpha = 0.65;
        fg.fillStyle =
          q.h > 0.8 ? "#ffd27a" : q.h > 0.5 ? "#ff7a2e" : "#ff4d2e";
        fg.fillRect(q.x, q.y, q.s, q.s * (4 + q.v / 6));
      }

      if (p >= 1) document.documentElement.style.overflow = "";
      if (p < 1 || E.length) requestAnimationFrame(f);
      else {
        fg.clearRect(0, 0, fx.width, fx.height);
        up.classList.remove("go");
        document.documentElement.style.overflow = "";
        going = false;
      }
    })(st);
  }
  /* ===== back to top =====
     Arrow button + footer link -> the ANVIL STRIKE (js/forge.js, AIForge.strike, ~2.8 s): letterboxed, an anvil slams in with a
     flash, shake and clang, the logo's flame rises, a wall of lava climbs the screen, the page jumps to the top while the lava
     covers everything, then the lava drains away and the hero particles fly in again.
     The lamp replay (lampIntro(true)) is kept as the fallback if the strike can't start (anime.js not loaded yet).
     The lamp and the forge-the-logo animation are still the two random intros on open (see intro() above).
     Guarded so only one animation can play at a time. */
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const busy = () => introBusy || going || !!(window.AIForge && AIForge.isRunning());
  function arrowToTop() {
    if (busy()) return;
    if (reducedMotion()) return scrollTo({ top: 0, behavior: "smooth" });
    /* the anvil strike (js/forge.js). It needs anime.js, which is warmed up as soon as the arrow appears; on the rare tap
       before that has loaded (or if the CDN is blocked) the old lamp replay below plays instead. */
    if (window.AIForge && AIForge.strike({ tier: q })) return;
    if (!load || !$("#ldlamp") || !$("#lddisc")) return launch(); /* old cached HTML without the lamp markup */
    lampIntro(true);
  }
  function footerToTop(e) {
    e.preventDefault();
    arrowToTop();
  }
  up.onclick = arrowToTop;
  $("#top2").onclick = footerToTop;
  /* while the forge animation plays: keep the frame-rate governor from judging it, and re-ignite the hero when the page opens */
  addEventListener("fb:start", () => {
    introBusy = true;
    if (load) load.classList.add("go"); /* the forge overlay is opaque, so nothing flashes */
  });
  /* the intro had to lower its own quality => this device is slow: start the page itself one tier lighter too */
  let slowIntro = false;
  addEventListener("fb:slow", () => (slowIntro = true));
  addEventListener("fb:end", () => {
    introBusy = false;
    if (slowIntro && forced === null && q < 1) setQuality(1);
    if (!started) startHero(); /* intro skipped before the page opened */
    resetGovernor();
  });
  addEventListener("fb:arrived", () => {
    sy = 0; /* the page just jumped to the top: don't let the smoothed scroll glide there */
    dirty = true;
    replayHero();
  });
  let perfTick = null;
  if (params.has("perf")) {
    const box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:8px 10px;font:11px/1.5 monospace;color:#9f9;background:rgba(0,0,0,.82);border:1px solid #333;pointer-events:none;white-space:pre";
    document.body.appendChild(box);
    let n = 0,
      t1 = performance.now();
    perfTick = () => n++;
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : "other";
    setInterval(() => {
      const now = performance.now(),
        fps = (n * 1000) / (now - t1);
      n = 0;
      t1 = now;
      box.textContent = [
        `fps       ${fps.toFixed(0)}`,
        `tier      q${q}${forced !== null ? " (forced)" : ""}   avg frame ${ema.toFixed(1)}ms`,
        `canvas    ${W}x${H}  dpr ${dpr}`,
        `particles ${D.length}  embers ${P.length}`,
        `gpu       ${renderer}${software ? "  <-- SOFTWARE" : ""}`,
        `browser   ${browser}   cores ${navigator.hardwareConcurrency}  mem ${navigator.deviceMemory || "?"}GB`,
        `viewport  ${innerWidth}x${innerHeight}  screen dpr ${devicePixelRatio}`,
      ].join("\n");
    }, 1000);
  }
  let vs = 0,
    psy = 0,
    lastSy = -1,
    lastOn = -1,
    lastPp = -1,
    lastSk = 999,
    upShown = null,
    lastSpx = NaN,
    lastSpy = NaN,
    first = true;
  const stepOn = [];
  /* ===== "Inside the Foundry" deck (ported from Motion Lab's 09.5 STACK) =====
     Scroll through the pinned #hz section flicks the cards off the deck one by one, alternating left / right.
     p = pinned progress 0..1; x = how many cards have gone (0 .. N-1); card i leaves while x goes from i to i+1.
     The last card stays, and the final 8% of the scroll is a hold before the section unpins. */
  const stkN = $("#stkn");
  let lastStk = NaN,
    lastStkLbl = "";
  function stack(p, force) {
    const N = pns.length;
    if (!N) return;
    const x = cl(p / 0.92, 0, 1) * (N - 1);
    if (!force && x === lastStk) return;
    lastStk = x;
    for (let i = 0; i < N; i++) {
      const el = pns[i];
      const u = cl(x - i, 0, 1); /* 0 = on the deck, 1 = gone */
      const depth = Math.min(3, Math.max(0, i - x)); /* how far behind the front card */
      const dir = i % 2 ? 1 : -1;
      el.style.visibility = u >= 0.99 || i - x > 4.5 ? "hidden" : "visible"; /* gone, or buried too deep to see: one less layer to draw */
      el.style.zIndex = N - i;
      el.style.transform =
        `translate(calc(-50% + ${(dir * u * u * 115).toFixed(2)}vw), calc(-50% + ${(4 - u * 7 + u * u * 34 - depth * 3.2).toFixed(2)}vh)) ` +
        `rotate(${(dir * u * 36 + ((i % 3) - 1) * depth * 1.4).toFixed(2)}deg) scale(${(1 - depth * 0.04).toFixed(3)})`;
      /* cards further back are slightly dimmer: a black overlay whose opacity changes (compositor-only), not a filter */
      el.style.setProperty("--dim", q < 2 ? (depth * 0.1).toFixed(3) : 0);
    }
    const lbl = String(Math.min(N, Math.floor(x + 0.001) + 1)).padStart(2, "0") + " / " + String(N).padStart(2, "0");
    if (lbl !== lastStkLbl) {
      lastStkLbl = lbl;
      stkN.textContent = lbl;
    }
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (perfTick) perfTick();
    govern(t);
    if (needMeasure) {
      needMeasure = false;
      measure();
      dirty = true;
    }
    if (!coarse && (first || Math.abs(mx - cx) > 0.05 || Math.abs(my - cy) > 0.05)) {
      cx += (mx - cx) * 0.2;
      cy += (my - cy) * 0.2;
      cur.style.transform = `translate(${cx}px,${cy}px)`;
    }
    if (pmoved) {
      pmoved = false;
      const c = ptarget && ptarget.closest && ptarget.closest(".card,.pc");
      if (c) {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", mx - r.left + "px");
        c.style.setProperty("--my", my - r.top + "px");
      }
    }
    sy += (scrollY - sy) * 0.12;
    if (Math.abs(scrollY - sy) < 0.1) sy = scrollY;
    const justSettled = sy === scrollY && !settled;
    settled = sy === scrollY;
    const full = dirty || justSettled;
    const scrolled = sy !== lastSy || full;
    lastSy = sy;
    const heroOn = sy < innerHeight * 1.08;
    if (heroOn) {
      if (started && (!calm || sy !== lastHeroSy || mx !== lastHx || my !== lastHy)) {
        calm = hero_(t);
        lastHeroSy = sy;
        lastHx = mx;
        lastHy = my;
      }
      const spx = mx - cvL,
        spy = my - (cvT - scrollY);
      if (spx !== lastSpx || spy !== lastSpy) {
        lastSpx = spx;
        lastSpy = spy;
        spot.style.transform = `translate3d(${spx - 500}px,${spy - 500}px,0)`;
      }
    }
    if (scrolled) {
      const k = cl(sy / innerHeight, 0, 1);
      bar.style.transform = `scaleX(${sy / maxScroll})`;
      ring.style.strokeDashoffset = 182.2 * (1 - sy / maxScroll);
      const show = sy > innerHeight * 0.8;
      if (show !== upShown) {
        upShown = show;
        up.classList.toggle("show", show);
        if (show && window.AIForge && AIForge.warm) AIForge.warm(q); /* anime.js, the images and the baked lava texture: ready before the first tap */
      }
      if (heroOn || full) {
        h1.style.transform = `translateY(${k * -12}vh)`;
        h1.style.opacity = 1 - k * 0.9;
        glow.style.transform = `translate(-50%,${-50 + k * 30}%) scale(${1 + k * 0.4})`;
      }
      const on = Math.floor(cl(prog(mtTop, mtH, sy) * 1.25, 0, 1) * words.length);
      if (on !== lastOn) {
        lastOn = on;
        words.forEach((w, i) => w.classList.toggle("on", i < on));
      }
      if (full || (sy > hzTop - innerHeight * 1.2 && sy < hzTop + hzH + innerHeight * 0.2)) {
        const qh = prog(hzTop, hzH, sy);
        hzi.style.transform = `scaleX(${qh})`;
        stack(qh, full);
      }
      if (cyP.length && (full || (sy > cyTop - innerHeight * 1.2 && sy < cyTop + cyH + innerHeight * 0.2)))
        cylinder(prog(cyTop, cyH, sy), full);
      if (full || (sy > hwTop - innerHeight * 1.2 && sy < hwTop + hwH + innerHeight * 0.2)) stages(prog(hwTop, hwH, sy), full);
      if (q < 2)
        for (let i = 0; i < pxs.length; i++) {
          const vc = h2C[i] - scrollY - innerHeight / 2;
          if (Math.abs(vc) < innerHeight / 2 + h2H[i] / 2 + 200) {
            const o = -vc * 0.0826;
            if (Math.abs(o - (h2Off[i] || 0)) > 0.15) {
              h2Off[i] = o;
              pxs[i].style.translate = `0 ${o}px`;
            }
          }
        }
    }
    /* the pinned scenes (cube, torch) animate on their own clocks: springs settle, sparks fall, things float.
       So they run every frame while in view, not only when the scroll position changes. */
    if (pinOn && sy > msTop - innerHeight && sy < msTop + msH + innerHeight * 0.2) msDraw(t, prog(msTop, msH, sy));
    if (pinOn && sy > wyTop - innerHeight && sy < wyTop + wyH + innerHeight * 0.2) wyDraw(t, prog(wyTop, wyH, sy));
    if (phoneMQ.matches && sy > phTop - innerHeight && sy < phTop + phH) phoneStack();
    /* marquee skew follows scroll speed; only touch the DOM when the angle actually changes */
    vs += (sy - psy - vs) * 0.12;
    psy = sy;
    if (q < 2) {
      const sk = cl(-vs * 0.35, -9, 9);
      if (Math.abs(sk - lastSk) > 0.01) {
        lastSk = sk;
        mq.style.transform = `skewX(${sk}deg)`;
      }
    }
    dirty = false;
    first = false;
  }
  /* when fresh data arrives, re-render only if it differs from what is already on screen */
  const renderData = () => {
    renderPeople();
    renderPatron();
    renderManifesto();
    evs(evK);
    projs(pK);
  };
  const sig = (d) =>
    JSON.stringify([d.EVENTS, d.PROJECTS, d.MEMBERS, d.LEADERS, d.COLLABS, d.PATRON, d.MANIFESTO]);
  fresh.then((d) => {
    if (!d) return;
    const shown = { EVENTS, PROJECTS, MEMBERS, LEADERS, COLLABS, PATRON, MANIFESTO };
    if (sig(d) === sig(shown)) return;
    ({ EVENTS, PROJECTS, MEMBERS, LEADERS, COLLABS, PATRON, MANIFESTO } = d);
    renderData();
    watch();
    lastOn = -1;
    needMeasure = true;
  });
  requestAnimationFrame(frame);
})().catch((e) => {
  /* never leave a visitor stuck on the loading screen */
  console.error(e);
  const l = document.getElementById("load");
  if (l) l.classList.add("go");
});
