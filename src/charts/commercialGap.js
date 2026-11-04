import * as d3 from 'd3';
import { COUNTRY_MAP } from '../data/countryMap.js';

const MIN_SAMPLE = 30;
const AGE_BANDS = [['all', 'All'], ['18-24', '18-24'], ['25-34', '25-34'], ['35-44', '35-44'], ['45-54', '45-54'], ['55-69', '55-69']];
const INCOME_BANDS = [['all', 'All'], ['low', 'Low'], ['middle', 'Middle'], ['high', 'High']];
// F13/F5 controls remain intentionally absent until the L3Pilot codebook defines their meaning.
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ageMatches(age, band) {
  if (band === 'all') return true;
  const [min, max] = band.split('-').map(Number);
  return age >= min && age <= max;
}

function incomeMatches(income, band) {
  if (band === 'all') return true;
  if (band === 'low') return income >= 1 && income <= 4;
  if (band === 'middle') return income >= 5 && income <= 8;
  return income >= 9 && income <= 12;
}

function validateRows(rows) {
  return rows.map((row) => {
    const country = COUNTRY_MAP[row.country];
    if (!country) {
      const message = `Commercial Gap: unresolved workbook country code "${row.country}".`;
      console.error(message, row);
      throw new Error(message);
    }
    return { ...row, countryCode: Number(row.country), country };
  });
}

function summarize(rows, filters) {
  const buckets = new Map(Object.keys(COUNTRY_MAP).map((code) => [Number(code), []]));
  rows.forEach((row) => {
    if (row.intention_use == null || row.intention_buy == null) return;
    if (!ageMatches(row.age, filters.age) || !incomeMatches(row.income_tier, filters.income)) return;
    buckets.get(row.countryCode).push(row);
  });
  return [...buckets.entries()].map(([code, values]) => ({
    code,
    ...COUNTRY_MAP[code],
    n: values.length,
    use: values.length ? d3.mean(values, (d) => d.intention_use) : null,
    buy: values.length ? d3.mean(values, (d) => d.intention_buy) : null,
    gap: values.length ? d3.mean(values, (d) => d.intention_buy) - d3.mean(values, (d) => d.intention_use) : null,
  }));
}

function buildControls(state) {
  const root = d3.select(state.container).append('div').attr('class', 'commercial-gap-layout');
  const filters = root.append('section').attr('class', 'commercial-filter-card').attr('aria-label', 'Commercial gap filters');
  filters.append('div').attr('class', 'commercial-filter-heading').html('<span class="micro-label">Respondent filters</span><span>Filter country averages</span>');
  const controls = filters.append('div').attr('class', 'commercial-filter-groups');
  const addGroup = (key, label, options) => {
    const group = controls.append('div').attr('class', 'commercial-filter-group').attr('role', 'group').attr('aria-label', label);
    group.append('span').attr('class', 'micro-label').text(label);
    const buttons = group.append('div').attr('class', 'commercial-segmented');
    options.forEach(([value, text]) => {
      buttons.append('button').attr('type', 'button').attr('data-filter', key).attr('data-value', value).text(text)
        .on('click', () => { state.filters[key] = value; update(state); });
    });
  };
  addGroup('age', 'Age', AGE_BANDS);
  addGroup('income', 'Income tier', INCOME_BANDS);
  filters.append('button').attr('type', 'button').attr('class', 'commercial-reset').text('Reset filters')
    .on('click', () => { state.filters = { age: 'all', income: 'all' }; update(state); });
  state.frame = root.append('section').attr('class', 'commercial-plot-card').attr('aria-label', 'Country-level intention to use versus intention to buy scatter plot');
  state.tooltip = state.frame.append('div').attr('class', 'commercial-tooltip').attr('role', 'tooltip').attr('hidden', true);
}

function updateControls(state) {
  d3.select(state.container).selectAll('[data-filter]').classed('is-active', function active() {
    return this.dataset.value === state.filters[this.dataset.filter];
  }).attr('aria-pressed', function pressed() { return this.classList.contains('is-active') ? 'true' : 'false'; });
}

function filterDescription(filters) {
  const age = filters.age === 'all' ? null : `Ages ${filters.age}`;
  const income = filters.income === 'all' ? null : `${filters.income[0].toUpperCase()}${filters.income.slice(1)} income`;
  return [age, income].filter(Boolean).join(', ') || 'All respondents';
}

function gapDescription(gap) {
  return gap < 0 ? `Buy trails use by ${Math.abs(gap).toFixed(2)}` : `Buy is ahead of use by ${gap.toFixed(2)}`;
}

function clearActiveNode(state, nodes) {
  nodes.classed('is-hovered', false).classed('is-dimmed', false);
  state.tooltip.attr('hidden', true);
}

function activateNode(state, event, d, nodes) {
  if (!d?.n) return;
  nodes.classed('is-hovered', (node) => node.code === d.code).classed('is-dimmed', (node) => node.code !== d.code && node.n > 0);
  nodes.filter((node) => node.code === d.code).raise();
  const lowSample = d.n < MIN_SAMPLE ? ' (low sample)' : '';
  state.tooltip.html(`<strong>${d.name}</strong><span>Intention to use: ${d.use.toFixed(2)} / 5</span><span>Intention to buy: ${d.buy.toFixed(2)} / 5</span><span>Gap: ${gapDescription(d.gap)}</span><span>Respondents: ${d.n}${lowSample}</span><span>Filters: ${filterDescription(state.filters)}</span>`).attr('hidden', null);
  const rect = state.frame.node().getBoundingClientRect();
  const tooltipWidth = 270;
  const tooltipHeight = 145;
  let left = event.clientX - rect.left + 14;
  let top = event.clientY - rect.top + 14;
  if (left + tooltipWidth > rect.width - 8) left = event.clientX - rect.left - tooltipWidth - 14;
  if (top + tooltipHeight > rect.height - 8) top = event.clientY - rect.top - tooltipHeight - 14;
  state.tooltip.style('left', `${Math.max(8, left)}px`).style('top', `${Math.max(8, top)}px`);
}

function draw(state, data) {
  const width = Math.max(280, Math.floor(state.frame.node().getBoundingClientRect().width));
  const scroll = state.container.closest('.chart-scroll');
  const controlsHeight = state.container.querySelector('.commercial-filter-card')?.offsetHeight || 0;
  const height = Math.max(300, Math.min(500, (scroll?.clientHeight || 500) - controlsHeight - 14));
  const margins = { top: 54, right: 34, bottom: 70, left: 70 };
  const innerWidth = width - margins.left - margins.right;
  const innerHeight = height - margins.top - margins.bottom;
  const motion = prefersReducedMotion() ? 0 : 600;
  const x = d3.scaleLinear().domain([1, 5]).range([margins.left, margins.left + innerWidth]);
  const y = d3.scaleLinear().domain([1, 5]).range([margins.top + innerHeight, margins.top]);
  const maxN = d3.max(data, (d) => d.n) || MIN_SAMPLE;
  const radius = d3.scaleSqrt().domain([MIN_SAMPLE, maxN]).range([7, 18]).clamp(true);
  const previous = new Map((state.previousData || []).map((d) => [d.code, d]));
  let svg = state.frame.select('svg.commercial-gap-svg');
  if (svg.empty()) svg = state.frame.insert('svg', ':first-child').attr('class', 'commercial-gap-svg');
  svg.attr('width', width).attr('height', height).attr('aria-label', 'Scatter plot: mean intention to use and mean intention to buy by country').attr('role', 'img');
  svg.selectAll('*').remove();
  const g = svg.append('g');
  g.append('path').attr('d', `M${x(1)},${y(5)}L${x(5)},${y(5)}L${x(1)},${y(1)}Z`).attr('class', 'commercial-region commercial-region-buy').attr('pointer-events', 'none');
  g.append('path').attr('d', `M${x(1)},${y(1)}L${x(5)},${y(1)}L${x(5)},${y(5)}Z`).attr('class', 'commercial-region commercial-region-gap').attr('pointer-events', 'none');
  const grid = d3.axisBottom(x).tickValues([1, 2, 3, 4, 5]).tickSize(-innerHeight).tickFormat('');
  g.append('g').attr('class', 'commercial-grid').attr('pointer-events', 'none').attr('transform', `translate(0,${margins.top + innerHeight})`).call(grid);
  g.append('g').attr('class', 'commercial-grid').attr('pointer-events', 'none').attr('transform', `translate(${margins.left},0)`).call(d3.axisLeft(y).tickValues([1, 2, 3, 4, 5]).tickSize(-innerWidth).tickFormat(''));
  g.append('line').attr('class', 'commercial-equilibrium').attr('pointer-events', 'none').attr('x1', x(1)).attr('y1', y(1)).attr('x2', x(5)).attr('y2', y(5));
  g.append('g').attr('class', 'commercial-axis').attr('pointer-events', 'none').attr('transform', `translate(0,${margins.top + innerHeight})`).call(d3.axisBottom(x).tickValues([1, 2, 3, 4, 5]));
  g.append('g').attr('class', 'commercial-axis').attr('pointer-events', 'none').attr('transform', `translate(${margins.left},0)`).call(d3.axisLeft(y).tickValues([1, 2, 3, 4, 5]));
  g.append('text').attr('class', 'commercial-axis-title').attr('pointer-events', 'none').attr('x', margins.left + innerWidth / 2).attr('y', height - 17).attr('text-anchor', 'middle').text('Mean intention to use (1-5)');
  g.append('text').attr('class', 'commercial-axis-title').attr('pointer-events', 'none').attr('text-anchor', 'middle').attr('transform', `translate(19,${margins.top + innerHeight / 2}) rotate(-90)`).text('Mean intention to buy (1-5)');
  const nodes = g.append('g').attr('class', 'commercial-nodes').selectAll('circle').data(data, (d) => d.code).join('circle')
    .attr('class', (d) => `commercial-node${d.n < MIN_SAMPLE ? ' is-low-sample' : ''}`)
    .attr('cx', (d) => previous.get(d.code)?.n ? x(previous.get(d.code).use) : x(3))
    .attr('cy', (d) => previous.get(d.code)?.n ? y(previous.get(d.code).buy) : y(3))
    .attr('r', (d) => previous.get(d.code)?.n < MIN_SAMPLE ? 8 : radius(previous.get(d.code)?.n || MIN_SAMPLE))
    .attr('opacity', (d) => previous.has(d.code) ? (previous.get(d.code).n ? (previous.get(d.code).n < MIN_SAMPLE ? .42 : 1) : 0) : 0)
    .attr('tabindex', (d) => d.n ? 0 : -1)
    .attr('aria-label', (d) => d.n ? `${d.name}: intention to use ${d.use.toFixed(2)} of 5, intention to buy ${d.buy.toFixed(2)} of 5, ${d.n} respondents.` : `${d.name}: no respondents for these filters.`);
  nodes.on('focus', (event, d) => activateNode(state, event, d, nodes)).on('blur', () => clearActiveNode(state, nodes));
  nodes.transition().duration(motion).ease(d3.easeCubicOut)
    .attr('cx', (d) => d.n ? x(d.use) : x(3)).attr('cy', (d) => d.n ? y(d.buy) : y(3))
    .attr('r', (d) => d.n < MIN_SAMPLE ? 8 : radius(d.n)).attr('opacity', (d) => d.n ? (d.n < MIN_SAMPLE ? .42 : 1) : 0);
  const reachable = data.filter((d) => d.n);
  const delaunay = reachable.length ? d3.Delaunay.from(reachable, (d) => x(d.use), (d) => y(d.buy)) : null;
  svg.style('cursor', 'default').on('pointermove', (event) => {
    const [pointerX, pointerY] = d3.pointer(event, svg.node());
    const nearest = delaunay && reachable[delaunay.find(pointerX, pointerY)];
    const isNear = nearest && Math.hypot(pointerX - x(nearest.use), pointerY - y(nearest.buy)) <= 30;
    svg.style('cursor', isNear ? 'pointer' : 'default');
    if (isNear) activateNode(state, event, nearest, nodes);
    else clearActiveNode(state, nodes);
  }).on('pointerleave', () => clearActiveNode(state, nodes));
  state.previousData = data;
}

function update(state) {
  updateControls(state);
  draw(state, summarize(state.rows, state.filters));
}

export function renderCommercialGap(container, respondents) {
  if (container.__commercialGap) return;
  const state = { container, rows: validateRows(respondents), filters: { age: 'all', income: 'all' }, resizeTimer: null };
  container.__commercialGap = state;
  buildControls(state);
  state.resizeObserver = new ResizeObserver(() => {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => update(state), 120);
  });
  state.resizeObserver.observe(state.frame.node());
  const scroll = container.closest('.chart-scroll');
  if (scroll) state.resizeObserver.observe(scroll);
  update(state);
}
