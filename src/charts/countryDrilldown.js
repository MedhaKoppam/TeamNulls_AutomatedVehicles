import * as d3 from 'd3';
import { renderChoropleth, renderMetricControls } from './choropleth.js';

const MIN_N = 15;
const noMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const activityLabels = { takingCareOfChildren: 'Taking care of children', talkingWithFellowTravelers: 'Talking with fellow travelers', internetOrVideo: 'Internet or video', playingGames: 'Playing games', socializing: 'Socializing', eatingOrDrinking: 'Eating or drinking', observingLandscape: 'Observing the landscape', relaxingOrResting: 'Relaxing or resting', readingBook: 'Reading a book', working: 'Working', other: 'Other activities' };
const metricLines = { trust: ['Trust'], adoption: ['Adoption', 'intention'], safetyConfidence: ['Safety', 'confidence'], expectedBenefits: ['Expected', 'benefits'], awareness: ['Prior', 'awareness'], secondaryActivities: ['Secondary', 'activities'], capabilityKnowledge: ['L3 capability', 'knowledge'] };
const metricValueText = (metric, value) => metric.unit === 'percent' ? `${value.toFixed(1)}%` : `${value.toFixed(2)} / 5`;
const metricDifferenceText = (metric, value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} ${metric.unit === 'percent' ? 'percentage points' : 'scale points'}`;


const findCountry = (source, iso3) => Object.entries(source.countries).map(([id, country]) => ({ id, ...country })).find((country) => country.iso3 === iso3);
function tip(host, event, html) { d3.select(host).selectAll('.profile-tooltip').data([null]).join('div').attr('class', 'profile-tooltip').html(html).style('left', `${event.offsetX + 12}px`).style('top', `${event.offsetY + 12}px`).style('opacity', 1); }
function hideTip(host) { d3.select(host).select('.profile-tooltip').style('opacity', 0); }
function addLines(selection, lines, lineHeight = 14) { selection.text(null); lines.forEach((line, index) => selection.append('tspan').attr('x', selection.attr('x')).attr('dy', index ? lineHeight : 0).text(line)); }
function svg(host, name, width, height, label) { return d3.select(host).append('svg').attr('class', name).attr('width', width).attr('height', height).attr('role', 'img').attr('aria-label', label); }

function responsive(host, minHeight, draw) {
  const render = () => {
    const width = Math.max(260, Math.floor(host.clientWidth - 32));
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
    const compact = width < 470;
    const stackedHeader = width < 650;
    const legendY = stackedHeader ? (compact ? 59 : 61) : 12;
    const legendBottom = legendY + 39;
    const columnFontTop = compact ? 8 : 11;
    const columnLineHeight = compact ? 10 : 14;
    const headerY = Math.max(42, legendBottom) + 44 + columnFontTop;
    const gridTop = headerY + columnLineHeight + 14;
    // Preserve cell dimensions while reserving space for the header row,
    // column labels, and their breathing room above the grid.
    const margin = { top: gridTop, right: 12, bottom: compact ? 16 : 17, left: compact ? 68 : 106 };
    const height = margin.top + groups.length * (compact ? 38 : 48) + margin.bottom;
    const chart = svg(host, 'profile-heatmap', width, height, `Country metrics by age group in ${country.name}`);
    const x = d3.scaleBand().domain(source.metrics.map((metric) => metric.key)).range([margin.left, width - margin.right]).padding(.055);
    const y = d3.scaleBand().domain(groups.map((group) => group.label)).range([margin.top, height - margin.bottom]).padding(.08);
    const cells = groups.flatMap((group) => source.metrics.map((metric) => {
      const value = group.metrics[metric.key];
      const global = source.global[metric.key];
      return { group, metric, value, n: group.metricN[metric.key], diff: Number.isFinite(value) && Number.isFinite(global) ? value - global : null };
    }));
    // Each metric column gets its own symmetric scale. Five columns are
    // Likert means (1–5); awareness and capability knowledge are percentages,
    // so mixing their raw differences on one shared scale would be misleading.
    const maxGapByMetric = new Map(source.metrics.map((metric) => {
      const maxGap = Math.max(
        0.0001,
        d3.max(cells.filter((cell) => cell.metric.key === metric.key && cell.n >= MIN_N && Number.isFinite(cell.diff)),
          (cell) => Math.abs(cell.diff)) || 0
      );
      return [metric.key, maxGap];
    }));
    const colorByMetric = new Map(source.metrics.map((metric) => [
      metric.key,
      d3.scaleLinear()
        .domain([-maxGapByMetric.get(metric.key), 0, maxGapByMetric.get(metric.key)])
        .range(['#d95f59', '#f0d58a', '#278c78'])
        .clamp(true),
    ]));
    chart.append('text').attr('class', 'panel-title').attr('x', 0).attr('y', 23).attr('font-size', compact ? 16 : 18).text('Country metrics by age');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', 0).attr('y', 42).attr('font-size', compact ? 11 : 13).text('Color shows difference from each metric’s global average.');
    const activeX = x(active.key);
    const firstCellY = y(groups[0]?.label);
    const lastCellY = y(groups.at(-1)?.label);
    chart.append('rect').attr('class', 'active-column-outline').attr('x', activeX - 3).attr('y', firstCellY - 3).attr('width', x.bandwidth() + 6).attr('height', lastCellY + y.bandwidth() - firstCellY + 6).attr('rx', 6);
    chart.selectAll('.heatmap-column').data(source.metrics).join('text').attr('class', 'heatmap-column').attr('x', (metric) => x(metric.key) + x.bandwidth() / 2).attr('y', headerY).attr('text-anchor', 'middle').attr('font-size', compact ? 8 : 12).each(function (metric) { addLines(d3.select(this), metricLines[metric.key], columnLineHeight); });
    chart.selectAll('.heatmap-row').data(groups).join('text').attr('class', 'heatmap-row').attr('x', margin.left - 8).attr('y', (group) => y(group.label) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').attr('font-size', compact ? 9 : 12).text((group) => group.label);
    const defs = chart.append('defs');
    const hatch = defs.append('pattern').attr('id', `low-n-${country.iso3}`).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#536069');
    hatch.append('line').attr('x1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#9aa5ab').attr('stroke-width', 2);
    chart.selectAll('.heatmap-cell').data(cells).join('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', (cell) => x(cell.metric.key)).attr('y', (cell) => y(cell.group.label))
      .attr('width', x.bandwidth()).attr('height', y.bandwidth())
      .attr('fill', (cell) => cell.n < MIN_N || !Number.isFinite(cell.diff) ? `url(#low-n-${country.iso3})` : colorByMetric.get(cell.metric.key)(cell.diff))
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (cell) => `${cell.group.label}, ${cell.metric.label}: ${Number.isFinite(cell.value) ? metricValueText(cell.metric, cell.value) : 'not available'}, difference from global ${Number.isFinite(cell.diff) ? metricDifferenceText(cell.metric, cell.diff) : 'not available'}, n=${cell.n}`)
      .on('mouseenter focus', (event, cell) => tip(host, event, `<strong>${cell.group.label} · ${cell.metric.label}</strong><br>${Number.isFinite(cell.value) ? metricValueText(cell.metric, cell.value) : 'Not available'}<br>${Number.isFinite(cell.diff) ? `${metricDifferenceText(cell.metric, cell.diff)} vs global` : 'No global comparison'}<br>n=${cell.n}${cell.n < MIN_N ? ' (low sample)' : ''}`))
      .on('mouseleave blur', () => hideTip(host));
    chart.selectAll('.heatmap-value').data(cells).join('text')
      .attr('class', 'heatmap-value')
      .attr('x', (cell) => x(cell.metric.key) + x.bandwidth() / 2)
      .attr('y', (cell) => y(cell.group.label) + y.bandwidth() / 2 + 5)
      .attr('text-anchor', 'middle').attr('font-size', compact ? 8 : 12)
      .attr('fill', (cell) => cell.n < MIN_N || !Number.isFinite(cell.diff) ? '#eff4f5' : contrast(colorByMetric.get(cell.metric.key)(cell.diff)))
      .text((cell) => cell.n < MIN_N || !Number.isFinite(cell.value) ? 'N/A' : cell.value.toFixed(1));
    const legendWidth = Math.max(120, Math.min(compact ? 180 : 300, width - 12));
    const legendX = stackedHeader ? 0 : width - legendWidth;
    const legend = chart.append('g').attr('class', 'heatmap-legend').attr('transform', `translate(${legendX},${legendY})`);
    const grad = defs.append('linearGradient').attr('id', `heat-gradient-${country.iso3}`);
    grad.selectAll('stop').data(d3.range(0, 1.01, .1)).join('stop')
      .attr('offset', (value) => `${value * 100}%`)
      .attr('stop-color', (value) => d3.interpolateRgbBasis(['#d95f59', '#f0d58a', '#278c78'])(value));
    legend.append('text').attr('x', 0).attr('y', 8).attr('font-size', compact ? 9 : 11).text('Below global average');
    legend.append('text').attr('x', legendWidth).attr('y', 8).attr('font-size', compact ? 9 : 11).attr('text-anchor', 'end').text('Above global average');
    legend.append('rect').attr('y', 14).attr('width', legendWidth).attr('height', 10).attr('rx', 5).attr('fill', `url(#heat-gradient-${country.iso3})`);
    legend.append('line').attr('x1', legendWidth / 2).attr('x2', legendWidth / 2).attr('y1', 11).attr('y2', 27).attr('stroke', '#fff').attr('stroke-width', 1.5);
    legend.append('text').attr('x', legendWidth / 2).attr('y', 39).attr('text-anchor', 'middle').attr('font-size', compact ? 9 : 11).text('Global average');
    lockTextSizes(chart);
  });
}

function renderBehavior(host, source, country) {
  responsive(host, 430, (width) => {
    const rows = Object.entries(country.behaviors ?? {})
      .filter(([key, value]) => Number.isFinite(value) && Number.isFinite(source.globalDetails.behaviors[key]))
      .map(([key, value]) => ({ key, label: activityLabels[key] ?? key, value, global: source.globalDetails.behaviors[key], gap: value - source.globalDetails.behaviors[key] }))
      .sort((a, b) => d3.ascending(a.gap, b.gap));
    const margin = { top: 94, right: 68, bottom: 58, left: Math.min(196, Math.max(112, width * .29)) };
    const height = margin.top + rows.length * 34 + margin.bottom;
    const extent = Math.max(5, d3.max(rows, (row) => Math.abs(row.gap)) || 5);
    const chart = svg(host, 'behavior-chart', width, height, `Secondary activities in ${country.name}, compared with global shares`);
    const x = d3.scaleLinear().domain([-extent, extent]).nice().range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(rows.map((row) => row.key)).range([margin.top, height - margin.bottom]).padding(.24);
    chart.append('text').attr('class', 'panel-title').attr('x', 0).attr('y', 25).attr('font-size', 18).text('Secondary activities while riding');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', 0).attr('y', 47).attr('font-size', 13).text('How each activity compares with the global share of respondents selecting it.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`)).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'zero-line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', margin.top - 6).attr('y2', height - margin.bottom);
    chart.selectAll('.behavior-label').data(rows).join('text').attr('class', 'behavior-label').attr('x', margin.left - 12).attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').attr('font-size', 13).text((row) => row.label);
    chart.selectAll('.behavior-bar').data(rows).join('rect')
      .attr('class', (row) => `behavior-bar ${row.gap >= 0 ? 'above' : 'below'}`)
      .attr('x', (row) => x(Math.min(0, row.gap))).attr('y', (row) => y(row.key))
      .attr('height', y.bandwidth()).attr('width', 0).attr('rx', 3)
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (row) => `${row.label}: ${row.value.toFixed(1)}%, global ${row.global.toFixed(1)}%, difference ${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(1)} percentage points`)
      .on('mouseenter focus', (event, row) => tip(host, event, `<strong>${row.label}</strong><br>${country.name}: ${row.value.toFixed(1)}%<br>Global: ${row.global.toFixed(1)}%<br>Difference: ${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(1)} percentage points`))
      .on('mouseleave blur', () => hideTip(host))
      .transition().duration(noMotion() ? 0 : 260).ease(d3.easeCubicOut)
      .attr('width', (row) => Math.abs(x(row.gap) - x(0)));
    chart.selectAll('.behavior-value').data(rows).join('text').attr('class', 'behavior-value')
      .attr('x', (row) => row.gap >= 0 ? x(row.gap) + 7 : x(row.gap) - 7)
      .attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5)
      .attr('text-anchor', (row) => row.gap >= 0 ? 'start' : 'end').attr('font-size', 12)
      .text((row) => `${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(1)}`);
    chart.append('text').attr('class', 'axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 10).attr('text-anchor', 'middle').attr('font-size', 13).text('Difference from global share (percentage points)');
    lockTextSizes(chart);
  });
}

function renderTripPurposeSpider(host, source, country) {
  const dimensions = [
    { key: 'commute', label: 'Commute', lines: ['Commute'] },
    { key: 'businessTravel', label: 'Business travel', lines: ['Business', 'travel'] },
    { key: 'errands', label: 'Errands', lines: ['Errands'] },
    { key: 'leisure', label: 'Leisure', lines: ['Leisure'] },
    { key: 'vacation', label: 'Vacation', lines: ['Vacation'] },
  ];
  const countryItems = country.tripPurposeItems ?? {};
  const globalItems = source.globalDetails.tripPurposeItems ?? {};
  const values = dimensions.map((dimension) => ({
    ...dimension,
    country: countryItems[dimension.key]?.mean,
    countryN: countryItems[dimension.key]?.n ?? 0,
    global: globalItems[dimension.key]?.mean,
    globalN: globalItems[dimension.key]?.n ?? 0,
  }));

  responsive(host, 430, (width) => {
    const height = 500;
    const centerX = width / 2;
    const centerY = 255;
    const maxRadius = Math.max(64, Math.min(142, (width - 100) / 2));
    const radius = d3.scaleLinear().domain([0, 5]).range([0, maxRadius]);
    const angle = (index) => -Math.PI / 2 + (index * 2 * Math.PI) / dimensions.length;
    const point = (value, index) => [centerX + radius(value) * Math.cos(angle(index)), centerY + radius(value) * Math.sin(angle(index))];
    const polygonPath = (field) => d3.line().curve(d3.curveLinearClosed)(values.map((item, index) => point(Number.isFinite(item[field]) ? item[field] : 0, index)));
    const chart = svg(host, 'trip-purpose-spider', width, height, `Trip-purpose willingness in ${country.name} compared with the global average on five dimensions, scored from one to five`);
    chart.append('text').attr('class', 'panel-title').attr('x', 0).attr('y', 27).attr('font-size', 18).text('Willingness by trip purpose');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', 0).attr('y', 49).attr('font-size', 13).text('Mean agreement for five travel situations. Higher scores indicate greater willingness.');

    const grid = chart.append('g').attr('class', 'spider-grid');
    grid.selectAll('path.spider-ring').data(d3.range(1, 6)).join('path')
      .attr('class', 'spider-ring')
      .attr('d', (level) => d3.line().curve(d3.curveLinearClosed)(dimensions.map((_, index) => point(level, index))))
      .attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-opacity', 0.19);
    grid.selectAll('line.spider-axis').data(dimensions).join('line')
      .attr('class', 'spider-axis')
      .attr('x1', centerX).attr('y1', centerY)
      .attr('x2', (_, index) => point(5, index)[0]).attr('y2', (_, index) => point(5, index)[1])
      .attr('stroke', 'currentColor').attr('stroke-opacity', 0.24);
    grid.selectAll('text.spider-tick').data(d3.range(1, 6)).join('text')
      .attr('class', 'spider-tick')
      .attr('x', centerX + 7).attr('y', (value) => centerY - radius(value) - 3)
      .attr('font-size', 10).attr('fill', 'currentColor').attr('opacity', 0.72)
      .text((value) => value);

    chart.selectAll('text.spider-dimension').data(dimensions).join('text')
      .attr('class', 'spider-dimension')
      .attr('x', (_, index) => centerX + (maxRadius + 32) * Math.cos(angle(index)))
      .attr('y', (_, index) => centerY + (maxRadius + 32) * Math.sin(angle(index)) + (Math.sin(angle(index)) > 0.55 ? 12 : Math.sin(angle(index)) < -0.55 ? -3 : 4))
      .attr('text-anchor', (_, index) => Math.cos(angle(index)) > 0.3 ? 'start' : Math.cos(angle(index)) < -0.3 ? 'end' : 'middle')
      .attr('font-size', 12).attr('fill', 'currentColor')
      .each(function (dimension) { addLines(d3.select(this), dimension.lines, 14); });

    chart.append('path').attr('class', 'spider-global-area').attr('d', polygonPath('global'))
      .attr('fill', '#e5a65d').attr('fill-opacity', 0.12)
      .attr('stroke', '#e5a65d').attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
    chart.append('path').attr('class', 'spider-country-area').attr('d', polygonPath('country'))
      .attr('fill', '#38a995').attr('fill-opacity', 0.20)
      .attr('stroke', '#38a995').attr('stroke-width', 2.5);

    const marks = chart.append('g').attr('class', 'spider-points');
    marks.selectAll('circle.spider-global-point').data(values).join('circle')
      .attr('class', 'spider-global-point')
      .attr('cx', (_, index) => point(_.global ?? 0, index)[0]).attr('cy', (_, index) => point(_.global ?? 0, index)[1])
      .attr('r', 4).attr('fill', '#e5a65d').attr('stroke', '#111820').attr('stroke-width', 1)
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (item) => `Global ${item.label}: ${Number.isFinite(item.global) ? item.global.toFixed(2) + ' out of 5' : 'not available'}, n=${item.globalN}`)
      .on('mouseenter focus', (event, item) => tip(host, event, `<strong>${item.label}</strong><br>Global average: ${Number.isFinite(item.global) ? item.global.toFixed(2) + ' / 5' : 'Not available'}<br>Valid responses: ${item.globalN.toLocaleString()}`))
      .on('mouseleave blur', () => hideTip(host));
    marks.selectAll('circle.spider-country-point').data(values).join('circle')
      .attr('class', 'spider-country-point')
      .attr('cx', (_, index) => point(_.country ?? 0, index)[0]).attr('cy', (_, index) => point(_.country ?? 0, index)[1])
      .attr('r', 5).attr('fill', '#38a995').attr('stroke', '#f4f6f7').attr('stroke-width', 1.2)
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (item) => `${country.name} ${item.label}: ${Number.isFinite(item.country) ? item.country.toFixed(2) + ' out of 5' : 'not available'}, global ${Number.isFinite(item.global) ? item.global.toFixed(2) + ' out of 5' : 'not available'}, difference ${Number.isFinite(item.country) && Number.isFinite(item.global) ? (item.country - item.global >= 0 ? '+' : '') + (item.country - item.global).toFixed(2) : 'not available'}, n=${item.countryN}`)
      .on('mouseenter focus', (event, item) => {
        const gap = Number.isFinite(item.country) && Number.isFinite(item.global) ? item.country - item.global : null;
        tip(host, event, `<strong>${item.label}</strong><br>${country.name}: ${Number.isFinite(item.country) ? item.country.toFixed(2) + ' / 5' : 'Not available'}<br>Global average: ${Number.isFinite(item.global) ? item.global.toFixed(2) + ' / 5' : 'Not available'}<br>Difference: ${gap === null ? 'Not available' : `${gap >= 0 ? '+' : ''}${gap.toFixed(2)} scale points`}<br>Country n=${item.countryN.toLocaleString()} · Global n=${item.globalN.toLocaleString()}`);
      })
      .on('mouseleave blur', () => hideTip(host));

    const legend = chart.append('g').attr('class', 'spider-legend').attr('transform', `translate(${centerX - 128},${height - 23})`);
    legend.append('line').attr('x1', 0).attr('x2', 24).attr('y1', 0).attr('y2', 0).attr('stroke', '#38a995').attr('stroke-width', 2.5);
    legend.append('circle').attr('cx', 12).attr('cy', 0).attr('r', 3.5).attr('fill', '#38a995');
    legend.append('text').attr('x', 31).attr('y', 4).attr('font-size', 12).attr('fill', 'currentColor').text(country.name);
    legend.append('line').attr('x1', 166).attr('x2', 190).attr('y1', 0).attr('y2', 0).attr('stroke', '#e5a65d').attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
    legend.append('circle').attr('cx', 178).attr('cy', 0).attr('r', 3.5).attr('fill', '#e5a65d');
    legend.append('text').attr('x', 197).attr('y', 4).attr('font-size', 12).attr('fill', 'currentColor').text('Global average');
    chart.append('text').attr('class', 'spider-note').attr('x', centerX).attr('y', height - 2).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', 'currentColor').attr('opacity', 0.7).text('Five-point agreement scale · 3 = neutral');
    lockTextSizes(chart);
  });
}

function profile(stage, mapData, state, actions) {
  const source = mapData.metrics, country = findCountry(source, state.selectedCountry), active = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0]; if (!country) return;
  clearProfile(stage);
  const page = d3.select(stage).append('section').attr('class', 'country-profile').attr('aria-label', `${country.name} country profile`);
  const panels = page.append('div').attr('class', 'profile-panels'); renderHeatmap(panels.append('section').attr('class', 'profile-panel profile-panel-heat').node(), source, country, active); renderTripPurposeSpider(panels.append('section').attr('class', 'profile-panel profile-panel-spider').node(), source, country); renderBehavior(panels.append('section').attr('class', 'profile-panel').node(), source, country);
}

export function renderCountryDrilldown(container, mapData, state, actions) {
  const was = container.__selectedCountry;
  container.__selectedCountry = state.selectedCountry;
  const scrollPanel = container.closest('.chart-scroll');
  const showingProfile = Boolean(state.selectedCountry);
  scrollPanel?.classList.toggle('map-chart-scroll', !showingProfile);
  scrollPanel?.classList.toggle('map-profile-scroll', showingProfile);
  container.classList.toggle('showing-country-profile', showingProfile);
  container.style.height = showingProfile ? 'auto' : '100%';
  container.style.flex = showingProfile ? '0 0 auto' : '1 1 auto';

  d3.select(container).selectAll('.map-controls').data([null]).join('div').attr('class', 'map-controls');
  renderMetricControls(container, mapData.metrics, state, actions);
  const controls = container.querySelector('.map-controls');
  let world = container.querySelector('.world-view');
  if (!world) {
    world = document.createElement('div');
    world.className = 'world-view';
    controls.after(world);
  }

  let layout = world.querySelector('.world-layout');
  if (!layout) {
    layout = document.createElement('div');
    layout.className = 'world-layout';
    const mapPane = document.createElement('div');
    mapPane.className = 'world-map-pane';
    const sidePane = document.createElement('aside');
    sidePane.className = 'world-side-pane';
    sidePane.setAttribute('aria-label', 'Map color scale and global summary');
    layout.append(mapPane, sidePane);
    world.append(layout);
  }
  const mapPane = layout.querySelector('.world-map-pane');
  let instruction = mapPane.querySelector('.map-instruction');
  if (!instruction) {
    instruction = document.createElement('p');
    instruction.className = 'map-instruction';
    instruction.textContent = 'Click a country on the map to explore its profile.';
    mapPane.prepend(instruction);
  }
  let worldStage = mapPane.querySelector('.drilldown-stage');
  if (!worldStage) {
    worldStage = document.createElement('div');
    worldStage.className = 'drilldown-stage';
    mapPane.append(worldStage);
  }
  let profileStage = container.querySelector('.profile-view');
  if (!profileStage) {
    profileStage = document.createElement('div');
    profileStage.className = 'profile-view drilldown-stage';
    world.after(profileStage);
  }
  const scrollFrame = () => {
    if (scrollPanel) scrollPanel.scrollTo({ top: 0, behavior: noMotion() ? 'auto' : 'smooth' });
  };
  if (showingProfile) {
    world.hidden = true;
    profileStage.hidden = false;
    profileStage.classList.add('is-changing');
    profile(profileStage, mapData, state, actions);
    requestAnimationFrame(() => {
      profileStage.classList.remove('is-changing');
      scrollFrame();
    });
  } else {
    profileStage.hidden = true;
    world.hidden = false;
    worldStage.classList.add('is-changing');
    clearProfile(worldStage);
    renderChoropleth(worldStage, mapData, state, actions);
    if (was) {
      requestAnimationFrame(() => {
        worldStage.classList.remove('is-changing');
        worldStage.querySelector(`[data-country="${was}"]`)?.focus();
        scrollFrame();
      });
    } else {
      requestAnimationFrame(() => worldStage.classList.remove('is-changing'));
    }
  }
  if (!container.__escHandler) {
    container.__escHandler = (event) => {
      if (event.key === 'Escape' && container.__selectedCountry) actions.setCountry(null);
    };
    document.addEventListener('keydown', container.__escHandler);
  }
}

export function renderGlobalOverview(container, mapData, state, actions) {
  const source = mapData.metrics;
  const metric = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0];
  const countries = Object.values(source.countries).filter((country) => Number.isFinite(country.metrics[metric.key]));
  const highest = d3.greatest(countries, (country) => country.metrics[metric.key]);
  const lowest = d3.least(countries, (country) => country.metrics[metric.key]);
  const summary = d3.select(container).selectAll('.global-summary').data([null]).join('section').attr('class', 'global-summary').attr('aria-label', 'Selected metric summary');
  summary.html(`<div><span class="micro-label">Global average</span><strong>${source.global[metric.key].toFixed(1)}</strong><span>${metric.label}</span></div><div><span class="micro-label">Highest</span><strong>${highest.name}</strong><span>${highest.metrics[metric.key].toFixed(2)} / 5</span></div><div><span class="micro-label">Lowest</span><strong>${lowest.name}</strong><span>${lowest.metrics[metric.key].toFixed(2)} / 5</span></div>`);
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
