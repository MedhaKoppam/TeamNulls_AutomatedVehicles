import * as d3 from 'd3';

/* =====================================================================
   Road : the view through the windshield.
   A pseudo-3D road (classic arcade technique) drawn on a canvas at dusk.
     road.position  : distance travelled (advances with scroll)
     road.curve     : how hard the road bends (set from the steering wheel)
     road.skyShift  : horizontal drift of hills/sun while turning
   ===================================================================== */

export class Road {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.position = 0;
    this.curve = 0;
    this.skyShift = 0;

    // world settings
    this.segLen = 1.6;
    this.segments = 90;
    this.camH = 1.05;
    this.camX = 0.85;       // driver sits in the right-hand lane
    this.roadHalf = 1.75;

    // seeded random for stars & trees
    let s = 6730;
    this.rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    this.stars = d3.range(70).map(() => ({ x: this.rand(), y: this.rand() * this.rand(), r: this.rand() * 1.1 + .3, a: this.rand() * .6 + .2 }));
    this.treeSeed = d3.range(512).map(() => this.rand());

    this.resize();
    window.addEventListener("resize", () => { this.resize(); this.draw(); });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- drawing ----
  draw() {
    const { ctx, w, h } = this;
    const hor = Math.round(h * 0.47);
    this.hor = hor;

    // Sky (dusk)
    const sky = ctx.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, "#0b1530");
    sky.addColorStop(0.45, "#283a66");
    sky.addColorStop(0.78, "#8b6f8e");
    sky.addColorStop(1, "#f1a568");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hor + 1);

    // Stars (faint, upper sky)
    const sx = ((this.skyShift * 0.15) % w + w) % w;
    this.stars.forEach(st => {
      ctx.globalAlpha = st.a * 0.7;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc((st.x * w + sx) % w, st.y * hor * 0.55, st.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Sun glow
    const sunX = w * 0.64 - this.skyShift * 0.35;
    const wrapX = ((sunX % (w * 2.2)) + w * 2.2) % (w * 2.2) - w * 0.6;
    const glow = ctx.createRadialGradient(wrapX, hor, 4, wrapX, hor, h * 0.45);
    glow.addColorStop(0, "rgba(255, 214, 160, .95)");
    glow.addColorStop(0.08, "rgba(255, 180, 120, .55)");
    glow.addColorStop(0.4, "rgba(240, 140, 110, .12)");
    glow.addColorStop(1, "rgba(240, 140, 110, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, hor + 2);

    // Hills (two parallax layers)
    this.hills(hor, h * 0.075, "#3b3552", 0.25, 1.0, 0.0021);
    this.hills(hor, h * 0.045, "#231f33", 0.55, 2.3, 0.0043);

    // Ground
    const ground = ctx.createLinearGradient(0, hor, 0, h);
    ground.addColorStop(0, "#2a2a33");
    ground.addColorStop(0.15, "#1a221e");
    ground.addColorStop(1, "#0c120f");
    ctx.fillStyle = ground;
    ctx.fillRect(0, hor, w, h - hor);

    this.drawRoad(hor);

    // Horizon haze
    const haze = ctx.createLinearGradient(0, hor - h * 0.03, 0, hor + h * 0.09);
    haze.addColorStop(0, "rgba(241, 165, 104, 0)");
    haze.addColorStop(0.3, "rgba(241, 165, 104, .30)");
    haze.addColorStop(1, "rgba(241, 165, 104, 0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, hor - h * 0.03, w, h * 0.12);

  }

  hills(hor, amp, color, parallax, seed, freq) {
    const { ctx, w } = this;
    const off = this.skyShift * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, hor + 1);
    for (let x = 0; x <= w + 8; x += 8) {
      const t = x + off;
      const y = hor - amp * (0.55 + 0.25 * Math.sin(t * freq + seed) + 0.15 * Math.sin(t * freq * 2.7 + seed * 3) + 0.05 * Math.sin(t * freq * 7.1));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, hor + 1);
    ctx.closePath();
    ctx.fill();
  }

  drawRoad(hor) {
    const { ctx, w, h, segLen, segments, camH } = this;
    const S = (h - hor) * 0.95;               // projection scale
    const near = 0.9;
    const offset = ((this.position % segLen) + segLen) % segLen;
    const baseIdx = Math.floor(this.position / segLen);

    // project world point (x, z) → screen
    const project = (x, z) => {
      const bend = 0.5 * this.curve * z * z;   // road curves away from the car
      const scale = S / z;
      return { x: w / 2 + (x + bend - this.camX) * scale, y: hor + camH * scale, s: scale };
    };

    const quad = (a, b, xa0, xa1, xb0, xb1, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x + xa0 * a.s, a.y);
      ctx.lineTo(a.x + xa1 * a.s, a.y);
      ctx.lineTo(b.x + xb1 * b.s, b.y);
      ctx.lineTo(b.x + xb0 * b.s, b.y);
      ctx.closePath();
      ctx.fill();
    };

    const R = this.roadHalf;
    const sprites = [];

    for (let i = segments; i >= 0; i--) {
      const z1 = near + i * segLen - offset;
      const z2 = z1 + segLen;
      if (z1 <= 0.2) continue;
      const a = project(0, z1);   // near edge
      const b = project(0, z2);   // far edge
      if (b.y >= a.y) continue;
      const idx = baseIdx + i;
      const alt = ((idx % 2) + 2) % 2 === 0;
      const fog = Math.min(1, z1 / (segments * segLen));

      // verge / grass bands
      quad(a, b, -60, 60, -60, 60, alt ? "#18211c" : "#151d18");
      // shoulder
      quad(a, b, -R - 0.55, R + 0.55, -R - 0.55, R + 0.55, alt ? "#3a3c40" : "#35373b");
      // asphalt
      quad(a, b, -R, R, -R, R, alt ? "#2b2d31" : "#28292d");
      // edge lines
      quad(a, b, -R, -R + 0.07, -R, -R + 0.07, "#cfcab8");
      quad(a, b, R - 0.07, R, R - 0.07, R, "#cfcab8");
      // centre dashes (every other pair of segments)
      if (((idx % 4) + 4) % 4 < 2) quad(a, b, -0.045, 0.045, -0.045, 0.045, "#e9e2c4");

      // fog toward the horizon
      if (fog > 0.35) {
        ctx.globalAlpha = Math.min(0.85, (fog - 0.35) * 1.4);
        quad(a, b, -60, 60, -60, 60, "#4b3f4c");
        ctx.globalAlpha = 1;
      }

      // roadside reflector posts
      if (((idx % 5) + 5) % 5 === 0) sprites.push({ type: "post", z: z1, x: -R - 0.9 });
      if (((idx % 5) + 5) % 5 === 2) sprites.push({ type: "post", z: z1, x: R + 0.9 });
      // trees
      const r = this.treeSeed[((idx % 512) + 512) % 512];
      if (r > 0.55) sprites.push({ type: "tree", z: z1, x: (r > 0.78 ? 1 : -1) * (R + 6 + r * 9), hgt: 1.1 + r * 1.5 });

      // draw this segment's sprites (far → near keeps occlusion right)
      while (sprites.length) this.drawSprite(sprites.shift(), project, fog);
    }
  }

  drawSprite(sp, project, fog) {
    const { ctx } = this;
    const p = project(sp.x, sp.z);
    if (p.x < -200 || p.x > this.w + 200) return;
    const s = p.s;
    if (sp.type === "post") {
      const pw = Math.max(1, 0.06 * s), ph = 0.55 * s;
      ctx.fillStyle = "#c9c6bd";
      ctx.fillRect(p.x - pw / 2, p.y - ph, pw, ph);
      ctx.fillStyle = sp.x < 0 ? "#ff9a3c" : "#ffffff";
      ctx.fillRect(p.x - pw / 2, p.y - ph * 0.92, pw, Math.max(1, ph * 0.14));
    } else {
      const tw = sp.hgt * 0.42 * s, th = sp.hgt * s;
      const shade = d3.interpolateRgb("#0d1510", "#4b3f4c")(Math.min(1, fog * 1.2));
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - th);
      ctx.lineTo(p.x + tw, p.y - th * 0.12);
      ctx.lineTo(p.x - tw, p.y - th * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(p.x - Math.max(1, tw * 0.08), p.y - th * 0.14, Math.max(2, tw * 0.16), th * 0.14);
    }
  }

}

