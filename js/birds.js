/* Birds that follow the mouse: Eva's flocking code (from cursoreditedbyeva_threejs/portfolio.js).
   Settings are in birdConfig below. Pictures and masks are in images/birds/.
   To remove the birds, delete the <script src="js/birds.js"> line in each page. */
(() => {
// Uses the page's <canvas id="canvas"> if there is one; otherwise adds one on top of the page.
const canvas = document.getElementById('canvas') || document.body.appendChild(document.createElement('canvas'));
canvas.classList.add('birds-canvas');
canvas.setAttribute('aria-hidden', 'true');
const ctx = canvas.getContext('2d');

// Canvas is sized in CSS pixels but backed by device pixels, so it stays sharp on Retina screens.
const view = { width: window.innerWidth, height: window.innerHeight };
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * dpr);
    canvas.height = Math.round(view.height * dpr);
    canvas.style.width = view.width + 'px';
    canvas.style.height = view.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let birds = [];
const birdConfig = {
    numBirds: 6,
    birdSize: 75,
    maxDistance: 600,
    desiredSeparation: 90,
    maxSpeed: 3,
    maxForce: 0.055,
    seekWeight: 0.8,
    separationWeight: 0.9,
    drag: 0.985,
    maxRotationSpeed: 0.08,

    // Orbit: once a bird has touched the cursor and the cursor stays still this long,
    // the whole flock circles around it until the cursor moves again.
    orbitDelaySeconds: 1,
    orbitRadius: 110,
    orbitSpeed: 0.02,       // how fast the circle turns (radians per frame)
    orbitArriveRadius: 60,  // birds slow down when they get this close to their spot on the circle
    orbitBreakDistance: 150, // once circling, the cursor must move this far (px) from where it started for the birds to follow again

    // Click: the birds burst away from the cursor, glide out, then come back.
    scatterSpeed: 9,
    scatterSeconds: 1.5,

    // Rest: after following the cursor this long, the birds fly up and sit on the black line
    // under the site's header. Moving the cursor over them wakes them up again.
    restAfterSeconds: 15,
    navSelector: 'header',      // the birds sit on the bottom border of this element...
    perchLineY: 64,             // ...or, if the page has none, on a line drawn at this height (px from the top)
    lineColor: '#000',
    lineWidth: 1,
    perchArriveRadius: 80,      // birds slow down when they get this close to their spot on the line
    perchMessiness: 1,          // 0 = neat row; higher = more uneven heights, tilts and gaps
    shakeEverySeconds: [1.5, 4], // a random resting bird shakes itself every 1.5–4 seconds
    shakeSeconds: 0.5,

    // LED outline: a thin neon tube around each bird's shape, split into stripes whose colours
    // flow round it. Visitors can switch it on, off or blinking with a small control on the side.
    led: true,
    ledMode: 'on',         // starting mode: 'on', 'off' or 'blink' (a visitor's own choice is remembered)
    ledBlinkSpeed: 1.5,    // blinks per second in 'blink' mode
    ledSwitch: true,       // show the on / off / blink control on the side of the page
    // One colour per bird (taken from an RGB LED strip); each bird's stripes drift a little
    // around its colour, like the gradient along a real strip.
    ledColors: ['#2bff6b', '#d9ff2b', '#ff4a1f', '#ff2fb8', '#8f4bff', '#2b9bff'],
    ledHueDrift: 60,       // how far (in degrees of hue) the colours flow away from the bird's colour (180 = full rainbow)
    ledGap: 3,             // space between the bird and the tube (px)
    ledTubeWidth: 0.8,     // thickness of the tube (px)
    ledStripeLength: 12,   // rough length of each coloured stripe (px)
    ledStripeGap: 0.2,     // dark gap between stripes, as a share of a stripe (0 = none)
    ledGlow: 0.4,        // size of the glow around the tube (0 = none, 1 = normal, 2 = big)
    ledFlowSpeed: 0.25,    // how fast the colours flow round the outline (laps per second, 0 = still)
};

const imagePaths = [1, 2, 3, 4, 5, 6].map(n => `images/birds/bird${n}.png`);
// Black-and-transparent shapes of just the bird in each PNG (without the white backing
// shape the artwork sits on). The LED outline follows these.
const maskPaths = imagePaths.map(path => path.replace('.png', '-mask.png'));

function loadImage(path) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = path;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image at ${path}`));
    });
}

function loadImages() {
    return Promise.all(imagePaths.map(loadImage));
}

// A missing mask isn't fatal: the outline then follows the whole PNG instead.
function loadMasks() {
    return Promise.all(maskPaths.map(path => loadImage(path).catch(() => null)));
}

// The source PNGs are ~3300px wide. Shrinking them to bird size in one step looks jagged,
// so halve them repeatedly, then do one final high-quality resize. Done once at load.
function makeSprite(img, size, ledColor, mask) {
    const scale = 2 * (window.devicePixelRatio || 1);
    const ratio = img.width / img.height;
    const targetW = Math.round((ratio >= 1 ? size : size * ratio) * scale);
    const targetH = Math.round((ratio >= 1 ? size / ratio : size) * scale);

    let source = img;
    let w = img.width;
    let h = img.height;
    while (w / 2 > targetW) {
        w = Math.round(w / 2);
        h = Math.round(h / 2);
        const step = document.createElement('canvas');
        step.width = w;
        step.height = h;
        const stepCtx = step.getContext('2d');
        stepCtx.imageSmoothingQuality = 'high';
        stepCtx.drawImage(source, 0, 0, w, h);
        source = step;
    }

    const sprite = document.createElement('canvas');
    sprite.width = targetW;
    sprite.height = targetH;
    const spriteCtx = sprite.getContext('2d');
    spriteCtx.imageSmoothingQuality = 'high';
    spriteCtx.drawImage(source, 0, 0, targetW, targetH);
    sprite.drawWidth = targetW / scale;
    sprite.drawHeight = targetH / scale;
    if (birdConfig.led) sprite.led = makeLed(sprite, scale, ledColor, mask);
    sprite.shapePoints = shapePoints(mask || sprite, sprite.drawWidth, sprite.drawHeight);
    return sprite;
}

// Points covering the bird's shape (from its mask), relative to its centre, in CSS pixels.
// Used to find its lowest point at a given tilt, so its feet rest exactly on the line.
// Reading pixels isn't allowed when the page is opened straight from a file; the bird
// then rests by the bottom of its picture instead.
function shapePoints(source, w, h) {
    try {
        const c = document.createElement('canvas');
        c.width = Math.ceil(w);
        c.height = Math.ceil(h);
        const g = c.getContext('2d');
        g.drawImage(source, 0, 0, c.width, c.height);
        const data = g.getImageData(0, 0, c.width, c.height).data;
        const points = [];
        for (let y = 0; y < c.height; y += 2) {
            for (let x = 0; x < c.width; x += 2) {
                if (data[(y * c.width + x) * 4 + 3] > 128) points.push({ x: x - w / 2, y: y - h / 2 });
            }
        }
        return points.length ? points : null;
    } catch (e) {
        return null;
    }
}

// How far below its centre a bird reaches when tilted by angle.
function lowestPoint(sprite, angle) {
    const points = sprite.shapePoints;
    if (!points) return sprite.drawHeight / 2;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    let lowest = -Infinity;
    for (const p of points) lowest = Math.max(lowest, p.x * sin + p.y * cos);
    return lowest;
}

// Builds the LED outline for one sprite. It only uses canvas drawing and compositing
// (no pixel reads), so it also works when the page is opened straight from a file.
// The tube's shape (a band just outside the bird) and its glow are built once at load;
// the coloured stripes are painted onto them every frame so the colours can flow round.
function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: s * 100, l: l * 100 };
}

function makeLed(sprite, scale, baseColor, mask) {
    const gap = birdConfig.ledGap * scale;
    const tube = birdConfig.ledTubeWidth * scale;
    const glow = 5 * birdConfig.ledGlow * scale;
    const center = gap + tube / 2;  // distance from the bird to the middle of the tube
    const pad = Math.ceil(center + tube / 2 + glow + 2);
    const W = sprite.width + pad * 2;
    const H = sprite.height + pad * 2;

    const newCanvas = () => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        return c;
    };

    // The bird's silhouette (from its mask), ignoring nearly invisible pixels at the edges.
    // Without pixel reads we threshold the alpha by compositing: drawing a layer onto itself
    // with 'destination-in' squares its alpha (faint pixels vanish), and with 'source-over'
    // boosts it (solid pixels get fully solid). Doing both a few times keeps only the parts
    // that are more than roughly 60% opaque.
    const shape = document.createElement('canvas');
    shape.width = sprite.width;
    shape.height = sprite.height;
    const shapeCtx = shape.getContext('2d');
    shapeCtx.imageSmoothingQuality = 'high';
    shapeCtx.drawImage(mask || sprite, 0, 0, shape.width, shape.height);
    shapeCtx.globalCompositeOperation = 'source-in';
    shapeCtx.fillStyle = '#000';
    shapeCtx.fillRect(0, 0, shape.width, shape.height);
    for (let round = 0; round < 2; round++) {
        shapeCtx.globalCompositeOperation = 'destination-in';
        shapeCtx.drawImage(shape, 0, 0);
        shapeCtx.drawImage(shape, 0, 0);
        shapeCtx.globalCompositeOperation = 'source-over';
        shapeCtx.drawImage(shape, 0, 0);
        shapeCtx.drawImage(shape, 0, 0);
    }

    // The silhouette grown outwards by r.
    const grown = (r) => {
        const c = newCanvas();
        const g = c.getContext('2d');
        const steps = 48;
        g.drawImage(shape, pad, pad);
        for (const radius of [r / 3, (r * 2) / 3, r]) {
            if (radius <= 0) continue;
            for (let i = 0; i < steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                g.drawImage(shape, pad + Math.cos(a) * radius, pad + Math.sin(a) * radius);
            }
        }
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        return c;
    };

    // A band of the given half-thickness centred on the tube line.
    const band = (halfWidth) => {
        const c = grown(center + halfWidth);
        const g = c.getContext('2d');
        g.globalCompositeOperation = 'destination-out';
        g.drawImage(grown(Math.max(0, center - halfWidth)), 0, 0);
        return c;
    };

    // Stripes: wedges around the bird's centre. Their colour drifts smoothly around the
    // bird's own colour as you go round, like the gradient along an RGB LED strip.
    const avgRadius = (sprite.width + sprite.height) / 4 + center;
    let count = Math.max(6, Math.round((2 * Math.PI * avgRadius) / (birdConfig.ledStripeLength * scale)));
    const base = hexToHsl(baseColor);
    const driftStart = Math.random() * Math.PI * 2;
    const wedge = (2 * Math.PI) / count;
    const gapAngle = wedge * birdConfig.ledStripeGap;
    const reach = Math.hypot(W, H);

    // Masks, built once: the soft glow (stacked bands that get fainter further out),
    // the tube, and its white-hot centre line.
    const glowMask = newCanvas();
    if (birdConfig.ledGlow > 0) {
        const g = glowMask.getContext('2d');
        g.globalAlpha = 0.12;
        for (const f of [1, 0.75, 0.5, 0.3, 0.15]) g.drawImage(band(tube / 2 + glow * f), 0, 0);
    }
    const tubeMask = band(tube / 2);

    // The white centre line never changes colour, so it is drawn once (with the stripe gaps cut out).
    const core = newCanvas();
    const coreCtx = core.getContext('2d');
    coreCtx.fillStyle = '#fff';
    for (let k = 0; k < count; k++) {
        const a0 = k * wedge + gapAngle / 2;
        coreCtx.beginPath();
        coreCtx.moveTo(W / 2, H / 2);
        coreCtx.arc(W / 2, H / 2, reach, a0, a0 + wedge - gapAngle);
        coreCtx.closePath();
        coreCtx.fill();
    }
    coreCtx.globalCompositeOperation = 'destination-in';
    coreCtx.drawImage(band(Math.max(1, tube * 0.18)), 0, 0);

    const work = newCanvas();
    const workCtx = work.getContext('2d');

    // Paint the stripes for this moment onto a mask and return the result.
    // Each stripe's colour drifts around the bird's colour; flow shifts that pattern round the outline.
    const paint = (mask, flow, withGaps) => {
        workCtx.globalCompositeOperation = 'source-over';
        workCtx.clearRect(0, 0, W, H);
        const cutAngle = withGaps ? gapAngle : 0;
        // Overlap gapless wedges slightly so no hairline seams show between them.
        const overlap = withGaps ? 0 : 0.01;
        for (let k = 0; k < count; k++) {
            const hue = base.h + birdConfig.ledHueDrift * Math.sin(driftStart + (k / count) * Math.PI * 4 - flow);
            workCtx.fillStyle = `hsl(${hue}, ${base.s}%, ${base.l}%)`;
            const a0 = k * wedge + cutAngle / 2;
            workCtx.beginPath();
            workCtx.moveTo(W / 2, H / 2);
            workCtx.arc(W / 2, H / 2, reach, a0 - overlap, a0 + wedge - cutAngle + overlap);
            workCtx.closePath();
            workCtx.fill();
        }
        workCtx.globalCompositeOperation = 'destination-in';
        workCtx.drawImage(mask, 0, 0);
        return work;
    };

    return {
        width: W / scale,
        height: H / scale,
        // Draws the whole LED outline centred on (0, 0) of the given context.
        draw(target, flow, brightness) {
            const x = -this.width / 2, y = -this.height / 2;
            if (birdConfig.ledGlow > 0) {
                target.globalAlpha = 0.9 * brightness;
                target.drawImage(paint(glowMask, flow, false), x, y, this.width, this.height);
            }
            target.globalAlpha = brightness;
            target.drawImage(paint(tubeMask, flow, true), x, y, this.width, this.height);
            target.globalAlpha = 0.9 * brightness;
            target.drawImage(core, x, y, this.width, this.height);
            target.globalAlpha = 1;
        },
    };
}

class Bird {
    constructor(x, y, image) {
        this.position = { x: x, y: y };
        this.velocity = {
            x: (Math.random() * 2 - 1) * birdConfig.maxSpeed,
            y: (Math.random() * 2 - 1) * birdConfig.maxSpeed,
        };
        this.acceleration = { x: 0, y: 0 };
        this.size = birdConfig.birdSize;
        this.image = image;
        this.maxForce = birdConfig.maxForce;
        this.maxSpeed = birdConfig.maxSpeed;
        this.angle = 0;
        this.maxRotationSpeed = birdConfig.maxRotationSpeed;
        this.perchX = 0;
        this.perchOffsetY = 0;  // how far this bird's middle sits above (-) or below (+) the line
        this.perchAngle = 0;    // the slight tilt it rests at
        this.perched = false;
        this.shakeStart = 0;
        this.ledPhase = Math.random() * Math.PI * 2;  // so the birds' colours don't all flow in sync
        this.shakeUntil = 0;
    }

    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    seek(target, arriveRadius = 0) {
        let desired = {
            x: target.x - this.position.x,
            y: target.y - this.position.y
        };
        let mag = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
        if (mag > 0) {
            let speed = this.maxSpeed;
            if (arriveRadius > 0 && mag < arriveRadius) speed *= mag / arriveRadius;
            desired.x = (desired.x / mag) * speed;
            desired.y = (desired.y / mag) * speed;
        }
        let steer = {
            x: desired.x - this.velocity.x,
            y: desired.y - this.velocity.y
        };
        steer.x = Math.min(Math.max(steer.x, -this.maxForce), this.maxForce);
        steer.y = Math.min(Math.max(steer.y, -this.maxForce), this.maxForce);
        return steer;
    }

    separate(birds) {
        let steer = { x: 0, y: 0 };
        let count = 0;
        for (let other of birds) {
            if (other !== this) {
                let dx = this.position.x - other.position.x;
                let dy = this.position.y - other.position.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < birdConfig.desiredSeparation && distance > 0) {
                    let force = {
                        x: dx / distance,
                        y: dy / distance
                    };
                    steer.x += force.x;
                    steer.y += force.y;
                    count++;
                }
            }
        }
        if (count > 0) {
            steer.x /= count;
            steer.y /= count;
            let mag = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
            if (mag > 0) {
                steer.x = (steer.x / mag) * this.maxSpeed;
                steer.y = (steer.y / mag) * this.maxSpeed;
                steer.x -= this.velocity.x;
                steer.y -= this.velocity.y;
                steer.x = Math.min(Math.max(steer.x, -this.maxForce), this.maxForce);
                steer.y = Math.min(Math.max(steer.y, -this.maxForce), this.maxForce);
            }
        }
        return steer;
    }

    // mode is 'follow', 'orbit', 'scatter' or 'perch'.
    update(target, birds, mode) {
        if (mode === 'scatter') {
            // Coast outward on the burst from the click and let drag slow the bird down.
            this.velocity.x *= birdConfig.drag;
            this.velocity.y *= birdConfig.drag;
            this.move();
            return;
        }

        if (mode === 'perch' && this.perched) {
            // Sitting on the line: stay put and settle into its resting tilt.
            this.position.x = target.x;
            this.position.y = target.y;
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.turnTowards(this.perchAngle);
            this.draw(this.shakeOffset());
            return;
        }

        const arriveRadius = mode === 'orbit' ? birdConfig.orbitArriveRadius
            : mode === 'perch' ? birdConfig.perchArriveRadius
            : 0;
        let seekForce = this.seek(target, arriveRadius);
        let separateForce = this.separate(birds);
        // While orbiting or perching, each bird has its own spot, so separation is mostly unneeded.
        const separationWeight = mode === 'follow' ? birdConfig.separationWeight : birdConfig.separationWeight * 0.2;

        seekForce.x *= birdConfig.seekWeight;
        seekForce.y *= birdConfig.seekWeight;
        separateForce.x *= separationWeight;
        separateForce.y *= separationWeight;

        this.applyForce(seekForce);
        this.applyForce(separateForce);

        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;
        this.velocity.x *= birdConfig.drag;
        this.velocity.y *= birdConfig.drag;

        let speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }

        this.acceleration.x = 0;
        this.acceleration.y = 0;

        if (mode === 'perch') {
            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 2) {
                this.perched = true;
                this.position.x = target.x;
                this.position.y = target.y;
            }
            // Straighten up during the last stretch so the bird lands at its resting tilt.
            this.move(distance < 40 ? this.perchAngle : null, true);
            return;
        }

        this.move();
    }

    turnTowards(desiredAngle) {
        let angleDiff = desiredAngle - this.angle;
        angleDiff = (angleDiff + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        let rotation = Math.max(-this.maxRotationSpeed, Math.min(this.maxRotationSpeed, angleDiff));
        this.angle += rotation;
    }

    // landingAngle: face this angle instead of the direction of flight (used when landing).
    move(landingAngle = null, allowAboveTop = false) {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        if (this.position.x > view.width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = view.width;
        // Top and bottom edges bounce instead of wrapping, so birds never fly off the top
        // and pop up from the bottom of the page (or the other way round).
        if (this.position.y < 0 && !allowAboveTop) {
            this.position.y = 0;
            this.velocity.y = Math.abs(this.velocity.y);
        } else if (this.position.y > view.height) {
            this.position.y = view.height;
            this.velocity.y = -Math.abs(this.velocity.y);
        }

        // Face the direction of flight (or the resting tilt when landing).
        this.turnTowards(landingAngle !== null ? landingAngle : Math.atan2(this.velocity.y, this.velocity.x) + Math.PI / 2);

        this.draw();
    }

    // A quick ruffle that fades out: a fast wobble side to side with a tiny hop.
    shakeOffset() {
        const now = performance.now();
        if (now >= this.shakeUntil) return { x: 0, y: 0, angle: 0 };
        const t = (now - this.shakeStart) / 1000;
        const fade = 1 - (now - this.shakeStart) / (this.shakeUntil - this.shakeStart);
        const wobble = Math.sin(t * 45) * fade;
        return { x: wobble * 1.5, y: -Math.abs(Math.sin(t * 22)) * 2 * fade, angle: wobble * 0.15 };
    }

    // How bright the LED outline is right now: off, fully on, or blinking (all birds in step).
    ledBrightness() {
        if (ledMode === 'off') return 0;
        if (ledMode === 'blink') {
            const t = (performance.now() / 1000) * birdConfig.ledBlinkSpeed;
            return t % 1 < 0.5 ? 1 : 0;
        }
        return 1;
    }

    draw(offset = { x: 0, y: 0, angle: 0 }) {
        ctx.save();
        ctx.translate(this.position.x + offset.x, this.position.y + offset.y);
        ctx.rotate(this.angle + offset.angle);
        const w = this.image.drawWidth;
        const h = this.image.drawHeight;
        const led = this.image.led;
        if (led) {
            // The colours flow round the outline, like an RGB LED strip cycling.
            const flow = (performance.now() / 1000) * birdConfig.ledFlowSpeed * Math.PI * 2 + this.ledPhase;
            const brightness = this.ledBrightness();
            if (brightness > 0) led.draw(ctx, flow, brightness);
        }
        ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}

const cursor = {
    x: view.width / 2,
    y: view.height / 2,
    lastMoved: performance.now(),
    touched: false,  // has a bird touched the cursor since it last moved?
    scatterUntil: 0,
    orbiting: false,
    orbitAnchor: { x: 0, y: 0 },  // where the cursor was when the circling started
};
let orbitAngle = 0;

const flock = {
    activeSince: performance.now(),  // when the birds last woke up and started following
    resting: false,
    nextShake: 0,
};

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

// The top of the header's bottom border, so the birds stand on the line, not in it.
// It moves with the page, so resting birds scroll away with the header and are still there when you scroll back.
const perchElement = birdConfig.navSelector && document.querySelector(birdConfig.navSelector);
function perchLineY() {
    if (perchElement) {
        const border = parseFloat(getComputedStyle(perchElement).borderBottomWidth) || 0;
        return perchElement.getBoundingClientRect().bottom - border;
    }
    return birdConfig.perchLineY;
}

// Send the birds up to the line, as a loose group at a random spot along it.
function goRest() {
    flock.resting = true;
    cursor.orbiting = false;
    cursor.touched = false;

    const mess = birdConfig.perchMessiness;
    flock.nextShake = performance.now() + randomBetween(...birdConfig.shakeEverySeconds) * 1000;

    // Uneven gaps: some birds squeeze together, others leave space.
    const gaps = birds.map(() => birdConfig.birdSize * randomBetween(0.85 - 0.45 * mess, 0.85 + 0.45 * mess));
    const span = gaps.slice(1).reduce((sum, gap) => sum + gap, 0);
    const margin = birdConfig.birdSize / 2 + 10;
    const minStart = margin;
    const maxStart = Math.max(minStart, view.width - margin - span);
    let x = minStart + Math.random() * (maxStart - minStart);

    // Assign spots left to right in the order the birds currently are, so their paths don't cross.
    const byX = [...birds].sort((a, b) => a.position.x - b.position.x);
    byX.forEach((bird, i) => {
        if (i > 0) x += gaps[i];
        bird.perchX = x;
        // Every bird leans a noticeable bit (about 15–25°), randomly to the left or right.
        bird.perchAngle = randomBetween(0.26, 0.44) * (Math.random() < 0.5 ? -1 : 1) * mess;
        // Centre above the line by the bird's lowest point at that tilt, so its feet touch the line.
        bird.perchOffsetY = -lowestPoint(bird.image, bird.perchAngle);
        bird.perched = false;
    });
}

function wakeUp() {
    flock.resting = false;
    flock.activeSince = performance.now();
    cursor.lastMoved = performance.now();
    cursor.touched = false;
    for (const bird of birds) {
        bird.perched = false;
        // Drop off the line downwards, fanning out a little to the sides.
        bird.velocity.x = randomBetween(-1.5, 1.5);
        bird.velocity.y = randomBetween(1.5, 2.5);
    }
}

function drawPerchLine(y) {
    ctx.fillStyle = birdConfig.lineColor;
    ctx.fillRect(0, Math.round(y), view.width, birdConfig.lineWidth);
}

function animate() {
    ctx.clearRect(0, 0, view.width, view.height);

    const lineY = perchLineY();
    if (!perchElement) drawPerchLine(lineY);

    const now = performance.now();
    const scattering = now < cursor.scatterUntil;

    if (!flock.resting && !scattering && lineY > 0 && now - flock.activeSince > birdConfig.restAfterSeconds * 1000) {
        goRest();
    }

    if (flock.resting) {
        if (now > flock.nextShake) {
            const perched = birds.filter(bird => bird.perched);
            if (perched.length) {
                const bird = perched[Math.floor(Math.random() * perched.length)];
                bird.shakeStart = now;
                bird.shakeUntil = now + birdConfig.shakeSeconds * 1000;
            }
            flock.nextShake = now + randomBetween(...birdConfig.shakeEverySeconds) * 1000;
        }

        for (const bird of birds) {
            // The bird's feet rest on the line.
            const spot = { x: bird.perchX, y: lineY + bird.perchOffsetY };
            bird.update(spot, birds, 'perch');
        }
        requestAnimationFrame(animate);
        return;
    }

    let closestBirdIndex = null;
    let closestDistance = Infinity;

    for (let i = 0; i < birds.length; i++) {
        const dx = cursor.x - birds[i].position.x;
        const dy = cursor.y - birds[i].position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestBirdIndex = i;
        }
    }

    if (!scattering && closestDistance < birdConfig.birdSize / 2) cursor.touched = true;

    const idleSeconds = (now - cursor.lastMoved) / 1000;
    if (!scattering && !cursor.orbiting && cursor.touched && idleSeconds > birdConfig.orbitDelaySeconds) {
        cursor.orbiting = true;
        cursor.orbitAnchor = { x: cursor.x, y: cursor.y };
    }
    const orbiting = !scattering && cursor.orbiting;

    if (scattering) {
        for (const bird of birds) bird.update(null, birds, 'scatter');
    } else if (orbiting) {
        orbitAngle += birdConfig.orbitSpeed;
        for (let i = 0; i < birds.length; i++) {
            const angle = orbitAngle + (i / birds.length) * Math.PI * 2;
            const spot = {
                x: cursor.x + Math.cos(angle) * birdConfig.orbitRadius,
                y: cursor.y + Math.sin(angle) * birdConfig.orbitRadius,
            };
            birds[i].update(spot, birds, 'orbit');
        }
    } else {
        const leaderBird = birds[closestBirdIndex];
        for (let i = 0; i < birds.length; i++) {
            const target = i === closestBirdIndex ? cursor : leaderBird.position;
            birds[i].update(target, birds, 'follow');
        }
    }

    requestAnimationFrame(animate);
}

// LED mode, and the small on / off / blink control on the side of the page.
// A visitor's choice is remembered in their browser (if storage is available).
const LED_MODES = [['on', 'On'], ['off', 'Off'], ['blink', 'Blink']];
let ledMode = birdConfig.ledMode;
try {
    const saved = localStorage.getItem('birds-led-mode');
    if (LED_MODES.some(([mode]) => mode === saved)) ledMode = saved;
} catch (e) { /* storage blocked: use the default */ }

function makeLedSwitch() {
    const box = document.createElement('div');
    box.className = 'led-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Bird lights');

    const label = document.createElement('span');
    label.className = 'led-switch__label';
    label.textContent = 'Lights';
    box.appendChild(label);

    const buttons = LED_MODES.map(([mode, text]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.addEventListener('click', () => {
            ledMode = mode;
            try { localStorage.setItem('birds-led-mode', mode); } catch (e) { /* not remembered */ }
            update();
        });
        box.appendChild(button);
        return [mode, button];
    });
    const update = () => {
        for (const [mode, button] of buttons) button.setAttribute('aria-pressed', String(mode === ledMode));
    };
    update();
    document.body.appendChild(box);
}
if (birdConfig.led && birdConfig.ledSwitch) makeLedSwitch();

// Listen on the window (not the canvas) so the birds still follow the cursor
// when the canvas sits on top of a website and lets clicks pass through.
window.addEventListener('mousemove', (event) => {
    cursor.x = event.clientX;
    cursor.y = event.clientY;

    if (flock.resting) {
        // Resting birds wake up when the cursor passes over one of them.
        const hovered = birds.some(bird => {
            const dx = cursor.x - bird.position.x;
            const dy = cursor.y - bird.position.y;
            return Math.sqrt(dx * dx + dy * dy) < birdConfig.birdSize / 2;
        });
        if (hovered) wakeUp();
        return;
    }

    if (cursor.orbiting) {
        // Small moves keep the birds circling (the circle follows the cursor);
        // only a big move away from where the circling started breaks it.
        const dx = cursor.x - cursor.orbitAnchor.x;
        const dy = cursor.y - cursor.orbitAnchor.y;
        if (Math.sqrt(dx * dx + dy * dy) < birdConfig.orbitBreakDistance) return;
        cursor.orbiting = false;
    }

    cursor.lastMoved = performance.now();
    cursor.touched = false;
});

window.addEventListener('mousedown', (event) => {
    if (flock.resting) return;  // clicks around the site shouldn't disturb resting birds
    if (event.target.closest && event.target.closest('.led-switch')) return;  // using the lights control isn't a scare
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    cursor.touched = false;
    cursor.orbiting = false;
    cursor.scatterUntil = performance.now() + birdConfig.scatterSeconds * 1000;

    for (const bird of birds) {
        let dx = bird.position.x - cursor.x;
        let dy = bird.position.y - cursor.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
        }
        // A little randomness so they don't fly out in perfectly straight lines.
        const speed = birdConfig.scatterSpeed * (0.8 + Math.random() * 0.4);
        bird.velocity.x = (dx / distance) * speed;
        bird.velocity.y = (dy / distance) * speed;
    }
});

Promise.all([loadImages(), loadMasks()]).then(([images, masks]) => {
    // Each bird gets its own LED colour.
    const sprites = images.map((img, i) =>
        makeSprite(img, birdConfig.birdSize, birdConfig.ledColors[i % birdConfig.ledColors.length], masks[i]));
    for (let i = 0; i < birdConfig.numBirds; i++) {
        birds.push(new Bird(Math.random() * view.width, Math.random() * view.height, sprites[i % sprites.length]));
    }
    flock.activeSince = performance.now();
    animate();
}).catch(error => console.error('Error loading images:', error));
})();
