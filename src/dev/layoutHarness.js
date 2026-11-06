const STORAGE_KEY = 'team-nulls-layout-harness';

const styles = `
  .layout-harness-toggle, .layout-harness {
    position: fixed; z-index: 100; font: 12px/1.35 var(--ui, system-ui, sans-serif);
  }
  .layout-harness-toggle {
    right: 16px; top: 16px; border: 1px solid rgba(255,255,255,.2); border-radius: 999px;
    background: #121820; color: #eef1f5; padding: 7px 10px; box-shadow: 0 8px 24px rgba(0,0,0,.35);
  }
  .layout-harness {
    top: 54px; right: 16px; width: min(286px, calc(100vw - 32px)); padding: 14px;
    border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: rgba(10,14,20,.94);
    color: #eef1f5; box-shadow: 0 12px 32px rgba(0,0,0,.42); backdrop-filter: blur(12px);
  }
  .layout-harness[hidden] { display: none; }
  .layout-harness h2 { margin: 0 0 10px; font-size: 14px; }
  .layout-harness p { margin: 0 0 12px; color: #b9c0c9; font-size: 11px; }
  .layout-harness label { display: grid; gap: 5px; margin: 11px 0; }
  .layout-harness-label { display: flex; justify-content: space-between; gap: 10px; }
  .layout-harness output { color: #8fc0ff; font-variant-numeric: tabular-nums; }
  .layout-harness input { width: 100%; accent-color: #6da7ec; }
  .layout-harness .layout-harness-values { color: #dce7f5; }
  .layout-harness-actions { display: flex; gap: 8px; margin-top: 12px; }
  .layout-harness-actions button {
    flex: 1; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; background: #202b38;
    color: #eef1f5; padding: 7px 8px; font: inherit;
  }
  .layout-harness-actions button:hover, .layout-harness-actions button:focus-visible { background: #2d4055; }
  @media (max-width: 760px), (max-height: 560px) {
    .layout-harness-toggle { right: 10px; top: 10px; }
    .layout-harness { top: 48px; right: 10px; max-height: calc(100vh - 60px); overflow: auto; }
  }
`;

function readSavedValues() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

function saveValues(values) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

export function initLayoutHarness() {
  if (document.querySelector('.layout-harness')) return;

  const root = document.documentElement;
  const wheel = document.querySelector('.wheel-wrap');
  if (!wheel) return;

  const computed = getComputedStyle(root);
  const defaults = {
    copy: Number(computed.getPropertyValue('--copy-panel-percent').trim()) || 22,
    dashboard: Number.parseFloat(computed.getPropertyValue('--dashboard-height')) || 14,
    wheel: Math.round(wheel.getBoundingClientRect().width),
    wheelOffset: Number.parseFloat(computed.getPropertyValue('--wheel-y-offset')) || 45,
  };
  const values = { ...defaults, ...readSavedValues() };

  const style = document.createElement('style');
  style.textContent = styles;
  document.head.append(style);

  const toggle = document.createElement('button');
  toggle.className = 'layout-harness-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Layout controls';

  const panel = document.createElement('aside');
  panel.className = 'layout-harness';
  panel.setAttribute('aria-label', 'Development layout controls');
  panel.innerHTML = `
    <h2>Layout tuning</h2>
    <p class="layout-harness-values"></p>
    <label><span class="layout-harness-label">Copy panel <output data-value="copy"></output></span><input data-control="copy" type="range" min="10" max="45" step="1"></label>
    <label><span class="layout-harness-label">Dashboard height <output data-value="dashboard"></output></span><input data-control="dashboard" type="range" min="10" max="30" step="1"></label>
    <label><span class="layout-harness-label">Wheel diameter <output data-value="wheel"></output></span><input data-control="wheel" type="range" min="120" max="460" step="5"></label>
    <label><span class="layout-harness-label">Wheel Y offset <output data-value="wheelOffset"></output></span><input data-control="wheelOffset" type="range" min="-160" max="260" step="5"></label>
    <div class="layout-harness-actions"><button type="button" data-action="reset">Reset</button><button type="button" data-action="copy">Copy settings</button></div>
  `;
  document.body.append(toggle, panel);

  const inputs = Object.fromEntries([...panel.querySelectorAll('[data-control]')].map((input) => [input.dataset.control, input]));
  const outputs = Object.fromEntries([...panel.querySelectorAll('[data-value]')].map((output) => [output.dataset.value, output]));
  const summary = panel.querySelector('.layout-harness-values');
  const desktopLayout = window.matchMedia('(min-width: 761px) and (min-height: 561px)');
  let showing = true;

  function availablePanelWidth() {
    const left = document.querySelector('.screen-left').getBoundingClientRect();
    const right = document.querySelector('.screen-right').getBoundingClientRect();
    const gutter = left.left;
    const gap = right.left - left.left - left.width;
    return Math.max(0, window.innerWidth - gutter * 2 - gap);
  }

  function updateControls() {
    inputs.copy.value = values.copy;
    inputs.dashboard.value = values.dashboard;
    inputs.wheel.value = values.wheel;
    inputs.wheelOffset.value = values.wheelOffset;
    outputs.copy.textContent = `${values.copy}%`;
    outputs.dashboard.textContent = `${values.dashboard}vh`;
    outputs.wheel.textContent = `${values.wheel}px`;
    outputs.wheelOffset.textContent = `${values.wheelOffset}px`;
    summary.textContent = `Copy: ${values.copy}% | Visualization: ${100 - values.copy}%`;
  }

  function apply(next, persist = true) {
    Object.assign(values, next);
    if (desktopLayout.matches) {
      root.style.setProperty('--copy-panel-percent', values.copy);
      root.style.setProperty('--copy-panel-width', `${availablePanelWidth() * values.copy / 100}px`);
      root.style.setProperty('--dashboard-height', `${values.dashboard}vh`);
      root.style.setProperty('--wheel-size', `${values.wheel}px`);
      root.style.setProperty('--wheel-y-offset', `${values.wheelOffset}px`);
    } else {
      ['--copy-panel-percent', '--copy-panel-width', '--dashboard-height', '--wheel-size', '--wheel-y-offset']
        .forEach((property) => root.style.removeProperty(property));
    }
    updateControls();
    if (persist) saveValues(values);
  }

  Object.entries(inputs).forEach(([key, input]) => {
    input.addEventListener('input', () => apply({ [key]: Number(input.value) }));
  });
  window.addEventListener('resize', () => apply({}, false));

  toggle.addEventListener('click', () => {
    showing = !showing;
    panel.hidden = !showing;
    toggle.setAttribute('aria-expanded', String(showing));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'h' || event.target.closest('input, textarea, select')) return;
    event.preventDefault();
    toggle.click();
  });
  panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
    Object.assign(values, defaults);
    root.style.removeProperty('--copy-panel-percent');
    root.style.removeProperty('--copy-panel-width');
    root.style.removeProperty('--dashboard-height');
    root.style.removeProperty('--wheel-size');
    root.style.removeProperty('--wheel-y-offset');
    window.localStorage.removeItem(STORAGE_KEY);
    updateControls();
  });
  panel.querySelector('[data-action="copy"]').addEventListener('click', async (event) => {
    const settings = `:root {\n  --copy-panel-percent: ${values.copy};\n  --dashboard-height: ${values.dashboard}vh;\n  --wheel-size: ${values.wheel}px;\n  --wheel-y-offset: ${values.wheelOffset}px;\n}`;
    await copyText(settings);
    event.currentTarget.textContent = 'Copied';
    window.setTimeout(() => { event.currentTarget.textContent = 'Copy settings'; }, 1200);
  });

  apply(values, false);
}
