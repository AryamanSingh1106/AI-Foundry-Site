/* AI FOUNDRY — main script. Content comes from js/data.js (or a remote JSON, see README). */
async function loadSite() {
  const base = window.SITE_DATA || {};
  try {
    if (base.CONFIG && base.CONFIG.DATA_URL) {
      const r = await fetch(base.CONFIG.DATA_URL);
      if (!r.ok) throw new Error(r.status);
      return { ...base, ...(await r.json()) };
    }
  } catch (e) {
    console.warn("Remote data failed; using js/data.js", e);
  }
  return base;
}
(async () => {
  const {
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
  } = await loadSite();

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
      `<div class="rv" style="--d:${i * 0.15}s"><div class="ph"><img src="${l.photo}" alt="${l.name}"></div><h3>${l.name}</h3><span class="mono ac">${l.role}</span><a href="mailto:${l.email}">${l.email}</a></div>`,
  ).join("");
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
  evs("up");
  $$("#evtabs button").forEach(
    (b) =>
      (b.onclick = () => {
        $$("#evtabs button").forEach((x) => x.classList.toggle("on", x === b));
        evs(b.dataset.k);
      }),
  );
  projs("on");
  $$("#ptabs button").forEach(
    (b) =>
      (b.onclick = () => {
        $$("#ptabs button").forEach((x) => x.classList.toggle("on", x === b));
        projs(b.dataset.k);
      }),
  );
  /* manifesto words */
  const words = [];
  $("#mtxt").innerHTML = MANIFESTO.split(" ")
    .map((w) => {
      const h = w.startsWith("*");
      return `<i class="${h ? "hot" : ""}">${w.replace("*", "")}</i> `;
    })
    .join("");
  $$("#mtxt i").forEach((i) => words.push(i));
  /* loader + hero */
  const ct = $("#ct");
  let n = 0;
  const iv = setInterval(() => {
    n += Math.ceil(Math.random() * 7);
    if (n >= 100) {
      n = 100;
      clearInterval(iv);
      setTimeout(() => {
        $("#load").classList.add("go");
        t0 = performance.now() + 500;
        started = true;
        $$("#hero h1 span.l1,#hero h1 span.l2").forEach((s, i) => {
          s.style.transition = `transform 1.2s cubic-bezier(.2,.8,.2,1) ${0.5 + i * 0.15}s,opacity .8s ${0.5 + i * 0.15}s`;
          s.style.transform = "none";
          s.style.opacity = 1;
        });
      }, 300);
    }
    ct.textContent = String(n).padStart(3, "0");
  }, 40);
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
  /* cursor + tilt glow */
  const cur = $(".cur");
  let mx = innerWidth / 2,
    my = innerHeight / 2,
    cx = mx,
    cy = my;
  addEventListener("pointermove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    const c = e.target.closest && e.target.closest(".card,.pc");
    if (c) {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    }
  });
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
    hero = $("#hero");
  let W,
    H,
    D = [],
    P = [],
    t0 = 0,
    started = false,
    dpr = Math.min(2, devicePixelRatio || 1),
    stp = 4;
  function size() {
    cv.width = Math.round(cv.offsetWidth * dpr);
    cv.height = Math.round(cv.offsetHeight * dpr);
    W = cv.width;
    H = cv.height;
    P = Array.from({ length: Math.min(120, (W / 14) | 0) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 2 + 0.5) * dpr,
      v: (Math.random() * 0.7 + 0.2) * dpr,
      a: Math.random(),
    }));
    const o = document.createElement("canvas");
    o.width = W;
    o.height = H;
    const c = o.getContext("2d");
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
    stp = Math.max(3 * dpr, Math.round(fs / 46));
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
  let rz;
  addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(size, 200);
  });
  function hero_(t) {
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    const r = cv.getBoundingClientRect(),
      lx = (mx - r.left) * dpr,
      ly = (my - r.top) * dpr;
    hero.style.setProperty("--sx", mx - r.left + "px");
    hero.style.setProperty("--sy", my - r.top + "px");
    g.fillStyle = "#ff7a2e";
    for (const p of P) {
      p.y -= p.v;
      p.x += Math.sin(t / 900 + p.a * 9) * 0.35 * dpr;
      if (p.y < -10) {
        p.y = H + 10;
        p.x = Math.random() * W;
      }
      g.globalAlpha = 0.2 + 0.6 * Math.abs(Math.sin(t / 700 + p.a * 6));
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, 6.283);
      g.fill();
    }
    const k = cl(sy / innerHeight, 0, 1),
      R = 170 * dpr,
      s = stp * 0.62,
      B = [[], [], []];
    for (const p of D) {
      if (!started || t < t0 + p.dl) continue;
      const tx = p.tx + (p.z - 0.7) * k * W * 0.3,
        ty = p.ty - k * k * H * p.z * 1.4;
      let fx = (tx - p.x) * 0.055,
        fy = (ty - p.y) * 0.055;
      const dx = p.x - lx,
        dy = p.y - ly,
        d2 = dx * dx + dy * dy;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1,
          f = (1 - d / R) ** 2 * 9 * dpr;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
      p.vx = (p.vx + fx) * 0.84;
      p.vy = (p.vy + fy) * 0.84;
      p.x += p.vx;
      p.y += p.vy;
      const sp = Math.hypot(p.vx, p.vy) / dpr;
      B[sp > 2.2 ? 1 : p.w ? 2 : 0].push(p);
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
  const prog = (s, y) => {
    const t = s.getBoundingClientRect().top + scrollY;
    return cl((y - t) / Math.max(1, s.offsetHeight - innerHeight), 0, 1);
  };
  let vs = 0,
    psy = 0,
    going = false;
  const mq = $(".mq"),
    pns = $$(".pn"),
    pxs = $$("h2"),
    hzi = $(".hzb i"),
    up = $("#up"),
    ring = $("#ring"),
    fx = $("#fx"),
    fg = fx.getContext("2d"),
    wipe = $("#wipe");
  function reform() {
    for (const p of D) {
      p.x = Math.random() * W;
      p.y = H * 1.1 + Math.random() * H * 0.6;
      p.vx = p.vy = 0;
    }
    t0 = performance.now();
    started = true;
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
  function frame(t) {
    requestAnimationFrame(frame);
    cx += (mx - cx) * 0.2;
    cy += (my - cy) * 0.2;
    cur.style.transform = `translate(${cx}px,${cy}px)`;
    sy += (scrollY - sy) * 0.12;
    if (Math.abs(scrollY - sy) < 0.1) sy = scrollY;
    bar.style.transform = `scaleX(${sy / Math.max(1, document.body.scrollHeight - innerHeight)})`;
    if (sy < innerHeight * 1.4) {
      hero_(t);
      const k = cl(sy / innerHeight, 0, 1);
      h1.style.transform = `translateY(${k * -12}vh)`;
      h1.style.opacity = 1 - k * 0.9;
      glow.style.transform = `translate(-50%,${-50 + k * 30}%) scale(${1 + k * 0.4})`;
    }
    const p = prog(mt, sy),
      on = Math.floor(cl(p * 1.25, 0, 1) * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < on));
    const q = prog(hz, sy);
    trk.style.transform = `translateX(${-q * (trk.scrollWidth - innerWidth + 0)}px)`;
    const r = pipe.getBoundingClientRect(),
      pp = cl((innerHeight * 0.85 - r.top) / (innerHeight * 0.5), 0, 1);
    fill.style.transform = `scaleX(${pp})`;
    steps.forEach((s, i) =>
      s.classList.toggle("on", pp > i / steps.length + 0.02),
    );
    vs += (sy - psy - vs) * 0.12;
    psy = sy;
    mq.style.transform = `skewX(${cl(-vs * 0.35, -9, 9)}deg)`;
    hzi.style.transform = `scaleX(${q})`;
    pns.forEach((n) => {
      const r = n.getBoundingClientRect(),
        c = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
      n.style.transform = `perspective(1200px) rotateY(${c * -16}deg) scale(${1 - Math.min(0.2, Math.abs(c) * 0.14)})`;
    });
    pxs.forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.bottom > -200 && r.top < innerHeight + 200)
        e.style.translate = `0 ${-(r.top + r.height / 2 - innerHeight / 2) * 0.09}px`;
    });
    up.classList.toggle("show", sy > innerHeight * 0.8);
    ring.style.strokeDashoffset =
      182.2 * (1 - sy / Math.max(1, document.body.scrollHeight - innerHeight));
  }
  requestAnimationFrame(frame);
})();
