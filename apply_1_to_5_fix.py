#!/usr/bin/env python3
"""Apply the verified 1-5 country-map, profile-scroll, and map-hint corrections.

Run from the root of TeamNulls_AutomatedVehicles after extracting this bundle.
"""
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
BUNDLE = Path(__file__).resolve().parent


def read(rel):
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"Missing project file: {rel}. Run this script from the repository root.")
    return path.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Expected exactly one match for {label}, found {count}. No project files have been changed.")
    return text.replace(old, new, 1)


def replace_any(text, alternatives, new, label, required=True):
    for old in alternatives:
        if old in text:
            return text.replace(old, new, 1)
    if required:
        raise ValueError(f"Could not find a known version of {label}. No project files have been changed.")
    return text


def replace_function(text, name, next_name, replacement, export=False):
    prefix = "export function" if export else "function"
    next_prefix = r"(?:export )?(?:async )?function"
    pattern = rf"(?ms)^{prefix} {re.escape(name)}\([^\n]*\) \{{.*?(?=^{next_prefix} {re.escape(next_name)}\()"
    updated, count = re.subn(pattern, replacement.rstrip() + "\n\n", text, count=1)
    if count != 1:
        raise ValueError(f"Could not safely locate {name}() before {next_name}(). No project files have been changed.")
    return updated

changes = {}

# 1. Make the choropleth's scale truly fixed to the questionnaire's 1-5 values.
p = "src/charts/choropleth.js"
s = read(p)
old_scale = """  const values = countries.map((country) => country.metrics[metric.key]).filter(Number.isFinite);
  const [min, max] = d3.extent(values);
  const globalAverage = source.global[metric.key];
  const range = max - min;
  const midpoint = range > 0
    ? Math.max(min + range * 0.001, Math.min(max - range * 0.001, globalAverage))
    : min;
  // Diverging palette: below the global average is coral, average is warm sand,
  // and above average is teal. This separates low/high values more clearly.
  const color = range > 0
    ? d3.scaleLinear().domain([min, midpoint, max]).range(['#d95f59', '#f0d58a', '#38a69b']).clamp(true)
    : () => '#f0d58a';"""
new_scale = """  // Every map metric is an average on the original five-point agreement scale.
  // Keep the domain fixed so country colors are comparable across selections.
  const min = 1;
  const max = 5;
  const color = d3.scaleLinear()
    .domain([1, 3, 5])
    .range(['#d95f59', '#f0d58a', '#38a69b'])
    .clamp(true);"""
if old_scale in s:
    s = s.replace(old_scale, new_scale, 1)
elif new_scale not in s:
    # The previous updater used min=1/max=5 but still centered the palette on the mean.
    legacy_scale = re.compile(r"(?ms)^  const min = 1, max = 5;\n  const globalAverage = source\.global\[metric\.key\];.*?^    : \(\) => '#f0d58a';")
    s, count = legacy_scale.subn(new_scale, s, count=1)
    if count != 1:
        raise ValueError("Could not find a known choropleth scale block. No project files have been changed.")
s = s.replace("${fmt(c.metrics[metric.key])} of 100.", "${fmt(c.metrics[metric.key])} out of 5.")
s = s.replace("d3.scaleLinear().domain([0, max]).range([margin.left, rWidth - margin.right])", "d3.scaleLinear().domain([1, 5]).range([margin.left, rWidth - margin.right])")
s = s.replace("${fmt(d.metrics[metric.key])} / 100.", "${fmt(d.metrics[metric.key])} / 5.")
changes[p] = s

# 2. Replace the summary/legend so it shows 1, 3 and 5 rather than dataset min/max.
p = "src/main.js"
s = read(p)
s = replace_any(s, ["Choose one of seven measures."], "Choose one of five measures.", "map measure count", required=False)
s = replace_any(s, ["Trust and safety are different"], "Safety is one part of trust", "safety chapter title", required=False)
s = replace_any(s, [
    "Safety concern uses the reverse of the map’s safety-confidence measure.",
    "The direct safety item is also part of the trust composite, so compare it as a focused view within trust rather than as an independent construct.",
], "The direct perceived-safety item is also included in the trust composite, so read it as one facet of trust rather than a separate construct.", "safety chapter interpretation", required=False)
s = replace_any(s, ["Mean trust vs. safety concern", "Mean trust vs. perceived safety item"], "Mean trust vs. perceived safety", "safety chart title", required=False)
s = replace_any(s, [
    "<strong>Treat safety as its own workstream.</strong> Compare safety concern alongside trust instead of treating them as the same measure.",
    "<strong>Read safety as one facet of trust.</strong> The direct safety item is included in the trust composite, so do not interpret it as an independent construct.",
], "<strong>Read safety as one facet of trust.</strong> The direct perceived-safety item is included in the trust composite, so do not interpret it as an independent construct.", "safety takeaway", required=False)
new_summary = r'''function renderMapSummary(container, mapData, state) {
  const source = mapData.metrics;
  const metric = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0];
  const countries = Object.values(source.countries).filter((country) => Number.isFinite(country.metrics[metric.key]));
  const highest = d3.greatest(countries, (country) => country.metrics[metric.key]);
  const lowest = d3.least(countries, (country) => country.metrics[metric.key]);
  const sidePane = container.querySelector('.world-side-pane');
  if (!sidePane) return;

  let legend = sidePane.querySelector('.map-color-legend');
  if (!legend) {
    legend = document.createElement('section');
    legend.className = 'map-color-legend';
    legend.setAttribute('aria-label', 'Map color scale, from one to five');
    sidePane.append(legend);
  }
  const average = source.global[metric.key];
  const averagePosition = Math.max(0, Math.min(100, ((average - 1) / 4) * 100));
  legend.innerHTML = `<h4>Agreement scale · 1–5</h4>
    <div class="map-color-bar" role="img" aria-label="1 is strongly disagree, 3 is neutral, and 5 is strongly agree. The white marker shows the global mean."><span class="map-color-average-marker"></span></div>
    <div class="map-color-labels"><span>1</span><span>3</span><span>5</span></div>
    <p>1 = Strongly disagree · 3 = Neutral · 5 = Strongly agree. Global mean: ${average.toFixed(2)} / 5</p>`;
  legend.querySelector('.map-color-bar').style.background = 'linear-gradient(90deg, #d95f59 0%, #f0d58a 50%, #38a69b 100%)';
  legend.querySelector('.map-color-average-marker').style.left = `${averagePosition}%`;

  let summary = sidePane.querySelector('.global-summary');
  if (!summary) {
    summary = document.createElement('section');
    summary.className = 'global-summary';
    summary.setAttribute('aria-label', 'Selected metric summary');
    sidePane.append(summary);
  }
  summary.innerHTML = `<div><span class="micro-label">Global average</span><strong>${average.toFixed(2)} / 5</strong><span>${metric.label}</span></div><div><span class="micro-label">Highest</span><strong>${highest.name}</strong><span>${highest.metrics[metric.key].toFixed(2)} / 5</span></div><div><span class="micro-label">Lowest</span><strong>${lowest.name}</strong><span>${lowest.metrics[metric.key].toFixed(2)} / 5</span></div>`;
}'''
s = replace_function(s, "renderMapSummary", "initialize", new_summary)
changes[p] = s

# 3. Use the cleaned-label country aggregation for all country-to-country story charts.
p = "src/charts/storyboardCharts.js"
s = read(p)
s = s.replace("import { COUNTRY_MAP } from '../data/countryMap.js';\n", "")
new_country_rows = r'''function countryRows(_data, metrics) {
  return Object.values(metrics.countries).map((country) => ({
    name: country.name,
    iso3: country.iso3,
    region: country.region,
    n: country.n,
    use: country.metrics.useIntention,
    trust: country.metrics.trust,
    safetyConcern: Number.isFinite(country.metrics.safetyConfidence)
      ? 6 - country.metrics.safetyConfidence
      : null,
  })).filter((row) => Number.isFinite(row.use) && Number.isFinite(row.trust) && Number.isFinite(row.safetyConcern));
}'''
s = replace_function(s, "countryRows", "regression", new_country_rows)
changes[p] = s

# 4. Update country drill-down charts, profile scrolling, and the click instruction.
p = "src/charts/countryDrilldown.js"
s = read(p)
old_labels = "const activityLabels = { takingCareOfChildren: 'Care for children', talkingWithFellowTravelers: 'Talk with passengers', internetOrVideo: 'Internet or video', playingGames: 'Play games', socializing: 'Socialize', eatingOrDrinking: 'Eat or drink', observingLandscape: 'Observe landscape', relaxingOrResting: 'Relax or rest', readingBook: 'Read a book', working: 'Work', other: 'Other activity' };\nconst metricLines = { trust: ['Trust'], adoption: ['Adoption', 'intention'], safetyConfidence: ['Safety', 'confidence'], expectedBenefits: ['Expected', 'benefits'], awareness: ['Prior', 'awareness'], secondaryActivities: ['Secondary', 'activities'], capabilityKnowledge: ['L3 capability', 'knowledge'] };"
new_labels = "const activityLabels = { commute: 'Commute', businessTravel: 'Business travel', errands: 'Errands', leisure: 'Leisure', vacation: 'Vacation' };\nconst metricLines = { trust: ['Trust'], useIntention: ['Intention', 'to use'], adoption: ['Overall', 'adoption'], tripPurpose: ['Trip-purpose', 'intention'], safetyConfidence: ['Perceived', 'safety'] };"
legacy_labels = "const activityLabels = { commute: 'Commute', businessTravel: 'Business travel', errands: 'Errands', leisure: 'Leisure', vacation: 'Vacation' };\nconst metricLines = { trust: ['Trust'], adoption: ['Adoption', 'intention'], safetyConfidence: ['Safety', 'confidence'], expectedBenefits: ['Expected', 'benefits'], awareness: ['Prior', 'awareness'], secondaryActivities: ['Secondary', 'activities'], capabilityKnowledge: ['L3 capability', 'knowledge'] };"
s = replace_any(s, [old_labels, legacy_labels], new_labels, "five-point profile metric labels", required=False)
new_heatmap = r'''function renderHeatmap(host, source, country, active) {
  responsive(host, 430, (width) => {
    const groups = country.subgroups?.age ?? [];
    const margin = { top: 124, right: 24, bottom: 150, left: 106 };
    const height = margin.top + groups.length * 48 + margin.bottom;
    const chart = svg(host, 'profile-heatmap', width, height, `Mean five-point scores by age group in ${country.name}`);
    const x = d3.scaleBand().domain(source.metrics.map((metric) => metric.key)).range([margin.left, width - margin.right]).padding(.055);
    const y = d3.scaleBand().domain(groups.map((group) => group.label)).range([margin.top, height - margin.bottom]).padding(.08);
    const cells = groups.flatMap((group) => source.metrics.map((metric) => {
      const value = group.metrics[metric.key];
      const global = source.global[metric.key];
      return { group, metric, value, n: group.metricN[metric.key], diff: Number.isFinite(value) && Number.isFinite(global) ? value - global : null };
    }));
    const maxGap = Math.max(.25, d3.max(cells.filter((cell) => cell.n >= MIN_N && Number.isFinite(cell.diff)), (cell) => Math.abs(cell.diff)) || .25);
    const color = d3.scaleLinear().domain([-maxGap, 0, maxGap]).range(['#d95f59', '#68747c', '#38a69b']).interpolate(d3.interpolateRgb);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Mean scores by age');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Cell values are on the original 1–5 scale; color shows the difference from the global mean.');
    const activeX = x(active.key);
    chart.append('rect').attr('class', 'active-column-outline').attr('x', activeX - 3).attr('y', margin.top - 52).attr('width', x.bandwidth() + 6).attr('height', height - margin.top + 52 - margin.bottom).attr('rx', 6);
    chart.selectAll('.heatmap-column').data(source.metrics).join('text').attr('class', 'heatmap-column').attr('x', (metric) => x(metric.key) + x.bandwidth() / 2).attr('y', margin.top - 38).attr('text-anchor', 'middle').attr('font-size', 12).each(function (metric) { addLines(d3.select(this), metricLines[metric.key]); });
    chart.selectAll('.heatmap-row').data(groups).join('text').attr('class', 'heatmap-row').attr('x', margin.left - 12).attr('y', (group) => y(group.label) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').attr('font-size', 12).text((group) => group.label);
    const defs = chart.append('defs');
    const hatch = defs.append('pattern').attr('id', `low-n-${country.iso3}`).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#536069');
    hatch.append('line').attr('x1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#9aa5ab').attr('stroke-width', 2);
    chart.selectAll('.heatmap-cell').data(cells).join('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', (cell) => x(cell.metric.key)).attr('y', (cell) => y(cell.group.label))
      .attr('width', x.bandwidth()).attr('height', y.bandwidth())
      .attr('fill', (cell) => cell.n < MIN_N || !Number.isFinite(cell.diff) ? `url(#low-n-${country.iso3})` : color(cell.diff))
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (cell) => `${cell.group.label}, ${cell.metric.label}: ${Number.isFinite(cell.value) ? `${cell.value.toFixed(2)} out of 5` : 'not available'}, difference from global ${Number.isFinite(cell.diff) ? `${cell.diff >= 0 ? '+' : ''}${cell.diff.toFixed(2)} scale points` : 'not available'}, n=${cell.n}`)
      .on('mouseenter focus', (event, cell) => tip(host, event, `<strong>${cell.group.label} · ${cell.metric.label}</strong><br>${Number.isFinite(cell.value) ? `${cell.value.toFixed(2)} / 5` : 'Not available'}<br>${Number.isFinite(cell.diff) ? `${cell.diff >= 0 ? '+' : ''}${cell.diff.toFixed(2)} scale points vs global` : 'No global comparison'}<br>n=${cell.n}${cell.n < MIN_N ? ' (low sample)' : ''}`))
      .on('mouseleave blur', () => hideTip(host));
    chart.selectAll('.heatmap-value').data(cells).join('text')
      .attr('class', 'heatmap-value')
      .attr('x', (cell) => x(cell.metric.key) + x.bandwidth() / 2)
      .attr('y', (cell) => y(cell.group.label) + y.bandwidth() / 2 + 5)
      .attr('text-anchor', 'middle').attr('font-size', 12)
      .attr('fill', (cell) => cell.n < MIN_N || !Number.isFinite(cell.diff) ? '#eff4f5' : contrast(color(cell.diff)))
      .text((cell) => cell.n < MIN_N || !Number.isFinite(cell.value) ? 'N/A' : cell.value.toFixed(1));
    const legend = chart.append('g').attr('class', 'heatmap-legend').attr('transform', `translate(${margin.left},${height - 126})`);
    const grad = defs.append('linearGradient').attr('id', `heat-gradient-${country.iso3}`);
    grad.selectAll('stop').data(d3.range(0, 1.01, .1)).join('stop').attr('offset', (value) => `${value * 100}%`).attr('stop-color', (value) => color(-maxGap + value * maxGap * 2));
    const availableLegendWidth = Math.max(240, width - margin.left - 24);
    const legendWidth = Math.min(360, availableLegendWidth);
    legend.append('rect').attr('width', legendWidth).attr('height', 10).attr('rx', 5).attr('fill', `url(#heat-gradient-${country.iso3})`);
    legend.selectAll('text.clean-tick').data([{ x: 0, label: `−${maxGap.toFixed(1)}` }, { x: legendWidth / 2, label: '0' }, { x: legendWidth, label: `+${maxGap.toFixed(1)}` }]).join('text')
      .attr('class', 'clean-tick').attr('x', (d) => d.x).attr('y', 27)
      .attr('text-anchor', (d) => d.x === 0 ? 'start' : d.x === legendWidth ? 'end' : 'middle')
      .attr('font-size', 12).text((d) => d.label);
    legend.append('text').attr('x', 0).attr('y', 46).attr('font-size', 12).text('Below global mean');
    legend.append('text').attr('x', legendWidth).attr('y', 46).attr('font-size', 12).attr('text-anchor', 'end').text('Above global mean');
    legend.append('rect').attr('x', 0).attr('y', 64).attr('width', 12).attr('height', 10).attr('fill', `url(#low-n-${country.iso3})`);
    legend.append('text').attr('x', 19).attr('y', 74).attr('font-size', 12).text('n < 15');
    lockTextSizes(chart);
  });
}'''
s = replace_function(s, "renderHeatmap", "renderBehavior", new_heatmap)
new_behavior = r'''function renderBehavior(host, source, country) {
  responsive(host, 430, (width) => {
    const rows = Object.entries(country.behaviors ?? {})
      .filter(([key, value]) => Number.isFinite(value) && Number.isFinite(source.globalDetails.behaviors[key]))
      .map(([key, value]) => ({ key, label: activityLabels[key] ?? key, value, global: source.globalDetails.behaviors[key], gap: value - source.globalDetails.behaviors[key] }))
      .sort((a, b) => d3.ascending(a.gap, b.gap));
    const margin = { top: 94, right: 68, bottom: 58, left: Math.min(196, Math.max(112, width * .29)) };
    const height = margin.top + rows.length * 42 + margin.bottom;
    const extent = Math.max(.25, d3.max(rows, (row) => Math.abs(row.gap)) || .25);
    const chart = svg(host, 'behavior-chart', width, height, `Trip-purpose scores in ${country.name}, compared with the global mean`);
    const x = d3.scaleLinear().domain([-extent, extent]).nice().range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(rows.map((row) => row.key)).range([margin.top, height - margin.bottom]).padding(.24);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Trip-purpose profile');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Mean agreement for five different reasons to use an automated car.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`)).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'zero-line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', margin.top - 6).attr('y2', height - margin.bottom);
    chart.selectAll('.behavior-label').data(rows).join('text').attr('class', 'behavior-label').attr('x', margin.left - 12).attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').attr('font-size', 13).text((row) => row.label);
    chart.selectAll('.behavior-bar').data(rows).join('rect')
      .attr('class', (row) => `behavior-bar ${row.gap >= 0 ? 'above' : 'below'}`)
      .attr('x', (row) => x(Math.min(0, row.gap))).attr('y', (row) => y(row.key))
      .attr('height', y.bandwidth()).attr('width', 0).attr('rx', 3)
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (row) => `${row.label}: ${row.value.toFixed(2)} / 5, ${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(2)} scale points from global mean`)
      .on('mouseenter focus', (event, row) => tip(host, event, `<strong>${row.label}</strong><br>${country.name}: ${row.value.toFixed(2)} / 5<br>Global: ${row.global.toFixed(2)} / 5 (${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(2)} scale points)`))
      .on('mouseleave blur', () => hideTip(host))
      .transition().duration(noMotion() ? 0 : 260).ease(d3.easeCubicOut)
      .attr('width', (row) => Math.abs(x(row.gap) - x(0)));
    chart.selectAll('.behavior-value').data(rows).join('text').attr('class', 'behavior-value')
      .attr('x', (row) => row.gap >= 0 ? x(row.gap) + 7 : x(row.gap) - 7)
      .attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5)
      .attr('text-anchor', (row) => row.gap >= 0 ? 'start' : 'end').attr('font-size', 12)
      .text((row) => `${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(2)}`);
    chart.append('text').attr('class', 'axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 10).attr('text-anchor', 'middle').attr('font-size', 13).text('Difference from global mean (scale points)');
    lockTextSizes(chart);
  });
}'''
s = replace_function(s, "renderBehavior", "renderScatter", new_behavior)
new_scatter = r'''function renderScatter(host, source, country) {
  responsive(host, 430, (width) => {
    const points = Object.values(source.countries).filter((item) => Number.isFinite(item.metrics.useIntention) && Number.isFinite(item.metrics.tripPurpose));
    const margin = { top: 82, right: 38, bottom: 64, left: 64 }, height = 440;
    const x = d3.scaleLinear().domain([1, 5]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([1, 5]).range([height - margin.bottom, margin.top]);
    const chart = svg(host, 'paradox-chart', width, height, `Intention to use versus trip-purpose intention, with ${country.name} highlighted`);
    const meanX = d3.mean(points, (item) => item.metrics.tripPurpose);
    const meanY = d3.mean(points, (item) => item.metrics.useIntention);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Intention across trip purposes');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Compare the direct future-use item with the trip-purpose average.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues([1, 2, 3, 4, 5])).selectAll('text').attr('font-size', 12);
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickValues([1, 2, 3, 4, 5])).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'quadrant-line').attr('x1', x(meanX)).attr('x2', x(meanX)).attr('y1', margin.top).attr('y2', height - margin.bottom);
    chart.append('line').attr('class', 'quadrant-line').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', y(meanY)).attr('y2', y(meanY));
    const anchors = new Set([
      country.iso3,
      d3.min(points, (item) => item.metrics.tripPurpose).iso3,
      d3.max(points, (item) => item.metrics.tripPurpose).iso3,
      d3.min(points, (item) => item.metrics.useIntention).iso3,
      d3.max(points, (item) => item.metrics.useIntention).iso3,
    ]);
    chart.selectAll('.country-dot').data(points).join('circle')
      .attr('class', (item) => `country-dot${item.iso3 === country.iso3 ? ' selected' : ''}`)
      .attr('cx', (item) => x(item.metrics.tripPurpose)).attr('cy', (item) => y(item.metrics.useIntention))
      .attr('r', (item) => item.iso3 === country.iso3 ? 10 : 6.5)
      .attr('tabindex', 0).attr('role', 'graphics-symbol')
      .attr('aria-label', (item) => `${item.name}: trip-purpose intention ${item.metrics.tripPurpose.toFixed(2)} / 5, direct intention to use ${item.metrics.useIntention.toFixed(2)} / 5`)
      .on('mouseenter focus', (event, item) => tip(host, event, `<strong>${item.name}</strong><br>Trip-purpose intention: ${item.metrics.tripPurpose.toFixed(2)} / 5<br>Intention to use: ${item.metrics.useIntention.toFixed(2)} / 5`))
      .on('mouseleave blur', () => hideTip(host));
    chart.selectAll('.anchor-label').data(points.filter((item) => anchors.has(item.iso3))).join('text')
      .attr('class', (item) => `anchor-label${item.iso3 === country.iso3 ? ' selected' : ''}`)
      .attr('x', (item) => x(item.metrics.tripPurpose) > width - margin.right - 110 ? x(item.metrics.tripPurpose) - 10 : x(item.metrics.tripPurpose) + 10)
      .attr('y', (item) => y(item.metrics.useIntention) - 10)
      .attr('text-anchor', (item) => x(item.metrics.tripPurpose) > width - margin.right - 110 ? 'end' : 'start')
      .attr('font-size', 12).text((item) => item.name);
    chart.append('text').attr('class', 'axis-title').attr('x', width / 2).attr('y', height - 12).attr('text-anchor', 'middle').attr('font-size', 13).text('Mean trip-purpose intention (1–5)');
    chart.append('text').attr('class', 'axis-title').attr('transform', `translate(18,${height / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 13).text('Mean intention to use (1–5)');
    lockTextSizes(chart);
  });
}'''
s = replace_function(s, "renderScatter", "profile", new_scatter)
new_drilldown = r'''export function renderCountryDrilldown(container, mapData, state, actions) {
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
    profile(profileStage, mapData, state, actions, { showBack: true });
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
}'''
s = replace_function(s, "renderCountryDrilldown", "renderGlobalOverview", new_drilldown, export=True)
# Any other exported summary helper must also report the new scale.
s = s.replace("${highest.metrics[metric.key].toFixed(1)} / 100", "${highest.metrics[metric.key].toFixed(2)} / 5")
s = s.replace("${lowest.metrics[metric.key].toFixed(1)} / 100", "${lowest.metrics[metric.key].toFixed(2)} / 5")
# No old 0-100 references should remain in this profile module.
if "/ 100" in s or "of 100" in s:
    raise ValueError("Old 0-100 labels remain in countryDrilldown.js. No project files have been changed.")
changes[p] = s

# 5. Make intention-to-use the default metric (India is highest in the attached dataset).
p = "src/state.js"
s = read(p)
s = replace_any(s, ["selectedMetric: 'trust'"], "selectedMetric: 'useIntention'", "default map metric", required=False)
changes[p] = s

# 6. Add overflow behavior only while a country profile is open, and style the map hint.
p = "src/styles/charts.css"
s = read(p)
css_addition = r'''

/* Five-point map scale, readable click guidance, and scrollable country profiles. */
#country-trust-chart .world-map-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
#country-trust-chart .map-instruction {
  flex: 0 0 auto;
  margin: 0 0 5px;
  color: var(--text-muted);
  font: 11px/1.35 var(--ui);
}
#country-trust-chart .world-map-pane > .drilldown-stage {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
}
#country-trust-chart .map-color-labels {
  display: flex;
  justify-content: space-between;
  gap: 3px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.chart-scroll.map-profile-scroll {
  overflow-x: hidden !important;
  overflow-y: auto !important;
  scrollbar-width: thin;
  overscroll-behavior: contain;
  align-items: stretch;
}
#country-trust-chart.showing-country-profile {
  height: auto !important;
  min-height: 100%;
  flex: 0 0 auto !important;
  overflow: visible !important;
}
#country-trust-chart.showing-country-profile .profile-view,
#country-trust-chart.showing-country-profile .country-profile,
#country-trust-chart.showing-country-profile .profile-body,
#country-trust-chart.showing-country-profile .profile-panels {
  min-height: max-content;
  overflow: visible;
}
#country-trust-chart.showing-country-profile .profile-panel {
  overflow-x: auto;
  overflow-y: visible;
}
'''
if "Five-point map scale, readable click guidance" not in s:
    s += css_addition
changes[p] = s

# Validate the full patch before writing anything.
required = [
    "src/charts/choropleth.js", "src/main.js", "src/charts/storyboardCharts.js",
    "src/charts/countryDrilldown.js", "src/state.js", "src/styles/charts.css",
]
for rel in required:
    if rel not in changes or not changes[rel]:
        raise ValueError(f"Patch did not generate {rel}; no project files have been changed.")
metrics_file = BUNDLE / "public/data/country_metrics.json"
clean_file = BUNDLE / "public/data/l3pilot_clean.json"
if not metrics_file.is_file() or not clean_file.is_file():
    raise FileNotFoundError("The ZIP must include the generated map metrics and the attached cleaned respondent JSON.")

# Commit-like behavior: only write files after every source match and asset check succeeded.
(ROOT / "public/data").mkdir(parents=True, exist_ok=True)
shutil.copy2(metrics_file, ROOT / "public/data/country_metrics.json")
shutil.copy2(clean_file, ROOT / "public/data/l3pilot_clean.json")
for rel, content in changes.items():
    (ROOT / rel).write_text(content, encoding="utf-8")

print("Applied the country-map corrections.")
print("- Country means are grouped by the attached country_label field.")
print("- The map is fixed to a 1–5 agreement scale; default metric is Intention to use.")
print("- Map summary, rankings, tooltips, and profile charts use 1–5 units.")
print("- Country profiles can scroll vertically; map scroll remains locked only on the world-map view.")
print("- Added the instruction: 'Click a country on the map to explore its profile.'")
print("Next: npm run build")
