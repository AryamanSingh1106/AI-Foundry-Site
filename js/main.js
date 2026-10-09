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
  const card = (n, t, p, i) =>
    `<div class="card rv" style="--d:${(i % 3) * 0.1}s"><span class="num">${n}</span><h3>${t}</h3><p>${p}</p></div>`;
  $("#why").innerHTML = WHY.map((w, i) =>
    card("0" + (i + 1), w.title, w.text, i),
  ).join("");
  $("#mis").innerHTML = MIS.map((w, i) =>
    card("M" + (i + 1), w.title, w.text, i),
  ).join("");
  $("#trk").innerHTML =
    PAN.map(
      (p) =>
        `<div class="pn"><b>${p.num}</b><div><h3>${p.title}</h3><p>${p.text}</p></div></div>`,
    ).join("") +
    INS.map(
      (p) =>
        `<div class="pn"><b>+</b><div><h3>${p.title}</h3><p>${p.text}</p></div></div>`,
    ).join("");
  $("#pipe").insertAdjacentHTML(
    "beforeend",
    PIPE.map(
      (p) => `<div class="s"><h4>${p.title}</h4><p>${p.text}</p></div>`,
    ).join(""),
  );
  function renderPeople() {
    $("#col").innerHTML = COLLABS.map(
      (c, i) =>
        `<div class="rv ${c.real ? "real" : ""}" style="--d:${(i % 4) * 0.09}s">${c.logo ? `<img src="${c.logo}" alt="${c.name}">` : c.name}</div>`,
    ).join("");
    $("#mem").innerHTML = MEMBERS.map(
      (m, i) =>
        `<div class="m rv" style="--d:${(i % 6) * 0.07}s"><div class="av">${m.photo ? `<img src="${m.photo}" alt="${m.name}" loading="lazy">` : m.name[0]}</div><b>${m.name}</b><small class="mono">${m.role}</small></div>`,
    ).join("");
    $("#lead").innerHTML = LEADERS.map(
      (l, i) =>
        `<div class="rv" style="--d:${i * 0.15}s"><div class="ph"><img src="${l.photo}" alt="${l.name}" loading="lazy" decoding="async"></div><h3>${l.name}</h3><span class="mono ac">${l.role}</span><a href="mailto:${l.email}">${l.email}</a></div>`,
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
      .map((m) => `<div><span class="mono">${m[0]}</span><b>${m[1]}</b></div>`)
      .join("");
    $("#ml").textContent = e.l || e.x;
    media(e);
    $("#mh").innerHTML = (e.hl || []).map((h) => `<li>${h}</li>`).join("");
    const r = $("#mr");
    if (e.k === "up") {
      r.style.display = "";
      r.href =
        e.r ||
        `mailto:vidhayank.singh@universalai.in?subject=${encodeURIComponent("Interested in " + e.t)}`;
      r.textContent = e.r ? "Register now →" : "Register interest →";
    } else if (e.r) {
      r.style.display = "";
      r.href = e.r;
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
    $("#mi").innerHTML = o.img ? `<img src="${o.img}" alt="">` : "";
    $("#mg").innerHTML = (o.gallery || [])
      .map(
        (g) =>
          `<a href="${g}" target="_blank" rel="noopener"><img src="${g}" alt="" loading="lazy"></a>`,
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
        `<a href="${u}" target="_blank" rel="noopener" aria-label="${k}">${ICON[k]}</a>`,
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
          `<div class="pc rv ${p.k}" data-i="${i}" tabindex="0" role="button" style="--d:${n * 0.1}s;--p:${p.p || 100}%"><div class="cv ${p.img ? "" : "none"}">${p.img ? `<img src="${p.img}" alt="" loading="lazy">` : "<span>✦</span>"}</div><div class="top"><span class="ty mono">${p.type}</span><span class="mono" style="color:var(--mut)">${String(i + 1).padStart(2, "0")}</span></div>${p.k === "done" ? '<div class="stamp">FORGED</div>' : ""}<h3>${p.t}</h3><p>${p.x}</p><div class="tg">${(p.tech || []).map((x) => `<span>${x}</span>`).join("")}</div>${p.k === "on" ? `<div class="pct mono"><span>Heat</span><b>${p.p}%</b></div><div class="heat"><i></i></div>` : ""}<div class="stg">${PIPE.map((s, j) => `<i class="${j <= cur(p) ? "on" : ""} ${p.k === "on" && j === p.st ? "now" : ""}"></i>`).join("")}</div><div class="stl">${PIPE.map((s, j) => `<span class="${j <= cur(p) ? "on" : ""}">${s.title}</span>`).join("")}</div></div>`,
      )
      .join("");
    $("#pc1").textContent = PROJECTS.filter((p) => p.k === "on").length;
    $("#pc2").textContent = PROJECTS.filter((p) => p.k === "done").length;
  }
  function openP(i) {
    const p = PROJECTS[i];
    lastF = document.activeElement;
    $("#mk").textContent =
      (p.k === "on" ? "Ongoing " : "Completed ") + p.type.toLowerCase();
    $("#mt").textContent = p.t;
    $("#mm").innerHTML = [
      ["Stage", PIPE[p.k === "done" ? 3 : p.st].title],
      ["Progress", p.k === "on" ? p.p + "%" : "Completed"],
      ["Lead", p.lead],
      ["Timeline", p.d],
    ]
      .filter((m) => m[1])
      .map((m) => `<div><span class="mono">${m[0]}</span><b>${m[1]}</b></div>`)
      .join("");
    $("#ml").textContent = p.l || p.x;
    media(p);
    $("#mh").innerHTML = (p.hl || []).map((h) => `<li>${h}</li>`).join("");
    const r = $("#mr");
    if (p.r) {
      r.style.display = "";
      r.href = p.r;
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
          `<div class="ev rv" data-i="${i}" tabindex="0" role="button"><span class="mono ac">${e.d}</span><div><h3>${e.t}</h3><p>${e.x}</p></div>${e.img ? `<div class="th"><img src="${e.img}" alt="" loading="lazy"></div>` : '<div class="th none"><span>✦</span></div>'}<span class="ar">↗</span></div>`,
      )
      .join("");
  }
  function renderPatron() {
    $("#pimg").src = PATRON.photo;
    $("#pimg").alt = PATRON.name;
    $("#pq").innerHTML = PATRON.message
      .map(
        (x, i, a) =>
          `<p${i === a.length - 1 ? ' class="ac"' : ""}>${i === 0 ? "“" : ""}${x}${i === a.length - 1 ? "”" : ""}</p>`,
      )
      .join("");
    $("#pn").textContent = PATRON.name;
    $("#pr").textContent = PATRON.role;
    $("#ps").src = PATRON.signature;
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
        return `<i class="${h ? "hot" : ""}">${w.replace("*", "")}</i> `;
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
  function intro() {
    const sp = new URLSearchParams(location.search);
    /* a returning visitor already has this browser's cached content on screen: don't hold the intro for fresh data */
    const gate = readCache() ? fontsReady.then(() => {}) : Promise.all([fontsReady, firstData]);
    const el = {
      cord: $("#ldcord"), lamp: $("#ldlamp"), cone: $("#ldcone"), rim: $("#ldglowrim"), bulb: $("#ldbulb"),
      glow: $("#ldglow"), disc: $("#lddisc"), cap: $("#ldcap"), skip: $("#ldskip"),
    };
    if (!load || !el.lamp || !el.disc) {
      /* old cached HTML without the lamp markup: just open the page */
      gate.then(() => {
        startHero();
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
    const full = !reduced && (!seen || sp.has("replay")) && scrollY < 40;
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

    const light = (I) => {
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
      removeEventListener("resize", skip);
      load.removeEventListener("wheel", block);
      load.removeEventListener("touchmove", block);
      introBusy = false;
    };
    const fadeOut = () => {
      stage = "end";
      load.classList.add("ld-off", "fade");
      el.disc.style.display = "none";
      startHero();
      setTimeout(finish, 500);
    };
    const beginIris = () => {
      tg = measureTarget();
      if (document.documentElement.classList.contains("lite")) {
        /* weakest tier (or software rendering): a plain cross-fade instead of repainting a growing gradient every frame */
        irisOn = true;
        fadeMode = true;
        load.classList.add("fade");
        startHero();
        setTimeout(finish, 500);
        return;
      }
      rmax = Math.hypot(Math.max(tg.cx, W - tg.cx), Math.max(tg.cy, H - tg.cy)) + 80;
      load.style.setProperty("--x", tg.cx.toFixed(1) + "px");
      load.style.setProperty("--y", tg.cy.toFixed(1) + "px");
      load.classList.add("iris");
      load.removeEventListener("wheel", block);
      load.removeEventListener("touchmove", block);
      startHero();
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
    addEventListener("resize", skip);
    load.addEventListener("wheel", block, { passive: false });
    load.addEventListener("touchmove", block, { passive: false });
    if (el.skip) el.skip.onclick = skip;

    if (reduced) {
      el.disc.style.display = "none";
      gate.then(fadeOut);
      return;
    }
    if (!full) {
      tg = measureTarget();
      setDisc(tg.cx, tg.cy, tg.d / D);
      requestAnimationFrame(() => (el.disc.style.opacity = 1));
    } else {
      setDisc(dcx, dcy, 1);
      drawLamp(0);
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
  intro();
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
    ptarget = null;
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
      !s && !!e.target.closest("a,button,.m,.ev,.pc"),
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
    const x0 = W * 0.06,
      b2 = H * 0.8,
      b1 = b2 - fs * 0.84;
    c.fillStyle = "#fff";
    [
      ["AI", b1],
      ["FOUNDRY", b2],
    ].forEach(([s, y]) => {
      c.setTransform(1, 0, -0.22, 1, x0, y);
      c.fillText(s, 0, 0);
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
    /* whole pixels only (a fractional step breaks the pixel lookup); coarser grid on lighter tiers */
    stp = Math.round(Math.max(3 * dpr, fs / 46) * [1, 1.25, 1.6][q]);
    const d = c.getImageData(0, 0, W, H).data;
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
    const lx = (mx - cvL) * dpr,
      ly = (my - (cvT - scrollY)) * dpr;
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
    pxs = $$("h2").filter((e) => !e.closest("#jn,#md")),
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
    trkW = 0,
    cvL = 0,
    cvT = 0,
    lastTx = 0,
    cardX = [],
    h2C = [],
    h2H = [],
    h2Off = [];
  let needMeasure = true,
    dirty = true,
    settled = false;
  function measure() {
    const sc = scrollY;
    mtTop = mt.getBoundingClientRect().top + sc;
    mtH = mt.offsetHeight;
    hzTop = hz.getBoundingClientRect().top + sc;
    hzH = hz.offsetHeight;
    pipeTop = pipe.getBoundingClientRect().top + sc;
    maxScroll = Math.max(1, document.body.scrollHeight - innerHeight);
    trkW = trk.scrollWidth;
    const r = cv.getBoundingClientRect();
    cvL = r.left;
    cvT = r.top + sc;
    cardX = pns.map((n) => {
      const b = n.getBoundingClientRect();
      return b.left + b.width / 2 - lastTx;
    });
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
      pns.forEach((e) => (e.style.transform = ""));
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
  up.onclick = launch;
  $("#top2").onclick = (e) => {
    e.preventDefault();
    launch();
  };
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
        lastTx = -qh * (trkW - innerWidth);
        trk.style.transform = `translateX(${lastTx}px)`;
        hzi.style.transform = `scaleX(${qh})`;
        if (q < 2)
          for (let i = 0; i < pns.length; i++) {
            const c = (cardX[i] + lastTx - innerWidth / 2) / innerWidth;
            if (full || Math.abs(c) < 1.3)
              pns[i].style.transform = `perspective(1200px) rotateY(${c * -16}deg) scale(${1 - Math.min(0.2, Math.abs(c) * 0.14)})`;
          }
      }
      const pp = cl((innerHeight * 0.85 - (pipeTop - scrollY)) / (innerHeight * 0.5), 0, 1);
      if (pp !== lastPp) {
        lastPp = pp;
        fill.style.transform = `scaleX(${pp})`;
        steps.forEach((s, i) => {
          const v = pp > i / steps.length + 0.02;
          if (v !== stepOn[i]) {
            stepOn[i] = v;
            s.classList.toggle("on", v);
          }
        });
      }
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
