/*
  Background
*/
(() => {
  const canvas = document.getElementById("cv-bg");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const PALETTE = [
    { fill: "#0b62f0", text: "#ffffff" },
    { fill: "#db2a6b", text: "#ffffff" },
    { fill: "#e8a200", text: "#15222b" },
    { fill: "#08856a", text: "#ffffff" },
  ];

  // ar = width / height of the object cluster
  const CLASSES = [
    { name: "bottle", ar: 0.45 },
    { name: "shopping bag", ar: 1.3 },
    { name: "napkin", ar: 1.8 },
    { name: "plastic fork", ar: 1.1 },
    { name: "hair clump", ar: 0.9 },
    { name: "boxes", ar: 2.2 },
    { name: "soda can", ar: 1 },
  ];

  const GRID = 32;
  const MARGIN = 160;
  const PAD = 10;

  let w = 0;
  let h = 0;
  let objects = [];
  let rafId = null;
  let last = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // bell shaped value
  const bell = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function makeObject() {
    const cls = pick(CLASSES);
    const size = rand(40, 85) * clamp(w / 1200, 0.6, 1);
    const rx = size * Math.sqrt(cls.ar);
    const ry = size / Math.sqrt(cls.ar);
    const count = Math.floor(rand(45, 75));
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.15, 0.5);

    return {
      cls: cls.name,
      color: pick(PALETTE),
      x: rand(0, w),
      y: rand(0, h),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.6,
      base: rand(0.82, 0.98),
      phase: rand(0, Math.PI * 2),
      points: Array.from({ length: count }, () => ({
        ox: bell() * rx,
        oy: bell() * ry,
        ph: rand(0, Math.PI * 2),
        r: rand(1.2, 2.6),
      })),
      box: null,
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = clamp(Math.round((w * h) / 110000), 5, 12);
    objects = Array.from({ length: count }, makeObject);

    if (reduceMotion.matches) {
      step(16, 0);
      draw(0);
    }
  }

  function step(dt, t) {
    const k = dt / 16.67;
    const wobble = t * 0.0012;

    for (const o of objects) {
      o.x += o.vx * k;
      o.y += o.vy * k;

      // Wrap around the screen
      if (o.x > w + MARGIN) { o.x = -MARGIN; o.box = null; }
      if (o.x < -MARGIN) { o.x = w + MARGIN; o.box = null; }
      if (o.y > h + MARGIN) { o.y = -MARGIN; o.box = null; }
      if (o.y < -MARGIN) { o.y = h + MARGIN; o.box = null; }

      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of o.points) {
        p.x = o.x + p.ox + Math.sin(wobble + p.ph) * 3;
        p.y = o.y + p.oy + Math.cos(wobble * 1.1 + p.ph) * 3;
        if (p.x < x0) x0 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.x > x1) x1 = p.x;
        if (p.y > y1) y1 = p.y;
      }

      const target = { x0: x0 - PAD, y0: y0 - PAD, x1: x1 + PAD, y1: y1 + PAD };
      if (!o.box) {
        o.box = target;
      } else {
        // box trails the object
        for (const key of ["x0", "y0", "x1", "y1"]) {
          o.box[key] += (target[key] - o.box[key]) * 0.12;
        }
      }
    }
  }

  function drawGrid() {
    ctx.fillStyle = "rgba(21, 34, 43, 0.12)";
    for (let x = GRID / 2; x < w; x += GRID) {
      for (let y = GRID / 2; y < h; y += GRID) {
        ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
    }
  }

  function drawBox(o, t) {
    const b = o.box;
    if (!b) return;

    const conf = clamp(o.base + Math.sin(t * 0.0009 + o.phase) * 0.03, 0.5, 0.99);
    const c = o.color;

    ctx.strokeStyle = c.fill;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);

    // Heavier corner brackets
    const len = Math.min(14, (b.x1 - b.x0) / 3, (b.y1 - b.y0) / 3);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0 + len); ctx.lineTo(b.x0, b.y0); ctx.lineTo(b.x0 + len, b.y0);
    ctx.moveTo(b.x1 - len, b.y0); ctx.lineTo(b.x1, b.y0); ctx.lineTo(b.x1, b.y0 + len);
    ctx.moveTo(b.x1, b.y1 - len); ctx.lineTo(b.x1, b.y1); ctx.lineTo(b.x1 - len, b.y1);
    ctx.moveTo(b.x0 + len, b.y1); ctx.lineTo(b.x0, b.y1); ctx.lineTo(b.x0, b.y1 - len);
    ctx.stroke();

    // Label tag
    const text = `${o.cls} ${conf.toFixed(2)}`;
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    const tw = ctx.measureText(text).width + 10;
    const th = 18;
    const ly = b.y0 - th < 0 ? b.y0 : b.y0 - th;
    ctx.fillStyle = c.fill;
    ctx.fillRect(b.x0, ly, tw, th);
    ctx.fillStyle = c.text;
    ctx.fillText(text, b.x0 + 5, ly + 13);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    drawGrid();

    for (const o of objects) {
      ctx.fillStyle = o.color.fill;
      ctx.globalAlpha = 0.55;
      for (const p of o.points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawBox(o, t);
    }
  }

  function frame(now) {
    const dt = Math.min(50, now - last || 16);
    last = now;
    step(dt, now);
    draw(now);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(rafId);
    if (reduceMotion.matches) {
      step(16, 0);
      draw(0);
      return;
    }
    last = 0;
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  reduceMotion.addEventListener("change", start);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else start();
  });

  resize();
  start();
})();
