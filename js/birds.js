/* Flock of birds that follows the mouse.
   Based on cursor_threejs/portfolio.js, tuned to be faster and lighter.
   Off on touch screens and for visitors who prefer reduced motion.
   To remove the birds, delete the <script src="js/birds.js"> line in each page. */
(() => {
  /* ---- Settings you can change ---- */
  const IMAGES = [1, 2, 3, 4, 5, 6].map((n) => `images/birds/bird${n}.png`);
  const SIZE = 75;          // bird size in pixels
  const SPEED = 5;          // top speed (the original was 0.9)
  const STEERING = 0.15;    // how sharply they change direction (original 0.005)
  const TURN = 0.15;        // how fast the picture rotates to face the way it flies (original 0.009)
  const SPACING = 100;      // how far apart the birds try to stay

  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "birds";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  const mouse = { x: w / 2, y: h / 2 };
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  const limit = (v, max) => {
    const m = Math.hypot(v.x, v.y);
    if (m > max) { v.x = (v.x / m) * max; v.y = (v.y / m) * max; }
    return v;
  };

  // Shrink each picture once to its on-screen size, so every frame
  // copies a small bitmap instead of scaling a large image.
  function sprite(img) {
    const scale = (SIZE * dpr) / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, w: c.width / dpr, h: c.height / dpr };
  }

  class Bird {
    constructor(image) {
      this.image = image;
      this.pos = { x: Math.random() * w, y: Math.random() * h };
      this.vel = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
      this.angle = 0;
    }

    seek(target) {
      const d = { x: target.x - this.pos.x, y: target.y - this.pos.y };
      const m = Math.hypot(d.x, d.y) || 1;
      return limit({ x: (d.x / m) * SPEED - this.vel.x, y: (d.y / m) * SPEED - this.vel.y }, STEERING);
    }

    separate(flock) {
      const away = { x: 0, y: 0 };
      let count = 0;
      for (const other of flock) {
        if (other === this) continue;
        const dx = this.pos.x - other.pos.x, dy = this.pos.y - other.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < SPACING) { away.x += dx / dist; away.y += dy / dist; count++; }
      }
      if (!count) return away;
      const m = Math.hypot(away.x, away.y) || 1;
      return limit({ x: (away.x / m) * SPEED - this.vel.x, y: (away.y / m) * SPEED - this.vel.y }, STEERING);
    }

    update(target, flock, k) {
      const s = this.seek(target);
      const a = this.separate(flock);
      this.vel.x += (s.x + a.x * 1.5) * k;
      this.vel.y += (s.y + a.y * 1.5) * k;
      limit(this.vel, SPEED);
      this.pos.x += this.vel.x * k;
      this.pos.y += this.vel.y * k;

      // Fly off one edge, come back on the other.
      if (this.pos.x > w) this.pos.x = 0; else if (this.pos.x < 0) this.pos.x = w;
      if (this.pos.y > h) this.pos.y = 0; else if (this.pos.y < 0) this.pos.y = h;

      // Turn the picture smoothly towards the direction of flight.
      const goal = Math.atan2(this.vel.y, this.vel.x) + Math.PI / 2;
      const diff = ((goal - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.angle += Math.max(-TURN * k, Math.min(TURN * k, diff));
    }

    draw() {
      const { canvas: img, w: iw, h: ih } = this.image;
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.angle);
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    }
  }

  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });

  Promise.all(IMAGES.map(load)).then((images) => {
    const birds = images.map((img) => new Bird(sprite(img)));
    let last = performance.now();

    function frame(now) {
      // k = 1 at 60 fps; keeps the speed the same on 120 Hz screens.
      const k = Math.min((now - last) / (1000 / 60), 3);
      last = now;

      // The bird closest to the mouse leads; the others follow it.
      let leader = birds[0], best = Infinity;
      for (const b of birds) {
        const d = Math.hypot(mouse.x - b.pos.x, mouse.y - b.pos.y);
        if (d < best) { best = d; leader = b; }
      }

      ctx.clearRect(0, 0, w, h);
      for (const b of birds) {
        b.update(b === leader ? mouse : leader.pos, birds, k);
        b.draw();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }).catch((err) => console.error(err));
})();
