// src/components/tooltip.js
// Reusable dismissible tooltip with a directional tail.
// Matches the Figma spec: white card, 4px radius, Inter 14/20, 6x10 tail.

import './tooltip.css';

const dismissedHintsThisPage = new Set();

try {
  localStorage.removeItem('tt:map-metric');
} catch {}

const CLOSE_ICON = `
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.17 4.17L15.83 15.83M15.83 4.17L4.17 15.83"
          stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

/**
 * Create a tooltip element.
 * @param {object} opts
 * @param {string} opts.text - label text
 * @param {'left'|'right'|'top'|'bottom'} [opts.tail='left'] - tail direction
 * @param {'start'|'center'|'end'} [opts.align='center'] - tail position along its edge
 * @param {() => void} [opts.onClose] - called after the tooltip is dismissed
 * @returns {{ el: HTMLElement, close: () => void }}
 */
export function createTooltip({ text, tail = 'left', align = 'center', onClose } = {}) {
  const el = document.createElement('div');
  el.className = `hint-tip hint-tip--tail-${tail} hint-tip--align-${align}`;
  el.setAttribute('role', 'status');

  const container = document.createElement('div');
  container.className = 'hint-tip__container';

  const label = document.createElement('span');
  label.className = 'hint-tip__label';
  label.textContent = text;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'hint-tip__close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.innerHTML = CLOSE_ICON;

  const tailEl = document.createElement('span');
  tailEl.className = 'hint-tip__tail';
  tailEl.setAttribute('aria-hidden', 'true');

  container.append(label, closeBtn);
  el.append(container, tailEl);

  const close = () => {
    el.classList.add('hint-tip--leaving');
    const done = () => { el.remove(); onClose?.(); };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 220); // fallback if transitionend doesn't fire
  };

  closeBtn.addEventListener('click', close);

  return { el, close };
}

/**
 * Show a tooltip once per page load, until the user dismisses it.
 * Call this the moment the target area is first revealed.
 * @returns {HTMLElement|null} the tooltip element, or null if already seen
 */
export function showOnce({ id = text, text, mount, tail = 'left', align = 'center' }) {
  if (dismissedHintsThisPage.has(id)) return null;
  const { el } = createTooltip({
    text, tail, align,
    onClose: () => { dismissedHintsThisPage.add(id); },
  });
  mount(el);
  return el;
}

/**
 * Show a tooltip the first time `anchorEl` scrolls into view per page load.
 * Use this when findings are reached by scrolling. If your findings are
 * switched by a stepper/nav instead, call showOnce() from that nav code.
 */
export function showOnceOnView({ id = text, anchorEl, text, mount, tail = 'left', align = 'center' }) {
  if (!anchorEl || dismissedHintsThisPage.has(id)) return;
  const io = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        obs.disconnect();
        showOnce({ id, text, mount, tail, align });
      }
    }
  }, { threshold: 0.4 });
  io.observe(anchorEl);
}
