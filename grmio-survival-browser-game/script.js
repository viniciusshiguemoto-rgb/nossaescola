/* ==========================================================================
   FOGE DA TORCIDA! — script.js
   Jogo de sobrevivência: você é o camisa 10 tricolor fugindo dos colorados.
   Tudo em JavaScript puro — sem dependências, sem build.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- utils */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.floor(n).toLocaleString("pt-BR");
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- áudio */
  class Sfx {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noise = null;
      this.muted = false;
    }
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.6);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = buf;
      } catch {
        this.ctx = null;
      }
    }
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    }
    tone(o) {
      if (!this.ctx || !this.master || this.muted) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = o.type || "square";
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + o.dur + 0.02);
    }
    hiss(o) {
      if (!this.ctx || !this.master || !this.noise || this.muted) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(o.freq || 900, t0);
      if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.sweepTo), t0 + o.dur);
      f.Q.value = o.q || 1;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(o.vol || 0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + o.dur + 0.02);
    }
    pickup(combo) {
      const base = 660 * Math.pow(1.0595, Math.min(14, combo || 0));
      this.tone({ freq: base, dur: 0.09, type: "triangle", vol: 0.16 });
      this.tone({ freq: base * 1.5, dur: 0.12, type: "triangle", vol: 0.12, delay: 0.05 });
    }
    dash() {
      this.hiss({ dur: 0.22, vol: 0.14, freq: 1500, sweepTo: 260, q: 0.7 });
      this.tone({ freq: 180, dur: 0.14, type: "sawtooth", vol: 0.08, slideTo: 90 });
    }
    near() {
      this.tone({ freq: 1500, dur: 0.05, vol: 0.07 });
      this.tone({ freq: 2100, dur: 0.05, vol: 0.05, delay: 0.045 });
    }
    kill() {
      this.hiss({ dur: 0.12, vol: 0.1, freq: 700, sweepTo: 200 });
      this.tone({ freq: 320, dur: 0.1, vol: 0.1, slideTo: 140 });
    }
    hit() {
      this.tone({ freq: 150, dur: 0.32, type: "sawtooth", vol: 0.22, slideTo: 48 });
      this.hiss({ dur: 0.3, vol: 0.16, freq: 420, sweepTo: 90, q: 0.5 });
    }
    power() {
      [0, 0.07, 0.14, 0.21].forEach((d, i) =>
        this.tone({ freq: 440 * Math.pow(1.26, i), dur: 0.16, type: "triangle", vol: 0.14, delay: d }),
      );
    }
    grito() {
      this.tone({ freq: 90, dur: 0.7, type: "sawtooth", vol: 0.22, slideTo: 40 });
      this.hiss({ dur: 0.6, vol: 0.2, freq: 300, sweepTo: 2200, q: 0.6 });
      [0, 0.1, 0.2].forEach((d) =>
        this.tone({ freq: 880, dur: 0.2, vol: 0.09, delay: d, slideTo: 1200 }),
      );
    }
    wave() {
      this.tone({ freq: 300, dur: 0.18, vol: 0.1 });
      this.tone({ freq: 450, dur: 0.22, vol: 0.1, delay: 0.14 });
    }
    smoke() {
      this.hiss({ dur: 0.4, vol: 0.07, freq: 2600, sweepTo: 700, q: 0.4 });
    }
    deny() {
      this.tone({ freq: 240, dur: 0.12, vol: 0.09, slideTo: 150 });
    }
    whistle() {
      [0, 0.13, 0.26].forEach((d) => {
        this.tone({ freq: 2350, dur: 0.1, type: "sine", vol: 0.13, slideTo: 2650, delay: d });
        this.tone({ freq: 3150, dur: 0.1, type: "sine", vol: 0.06, delay: d });
        this.hiss({ dur: 0.11, vol: 0.07, freq: 2900, q: 7, delay: d });
      });
    }
    start() {
      [0, 0.1, 0.2, 0.32].forEach((d, i) =>
        this.tone({ freq: 392 * Math.pow(1.26, i), dur: 0.2, vol: 0.12, delay: d }),
      );
    }
    over() {
      [0, 0.16, 0.34, 0.56].forEach((d, i) =>
        this.tone({ freq: 520 / Math.pow(1.2, i), dur: 0.3, type: "sawtooth", vol: 0.14, delay: d, slideTo: 90 }),
      );
      this.hiss({ dur: 1, vol: 0.1, freq: 500, sweepTo: 80, delay: 0.3 });
    }
  }
  const sfx = new Sfx();

  /* ------------------------------------------------------------- recordes */
  const KEY = "foge-da-torcida-scores-v1";
  const NAME_KEY = "foge-da-torcida-name";
  const MUTE_KEY = "foge-da-torcida-muted";
  const MAX_ENTRIES = 8;

  const loadScores = () => {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return (Array.isArray(list) ? list : [])
        .filter((e) => typeof e.score === "number")
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ENTRIES);
    } catch {
      return [];
    }
  };
  const saveScore = (entry) => {
    const list = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {}
    return list;
  };
  const qualifies = (score) => {
    if (score <= 0) return false;
    const l = loadScores();
    return l.length < MAX_ENTRIES || score > l[l.length - 1].score;
  };
  const ls = (k, d = "") => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };

  /* ------------------------------------------------------- camisas / kits */
  // VOCÊ = tricolor de azul. A TORCIDA = colorada de vermelho. O JUIZ = amarelo.
  const KIT_PLAYER = {
    shirt: "#1d4ed8",
    stripes: ["#1d4ed8", "#0b1220", "#e2e8f0"],
    shorts: "#0b1220",
    socks: "#1d4ed8",
    sockTop: "#e2e8f0",
    boot: "#0f172a",
    skin: "#e0b088",
    hair: "#241309",
    number: "10",
    trim: "#e2e8f0",
  };
  const KIT_MOB = {
    shirt: "#dc2626",
    stripes: ["#dc2626", "#dc2626"],
    shorts: "#f8fafc",
    socks: "#dc2626",
    sockTop: "#f8fafc",
    boot: "#1f2937",
    skin: "#d8a878",
    hair: "#1f2937",
    number: "7",
    trim: "#f8fafc",
  };
  const KIT_JUIZ = {
    shirt: "#facc15",
    stripes: ["#facc15", "#facc15"],
    shorts: "#0f172a",
    socks: "#0f172a",
    sockTop: "#facc15",
    boot: "#0f172a",
    skin: "#e6b98f",
    hair: "#111827",
    number: "",
    trim: "#0f172a",
  };
  const MOB_KITS = [
    KIT_MOB,
    { ...KIT_MOB, skin: "#c98f63", hair: "#0b1220", number: "8" },
    { ...KIT_MOB, skin: "#8d5524", hair: "#111827", number: "9" },
    { ...KIT_MOB, shorts: "#dc2626", socks: "#f8fafc", sockTop: "#dc2626", number: "11" },
  ];
  const KIT_MOB_CAP = { ...KIT_MOB, number: "", hair: "#0b1220", trim: "#facc15" };

  function rr(ctx, x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /** Desenha um jogadozinho em 3/4 de cima. (x,y) = quadril, `ang` = direção. */
  function drawFootballer(ctx, x, y, r, ang, walk, kit, opts = {}) {
    const bob = Math.sin(walk * 2) * r * 0.08;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const swing = Math.sin(walk * 2.2);
    const headR = r * (opts.scaleHead || 0.5);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // pernas: meião + faixa + chuteira
    for (const side of [-1, 1]) {
      const off = side * r * 0.24;
      const sw = swing * side * r * 0.26;
      ctx.fillStyle = kit.socks;
      rr(ctx, off - r * 0.15 + sw * 0.35, r * 0.2, r * 0.3, r * 0.5, r * 0.12);
      ctx.fill();
      ctx.fillStyle = kit.sockTop;
      ctx.fillRect(off - r * 0.15 + sw * 0.35, r * 0.22, r * 0.3, r * 0.1);
      ctx.fillStyle = kit.boot;
      ctx.beginPath();
      ctx.ellipse(off + sw * 0.5 + dx * r * 0.1, r * 0.76, r * 0.21, r * 0.13, ang, 0, TAU);
      ctx.fill();
    }

    // calção
    ctx.fillStyle = kit.shorts;
    rr(ctx, -r * 0.44, r * 0.02, r * 0.88, r * 0.42, r * 0.14);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(-r * 0.44, r * 0.34, r * 0.88, r * 0.1);

    // braços
    const armSwing = -swing;
    for (const side of [-1, 1]) {
      const sw = armSwing * side * r * 0.3;
      const sx = side * r * 0.52;
      const sy = -r * 0.18;
      ctx.strokeStyle = kit.shirt;
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + side * r * 0.18, sy + r * 0.34 + sw * 0.4);
      ctx.stroke();
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = r * 0.19;
      ctx.beginPath();
      ctx.moveTo(sx + side * r * 0.18, sy + r * 0.34 + sw * 0.4);
      ctx.lineTo(sx + side * r * 0.22 + dx * r * 0.16, sy + r * 0.56 + sw * 0.7);
      ctx.stroke();
    }

    // camisa
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.42);
    ctx.quadraticCurveTo(-r * 0.66, -r * 0.02, -r * 0.4, r * 0.3);
    ctx.lineTo(r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(r * 0.66, -r * 0.02, r * 0.5, -r * 0.42);
    ctx.quadraticCurveTo(0, -r * 0.62, -r * 0.5, -r * 0.42);
    ctx.closePath();
    ctx.fillStyle = kit.shirt;
    ctx.fill();

    ctx.save();
    ctx.clip();
    if (kit.stripes.length > 1) {
      const cols = 7;
      const w = (r * 1.4) / cols;
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = kit.stripes[i % kit.stripes.length];
        ctx.fillRect(-r * 0.7 + i * w, -r * 0.7, w + 0.5, r * 1.5);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 0.4, r * 1.5);
    ctx.fillStyle = "rgba(0,0,0,.26)";
    ctx.fillRect(-r * 0.7, r * 0.12, r * 1.5, r * 0.8);
    ctx.restore();

    ctx.strokeStyle = "rgba(2,6,23,.55)";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();

    // gola + número
    ctx.strokeStyle = kit.trim;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.arc(dx * r * 0.1 - r * 0.02, -r * 0.5 + dy * r * 0.06, r * 0.15, 0, Math.PI);
    ctx.stroke();
    if (kit.number) {
      ctx.fillStyle = kit.trim;
      ctx.font = `900 ${Math.round(r * 0.38)}px Rubik, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(kit.number, 0, r * 0.16);
    }
    if (opts.armband) {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(-r * 0.58, -r * 0.16, r * 0.18, r * 0.14);
    }

    // cabeça
    const hx = dx * r * 0.2;
    const hy = dy * r * 0.14 - r * 0.26;
    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(2,6,23,.5)";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, TAU);
    ctx.clip();
    ctx.fillStyle = kit.hair;
    ctx.beginPath();
    ctx.arc(hx - dx * headR * 0.42, hy - dy * headR * 0.42, headR * 0.98, 0, TAU);
    ctx.fill();
    if (opts.bandana) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(hx - headR, hy - headR * 0.35, headR * 2, headR * 0.34);
    }
    ctx.restore();

    if (opts.cap) {
      ctx.fillStyle = "#0b1220";
      ctx.beginPath();
      ctx.arc(hx - dx * headR * 0.3, hy - dy * headR * 0.3, headR * 0.92, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#1e3a8a";
      ctx.beginPath();
      ctx.ellipse(hx + dx * headR * 0.75, hy + dy * headR * 0.75, headR * 0.55, headR * 0.22, ang, 0, TAU);
      ctx.fill();
    }

    // rosto
    const fx = dx * headR * 0.42;
    const fy = dy * headR * 0.42;
    const px = -dy;
    const py = dx;
    ctx.fillStyle = "#0b1220";
    const eyeOff = opts.eyes ? 0.3 : 0.32;
    const eyeF = opts.eyes ? 1 : 0.6;
    const eyeR = opts.eyes ? 0.13 : 0.12;
    ctx.beginPath();
    ctx.arc(hx + fx * eyeF - px * headR * eyeOff, hy + fy * eyeF - py * headR * eyeOff, headR * eyeR, 0, TAU);
    ctx.arc(hx + fx * eyeF + px * headR * eyeOff, hy + fy * eyeF + py * headR * eyeOff, headR * eyeR, 0, TAU);
    ctx.fill();
    if (opts.beard) {
      ctx.fillStyle = kit.hair;
      ctx.beginPath();
      ctx.ellipse(hx + fx * 0.8, hy + fy * 0.8, headR * 0.62, headR * 0.4, ang, 0, TAU);
      ctx.fill();
    }
    if (opts.whistle) {
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.ellipse(hx + dx * headR * 0.85, hy + dy * headR * 0.85, headR * 0.3, headR * 0.19, ang, 0, TAU);
      ctx.fill();
    }

    // cartão ou braço apontando
    if (opts.card) {
      const cardC = opts.card === "vermelho" ? "#ef4444" : "#facc15";
      const a2 = ang + (opts.card === "vermelho" ? -0.5 : 0.5);
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = r * 0.19;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.1);
      ctx.lineTo(Math.cos(a2) * r * 0.95, -r * 0.35 + Math.sin(a2) * r * 0.3);
      ctx.stroke();
      ctx.save();
      ctx.translate(Math.cos(a2) * r * 1.05, -r * 0.5 + Math.sin(a2) * r * 0.35);
      ctx.rotate(a2 * 0.4);
      ctx.fillStyle = cardC;
      rr(ctx, -r * 0.18, -r * 0.26, r * 0.36, r * 0.52, r * 0.05);
      ctx.fill();
      ctx.strokeStyle = "rgba(2,6,23,.6)";
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.stroke();
      ctx.restore();
    } else if (opts.point !== undefined) {
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = r * 0.19;
      ctx.beginPath();
      ctx.moveTo(r * 0.28, -r * 0.05);
      ctx.lineTo(r * 0.28 + Math.cos(opts.point) * r * 1.05, -r * 0.05 + Math.sin(opts.point) * r * 1.05);
      ctx.stroke();
    }

    if (opts.flash) {
      ctx.globalAlpha = clamp01(opts.flash);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- o jogo */
  const PLAYER_R = 14;
  const P_SPEED = 336;
  const DASH_SPEED = 1010;
  const DASH_TIME = 0.17;
  const DASH_CD = 1.05;
  const IFRAMES = 1.5;

  class Game {
    constructor(canvas, hooks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.hooks = hooks;

      this.enemies = [];
      this.parts = [];
      this.pickups = [];
      this.smokes = [];
      this.texts = [];
      this.rings = [];
      this.trail = [];
      this.keys = new Set();

      this.running = false;
      this.paused = false;
      this.dead = false;
      this.joyId = -1;
      this.jox = 0;
      this.joy = 0;
      this.jox0 = 0;
      this.joy0 = 0;

      this.bind();
      this.resize();
      this.resetWorld();
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      window.removeEventListener("resize", this.onResize);
      window.removeEventListener("orientationchange", this.onResize);
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      document.removeEventListener("visibilitychange", this.onVis);
      this.canvas.removeEventListener("pointerdown", this.onDown);
      this.canvas.removeEventListener("pointermove", this.onMove);
      this.canvas.removeEventListener("pointerup", this.onUp);
      this.canvas.removeEventListener("pointercancel", this.onUp);
    }

    bind() {
      window.addEventListener("resize", this.onResize);
      window.addEventListener("orientationchange", this.onResize);
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      document.addEventListener("visibilitychange", this.onVis);
      this.canvas.addEventListener("pointerdown", this.onDown, { passive: false });
      this.canvas.addEventListener("pointermove", this.onMove, { passive: false });
      this.canvas.addEventListener("pointerup", this.onUp);
      this.canvas.addEventListener("pointercancel", this.onUp);
    }

    onVis = () => {
      if (document.hidden && this.running && !this.paused && !this.dead) this.hooks.onPauseRequest();
    };
    onResize = () => this.resize();

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.vw = Math.max(240, rect.width);
      this.vh = Math.max(240, rect.height);
      this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      this.canvas.width = Math.floor(this.vw * this.dpr);
      this.canvas.height = Math.floor(this.vh * this.dpr);

      const aspect = clamp(this.vw / this.vh, 0.42, 2.5);
      let ah = Math.sqrt(600000 / aspect);
      let aw = ah * aspect;
      aw = clamp(aw, 460, 1200);
      ah = clamp(ah, 460, 1200);
      this.aw = aw;
      this.ah = ah;
      this.stand = clamp(Math.min(aw, ah) * 0.1, 38, 74);
      this.scale = Math.min(this.vw / aw, this.vh / ah);
      this.ox = (this.vw - aw * this.scale) / 2;
      this.oy = (this.vh - ah * this.scale) / 2;
      this.px0 = this.stand;
      this.py0 = this.stand;
      this.px1 = aw - this.stand;
      this.py1 = ah - this.stand;
      this.buildBg();
    }

    /* ---------------- fundo (cacheado) ---------------- */
    buildBg() {
      const w = Math.max(1, Math.floor(this.aw * this.scale * this.dpr));
      const h = Math.max(1, Math.floor(this.ah * this.scale * this.dpr));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const g = cv.getContext("2d");
      if (!g) return;
      g.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
      const rng = mulberry32(1337);
      const { aw, ah, stand: s } = this;

      const grad = g.createLinearGradient(0, 0, 0, ah);
      grad.addColorStop(0, "#131a2a");
      grad.addColorStop(1, "#0b1020");
      g.fillStyle = grad;
      g.fillRect(0, 0, aw, ah);

      // torcida
      for (let y = 3; y < ah - 3; y += 7) {
        for (let x = 3; x < aw - 3; x += 7) {
          if (x > s - 6 && x < aw - s + 6 && y > s - 6 && y < ah - s + 6) continue;
          const r0 = rng();
          g.fillStyle =
            r0 < 0.42
              ? "rgba(220,38,38,.5)"
              : r0 < 0.62
                ? "rgba(226,232,240,.4)"
                : r0 < 0.72
                  ? "rgba(15,23,42,.7)"
                  : r0 < 0.8
                    ? "rgba(29,78,216,.4)"
                    : "rgba(148,163,184,.22)";
          g.beginPath();
          g.arc(x + rng() * 3 - 1.5, y + rng() * 3 - 1.5, 1.4 + rng() * 1.5, 0, TAU);
          g.fill();
        }
      }
      g.strokeStyle = "rgba(148,163,184,.25)";
      g.lineWidth = 2;
      g.strokeRect(s - 5, s - 5, aw - (s - 5) * 2, ah - (s - 5) * 2);

      // gramado
      const pg = g.createLinearGradient(s, s, aw - s, ah - s);
      pg.addColorStop(0, "#12482a");
      pg.addColorStop(0.5, "#0f5c31");
      pg.addColorStop(1, "#0c4426");
      g.fillStyle = pg;
      g.fillRect(s, s, aw - s * 2, ah - s * 2);

      g.save();
      g.beginPath();
      g.rect(s, s, aw - s * 2, ah - s * 2);
      g.clip();
      const stripes = 12;
      const sw = (aw - s * 2) / stripes;
      for (let i = 0; i < stripes; i += 2) {
        g.fillStyle = "rgba(255,255,255,.045)";
        g.fillRect(s + i * sw, s, sw, ah - s * 2);
      }
      const vg = g.createRadialGradient(aw / 2, ah / 2, Math.min(aw, ah) * 0.15, aw / 2, ah / 2, Math.max(aw, ah) * 0.7);
      vg.addColorStop(0, "rgba(255,255,255,.06)");
      vg.addColorStop(1, "rgba(0,0,0,.42)");
      g.fillStyle = vg;
      g.fillRect(s, s, aw - s * 2, ah - s * 2);
      g.restore();

      // linhas
      g.strokeStyle = "rgba(255,255,255,.4)";
      g.lineWidth = 2.4;
      g.strokeRect(s + 14, s + 14, aw - (s + 14) * 2, ah - (s + 14) * 2);
      g.beginPath();
      g.moveTo(aw / 2, s + 14);
      g.lineTo(aw / 2, ah - s - 14);
      g.stroke();
      g.beginPath();
      g.arc(aw / 2, ah / 2, Math.min(aw, ah) * 0.13, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(aw / 2, ah / 2, 3.4, 0, TAU);
      g.fillStyle = "rgba(255,255,255,.5)";
      g.fill();
      const bw = Math.min(aw, ah) * 0.16;
      const bh = Math.min(aw, ah) * 0.42;
      g.strokeRect(s + 14, ah / 2 - bh / 2, bw, bh);
      g.strokeRect(aw - s - 14 - bw, ah / 2 - bh / 2, bw, bh);

      // traves
      const goal = (x, dir) => {
        const gh = Math.min(aw, ah) * 0.26;
        g.fillStyle = "rgba(226,232,240,.13)";
        g.fillRect(x, ah / 2 - gh / 2, dir * 16, gh);
        g.strokeStyle = "rgba(226,232,240,.45)";
        g.lineWidth = 1;
        for (let i = 0; i <= 6; i++) {
          const yy = ah / 2 - gh / 2 + (gh / 6) * i;
          g.beginPath();
          g.moveTo(x, yy);
          g.lineTo(x + dir * 16, yy);
          g.stroke();
        }
        for (let i = 0; i <= 4; i++) {
          const xx = x + (dir * 16 * i) / 4;
          g.beginPath();
          g.moveTo(xx, ah / 2 - gh / 2);
          g.lineTo(xx, ah / 2 + gh / 2);
          g.stroke();
        }
        g.strokeStyle = "rgba(248,250,252,.85)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, ah / 2 - gh / 2);
        g.lineTo(x, ah / 2 + gh / 2);
        g.stroke();
      };
      goal(s + 14, 1);
      goal(aw - s - 14, -1);

      this.bg = cv;
    }

    /* ---------------- input ---------------- */
    onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "spacebar"].includes(k)) e.preventDefault();
      if (k === "p" || k === "escape") {
        this.hooks.onPauseRequest();
        return;
      }
      if (k === " " || k === "spacebar" || k === "shift" || k === "j" || k === "k") this.doDash();
      this.keys.add(k);
    };
    onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());

    toWorld(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (cx - r.left - this.ox) / this.scale, y: (cy - r.top - this.oy) / this.scale };
    }
    onDown = (e) => {
      if (this.joyId !== -1) return;
      this.joyId = e.pointerId;
      const w = this.toWorld(e.clientX, e.clientY);
      this.jox0 = w.x;
      this.joy0 = w.y;
      this.jox = 0;
      this.joy = 0;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
    };
    onMove = (e) => {
      if (e.pointerId !== this.joyId) return;
      const w = this.toWorld(e.clientX, e.clientY);
      let dx = w.x - this.jox0;
      let dy = w.y - this.joy0;
      const len = Math.hypot(dx, dy);
      const max = 62 / this.scale;
      if (len > max) {
        this.jox0 += (dx / len) * (len - max);
        this.joy0 += (dy / len) * (len - max);
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      this.jox = dx / max;
      this.joy = dy / max;
    };
    onUp = (e) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = -1;
      this.jox = 0;
      this.joy = 0;
    };

    inputX() {
      let x = this.jox;
      if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
      if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
      return clamp(x, -1, 1);
    }
    inputY() {
      let y = this.joy;
      if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
      if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
      return clamp(y, -1, 1);
    }

    /* ---------------- controle público ---------------- */
    startRun() {
      this.resetWorld();
      this.running = true;
      this.paused = false;
      this.dead = false;
      this.last = performance.now();
      for (let i = 0; i < 3; i++) this.spawnEnemy("torcedor");
      this.announce = "SOBREVIVA!";
      this.announceT = 1.3;
      this.flash = 0.3;
      this.flashColor = "253,224,71";
      sfx.start();
    }
    setPaused(p) {
      this.paused = p;
      if (!p) this.last = performance.now();
    }
    toMenu() {
      this.running = false;
      this.paused = false;
      this.dead = false;
      this.resetWorld();
      this.last = performance.now();
    }
    doDash() {
      if (!this.running || this.paused || this.dead) return;
      if (this.dashCd > 0 || this.dashT > 0) return;
      if (this.dashLock > 0) {
        sfx.deny();
        this.floatText(this.px, this.py - 26, "SEM CARRINHO!", "#fde68a", 14);
        return;
      }
      let dx = this.inputX();
      let dy = this.inputY();
      let l = Math.hypot(dx, dy);
      if (l < 0.15) {
        dx = Math.cos(this.pface);
        dy = Math.sin(this.pface);
        l = 1;
      }
      this.dashDx = dx / l;
      this.dashDy = dy / l;
      this.dashT = DASH_TIME;
      this.dashCd = DASH_CD;
      this.iframe = Math.max(this.iframe, DASH_TIME + 0.12);
      sfx.dash();
      this.shake = Math.max(this.shake, 5);
      for (let i = 0; i < 14; i++) {
        const a = Math.atan2(-this.dashDy, -this.dashDx) + rand(-0.6, 0.6);
        const sp = rand(60, 240);
        this.part(this.px, this.py, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.2, 0.42), rand(1.5, 3.4), i % 3 ? "#60a5fa" : "#dbeafe", 0);
      }
      this.rings.push({ x: this.px, y: this.py, r: 6, max: 42, life: 0.3, w: 3, color: "147,197,253" });
    }

    resetWorld() {
      this.enemies.length = 0;
      this.parts.length = 0;
      this.pickups.length = 0;
      this.smokes.length = 0;
      this.texts.length = 0;
      this.rings.length = 0;
      this.trail.length = 0;
      this.px = (this.px0 + this.px1) / 2;
      this.py = (this.py0 + this.py1) / 2;
      this.pvx = this.pvy = 0;
      this.pface = -Math.PI / 2;
      this.walk = 0;
      this.dashT = 0;
      this.dashCd = 0;
      this.dashDx = 0;
      this.dashDy = 0;
      this.dashLock = 0;
      this.iframe = 1.2;
      this.score = 0;
      this.lives = 3;
      this.combo = 0;
      this.comboT = 0;
      this.mult = 1;
      this.kills = 0;
      this.raspoes = 0;
      this.speedBoost = 0;
      this.shake = 0;
      this.flash = 0;
      this.flashColor = "255,255,255";
      this.hitStop = 0;
      this.slowT = 0;
      this.timeScale = 1;
      this.t = 0;
      this.wave = 1;
      this.waveT = 0;
      this.spawnT = 0.6;
      this.camisaT = 1.2;
      this.powerT = 9;
      this.healT = 30;
      this.juizT = 15;
      this.announce = "";
      this.announceT = 0;
      this.pushStats(true);
    }

    /* ---------------- loop ---------------- */
    loop = (now) => {
      this.raf = requestAnimationFrame(this.loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.1);

      if (this.running && !this.paused) {
        if (this.hitStop > 0) this.hitStop -= dt;
        else {
          this.timeScale = lerp(this.timeScale, this.slowT > 0 ? 0.42 : 1, 1 - Math.pow(0.001, dt));
          if (this.slowT > 0) this.slowT -= dt;
          let rem = dt * this.timeScale;
          let guard = 0;
          while (rem > 0.0001 && guard++ < 6) {
            const step = Math.min(rem, 1 / 60);
            this.update(step);
            rem -= step;
          }
        }
        this.decayFx(dt);
      } else {
        this.decayFx(dt * 0.5);
        if (!this.dead) this.idleFx(dt);
        else this.updateParts(dt);
      }
      this.render();

      this.statsT = (this.statsT || 0) - dt;
      if (this.statsT <= 0) {
        this.statsT = 0.08;
        this.pushStats(false);
      }
    };

    decayFx(dt) {
      this.shake *= Math.pow(0.0016, dt);
      if (this.shake < 0.05) this.shake = 0;
      this.flash = Math.max(0, this.flash - dt * 3.4);
      if (this.announceT > 0) this.announceT -= dt;
    }

    /** faíscas ambiente nas telas de menu */
    idleFx(dt) {
      this.t += dt;
      if (Math.random() < dt * 14) {
        const x = Math.random() < 0.5 ? rand(10, this.aw - 10) : Math.random() < 0.5 ? rand(6, this.stand) : rand(this.aw - this.stand, this.aw - 6);
        const y = Math.random() < 0.5 ? (Math.random() < 0.5 ? rand(6, this.stand) : rand(this.ah - this.stand, this.ah - 6)) : rand(10, this.ah - 10);
        this.part(x, y, rand(-8, 8), rand(-30, -12), rand(0.8, 1.8), rand(1.4, 3), pick(["rgba(148,163,184,.6)", "rgba(96,165,250,.5)", "rgba(248,250,252,.5)"]), 2);
      }
      if (Math.random() < dt * 3)
        this.rings.push({ x: rand(this.px0, this.px1), y: rand(this.py0, this.py1), r: 2, max: rand(18, 34), life: 0.9, w: 1.4, color: "148,163,184" });
      this.updateParts(dt);
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life -= dt;
        r.r = lerp(r.r, r.max, 1 - Math.pow(0.05, dt));
        if (r.life <= 0) this.rings.splice(i, 1);
      }
      this.walk += dt * 1.6;
    }

    pushStats(force) {
      if (!force && !this.running) return;
      this.hooks.onStats({
        score: Math.floor(this.score),
        lives: this.lives,
        combo: this.combo,
        mult: this.mult,
        time: this.t,
        wave: this.wave,
        dash: 1 - clamp(this.dashCd / DASH_CD, 0, 1),
        lock: this.dashLock,
        speed: this.speedBoost,
      });
    }

    /* ---------------- simulação ---------------- */
    update(dt) {
      this.t += dt;
      this.waveT += dt;
      const diff = 1 + this.t / 55;

      if (this.waveT >= 18) {
        this.waveT = 0;
        this.wave++;
        this.announce = `ONDA ${this.wave}`;
        this.announceT = 1.5;
        sfx.wave();
        this.flash = 0.35;
        this.flashColor = "239,68,68";
      }

      this.score += (11 + this.wave * 2.4) * this.mult * dt;

      if (this.combo > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) {
          this.combo = 0;
          this.mult = 1;
        }
      }
      this.mult = Math.min(6, 1 + this.combo * 0.18);
      if (this.speedBoost > 0) this.speedBoost -= dt;
      if (this.iframe > 0) this.iframe -= dt;

      this.updatePlayer(dt);
      this.spawnLogic(dt);
      this.updateEnemies(dt, diff);
      this.updatePickups(dt);
      this.updateSmokes(dt);
      this.updateParts(dt);
      this.updateTrail(dt);

      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life -= dt;
        r.r = lerp(r.r, r.max, 1 - Math.pow(0.02, dt));
        if (r.life <= 0) this.rings.splice(i, 1);
      }
    }

    updateTrail(dt) {
      const dashing = this.dashT > 0;
      if (dashing || Math.hypot(this.pvx, this.pvy) > 260) {
        this.trail.push({ x: this.px, y: this.py, a: dashing ? 0.55 : 0.22 });
        if (this.trail.length > 26) this.trail.shift();
      }
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].a -= dt * (dashing ? 1.4 : 1.1);
        if (this.trail[i].a <= 0) this.trail.splice(i, 1);
      }
    }

    updatePlayer(dt) {
      if (this.dashLock > 0) this.dashLock = Math.max(0, this.dashLock - dt);
      if (this.dashT > 0) {
        this.dashT -= dt;
        const sp = DASH_SPEED * (0.55 + 0.45 * (this.dashT / DASH_TIME));
        this.pvx = this.dashDx * sp;
        this.pvy = this.dashDy * sp;
        for (const e of this.enemies) {
          if (!e.alive || e.kind === "capitao" || e.kind === "juiz" || e.hitCd > 0) continue;
          if (Math.hypot(e.x - this.px, e.y - this.py) < e.r + PLAYER_R + 7) {
            e.alive = false;
            this.kills++;
            this.addScore(e.kind === "bandeira" ? 60 : 40);
            this.floatText(e.x, e.y, "CARRINHO!", "#fde68a", 15);
            this.burst(e.x, e.y, e.kind === "fumaca" ? "#cbd5e1" : "#fca5a5", 16);
            this.shake = Math.max(this.shake, 8);
            this.hitStop = Math.max(this.hitStop, 0.045);
            sfx.kill();
          }
        }
      } else {
        let ix = this.inputX();
        let iy = this.inputY();
        const l = Math.hypot(ix, iy);
        if (l > 1) {
          ix /= l;
          iy /= l;
        }
        let speed = P_SPEED * (this.speedBoost > 0 ? 1.38 : 1);
        if (this.inSmoke(this.px, this.py)) speed *= 0.62;
        const k = 1 - Math.pow(0.0000008, dt);
        this.pvx = lerp(this.pvx, ix * speed, k);
        this.pvy = lerp(this.pvy, iy * speed, k);
        this.dashCd = Math.max(0, this.dashCd - dt);
      }

      this.px += this.pvx * dt;
      this.py += this.pvy * dt;
      const r = PLAYER_R;
      if (this.px < this.px0 + r) {
        this.px = this.px0 + r;
        this.pvx *= -0.35;
      }
      if (this.px > this.px1 - r) {
        this.px = this.px1 - r;
        this.pvx *= -0.35;
      }
      if (this.py < this.py0 + r) {
        this.py = this.py0 + r;
        this.pvy *= -0.35;
      }
      if (this.py > this.py1 - r) {
        this.py = this.py1 - r;
        this.pvy *= -0.35;
      }

      const spd = Math.hypot(this.pvx, this.pvy);
      if (spd > 22) this.pface = Math.atan2(this.pvy, this.pvx);
      this.walk += dt * (2 + spd / 42);
      if (spd > 120 && Math.random() < dt * 22)
        this.part(this.px - this.pvx * 0.02, this.py + 6, rand(-24, 24), rand(-16, 8), 0.32, rand(1.6, 3), "rgba(190,242,100,.5)", 2);
    }

    spawnLogic(dt) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = clamp(1.55 - this.t * 0.012, 0.34, 1.55);
        const group = 1 + Math.min(3, Math.floor(this.t / 40));
        for (let i = 0; i < group; i++) this.spawnEnemy();
      }

      // o capitão chega
      if (this.t > 34 && Math.floor((this.t - 34) / 38) !== Math.floor((this.t - 34 - dt) / 38)) {
        this.spawnBoss();
        this.announce = "O CAPITÃO CHEGOU!";
        this.announceT = 2;
        this.flash = 0.5;
        this.flashColor = "239,68,68";
        this.shake = Math.max(this.shake, 16);
        sfx.grito();
      }

      this.camisaT -= dt;
      if (this.camisaT <= 0) {
        this.camisaT = rand(1.3, 2.4);
        if (this.pickups.filter((p) => p.kind === "camisa").length < 7) this.spawnPickup("camisa");
      }
      this.powerT -= dt;
      if (this.powerT <= 0) {
        this.powerT = rand(15, 21);
        this.spawnPickup(Math.random() < 0.55 ? "chimarrao" : "grito");
      }
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = rand(32, 44);
        if (this.lives < 3) this.spawnPickup("pastel");
      }

      // o juiz entra em campo
      this.juizT -= dt;
      if (this.juizT <= 0) {
        this.juizT = 30;
        const onField = this.enemies.filter((e) => e.kind === "juiz").length;
        if (onField < (this.t > 80 ? 2 : 1)) {
          this.spawnEnemy("juiz");
          this.announce = "O JUIZ ESTÁ DE OLHO!";
          this.announceT = 1.7;
          this.flash = 0.32;
          this.flashColor = "250,204,21";
          sfx.whistle();
          this.rings.push({ x: this.px, y: this.py, r: 10, max: 120, life: 0.5, w: 3, color: "250,204,21" });
        }
      }
    }

    edgeSpawn() {
      const side = (Math.random() * 4) | 0;
      const m = 10;
      if (side === 0) return { x: rand(this.px0, this.px1), y: this.py0 - m };
      if (side === 1) return { x: rand(this.px0, this.px1), y: this.py1 + m };
      if (side === 2) return { x: this.px0 - m, y: rand(this.py0, this.py1) };
      return { x: this.px1 + m, y: rand(this.py0, this.py1) };
    }

    spawnEnemy(force) {
      if (this.enemies.length > 62) return;
      let kind = force;
      if (!kind) {
        const r = Math.random();
        kind = this.t > 16 && r < 0.2 ? "fumaca" : this.t > 7 && r < 0.45 ? "bandeira" : "torcedor";
      }
      const p = this.edgeSpawn();
      const base = kind === "bandeira" ? 152 : kind === "fumaca" ? 96 : kind === "capitao" ? 176 : kind === "juiz" ? 132 : rand(124, 152);
      const e = {
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        r: kind === "capitao" ? 27 : kind === "bandeira" ? 15 : kind === "fumaca" ? 16 : kind === "juiz" ? 14.5 : 13.5,
        kind,
        speed: kind === "juiz" ? base : base * clamp(1 + this.t / 130, 1, 1.5),
        walk: rand(0, 6),
        state: 0,
        timer: kind === "juiz" ? 0.4 : rand(0.7, 1.6),
        dirx: 0,
        diry: 0,
        flash: 0,
        seed: kind === "juiz" ? 0 : rand(0, 100),
        life: kind === "capitao" ? 26 : kind === "juiz" ? 5 : 0,
        alive: true,
        hitCd: 0,
      };
      if (kind === "juiz") {
        e.dirx = this.px;
        e.diry = this.py;
      }
      this.enemies.push(e);
      this.rings.push({
        x: p.x,
        y: p.y,
        r: 2,
        max: kind === "juiz" ? 40 : 26,
        life: 0.35,
        w: kind === "juiz" ? 3 : 2,
        color: kind === "juiz" ? "250,204,21" : "252,165,165",
      });
    }

    spawnBoss() {
      const p = this.edgeSpawn();
      this.enemies.push({
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        r: 27,
        kind: "capitao",
        speed: 168 * clamp(1 + this.t / 200, 1, 1.3),
        walk: 0,
        state: 0,
        timer: 4,
        dirx: 0,
        diry: 0,
        flash: 0,
        seed: rand(0, 100),
        life: 26,
        alive: true,
        hitCd: 0,
      });
      for (let i = 0; i < 3; i++) this.spawnEnemy("torcedor");
    }

    spawnPickup(kind) {
      const r = kind === "camisa" ? 11 : 14;
      for (let i = 0; i < 24; i++) {
        const x = rand(this.px0 + 30, this.px1 - 30);
        const y = rand(this.py0 + 30, this.py1 - 30);
        if (Math.hypot(x - this.px, y - this.py) < 90) continue;
        if (this.smokes.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + 20)) continue;
        this.pickups.push({ x, y, r, kind, t: 0 });
        return;
      }
    }

    updateEnemies(dt, diff) {
      const es = this.enemies;
      for (let i = es.length - 1; i >= 0; i--) {
        const e = es[i];
        if (!e.alive) {
          es.splice(i, 1);
          continue;
        }
        if (e.hitCd > 0) e.hitCd -= dt;
        if (e.flash > 0) e.flash -= dt;
        e.walk += dt * (2 + Math.hypot(e.vx, e.vy) / 40);
        const dx = this.px - e.x;
        const dy = this.py - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        if (e.kind === "bandeira") {
          e.timer -= dt;
          if (e.state === 0) {
            this.steer(e, nx, ny, e.speed * 0.72, dt);
            if (e.timer <= 0 && dist < 330) {
              e.state = 1;
              e.timer = 0.5;
            }
          } else if (e.state === 1) {
            e.vx *= Math.pow(0.02, dt);
            e.vy *= Math.pow(0.02, dt);
            e.flash = 0.1;
            if (e.timer <= 0) {
              e.state = 2;
              e.timer = 0.62;
              e.dirx = nx;
              e.diry = ny;
              sfx.near();
            }
          } else if (e.state === 2) {
            e.vx = e.dirx * 620;
            e.vy = e.diry * 620;
            if (Math.random() < dt * 40)
              this.part(e.x, e.y, rand(-30, 30), rand(-30, 30), 0.28, rand(2, 4), "rgba(254,202,202,.7)", 2);
            if (e.timer <= 0) {
              e.state = 3;
              e.timer = 0.75;
            }
          } else {
            e.vx *= Math.pow(0.05, dt);
            e.vy *= Math.pow(0.05, dt);
            if (e.timer <= 0) {
              e.state = 0;
              e.timer = rand(1.1, 2);
            }
          }
        } else if (e.kind === "juiz") {
          /* ---- o juiz patrulha, expulsa colorado e pune você ---- */
          e.timer -= dt;
          if (e.timer <= 0 || Math.hypot(e.dirx - e.x, e.diry - e.y) < 34) {
            e.timer = rand(2.2, 3.8);
            e.dirx = rand(this.px0 + 24, this.px1 - 24);
            e.diry = rand(this.py0 + 24, this.py1 - 24);
          }
          let tx = e.dirx - e.x;
          let ty = e.diry - e.y;
          const tl = Math.hypot(tx, ty) || 1;
          const bias = 0.34;
          let mx = nx * bias + (tx / tl) * (1 - bias);
          let my = ny * bias + (ty / tl) * (1 - bias);
          const ml = Math.hypot(mx, my) || 1;
          this.steer(e, mx / ml, my / ml, e.speed, dt);
          if (e.state !== 0 && e.flash <= 0) e.state = 0;

          e.life -= dt;
          if (e.life <= 0) {
            e.life = rand(6.5, 9.5);
            let target = null;
            let bd = 190;
            for (const o of es) {
              if (!o.alive || o === e || o.kind === "juiz" || o.kind === "capitao") continue;
              const d = Math.hypot(o.x - e.x, o.y - e.y);
              if (d < bd) {
                bd = d;
                target = o;
              }
            }
            if (target) {
              target.alive = false;
              this.kills++;
              this.addScore(90);
              this.floatText(target.x, target.y, "CARTÃO VERMELHO!", "#fca5a5", 14);
              this.burst(target.x, target.y, "#ef4444", 16);
              this.rings.push({ x: e.x, y: e.y, r: 8, max: 64, life: 0.42, w: 3, color: "248,113,113" });
              this.showCard(e, 2);
            } else {
              this.floatText(e.x, e.y - 22, "ADVERTÊNCIA", "#fde68a", 12);
              this.showCard(e, 1);
            }
            sfx.whistle();
          }
        } else if (e.kind === "capitao") {
          e.life -= dt;
          this.steer(e, nx, ny, e.speed, dt);
          e.timer -= dt;
          if (e.timer <= 0) {
            e.timer = 6.5;
            for (let k = 0; k < 2; k++) this.spawnEnemy("torcedor");
            this.rings.push({ x: e.x, y: e.y, r: 8, max: 90, life: 0.45, w: 4, color: "248,113,113" });
            this.shake = Math.max(this.shake, 9);
            sfx.wave();
          }
          if (e.life <= 0) {
            e.alive = false;
            this.burst(e.x, e.y, "#f87171", 20);
            this.floatText(e.x, e.y, "CANSOU!", "#fca5a5", 15);
            continue;
          }
        } else {
          const sp = e.kind === "fumaca" ? e.speed : e.speed * (1 + (diff - 1) * 0.25);
          this.steer(e, nx, ny, sp, dt);
          if (e.kind === "fumaca") {
            e.timer -= dt;
            if (e.timer <= 0) {
              e.timer = 2.1;
              if (dist < 420) {
                this.smokes.push({ x: e.x, y: e.y, r: 46, life: 6.5, max: 6.5, seed: rand(0, 100) });
                sfx.smoke();
              }
            }
          }
        }

        // separação simples entre corpos próximos
        for (let j = i - 1; j >= 0 && j > i - 9; j--) {
          const o = es[j];
          if (!o.alive) continue;
          const ddx = e.x - o.x;
          const ddy = e.y - o.y;
          const dd = Math.hypot(ddx, ddy);
          const min = e.r + o.r;
          if (dd > 0.01 && dd < min) {
            const push = ((min - dd) / min) * 90 * dt * 12;
            e.vx += (ddx / dd) * push;
            e.vy += (ddy / dd) * push;
            o.vx -= (ddx / dd) * push;
            o.vy -= (ddy / dd) * push;
          }
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const m = 26;
        e.x = clamp(e.x, this.px0 - m, this.px1 + m);
        e.y = clamp(e.y, this.py0 - m, this.py1 + m);

        /* ---- colisão com você ---- */
        const d2 = Math.hypot(e.x - this.px, e.y - this.py);
        if (d2 < e.r + PLAYER_R - 2) {
          if (e.kind === "juiz") {
            if (this.dashT > 0) {
              if (e.hitCd <= 0) this.redCard(e);
            } else if (e.hitCd <= 0 && e.state === 0) {
              this.yellowCard(e);
            } else {
              const a = Math.atan2(this.py - e.y, this.px - e.x);
              this.pvx += Math.cos(a) * 30;
              this.pvy += Math.sin(a) * 30;
            }
          } else if (e.kind === "capitao") {
            if (this.iframe <= 0) this.damage(e.x, e.y);
          } else if (this.dashT > 0 && e.hitCd <= 0) {
            e.alive = false;
            this.kills++;
            this.addScore(45);
            this.floatText(e.x, e.y, "CARRINHO!", "#fde68a", 15);
            this.burst(e.x, e.y, "#fca5a5", 16);
            this.shake = Math.max(this.shake, 9);
            this.hitStop = Math.max(this.hitStop, 0.05);
            sfx.kill();
          } else if (this.iframe <= 0) {
            this.damage(e.x, e.y);
            e.vx = -nx * 420;
            e.vy = -ny * 420;
            e.hitCd = 0.9;
          } else {
            e.vx += nx * 60;
            e.vy += ny * 60;
          }
        } else if (d2 < e.r + PLAYER_R + 15 && this.iframe <= 0 && this.dashT <= 0 && e.hitCd <= 0 && e.kind !== "fumaca" && e.kind !== "juiz") {
          this.nearMiss(e);
          e.hitCd = 1.2;
        }
      }
    }

    steer(e, nx, ny, speed, dt) {
      const wob = Math.sin(this.t * 2.2 + e.seed) * 0.22;
      const c = Math.cos(wob);
      const s = Math.sin(wob);
      const k = 1 - Math.pow(0.0006, dt);
      e.vx = lerp(e.vx, (nx * c - ny * s) * speed, k);
      e.vy = lerp(e.vy, (nx * s + ny * c) * speed, k);
    }

    nearMiss(e) {
      this.combo++;
      this.comboT = 3.1;
      this.raspoes++;
      this.addScore(22);
      this.slowT = Math.max(this.slowT, 0.13);
      sfx.near();
      this.floatText((e.x + this.px) / 2, (e.y + this.py) / 2 - 12, this.combo > 2 ? `RASPÃO x${this.combo}` : "RASPÃO!", "#a7f3d0", 13);
      this.rings.push({ x: this.px, y: this.py, r: 8, max: 44, life: 0.26, w: 2.5, color: "167,243,208" });
      for (let i = 0; i < 6; i++) {
        const a = rand(0, TAU);
        this.part(this.px, this.py, Math.cos(a) * rand(40, 130), Math.sin(a) * rand(40, 130), 0.3, rand(1.4, 2.6), "#a7f3d0", 0);
      }
    }

    inSmoke(x, y) {
      return this.smokes.some((s) => Math.hypot(x - s.x, y - s.y) < s.r * 0.85);
    }

    updateSmokes(dt) {
      for (let i = this.smokes.length - 1; i >= 0; i--) {
        const s = this.smokes[i];
        s.life -= dt;
        if (s.life <= 0) {
          this.smokes.splice(i, 1);
          continue;
        }
        if (Math.random() < dt * 8) {
          const a = rand(0, TAU);
          this.part(
            s.x + Math.cos(a) * s.r * 0.6,
            s.y + Math.sin(a) * s.r * 0.6,
            rand(-14, 14),
            rand(-24, -6),
            rand(0.7, 1.4),
            rand(6, 13),
            "rgba(203,213,225,.35)",
            2,
          );
        }
      }
    }

    updatePickups(dt) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        p.t += dt;
        const d = Math.hypot(p.x - this.px, p.y - this.py);
        if (d < p.r + PLAYER_R + 4) {
          this.collect(p);
          this.pickups.splice(i, 1);
          continue;
        }
        if (d < 60) {
          p.x = lerp(p.x, this.px, 1 - Math.pow(0.02, dt));
          p.y = lerp(p.y, this.py, 1 - Math.pow(0.02, dt));
        }
        if (p.kind === "camisa" && p.t > 16) this.pickups.splice(i, 1);
      }
    }

    collect(p) {
      if (p.kind === "camisa") {
        this.combo++;
        this.comboT = 3.1;
        this.addScore(50);
        sfx.pickup(this.combo);
        this.floatText(p.x, p.y, `+${Math.round(50 * this.mult)}`, "#fca5a5", 15);
        this.burst(p.x, p.y, "#fbbf24", 12);
      } else if (p.kind === "chimarrao") {
        this.speedBoost = 6;
        sfx.power();
        this.floatText(p.x, p.y, "CHIMARRÃO! VELOCIDADE", "#fcd34d", 15);
        this.rings.push({ x: p.x, y: p.y, r: 6, max: 80, life: 0.45, w: 3, color: "252,211,77" });
        this.burst(p.x, p.y, "#fbbf24", 18);
      } else if (p.kind === "pastel") {
        this.lives = Math.min(3, this.lives + 1);
        sfx.power();
        this.floatText(p.x, p.y, "PASTEL! +1 VIDA", "#86efac", 16);
        this.rings.push({ x: p.x, y: p.y, r: 6, max: 90, life: 0.5, w: 3, color: "134,239,172" });
        this.burst(p.x, p.y, "#4ade80", 20);
      } else if (p.kind === "grito") {
        this.gritoBlast(p.x, p.y);
      }
      this.flash = Math.max(this.flash, 0.25);
      this.flashColor = "255,255,255";
      this.shake = Math.max(this.shake, 6);
    }

    gritoBlast(x, y) {
      sfx.grito();
      this.shake = 26;
      this.flash = 0.7;
      this.flashColor = "255,255,255";
      this.hitStop = 0.08;
      this.slowT = 0.25;
      const reach = Math.max(this.aw, this.ah);
      this.rings.push({ x, y, r: 10, max: reach * 0.85, life: 0.7, w: 9, color: "252,211,77" });
      this.rings.push({ x, y, r: 10, max: reach * 0.7, life: 0.55, w: 4, color: "248,113,113" });
      let n = 0;
      for (const e of this.enemies) {
        if (!e.alive || e.kind === "juiz") continue;
        if (Math.hypot(e.x - x, e.y - y) < reach * 0.62) {
          e.alive = false;
          this.kills++;
          this.burst(e.x, e.y, e.kind === "capitao" ? "#fbbf24" : "#fca5a5", 14);
          n++;
        }
      }
      this.smokes.length = 0;
      const gain = 30 * n + 120;
      this.addScore(gain);
      this.floatText(x, y, `GRITO DA TORCIDA! +${Math.round(gain * this.mult)}`, "#fde68a", 20);
    }

    addScore(v) {
      this.score += v * this.mult;
    }

    /* ---------------- cartões do juiz ---------------- */
    showCard(e, kind) {
      e.state = kind;
      e.flash = 0.7;
      e.hitCd = Math.max(e.hitCd, 1.4);
    }

    yellowCard(e) {
      e.hitCd = 2.4;
      e.flash = 0.8;
      this.showCard(e, 1);
      sfx.whistle();
      this.combo = 0;
      this.mult = 1;
      this.score = Math.max(0, this.score - 120);
      this.dashLock = 2.6;
      this.shake = Math.max(this.shake, 14);
      this.flash = 0.45;
      this.flashColor = "250,204,21";
      this.hitStop = 0.055;
      this.slowT = Math.max(this.slowT, 0.12);
      this.announce = "CARTÃO AMARELO";
      this.announceT = 1.1;
      const a = Math.atan2(this.py - e.y, this.px - e.x);
      this.pvx = Math.cos(a) * 320;
      this.pvy = Math.sin(a) * 320;
      e.vx = -Math.cos(a) * 240;
      e.vy = -Math.sin(a) * 240;
      this.floatText(this.px, this.py - 26, "-120 E SEM CARRINHO", "#fde68a", 15);
      this.burst(e.x, e.y, "#facc15", 14);
      this.rings.push({ x: e.x, y: e.y, r: 8, max: 74, life: 0.4, w: 3.5, color: "250,204,21" });
    }

    redCard(e) {
      this.showCard(e, 2);
      e.hitCd = 3;
      sfx.whistle();
      this.lives--;
      this.iframe = IFRAMES + 0.5;
      this.combo = 0;
      this.mult = 1;
      this.dashT = 0;
      this.dashLock = 3.4;
      this.shake = 28;
      this.flash = 0.95;
      this.flashColor = "239,68,68";
      this.hitStop = 0.13;
      this.slowT = 0.32;
      this.announce = "CARTÃO VERMELHO!";
      this.announceT = 1.7;
      const a = Math.atan2(this.py - e.y, this.px - e.x);
      this.pvx = Math.cos(a) * 540;
      this.pvy = Math.sin(a) * 540;
      this.floatText(this.px, this.py - 28, "EXPULSO!", "#fca5a5", 20);
      this.burst(e.x, e.y, "#ef4444", 26);
      this.rings.push({ x: this.px, y: this.py, r: 10, max: 140, life: 0.5, w: 5, color: "239,68,68" });
      const p = this.edgeSpawn();
      e.x = p.x;
      e.y = p.y;
      e.life = 7;
      for (const o of this.enemies) {
        const d = Math.hypot(o.x - this.px, o.y - this.py);
        if (d < 160 && o.kind !== "juiz") {
          const ang = Math.atan2(o.y - this.py, o.x - this.px);
          o.vx = Math.cos(ang) * 500;
          o.vy = Math.sin(ang) * 500;
          o.hitCd = 1.2;
        }
      }
      if (this.lives <= 0) this.gameOver();
    }

    damage(sx, sy) {
      this.lives--;
      this.iframe = IFRAMES;
      this.combo = 0;
      this.mult = 1;
      this.shake = 22;
      this.flash = 0.85;
      this.flashColor = "96,165,250";
      this.hitStop = 0.1;
      this.slowT = 0.22;
      sfx.hit();
      const a = Math.atan2(this.py - sy, this.px - sx);
      this.pvx = Math.cos(a) * 460;
      this.pvy = Math.sin(a) * 460;
      this.dashT = 0;
      this.floatText(this.px, this.py - 22, this.lives > 0 ? "PEGOU!" : "ACABOU!", "#93c5fd", 20);
      this.burst(this.px, this.py, "#60a5fa", 26);
      this.rings.push({ x: this.px, y: this.py, r: 10, max: 130, life: 0.45, w: 5, color: "96,165,250" });
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 150) {
          const ang = Math.atan2(e.y - this.py, e.x - this.px);
          e.vx = Math.cos(ang) * 520;
          e.vy = Math.sin(ang) * 520;
          e.hitCd = 1.2;
          if (e.kind !== "capitao" && d < 90) {
            e.alive = false;
            this.burst(e.x, e.y, "#fca5a5", 10);
          }
        }
      }
      if (this.lives <= 0) this.gameOver();
    }

    gameOver() {
      this.dead = true;
      this.running = false;
      this.shake = 30;
      this.flash = 1;
      this.flashColor = "96,165,250";
      this.burst(this.px, this.py, "#60a5fa", 60);
      sfx.over();
      this.hooks.onGameOver({
        score: Math.floor(this.score),
        time: this.t,
        wave: this.wave,
        kills: this.kills,
        raspoes: this.raspoes,
      });
    }

    /* ---------------- partículas ---------------- */
    part(x, y, vx, vy, life, size, color, kind) {
      if (this.parts.length > 460) return;
      this.parts.push({
        x,
        y,
        vx,
        vy,
        life,
        max: life,
        size,
        color,
        kind,
        rot: rand(0, TAU),
        vrot: rand(-8, 8),
        drag: kind === 2 ? 0.4 : 0.06,
        grav: kind === 1 ? 130 : kind === 2 ? -20 : 0,
      });
    }

    burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        const sp = rand(60, 320);
        const conf = Math.random() < 0.45;
        this.part(
          x,
          y,
          Math.cos(a) * sp,
          Math.sin(a) * sp,
          rand(0.3, 0.75),
          rand(2, 4.6),
          conf ? pick(["#f8fafc", color, "#1e293b"]) : color,
          conf ? 1 : 0,
        );
      }
    }

    floatText(x, y, text, color, size) {
      if (this.texts.length > 26) this.texts.shift();
      this.texts.push({ x, y, vy: -46, life: 0.95, max: 0.95, text, color, size });
    }

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.parts.splice(i, 1);
          continue;
        }
        p.vy += p.grav * dt;
        const d = Math.pow(p.drag, dt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= Math.pow(0.1, dt);
        if (t.life <= 0) this.texts.splice(i, 1);
      }
    }

    /* ---------------- render ---------------- */
    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = "#05070c";
      ctx.fillRect(0, 0, this.vw, this.vh);

      ctx.save();
      ctx.translate(this.ox, this.oy);
      ctx.scale(this.scale, this.scale);
      if (this.shake > 0.05) {
        const m = this.shake;
        ctx.translate(rand(-m, m) * 0.5, rand(-m, m) * 0.5);
        ctx.rotate(rand(-m, m) * 0.0009);
      }

      if (this.bg) ctx.drawImage(this.bg, 0, 0, this.aw, this.ah);
      else {
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(0, 0, this.aw, this.ah);
      }

      // flashes de câmera na torcida
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.4) {
          const edge = Math.random();
          let x;
          let y;
          if (edge < 0.5) {
            x = rand(4, this.aw - 4);
            y = Math.random() < 0.5 ? rand(4, this.stand - 8) : rand(this.ah - this.stand + 8, this.ah - 4);
          } else {
            y = rand(4, this.ah - 4);
            x = Math.random() < 0.5 ? rand(4, this.stand - 8) : rand(this.aw - this.stand + 8, this.aw - 4);
          }
          ctx.globalAlpha = rand(0.3, 0.85);
          ctx.fillRect(x, y, rand(1.5, 3), rand(1.5, 3));
        }
      }
      ctx.globalAlpha = 1;

      this.drawSmokes(ctx);
      this.drawPickups(ctx);

      ctx.fillStyle = "rgba(0,0,0,.3)";
      for (const e of this.enemies) {
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.72, e.r * 0.82, e.r * 0.36, 0, 0, TAU);
        ctx.fill();
      }
      if (this.running || this.dead) {
        ctx.beginPath();
        ctx.ellipse(this.px, this.py + 11, 11, 4.6, 0, 0, TAU);
        ctx.fill();
      }

      this.drawEnemies(ctx);
      if (!this.dead) this.drawPlayer(ctx);
      this.drawParts(ctx);
      this.drawRings(ctx);
      this.drawTexts(ctx);
      ctx.restore();

      // flash de tela
      if (this.flash > 0.01) {
        ctx.fillStyle = `rgba(${this.flashColor},${clamp(this.flash * 0.5, 0, 0.6)})`;
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
      if (this.speedBoost > 0) {
        const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.35, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.7);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(251,191,36,${0.16 + Math.sin(this.t * 8) * 0.05})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
      if (this.lives === 1 && this.running && !this.paused) {
        const pulse = 0.16 + Math.sin(this.t * 6) * 0.08;
        const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.25, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.62);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(220,38,38,${pulse})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.vw, this.vh);
      }

      // aviso grande
      if (this.announceT > 0 && this.announce) {
        const k = clamp(this.announceT / 1.5, 0, 1);
        const size = Math.min(this.vw * 0.09, 60);
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.8);
        ctx.font = `900 ${size}px Anton, Impact, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = size * 0.14;
        ctx.strokeStyle = "rgba(0,0,0,.7)";
        ctx.strokeText(this.announce, this.vw / 2, this.vh * 0.2);
        ctx.fillStyle = "#fca5a5";
        ctx.fillText(this.announce, this.vw / 2, this.vh * 0.2);
        ctx.restore();
      }

      // joystick virtual
      if (this.joyId !== -1) {
        const x = this.jox0 * this.scale + this.ox;
        const y = this.joy0 * this.scale + this.oy;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 62, 0, TAU);
        ctx.strokeStyle = "rgba(248,250,252,.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(x + this.jox * 62, y + this.joy * 62, 24, 0, TAU);
        ctx.fillStyle = "rgba(29,78,216,.9)";
        ctx.fill();
        ctx.restore();
      }
    }

    drawSmokes(ctx) {
      for (const s of this.smokes) {
        const a = clamp(s.life / s.max, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.16 * a + 0.12 * Math.sin(this.t * 3 + s.seed) * a;
        const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.15, s.x, s.y, s.r);
        g.addColorStop(0, "rgba(226,232,240,.9)");
        g.addColorStop(1, "rgba(148,163,184,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    drawPickups(ctx) {
      for (const p of this.pickups) {
        const bob = Math.sin(p.t * 4) * 2.6;
        const fade = p.kind === "camisa" && p.t > 13 ? (Math.sin(p.t * 18) > 0 ? 0.35 : 1) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y + bob);
        const col = p.kind === "camisa" ? "239,68,68" : p.kind === "chimarrao" ? "251,191,36" : p.kind === "pastel" ? "74,222,128" : "250,204,21";
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.r * 2.6);
        g.addColorStop(0, `rgba(${col},.55)`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 2.6, 0, TAU);
        ctx.fill();

        if (p.kind === "camisa") {
          // camisa tricolor
          ctx.fillStyle = "#1d4ed8";
          ctx.beginPath();
          ctx.moveTo(-8, -6);
          ctx.lineTo(-3.5, -9);
          ctx.lineTo(3.5, -9);
          ctx.lineTo(8, -6);
          ctx.lineTo(6, 8);
          ctx.lineTo(-6, 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#0b1220";
          ctx.fillRect(-3.2, -8, 2, 15.5);
          ctx.fillRect(1.4, -8, 2, 15.5);
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.fillRect(-6, 5, 12, 2);
        } else if (p.kind === "chimarrao") {
          ctx.fillStyle = "#92400e";
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "#65a30d";
          ctx.beginPath();
          ctx.arc(0, -1, 6.4, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(4, -8);
          ctx.lineTo(9, -14);
          ctx.stroke();
        } else if (p.kind === "pastel") {
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(9, 7);
          ctx.lineTo(-9, 7);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(180,83,9,.75)";
          ctx.fillRect(-4, -2, 8, 2);
        } else {
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(6, -10);
          ctx.lineTo(6, 10);
          ctx.lineTo(-8, 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#b45309";
          ctx.fillRect(-11, -4, 4, 8);
          ctx.strokeStyle = "rgba(255,255,255,.9)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(6, 0, 8 + i * 4, -0.7, 0.7);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    drawEnemies(ctx) {
      for (const e of this.enemies) {
        const ang = Math.atan2(e.vy, e.vx) || 0;
        const flash = e.flash > 0 ? 0.3 + Math.sin(this.t * 42) * 0.35 : 0;
        const kit = MOB_KITS[(e.seed | 0) % MOB_KITS.length];

        if (e.kind === "juiz") {
          const g = ctx.createRadialGradient(e.x, e.y, e.r * 0.3, e.x, e.y, e.r * 2.8);
          g.addColorStop(0, "rgba(250,204,21,.3)");
          g.addColorStop(1, "rgba(250,204,21,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 2.8, 0, TAU);
          ctx.fill();
          const card = e.state === 2 ? "vermelho" : e.state === 1 ? "amarelo" : null;
          drawFootballer(ctx, e.x, e.y, e.r, ang, e.walk, KIT_JUIZ, {
            card,
            whistle: true,
            flash,
            point: card ? undefined : ang + Math.sin(this.t * 2) * 0.5,
          });
        } else if (e.kind === "capitao") {
          const g = ctx.createRadialGradient(e.x, e.y, e.r * 0.4, e.x, e.y, e.r * 2.3);
          g.addColorStop(0, "rgba(239,68,68,.42)");
          g.addColorStop(1, "rgba(239,68,68,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 2.3, 0, TAU);
          ctx.fill();
          drawFootballer(ctx, e.x, e.y, e.r, ang, e.walk, KIT_MOB_CAP, { eyes: true, armband: true, beard: true, flash });
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(ang);
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.moveTo(e.r * 0.6, -e.r * 0.28);
          ctx.lineTo(e.r * 1.5, -e.r * 0.62);
          ctx.lineTo(e.r * 1.5, e.r * 0.62);
          ctx.lineTo(e.r * 0.6, e.r * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(2,6,23,.35)";
          ctx.fillRect(e.r * 0.55, -e.r * 0.3, e.r * 0.14, e.r * 0.6);
          ctx.restore();
          ctx.strokeStyle = "rgba(252,211,77,.85)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e.life / 26, 0, 1));
          ctx.stroke();
        } else if (e.kind === "bandeira") {
          const telegraph = e.state === 1;
          drawFootballer(ctx, e.x, e.y, e.r, ang, e.walk, kit, {
            cap: true,
            flash: telegraph ? 0.35 + Math.sin(this.t * 40) * 0.4 : flash,
          });
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(ang);
          const wav = Math.sin(this.t * 9 + e.seed) * 0.3;
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.r * 0.3, -e.r * 0.5);
          ctx.lineTo(e.r * 1.5, -e.r * 0.9);
          ctx.stroke();
          ctx.fillStyle = telegraph ? "#fde68a" : "#dc2626";
          ctx.beginPath();
          ctx.moveTo(e.r * 1.5, -e.r * 0.9);
          ctx.lineTo(e.r * 2.5, -e.r * 0.6 + wav * 8);
          ctx.lineTo(e.r * 1.55, -e.r * 0.1);
          ctx.closePath();
          ctx.fill();
          if (e.state === 2) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#fca5a5";
            ctx.beginPath();
            ctx.ellipse(-e.r, 0, e.r * 1.4, e.r * 0.6, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.restore();
        } else if (e.kind === "fumaca") {
          drawFootballer(ctx, e.x, e.y, e.r, ang, e.walk, { ...kit, shorts: "#7f1d1d" }, { bandana: true, flash });
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(ang);
          ctx.fillStyle = "#cbd5e1";
          ctx.beginPath();
          ctx.arc(e.r * 0.95, 0, e.r * 0.34, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(e.r * 0.7, -e.r * 0.1, e.r * 0.3, e.r * 0.2);
          ctx.restore();
        } else {
          const v = (e.seed | 0) % 3;
          drawFootballer(ctx, e.x, e.y, e.r, ang, e.walk, kit, { cap: v === 1, bandana: v === 2, flash });
        }
      }
    }

    drawPlayer(ctx) {
      for (const tr of this.trail) {
        ctx.globalAlpha = clamp(tr.a, 0, 1) * 0.55;
        ctx.fillStyle = this.dashT > 0 ? "#93c5fd" : "#60a5fa";
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, PLAYER_R * (0.5 + tr.a * 0.6), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const blink = this.iframe > 0 && this.dashT <= 0 && Math.sin(this.iframe * 34) < -0.1;
      ctx.globalAlpha = blink ? 0.4 : 1;

      if (this.dashT > 0) {
        const g = ctx.createRadialGradient(this.px, this.py, 2, this.px, this.py, PLAYER_R * 3);
        g.addColorStop(0, "rgba(96,165,250,.55)");
        g.addColorStop(1, "rgba(96,165,250,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.px, this.py, PLAYER_R * 3, 0, TAU);
        ctx.fill();
      }

      // cachecol tricolor
      const bx = -Math.cos(this.pface);
      const by = -Math.sin(this.pface);
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 3.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.px, this.py - 6);
      ctx.quadraticCurveTo(
        this.px + bx * 12 + Math.sin(this.t * 14) * 5,
        this.py + by * 12 + Math.cos(this.t * 14) * 5,
        this.px + bx * 23 + Math.sin(this.t * 14) * 9,
        this.py + by * 23 + Math.cos(this.t * 14) * 9,
      );
      ctx.stroke();
      ctx.strokeStyle = "#0b1220";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      drawFootballer(ctx, this.px, this.py, PLAYER_R, this.pface, this.walk, KIT_PLAYER, {
        eyes: true,
        flash: this.iframe > 0 && this.dashT <= 0 ? 0.12 : 0,
      });

      if (this.dashCd > 0 || this.dashLock > 0) {
        ctx.strokeStyle = this.dashLock > 0 ? "rgba(250,204,21,.95)" : "rgba(253,224,71,.9)";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(this.px, this.py, PLAYER_R + 6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(1 - this.dashCd / DASH_CD, 0, 1));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawParts(ctx) {
      for (const p of this.parts) {
        const a = clamp(p.life / p.max, 0, 1);
        if (p.kind === 2) {
          ctx.globalAlpha = a * 0.5;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
          ctx.fill();
        } else if (p.kind === 1) {
          ctx.globalAlpha = a;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawRings(ctx) {
      for (const r of this.rings) {
        const a = clamp(r.life / 0.7, 0, 1);
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.strokeStyle = `rgb(${r.color})`;
        ctx.lineWidth = r.w * a;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawTexts(ctx) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const t of this.texts) {
        const a = clamp(t.life / t.max, 0, 1);
        const size = t.size * (0.7 + a * 0.45);
        ctx.globalAlpha = a;
        ctx.font = `900 ${size}px Anton, Impact, system-ui, sans-serif`;
        ctx.lineWidth = size * 0.16;
        ctx.strokeStyle = "rgba(2,6,23,.85)";
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================================================================ UI */
  const canvas = $("game");
  const el = {
    hud: $("hud"),
    score: $("score"),
    best: $("best"),
    time: $("time"),
    combo: $("combo"),
    comboVal: $("comboVal"),
    lock: $("lock"),
    fire: $("fire"),
    wave: $("wave"),
    boost: $("boost"),
    hearts: [$("h0"), $("h1"), $("h2")],
    dashHint: $("dashHint"),
    dashBar: $("dashBar"),
    btnDash: $("btnDash"),
    dashRing: $("dashRing"),
    dashLbl: $("dashLbl"),
    btnPause: $("btnPause"),
    btnMute: $("btnMute"),
    scStart: $("scStart"),
    scPause: $("scPause"),
    scOver: $("scOver"),
    btnStart: $("btnStart"),
    startHint: $("startHint"),
    helpMove: document.querySelector("#scStart .help-row"),
    pScore: $("pScore"),
    pTime: $("pTime"),
    pWave: $("pWave"),
    btnResume: $("btnResume"),
    btnRestartP: $("btnRestartP"),
    btnMenuP: $("btnMenuP"),
    record: $("record"),
    oScore: $("oScore"),
    oTime: $("oTime"),
    oKills: $("oKills"),
    oGraze: $("oGraze"),
    saveRow: $("saveRow"),
    nameInput: $("nameInput"),
    btnSave: $("btnSave"),
    savedMsg: $("savedMsg"),
    btnRestart: $("btnRestart"),
    overHint: $("overHint"),
    btnMenu: $("btnMenu"),
    tableStart: $("tableStart"),
    tableOver: $("tableOver"),
  };

  let phase = "menu";
  let result = null;
  let canSave = false;
  let saved = false;
  let muted = ls(MUTE_KEY) === "1";
  let isTouch = false;
  let scores = loadScores();
  const bestScore = () => (scores.length ? scores[0].score : 0);

  sfx.setMuted(muted);
  el.nameInput.value = ls(NAME_KEY);
  if (muted) el.btnMute.textContent = "🔇";

  const game = new Game(canvas, {
    onStats: drawStats,
    onGameOver: (r) => {
      result = r;
      canSave = qualifies(r.score);
      saved = false;
      setPhase("over");
    },
    onPauseRequest: () => {
      if (phase === "playing") setPhase("paused");
      else if (phase === "paused") setPhase("playing");
    },
  });

  /* ---------------- fases ---------------- */
  function setPhase(p) {
    phase = p;
    if (p === "playing") {
      hide(el.scStart);
      hide(el.scPause);
      hide(el.scOver);
      show(el.hud);
      if (isTouch) show(el.btnDash);
      if (!isTouch) show(el.dashHint);
    } else if (p === "paused") {
      game.setPaused(true);
      el.pScore.textContent = fmt(game.score || 0);
      el.pTime.textContent = fmtTime(game.t || 0);
      el.pWave.textContent = String(game.wave || 1);
      show(el.hud);
      hide(el.scStart);
      show(el.scPause);
      hide(el.scOver);
    } else if (p === "over") {
      game.setPaused(false);
      el.oScore.textContent = fmt(result.score);
      el.oTime.textContent = fmtTime(result.time);
      el.oKills.textContent = String(result.kills);
      el.oGraze.textContent = String(result.raspoes);
      result.score >= bestScore() && result.score > 0 ? show(el.record) : hide(el.record);
      canSave && !saved ? show(el.saveRow) : hide(el.saveRow);
      hide(el.savedMsg);
      hide(el.hud);
      hide(el.btnDash);
      hide(el.dashHint);
      hide(el.scPause);
      show(el.scOver);
      renderTable(el.tableOver);
    } else {
      game.toMenu();
      hide(el.hud);
      hide(el.btnDash);
      hide(el.dashHint);
      hide(el.scPause);
      hide(el.scOver);
      show(el.scStart);
      renderTable(el.tableStart);
    }
  }

  /* ---------------- HUD ---------------- */
  const cache = {};
  function set(node, key, val, apply) {
    if (cache[key] === val) return;
    cache[key] = val;
    apply(val);
  }

  function drawStats(s) {
    if (phase !== "playing" && phase !== "paused") return;
    set(el.score, "s", s.score, (v) => (el.score.textContent = fmt(v)));
    set(el.best, "b", bestScore(), (v) => (el.best.textContent = fmt(v)));
    set(el.time, "t", fmtTime(s.time), (v) => (el.time.textContent = v));
    set(el.wave, "w", s.wave, (v) => (el.wave.textContent = `Onda ${v}`));
    set(el.comboVal, "m", s.mult.toFixed(1), (v) => (el.comboVal.textContent = `x${v}`));
    s.combo > 1 ? show(el.combo) : hide(el.combo);
    if (s.lock > 0) {
      show(el.lock);
      const txt = `🟨 sem carrinho ${s.lock.toFixed(1)}s`;
      if (cache.lk !== txt) {
        cache.lk = txt;
        el.lock.textContent = txt;
      }
    } else {
      hide(el.lock);
      cache.lk = "";
    }
    s.combo > 5 ? show(el.fire) : hide(el.fire);
    if (s.speed > 0) {
      show(el.boost);
      const txt = `🧉 ${s.speed.toFixed(1)}s`;
      if (cache.b !== txt) {
        cache.b = txt;
        el.boost.textContent = txt;
      }
    } else {
      hide(el.boost);
      cache.b = "";
    }
    el.hearts.forEach((h, i) => h.classList.toggle("off", s.lives <= i));
    const pct = Math.round(clamp(s.dash, 0, 1) * 100);
    if (cache.d !== pct) {
      cache.d = pct;
      el.dashBar.style.width = `${pct}%`;
      el.dashBar.classList.toggle("full", pct >= 100);
    }
    if (isTouch) {
      const deg = Math.round(clamp(s.dash, 0, 1) * 360);
      if (cache.ring !== deg) {
        cache.ring = deg;
        el.dashRing.style.setProperty("--a", `${deg}deg`);
      }
      const locked = s.lock > 0;
      const mode = locked ? "lock" : pct >= 100 ? "ready" : "cd";
      if (cache.mode !== mode) {
        cache.mode = mode;
        el.dashLbl.textContent = locked ? "🟨" : "Carrinho";
        el.dashRing.style.setProperty("--c", locked ? "#facc15" : mode === "ready" ? "#fcd34d" : "#fb7185");
      }
    }
  }

  /* ---------------- tabela de recordes ---------------- */
  function renderTable(node, hot) {
    const rows = scores
      .map(
        (s, i) => `        <div class="tr${hot && s.date === hot.date ? " hot" : ""}${i === 0 ? " first" : ""}">
          <span class="pos">${i + 1}</span>
          <span class="nm">${escapeHtml(s.name)}</span>
          <span class="wv">Onda ${s.wave}</span>
          <span class="tm">${fmtTime(s.time)}</span>
          <span class="sc">${fmt(s.score)}</span>
        </div>`,
      )
      .join("\n");
    node.innerHTML = `      <div class="table-head"><span>Melhor fuga</span><span>Pontos</span></div>
      <div class="table-body">${rows || '<div class="empty">Ninguém escapou ainda. Seja o primeiro!</div>'}</div>`;
  }
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------------- ações ---------------- */
  function startRun() {
    sfx.unlock();
    sfx.setMuted(muted);
    result = null;
    canSave = false;
    saved = false;
    Object.keys(cache).forEach((k) => delete cache[k]);
    game.startRun();
    setPhase("playing");
  }
  function toMenu() {
    scores = loadScores();
    setPhase("menu");
  }
  function toggleMute() {
    muted = !muted;
    sfx.unlock();
    sfx.setMuted(muted);
    lsSet(MUTE_KEY, muted ? "1" : "0");
    el.btnMute.textContent = muted ? "🔇" : "🔊";
  }
  function doSave() {
    if (!result || saved) return;
    const name = (el.nameInput.value || "").trim().slice(0, 12) || "Tricolor";
    const entry = { name, score: result.score, time: result.time, wave: result.wave, date: Date.now() };
    scores = saveScore(entry);
    lsSet(NAME_KEY, name);
    saved = true;
    hide(el.saveRow);
    show(el.savedMsg);
    renderTable(el.tableOver, entry);
  }

  /* ---------------- eventos ---------------- */
  const press = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  el.btnStart.addEventListener("click", startRun);
  el.btnResume.addEventListener("click", () => setPhase("playing"));
  el.btnRestartP.addEventListener("click", startRun);
  el.btnRestart.addEventListener("click", startRun);
  el.btnMenuP.addEventListener("click", toMenu);
  el.btnMenu.addEventListener("click", toMenu);
  el.btnSave.addEventListener("click", doSave);
  el.btnPause.addEventListener("pointerdown", press(() => setPhase("paused")));
  el.btnMute.addEventListener("pointerdown", press(toggleMute));
  el.btnDash.addEventListener("pointerdown", press(() => game.doDash()));
  el.nameInput.addEventListener("input", () => {
    el.nameInput.value = el.nameInput.value.slice(0, 12);
  });
  el.nameInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") doSave();
  });

  // toque na tela revela os controles móveis
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "mouse" && !isTouch) {
        isTouch = true;
        el.startHint.textContent = "toque para começar";
        el.overHint.textContent = "toque em Fugir de novo";
        el.helpMove.innerHTML = '<span class="muted"> joystick na tela — arraste para correr</span>';
        if (phase === "playing") {
          show(el.btnDash);
          hide(el.dashHint);
        }
      }
      sfx.unlock();
    },
    true,
  );

  // toque no fundo do menu começa o jogo
  el.scStart.addEventListener("pointerdown", (e) => {
    if (e.target === el.scStart) startRun();
  });
  el.scOver.addEventListener("pointerdown", (e) => {
    if (e.target === el.scOver && !canSave) startRun();
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "m") {
      toggleMute();
      return;
    }
    if (phase === "menu") {
      if (k === "enter" || k === " ") {
        e.preventDefault();
        startRun();
      }
    } else if (phase === "over") {
      if (document.activeElement === el.nameInput) return;
      if (k === "enter" || k === " " || k === "r") {
        e.preventDefault();
        startRun();
      } else if (k === "escape") toMenu();
    } else if (phase === "paused") {
      if (k === "enter" || k === "r") {
        e.preventDefault();
        startRun();
      }
    } else if (phase === "playing") {
      if (k === "r") startRun();
    }
  });

  /* ---------------- start ---------------- */
  renderTable(el.tableStart);
  setPhase("menu");
  game.resize();
})();
