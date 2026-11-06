import * as d3 from 'd3';
import { COUNTRY_MAP } from '../data/countryMap.js';

const AXES = [
  { key: 'trust', label: 'Trust' },
  { key: 'safetyConfidence', label: 'Safety confidence' },
  { key: 'adoption', label: 'Overall adoption intention' },
];
const LIKERT_COLORS = ['#9d5662', '#e66767', '#c9c8c2', '#3d8de7', '#32ad9b'];
const LIKERT_LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const GROUP_COLORS = { selected: '#32ad9b', others: '#e5a65d' };
const COUNTRY_NAME_BY_ISO = new Map(Object.values(COUNTRY_MAP).map((country) => [country.iso3, country.name]));

function makeRows(source) {
  const rows = Object.values(source.countries).map((country) => ({
    name: COUNTRY_NAME_BY_ISO.get(country.iso3) ?? country.name,
    iso3: country.iso3,
    n: country.n,
    scores: {
      trust: country.metrics.trust,
      safetyConfidence: country.metrics.safetyConfidence,
      adoption: country.metrics.adoption,
    },
    ranks: {},
  })).filter((row) => AXES.every((axis) => Number.isFinite(row.scores[axis.key])));

  AXES.forEach((axis) => {
    [...rows].sort((a, b) => d3.descending(a.scores[axis.key], b.scores[axis.key]) || d3.ascending(a.name, b.name))
      .forEach((row, i) => { row.ranks[axis.key] = i + 1; });
  });
  return rows;
}

function groupRows(rows, insightByIso, name) {
  const countries = rows.map((row) => insightByIso.get(row.iso3)).filter(Boolean);
  return {
    name,
    countries,
    count: countries.length,
    mean(group, key) { return d3.mean(countries, (country) => country.items[group]?.[key]?.mean); },
    n(group, key) { return d3.sum(countries, (country) => country.items[group]?.[key]?.n || 0); },
    distribution(group, key) {
      const countryShares = countries.map((country) => {
        const item = country.items[group]?.[key];
        return item?.n ? item.counts.map((value) => value / item.n) : null;
      }).filter(Boolean);
      return d3.range(5).map((index) => d3.mean(countryShares, (shares) => shares[index]) || 0);
    },
  };
}

function emptyChart(host, message) {
  host.innerHTML = `<div class="bump-insight-empty">${message}</div>`;
}

function drawEnjoyment(host, selected, others, definitions) {
  const width = Math.max(280, Math.floor(host.clientWidth || 360));
  const height = Math.max(184, Math.floor(host.clientHeight || 0));
  const margin = { top: 22, right: 14, bottom: 35, left: 105 };
  const x = d3.scaleLinear().domain([1, 5]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(definitions.map((item) => item.key)).range([margin.top, height - margin.bottom]).padding(.42);
  const svg = d3.select(host).selectAll('svg').data([null]).join('svg')
    .attr('width', width).attr('height', height).attr('role', 'img')
    .attr('aria-label', 'Selected and remaining countries compared on perceived enjoyment');
  svg.selectAll('*').remove();
  svg.append('g').attr('class', 'bump-mini-axis').attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues([1, 2, 3, 4, 5]));
  svg.append('text').attr('class', 'bump-mini-axis-title').attr('x', (margin.left + width - margin.right) / 2)
    .attr('y', height - 3).attr('text-anchor', 'middle').text('Mean agreement · 1 to 5');

  definitions.forEach((item) => {
    const yMid = y(item.key) + y.bandwidth() / 2;
    const selectedMean = selected.mean('enjoyment', item.key);
    const otherMean = others.mean('enjoyment', item.key);
    svg.append('text').attr('class', 'bump-mini-label').attr('x', margin.left - 8).attr('y', yMid + 4)
      .attr('text-anchor', 'end').text(item.label);
    if (Number.isFinite(selectedMean) && Number.isFinite(otherMean)) {
      svg.append('line').attr('class', 'bump-dumbbell-connector')
        .attr('x1', x(Math.min(selectedMean, otherMean))).attr('x2', x(Math.max(selectedMean, otherMean)))
        .attr('y1', yMid).attr('y2', yMid);
      const delta = selectedMean - otherMean;
      svg.append('text').attr('class', 'bump-enjoyment-delta').attr('x', width - margin.right).attr('y', yMid - 28)
        .attr('text-anchor', 'end').text('Δ ' + (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(2));
    }
    [
      { name: 'Selected (' + selected.count + ')', value: selectedMean, color: GROUP_COLORS.selected, y: yMid - 6, labelY: yMid - 18, group: selected },
      { name: 'Other (' + others.count + ')', value: otherMean, color: GROUP_COLORS.others, y: yMid + 6, labelY: yMid + 22, group: others },
    ].forEach((point) => {
      if (!Number.isFinite(point.value)) return;
      svg.append('text').attr('class', 'bump-dumbbell-value').attr('x', x(point.value))
        .attr('y', point.labelY).attr('text-anchor', 'middle').attr('fill', point.color)
        .text(point.name + ' ' + point.value.toFixed(2));
      svg.append('circle').attr('class', 'bump-dumbbell-point').attr('cx', x(point.value)).attr('cy', point.y)
        .attr('r', 6).attr('fill', point.color).attr('tabindex', 0)
        .attr('aria-label', `${item.label}: ${point.name}, ${point.value.toFixed(2)} out of 5`)
        .append('title').text(`${item.label}\n${point.name}: ${point.value.toFixed(2)} / 5\n${point.group.count} countries · ${point.group.n('enjoyment', item.key).toLocaleString()} valid responses`);
    });
  });
}

function drawSocial(host, selected, others, definitions) {
  const width = Math.max(280, Math.floor(host.clientWidth || 360));
  const margin = { top: 10, right: 8, bottom: 8, left: 112 };
  const rowHeight = Math.max(76, Math.floor(((host.clientHeight || 0) - margin.top - margin.bottom) / definitions.length));
  const height = margin.top + definitions.length * rowHeight + margin.bottom;
  const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const svg = d3.select(host).selectAll('svg').data([null]).join('svg')
    .attr('width', width).attr('height', height).attr('role', 'img')
    .attr('aria-label', 'Five-point response distributions for social influence items');
  svg.selectAll('*').remove();

  definitions.forEach((item, index) => {
    const y = margin.top + index * rowHeight;
    svg.append('text').attr('class', 'bump-social-label').attr('x', margin.left - 8).attr('y', y + 15)
      .attr('text-anchor', 'end').text(item.shortLabel || item.label);
    [
      { name: 'Selected (' + selected.count + ')', values: selected.distribution('socialInfluence', item.key), group: selected, y: y + 24 },
      { name: 'Other (' + others.count + ')', values: others.distribution('socialInfluence', item.key), group: others, y: y + 43 },
    ].forEach((series) => {
      let offset = 0;
      series.values.forEach((share, responseIndex) => {
        const x0 = x(offset), x1 = x(offset + share);
        const segment = svg.append('rect').attr('class', 'bump-social-segment')
          .attr('x', x0).attr('y', series.y).attr('width', Math.max(0, x1 - x0)).attr('height', 12)
          .attr('fill', LIKERT_COLORS[responseIndex]).attr('rx', 1).attr('tabindex', 0)
          .attr('aria-label', `${item.label}, ${series.group.name}: ${LIKERT_LABELS[responseIndex]}, ${(share * 100).toFixed(1)} percent`);
        segment.append('title').text(`${item.label}\n${series.group.name}\n${LIKERT_LABELS[responseIndex]}: ${(share * 100).toFixed(1)}%\n${series.group.count} countries · ${series.group.n('socialInfluence', item.key).toLocaleString()} valid responses`);
        offset += share;
      });
      svg.append('text').attr('class', 'bump-social-series-label').attr('x', margin.left - 8).attr('y', series.y + 10)
        .attr('text-anchor', 'end').text(series.name);
    });
    const selectedPositive = (selected.distribution('socialInfluence', item.key)[3] + selected.distribution('socialInfluence', item.key)[4]) * 100;
    const otherPositive = (others.distribution('socialInfluence', item.key)[3] + others.distribution('socialInfluence', item.key)[4]) * 100;
    const difference = selectedPositive - otherPositive;
    svg.append('text').attr('class', 'bump-social-summary').attr('x', margin.left).attr('y', y + 72)
      .text('Positive: ' + selectedPositive.toFixed(0) + '% vs ' + otherPositive.toFixed(0) + '%  ·  ' + (difference >= 0 ? '+' : '−') + Math.abs(difference).toFixed(0) + ' pp');
  });
}

export function renderCountryBump(container, metricSource, insightData, {
  onCountryHover = () => {}, onBrushSelection = () => {},
} = {}) {
  const insightByIso = new Map(insightData.countries.map((country) => [country.iso3, country]));
  const rows = makeRows(metricSource);
  if (rows.length !== 17 || rows.some((row) => !insightByIso.has(row.iso3))) {
    throw new Error('Country bump chart requires matching metrics and insight data for all 17 countries.');
  }

  const chartHost = container.querySelector('#bump-chart-svg');
  const enjoyHost = container.querySelector('#bump-enjoyment-chart');
  const socialHost = container.querySelector('#bump-social-chart');
  const rankView = container.querySelector('#bump-rank-view');
  const insightsView = container.querySelector('#bump-insights');
  const screenHead = container.closest('.chart-shell')?.querySelector('.screen-head');
  const filterMode = container.querySelector('#bump-filter-mode');
  const selectionToolbar = container.querySelector('.bump-selection-toolbar');
  const selectionStatus = container.querySelector('#bump-selection-status');
  const viewInsightsButton = container.querySelector('#bump-view-insights');
  const clearButton = container.querySelector('.bump-clear');
  const focusedLegend = container.querySelector('#bump-focused-legend');
  const comparisonLegend = container.querySelector('#bump-comparison-legend');
  const ranges = new Map(AXES.map((axis) => [axis.key, [1, 17]]));
  const brushes = new Map();
  const keyboardHandles = new Map();
  const selectedIso = new Set();
  let hoveredIso = null;
  let rankFilterEnabled = false;

  const enjoymentItems = insightData.items.enjoyment;
  const socialItems = insightData.items.socialInfluence.map((item) => ({
    ...item,
    shortLabel: ({ valuedOpinions: 'Opinions I value', behaviorInfluencers: 'People who influence me', importantPeople: 'Important people', recommend: 'Recommend to others' })[item.key] || item.label,
  }));
  const width = Math.max(480, Math.floor(chartHost.clientWidth || container.clientWidth || 720));
  const scrollRegion = container.closest('.bump-scroll');
  const controlsHeight = 42;
  const height = Math.max(360, Math.floor((scrollRegion?.clientHeight || 0) - controlsHeight) || 500);
  const margin = { top: 72, right: 112, bottom: 38, left: 58 };
  const top = margin.top, bottom = height - margin.bottom;
  const x = d3.scalePoint().domain(AXES.map((axis) => axis.key)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([1, rows.length]).range([top, bottom]);
  const svg = d3.select(chartHost).selectAll('svg').data([null]).join('svg')
    .attr('class', 'country-bump-svg').attr('width', width).attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
    .attr('aria-label', 'Bump chart ranking 17 countries by trust, safety confidence and overall adoption intention. Rank 1 is the most positive score. Each axis has a two-handle rank range selector.');
  svg.selectAll('*').remove();
  svg.classed('is-filter-mode', false);

  const grid = svg.append('g').attr('class', 'bump-rank-grid');
  [1, 5, 9, 13, 17].forEach((rank) => {
    grid.append('line').attr('x1', margin.left - 10).attr('x2', width - margin.right + 10).attr('y1', y(rank)).attr('y2', y(rank));
    grid.append('text').attr('x', 12).attr('y', y(rank) + 4).attr('class', 'bump-grid-label').text(rank);
  });

  AXES.forEach((axis) => {
    const axisX = x(axis.key);
    svg.append('line').attr('class', 'bump-axis-line').attr('x1', axisX).attr('x2', axisX).attr('y1', top).attr('y2', bottom);
    svg.append('text').attr('class', 'bump-axis-title').attr('x', axisX).attr('y', 22).attr('text-anchor', 'middle').text(axis.label);
    svg.append('text').attr('class', 'bump-axis-subtitle').attr('x', axisX).attr('y', 40).attr('text-anchor', 'middle')
      .text(axis.key === 'safetyConfidence' ? 'Higher = fewer concerns' : 'Higher = more positive');
  });

  const line = d3.line().x((point) => x(point.key)).y((point) => y(point.rank)).curve(d3.curveMonotoneX);
  const pathLines = svg.append('g').attr('class', 'bump-country-lines').selectAll('path').data(rows).join('path')
    .attr('class', 'bump-country-line').attr('data-country', (row) => row.iso3)
    .attr('d', (row) => line(AXES.map((axis) => ({ key: axis.key, rank: row.ranks[axis.key] }))))
    .attr('tabindex', 0)
    .attr('aria-label', (row) => `${row.name}: trust rank ${row.ranks.trust}; safety confidence rank ${row.ranks.safetyConfidence}; overall adoption intention rank ${row.ranks.adoption}.`)
    .on('mouseenter focus', (event, row) => {
      hoveredIso = row.iso3;
      const hasBrush = hasNarrowRange();
      pathLines.classed('is-hovered', (d) => d.iso3 === hoveredIso)
        .classed('is-muted', (d) => d.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(d.iso3)));
      countryLabels.classed('is-hovered', (d) => d.iso3 === hoveredIso)
        .classed('is-muted', (d) => d.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(d.iso3)));
      onCountryHover(row.iso3);
    })
    .on('mouseleave blur', () => {
      hoveredIso = null;
      const hasBrush = hasNarrowRange();
      pathLines.classed('is-hovered', false).classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
      countryLabels.classed('is-hovered', false).classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
      onCountryHover(null);
    })
    ;

  svg.append('g').attr('class', 'bump-country-hit-areas').selectAll('path').data(rows).join('path')
    .attr('class', 'bump-country-hit-area').attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 16)
    .attr('pointer-events', 'stroke')
    .attr('d', (row) => line(AXES.map((axis) => ({ key: axis.key, rank: row.ranks[axis.key] }))))
    .on('mouseenter', (event, row) => {
      hoveredIso = row.iso3;
      const hasBrush = hasNarrowRange();
      pathLines.classed('is-hovered', (d) => d.iso3 === hoveredIso)
        .classed('is-muted', (d) => d.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(d.iso3)));
      countryLabels.classed('is-hovered', (d) => d.iso3 === hoveredIso)
        .classed('is-muted', (d) => d.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(d.iso3)));
      onCountryHover(row.iso3);
    })
    .on('mouseleave', () => {
      hoveredIso = null;
      const hasBrush = hasNarrowRange();
      pathLines.classed('is-hovered', false).classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
      countryLabels.classed('is-hovered', false).classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
      onCountryHover(null);
    });

  const pointLayer = svg.append('g').attr('class', 'bump-country-points');
  AXES.forEach((axis) => {
    pointLayer.selectAll(`circle.point-${axis.key}`).data(rows).join('circle')
      .attr('class', `bump-country-point point-${axis.key}`).attr('cx', x(axis.key))
      .attr('cy', (row) => y(row.ranks[axis.key])).attr('r', 3.8).attr('aria-hidden', 'true');
  });
  const countryLabels = svg.append('g').attr('class', 'bump-country-labels').selectAll('text').data(rows).join('text')
    .attr('class', 'bump-country-label').attr('x', x('adoption') + 8)
    .attr('y', (row) => y(row.ranks.adoption) + 4).attr('aria-hidden', 'true').text((row) => row.name);

  function openInsights(focusRows) {
    const focusIso = new Set(focusRows.map((row) => row.iso3));
    const comparisonRows = rows.filter((row) => !focusIso.has(row.iso3));
    focusedLegend.textContent = focusRows.length === 1 ? '1 selected country' : `${focusRows.length} selected countries`;
    comparisonLegend.textContent = comparisonRows.length === 1 ? comparisonRows[0].name : `${comparisonRows.length} other countries`;
    if (screenHead) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'map-profile-title-back';
      back.innerHTML = '<span class="map-profile-title-chevron" aria-hidden="true">‹</span><span class="map-profile-title-name">Back to rankings</span>';
      back.setAttribute('aria-label', 'Return to rank comparison');
      back.addEventListener('click', closeInsights);
      const context = document.createElement('p');
      context.className = 'bump-detail-context';
      context.textContent = `${focusRows.length} selected ${focusRows.length === 1 ? 'country' : 'countries'} compared with ${comparisonRows.length} ${comparisonRows.length === 1 ? 'other' : 'others'}`;
      screenHead.replaceChildren(back, context);
    }
    rankView.hidden = true;
    insightsView.hidden = false;
    const focusGroup = groupRows(focusRows, insightByIso, focusedLegend.textContent);
    const comparisonGroup = groupRows(comparisonRows, insightByIso, comparisonLegend.textContent);
    requestAnimationFrame(() => {
      drawEnjoyment(enjoyHost, focusGroup, comparisonGroup, enjoymentItems);
      drawSocial(socialHost, focusGroup, comparisonGroup, socialItems);
    });
  }

  function closeInsights() {
    insightsView.hidden = true;
    rankView.hidden = false;
    if (screenHead) {
      const title = document.createElement('h3');
      title.textContent = 'How country rankings shift across the three measures';
      screenHead.replaceChildren(title);
    }
  }

  function narrowedAxis() {
    if (!rankFilterEnabled) return null;
    return AXES.find((axis) => {
      const [lower, upper] = ranges.get(axis.key);
      return lower !== 1 || upper !== rows.length;
    });
  }

  function hasNarrowRange() { return Boolean(narrowedAxis()); }

  function updateKeyboardHandles(axisKey) {
    const handles = keyboardHandles.get(axisKey);
    if (!handles) return;
    const [lower, upper] = ranges.get(axisKey);
    handles
      .attr('aria-valuenow', function () { return this.classList.contains('handle--n') ? lower : upper; })
      .attr('aria-valuetext', function () { return `Rank ${this.classList.contains('handle--n') ? lower : upper}`; });
  }

  function updateSelection() {
    const activeAxes = AXES.filter((axis) => {
      const [lower, upper] = ranges.get(axis.key);
      return rankFilterEnabled && (lower !== 1 || upper !== rows.length);
    });
    const hasBrush = activeAxes.length > 0;
    const matches = hasBrush
      ? rows.filter((row) => activeAxes.every((axis) => {
        const [lower, upper] = ranges.get(axis.key);
        return row.ranks[axis.key] >= lower && row.ranks[axis.key] <= upper;
      }))
      : [];
    selectedIso.clear(); matches.forEach((row) => selectedIso.add(row.iso3));
    selectionToolbar.hidden = !rankFilterEnabled || !hasBrush;
    pathLines.classed('is-selected', (row) => hasBrush && selectedIso.has(row.iso3))
      .classed('is-muted', (row) => hoveredIso ? row.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(row.iso3)) : hasBrush && !selectedIso.has(row.iso3));
    countryLabels.classed('is-selected', (row) => hasBrush && selectedIso.has(row.iso3))
      .classed('is-muted', (row) => hoveredIso ? row.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(row.iso3)) : hasBrush && !selectedIso.has(row.iso3));
    pointLayer.selectAll('.bump-country-point').classed('is-selected', (row) => hasBrush && selectedIso.has(row.iso3))
      .classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
    selectionStatus.textContent = hasBrush ? `${matches.length} selected countries` : '';
    viewInsightsButton.textContent = 'View detailed insights';
    onBrushSelection(matches.map((row) => row.iso3));
    return { activeAxes, matches };
  }

  function setRange(axisKey, nextRange, syncBrush = true) {
    const lower = Math.max(1, Math.min(rows.length, Math.round(nextRange[0])));
    const upper = Math.max(lower, Math.min(rows.length, Math.round(nextRange[1])));
    ranges.set(axisKey, [lower, upper]);
    if (syncBrush) {
      const { brush, group } = brushes.get(axisKey) || {};
      if (brush && group) group.call(brush.move, [y(lower), y(upper)]);
    }
    updateKeyboardHandles(axisKey);
    updateSelection();
  }

  const railLayer = svg.append('g').attr('class', 'bump-range-rails');
  const brushLayer = svg.append('g').attr('class', 'bump-brushes');
  AXES.forEach((axis) => {
    const axisX = x(axis.key);
    const railX = axisX;
    railLayer.append('line').attr('class', 'bump-range-track').attr('x1', railX).attr('x2', railX).attr('y1', top).attr('y2', bottom);
    const brush = d3.brushY().extent([[railX - 9, top], [railX + 9, bottom]])
      .on('start', (event) => {
        if (!event.sourceEvent) return;
      })
      .on('brush', (event) => {
        if (!event.sourceEvent || !event.selection) return;
        const [y0, y1] = event.selection;
        const lower = Math.max(1, Math.min(rows.length, Math.round(y.invert(y0))));
        const upper = Math.max(lower, Math.min(rows.length, Math.round(y.invert(y1))));
        setRange(axis.key, [lower, upper], false);
      })
      .on('end', (event) => {
        if (!event.sourceEvent) return;
        setRange(axis.key, ranges.get(axis.key));
      });
    const group = brushLayer.append('g').attr('class', `bump-brush bump-brush-${axis.key}`).call(brush);
    brushes.set(axis.key, { brush, group });
    group.call(brush.move, [y(1), y(rows.length)]);

    const handles = group.selectAll('.handle')
      .attr('tabindex', 0).attr('role', 'slider')
      .attr('aria-label', function () { return `${axis.label} rank range ${this.classList.contains('handle--n') ? 'start' : 'end'}`; })
      .attr('aria-valuemin', 1).attr('aria-valuemax', rows.length)
      .on('keydown', function (event) {
        const bound = this.classList.contains('handle--n') ? 'lower' : 'upper';
        const range = [...ranges.get(axis.key)];
        const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : event.key === 'PageUp' ? -3 : event.key === 'PageDown' ? 3 : 0;
        if (event.key === 'Home') range[bound === 'lower' ? 0 : 1] = 1;
        else if (event.key === 'End') range[bound === 'lower' ? 0 : 1] = rows.length;
        else if (!step) return;
        else range[bound === 'lower' ? 0 : 1] += step;
        if (range[0] > range[1]) range[bound === 'lower' ? 0 : 1] = range[bound === 'lower' ? 1 : 0];
        event.preventDefault();
        setRange(axis.key, range);
      });
    keyboardHandles.set(axis.key, handles);
    updateKeyboardHandles(axis.key);
  });

  viewInsightsButton.addEventListener('click', () => {
    const { activeAxes, matches } = updateSelection();
    if (!activeAxes.length || !matches.length) return;
    openInsights(matches);
  });

  clearButton.addEventListener('click', () => {
    AXES.forEach((axis) => setRange(axis.key, [1, rows.length]));
  });
  filterMode.addEventListener('change', () => {
    rankFilterEnabled = filterMode.checked;
    if (!rankFilterEnabled) AXES.forEach((axis) => setRange(axis.key, [1, rows.length]));
    svg.classed('is-filter-mode', rankFilterEnabled);
    updateSelection();
  });
  updateSelection();
}
