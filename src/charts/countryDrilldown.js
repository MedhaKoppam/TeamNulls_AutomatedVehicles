import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { renderChoropleth, renderMetricControls } from './choropleth.js';

const MIN_N = 15;
const noMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const activityLabels = { takingCareOfChildren: 'Care for children', talkingWithFellowTravelers: 'Talk with passengers', internetOrVideo: 'Internet or video', playingGames: 'Play games', socializing: 'Socialize', eatingOrDrinking: 'Eat or drink', observingLandscape: 'Observe landscape', relaxingOrResting: 'Relax or rest', readingBook: 'Read a book', working: 'Work', other: 'Other activity' };
const metricLines = { trust: ['Trust'], adoption: ['Adoption', 'intention'], safetyConfidence: ['Safety', 'confidence'], expectedBenefits: ['Expected', 'benefits'], awareness: ['Prior', 'awareness'], secondaryActivities: ['Secondary', 'activities'], capabilityKnowledge: ['L3 capability', 'knowledge'] };

const findCountry = (source, iso3) => Object.entries(source.countries).map(([id, country]) => ({ id, ...country })).find((country) => country.iso3 === iso3);
const ordinal = (value) => `${value}${value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'}`;
function tip(host, event, html) { d3.select(host).selectAll('.profile-tooltip').data([null]).join('div').attr('class', 'profile-tooltip').html(html).style('left', `${event.offsetX + 12}px`).style('top', `${event.offsetY + 12}px`).style('opacity', 1); }
function hideTip(host) { d3.select(host).select('.profile-tooltip').style('opacity', 0); }
function addLines(selection, lines, lineHeight = 14) { selection.text(null); lines.forEach((line, index) => selection.append('tspan').attr('x', selection.attr('x')).attr('dy', index ? lineHeight : 0).text(line)); }
function svg(host, name, width, height, label) { return d3.select(host).append('svg').attr('class', name).attr('width', width).attr('height', height).attr('role', 'img').attr('aria-label', label); }

// All profile charts use physical SVG pixels.  The minimum logical width allows
// horizontal scrolling on narrow phones rather than shrinking text below 12px.
function responsive(host, minHeight, draw) {
  const render = () => {
    const minWidth = host.classList.contains('profile-panel-heat') ? 740 : 480;
    const width = Math.max(minWidth, Math.floor(host.clientWidth - 48));
    d3.select(host).selectAll('svg').remove();
    draw(width, Math.max(minHeight, 1));
  };
  host.__resizeObserver?.disconnect();
  let debounce;
  host.__resizeObserver = new ResizeObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 90);
  });
  host.__resizeObserver.observe(host);
  requestAnimationFrame(render);
}
function clearProfile(stage) { stage.querySelectorAll('.profile-panel').forEach((panel) => panel.__resizeObserver?.disconnect()); stage.innerHTML = ''; }
function contrast(fill) { const color = d3.rgb(fill); return (color.r * .299 + color.g * .587 + color.b * .114) > 142 ? '#0b0d10' : '#eff4f5'; }
function lockTextSizes(chart) { chart.selectAll('text[font-size]').style('font-size', function () { return `${this.getAttribute('font-size')}px`; }); }

function renderHeatmap(host, source, country, active) {
  responsive(host, 430, (width) => {
    const groups = country.subgroups?.age ?? [];
    const margin = { top: 124, right: 24, bottom: 150, left: 106 };
    const height = margin.top + groups.length * 48 + margin.bottom;
    const chart = svg(host, 'profile-heatmap', width, height, `Metric by age differences from global averages in ${country.name}`);
    const x = d3.scaleBand().domain(source.metrics.map((metric) => metric.key)).range([margin.left, width - margin.right]).padding(.055);
    const y = d3.scaleBand().domain(groups.map((group) => group.label)).range([margin.top, height - margin.bottom]).padding(.08);
    const cells = groups.flatMap((group) => source.metrics.map((metric) => ({ group, metric, value: group.metrics[metric.key], n: group.metricN[metric.key], diff: group.metrics[metric.key] - source.global[metric.key] })));
    const maxGap = Math.max(6, d3.max(cells.filter((cell) => cell.n >= MIN_N && Number.isFinite(cell.diff)), (cell) => Math.abs(cell.diff)) || 6);
    const color = d3.scaleLinear().domain([-maxGap, 0, maxGap]).range(['#e66767', '#66727a', '#6da7ec']).interpolate(d3.interpolateRgb);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Metric × age');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Blue cells: this age group is more positive than the world average.');
    const activeX = x(active.key);
    chart.append('rect').attr('class', 'active-column-outline').attr('x', activeX - 3).attr('y', margin.top - 52).attr('width', x.bandwidth() + 6).attr('height', height - margin.top + 52 - margin.bottom).attr('rx', 6);
    chart.selectAll('.heatmap-column').data(source.metrics).join('text').attr('class', 'heatmap-column').attr('x', (metric) => x(metric.key) + x.bandwidth() / 2).attr('y', margin.top - 38).attr('text-anchor', 'middle').attr('font-size', 12).each(function (metric) { addLines(d3.select(this), metricLines[metric.key]); });
    chart.selectAll('.heatmap-row').data(groups).join('text').attr('class', 'heatmap-row').attr('x', margin.left - 12).attr('y', (group) => y(group.label) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').attr('font-size', 12).text((group) => group.label);
    const defs = chart.append('defs');
    const hatch = defs.append('pattern').attr('id', `low-n-${country.iso3}`).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#536069'); hatch.append('line').attr('x1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#9aa5ab').attr('stroke-width', 2);
    chart.selectAll('.heatmap-cell').data(cells).join('rect').attr('class', 'heatmap-cell').attr('x', (cell) => x(cell.metric.key)).attr('y', (cell) => y(cell.group.label)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('fill', (cell) => cell.n < MIN_N || !Number.isFinite(cell.diff) ? `url(#low-n-${country.iso3})` : color(cell.diff)).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (cell) => `${cell.group.label}, ${cell.metric.label}: ${cell.value.toFixed(1)}, ${cell.diff >= 0 ? '+' : ''}${cell.diff.toFixed(1)} points from global, n=${cell.n}`).on('mouseenter focus', (event, cell) => tip(host, event, `<strong>${cell.group.label} · ${cell.metric.label}</strong><br>${cell.value.toFixed(1)} / 100 · ${cell.diff >= 0 ? '+' : ''}${cell.diff.toFixed(1)} vs global<br>n=${cell.n}${cell.n < MIN_N ? ' (low sample)' : ''}`)).on('mouseleave blur', () => hideTip(host));
    chart.selectAll('.heatmap-value').data(cells).join('text').attr('class', 'heatmap-value').attr('x', (cell) => x(cell.metric.key) + x.bandwidth() / 2).attr('y', (cell) => y(cell.group.label) + y.bandwidth() / 2 + 5).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', (cell) => cell.n < MIN_N ? '#eff4f5' : contrast(color(cell.diff))).text((cell) => cell.n < MIN_N ? 'N/A' : Math.round(cell.value));
    const legend = chart.append('g').attr('class', 'heatmap-legend').attr('transform', `translate(${margin.left},${height - 126})`);
    const grad = defs.append('linearGradient').attr('id', `heat-gradient-${country.iso3}`);
    grad.selectAll('stop').data(d3.range(0, 1.01, .1)).join('stop').attr('offset', (value) => `${value * 100}%`).attr('stop-color', (value) => color(-maxGap + value * maxGap * 2));
    legend.append('rect').attr('width', 190).attr('height', 10).attr('rx', 5).attr('fill', `url(#heat-gradient-${country.iso3})`);
    legend.append('text').attr('x', 0).attr('y', 28).attr('font-size', 12).text(`Below global average −${maxGap.toFixed(0)}`);
    legend.append('text').attr('x', 190).attr('y', 28).attr('font-size', 12).attr('text-anchor', 'end').text(`Above global average +${maxGap.toFixed(0)}`);
    legend.append('rect').attr('x', 240).attr('width', 12).attr('height', 10).attr('fill', `url(#low-n-${country.iso3})`); legend.append('text').attr('x', 259).attr('y', 10).attr('font-size', 12).text('n < 15');
    legend.selectAll('*').attr('opacity', 0);
    const measure = legend.append('text').attr('font-size', 12).attr('opacity', 0).text('Below global average');
    const belowWidth = measure.node().getComputedTextLength();
    measure.text('Above global average');
    const aboveWidth = measure.node().getComputedTextLength();
    measure.remove();
    const availableLegendWidth = width - margin.left - 24;
    const labelsStack = availableLegendWidth < belowWidth + aboveWidth + 48;
    const legendWidth = Math.max(0, Math.min(Math.max(320, belowWidth + aboveWidth + 48), availableLegendWidth));
    legend.append('rect').attr('width', legendWidth).attr('height', 10).attr('rx', 5).attr('fill', `url(#heat-gradient-${country.iso3})`);
    legend.selectAll('text.clean-tick').data([{ x: 0, label: `-${maxGap.toFixed(0)}` }, { x: legendWidth / 2, label: '0' }, { x: legendWidth, label: `+${maxGap.toFixed(0)}` }]).join('text').attr('class', 'clean-tick').attr('x', (d) => d.x).attr('y', 27).attr('text-anchor', (d) => d.x === 0 ? 'start' : d.x === legendWidth ? 'end' : 'middle').attr('font-size', 12).text((d) => d.label);
    legend.append('text').attr('x', 0).attr('y', 46).attr('font-size', 12).text('Below global average');
    legend.append('text').attr('x', labelsStack ? 0 : legendWidth).attr('y', labelsStack ? 64 : 46).attr('text-anchor', labelsStack ? 'start' : 'end').attr('font-size', 12).text('Above global average');
    const hatchY = labelsStack ? 80 : 64;
    legend.append('rect').attr('x', 0).attr('y', hatchY).attr('width', 12).attr('height', 10).attr('fill', `url(#low-n-${country.iso3})`); legend.append('text').attr('x', 19).attr('y', hatchY + 10).attr('font-size', 12).text('n < 15');
    lockTextSizes(chart);
  });
}

function renderBehavior(host, source, country) {
  responsive(host, 480, (width) => {
    const rows = Object.entries(country.behaviors).map(([key, value]) => ({ key, label: activityLabels[key] ?? key, value, global: source.globalDetails.behaviors[key], gap: value - source.globalDetails.behaviors[key] })).sort((a, b) => d3.ascending(a.gap, b.gap));
    const margin = { top: 94, right: 68, bottom: 58, left: Math.min(196, Math.max(112, width * .29)) }, height = margin.top + rows.length * 34 + margin.bottom;
    const extent = Math.max(10, d3.max(rows, (row) => Math.abs(row.gap)) || 10);
    const chart = svg(host, 'behavior-chart', width, height, `Secondary activities in ${country.name}, compared with global shares`);
    const x = d3.scaleLinear().domain([-extent, extent]).nice().range([margin.left, width - margin.right]), y = d3.scaleBand().domain(rows.map((row) => row.key)).range([margin.top, height - margin.bottom]).padding(.24);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Behavioral signature');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Which activities this country would do more or less than the world.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value > 0 ? '+' : ''}${value}`)).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'zero-line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', margin.top - 6).attr('y2', height - margin.bottom);
    chart.selectAll('.behavior-label').data(rows).join('text').attr('class', 'behavior-label').attr('x', margin.left - 12).attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').attr('font-size', 13).text((row) => row.label);
    chart.selectAll('.behavior-bar').data(rows).join('rect').attr('class', (row) => `behavior-bar ${row.gap >= 0 ? 'above' : 'below'}`).attr('x', (row) => x(Math.min(0, row.gap))).attr('y', (row) => y(row.key)).attr('height', y.bandwidth()).attr('width', 0).attr('rx', 3).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (row) => `${row.label}: ${row.value.toFixed(1)}%, ${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(1)} points from global`).on('mouseenter focus', (event, row) => tip(host, event, `<strong>${row.label}</strong><br>${country.name}: ${row.value.toFixed(1)}%<br>Global: ${row.global.toFixed(1)}% (${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(1)} pp)`)).on('mouseleave blur', () => hideTip(host)).transition().duration(noMotion() ? 0 : 260).ease(d3.easeCubicOut).attr('width', (row) => Math.abs(x(row.gap) - x(0)));
    chart.selectAll('.behavior-value').data(rows).join('text').attr('class', 'behavior-value').attr('x', (row) => row.gap >= 0 ? x(row.gap) + 7 : x(row.gap) - 7).attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5).attr('text-anchor', (row) => row.gap >= 0 ? 'start' : 'end').attr('font-size', 12).text((row) => `${row.gap >= 0 ? '+' : ''}${Math.round(row.gap)}`);
    chart.append('text').attr('class', 'axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 10).attr('text-anchor', 'middle').attr('font-size', 13).text('vs global share (percentage points)');
    lockTextSizes(chart);
  });
}

function renderScatter(host, source, country) {
  responsive(host, 480, (width) => {
    const points = Object.values(source.countries).filter((item) => Number.isFinite(item.metrics.adoption) && Number.isFinite(item.metrics.awareness));
    const margin = { top: 86, right: 38, bottom: 64, left: 64 }, height = 460;
    const xExtent = d3.extent(points, (item) => item.metrics.awareness), yExtent = d3.extent(points, (item) => item.metrics.adoption);
    const xPad = Math.max(4, (xExtent[1] - xExtent[0]) * .12), yPad = Math.max(4, (yExtent[1] - yExtent[0]) * .12);
    const x = d3.scaleLinear().domain([xExtent[0] - xPad, xExtent[1] + xPad]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).range([height - margin.bottom, margin.top]);
    const chart = svg(host, 'paradox-chart', width, height, `Adoption intention versus prior awareness, with ${country.name} highlighted`);
    const meanX = d3.mean(points, (item) => item.metrics.awareness), meanY = d3.mean(points, (item) => item.metrics.adoption);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Readiness position');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Where this country sits on intended use and prior awareness.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5)).selectAll('text').attr('font-size', 12);
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4)).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'quadrant-line').attr('x1', x(meanX)).attr('x2', x(meanX)).attr('y1', margin.top).attr('y2', height - margin.bottom); chart.append('line').attr('class', 'quadrant-line').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', y(meanY)).attr('y2', y(meanY));
    [['eager, less aware', margin.left + 12, margin.top + 20, 'start'], ['aware, eager', width - margin.right - 12, margin.top + 20, 'end'], ['aware, less eager', width - margin.right - 12, height - margin.bottom - 14, 'end']].forEach(([label, px, py, anchor]) => chart.append('text').attr('class', 'quadrant-label').attr('x', px).attr('y', py).attr('text-anchor', anchor).attr('font-size', 12).text(label));
    const anchors = new Set([country.iso3, d3.min(points, (item) => item.metrics.awareness).iso3, d3.max(points, (item) => item.metrics.awareness).iso3, d3.min(points, (item) => item.metrics.adoption).iso3, d3.max(points, (item) => item.metrics.adoption).iso3]);
    chart.selectAll('.country-dot').data(points).join('circle').attr('class', (item) => `country-dot${item.iso3 === country.iso3 ? ' selected' : ''}`).attr('cx', (item) => x(item.metrics.awareness)).attr('cy', (item) => y(item.metrics.adoption)).attr('r', (item) => item.iso3 === country.iso3 ? 10 : 6.5).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (item) => `${item.name}: awareness ${item.metrics.awareness.toFixed(1)}, adoption ${item.metrics.adoption.toFixed(1)}`).on('mouseenter focus', (event, item) => tip(host, event, `<strong>${item.name}</strong><br>Prior awareness: ${item.metrics.awareness.toFixed(1)}<br>Adoption intention: ${item.metrics.adoption.toFixed(1)}`)).on('mouseleave blur', () => hideTip(host));
    chart.selectAll('.anchor-label').data(points.filter((item) => anchors.has(item.iso3))).join('text').attr('class', (item) => `anchor-label${item.iso3 === country.iso3 ? ' selected' : ''}`).attr('x', (item) => x(item.metrics.awareness) > width - margin.right - 110 ? x(item.metrics.awareness) - 10 : x(item.metrics.awareness) + 10).attr('y', (item) => y(item.metrics.adoption) - 10).attr('text-anchor', (item) => x(item.metrics.awareness) > width - margin.right - 110 ? 'end' : 'start').attr('font-size', 12).text((item) => item.name);
    chart.append('text').attr('class', 'axis-title').attr('x', width / 2).attr('y', height - 12).attr('text-anchor', 'middle').attr('font-size', 13).text('Prior awareness'); chart.append('text').attr('class', 'axis-title').attr('transform', `translate(18,${height / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 13).text('Adoption intention');
    lockTextSizes(chart);
  });
}

function profile(stage, mapData, state, actions, { showBack = false } = {}) {
  const source = mapData.metrics, country = findCountry(source, state.selectedCountry), active = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0]; if (!country) return;
  clearProfile(stage);
  const sorted = Object.values(source.countries).filter((item) => Number.isFinite(item.metrics[active.key])).sort((a, b) => d3.descending(a.metrics[active.key], b.metrics[active.key])); const rank = sorted.findIndex((item) => item.iso3 === country.iso3) + 1;
  const page = d3.select(stage).append('section').attr('class', 'country-profile').attr('aria-label', `${country.name} country profile`);
  if (showBack) page.append('div').attr('class', 'profile-back-row').append('button').attr('type', 'button').attr('class', 'country-back').attr('aria-label', 'Back to world map').html('&larr;<span> World map</span>').on('click', () => actions.setCountry(null));
  const body = page.append('div').attr('class', 'profile-body'), rail = body.append('aside').attr('class', 'profile-rail');
  const selected = feature(mapData.geometry, mapData.geometry.objects.countries).features.find((item) => String(item.id).padStart(3, '0') === country.id); const silhouette = rail.append('svg').attr('class', 'country-silhouette').attr('viewBox', '0 0 150 100').attr('aria-hidden', 'true'); if (selected) silhouette.append('path').attr('d', d3.geoPath(d3.geoNaturalEarth1().fitSize([136, 86], selected))(selected)).attr('class', 'silhouette-path');
  rail.append('h3').text(country.name); rail.append('p').attr('class', 'rail-meta').text(country.region); rail.append('p').attr('class', 'rail-meta').text(`n=${country.n.toLocaleString()}${country.lowSample ? ' · low sample' : ''}`); rail.append('p').attr('class', 'rail-rank').text(`${ordinal(rank)} of ${sorted.length} on ${active.label}`);
  const panels = body.append('div').attr('class', 'profile-panels'); renderHeatmap(panels.append('section').attr('class', 'profile-panel profile-panel-heat').node(), source, country, active); renderBehavior(panels.append('section').attr('class', 'profile-panel').node(), source, country); renderScatter(panels.append('section').attr('class', 'profile-panel').node(), source, country);
}

export function renderCountryDrilldown(container, mapData, state, actions) {
  const was = container.__selectedCountry; container.__selectedCountry = state.selectedCountry;
  container.closest('.chart-scroll')?.classList.toggle('map-chart-scroll', !state.selectedCountry);
  d3.select(container).selectAll('.map-controls').data([null]).join('div').attr('class', 'map-controls');
  renderMetricControls(container, mapData.metrics, state, actions);
  const controls = container.querySelector('.map-controls');
  let world = container.querySelector('.world-view');
  if (!world) { world = document.createElement('div'); world.className = 'world-view'; controls.after(world); }

  let layout = world.querySelector('.world-layout');
  if (!layout) {
    layout = document.createElement('div'); layout.className = 'world-layout';
    const mapPane = document.createElement('div'); mapPane.className = 'world-map-pane';
    const sidePane = document.createElement('aside'); sidePane.className = 'world-side-pane';
    sidePane.setAttribute('aria-label', 'Global metric summary');
    layout.append(mapPane, sidePane); world.append(layout);
  }
  const mapPane = layout.querySelector('.world-map-pane');
  let worldStage = mapPane.querySelector('.drilldown-stage');
  if (!worldStage) { worldStage = document.createElement('div'); worldStage.className = 'drilldown-stage'; mapPane.append(worldStage); }

  let profileStage = container.querySelector('.profile-view');
  if (!profileStage) { profileStage = document.createElement('div'); profileStage.className = 'profile-view drilldown-stage'; world.after(profileStage); }
  const scrollFrame = () => container.closest('.chart-scroll')?.scrollTo({ top: 0, behavior: noMotion() ? 'auto' : 'smooth' });
  if (state.selectedCountry) {
    world.hidden = true;
    profileStage.hidden = false;
    profileStage.classList.add('is-changing');
    profile(profileStage, mapData, state, actions, { showBack: true });
    requestAnimationFrame(() => { profileStage.classList.remove('is-changing'); scrollFrame(); });
  } else {
    profileStage.hidden = true;
    world.hidden = false;
    worldStage.classList.add('is-changing');
    clearProfile(worldStage);
    renderChoropleth(worldStage, mapData, state, actions);
    if (was) requestAnimationFrame(() => { worldStage.classList.remove('is-changing'); worldStage.querySelector(`[data-country="${was}"]`)?.focus(); scrollFrame(); });
    else requestAnimationFrame(() => worldStage.classList.remove('is-changing'));
  }
  if (!container.__escHandler) { container.__escHandler = (event) => { if (event.key === 'Escape' && container.__selectedCountry) actions.setCountry(null); }; document.addEventListener('keydown', container.__escHandler); }
}

export function renderGlobalOverview(container, mapData, state, actions) {
  const source = mapData.metrics;
  const metric = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0];
  const countries = Object.values(source.countries).filter((country) => Number.isFinite(country.metrics[metric.key]));
  const highest = d3.greatest(countries, (country) => country.metrics[metric.key]);
  const lowest = d3.least(countries, (country) => country.metrics[metric.key]);
  const summary = d3.select(container).selectAll('.global-summary').data([null]).join('section').attr('class', 'global-summary').attr('aria-label', 'Selected metric summary');
  summary.html(`<div><span class="micro-label">Global average</span><strong>${source.global[metric.key].toFixed(1)}</strong><span>${metric.label}</span></div><div><span class="micro-label">Highest</span><strong>${highest.name}</strong><span>${highest.metrics[metric.key].toFixed(1)} / 100</span></div><div><span class="micro-label">Lowest</span><strong>${lowest.name}</strong><span>${lowest.metrics[metric.key].toFixed(1)} / 100</span></div>`);
  d3.select(container).selectAll('.map-controls').data([null]).join('div').attr('class', 'map-controls');
  renderMetricControls(container, source, state, actions);
  const stage = d3.select(container).selectAll('.drilldown-stage').data([null]).join('div').attr('class', 'drilldown-stage').node();
  clearProfile(stage);
  renderChoropleth(stage, mapData, state, {
    ...actions,
    setCountry: (iso3) => {
      actions.setCountry(iso3);
      if (iso3) actions.setTab('country-deep-dive');
    },
  });
}

export function renderCountryDeepDive(container, mapData, state, actions) {
  const source = mapData.metrics;
  const countries = Object.values(source.countries).sort((a, b) => d3.ascending(a.name, b.name));
  d3.select(container).selectAll('.map-controls').data([null]).join('div').attr('class', 'map-controls');
  renderMetricControls(container, source, state, actions, { showRanking: false });
  const selector = d3.select(container).selectAll('.country-picker').data([null]).join('label').attr('class', 'country-picker');
  selector.html('<span class="micro-label">Selected country</span>');
  selector.append('select').attr('aria-label', 'Select country profile').selectAll('option').data(countries).join('option').attr('value', (country) => country.iso3).property('selected', (country) => country.iso3 === state.selectedCountry).text((country) => country.name);
  selector.select('select').on('change', function change() { actions.setCountry(this.value); });
  const stage = d3.select(container).selectAll('.deep-dive-stage').data([null]).join('div').attr('class', 'deep-dive-stage').node();
  const selected = state.selectedCountry || countries[0]?.iso3;
  profile(stage, mapData, { ...state, selectedCountry: selected }, actions);
}
