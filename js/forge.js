/* =====================================================================
   AI FOUNDRY — "forge the logo" intro + the anvil-strike back-to-top
   1) FORGE INTRO (first open): the logo is forged piece by piece, then flies into the hero badge and the page opens from it
      in a glowing circle.
   2) ANVIL STRIKE (back-to-top button / footer "Re-ignite"): see the section "ANVIL STRIKE" below.

   How it fits the site
   - markup of the logo pieces: js/forge-layers.js, images: assets/forge/, styling: css/forge.css
   - everything (anime.js, the logo pieces, the overlay) loads on demand, so first paint is untouched
   - main.js plays it as the FIRST-VISIT INTRO (AIForge.load -> prepare -> start) and falls back to the lamp
     intro if this file, anime.js or the logo pieces are unavailable
   - tiers follow the site's performance tiers: 0 = everything, 1 = no WebGL background, fewer 3D
     layers and no heat-haze filter, 2 = not used (the lamp intro plays instead)
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
    ANVIL_URL: "assets/forge/anvil.webp",
    FLAME_URL: "assets/forge/flame.webp",
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
  function rnd(i, k) { var x = Math.sin(i * 127.1 + k * 311.7 + SEED) * 43758.5453; return x - Math.floor(x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function S(ms) { return ms / CFG.SPEED; }

  /* ===================== state ===================== */
  var barsEl = [], overlay, scene, card, stage, wordEl, textEl, gridEl, heatEl, rail, shineEl, plateGlow, ringTxt, bgEl, irisEl, capEl,
    turb, disp, layers, stepLayers, glowEl, flameEl, nodes = [];
  var VBW = 640;
  var running = false, starting = false, tl = null, loops = [], emitters = [], parts = [], endTimer = 0, lastFocus = null, builtTier = -1;
  var cam = { rx: 58, rz: -32, sc: .8 }, tilt = { rx: 0, ry: 0, tx: 0, ty: 0 };
  var punch = { v: 0 }, shk = { v: 0, a: 0 }, sway = { on: 0 };
  var scr = { p: 0 }, startY = 0, fly = { x: 0, y: 0 };
  var fxs = { speed: 0, glow: 0, flash: 0, ring: -1 };     // drives the three.js background
  var GL = null, glTried = false;
  var curTier = 0, SEED = 0, mir = 1, floorEm = null;       // per-run: quality tier, random scatter seed, random camera side, floor embers
  var rays = { o: 0, a: 0, len: 0, x: 0, y: 0 };            // sunburst rays drawn on the 2D canvas when the page opens

  /* ===================== overlay DOM (built once, on demand) ===================== */
  var DEFS =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="gInk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26262b"/><stop offset=".5" stop-color="#101012"/><stop offset="1" stop-color="#050506"/></linearGradient>' +
    '<linearGradient id="gAI" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa63a"/><stop offset="1" stop-color="#ff5a00"/></linearGradient>' +
    '<filter id="fbHeatF" x="-15%" y="-15%" width="130%" height="130%">' +
    '<feTurbulence id="fbTurb" type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="1" seed="4" result="n"/>' +
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
        '<div class="fb-bar" id="fb-bt"></div><div class="fb-bar" id="fb-bb"></div>' +
      '</div>' +
      '<div id="fb-iris"></div>' +
      '<div id="fb-rail"><i></i></div>';
    var tmp = document.createElement("div"); tmp.innerHTML = html;
    while (tmp.firstChild) { nodes.push(tmp.firstChild); document.body.appendChild(tmp.firstChild); }

    overlay = $("#fb-overlay"); scene = $("#fb-scene"); card = $("#fb-card"); stage = $("#fb-stage");
    wordEl = $("#fb-word"); textEl = $("#fb-text"); gridEl = $("#fb-grid"); heatEl = $("#fb-heat"); rail = $("#fb-rail i");
    shineEl = $("#fb-shine"); plateGlow = $("#fb-glowplate"); ringTxt = $("#fb-ringtxt"); bgEl = $("#fb-bg");
    irisEl = $("#fb-iris"); capEl = $("#fb-cap"); turb = $("#fbTurb"); disp = $("#fbDisp"); barsEl = [$("#fb-bt"), $("#fb-bb")];
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
  var lastCam = "", lastScn = "";
  function r2(v) { return Math.round(v * 100) / 100; }
  function applyCam() {                                      /* only touch the DOM when the transform actually changed (it is static for long stretches) */
    var sc = Math.round(cam.sc * (1 + punch.v) * 1000) / 1000;
    var cs = "rotateX(" + r2(cam.rx + tilt.rx) + "deg) rotateY(" + r2(tilt.ry) + "deg) rotateZ(" + r2(cam.rz) + "deg) scale3d(" + sc + "," + sc + "," + sc + ")";
    if (cs !== lastCam) { lastCam = cs; card.style.transform = cs; }
    var tx = fly.x, ty = fly.y;
    if (shk.v > 0.001) {                                     /* smooth shake: layered sine waves instead of a new random jump every frame */
      var tm = performance.now() / 1000, amp = .62 * shk.a * shk.v;
      tx += (Math.sin(tm * 47) + .6 * Math.sin(tm * 31 + 1.3)) * amp;
      ty += (Math.sin(tm * 43 + 2.1) + .6 * Math.sin(tm * 29 + .4)) * amp;
    }
    var ss = (tx || ty) ? "translate3d(" + r2(tx) + "px," + r2(ty) + "px,0)" : "";
    if (ss !== lastScn) { lastScn = ss; scene.style.transform = ss; }
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
      cvs.style.opacity = 1;                    /* fades in over the CSS background, so a late start never pops */
    } catch (err) { GL = null; console.warn("[fb] three.js setup failed, using CSS background", err); }
  }

  /* ===================== canvas particles (sparks + embers) ===================== */
  var cv, ctx, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function fxResize() { if (!cv) return; DPR = Math.min(window.devicePixelRatio || 1, curTier === 0 ? 2 : 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  window.addEventListener("resize", fxResize);
  var sprite = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 64; var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,244,214,1)"); gr.addColorStop(.22, "rgba(255,210,122,.95)"); gr.addColorStop(.55, "rgba(255,106,46,.5)"); gr.addColorStop(1, "rgba(255,77,46,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  })();
  function burst(x, y, o) {
    o = o || {};
    if (parts.length > (curTier === 0 ? 1500 : 700)) return;      /* never let a big burst choke the frame rate */
    var n = Math.max(1, Math.round((o.n || 20) * (curTier === 0 ? 1 : .6))), kind = o.kind || "spark", ang = o.angle == null ? -Math.PI / 2 : o.angle, spread = o.spread == null ? Math.PI * 2 : o.spread;
    for (var i = 0; i < n; i++) {
      var a = ang + (Math.random() - .5) * spread, sp = (o.speed || 6) * (.35 + Math.random() * .8);
      parts.push({ kind: kind, x: x, y: y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: o.g != null ? o.g : (kind === "spark" ? .22 : -.025), drag: kind === "spark" ? .965 : .985,
        life: 0, max: (o.life || 900) * (.6 + Math.random() * .7), size: (o.size || 2) * (.6 + Math.random() * .9), ph: Math.random() * 6.28 });
    }
  }
  function rectOf(el) { return el.getBoundingClientRect(); }
  function burstAt(el, nx, ny, o) { var r = rectOf(el); burst(r.left + r.width * nx, r.top + r.height * ny, o); }
  function ring(x, y, size, ms) {
    var d = document.createElement("div"); d.className = "fb-ring"; d.style.left = x + "px"; d.style.top = y + "px"; document.body.appendChild(d);
    anime({ targets: d, scale: [1, size], opacity: [.9, 0], duration: ms || 800, easing: "easeOutExpo", complete: function () { d.remove(); } });
  }
  /* a soft full-screen glow that fades out: used on the anvil hit, the flame ignition and the page opening */
  function flashAt(x, y, ms, a) {
    var d = document.createElement("div"); d.className = "fb-flash";
    d.style.background = "radial-gradient(circle at " + x + "px " + y + "px, rgba(255,214,150," + a + "), rgba(255,90,40," + (a * .35) + ") 28%, rgba(255,60,30,0) 62%)";
    document.body.appendChild(d);
    anime({ targets: d, opacity: [1, 0], duration: ms, easing: "easeOutQuad", complete: function () { d.remove(); } });
  }
  /* a hot glow around a logo piece that cools down by itself (Web Animations API: leaves no inline style behind) */
  function heatPulse(l, px, ms) {
    if (curTier !== 0) return;
    var inner = l.querySelector(".fb-in:not(.fb-ex)"); if (!inner || !inner.animate) return;
    try { inner.animate([{ filter: "drop-shadow(0 0 " + px + "px rgba(255,150,40,.95))" }, { filter: "drop-shadow(0 0 0px rgba(255,150,40,0))" }], { duration: ms, easing: "ease-out" }); } catch (e) {}
  }
  /* sunburst: soft light rays from the badge as the page opens (additive, so they only brighten the dark areas) */
  function drawRays() {
    if (rays.o < .01 || rays.len < .01) return;
    var R = Math.max(innerWidth, innerHeight) * rays.len, g = ctx.createRadialGradient(rays.x, rays.y, 0, rays.x, rays.y, R);
    g.addColorStop(0, "rgba(255,200,120,.5)"); g.addColorStop(.5, "rgba(255,120,50,.16)"); g.addColorStop(1, "rgba(255,77,46,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, rays.o); ctx.fillStyle = g;
    for (var i = 0; i < 14; i++) {
      var a = rays.a + i * Math.PI * 2 / 14, w = .07;
      ctx.beginPath(); ctx.moveTo(rays.x, rays.y);
      ctx.lineTo(rays.x + Math.cos(a - w) * R, rays.y + Math.sin(a - w) * R);
      ctx.lineTo(rays.x + Math.cos(a + w) * R, rays.y + Math.sin(a + w) * R);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  /* Draws and advances every spark / ember / pixel on the given 2D context (the forge overlay and the anvil strike each pass their own
     canvas). Optimised: sparks are grouped into 16 colour/brightness buckets and drawn with ONE stroke per bucket (instead of one per
     spark), finished particles are removed by swap-and-pop (no array splice), the drag factors are computed once per frame and the
     pixel squares are drawn in a single pass at the end (no blend-mode switching per particle). */
  var SBK = [], SBN = [], PXL = [], SPARK_RGB = ["rgb(255,246,220)", "rgb(255,196,96)", "rgb(255,106,46)", "rgb(190,48,26)"], SPARK_LW = [2.3, 1.9, 1.5, 1.1];
  for (var sbi = 0; sbi < 16; sbi++) { SBK.push([]); SBN.push(0); }
  function drawParts(c, now, dt) {
    c.clearRect(0, 0, innerWidth, innerHeight);
    if (!parts.length) return;
    var kSp = Math.pow(.965, dt), kEm = Math.pow(.985, dt), dms = dt * 16.67, i, b, bk;
    for (b = 0; b < 16; b++) SBN[b] = 0;
    PXL.length = 0;
    c.globalCompositeOperation = curTier === 0 ? "lighter" : "source-over";   /* overlapping sparks add up to a real glow */
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dms;
      if (p.life >= p.max) { var lastP = parts.pop(); if (i < parts.length) parts[i] = lastP; continue; }
      var t = p.life / p.max; p.px = p.x; p.py = p.y;
      var k = p.kind === "spark" ? kSp : kEm;
      if (p.kind === "ember") p.vx += Math.sin(now / 300 + p.ph) * .02 * dt;
      p.vx *= k; p.vy = p.vy * k + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var a = (1 - t) * (1 - t);
      if (p.kind === "spark") {                                     /* white-hot -> gold -> orange -> dull red as it cools */
        var al = Math.min(1, a * 1.4), ai = al >= .75 ? 3 : al >= .5 ? 2 : al >= .25 ? 1 : 0, ci = t < .18 ? 0 : t < .45 ? 1 : t < .75 ? 2 : 3, bi = ci * 4 + ai;
        bk = SBK[bi]; var n = SBN[bi]; bk[n] = p.px - p.vx * 1.5; bk[n + 1] = p.py - p.vy * 1.5; bk[n + 2] = p.x; bk[n + 3] = p.y; SBN[bi] = n + 4;
      } else if (p.kind === "pixel") {
        PXL.push(p, t);
      } else {
        var sz = p.size * 5 * (1 - t * .6) * (.8 + .2 * Math.sin(now / 90 + p.ph));
        c.globalAlpha = Math.min(1, a * 1.3); c.drawImage(sprite, p.x - sz, p.y - sz, sz * 2, sz * 2);
      }
    }
    c.lineCap = "round";
    for (b = 0; b < 16; b++) {
      var cnt = SBN[b]; if (!cnt) continue; bk = SBK[b];
      c.globalAlpha = ((b & 3) + 1) / 4; c.strokeStyle = SPARK_RGB[b >> 2]; c.lineWidth = SPARK_LW[b >> 2];
      c.beginPath();
      for (var j = 0; j < cnt; j += 4) { c.moveTo(bk[j], bk[j + 1]); c.lineTo(bk[j + 2], bk[j + 3]); }
      c.stroke();
    }
    if (PXL.length) {                                               /* the logo's drifting squares: snapped to a grid so they read as digital */
      c.globalCompositeOperation = "source-over";
      for (i = 0; i < PXL.length; i += 2) {
        var q = PXL[i], tq = PXL[i + 1], z = Math.max(2, Math.round(q.size * (1 - tq * .35))), dark = q.ph > 4.4, px = Math.round(q.x / z) * z, py = Math.round(q.y / z) * z;
        c.globalAlpha = Math.min(1, (1 - tq) * 1.7); c.fillStyle = dark ? "#0d0d0f" : q.ph > 2.4 ? "#ff6a1e" : "#ffc24a"; c.fillRect(px, py, z, z);
        if (dark) { c.strokeStyle = "#ff7a2e"; c.lineWidth = 1; c.strokeRect(px + .5, py + .5, z - 1, z - 1); }
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
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
      if (!em.o1) em.o1 = Object.assign({}, em.o, { n: 1 });          /* made once, not on every spawn */
      while (em.acc >= 1) { em.acc -= 1; burst(pt.x + (Math.random() - .5) * em.w, pt.y, em.o1); }
    }
    drawParts(ctx, now, dt);
    drawRays();
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
  function audioPrep() {                      /* creates the audio graph (the slow part: noise buffer, compressor, every sound) without playing anything */
    if (!CFG.SOUND) return false;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
      if (!AC) {
        AC = new Ctx(); NB = noiseBuffer(AC); MG = AC.createGain();
        var comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .2;
        MG.connect(comp); comp.connect(AC.destination); SFX = makeSfx(AC, MG, NB);
      }
      return true;
    } catch (e) { AC = null; SFX = null; return false; }
  }
  var audioT = 0;
  function audioOn() {
    if (!audioPrep()) return false;
    try {
      audioT = performance.now();
      if (AC.state === "suspended") AC.resume();
      MG.gain.cancelScheduledValues(0); MG.gain.setValueAtTime(Math.max(0, Math.min(1, CFG.VOLUME)), AC.currentTime);
      return true;
    } catch (e) { AC = null; SFX = null; return false; }
  }
  /* Browsers only let sound start after the visitor has pressed, tapped or typed something. Until then the audio context stays "suspended".
     This starts it on the first such gesture (and keeps listening until it really is running), so an intro that began silently gets its sound
     from that moment on. The audio graph itself is built in idle time, so no gesture does heavy work. */
  var sndChip = null;
  function onGesture() {
    try {
      if (AC) { if (AC.state === "suspended") AC.resume(); }
      else (window.requestIdleCallback || function (f) { return setTimeout(f, 200); })(function () { try { if (audioPrep() && AC.state === "suspended") AC.resume(); } catch (e) {} });
      if (AC && AC.state === "running") GESTURES.forEach(function (ev) { window.removeEventListener(ev, onGesture, true); });
    } catch (e) {}
  }
  var GESTURES = ["pointerdown", "keydown", "touchend"];
  GESTURES.forEach(function (ev) { window.addEventListener(ev, onGesture, { capture: true, passive: true }); });
  /* if the browser is still blocking sound shortly after the forge intro starts, say how to turn it on (it hides itself once the sound starts) */
  function soundHint() {
    if (!CFG.SOUND || !AC) return;
    setTimeout(function () {
      if (!running || !AC || AC.state === "running" || sndChip || !overlay) return;
      sndChip = document.createElement("div"); sndChip.id = "fb-snd"; sndChip.textContent = "Click anywhere for sound"; overlay.appendChild(sndChip);
      var h = function () { if (AC && AC.state === "running") { hideSndChip(); AC.removeEventListener("statechange", h); } };
      AC.addEventListener("statechange", h);
    }, 500);
  }
  function hideSndChip() { if (sndChip && sndChip.parentNode) sndChip.parentNode.removeChild(sndChip); sndChip = null; }
  function sx(name) {                         /* play a named sound right now, but only while the audio is really running: sounds fired while the browser still blocks audio would
                                                 otherwise pile up and all burst out together, late, the moment the visitor unlocks it */
    if (!AC || !SFX) return;
    if (AC.state !== "running" && !(AC.state === "suspended" && performance.now() - audioT < 350)) return;   /* (a context that was only just asked to start gets a short grace period) */
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
    curTier = tier; SEED = Math.random() * 1000; mir = Math.random() < .5 ? -1 : 1;   /* every run scatters the pieces differently and swings in from a random side */
    lastFocus = document.activeElement;
    root.classList.add("fb-run");
    fire("fb:start");
    startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.documentElement.style.scrollBehavior = "auto";
    fxResize(); applyGhost(); audioOn(); soundHint();
    cam.rx = 58; cam.rz = -32 * mir; cam.sc = .8; rays.o = 0; tilt.rx = tilt.ry = tilt.tx = tilt.ty = 0; sway.on = 0;
    fxs.speed = 0; fxs.glow = 0; fxs.flash = 0; fxs.ring = -1;
    card.style.opacity = 0; anime({ targets: card, opacity: [0, 1], duration: S(450), easing: "easeOutQuad" }); overlay.style.opacity = "";   /* the logo emerges from the dark instead of cutting in */ fly.x = fly.y = 0; setMask(null); irisEl.style.opacity = 0; capEl.style.opacity = 1; ringTxt.style.opacity = 0;
    gridEl.style.opacity = 1; wordEl.innerHTML = "&nbsp;"; textEl.innerHTML = "&nbsp;";
    overlay.classList.add("open"); overlay.setAttribute("aria-hidden", "false");
    try { overlay.tabIndex = -1; overlay.focus({ preventScroll: true }); } catch (e) {}
    lastT = 0; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(frame);
    clearTimeout(endTimer); endTimer = setTimeout(function () { if (running) { finish(); window.scrollTo(0, 0); } }, S(9000));

    var starts = [], t = INTRO;
    BEATS.forEach(function (b, i) { starts[i] = t; t += S(b.dur); });
    var F = starts[BEATS.length - 1], buildEnd = F;

    tl = anime.timeline({ autoplay: true, easing: "easeOutExpo" });
    tl.add({ targets: barsEl, scaleY: [0, 1], duration: S(520), easing: "easeOutCubic" }, 0);      /* cinematic letterbox bars slide in... */
    function at(ms, fn) { tl.add({ targets: { v: 0 }, v: 1, duration: 1, easing: "linear", begin: fn }, ms); }

    tl.add({ targets: cam, rx: [58, 7], rz: [-32 * mir, 0], sc: [.8, 1], duration: buildEnd - 100, easing: "easeInOutSine" }, 0);
    tl.add({ targets: scr, p: [0, 1], duration: buildEnd - INTRO, easing: "easeInOutQuad",
      update: function () { if (startY > 0) window.scrollTo(0, startY * (1 - scr.p)); rail.style.transform = "scaleY(" + r2(scr.p * 1000) / 1000 + ")"; } }, INTRO);
    tl.add({ targets: gridEl, opacity: [1, 0], duration: buildEnd - INTRO, easing: "linear" }, INTRO);
    /* background: speed lines rush down while we climb, ease to rest on arrival */
    tl.add({ targets: fxs, speed: [0, 1], duration: S(500), easing: "easeOutQuad" }, 0);
    tl.add({ targets: fxs, speed: [1, 0], duration: S(520), easing: "easeOutCubic" }, F - S(160));
    tl.add({ targets: shineEl, translateX: ["-80%", "80%"], duration: buildEnd, easing: "easeInOutSine" }, 0);

    BEATS.forEach(function (b, i) { at(starts[i], function () { caption(b); }); });
    sx('rise', Math.max(.5, (F - 120) / 1000));
    /* NEW: embers drift up from the bottom edge for the whole build, and a first burst of sparks marks the start of the climb */
    floorEm = { rate: curTier === 0 ? 24 : 12, acc: 0, w: innerWidth * .9, o: { kind: "ember", speed: 2.8, angle: -Math.PI / 2, spread: .6, size: 1.7, life: 3200 },
      at: function () { return { x: innerWidth / 2, y: innerHeight * 1.01 }; } };
    emitters.push(floorEm);
    at(60, function () { burst(innerWidth / 2, innerHeight * .96, { n: 30, speed: 10, angle: -Math.PI / 2, spread: .9, size: 2, life: 1100 }); });
    at(F + S(300), function () { if (floorEm) floorEm.rate = 0; });

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
    fo.forEach(function (l, i) { at(starts[2] + S(330 + i * 48), function () { burstAt(l, .5, .95, { n: 6, speed: 5, spread: Math.PI * .9, size: 1.7, life: 600 }); heatPulse(l, 14, 650); }); });
    at(starts[2] + S(640), function () { shake(3, 200); });
    for (var fi2 = 0; fi2 < 7; fi2++) (function (i) { at(starts[2] + S(330 + i * 48), function () { sx('clack', i + 2); }); })(fi2);
    at(starts[3], function () { anime({ targets: ringTxt, opacity: [0, 1], duration: S(500), easing: "easeOutQuad" }); });
    /* beat 3: AI */
    tl.add(landAnim(layersOf(6), { duration: 520, delay: anime.stagger(S(90)), easing: "easeOutExpo" }), starts[3]);
    at(starts[3] + S(260), function () { sx('stamp'); layersOf(6).forEach(function (l) { burstAt(l, .5, .5, { n: 14, speed: 6, size: 2, life: 650 }); heatPulse(l, 24, 850); }); shake(4, 220); pop(.012, 400); });
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
      /* NEW: camera recoil (eases back by itself), a flash, a slower second shockwave and streaks racing along the anvil */
      tilt.rx += 5; tilt.ry += (Math.random() - .5) * 4;
      flashAt(x, y, S(420), .55);
      setTimeout(function () { if (running) ring(x, y, 54, 1100); }, S(110));
      burst(x, y + r.height * .3, { n: 16, speed: 9, angle: 0, spread: .3, g: .02, size: 1.5, life: 700 });
      burst(x, y + r.height * .3, { n: 16, speed: 9, angle: Math.PI, spread: .3, g: .02, size: 1.5, life: 700 });
    });
    /* beat 5: flame ignites */
    var fl = layersOf(8);
    tl.add(landAnim(fl, { duration: 700, easing: "easeOutElastic(1,.6)" }), starts[5] + S(60));
    at(starts[5] + S(40), function () {
      sx('ignite'); flashAt(innerWidth / 2, innerHeight * .46, S(520), .3); tilt.rx -= 2;
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
        update: function () { var nw = performance.now(); if (nw - (h.t || 0) < 62) return; h.t = nw; turb.setAttribute("baseFrequency", "0.012 " + h.f.toFixed(3)); disp.setAttribute("scale", h.s.toFixed(1)); } }));
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
        if (i === 0 || i === 2) sx('slam', false); shake(7, 260); pop(.018, 400); heatPulse(l, 18, 360); tilt.rx += 1.2;
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
    anime({ targets: barsEl, scaleY: 0, duration: S(420), easing: "easeInOutCubic" });   /* ...and away as the logo flies to the badge */
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
    /* NEW: a glow and a sunburst of light rays from the badge as the circle opens */
    flashAt(T.cx, T.cy, S(520), .3);
    rays.x = T.cx; rays.y = T.cy;
    anime({ targets: rays, len: [.12, .9], a: [0, .5], duration: S(700), easing: "easeOutCubic",
      o: [{ value: .9, duration: S(180), easing: "easeOutQuad" }, { value: 0, duration: S(520), easing: "easeInQuad" }] });
    document.documentElement.classList.add("fb-arrived");
    try { window.dispatchEvent(new CustomEvent("fb:arrived")); } catch (e) {}
    if (CFG.REVEAL_SELECTOR) {
      var els = $$(CFG.REVEAL_SELECTOR);
      if (els.length) anime({ targets: els, opacity: [0, 1], translateY: [24, 0], delay: anime.stagger(Math.min(45, 900 / els.length), { start: S(250) }), duration: S(650), easing: "easeOutCubic" });
    }
    tween(S(620), [.55, .05, .85, .45], function (v) {
      var r = lerp(R0, R1, v); setMask(T, r);
      irisEl.style.opacity = Math.max(0, 1 - v * 1.05) * .95; irisEl.style.transform = "translate3d(" + (T.cx - 256) + "px," + (T.cy - 256) + "px,0) scale(" + (r / 256).toFixed(4) + ")";
      card.style.opacity = Math.max(0, 1 - v * 3);
    }, function () { finish(); });
  }

  function resetAll() {
    loops.forEach(function (a) { try { a.pause(); } catch (e) {} }); loops = []; emitters = []; parts = [];
    stepLayers.forEach(function (l) { $$(".fb-in", l).forEach(function (f) { f.style.filter = ""; f.style.transform = ""; try { f.getAnimations && f.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {} }); });
    var fi = flameEl && $(".fb-in", flameEl); if (fi) fi.style.filter = "";
    try { anime.remove(layers); anime.remove([cam, shk, punch, scr, fxs, rays, card, heatEl, glowEl, gridEl, plateGlow, shineEl, ringTxt, capEl].concat(barsEl)); } catch (e) {}
    hideSndChip(); rail.style.transform = "scaleY(0)"; barsEl.forEach(function (b) { b.style.transform = ""; }); sway.on = 0; shk.v = 0; punch.v = 0; rays.o = 0; floorEm = null;
    $$(".fb-ring, .fb-flash").forEach(function (r) { if (r.parentNode) r.parentNode.removeChild(r); });   /* shockwave rings never outlive the animation */
  }
  function finish() {
    if (!running) return;
    audioOff(); hideSndChip();
    try { tl && tl.pause(); } catch (e) {}
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = "";
    overlay.classList.remove("open"); overlay.setAttribute("aria-hidden", "true");
    cancelAnimationFrame(rafId); resetAll(); ctx.clearRect(0, 0, innerWidth, innerHeight);
    overlay.style.opacity = ""; card.style.opacity = ""; scene.style.transform = ""; lastScn = ""; lastCam = ""; fly.x = fly.y = 0; setMask(null); irisEl.style.opacity = 0; irisEl.style.transform = ""; capEl.style.opacity = 1;
    setTimeout(function () { document.documentElement.classList.remove("fb-arrived"); }, 1500);
    running = false;
    root.classList.remove("fb-run");
    fire("fb:end");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && running) finish(); });

  /* =====================================================================
     ANVIL STRIKE  (the back-to-top animation, about 2.8 s)
     A short cinematic built from the logo itself: the anvil slams down, the logo's FLAME erupts out of it with molten
     droplets and the logo's drifting PIXEL squares, a wall of LAVA with flame-tongue edges climbs the whole screen, the page
     jumps to the top while the lava fully covers it, then the lava drains out through the top and the hero flies back in.

     Camera: letterbox bars, a slow push-in with a small roll that levels out, a faint handheld drift, a short hit-stop on impact,
     a kick (shake + zoom punch), then the camera cranes up with the lava while speed streaks rush past. Sound: synthesized with the
     forge intro's own sounds (no files).

     SMOOTHNESS / SPEED (what makes it cheap):
       - The lava is NOT painted every frame: its body (gradient, hot spots, crust, cracks) is baked once into a texture while the
         browser is idle, and each frame only clips that texture to the animated flame-tongue edge (one drawImage; when the lava
         covers the whole screen, a plain drawImage with no path at all). The tongue heights are computed once per frame.
       - Every DOM write goes through put(), which skips the write when the value did not change.
       - Sparks are drawn in 16 batched strokes, pixels in one pass (see drawParts).
       - Heavy sound / flash / ring work is spread over two frames so the impact frame itself has no hitch.
       - Automatic quality fallback: if the frame time stays high it lowers the lava resolution and drops the extras (LOD).
         Add ?nolod to the URL to switch the fallback off (for testing).

     Reuses this file's sx() sounds, burst(), ring(), flashAt(), shake() and pop(). It draws on its own canvases inside its own
     overlay (#fbs), which is removed when it ends, so it never touches the forge intro's overlay.
     Public API: AIForge.strike({ tier }) -> true if it is playing, false if the caller should use something else.
                 AIForge.warm(tier)       -> preloads anime.js + the images and bakes the lava texture (main.js calls it when the arrow appears)
     Events on window: fb:start, fb:arrived (= the page just jumped to the top: main.js re-flies the hero particles), fb:end
     Tune the timing in STRIKE (ms), the lava height / flame size in strike() ("LAVA" and "FLAME" comments).
     ===================================================================== */
  var STRIKE = {                   /* the whole animation is about 4.6 s (it used to be 2.8 s). To change the pace, edit these (ms): */
    DIM: 400,        // screen fades to black (letterbox bars slide in)
    DROP: 550,       // the anvil starts to fall while the camera slowly pushes in: a beat of dark anticipation first
    HIT: 1800,       // impact: flash, clang, sparks, flame + droplets + pixels (the fall takes HIT - DROP = 1.25 s)
    STOP: 110,       // hit-stop: the picture freezes this long on impact, then the kick (shake + zoom punch)
    LAVA0: 2500,     // the lava starts to climb (0.7 s after the impact, so the anvil's fire can burn first)
    LAVA1: 4100,     // the lava has left through the top of the screen (the climb takes LAVA1 - LAVA0 = 1.6 s)
    END: 4600,       // overlay gone (bars slide out before this; the hero particles fly in during the last stretch)
    SAFETY: 8500     // hard stop, whatever happens
  };
  var striking = false, animeP = null, anvilImg = null, flameImg = null, crustTile = null, lavaTex = null, lavaKey = "", warmT = 0;
  function strikeReady() { return !!(window.anime && window.Promise); }
  /* writes a style property only when the value changed (the DOM is the slow part, not the maths) */
  function put(node, k, v) { var c = node._c || (node._c = {}); if (c[k] === v) return; c[k] = v; node.style[k] = v; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease3(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function ease2(x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  /* LAVA geometry: LA = how far the flame tongues reach above the edge, LB = how tall the molten wall is (more than the screen, so it
     fully covers it for a moment), TOT = height of the baked texture, TRAVEL = how far the wall's top edge moves in total */
  function lavaGeom() { var H = innerHeight, LA = Math.min(140, H * .18), LB = H * 1.6 + 2 * LA; return { LA: LA, LB: LB, TOT: LB + LA * 1.6, TRAVEL: H + 2 * LA + LB + 20 }; }
  function texScale(tier) { return tier === 0 ? .75 : tier === 1 ? .5 : .4; }

  /* the cooled crust + glowing cracks (one small tile, drawn small and scaled x2 so its edges are soft) */
  function makeCrust() {
    var T = 256, c = document.createElement("canvas"); c.width = c.height = T; var g = c.getContext("2d");
    function blob(x, y, r, a) {
      var n = 14, pts = [], i;
      for (i = 0; i < n; i++) { var an = i / n * 6.283, rr = r * (.65 + Math.random() * .6); pts.push([Math.cos(an) * rr, Math.sin(an) * rr]); }
      [-T, 0, T].forEach(function (dx) { [-T, 0, T].forEach(function (dy) {      /* wrapped copies: the tile repeats without seams */
        g.beginPath(); pts.forEach(function (q, k) { k ? g.lineTo(x + dx + q[0], y + dy + q[1]) : g.moveTo(x + dx + q[0], y + dy + q[1]); }); g.closePath();
        g.fillStyle = "rgba(24,5,2," + a + ")"; g.fill();
      }); });
    }
    for (var i = 0; i < 24; i++) blob(Math.random() * T, Math.random() * T, 10 + Math.random() * 31, .4 + Math.random() * .35);
    g.strokeStyle = "rgba(255,176,64,.5)"; g.lineWidth = 1; g.lineCap = "round";
    for (i = 0; i < 16; i++) {
      var x = 10 + Math.random() * (T - 20), y = 10 + Math.random() * (T - 20); g.beginPath(); g.moveTo(x, y);
      for (var k = 0; k < 3; k++) { x += (Math.random() - .5) * 30; y += (Math.random() - .5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    var big = document.createElement("canvas"); big.width = big.height = T * 2; var bg = big.getContext("2d"); bg.imageSmoothingEnabled = true; bg.drawImage(c, 0, 0, T * 2, T * 2);
    return big;
  }
  /* bakes the lava body once per screen size / tier: vertical heat gradient, glowing hot spots, crust and cracks */
  function buildLavaTex(tier) {
    var key = innerWidth + "x" + innerHeight + ":" + tier;
    if (lavaTex && lavaKey === key) return lavaTex;
    var G = lavaGeom(), sc = texScale(tier), W = innerWidth, LA = G.LA, LB = G.LB, tot = G.TOT, c = document.createElement("canvas");
    c.width = Math.ceil(W * sc); c.height = Math.ceil(tot * sc);
    var g = c.getContext("2d"); g.scale(sc, sc);
    var gr = g.createLinearGradient(0, 0, 0, tot);
    gr.addColorStop(0, "#ffe7a8"); gr.addColorStop(LA / tot, "#ffa22e"); gr.addColorStop((LA + 70) / tot, "#ff5f1a");
    gr.addColorStop((LA + 320) / tot, "#d9360d"); gr.addColorStop((LA + LB * .55) / tot, "#9a1c08"); gr.addColorStop((LA + LB - 40) / tot, "#5c1004"); gr.addColorStop(1, "#2a0702");
    g.fillStyle = gr; g.fillRect(0, 0, W, tot);
    g.globalCompositeOperation = "lighter";                              /* molten hot spots */
    for (var i = 0; i < 14; i++) {
      var x = Math.random() * W, y = LA + Math.random() * LB * .7, r = 70 + Math.random() * 150, rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(255,160,60,.22)"); rg.addColorStop(1, "rgba(255,90,20,0)"); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = "source-over";
    crustTile = crustTile || makeCrust();
    g.globalAlpha = .42; g.fillStyle = g.createPattern(crustTile, "repeat"); g.fillRect(0, 0, W, tot); g.globalAlpha = 1;
    lavaTex = c; lavaKey = key;
    return c;
  }
  function warm(tier) {
    try {
      if (!anvilImg) { anvilImg = new Image(); anvilImg.decoding = "async"; anvilImg.src = CFG.ANVIL_URL; if (anvilImg.decode) anvilImg.decode().catch(function () {}); }
      if (!flameImg) { flameImg = new Image(); flameImg.decoding = "async"; flameImg.src = CFG.FLAME_URL; if (flameImg.decode) flameImg.decode().catch(function () {}); }
    } catch (e) {}
    if (!window.anime && !animeP) animeP = loadScript(CFG.ANIME_URL).catch(function (e) { animeP = null; console.warn("[strike] anime.js not loaded", e); });
    var tr = tier == null ? 0 : tier;
    if (lavaKey !== innerWidth + "x" + innerHeight + ":" + tr && !warmT) {   /* idle time, so the tap itself stays instant */
      var job = function () { warmT = 0; try { buildLavaTex(tr); } catch (e) {} };
      warmT = window.requestIdleCallback ? requestIdleCallback(job, { timeout: 2500 }) : setTimeout(job, 500);
    }
  }

  var fireSpCache = null;
  function fireSprites() {                                       /* three soft sprites: white-yellow core, orange body, dull red tip */
    if (fireSpCache) return fireSpCache;
    var defs = [["255,250,222,1", "255,205,100,.6", "255,150,40,0"], ["255,176,64,1", "255,106,24,.5", "255,70,10,0"], ["214,62,22,.9", "130,24,8,.4", "90,10,4,0"]];
    fireSpCache = defs.map(function (d) {
      var c = document.createElement("canvas"); c.width = c.height = 64; var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(" + d[0] + ")"); gr.addColorStop(.45, "rgba(" + d[1] + ")"); gr.addColorStop(1, "rgba(" + d[2] + ")"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
    });
    return fireSpCache;
  }
  function strike(opts) {
    opts = opts || {};
    if (striking || running) return true;                       /* one animation at a time: a second tap does nothing */
    if (reduceMotion() || !strikeReady()) { if (!strikeReady()) warm(opts.tier); return false; }
    striking = true;
    curTier = opts.tier || 0;
    var T0 = performance.now(), last = 0, raf = 0, safety = 0, done = false, jumped = false, hit = false, kicked = false, ring2 = false, skipAt = 0, emAcc = 0, pxAcc = 0;
    var snd = { drop: false, hit: false, lava: false }, lavaOn = false, lod = 0, ft = 16.7, nextLod = 0, noLod = /nolod/.test(location.search);
    var focusBefore = document.activeElement;
    var dpr = Math.min(window.devicePixelRatio || 1, curTier === 0 ? 2 : 1);

    var el = document.createElement("div");
    el.id = "fbs"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Back to top");
    el.innerHTML =
      '<div id="fbs-scene"><div id="fbs-shake"><div id="fbs-bg"></div><div id="fbs-hot"></div>' +
      '<img id="fbs-anvil" alt="" draggable="false" src="' + CFG.ANVIL_URL + '">' +
      '<img id="fbs-flame" alt="" draggable="false" src="' + CFG.FLAME_URL + '"><canvas id="fbs-fire"></canvas></div></div>' +
      '<canvas id="fbs-lava"></canvas><canvas id="fbs-fx"></canvas>' +
      '<div id="fbs-streak"></div><div id="fbs-white"></div><div id="fbs-vig"></div>' +
      '<div class="fbs-bar" id="fbs-bt"></div><div class="fbs-bar" id="fbs-bb"></div>';
    document.body.appendChild(el);
    function q(id) { return el.querySelector(id); }
    var sceneEl = q("#fbs-scene"), shakeEl = q("#fbs-shake"), hotEl = q("#fbs-hot"), anvilEl = q("#fbs-anvil"), flameEl2 = q("#fbs-flame"),
        streakEl = q("#fbs-streak"), whiteEl = q("#fbs-white"), vigEl = q("#fbs-vig"), barT = q("#fbs-bt"), barB = q("#fbs-bb"),
        cvs = q("#fbs-fx"), c2 = cvs.getContext("2d"), lvs = q("#fbs-lava"), lc = lvs.getContext("2d");
    put(sceneEl, "opacity", "0");
    var fancy = curTier === 0;                                  /* the 3D camera tilt and the vignette are for the strongest tier: they force per-frame resampling of big layers on weak GPUs */
    if (!fancy) vigEl.style.display = "none";

    /* LAVA: baked texture + the animated edge (arrays reused every frame) */
    var LG = lavaGeom(), LA = LG.LA, LB = LG.LB, TOT = LG.TOT, TRAVEL = LG.TRAVEL, tex = buildLavaTex(curTier);
    var step = curTier === 0 ? 10 : curTier === 1 ? 16 : 24, NMAX = Math.ceil((4200 + 2 * step) / step) + 2, TG = new Float32Array(NMAX), TR = new Float32Array(NMAX);
    var lvCs = texScale(curTier);                                /* the lava canvas is soft, so it never needs retina resolution */
    function size() {
      cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      lvs.width = Math.ceil(innerWidth * lvCs); lvs.height = Math.ceil(innerHeight * lvCs);
    }
    size();

    /* where things sit: anvil centre at 54% of the height, width min(78vw, 560px). "hitY" = where the strike lands once the camera has pushed in (x1.12) */
    var G = (function () {
      var aw = Math.min(innerWidth * .78, 560), ah = aw * 170 / 572, cy = innerHeight * .54, top = cy - ah / 2 + ah * .1;
      return { cx: innerWidth / 2, cy: cy, aw: aw, ah: ah, top0: top, hitY: cy + (top - cy) * 1.12 };
    })();
    /* FLAME: the logo's flame, anchored on the anvil, grows and rises */
    var FW = Math.min(innerWidth * .3, 270), FH = FW * 468 / 466;
    flameEl2.style.width = FW + "px"; flameEl2.style.left = (G.cx - FW / 2) + "px"; flameEl2.style.top = (G.top0 - .88 * FH) + "px";   /* its glowing base plate sits ON the anvil's top face */
    /* FIRE: continuous flame tongues, embers and the logo's pixel squares rise out of the anvil's top for as long as the anvil is on screen.
       They live in a canvas INSIDE the camera group, so they can never separate from the anvil, whatever the camera does. */
    var fcv = q("#fbs-fire"), fc = fcv.getContext("2d"), fireW = Math.min(innerWidth, Math.round(G.aw * 1.3)), fireH = Math.min(Math.round(innerHeight * .72), 620), fdpr = Math.min(dpr, 1.5);
    fcv.width = Math.round(fireW * fdpr); fcv.height = Math.round(fireH * fdpr); fc.setTransform(fdpr, 0, 0, fdpr, 0, 0);
    fcv.style.width = fireW + "px"; fcv.style.height = fireH + "px"; fcv.style.left = (G.cx - fireW / 2) + "px"; fcv.style.top = (G.top0 + 24 - fireH) + "px";
    var FX0 = fireW / 2, FY0 = fireH - 24, FP = [], PXF = [], fireSp = fireSprites(), fAcc = 0, eAcc = 0, pAcc = 0;
    function emitFire(k, age) {
      var span = G.aw * .36, rx = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * span, c = 1 - Math.abs(rx) / span * .45;   /* denser and taller in the middle */
      if (k === 0) FP.push({ k: 0, x: FX0 + rx, y: FY0 + Math.random() * 6, vx: (Math.random() - .5) * .45 - rx * .0035, vy: -(1.9 + Math.random() * 2.1) * c, l: age || 0, m: 680 + Math.random() * 620, s: 15 + Math.random() * 25, ph: Math.random() * 6.28 });
      else if (k === 1) FP.push({ k: 1, x: FX0 + rx * 1.15, y: FY0, vx: (Math.random() - .5) * 1.1, vy: -(1.1 + Math.random() * 1.6), l: age || 0, m: 1500 + Math.random() * 1100, s: 2 + Math.random() * 3, ph: Math.random() * 6.28 });
      else FP.push({ k: 2, x: FX0 + rx * .8, y: FY0 - 10, vx: (Math.random() - .5) * .7, vy: -(1.2 + Math.random() * 1.8), l: age || 0, m: 1200 + Math.random() * 800, s: 6 + Math.random() * 7, ph: Math.random() * 6.28 });
    }
    function drawFire(now, dt) {
      fc.clearRect(0, 0, fireW, fireH);
      if (!FP.length) return;
      var dms = dt * 16.67, i; PXF.length = 0; fc.globalCompositeOperation = "lighter";
      for (i = FP.length - 1; i >= 0; i--) {
        var p = FP[i]; p.l += dms;
        if (p.l >= p.m) { var lp = FP.pop(); if (i < FP.length) FP[i] = lp; continue; }
        var t = p.l / p.m;
        p.x += (p.vx + Math.sin(now / (150 + p.ph * 14) + p.ph) * (p.k === 0 ? .42 : .25)) * dt; p.y += p.vy * dt;
        if (p.k === 0) p.vy *= Math.pow(.992, dt);
        if (p.k === 2) { PXF.push(p, t); continue; }
        var a = t < .14 ? t / .14 : (1 - t) / .86;
        if (p.k === 0) {                                     /* a flame tongue: tall soft blob, white-yellow at the base, orange, then dull red at the tip */
          var w = p.s * (1 - .5 * t), h = w * (1.55 + .5 * t);
          fc.globalAlpha = a * .95; fc.drawImage(fireSp[t < .22 ? 0 : t < .58 ? 1 : 2], p.x - w, p.y - h * 1.1, w * 2, h * 2);
        } else {                                             /* an ember: a tiny bright dot that twinkles as it rises */
          var e = p.s * 2.2; fc.globalAlpha = a * .95 * (.65 + .35 * Math.sin(now / 70 + p.ph)); fc.drawImage(fireSp[0], p.x - e, p.y - e, e * 2, e * 2);
        }
      }
      if (PXF.length) {                                      /* the logo's pixel squares, streaming off the flame */
        fc.globalCompositeOperation = "source-over";
        for (i = 0; i < PXF.length; i += 2) {
          var pq = PXF[i], tq = PXF[i + 1], z = Math.max(2, Math.round(pq.s * (1 - tq * .3))), dark = pq.ph > 4.4, qx = Math.round(pq.x / z) * z, qy = Math.round(pq.y / z) * z;
          fc.globalAlpha = Math.min(1, (1 - tq) * 1.8); fc.fillStyle = dark ? "#0d0d0f" : pq.ph > 2.4 ? "#ff6a1e" : "#ffc24a"; fc.fillRect(qx, qy, z, z);
          if (dark) { fc.strokeStyle = "#ff7a2e"; fc.lineWidth = 1; fc.strokeRect(qx + .5, qy + .5, z - 1, z - 1); }
        }
      }
      fc.globalAlpha = 1; fc.globalCompositeOperation = "source-over";
    }
    /* speed streaks that rush down the screen while the camera cranes up */
    var NS = 18, SX = [], SY = [], SL = [], SV = [];
    for (var si = 0; si < NS; si++) { SX.push(Math.random() * innerWidth); SY.push(Math.random() * innerHeight * 1.3); SL.push(70 + Math.random() * 150); SV.push(2400 + Math.random() * 2400); }

    root.classList.add("fb-run");
    root.style.overflow = "hidden";                             /* nothing scrolls behind it */
    fire("fb:start");
    var blockScroll = function (e) { e.preventDefault(); };
    el.addEventListener("wheel", blockScroll, { passive: false });
    el.addEventListener("touchmove", blockScroll, { passive: false });
    audioOn();                                                  /* this runs inside the tap, so browsers allow the sound */
    el.tabIndex = -1; try { el.focus({ preventScroll: true }); } catch (e) {}   /* focus stays inside the overlay (it has no buttons); Esc still ends it */

    function jump() {                                           /* the hidden scroll jump */
      if (jumped) return; jumped = true;
      window.scrollTo(0, 0);
      fire("fb:arrived");                                       /* main.js: hero particles fly in again, smoothed scroll snaps to 0 */
    }
    function impact() {                                         /* visuals (the sound was started a few ms earlier, see tick) */
      hit = true;
      var x = G.cx, y = G.hitY;
      flashAt(x, y, 1100, .95);
      ring(x, y, 24, 1300);
      burst(x, y, { n: 90, speed: 15, angle: -Math.PI / 2, spread: Math.PI * 1.25, size: 2.4, life: 1700 });          /* sparks */
      burst(x, y, { n: 40, speed: 8, spread: Math.PI * 2, size: 2, life: 1050 });
      burst(x - G.aw * .3, y, { n: 16, speed: 9, angle: -Math.PI / 2 - .5, spread: 1, size: 2, life: 1200 });
      burst(x + G.aw * .3, y, { n: 16, speed: 9, angle: -Math.PI / 2 + .5, spread: 1, size: 2, life: 1200 });
      burst(x, y, { kind: "ember", n: 30, speed: 13, angle: -Math.PI / 2, spread: 1.5, size: 2.8, life: 2100, g: .2 });   /* molten droplets that arc and fall */
      burst(x, y, { kind: "pixel", n: 40, speed: 10, angle: -Math.PI / 2, spread: 1.7, size: 9, life: 2200 });           /* the logo's squares */
      var fi; for (fi = 0; fi < 36; fi++) emitFire(0, Math.random() * 300); for (fi = 0; fi < 8; fi++) emitFire(1, Math.random() * 400); for (fi = 0; fi < 6; fi++) emitFire(2, Math.random() * 300);   /* the anvil catches fire */
    }
    function kick() { kicked = true; shake(30, 850); pop(.06, 1000); }
    function setLod(l) {                                        /* automatic quality fallback: fewer pixels, fewer extras */
      lod = l; lvCs = Math.max(.3, texScale(curTier) * (l >= 2 ? .5 : .7)); size();
    }
    function cleanup() {
      cancelAnimationFrame(raf); clearTimeout(safety);
      document.removeEventListener("keydown", onKey); window.removeEventListener("resize", size);
      try { anime.remove([shk, punch]); } catch (e) {}
      shk.v = 0; punch.v = 0; parts = [];
      $$(".fb-ring, .fb-flash").forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      if (el.parentNode) el.parentNode.removeChild(el);
      root.style.overflow = ""; root.classList.remove("fb-run");
      striking = false;
    }
    function finish() {
      if (done) return; done = true;
      if (!jumped) jump();                                      /* whatever happens, the visitor ends up at the top */
      cleanup();
      fire("fb:end");
      try { if (focusBefore && focusBefore.focus) focusBefore.focus({ preventScroll: true }); } catch (e) {}
      if (opts.onEnd) opts.onEnd();
    }
    function skip() {                                           /* Skip button / Esc: jump now, fade out quickly */
      if (done || skipAt) return;
      jump(); skipAt = performance.now(); audioOff();
    }
    function onKey(e) { if (e.key === "Escape") skip(); }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", size);
    safety = setTimeout(function () { audioOff(); finish(); }, STRIKE.SAFETY);   /* nobody gets stuck */

    /* ---- the lava: a molten wall whose top edge is made of flame tongues; its dripping bottom edge lets the page through ---- */
    function tongue(x, t) {
      var s = Math.sin(x * .013 + t * .004) * .5 + Math.sin(x * .031 - t * .0057) * .35 + Math.sin(x * .0057 + t * .0023) * .6
            + .35 * (1 - Math.abs(Math.sin(x * .042 + t * .008)));      /* 1-|sin| has pointed tops: flame tips */
      return Math.pow((s + 1.45) / 3.2, 2.6) * LA;
    }
    function drip(x, t) { return Math.pow(Math.max(0, Math.sin(x * .021 + t * .0016) * Math.sin(x * .0073 - t * .0011)), 2) * LA * .6; }
    function drawLava(yL, now) {
      var W = innerWidth, H = innerHeight, i, x, n = Math.ceil((W + 2 * step) / step) + 1, top = yL - LA, sf = tex.height / TOT;
      lc.setTransform(lvCs, 0, 0, lvCs, 0, 0); lc.globalCompositeOperation = "source-over"; lc.globalAlpha = 1; lc.clearRect(0, 0, W, H);
      var y0 = Math.max(0, -top), y1 = Math.min(TOT, H - top);
      if (y1 <= y0) return;                                     /* the wall is not on screen */
      if (yL <= 0 && yL + LB >= H) {                            /* covers the whole screen: no edge to draw, just the texture */
        lc.drawImage(tex, 0, y0 * sf, tex.width, (y1 - y0) * sf, 0, top + y0, W, y1 - y0); return;
      }
      for (i = 0; i < n; i++) { x = -step + i * step; TG[i] = tongue(x, now); TR[i] = drip(x, now); }   /* once per frame, reused by the clip path and the rims */
      lc.save(); lc.beginPath();
      for (i = 0; i < n; i++) { x = -step + i * step; i ? lc.lineTo(x, yL - TG[i]) : lc.moveTo(x, yL - TG[i]); }
      for (i = n - 1; i >= 0; i--) lc.lineTo(-step + i * step, yL + LB + TR[i]);
      lc.closePath(); lc.clip();
      lc.drawImage(tex, 0, y0 * sf, tex.width, (y1 - y0) * sf, 0, top + y0, W, y1 - y0);
      lc.restore();
      lc.globalCompositeOperation = "destination-over";         /* light the lava throws, drawn BEHIND it: ahead of the wall, and onto the page it uncovers */
      if (lod < 2) {
        var gl = lc.createLinearGradient(0, yL - LA - 300, 0, yL); gl.addColorStop(0, "rgba(255,90,30,0)"); gl.addColorStop(1, "rgba(255,120,40,.38)");
        lc.fillStyle = gl; lc.fillRect(0, yL - LA - 300, W, 300 + LA);
        var yT = yL + LB;
        if (yT < H + 10) { var gt = lc.createLinearGradient(0, yT, 0, yT + 300); gt.addColorStop(0, "rgba(255,110,40,.4)"); gt.addColorStop(1, "rgba(255,70,20,0)"); lc.fillStyle = gt; lc.fillRect(0, yT, W, 300); }
      }
      lc.globalCompositeOperation = "lighter"; lc.lineJoin = "round";
      lc.beginPath(); for (i = 0; i < n; i++) { x = -step + i * step; i ? lc.lineTo(x, yL - TG[i]) : lc.moveTo(x, yL - TG[i]); }
      if (curTier === 0 && lod === 0) { lc.strokeStyle = "rgba(255,120,40,.2)"; lc.lineWidth = 14; lc.stroke(); }
      lc.strokeStyle = "rgba(255,190,90,.5)"; lc.lineWidth = 5; lc.stroke(); lc.strokeStyle = "rgba(255,246,214,.9)"; lc.lineWidth = 2; lc.stroke();
      lc.beginPath(); for (i = 0; i < n; i++) { x = -step + i * step; i ? lc.lineTo(x, yL + LB + TR[i]) : lc.moveTo(x, yL + LB + TR[i]); }
      lc.strokeStyle = "rgba(255,150,60,.7)"; lc.lineWidth = 3; lc.stroke();
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      var fdt = now - (last || now), dt = Math.min(40, fdt) / 16.67; last = now;
      var t = now - T0, H = innerHeight, W = innerWidth;
      ft += (Math.min(100, fdt) - ft) * .1;
      if (skipAt) {                                             /* skipped: quick fade, then done */
        var k = clamp01((now - skipAt) / 220);
        put(el, "opacity", (1 - k).toFixed(2));
        if (k >= 1) finish();
        return;
      }
      /* automatic quality fallback: judged only while the heavy part runs, never in the first frames */
      if (!noLod && t > STRIKE.HIT + 250 && now > nextLod) { nextLod = now + 300; if (ft > 38 && lod < 2) setLod(2); else if (ft > 25 && lod < 1) setLod(1); }

      /* the camera clock freezes during the hit-stop */
      var tc = t < STRIKE.HIT ? t : t < STRIKE.HIT + STRIKE.STOP ? STRIKE.HIT : t - STRIKE.STOP;
      if (!snd.hit && t >= STRIKE.HIT - 25) { snd.hit = true; sx("slam", true); sx("land"); }       /* the sound goes first (audio has a little latency), so the impact frame is light */
      if (!hit && t >= STRIKE.HIT) impact();
      if (!kicked && t >= STRIKE.HIT + STRIKE.STOP) kick();
      if (!ring2 && t >= STRIKE.HIT + 170) { ring2 = true; ring(G.cx, G.hitY, 14, 1000); }          /* a second, tighter shockwave */
      if (!snd.drop && t >= STRIKE.DROP) { snd.drop = true; sx("fly", (STRIKE.HIT - STRIKE.DROP) / 1000); }

      /* screen: dim in, letterbox bars, vignette */
      if (!jumped) put(sceneEl, "opacity", ease3(clamp01(t / STRIKE.DIM)).toFixed(2));
      var bk = ease3(clamp01(t / 560)) * (1 - ease3(clamp01((t - (STRIKE.LAVA1 - 300)) / 650))), bs = "scaleY(" + bk.toFixed(3) + ")";
      put(barT, "transform", bs); put(barB, "transform", bs); put(vigEl, "opacity", bk.toFixed(2));

      /* the anvil falls toward the camera (accelerating, growing), then recoils */
      var p = clamp01((t - STRIKE.DROP) / (STRIKE.HIT - STRIKE.DROP)), f = Math.pow(p, 2.4), ttc = Math.max(0, tc - STRIKE.HIT), r = Math.exp(-ttc / 230);
      var y = -(1 - f) * H * .75, sc = .4 + .6 * f;
      if (t >= STRIKE.HIT) { sc = 1 + .1 * r; y = 8 * r; }
      put(anvilEl, "opacity", t < STRIKE.DROP ? "0" : Math.min(1, p * 5).toFixed(2));
      put(anvilEl, "transform", "translate(-50%,-50%) translate3d(0," + y.toFixed(1) + "px,0) scale(" + sc.toFixed(3) + ")");
      var ig = clamp01((t - STRIKE.HIT - 30) / 800); ig = ig * ig * (3 - 2 * ig);          /* how strongly the anvil is burning (0 -> 1, then steady) */
      put(hotEl, "opacity", Math.min(1, t < STRIKE.HIT ? .18 + .3 * f : .45 + .55 * r + .14 * ig * (1 + .12 * Math.sin(now / 90))).toFixed(2));

      /* the camera: slow push-in with a roll that levels out, handheld drift, shake + zoom punch on the kick, then a crane up with the lava */
      var push = 1 - Math.pow(1 - clamp01(Math.min(tc, STRIKE.HIT) / STRIKE.HIT), 2), camSc = 1 + .12 * push, roll = -2.2 * (1 - push);
      var cu = ease3(clamp01((tc - STRIKE.HIT - 220) / 2300)), lift = cu * H * .4, rx = -cu * 6; camSc *= 1 - .22 * cu;
      var tx = 0, ty = 0, zoom = 1 + punch.v, drift = t < STRIKE.HIT ? clamp01(t / 750) : Math.max(0, 1 - ttc / 750);
      if (drift > 0) {                                          /* a faint, slow handheld sway: the camera feels like it is held by a person */
        tx = (Math.sin(now / 830) * 1.3 + Math.sin(now / 1370 + 2) * .8) * drift; ty = (Math.sin(now / 950 + 1) * 1.1 + Math.sin(now / 1610) * .7) * drift; roll += Math.sin(now / 1190) * .12 * drift;
      }
      if (shk.v > .001) {
        var tm = now / 1000, amp = .62 * shk.a * shk.v;
        tx += (Math.sin(tm * 47) + .6 * Math.sin(tm * 31 + 1.3)) * amp; ty += (Math.sin(tm * 43 + 2.1) + .6 * Math.sin(tm * 29 + .4)) * amp;
      }
      if (!jumped) put(shakeEl, "transform", (fancy ? "perspective(1100px) translate3d(" : "translate3d(") + tx.toFixed(1) + "px," + (ty + lift).toFixed(1) + "px,0)" + (fancy ? " rotateX(" + rx.toFixed(2) + "deg) rotateZ(" + roll.toFixed(2) + "deg)" : "") + " scale(" + (camSc * zoom).toFixed(3) + ")");

      /* impact light: white-orange flash and an anamorphic lens streak */
      var tt = Math.max(0, t - STRIKE.HIT);
      put(whiteEl, "opacity", t < STRIKE.HIT ? "0" : Math.pow(1 - clamp01(tt / 700), 2).toFixed(2));
      if (t >= STRIKE.HIT && tt < 1000) { put(streakEl, "top", (G.hitY - 2).toFixed(0) + "px"); put(streakEl, "opacity", (1 - clamp01((tt - 120) / 880)).toFixed(2)); put(streakEl, "transform", "scaleX(" + ease2(clamp01(tt / 270)).toFixed(2) + ")"); }
      else put(streakEl, "opacity", "0");

      /* the anvil burns: the logo's flame grows out of the anvil's top face and then keeps burning in place (it never lifts off, and it sits inside the
         camera group, so it moves with the anvil); fire tongues, embers and pixel squares stream up out of it continuously */
      if (t >= STRIKE.HIT && !jumped) {
        var fgrow = clamp01((t - STRIKE.HIT - STRIKE.STOP) / 800), tf = now / 1000, fs = .22 + .68 * (1 - Math.pow(1 - fgrow, 3));
        var fxs = fs * (1 + .03 * Math.sin(tf * 19) + .02 * Math.sin(tf * 31 + 1)), fys = fs * (fgrow >= 1 ? 1 + .045 * Math.sin(tf * 5.1) : 1) * (1 + .05 * Math.sin(tf * 13 + 1) + .03 * Math.sin(tf * 27));
        put(flameEl2, "opacity", Math.min(1, fgrow * 6).toFixed(2));
        put(flameEl2, "transform", "skewX(" + (Math.sin(tf * 4.3) * 2.4 + Math.sin(tf * 9.1) * 1.1).toFixed(2) + "deg) scale(" + fxs.toFixed(3) + "," + fys.toFixed(3) + ")");
        var fq = (lod >= 2 ? .4 : lod ? .65 : 1) * ig;
        fAcc += (curTier === 0 ? 105 : curTier === 1 ? 70 : 46) * fq * dt / 60; eAcc += 16 * fq * dt / 60; pAcc += (lod >= 2 ? 0 : 9) * ig * dt / 60;
        while (fAcc >= 1) { fAcc -= 1; emitFire(0); } while (eAcc >= 1) { eAcc -= 1; emitFire(1); } while (pAcc >= 1) { pAcc -= 1; emitFire(2); }
        drawFire(now, dt);
      }

      /* the lava wall climbs the screen; the page jumps once it covers everything */
      var u = clamp01((t - STRIKE.LAVA0) / (STRIKE.LAVA1 - STRIKE.LAVA0)), streaking = false;
      if (u > 0 && u < 1) {
        if (!snd.lava) { snd.lava = true; sx("ignite"); sx("rise", (STRIKE.LAVA1 - STRIKE.LAVA0) / 1000); }
        var yL = H + LA - ease2(u) * TRAVEL;
        drawLava(yL, now); lavaOn = true; streaking = lod < 1;
        if (!jumped && yL <= 0) { jump(); sceneEl.style.display = "none"; sx("shimmer"); }   /* fully covered: nobody sees the jump */
        pxAcc += (curTier === 0 ? 90 : 40) * (lod ? .4 : 1) * dt / 60;           /* the logo's squares stream off the lava's edge */
        while (pxAcc >= 1) {
          pxAcc -= 1; var py = yL - Math.random() * LA * .8;
          if (py > -20 && py < H + 20) burst(Math.random() * W, py, { kind: "pixel", n: 1, speed: 3.4, angle: -Math.PI / 2, spread: .6, size: 6 + Math.random() * 9, life: 1700 });
        }
      } else if (u >= 1 && lavaOn) { lavaOn = false; lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, lvs.width, lvs.height); }

      /* embers rise from the bottom of the screen */
      if (t > STRIKE.HIT + 150 && t < STRIKE.END - 150) {
        emAcc += (curTier === 0 ? 30 : 14) * (lod ? .5 : 1) * dt / 60;
        while (emAcc >= 1) { emAcc -= 1; burst(Math.random() * W, H * 1.01, { kind: "ember", n: 1, speed: 2.8, angle: -Math.PI / 2, spread: .6, size: 1.7, life: 3000 }); }
      }
      drawParts(c2, now, dt);
      if (streaking) {                                          /* speed streaks rush past while the camera cranes up: the "going up" feeling */
        c2.globalCompositeOperation = "lighter"; c2.globalAlpha = Math.sin(Math.PI * u) * .26; c2.strokeStyle = "rgb(255,172,96)"; c2.lineWidth = 1.2; c2.beginPath();
        for (var s = 0; s < NS; s++) {
          SY[s] -= SV[s] * dt * .01667; if (SY[s] + SL[s] < 0) { SY[s] = H + Math.random() * H * .3; SX[s] = Math.random() * W; }
          c2.moveTo(SX[s], SY[s]); c2.lineTo(SX[s], SY[s] + SL[s]);
        }
        c2.stroke(); c2.globalAlpha = 1; c2.globalCompositeOperation = "source-over";
      }
      if (t >= STRIKE.END) finish();
    }
    raf = requestAnimationFrame(tick);
    return true;
  }

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
  /* first-visit intro: resolves true once anime.js + the logo pieces are loaded, the overlay is built and
     (on the full tier) three.js is ready or maxMs has passed. */
  function prepare(tier, maxMs) {
    return ready().then(function (ok) {
      if (!ok) return false;
      try { build(tier); } catch (e) { return false; }
      if (tier !== 0 || !dimport || glTried) return true;
      glTried = true;
      var imp = dimport(CFG.THREE_URL).then(initGL).catch(function (e) { console.warn("[forge] three.js not loaded, using the CSS background", e); });
      return Promise.race([imp, new Promise(function (r) { setTimeout(r, maxMs || 1500); })]).then(function () { return true; });
    });
  }
  window.AIForge = { start: start, preload: preload, load: ready, prepare: prepare, strike: strike, warm: warm, isRunning: function () { return running || striking; } };
})();
