#!/usr/bin/env python3
"""Apply the 1-5 L3Pilot map update to the TeamNulls project root.

Run from the repository root after extracting this bundle:
    python3 apply_1_to_5_update.py
"""
from pathlib import Path
import re
import sys

ROOT = Path.cwd()


def read(rel):
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"Missing project file: {rel}. Run this script from the repository root.")
    return path.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Expected exactly one match for {label}, found {count}. No files have been changed.")
    return text.replace(old, new, 1)


def replace_function(text, name, replacement, next_name):
    pattern = rf"function {re.escape(name)}\([^\n]*\) \{{.*?\n\}}\n\n(?=function {re.escape(next_name)}\()"
    updated, count = re.subn(pattern, replacement.rstrip() + "\n\n", text, count=1, flags=re.S)
    if count != 1:
        raise ValueError(f"Could not locate {name}() before {next_name}(). No files have been changed.")
    return updated

changes = {}

# Choropleth: use the full five-point scale for colors, ranking, and accessible labels.
p = "src/charts/choropleth.js"
s = read(p)
s = replace_once(s, "  const values = countries.map((country) => country.metrics[metric.key]).filter(Number.isFinite);\n  const [min, max] = d3.extent(values);", "  const min = 1, max = 5;", "choropleth scale domain")
s = replace_once(s, "${fmt(c.metrics[metric.key])} of 100.", "${fmt(c.metrics[metric.key])} out of 5.", "map country accessible score")
s = replace_once(s, "d3.scaleLinear().domain([0, max]).range([margin.left, rWidth - margin.right])", "d3.scaleLinear().domain([1, 5]).range([margin.left, rWidth - margin.right])", "country ranking scale")
s = replace_once(s, "${fmt(d.metrics[metric.key])} / 100.", "${fmt(d.metrics[metric.key])} / 5.", "ranking accessible score")
changes[p] = s

# Map summary: fixed 1-5 endpoints and 1-5 labels in the side pane.
p = "src/main.js"
s = read(p)
s = replace_once(s, "  const values = countries.map((country) => country.metrics[metric.key]);\n  const min = d3.min(values), max = d3.max(values), average = source.global[metric.key];", "  const min = 1, max = 5, average = source.global[metric.key];", "map legend scale domain")
s = replace_once(s, "${highest.metrics[metric.key].toFixed(1)} / 100", "${highest.metrics[metric.key].toFixed(1)} / 5", "highest map value")
s = replace_once(s, "${lowest.metrics[metric.key].toFixed(1)} / 100", "${lowest.metrics[metric.key].toFixed(1)} / 5", "lowest map value")
s = replace_once(s, "Choose one of seven measures.", "Choose one of four measures.", "map instructions")
s = replace_once(s, "Trust and safety are different", "Safety is one part of trust", "safety chapter title")
s = replace_once(s, "Safety concern uses the reverse of the map’s safety-confidence measure.", "The direct safety item is also part of the trust composite, so compare it as a focused view within trust rather than as an independent construct.", "safety chapter interpretation")
s = replace_once(s, "Mean trust vs. safety concern", "Mean trust vs. perceived safety item", "safety chart title")
s = replace_once(s, "<strong>Treat safety as its own workstream.</strong> Compare safety concern alongside trust instead of treating them as the same measure.", "<strong>Read safety as one facet of trust.</strong> The direct safety item is included in the trust composite, so do not interpret it as an independent construct.", "safety takeaway")
changes[p] = s

# Country profiles: reflect the four measures and the five trip-purpose scores in the upload.
p = "src/charts/countryDrilldown.js"
s = read(p)
old_labels = "const activityLabels = { takingCareOfChildren: 'Care for children', talkingWithFellowTravelers: 'Talk with passengers', internetOrVideo: 'Internet or video', playingGames: 'Play games', socializing: 'Socialize', eatingOrDrinking: 'Eat or drink', observingLandscape: 'Observe landscape', relaxingOrResting: 'Relax or rest', readingBook: 'Read a book', working: 'Work', other: 'Other activity' };\nconst metricLines = { trust: ['Trust'], adoption: ['Adoption', 'intention'], safetyConfidence: ['Safety', 'confidence'], expectedBenefits: ['Expected', 'benefits'], awareness: ['Prior', 'awareness'], secondaryActivities: ['Secondary', 'activities'], capabilityKnowledge: ['L3 capability', 'knowledge'] };"
new_labels = "const activityLabels = { commute: 'Commute', businessTravel: 'Business travel', errands: 'Errands', leisure: 'Leisure', vacation: 'Vacation' };\nconst metricLines = { trust: ['Trust'], adoption: ['Adoption', 'intention'], tripPurpose: ['Trip-purpose', 'intention'], safetyConfidence: ['Perceived', 'safety'] };"
s = replace_once(s, old_labels, new_labels, "country profile labels")
s = replace_once(s, " / 100 · ", " / 5 · ", "country heatmap scale")
if " points from global" not in s:
    raise ValueError("Could not locate country heatmap difference labels. No files have been changed.")
s = s.replace(" points from global", " scale points from global")

new_behavior = r'''function renderBehavior(host, source, country) {
  responsive(host, 430, (width) => {
    const rows = Object.entries(country.behaviors ?? {})
      .filter(([key, value]) => Number.isFinite(value) && Number.isFinite(source.globalDetails.behaviors[key]))
      .map(([key, value]) => ({ key, label: activityLabels[key] ?? key, value, global: source.globalDetails.behaviors[key], gap: value - source.globalDetails.behaviors[key] }))
      .sort((a, b) => d3.ascending(a.gap, b.gap));
    const margin = { top: 94, right: 68, bottom: 58, left: Math.min(196, Math.max(112, width * .29)) };
    const height = margin.top + rows.length * 42 + margin.bottom;
    const extent = Math.max(.5, d3.max(rows, (row) => Math.abs(row.gap)) || .5);
    const chart = svg(host, 'behavior-chart', width, height, `Trip-purpose scores in ${country.name}, compared with the global mean`);
    const x = d3.scaleLinear().domain([-extent, extent]).nice().range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(rows.map((row) => row.key)).range([margin.top, height - margin.bottom]).padding(.24);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Trip-purpose profile');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Mean agreement for five different reasons to use an automated car.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value > 0 ? '+' : ''}${value}`)).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'zero-line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', margin.top - 6).attr('y2', height - margin.bottom);
    chart.selectAll('.behavior-label').data(rows).join('text').attr('class', 'behavior-label').attr('x', margin.left - 12).attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').attr('font-size', 13).text((row) => row.label);
    chart.selectAll('.behavior-bar').data(rows).join('rect').attr('class', (row) => `behavior-bar ${row.gap >= 0 ? 'above' : 'below'}`).attr('x', (row) => x(Math.min(0, row.gap))).attr('y', (row) => y(row.key)).attr('height', y.bandwidth()).attr('width', 0).attr('rx', 3).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (row) => `${row.label}: ${row.value.toFixed(2)} / 5, ${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(2)} scale points from global mean`).on('mouseenter focus', (event, row) => tip(host, event, `<strong>${row.label}</strong><br>${country.name}: ${row.value.toFixed(2)} / 5<br>Global: ${row.global.toFixed(2)} / 5 (${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(2)} points)`)).on('mouseleave blur', () => hideTip(host)).transition().duration(noMotion() ? 0 : 260).ease(d3.easeCubicOut).attr('width', (row) => Math.abs(x(row.gap) - x(0)));
    chart.selectAll('.behavior-value').data(rows).join('text').attr('class', 'behavior-value').attr('x', (row) => row.gap >= 0 ? x(row.gap) + 7 : x(row.gap) - 7).attr('y', (row) => y(row.key) + y.bandwidth() / 2 + 5).attr('text-anchor', (row) => row.gap >= 0 ? 'start' : 'end').attr('font-size', 12).text((row) => `${row.gap >= 0 ? '+' : ''}${row.gap.toFixed(2)}`);
    chart.append('text').attr('class', 'axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 10).attr('text-anchor', 'middle').attr('font-size', 13).text('Difference from global mean (1-5 scale points)');
    lockTextSizes(chart);
  });
}'''
s = replace_function(s, "renderBehavior", new_behavior, "renderScatter")

new_scatter = r'''function renderScatter(host, source, country) {
  responsive(host, 430, (width) => {
    const points = Object.values(source.countries).filter((item) => Number.isFinite(item.metrics.adoption) && Number.isFinite(item.metrics.tripPurpose));
    const margin = { top: 82, right: 38, bottom: 64, left: 64 }, height = 440;
    const x = d3.scaleLinear().domain([1, 5]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([1, 5]).range([height - margin.bottom, margin.top]);
    const chart = svg(host, 'paradox-chart', width, height, `Trip-purpose intention versus adoption intention, with ${country.name} highlighted`);
    const meanX = d3.mean(points, (item) => item.metrics.tripPurpose), meanY = d3.mean(points, (item) => item.metrics.adoption);
    chart.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', 25).attr('font-size', 18).text('Adoption across trip purposes');
    chart.append('text').attr('class', 'panel-subtitle').attr('x', margin.left).attr('y', 47).attr('font-size', 13).text('Compare broad adoption intention with willingness across trip purposes.');
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues([1, 2, 3, 4, 5])).selectAll('text').attr('font-size', 12);
    chart.append('g').attr('class', 'profile-axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickValues([1, 2, 3, 4, 5])).selectAll('text').attr('font-size', 12);
    chart.append('line').attr('class', 'quadrant-line').attr('x1', x(meanX)).attr('x2', x(meanX)).attr('y1', margin.top).attr('y2', height - margin.bottom);
    chart.append('line').attr('class', 'quadrant-line').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', y(meanY)).attr('y2', y(meanY));
    const anchors = new Set([country.iso3, d3.min(points, (item) => item.metrics.tripPurpose).iso3, d3.max(points, (item) => item.metrics.tripPurpose).iso3, d3.min(points, (item) => item.metrics.adoption).iso3, d3.max(points, (item) => item.metrics.adoption).iso3]);
    chart.selectAll('.country-dot').data(points).join('circle').attr('class', (item) => `country-dot${item.iso3 === country.iso3 ? ' selected' : ''}`).attr('cx', (item) => x(item.metrics.tripPurpose)).attr('cy', (item) => y(item.metrics.adoption)).attr('r', (item) => item.iso3 === country.iso3 ? 10 : 6.5).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (item) => `${item.name}: trip-purpose intention ${item.metrics.tripPurpose.toFixed(2)} / 5, adoption intention ${item.metrics.adoption.toFixed(2)} / 5`).on('mouseenter focus', (event, item) => tip(host, event, `<strong>${item.name}</strong><br>Trip-purpose intention: ${item.metrics.tripPurpose.toFixed(2)} / 5<br>Adoption intention: ${item.metrics.adoption.toFixed(2)} / 5`)).on('mouseleave blur', () => hideTip(host));
    chart.selectAll('.anchor-label').data(points.filter((item) => anchors.has(item.iso3))).join('text').attr('class', (item) => `anchor-label${item.iso3 === country.iso3 ? ' selected' : ''}`).attr('x', (item) => x(item.metrics.tripPurpose) > width - margin.right - 110 ? x(item.metrics.tripPurpose) - 10 : x(item.metrics.tripPurpose) + 10).attr('y', (item) => y(item.metrics.adoption) - 10).attr('text-anchor', (item) => x(item.metrics.tripPurpose) > width - margin.right - 110 ? 'end' : 'start').attr('font-size', 12).text((item) => item.name);
    chart.append('text').attr('class', 'axis-title').attr('x', width / 2).attr('y', height - 12).attr('text-anchor', 'middle').attr('font-size', 13).text('Mean trip-purpose intention (1-5)');
    chart.append('text').attr('class', 'axis-title').attr('transform', `translate(18,${height / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 13).text('Mean adoption intention (1-5)');
    lockTextSizes(chart);
  });
}'''
s = replace_function(s, "renderScatter", new_scatter, "profile")
changes[p] = s

# The safety item is now stored as a raw 1-5 average rather than the old 0-100 index.
old = 'function countryRows(data, metrics) {\n  const useByCode = d3.rollups(data.filter((row) => row.country_code && row.intention_use_future_score !== null), (rows) => ({\n    use: d3.mean(rows, (row) => row.intention_use_future_score),\n    trust: d3.mean(rows.filter((row) => row.trust_composite_score !== null), (row) => row.trust_composite_score),\n    n: rows.length,\n  }), (row) => row.country_code);\n  const metricByName = new Map(Object.values(metrics.countries).map((country) => [country.name, country]));\n  return useByCode.map(([code, values]) => {\n    const country = COUNTRY_MAP[code];\n    const mapCountry = metricByName.get(country.name);\n    return { ...country, ...values, safetyConcern: mapCountry ? 1 + (100 - mapCountry.metrics.safetyConfidence) / 25 : null };\n  }).filter((row) => Number.isFinite(row.trust) && Number.isFinite(row.safetyConcern));\n}'
new = 'function countryRows(_data, metrics) {\n  return Object.values(metrics.countries).map((country) => ({\n    ...country,\n    use: country.useIntention,\n    trust: country.metrics.trust,\n    n: country.useIntentionN || country.n,\n    safetyConcern: Number.isFinite(country.metrics.safetyConfidence) ? 6 - country.metrics.safetyConfidence : null,\n  })).filter((row) => Number.isFinite(row.use) && Number.isFinite(row.trust) && Number.isFinite(row.safetyConcern));\n}'

p = "src/charts/storyboardCharts.js"
s = read(p)
s = replace_once(s, "import { COUNTRY_MAP } from '../data/countryMap.js';\n", "", "old numeric country-map import")
s = replace_once(s, old, new, "country rows use cleaned-label metrics")
changes[p] = s

# Validate all expected edits before touching any project source file.
for rel, content in changes.items():
    if not content:
        raise ValueError(f"No resulting content for {rel}")

# Install the generated metrics file and write validated source changes.
metrics_source = Path(__file__).parent / "public/data/country_metrics.json"
if not metrics_source.is_file():
    raise FileNotFoundError("Bundle is incomplete: public/data/country_metrics.json is missing.")
raw_source = Path(__file__).parent / "public/data/l3pilot_clean.json"
if not raw_source.is_file():
    raise FileNotFoundError("Bundle is incomplete: public/data/l3pilot_clean.json is missing.")
(ROOT / "public/data").mkdir(parents=True, exist_ok=True)
(ROOT / "public/data/country_metrics.json").write_bytes(metrics_source.read_bytes())
(ROOT / "public/data/l3pilot_clean.json").write_bytes(raw_source.read_bytes())
for rel, content in changes.items():
    (ROOT / rel).write_text(content, encoding="utf-8")
print("Applied the 1-5 country-map update.")
print("Updated: public/data/country_metrics.json and replaced public/data/l3pilot_clean.json,")
print("         src/main.js, src/charts/choropleth.js,")
print("         src/charts/countryDrilldown.js, src/charts/storyboardCharts.js")
print("Next: npm run build")
