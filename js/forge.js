/* =====================================================================
   AI FOUNDRY — back-to-top: "forge the logo"
   Click the arrow and the logo is forged piece by piece while the page climbs back to the top;
   then it flies into the hero badge and the page opens from it in a glowing circle.

   How it fits the site
   - markup of the logo pieces: js/forge-layers.js, images: assets/forge/, styling: css/forge.css
   - everything (anime.js, the logo pieces, the overlay) loads on demand, so first paint is untouched
   - main.js calls AIForge.start({ tier }) from the back-to-top buttons and falls back to its own
     ember scroll if this file or anime.js is unavailable
   - tiers follow the site's performance tiers: 0 = everything, 1 = no WebGL background, fewer 3D
     layers and no heat-haze filter, 2 = not used (main.js uses its light ember scroll instead)
   - events on window: fb:start, fb:arrived (page starts opening), fb:end
   Debug: AIForge.start({ tier: 0 }) in the console.
   Tune: SPEED (1.1 = about 5 s), SOUND, VOLUME below.
   ===================================================================== */
(function () {
  "use strict";
  var CFG = {
    SPEED: 1.1,              // 1.1 = about 5 s. 1.4 = faster, 0.8 = slower
    SHOW_WORDS: true,        // small word + meaning under the logo while it builds
    SOUND: true,             // synthesized sound effects (start only after the click, so browsers allow it)
    VOLUME: 0.8,             // 0 - 1
    ANIME_URL: "https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js",
    THREE_URL: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    LAYERS_URL: "js/forge-layers.js",
    /* WHERE THE CIRCLE LANDS: the round logo in the hero badge. If it is not on screen, the fractions are used. */
    TARGET: { selector: ".badge img", cx: 0.88, cy: 0.288, d: 0.0765 },
    REVEAL_SELECTOR: ""      // optional: elements that should slide/fade in after the page opens
  };
  var root = document.documentElement;
  function fire(name) { try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {} }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = function () { rej(new Error("failed: " + src)); };
      document.head.appendChild(s);
    });
  }
  /* import() written through Function so very old browsers do not choke on the syntax (they just skip WebGL) */
  var dimport = null;
  try { dimport = new Function("u", "return import(u)"); } catch (e) {}

  /* One beat per group of pieces, bottom -> top. */
  var BEATS = [
    {steps:[0,1,2,3], dur:520, word:"PURPOSE",      text:"Build. Experiment. Solve. Impact."},
    {steps:[4],       dur:380, word:"COMMUNITY",    text:"Builders growing faster together."},
    {steps:[5],       dur:560, word:"FORGE",        text:"Raw talent shaped into real skill."},
    {steps:[6],       dur:320, word:"INTELLIGENCE", text:"AI is the material we work with."},
    {steps:[7],       dur:460, word:"FOUNDATION",   text:"Where every idea takes shape."},
    {steps:[8],       dur:480, word:"SPARK",        text:"Curiosity that ignites ideas."},
    {steps:[9],       dur:520, word:"AMBITION",     text:"Always climbing upward."},
    {steps:[10],      dur:520, word:"DATA",         text:"Ideas turning digital."},
    {steps:[],        dur:300, word:"FORGED",       text:"Welcome to AI Foundry Club."}
  ];
  var INTRO = 200;

  /* ===================== helpers ===================== */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function rnd(i, k) { var x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function S(ms) { return ms / CFG.SPEED; }

  /* ===================== state ===================== */
  var overlay, scene, card, stage, wordEl, textEl, gridEl, heatEl, rail, shineEl, plateGlow, ringTxt, bgEl, irisEl, capEl,
    turb, disp, skipBtn, layers, stepLayers, glowEl, flameEl, nodes = [];
  var VBW = 640;
  var running = false, starting = false, tl = null, loops = [], emitters = [], parts = [], endTimer = 0, lastFocus = null, builtTier = -1;
  var cam = { rx: 58, rz: -32, sc: .8 }, tilt = { rx: 0, ry: 0, tx: 0, ty: 0 };
  var punch = { v: 0 }, shk = { v: 0, a: 0 }, sway = { on: 0 };
  var scr = { p: 0 }, startY = 0, fly = { x: 0, y: 0 };
  var fxs = { speed: 0, glow: 0, flash: 0, ring: -1 };     // drives the three.js background
  var GL = null, glTried = false;

  /* ===================== overlay DOM (built once, on demand) ===================== */
  var DEFS =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="gInk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26262b"/><stop offset=".5" stop-color="#101012"/><stop offset="1" stop-color="#050506"/></linearGradient>' +
    '<linearGradient id="gAI" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa63a"/><stop offset="1" stop-color="#ff5a00"/></linearGradient>' +
    '<filter id="fbHeatF" x="-15%" y="-15%" width="130%" height="130%">' +
    '<feTurbulence id="fbTurb" type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="4" result="n"/>' +
    '<feDisplacementMap id="fbDisp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter></defs></svg>';

  function destroy() {
    if (running) return;
    nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    nodes = [];
    if (GL) { try { window.removeEventListener("resize", GL.onResize); GL.r.dispose(); } catch (e) {} GL = null; }
    glTried = false; overlay = null; builtTier = -1;
  }
  function build(tier) {
    if (overlay && builtTier === tier) return true;
    if (running) return !!overlay;
    destroy();
    builtTier = tier;
    var html = DEFS +
      '<div id="fb-overlay" role="dialog" aria-modal="true" aria-label="Back to top" aria-hidden="true">' +
        '<div id="fb-bg">' + (tier === 0 ? '<canvas id="fb-gl"></canvas>' : '') + '</div>' +
        '<canvas id="fb-fx"></canvas>' +
        '<div id="fb-scene"><div id="fb-card">' +
          '<div id="fb-shadow"></div>' +
          '<div id="fb-paper"><div id="fb-grid"></div><div id="fb-glowplate"></div><div id="fb-shine"></div></div>' +
          '<div id="fb-stage">' + window.FORGE_LAYERS +
            '<div id="fb-heat" style="left:30.938%;top:48.966%;width:37.500%;height:13.793%;z-index:0;transform:translateZ(18px)"></div>' +
          '</div>' +
          '<svg id="fb-ringtxt" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="fbRingPath" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/></defs>' +
            '<text><textPath href="#fbRingPath" textLength="548" lengthAdjust="spacing">DISCOVER \u2726 BUILD \u2726 INNOVATE \u2726 IMPACT \u2726 </textPath></text></svg>' +
          '<div id="fb-cap"><div id="fb-word">&nbsp;</div><div id="fb-text">&nbsp;</div></div>' +
        '</div></div>' +
        '<button type="button" id="fb-skip" aria-label="Skip animation and go to the top">Skip</button>' +
      '</div>' +
      '<div id="fb-iris"></div>' +
      '<div id="fb-rail"><i></i></div>';
    var tmp = document.createElement("div"); tmp.innerHTML = html;
    while (tmp.firstChild) { nodes.push(tmp.firstChild); document.body.appendChild(tmp.firstChild); }

    overlay = $("#fb-overlay"); scene = $("#fb-scene"); card = $("#fb-card"); stage = $("#fb-stage");
    wordEl = $("#fb-word"); textEl = $("#fb-text"); gridEl = $("#fb-grid"); heatEl = $("#fb-heat"); rail = $("#fb-rail i");
    shineEl = $("#fb-shine"); plateGlow = $("#fb-glowplate"); ringTxt = $("#fb-ringtxt"); bgEl = $("#fb-bg");
    irisEl = $("#fb-iris"); capEl = $("#fb-cap"); turb = $("#fbTurb"); disp = $("#fbDisp"); skipBtn = $("#fb-skip");
    cv = $("#fb-fx"); ctx = cv.getContext("2d");
    layers = $$(".fb-l", stage);
    stepLayers = layers.filter(function (l) { return l.hasAttribute("data-step"); });
    glowEl = $(".fb-glow", stage); flameEl = $('.fb-l[data-id="flame"]', stage);

    /* paper thickness: stacked plates behind the front face (fewer on the lighter tier) */
    (tier === 0 ? [1, 2, 3, 4, 5, 6, 7] : [2, 4, 7]).forEach(function (n) {
      var ed = document.createElement("div"); ed.className = "fb-edge"; ed.style.setProperty("--i", n); card.insertBefore(ed, card.firstChild);
    });
    /* extruded depth: copies of each solid piece pushed backwards (6 on the full tier, 2 on the lighter one) */
    var depth = tier === 0 ? [1, 2, 3, 4, 5, 6] : [3, 6];
    stepLayers.forEach(function (l) {
      if (!l.hasAttribute("data-ex")) return;
      var base = l.querySelector(".fb-in");
      depth.forEach(function (n) {
        var c = base.cloneNode(true); c.setAttribute("class", "fb-in fb-ex"); c.style.setProperty("--i", n); c.setAttribute("aria-hidden", "true");
        l.insertBefore(c, base);
      });
    });
    overlay.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
    overlay.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
    skipBtn.addEventListener("click", function () { if (running) finish(); });
    return true;
  }

  /* ===================== exploded pose per layer ===================== */
  function k() { return stage.offsetWidth / VBW; }
  function startPose(el, i) {
    var K = k(), W = stage.offsetWidth, H = stage.offsetHeight;
    var cx = +el.dataset.cx, cy = +el.dataset.cy, st = +el.dataset.step, id = el.dataset.id;
    var p = {
      x: ((cx - .5) * 150 + (rnd(i, 1) - .5) * 60) * K,
      y: ((cy - .5) * 110 + (rnd(i, 2) - .5) * 70 + 20) * K,
      z: (70 + rnd(i, 3) * 110 + st * 6) * K,
      rx: (rnd(i, 4) - .5) * 80, ry: (rnd(i, 5) - .5) * 100, rz: (rnd(i, 6) - .5) * 60,
      sx: 1, sy: 1, o: 0.25
    };
    if (st <= 3) { p.y = 70 * K; p.rx = 75; p.ry = (rnd(i, 7) - .5) * 40; p.rz = (rnd(i, 8) - .5) * 20; }
    if (st === 4) { p.y = 110 * K; p.rx = -80; p.z = 200 * K; }
    if (st === 5) { p.ry = -100; p.y = 70 * K; p.rz = 0; p.rx = 0; p.z = 250 * K; }
    if (st === 6) { p.sx = p.sy = 2.2; p.rz = -25; p.z = 300 * K; }
    if (st === 7) { p.x = 0; p.y = -190 * K; p.z = 520 * K; p.sx = p.sy = 1.55; p.rx = 35; p.ry = 0; p.rz = 0; p.o = .3; }
    if (st === 8) { p.x = 0; p.y = 50 * K; p.z = 40 * K; p.sx = .55; p.sy = .08; p.rx = p.ry = p.rz = 0; p.o = 0; }
    if (st === 9) {
      var side = cx < .5 ? -1 : 1;
      p.x = side * 150 * K; p.y = (id === "apex" ? -190 : -20) * K; p.z = 200 * K;
      p.rz = side * 18; p.ry = side * 50; p.rx = 10;
    }
    if (st === 10) { p.x = (.497 - cx) * W; p.y = (.26 - cy) * H + 70 * K; p.z = 10 * K; p.sx = p.sy = .1; p.rx = p.ry = p.rz = 0; p.o = 0; }
    if (el.dataset.draw) { p.sx = 0; p.sy = 1; p.x = 0; p.y = 0; p.z = 0; p.rx = p.ry = p.rz = 0; }
    el._p = p;
    return p;
  }
  function poseCss(p) {
    return "translateX(" + p.x + "px) translateY(" + p.y + "px) translateZ(" + p.z + "px) rotateX(" + p.rx + "deg) rotateY(" + p.ry +
      "deg) rotateZ(" + p.rz + "deg) scaleX(" + p.sx + ") scaleY(" + p.sy + ")";
  }
  function applyGhost() {
    stage.style.setProperty("--fbk", (k() * 1.05) + "px");
    stepLayers.forEach(function (el, i) {
      var p = startPose(el, i);
      el.style.transform = poseCss(p); el.style.opacity = p.o;
      el.style.transformOrigin = el.dataset.draw === "r" ? "100% 50%" : el.dataset.draw === "l" ? "0% 50%" : el.dataset.id === "flame" ? "50% 100%" : "50% 50%";
    });
    if (glowEl) { glowEl.style.opacity = 0; glowEl.style.transform = "translateZ(" + (20 * k()) + "px)"; }
    heatEl.style.opacity = 0; plateGlow.style.opacity = 0;
  }
  function finalZ(el) { return (+el.dataset.z || 0) * k(); }

  /* ===================== camera ===================== */
  function applyCam() {
    var sc = cam.sc * (1 + punch.v);
    card.style.transform = "rotateX(" + (cam.rx + tilt.rx) + "deg) rotateY(" + tilt.ry + "deg) rotateZ(" + cam.rz + "deg) scale3d(" + sc + "," + sc + "," + sc + ")";
    var tx = fly.x, ty = fly.y;
    if (shk.v > 0.001) { tx += (Math.random() - .5) * 2 * shk.a * shk.v; ty += (Math.random() - .5) * 2 * shk.a * shk.v; }
    if (tx || ty) scene.style.transform = "translate(" + tx + "px," + ty + "px)"; else if (scene.style.transform) scene.style.transform = "";
  }
  window.addEventListener("pointermove", function (e) {
    if (!running) return;
    tilt.tx = -((e.clientY / innerHeight) - .5) * 12; tilt.ty = ((e.clientX / innerWidth) - .5) * 20;
  }, { passive: true });
  function shake(a, ms) { shk.a = a; shk.v = 1; anime({ targets: shk, v: [1, 0], duration: ms, easing: "easeOutQuad" }); }
  function pop(v, ms) { anime({ targets: punch, v: [v, 0], duration: ms || 500, easing: "easeOutElastic(1,.55)" }); }

  /* ===================== three.js background (shader + GPU embers) ===================== */
  var VERT_BG = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  var FRAG_BG = [
    "precision highp float; varying vec2 vUv;",
    "uniform float uTime, uTravel, uSpeed, uGlow, uFlash, uRing; uniform vec2 uRes;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }",
    "float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }",
    "void main(){",
    "  vec2 uv = vUv; vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);",
    "  vec3 col = mix(vec3(0.0,0.0,0.0), vec3(0.06,0.022,0.012), smoothstep(1.0, -0.1, uv.y));",
    "  float n = fbm(vec2(p.x*2.2, p.y*1.6 - uTime*0.35) + fbm(p*3.0 + uTime*0.1));",
    "  float cloud = smoothstep(0.35, 0.9, n) * smoothstep(0.0, 1.0, 1.15 - uv.y);",
    "  col += vec3(1.0,0.30,0.16) * cloud * (0.10 + 0.40 * uGlow);",
    "  float d = length(p * vec2(1.0, 1.1) + vec2(0.0, 0.05));",
    "  col += vec3(1.0,0.32,0.14) * exp(-d*3.0) * (0.10 + 0.65 * uGlow);",
    "  float lane = floor(uv.x * 110.0); float h = hash(vec2(lane, 7.0));",
    "  float y = fract(uv.y * (0.5 + h) * 1.3 + uTravel * (0.5 + h * 1.3) + h * 9.0);",
    "  float streak = step(0.8, h) * smoothstep(0.0, 0.02, y) * (1.0 - smoothstep(0.02, 0.38, y));",
    "  col += vec3(1.0,0.46,0.22) * streak * uSpeed * 0.55 * (0.4 + 0.6 * smoothstep(1.0, 0.0, abs(p.x) * 1.4));",
    "  float r = length(p); float q = (r - uRing * 1.5) * 8.0; float w = exp(-q * q); col += vec3(1.0,0.52,0.28) * w * step(0.0, uRing) * (1.0 - uRing) * 0.9;",
    "  col *= 1.0 - 0.6 * pow(length(uv - 0.5) * 1.3, 2.0);",
    "  col = mix(col, vec3(1.0,0.90,0.78), uFlash);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");
  var VERT_EMB = [
    "attribute vec4 aSeed; uniform float uTime, uPx, uGlow; varying float vA; varying float vH;",
    "void main(){",
    "  float t = fract(aSeed.w + uTime * (0.05 + aSeed.z * 0.13));",
    "  float sx = (aSeed.x * 2.0 - 1.0) * (0.25 + 0.75 * t);",
    "  vec2 pos = vec2(sx + sin(uTime * (0.7 + aSeed.y) + aSeed.y * 6.0) * 0.04 * t, -0.95 + t * 2.1);",
    "  vA = (1.0 - t) * smoothstep(0.0, 0.08, t) * (0.25 + 0.75 * uGlow); vH = t;",
    "  gl_PointSize = (2.0 + aSeed.y * 6.0) * uPx * (1.0 - t * 0.55);",
    "  gl_Position = vec4(pos, 0.0, 1.0);",
    "}"
  ].join("\n");
  var FRAG_EMB = [
    "precision highp float; varying float vA; varying float vH;",
    "void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;",
    "  vec3 c = mix(vec3(1.0,0.82,0.48), vec3(1.0,0.30,0.18), vH); gl_FragColor = vec4(c, a); }"
  ].join("\n");

  function initGL(T) {
    try {
      var cvs = $("#fb-gl"), uni = false; if (!cvs) return;
      var r = new T.WebGLRenderer({ canvas: cvs, antialias: false, alpha: uni, powerPreference: "high-performance" });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      if (uni) r.setClearColor(0x000000, 0);
      var scn = new T.Scene(), cm = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      var U = { uTime: { value: 0 }, uTravel: { value: 0 }, uSpeed: { value: 0 }, uGlow: { value: 0 }, uFlash: { value: 0 }, uRing: { value: -1 }, uRes: { value: new T.Vector2(1, 1) } };
      if (!uni) {
        var bg = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: U, vertexShader: VERT_BG, fragmentShader: FRAG_BG, depthTest: false, depthWrite: false }));
        bg.frustumCulled = false; scn.add(bg);
      }
      var N = (window.innerWidth < 700) ? 150 : 320, g = new T.BufferGeometry(), pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
      for (var i = 0; i < N; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
      g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new T.BufferAttribute(seed, 4));
      var EU = { uTime: U.uTime, uGlow: U.uGlow, uPx: { value: Math.min(window.devicePixelRatio || 1, 1.5) } };
      var pts = new T.Points(g, new T.ShaderMaterial({ uniforms: EU, vertexShader: VERT_EMB, fragmentShader: FRAG_EMB, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }));
      pts.frustumCulled = false; scn.add(pts);
      GL = { r: r, scn: scn, cm: cm, U: U, uni: uni };
      GL.resize = function () { r.setSize(window.innerWidth, window.innerHeight, false); U.uRes.value.set(window.innerWidth, window.innerHeight); };
      GL.resize(); GL.onResize = GL.resize; window.addEventListener("resize", GL.onResize);
    } catch (err) { GL = null; console.warn("[fb] three.js setup failed, using CSS background", err); }
  }

  /* ===================== canvas particles (sparks + embers) ===================== */
  var cv, ctx, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function fxResize() { if (!cv) return; cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  window.addEventListener("resize", fxResize);
  var sprite = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 64; var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,244,214,1)"); gr.addColorStop(.22, "rgba(255,210,122,.95)"); gr.addColorStop(.55, "rgba(255,106,46,.5)"); gr.addColorStop(1, "rgba(255,77,46,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  })();
  function burst(x, y, o) {
    o = o || {};
    var n = o.n || 20, kind = o.kind || "spark", ang = o.angle == null ? -Math.PI / 2 : o.angle, spread = o.spread == null ? Math.PI * 2 : o.spread;
    for (var i = 0; i < n; i++) {
      var a = ang + (Math.random() - .5) * spread, sp = (o.speed || 6) * (.35 + Math.random() * .8);
      parts.push({ kind: kind, x: x, y: y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: kind === "spark" ? (o.g == null ? .22 : o.g) : -.025, drag: kind === "spark" ? .965 : .985,
        life: 0, max: (o.life || 900) * (.6 + Math.random() * .7), size: (o.size || 2) * (.6 + Math.random() * .9), ph: Math.random() * 6.28 });
    }
  }
  function rectOf(el) { return el.getBoundingClientRect(); }
  function burstAt(el, nx, ny, o) { var r = rectOf(el); burst(r.left + r.width * nx, r.top + r.height * ny, o); }
  function ring(x, y, size, ms) {
    var d = document.createElement("div"); d.className = "fb-ring"; d.style.left = x + "px"; d.style.top = y + "px"; document.body.appendChild(d);
    anime({ targets: d, scale: [1, size], opacity: [.9, 0], duration: ms || 800, easing: "easeOutExpo", complete: function () { d.remove(); } });
  }
  var lastT = 0, rafId = 0;
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(40, now - (lastT || now)) / 16.67; lastT = now;
    if (sway.on) { tilt.tx = Math.sin(now / 700) * 3; tilt.ty = Math.sin(now / 1000) * 9; }
    tilt.rx = lerp(tilt.rx, tilt.tx, .08 * dt); tilt.ry = lerp(tilt.ry, tilt.ty, .08 * dt);
    applyCam();
    if (GL) {
      var U = GL.U; U.uTime.value = now / 1000; U.uTravel.value += fxs.speed * dt * 0.016;
      U.uSpeed.value = fxs.speed; U.uGlow.value = fxs.glow; U.uFlash.value = fxs.flash; U.uRing.value = fxs.ring;
      try { GL.r.render(GL.scn, GL.cm); } catch (err) { GL = null; }
    }
    for (var e = emitters.length - 1; e >= 0; e--) {
      var em = emitters[e], pt = em.at(); if (!pt) continue;
      em.acc += em.rate * dt / 60;
      while (em.acc >= 1) { em.acc -= 1; burst(pt.x + (Math.random() - .5) * em.w, pt.y, Object.assign({}, em.o, { n: 1 })); }
    }
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dt * 16.67;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      var t = p.life / p.max; p.px = p.x; p.py = p.y;
      if (p.kind === "ember") p.vx += Math.sin(now / 300 + p.ph) * .02 * dt;
      p.vx *= Math.pow(p.drag, dt); p.vy = p.vy * Math.pow(p.drag, dt) + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var a = (1 - t) * (1 - t);
      if (p.kind === "spark") {
        ctx.globalAlpha = Math.min(1, a * 1.4); ctx.lineWidth = Math.max(.6, p.size * (1 - t)); ctx.lineCap = "round";
        ctx.strokeStyle = t < .35 ? "rgb(255,210,122)" : "rgb(255,106,46)";
        ctx.beginPath(); ctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else {
        var s = p.size * 5 * (1 - t * .6) * (.8 + .2 * Math.sin(now / 90 + p.ph));
        ctx.globalAlpha = Math.min(1, a * 1.3); ctx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ===================== sound design (Web Audio, fully synthesized - no audio files) ===================== */
  var AC = null, MG = null, NB = null, SFX = null;
  function noiseBuffer(c) {
    var n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = (w * .6 + last * 6) * .5; }   /* white + a little brown = warmer noise */
    return b;
  }
  function makeSfx(c, out, nb) {
    var P = [659.25, 783.99, 880, 1046.5, 1318.5, 1568, 1760];            /* bright pentatonic: E5 G5 A5 C6 E6 G6 A6 */
    function tone(f, t, d, o) {
      o = o || {}; var a = Math.min(o.a || .004, d * .9), os = c.createOscillator(), g = c.createGain();
      os.type = o.type || "sine"; os.frequency.setValueAtTime(f, t);
      if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + d);
      g.gain.setValueAtTime(o.from || .0001, t); g.gain.exponentialRampToValueAtTime(o.g || .2, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      os.connect(g); g.connect(out); os.start(t); os.stop(t + d + .05);
    }
    function noise(t, d, o) {
      o = o || {}; var a = Math.min(o.a == null ? .01 : o.a, d * .9), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = nb; s.loop = true; f.type = o.type || "bandpass"; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f0 || 1000, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + d);
      g.gain.setValueAtTime(o.from || .0001, t); g.gain.exponentialRampToValueAtTime(o.g || .2, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.2); s.stop(t + d + .05);
    }
    return {
      /* rising whoosh + pitch climb for the whole climb up the page */
      rise: function (t, d) {
        noise(t, d, { f0: 180, f1: 3200, q: 2.2, a: d * .9, g: .32, from: .03 });
        tone(98, t, d, { to: 392, type: "sawtooth", a: d * .9, g: .07, from: .008 }); tone(196, t, d, { to: 784, a: d * .9, g: .09, from: .012 });
      },
      tick: function (t, i) { var f = P[i % P.length]; tone(f, t, .24, { type: "triangle", g: .17 }); tone(f * 2, t, .12, { g: .04 }); noise(t, .03, { type: "highpass", f0: 4000, g: .05 }); },
      clack: function (t, i) { noise(t, .04, { f0: 2400 + i * 160, q: 3, g: .24 }); tone(180 + i * 18, t, .07, { type: "square", g: .05, to: 90 }); },
      stamp: function (t) { tone(140, t, .2, { to: 50, g: .35 }); noise(t, .09, { type: "lowpass", f0: 1800, f1: 300, g: .2 }); tone(1760, t + .02, .35, { type: "triangle", g: .06 }); tone(2640, t + .02, .25, { g: .03 }); },
      /* the anvil: deep thud, sub boom and an inharmonic metallic ring */
      slam: function (t, big) {
        var k = big ? 1 : .5;
        tone(130, t, .5, { to: 34, g: .6 * k, a: .003 }); noise(t, .35, { type: "lowpass", f0: 2600, f1: 120, g: .5 * k, a: .002 }); tone(48, t, .9, { g: .5 * k, a: .004 });
        [[523.25, 1], [1397, .55], [2217, .4], [3141, .25], [4300, .12]].forEach(function (p) { tone(p[0], t, big ? 1.6 : .8, { g: .09 * k * p[1], a: .002 }); });
      },
      ignite: function (t) {
        noise(t, .9, { f0: 250, f1: 2400, q: .8, a: .35, g: .28 }); noise(t, 1.2, { type: "lowpass", f0: 400, f1: 200, g: .14, a: .3 }); tone(70, t, 1, { to: 110, g: .14, a: .4 });
        for (var i = 0; i < 26; i++) noise(t + .1 + Math.random() * 1.1, .012 + Math.random() * .02, { type: "highpass", f0: 2500 + Math.random() * 3000, g: .12 + Math.random() * .1, a: .002 });   /* crackle */
      },
      blip: function (t, i) { var f = P[(i * 3) % P.length] * (i % 2 ? 2 : 1); tone(f, t, .09, { type: "square", g: .05 }); tone(f * 2, t + .02, .14, { g: .03 }); },
      shimmer: function (t) {
        [523.25, 659.25, 783.99, 987.77, 1318.5].forEach(function (f, i) { tone(f, t + i * .03, 1.3, { a: .25, g: .07 }); tone(f * 2.003, t + i * .03, 1, { a: .3, g: .025 }); });
        noise(t, 1.2, { type: "highpass", f0: 5000, f1: 9000, a: .5, g: .04 });
      },
      fly: function (t, d) { noise(t, d, { f0: 3500, f1: 500, q: 1.4, a: d * .35, g: .3 }); tone(1200, t, d, { to: 260, type: "sawtooth", a: d * .35, g: .04 }); },
      land: function (t) {
        tone(160, t, .35, { to: 55, g: .5, a: .003 }); noise(t, .12, { type: "lowpass", f0: 3000, f1: 300, g: .3, a: .002 });
        [880, 1318.5, 1760, 2637].forEach(function (f, i) { tone(f, t, 1.1 - i * .15, { g: .09 / (i + 1) + .02, a: .002 }); });
      },
      open: function (t, d) {
        noise(t, d, { f0: 300, f1: 6000, q: .9, a: d * .7, g: .22 }); tone(220, t, d, { to: 880, a: d * .8, g: .06 });
        tone(1046.5, t + d * .55, 1.2, { a: .1, g: .05 }); tone(1568, t + d * .6, 1.2, { a: .1, g: .04 });
      }
    };
  }
  function audioOn() {
    if (!CFG.SOUND) return false;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
      if (!AC) {
        AC = new Ctx(); NB = noiseBuffer(AC); MG = AC.createGain();
        var comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .2;
        MG.connect(comp); comp.connect(AC.destination); SFX = makeSfx(AC, MG, NB);
      }
      if (AC.state === "suspended") AC.resume();
      MG.gain.cancelScheduledValues(0); MG.gain.setValueAtTime(Math.max(0, Math.min(1, CFG.VOLUME)), AC.currentTime);
      return true;
    } catch (e) { AC = null; SFX = null; return false; }
  }
  function sx(name) {                         /* play a named sound right now */
    if (!AC || !SFX) return;
    try { SFX[name].apply(null, [AC.currentTime + .005].concat(Array.prototype.slice.call(arguments, 1))); } catch (e) {}
  }
  function audioOff() { try { if (AC && MG) { MG.gain.cancelScheduledValues(0); MG.gain.setTargetAtTime(0, AC.currentTime, .06); } } catch (e) {} }

  /* ===================== caption ===================== */
  function caption(b) {
    if (!CFG.SHOW_WORDS) return;
    textEl.textContent = b.text;
    wordEl.innerHTML = b.word.split("").map(function (c) { return "<span>" + c + "</span>"; }).join("");
    anime({ targets: $$("#fb-word span"), translateY: [18, 0], opacity: [0, 1], scale: [.5, 1], delay: anime.stagger(S(14)), duration: S(380), easing: "easeOutBack(1.7)" });
    anime({ targets: textEl, opacity: [0, 1], translateY: [8, 0], duration: S(320), easing: "easeOutQuad" });
  }

  /* ===================== the build ===================== */
  function layersOf(step) { return stepLayers.filter(function (l) { return +l.dataset.step === step; }); }
  function landAnim(els, o) {
    o = o || {};
    return {
      targets: els,
      translateX: function (el) { return [el._p.x, 0]; }, translateY: function (el) { return [el._p.y, 0]; },
      translateZ: function (el) { return [el._p.z, finalZ(el)]; },
      rotateX: function (el) { return [el._p.rx, 0]; }, rotateY: function (el) { return [el._p.ry, 0]; }, rotateZ: function (el) { return [el._p.rz, 0]; },
      scaleX: function (el) { return [el._p.sx, 1]; }, scaleY: function (el) { return [el._p.sy, 1]; },
      opacity: function (el) { return [el._p.o, 1]; },
      duration: S(o.duration || 600), delay: o.delay || 0, easing: o.easing || "easeOutBack(1.25)"
    };
  }

  function begin(tier) {
    if (running) return;
    running = true;
    lastFocus = document.activeElement;
    root.classList.add("fb-run");
    fire("fb:start");
    startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.documentElement.style.scrollBehavior = "auto";
    fxResize(); applyGhost(); audioOn();
    cam.rx = 58; cam.rz = -32; cam.sc = .8; tilt.rx = tilt.ry = tilt.tx = tilt.ty = 0; sway.on = 0;
    fxs.speed = 0; fxs.glow = 0; fxs.flash = 0; fxs.ring = -1;
    card.style.opacity = 1; overlay.style.opacity = ""; fly.x = fly.y = 0; setMask(null); irisEl.style.opacity = 0; capEl.style.opacity = 1; ringTxt.style.opacity = 0;
    gridEl.style.opacity = 1; wordEl.innerHTML = "&nbsp;"; textEl.innerHTML = "&nbsp;";
    overlay.classList.add("open"); overlay.setAttribute("aria-hidden", "false");
    try { skipBtn.focus({ preventScroll: true }); } catch (e) {}
    lastT = 0; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(frame);
    clearTimeout(endTimer); endTimer = setTimeout(function () { if (running) { finish(); window.scrollTo(0, 0); } }, S(9000));

    var starts = [], t = INTRO;
    BEATS.forEach(function (b, i) { starts[i] = t; t += S(b.dur); });
    var F = starts[BEATS.length - 1], buildEnd = F;

    tl = anime.timeline({ autoplay: true, easing: "easeOutExpo" });
    function at(ms, fn) { tl.add({ targets: { v: 0 }, v: 1, duration: 1, easing: "linear", begin: fn }, ms); }

    tl.add({ targets: cam, rx: [58, 7], rz: [-32, 0], sc: [.8, 1], duration: buildEnd - 100, easing: "easeInOutSine" }, 0);
    tl.add({ targets: scr, p: [0, 1], duration: buildEnd - INTRO, easing: "easeInOutQuad",
      update: function () { window.scrollTo(0, startY * (1 - scr.p)); rail.style.transform = "scaleY(" + scr.p + ")"; } }, INTRO);
    tl.add({ targets: gridEl, opacity: [1, 0], duration: buildEnd - INTRO, easing: "linear" }, INTRO);
    /* background: speed lines rush down while we climb, ease to rest on arrival */
    tl.add({ targets: fxs, speed: [0, 1], duration: S(500), easing: "easeOutQuad" }, 0);
    tl.add({ targets: fxs, speed: [1, 0], duration: S(520), easing: "easeOutCubic" }, F - S(160));
    tl.add({ targets: shineEl, translateX: ["-80%", "80%"], duration: buildEnd, easing: "easeInOutSine" }, 0);

    BEATS.forEach(function (b, i) { at(starts[i], function () { caption(b); }); });
    sx('rise', Math.max(.5, (F - 120) / 1000));

    /* beat 0: tagline words flip up */
    tl.add(landAnim(stepLayers.filter(function (l) { return +l.dataset.step <= 3; }), { duration: 480, delay: anime.stagger(S(70)), easing: "easeOutBack(1.5)" }), starts[0]);
    at(starts[0] + S(400), function () { layersOf(2).forEach(function (l) { burstAt(l, .5, .6, { n: 12, speed: 4, spread: Math.PI * 1.2, size: 1.6, life: 600 }); }); });
    for (var ti = 0; ti < 4; ti++) (function (i) { at(starts[0] + S(300 + i * 70), function () { sx('tick', i); }); })(ti);
    /* beat 1: CLUB + lines */
    tl.add(landAnim(layersOf(4).filter(function (l) { return !l.dataset.draw; }), { duration: 520, delay: anime.stagger(S(60)) }), starts[1]);
    tl.add(landAnim(layersOf(4).filter(function (l) { return l.dataset.draw; }), { duration: 480, easing: "easeOutExpo" }), starts[1] + S(160));
    for (var ci = 0; ci < 4; ci++) (function (i) { at(starts[1] + S(300 + i * 60), function () { sx('clack', i); }); })(ci);
    /* beat 2: FOUNDRY letters */
    var fo = layersOf(5);
    tl.add(landAnim(fo, { duration: 520, delay: anime.stagger(S(48)), easing: "easeOutBack(1.4)" }), starts[2]);
    fo.forEach(function (l, i) { at(starts[2] + S(330 + i * 48), function () { burstAt(l, .5, .95, { n: 6, speed: 5, spread: Math.PI * .9, size: 1.7, life: 600 }); }); });
    at(starts[2] + S(640), function () { shake(3, 200); });
    for (var fi2 = 0; fi2 < 7; fi2++) (function (i) { at(starts[2] + S(330 + i * 48), function () { sx('clack', i + 2); }); })(fi2);
    at(starts[3], function () { anime({ targets: ringTxt, opacity: [0, 1], duration: S(500), easing: "easeOutQuad" }); });
    /* beat 3: AI */
    tl.add(landAnim(layersOf(6), { duration: 520, delay: anime.stagger(S(90)), easing: "easeOutExpo" }), starts[3]);
    at(starts[3] + S(260), function () { sx('stamp'); layersOf(6).forEach(function (l) { burstAt(l, .5, .5, { n: 14, speed: 6, size: 2, life: 650 }); }); shake(4, 220); pop(.012, 400); });
    /* beat 4: anvil SLAM */
    var anv = layersOf(7);
    tl.add(landAnim(anv, { duration: 380, easing: "easeInQuart" }), starts[4]);
    at(starts[4] + S(370), function () {
      var r = rectOf(anv[0]), x = r.left + r.width / 2, y = r.top + r.height * .18;
      sx('slam', true); shake(13, 420); pop(.045, 560); ring(x, y, 34, 800);
      anime({ targets: fxs, ring: [0, 1], duration: S(900), easing: "easeOutQuad" });
      anime({ targets: fxs, flash: [.4, 0], duration: S(260), easing: "easeOutQuad" });
      burst(x, y, { n: 60, speed: 11, spread: Math.PI * 1.15, size: 2.4, life: 900 });
      burst(x, y, { n: 14, kind: "ember", speed: 2.6, spread: Math.PI, size: 2, life: 1300 });
    });
    /* beat 5: flame ignites */
    var fl = layersOf(8);
    tl.add(landAnim(fl, { duration: 700, easing: "easeOutElastic(1,.6)" }), starts[5] + S(60));
    at(starts[5] + S(40), function () {
      sx('ignite');
      anime({ targets: heatEl, opacity: [0, .8], scale: [.4, 1], duration: S(600), easing: "easeOutQuad" });
      anime({ targets: plateGlow, opacity: [0, .55], duration: S(700), easing: "easeOutQuad" });
      anime({ targets: fxs, glow: [0, 1], duration: S(700), easing: "easeOutQuad" });
      if (glowEl) anime({ targets: glowEl, opacity: [0, .85], duration: S(600), easing: "easeOutQuad" });
      var r = rectOf(fl[0]);
      burst(r.left + r.width / 2, r.top + r.height * .9, { n: 38, kind: "ember", speed: 3.4, angle: -Math.PI / 2, spread: .9, size: 2.2, life: 1800 });
      shake(5, 300);
      emitters.push({ rate: 34, acc: 0, w: 54, o: { kind: "ember", speed: 2.2, angle: -Math.PI / 2, spread: .8, size: 1.8, life: 1900 },
        at: function () { var q = rectOf(flameEl); return { x: q.left + q.width * .5, y: q.top + q.height * .3 }; } });
      var h = { s: 0, f: .03 };
      if (tier === 0) {                                  /* the wobbling heat-haze filter is the most expensive effect: full tier only */
      loops.push(anime({ targets: h, s: [7, 12], f: [.03, .05], duration: 600, direction: "alternate", loop: true, easing: "easeInOutSine",
        update: function () { turb.setAttribute("baseFrequency", "0.012 " + h.f.toFixed(4)); disp.setAttribute("scale", h.s.toFixed(2)); } }));
      $(".fb-in", flameEl).style.filter = "url(#fbHeatF)";
      }
      loops.push(anime({ targets: heatEl, opacity: [.55, .85], scale: [.95, 1.06], duration: 450, direction: "alternate", loop: true, easing: "easeInOutSine" }));
      if (glowEl) loops.push(anime({ targets: glowEl, opacity: [.55, .95], duration: 330, direction: "alternate", loop: true, easing: "easeInOutSine" }));
    });
    /* beat 6: the A slams in */
    var aL = layersOf(9);
    tl.add(landAnim(aL, { duration: 560, delay: anime.stagger(S(90)), easing: "easeOutBack(1.1)" }), starts[6]);
    aL.forEach(function (l, i) {
      at(starts[6] + S(430 + i * 90), function () {
        var r = rectOf(l), id = l.dataset.id, side = r.left + r.width / 2 < innerWidth / 2 ? 0.2 : 0.8;
        burst(r.left + r.width * (id === "apex" ? .5 : side), r.top + r.height * (id === "apex" ? .1 : .85), { n: 20, speed: 8, spread: Math.PI * 1.3, size: 2.1, life: 800 });
        if (i === 0 || i === 2) sx('slam', false); shake(7, 260); pop(.018, 400);
      });
    });
    /* beat 7: pixels lift out of the fire */
    var pxl = layersOf(10);
    tl.add(landAnim(pxl, { duration: 720, delay: anime.stagger(S(55)), easing: "easeOutCubic" }), starts[7]);
    pxl.forEach(function (l, i) { at(starts[7] + S(450 + i * 55), function () { sx('blip', i); burstAt(l, .5, .5, { n: 5, speed: 3.2, size: 1.6, life: 650 }); }); });
    at(starts[7] + S(700), function () {
      pxl.forEach(function (l, i) {
        loops.push(anime({ targets: $(".fb-in", l), translateY: [0, -(3 + (i % 4)) * k()], duration: 900 + (i * 173) % 700, direction: "alternate", loop: true, easing: "easeInOutSine" }));
      });
    });
    /* finale: heat wave through the logo, golden shower, then dissolve */
    at(F, function () {
      sx('shimmer'); sway.on = 1; pop(.04, 700);
      var r = rectOf(stage); ring(r.left + r.width / 2, r.top + r.height * .45, 52, 1000);
      anime({ targets: fxs, flash: [.55, 0], duration: S(420), easing: "easeOutQuad" });
      var wv = { p: 0 };
      anime({ targets: wv, p: [-.2, 1.2], duration: S(520), easing: "easeInOutSine", update: function () {
        stepLayers.forEach(function (l) {
          if (l.dataset.id === "flame") return;
          var g = Math.max(0, 1 - Math.abs(+l.dataset.cx - wv.p) / .22), inner = l.querySelector(".fb-in:not(.fb-ex)");
          if (inner) inner.style.filter = g > .02 ? "drop-shadow(0 0 " + (14 * g).toFixed(1) + "px rgba(255,140,30," + (.95 * g).toFixed(2) + "))" : "";
        });
      } });
      for (var j = 0; j < 5; j++) (function (jj) { setTimeout(function () { burst(innerWidth * (.2 + Math.random() * .6), innerHeight * (.14 + Math.random() * .1),
        { n: 28, speed: 7, spread: Math.PI * 2, g: .12, size: 1.8, life: 1000 }); }, jj * 90); })(j);
    });
    at(F + S(220), flyAndOpen);
  }

  /* ===================== fly to the site badge, then the page opens from it ===================== */
  function tween(ms, bezier, upd, done) {
    var o = { v: 0 }; upd(0);
    anime({ targets: o, v: [0, 1], duration: ms, easing: "cubicBezier(" + bezier.join(",") + ")",
      update: function () { upd(o.v); }, complete: function () { upd(1); if (done) done(); } });
  }
  function target() {
    var W = innerWidth, H = innerHeight, t = CFG.TARGET, el = t.selector ? $(t.selector) : null;
    if (el) { var r = el.getBoundingClientRect(); if (r.width > 4 && r.bottom > 0) return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, d: Math.min(r.width, r.height) }; }
    return { cx: t.cx * W, cy: t.cy * H, d: Math.max(56, t.d * W) };
  }
  function setMask(T, r) {
    var m = T ? "radial-gradient(circle at " + T.cx + "px " + T.cy + "px, transparent " + r + "px, #000 " + (r + 3) + "px)" : "";
    bgEl.style.webkitMaskImage = m; bgEl.style.maskImage = m;
  }
  function flyAndOpen() {
    window.scrollTo(0, 0);
    var T = target(), W = innerWidth, H = innerHeight, s0 = cam.sc, s1 = T.d / card.offsetWidth, rx0 = cam.rx, rz0 = cam.rz;
    sway.on = 0; tilt.tx = tilt.ty = 0; sx('fly', S(520) / 1000);
    anime({ targets: capEl, opacity: 0, duration: S(160), easing: "linear" });
    tween(S(520), [.62, 0, .25, 1], function (v) {
      fly.x = (T.cx - W / 2) * v; fly.y = (T.cy - H / 2) * v; cam.sc = lerp(s0, s1, v); cam.rx = lerp(rx0, 0, v); cam.rz = lerp(rz0, 0, v);
    }, function () { openPage(T); });
  }
  function openPage(T) {
    var W = innerWidth, H = innerHeight, R0 = T.d / 2, R1 = Math.hypot(Math.max(T.cx, W - T.cx), Math.max(T.cy, H - T.cy)) + 40;
    sx('land'); sx('open', S(620) / 1000); ring(T.cx, T.cy, Math.max(4, T.d / 16), 700);
    burst(T.cx, T.cy, { n: 40, speed: 7, spread: Math.PI * 2, size: 2, life: 700 });
    pop(.06, 520);
    document.documentElement.classList.add("fb-arrived");
    try { window.dispatchEvent(new CustomEvent("fb:arrived")); } catch (e) {}
    if (CFG.REVEAL_SELECTOR) {
      var els = $$(CFG.REVEAL_SELECTOR);
      if (els.length) anime({ targets: els, opacity: [0, 1], translateY: [24, 0], delay: anime.stagger(Math.min(45, 900 / els.length), { start: S(250) }), duration: S(650), easing: "easeOutCubic" });
    }
    tween(S(620), [.55, .05, .85, .45], function (v) {
      var r = lerp(R0, R1, v); setMask(T, r);
      irisEl.style.opacity = Math.max(0, 1 - v * 1.05) * .95; irisEl.style.left = (T.cx - r) + "px"; irisEl.style.top = (T.cy - r) + "px";
      irisEl.style.width = irisEl.style.height = (2 * r) + "px";
      card.style.opacity = Math.max(0, 1 - v * 3);
    }, function () { finish(); });
  }

  function resetAll() {
    loops.forEach(function (a) { try { a.pause(); } catch (e) {} }); loops = []; emitters = []; parts = [];
    stepLayers.forEach(function (l) { $$(".fb-in", l).forEach(function (f) { f.style.filter = ""; f.style.transform = ""; }); });
    var fi = flameEl && $(".fb-in", flameEl); if (fi) fi.style.filter = "";
    try { anime.remove(layers); anime.remove([cam, shk, punch, scr, fxs, heatEl, glowEl, gridEl, plateGlow, shineEl, ringTxt, capEl]); } catch (e) {}
    rail.style.transform = "scaleY(0)"; sway.on = 0; shk.v = 0; punch.v = 0;
  }
  function finish() {
    if (!running) return;
    audioOff();
    try { tl && tl.pause(); } catch (e) {}
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = "";
    overlay.classList.remove("open"); overlay.setAttribute("aria-hidden", "true");
    cancelAnimationFrame(rafId); resetAll(); ctx.clearRect(0, 0, innerWidth, innerHeight);
    overlay.style.opacity = ""; card.style.opacity = ""; scene.style.transform = ""; fly.x = fly.y = 0; setMask(null); irisEl.style.opacity = 0; capEl.style.opacity = 1;
    setTimeout(function () { document.documentElement.classList.remove("fb-arrived"); }, 1500);
    running = false;
    root.classList.remove("fb-run");
    fire("fb:end");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && running) finish(); });

  /* ===================== loading + public API ===================== */
  var deps = null;
  function ready() {
    if (deps) return deps;
    deps = Promise.all([
      window.anime ? 0 : loadScript(CFG.ANIME_URL),
      window.FORGE_LAYERS ? 0 : loadScript(CFG.LAYERS_URL)
    ]).then(function () { return !!(window.anime && window.FORGE_LAYERS); })
      .catch(function (e) { console.warn("[forge] could not load", e); deps = null; return false; });
    return deps;
  }
  function reduceMotion() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
  /* warm everything up while the visitor is scrolling, so the click starts instantly */
  function preload(tier) {
    tier = tier || 0;
    if (tier >= 2 || reduceMotion()) return;
    ready().then(function (ok) {
      if (!ok || running) return;
      build(tier);
      if (tier === 0 && !glTried && dimport) {
        glTried = true;
        dimport(CFG.THREE_URL).then(initGL).catch(function (e) { console.warn("[forge] three.js not loaded, using the CSS background", e); });
      }
    });
  }
  /* start({ tier, onFail }) -> true if the animation is (or will be) playing, false if the caller should scroll itself */
  function start(opts) {
    opts = opts || {};
    var tier = opts.tier || 0;
    if (running || starting) return true;
    if (tier >= 2 || reduceMotion() || !window.Promise) return false;
    function go() {
      starting = false;
      try {
        if (!build(tier)) throw new Error("no overlay");
        begin(tier);
      } catch (err) {
        console.error("[forge] animation failed", err);
        try { finish(); } catch (e2) {}
        if (opts.onFail) opts.onFail();
      }
    }
    if (window.anime && window.FORGE_LAYERS) { go(); return true; }
    starting = true;
    var timeout = new Promise(function (r) { setTimeout(function () { r(false); }, 3000); });
    Promise.race([ready(), timeout]).then(function (ok) {
      if (ok) go(); else { starting = false; if (opts.onFail) opts.onFail(); }
    });
    return true;
  }
  window.AIForge = { start: start, preload: preload, isRunning: function () { return running; } };
})();
