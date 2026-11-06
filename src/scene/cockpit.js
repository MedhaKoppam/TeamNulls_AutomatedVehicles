/* =====================================================================
   Cockpit : ties scrolling to the car.
     • which story step is active (screens pop in/out)
     • dashboard + wheel rise after the hero
     • steering wheel turns with scroll speed & direction
       (scroll down → turns right, scroll up → turns left, self-centres when you stop)
     • road moves forward/backward and bends with the wheel
     • cluster: speed, gear (P/R/N/D), chapter, trip distance
     • route screen: click a stop to jump there
   ===================================================================== */

export class Cockpit {
  constructor({ steps, road, onStepChange }) {
    this.steps = steps;
    this.road = road;
    this.onStepChange = onStepChange || (() => {});
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.wheelEl = document.getElementById("wheel");
    this.navNowEl = document.getElementById("nav-now");

    this.angle = 0;
    this.vel = 0;
    this.lastY = window.scrollY;
    this.lastT = performance.now();
    this.lastScrollAt = 0;
    this.active = -1;
    this.running = false;

    this.buildWheel();
    this.buildNav();
    this.measure();
    this.update(true);
    this.road.draw();

    window.addEventListener("scroll", () => { this.lastScrollAt = performance.now(); this.kick(); }, { passive: true });
    window.addEventListener("resize", () => { this.measure(); this.update(true); this.road.draw(); });
  }

  // ---------- steering wheel (SVG) ----------
  buildWheel() {
    const arc = (r, a0, a1) => {
      const p = a => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0},1 ${x1},${y1}`;
    };
    const ring = (ro, ri) =>
      `M0,${-ro} A${ro},${ro} 0 1,1 0,${ro} A${ro},${ro} 0 1,1 0,${-ro} Z M0,${-ri} A${ri},${ri} 0 1,0 0,${ri} A${ri},${ri} 0 1,0 0,${-ri} Z`;

    this.wheelEl.innerHTML = `
      <defs>
        <radialGradient id="rimG" cx="50%" cy="30%" r="70%">
          <stop offset="0" stop-color="#3b3d43"/><stop offset=".55" stop-color="#1b1c20"/><stop offset="1" stop-color="#09090a"/>
        </radialGradient>
        <linearGradient id="spokeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2f3237"/><stop offset="1" stop-color="#101113"/>
        </linearGradient>
        <linearGradient id="chromeG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5d6168"/><stop offset=".45" stop-color="#e3e6ea"/>
          <stop offset=".55" stop-color="#4c5057"/><stop offset="1" stop-color="#a9aeb5"/>
        </linearGradient>
        <radialGradient id="hubG" cx="50%" cy="25%" r="80%">
          <stop offset="0" stop-color="#34363c"/><stop offset="1" stop-color="#0d0e10"/>
        </radialGradient>
      </defs>

      <!-- rim -->
      <path d="${ring(240, 200)}" fill="url(#rimG)" fill-rule="evenodd"/>
      <circle r="201" fill="none" stroke="rgba(0,0,0,.65)" stroke-width="3"/>
      <circle r="239" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="2"/>
      <path d="${arc(231, 200, 340)}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="4" stroke-linecap="round"/>
      <circle r="220" fill="none" stroke="rgba(220,210,195,.10)" stroke-width="1.6" stroke-dasharray="2 7"/>
      <!-- 12 o'clock stripe makes the rotation readable -->
      <rect x="-5" y="-240" width="10" height="40" rx="2" fill="#6da7ec" opacity=".9"/>

      <!-- spokes -->
      <path d="M-206,-30 C-150,-36 -110,-34 -70,-26 L-66,44 C-110,50 -160,56 -204,44 Z" fill="url(#spokeG)"/>
      <path d="M206,-30 C150,-36 110,-34 70,-26 L66,44 C110,50 160,56 204,44 Z" fill="url(#spokeG)"/>
      <path d="M-40,80 L40,80 L30,204 L-30,204 Z" fill="url(#spokeG)"/>
      <path d="M-202,-24 C-150,-30 -110,-28 -74,-20" fill="none" stroke="url(#chromeG)" stroke-width="3"/>
      <path d="M202,-24 C150,-30 110,-28 74,-20" fill="none" stroke="url(#chromeG)" stroke-width="3"/>

      <!-- spoke buttons -->
      ${[[-168, -12, "+"], [-168, 16, "−"], [-124, -12, "⏵"], [-124, 16, "☰"], [124, -12, "▲"], [124, 16, "▼"], [168, -12, "◁"], [168, 16, "▷"]]
        .slice(0, 0).map(([x, y, t]) => `<g transform="translate(${x},${y})"><rect x="-17" y="-11" width="34" height="22" rx="7" fill="#0c0d0f" stroke="#34373d"/>
        <text text-anchor="middle" dy="4.5" font-size="12" fill="#8c939c" font-family="sans-serif">${t}</text></g>`).join("")}

      <!-- hub -->
      <ellipse cx="0" cy="14" rx="88" ry="80" fill="url(#hubG)" stroke="#2b2d32" stroke-width="2"/>
      <ellipse cx="0" cy="10" rx="80" ry="70" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="2"/>
      <circle cx="0" cy="6" r="27" fill="#0f1012" stroke="url(#chromeG)" stroke-width="4"/>
      <!-- Team Nulls emblem: Ø -->
      <circle cx="0" cy="6" r="12" fill="none" stroke="#d7dbe0" stroke-width="3"/>
      <line x1="-14" y1="20" x2="14" y2="-8" stroke="#d7dbe0" stroke-width="3" stroke-linecap="round"/>
    `;
  }

  // ---------- route screen ----------
  buildNav() {
    const route = document.getElementById("nav-route");
    route.innerHTML = `<div class="fill"></div>`;
    this.navFill = route.querySelector(".fill");
    this.navStops = this.steps.map((s, i) => {
      const b = document.createElement("button");
      b.className = "nav-stop";
      b.type = "button";
      b.title = s.dataset.nav || `Stop ${i + 1}`;
      b.setAttribute("aria-label", `Go to: ${b.title}`);
      b.addEventListener("click", () => this.goTo(i));
      route.appendChild(b);
      return b;
    });
  }

  measure() {
    this.tops = this.steps.map(s => s.offsetTop);
    this.maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  }

  kick() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  frame(t) {
    const dt = Math.max(8, Math.min(64, t - this.lastT));
    this.lastT = t;
    const y = window.scrollY;
    const dy = y - this.lastY;
    this.lastY = y;

    // smoothed scroll velocity (px / ms)
    this.vel += (dy / dt - this.vel) * 0.25;
    if (Math.abs(dy) < 0.01) this.vel *= 0.88;      // let go → wheel self-centres

    const target = this.reduced ? 0 : Math.max(-110, Math.min(110, this.vel * 70));
    this.angle += (target - this.angle) * (this.reduced ? 1 : 0.1);

    // road
    if (!this.reduced) {
      this.road.position += dy * 0.022;
      this.road.curve = (this.angle / 110) * 0.016;
      this.road.skyShift += this.road.curve * dy * 9;
    }

    this.update(false);
    this.road.draw();

    const moving = Math.abs(this.vel) > 0.002 || Math.abs(this.angle) > 0.05 || dy !== 0
      || performance.now() - this.lastScrollAt < 450;
    if (moving) requestAnimationFrame(tt => this.frame(tt));
    else { this.running = false; this.angle = 0; this.vel = 0; this.render(); }
  }

  update(force) {
    const y = window.scrollY;
    const vh = innerHeight;

    // dashboard & wheel rise in over the first screen
    const rise = Math.max(0, Math.min(1, y / (vh * 0.75)));
    if (force || Math.abs(rise - (this.rise ?? -1)) > 0.001) {
      this.rise = rise;
      document.documentElement.style.setProperty("--rise", rise.toFixed(3));
      document.querySelector(".dash").inert = rise < .9;
    }

    // active step
    let idx = 0;
    this.tops.forEach((top, i) => { if (top <= y + vh * 0.5) idx = i; });
    if (y >= this.maxScroll - 2) idx = this.steps.length - 1;
    if (idx !== this.active || force) this.setActive(idx, force);

    this.render();
  }

  render() {
    this.wheelEl.style.transform = `rotate(${this.angle.toFixed(2)}deg)`;
  }

  setActive(idx, force) {
    const prev = this.active;
    this.active = idx;
    this.steps.forEach((s, i) => {
      s.classList.toggle("is-active", i === idx);
      s.inert = i !== idx;
      s.setAttribute('aria-hidden', String(i !== idx));
    });
    this.navNowEl.textContent = idx + 1 < this.steps.length ? `Next: ${this.steps[idx + 1].dataset.nav}` : "Arrived";
    this.navStops.forEach((b, i) => { b.classList.toggle("done", i < idx); b.classList.toggle("now", i === idx); if (i === idx) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
    const first = this.navStops[0], cur = this.navStops[idx];
    this.navFill.style.width = (cur.offsetLeft - first.offsetLeft) + "px";
    if (prev !== idx || force) this.onStepChange(idx, prev);
  }

  goTo(i) {
    const s = this.steps[Math.max(0, Math.min(this.steps.length - 1, i))];
    // land a little into the section so its screens are fully open
    const y = i === 0 ? 0 : s.offsetTop + innerHeight * 0.05;
    window.scrollTo({ top: y, behavior: this.reduced ? "auto" : "smooth" });
  }
}

