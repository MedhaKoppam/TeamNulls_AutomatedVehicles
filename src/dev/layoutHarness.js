const STORAGE_KEY = 'team-nulls-layout-harness';

const styles = `
  .layout-harness-toggle, .layout-harness { position: fixed; z-index: 100; font: 12px/1.35 var(--ui, system-ui, sans-serif); }
  .layout-harness-toggle { right: 16px; top: 16px; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; background: #121820; color: #eef1f5; padding: 7px 10px; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
  .layout-harness { top: 54px; right: 16px; width: min(310px, calc(100vw - 32px)); max-height: calc(100vh - 70px); overflow: auto; padding: 14px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: rgba(10,14,20,.96); color: #eef1f5; box-shadow: 0 12px 32px rgba(0,0,0,.42); backdrop-filter: blur(12px); }
  .layout-harness[hidden] { display: none; }
  .layout-harness h2, .layout-harness h3 { margin: 0 0 8px; color: #eef1f5; }
  .layout-harness h2 { font-size: 14px; } .layout-harness h3 { margin-top: 16px; font-size: 12px; }
  .layout-harness p { margin: 0 0 10px; color: #b9c0c9; font-size: 11px; }
  .layout-harness label { display: grid; gap: 5px; margin: 10px 0; }
  .layout-harness-label { display: flex; justify-content: space-between; gap: 10px; }
  .layout-harness output { color: #8fc0ff; font-variant-numeric: tabular-nums; }
  .layout-harness input, .layout-harness textarea { width: 100%; accent-color: #6da7ec; }
  .layout-harness textarea { resize: vertical; min-height: 54px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px; background: #111923; color: #eef1f5; padding: 6px; font: 11px/1.35 ui-monospace, monospace; }
  .layout-harness .layout-harness-values, .layout-harness-status { color: #dce7f5; }
  .layout-harness-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
  .layout-harness-actions button { flex: 1; min-width: 120px; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; background: #202b38; color: #eef1f5; padding: 7px 8px; font: inherit; }
  .layout-harness-actions button:hover, .layout-harness-actions button:focus-visible { background: #2d4055; }
  .layout-harness [disabled] { opacity: .45; }
  .layout-copy-tuned .harness-eyebrow { margin-bottom: var(--h-eyebrow-title, var(--copy-eyebrow-to-title)) !important; }
  .layout-copy-tuned .harness-title { font-size: var(--h-title-size, var(--copy-title-size)) !important; margin-bottom: var(--h-title-body, var(--copy-title-to-body)) !important; }
  .layout-copy-tuned .harness-body { font-size: var(--h-body-size, var(--copy-body-size)) !important; }
  .layout-copy-tuned .harness-callout { margin-top: var(--h-body-divider, var(--copy-body-to-divider)) !important; padding-top: var(--h-divider-callout, var(--copy-divider-to-instruction)) !important; }
  @media (max-width: 760px), (max-height: 560px) { .layout-harness-toggle { right: 10px; top: 10px; } .layout-harness { top: 48px; right: 10px; max-height: calc(100vh - 60px); } }
`;

function readStore() {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') || {}; } catch { return {}; }
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
  document.body.append(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
  return Promise.resolve();
}

function asPixels(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function initLayoutHarness() {
  if (document.querySelector('.layout-harness')) return null;
  const root = document.documentElement;
  const wheel = document.querySelector('.wheel-wrap');
  if (!wheel) return null;

  const stored = readStore();
  const computed = getComputedStyle(root);
  const layoutDefaults = {
    copy: asPixels(computed.getPropertyValue('--copy-panel-percent'), 23),
    dashboard: asPixels(computed.getPropertyValue('--dashboard-height'), 14),
    wheel: Math.round(wheel.getBoundingClientRect().width),
    wheelOffset: asPixels(computed.getPropertyValue('--wheel-y-offset'), 45),
  };
  const layout = { ...layoutDefaults, ...(stored.layout || stored) };
  let sections = stored.sections && typeof stored.sections === 'object' ? stored.sections : {};
  let activeId = null;
  const records = new Map();

  const style = document.createElement('style');
  style.textContent = styles;
  document.head.append(style);

  const toggle = document.createElement('button');
  toggle.className = 'layout-harness-toggle'; toggle.type = 'button'; toggle.textContent = 'Layout controls';
  const panel = document.createElement('aside');
  panel.className = 'layout-harness'; panel.setAttribute('aria-label', 'Development layout controls');
  panel.innerHTML = `
    <h2>Layout tuning</h2><p class="layout-harness-values"></p>
    <label><span class="layout-harness-label">Copy panel <output data-value="copy"></output></span><input data-control="copy" type="range" min="10" max="45" step="1"></label>
    <label><span class="layout-harness-label">Dashboard height <output data-value="dashboard"></output></span><input data-control="dashboard" type="range" min="10" max="30" step="1"></label>
    <label><span class="layout-harness-label">Wheel diameter <output data-value="wheel"></output></span><input data-control="wheel" type="range" min="120" max="460" step="5"></label>
    <label><span class="layout-harness-label">Wheel Y offset <output data-value="wheelOffset"></output></span><input data-control="wheelOffset" type="range" min="-160" max="260" step="5"></label>
    <div class="layout-harness-actions"><button type="button" data-action="reset-layout">Reset layout</button><button type="button" data-action="copy-layout">Copy layout</button></div>
    <h3>Section copy</h3><p class="layout-harness-status">Active section: none</p>
    <div data-section-controls>
      <label><span class="layout-harness-label">Title size <output data-value="titleSize"></output></span><input data-type="typography" data-control="titleSize" type="range" min="16" max="44" step="1"></label>
      <label><span class="layout-harness-label">Body size <output data-value="bodySize"></output></span><input data-type="typography" data-control="bodySize" type="range" min="11" max="24" step="1"></label>
      <label><span class="layout-harness-label">Eyebrow to title <output data-value="eyebrowToTitle"></output></span><input data-type="typography" data-spacing data-control="eyebrowToTitle" type="range" min="0" max="100" step="1"></label>
      <label><span class="layout-harness-label">Title to body <output data-value="titleToBody"></output></span><input data-type="typography" data-spacing data-control="titleToBody" type="range" min="0" max="100" step="1"></label>
      <label><span class="layout-harness-label">Body to divider <output data-value="bodyToDivider"></output></span><input data-type="typography" data-spacing data-control="bodyToDivider" type="range" min="0" max="100" step="1"></label>
      <label><span class="layout-harness-label">Divider to instruction <output data-value="dividerToCallout"></output></span><input data-type="typography" data-spacing data-control="dividerToCallout" type="range" min="0" max="100" step="1"></label>
      <label>Eyebrow<textarea data-field="eyebrow" rows="2"></textarea></label>
      <label>Main title<textarea data-field="title" rows="3"></textarea></label>
      <label>Body / subtext<textarea data-field="body" rows="4"></textarea></label>
      <label>Supporting instruction / callout<textarea data-field="callout" rows="3"></textarea></label>
      <div class="layout-harness-actions"><button type="button" data-action="reset-section">Reset active section</button><button type="button" data-action="reset-all">Reset all settings</button></div>
    </div>
    <h3>Section copy JSON</h3><textarea data-json rows="8" placeholder='Paste overrides, e.g. { "willingness-intro": { "title": "..." } }'></textarea>
    <p class="layout-harness-json-status" aria-live="polite"></p>
    <div class="layout-harness-actions"><button type="button" data-action="apply-json">Apply JSON</button><button type="button" data-action="export-json">Copy configuration</button><button type="button" data-action="clear-storage">Clear stored overrides</button></div>
  `;
  document.body.append(toggle, panel);

  const layoutInputs = Object.fromEntries([...panel.querySelectorAll('input[data-control]:not([data-type="typography"])')].map((input) => [input.dataset.control, input]));
  const sectionInputs = Object.fromEntries([...panel.querySelectorAll('input[data-type="typography"]')].map((input) => [input.dataset.control, input]));
  panel.querySelectorAll('input[data-spacing]').forEach((input) => {
    input.min = '0';
    input.max = '100';
    input.step = '1';
  });
  const fieldInputs = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input]));
  const outputs = Object.fromEntries([...panel.querySelectorAll('output')].map((output) => [output.dataset.value, output]));
  const sectionControls = panel.querySelector('[data-section-controls]');
  const summary = panel.querySelector('.layout-harness-values');
  const activeLabel = panel.querySelector('.layout-harness-status');
  const jsonInput = panel.querySelector('[data-json]');
  const jsonStatus = panel.querySelector('.layout-harness-json-status');
  const desktopLayout = window.matchMedia('(min-width: 761px) and (min-height: 561px)');
  let showing = true;

  function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout, sections }));
  }
  function availablePanelWidth() {
    const left = document.querySelector('.screen-left').getBoundingClientRect();
    const right = document.querySelector('.screen-right').getBoundingClientRect();
    return Math.max(0, window.innerWidth - left.left * 2 - (right.left - left.left - left.width));
  }
  function updateLayoutControls() {
    Object.entries(layoutInputs).forEach(([key, input]) => { input.value = layout[key]; });
    outputs.copy.textContent = `${layout.copy}%`; outputs.dashboard.textContent = `${layout.dashboard}vh`;
    outputs.wheel.textContent = `${layout.wheel}px`; outputs.wheelOffset.textContent = `${layout.wheelOffset}px`;
    summary.textContent = `Copy: ${layout.copy}% | Visualization: ${100 - layout.copy}%`;
  }
  function applyLayout(next = {}, save = true) {
    Object.assign(layout, next);
    if (desktopLayout.matches) {
      root.style.setProperty('--copy-panel-percent', layout.copy);
      root.style.setProperty('--copy-panel-width', `${availablePanelWidth() * layout.copy / 100}px`);
      root.style.setProperty('--dashboard-height', `${layout.dashboard}vh`);
      root.style.setProperty('--wheel-size', `${layout.wheel}px`);
      root.style.setProperty('--wheel-y-offset', `${layout.wheelOffset}px`);
    } else {
      ['--copy-panel-percent', '--copy-panel-width', '--dashboard-height', '--wheel-size', '--wheel-y-offset'].forEach((key) => root.style.removeProperty(key));
    }
    updateLayoutControls(); if (save) persist();
  }
  function findRecord(step) {
    const id = step?.id || step?.dataset.nav;
    if (!id) return null;
    if (records.has(id)) return records.get(id);
    const panelNode = step.querySelector('.screen-left');
    if (!panelNode) return null;
    const eyebrow = panelNode.querySelector('.kicker');
    const title = panelNode.querySelector('h2');
    const body = [...panelNode.querySelectorAll('p')].find((node) => !node.matches('.kicker, .howto, .callout'));
    const callout = panelNode.querySelector('.howto, .callout');
    if (!title) return null;
    eyebrow?.classList.add('harness-eyebrow'); title.classList.add('harness-title');
    body?.classList.add('harness-body'); callout?.classList.add('harness-callout');
    panelNode.classList.add('layout-copy-tuned');
    const titleStyle = getComputedStyle(title);
    const bodyStyle = getComputedStyle(body || title);
    const record = {
      id, nav: step.dataset.nav || id, panel: panelNode,
      nodes: { eyebrow, title, body, callout },
      fields: { eyebrow: eyebrow?.textContent || '', title: title.textContent || '', body: body?.textContent || '', callout: callout?.textContent || '' },
      typography: {
        titleSize: asPixels(titleStyle.fontSize, 24), bodySize: asPixels(bodyStyle.fontSize, 15),
        eyebrowToTitle: asPixels(titleStyle.marginTop, 8), titleToBody: asPixels(titleStyle.marginBottom, 12),
        bodyToDivider: asPixels(getComputedStyle(callout || body || title).marginTop, 16),
        dividerToCallout: asPixels(getComputedStyle(callout || body || title).paddingTop, 12),
      },
    };
    records.set(id, record); return record;
  }
  function sectionConfig(id) { return sections[id] && typeof sections[id] === 'object' ? sections[id] : {}; }
  function applyRecord(record) {
    const config = sectionConfig(record.id);
    const typography = { ...record.typography, ...(config.typography || {}) };
    Object.entries(record.nodes).forEach(([key, node]) => {
      if (!node) return;
      node.textContent = Object.prototype.hasOwnProperty.call(config, key) ? config[key] : record.fields[key];
    });
    record.panel.style.setProperty('--h-title-size', `${asPixels(typography.titleSize, record.typography.titleSize)}px`);
    record.panel.style.setProperty('--h-body-size', `${asPixels(typography.bodySize, record.typography.bodySize)}px`);
    record.panel.style.setProperty('--h-eyebrow-title', `${asPixels(typography.eyebrowToTitle, record.typography.eyebrowToTitle)}px`);
    record.panel.style.setProperty('--h-title-body', `${asPixels(typography.titleToBody, record.typography.titleToBody)}px`);
    record.panel.style.setProperty('--h-body-divider', `${asPixels(typography.bodyToDivider, record.typography.bodyToDivider)}px`);
    record.panel.style.setProperty('--h-divider-callout', `${asPixels(typography.dividerToCallout, record.typography.dividerToCallout)}px`);
  }
  function updateSectionControls(record) {
    const enabled = !!record;
    sectionControls.querySelectorAll('input, textarea, [data-action="reset-section"]').forEach((input) => { input.disabled = !enabled; });
    if (!record) { activeLabel.textContent = 'Active section: no editable copy panel'; return; }
    const config = sectionConfig(record.id);
    const typography = { ...record.typography, ...(config.typography || {}) };
    activeLabel.textContent = `Active section: ${record.nav}`;
    Object.entries(sectionInputs).forEach(([key, input]) => {
      input.value = asPixels(typography[key], record.typography[key]); outputs[key].textContent = `${input.value}px`;
    });
    Object.entries(fieldInputs).forEach(([key, input]) => { input.value = Object.prototype.hasOwnProperty.call(config, key) ? config[key] : record.fields[key]; });
  }
  function setActiveSection(step) {
    activeId = step?.id || step?.dataset.nav || null;
    const record = findRecord(step);
    if (record) applyRecord(record);
    updateSectionControls(record);
  }
  function activeRecord() { return records.get(activeId) || null; }

  Object.entries(layoutInputs).forEach(([key, input]) => input.addEventListener('input', () => applyLayout({ [key]: Number(input.value) })));
  Object.entries(sectionInputs).forEach(([key, input]) => input.addEventListener('input', () => {
    const record = activeRecord(); if (!record) return;
    sections[record.id] = { ...sectionConfig(record.id), typography: { ...(sectionConfig(record.id).typography || {}), [key]: `${input.value}px` } };
    applyRecord(record); updateSectionControls(record); persist();
  }));
  Object.entries(fieldInputs).forEach(([key, input]) => input.addEventListener('input', () => {
    const record = activeRecord(); if (!record) return;
    sections[record.id] = { ...sectionConfig(record.id), [key]: input.value };
    applyRecord(record); persist();
  }));
  window.addEventListener('resize', () => applyLayout({}, false));
  toggle.addEventListener('click', () => { showing = !showing; panel.hidden = !showing; toggle.setAttribute('aria-expanded', String(showing)); });
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'h' || event.target.closest('input, textarea, select')) return;
    event.preventDefault(); toggle.click();
  });
  panel.querySelector('[data-action="reset-layout"]').addEventListener('click', () => {
    Object.assign(layout, layoutDefaults);
    ['--copy-panel-percent', '--copy-panel-width', '--dashboard-height', '--wheel-size', '--wheel-y-offset'].forEach((key) => root.style.removeProperty(key));
    updateLayoutControls(); persist();
  });
  panel.querySelector('[data-action="copy-layout"]').addEventListener('click', async (event) => {
    await copyText(`:root {\n  --copy-panel-percent: ${layout.copy};\n  --dashboard-height: ${layout.dashboard}vh;\n  --wheel-size: ${layout.wheel}px;\n  --wheel-y-offset: ${layout.wheelOffset}px;\n}`);
    event.currentTarget.textContent = 'Copied'; window.setTimeout(() => { event.currentTarget.textContent = 'Copy layout'; }, 1200);
  });
  panel.querySelector('[data-action="reset-section"]').addEventListener('click', () => {
    const record = activeRecord(); if (!record) return;
    delete sections[record.id]; applyRecord(record); updateSectionControls(record); persist();
  });
  panel.querySelector('[data-action="reset-all"]').addEventListener('click', () => {
    sections = {}; Object.assign(layout, layoutDefaults);
    ['--copy-panel-percent', '--copy-panel-width', '--dashboard-height', '--wheel-size', '--wheel-y-offset'].forEach((key) => root.style.removeProperty(key));
    records.forEach((record) => applyRecord(record)); updateLayoutControls(); updateSectionControls(activeRecord()); persist();
  });
  panel.querySelector('[data-action="apply-json"]').addEventListener('click', () => {
    try {
      const parsed = JSON.parse(jsonInput.value);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('JSON must be an object keyed by actual chapter IDs.');
      sections = parsed; records.forEach((record) => applyRecord(record)); updateSectionControls(activeRecord()); persist();
      jsonStatus.textContent = 'Section JSON applied.';
    } catch (error) { jsonStatus.textContent = `JSON error: ${error.message}`; }
  });
  panel.querySelector('[data-action="export-json"]').addEventListener('click', async (event) => {
    await copyText(JSON.stringify(sections, null, 2));
    event.currentTarget.textContent = 'Copied'; window.setTimeout(() => { event.currentTarget.textContent = 'Copy configuration'; }, 1200);
  });
  panel.querySelector('[data-action="clear-storage"]').addEventListener('click', () => {
    sections = {}; Object.assign(layout, layoutDefaults); window.localStorage.removeItem(STORAGE_KEY);
    ['--copy-panel-percent', '--copy-panel-width', '--dashboard-height', '--wheel-size', '--wheel-y-offset'].forEach((key) => root.style.removeProperty(key));
    records.forEach((record) => applyRecord(record)); updateLayoutControls(); updateSectionControls(activeRecord());
    jsonStatus.textContent = 'Stored development overrides cleared.';
  });

  applyLayout(layout, false);
  updateSectionControls(null);
  return { setActiveSection };
}
