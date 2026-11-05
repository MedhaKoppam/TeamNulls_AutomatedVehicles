import * as d3 from 'd3';

const AXES = [
  { key: 'trust', label: 'Trust' },
  { key: 'safetyConfidence', label: 'Safety confidence' },
  { key: 'useIntention', label: 'Willingness to use' },
];
const LIKERT_COLORS = ['#9d5662', '#e66767', '#c9c8c2', '#3d8de7', '#32ad9b'];
const LIKERT_LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const GROUP_COLORS = { selected: '#32ad9b', others: '#e5a65d' };

function pearson(a, b) {
  const ma = d3.mean(a), mb = d3.mean(b);
  const numerator = d3.sum(a, (v, i) => (v - ma) * (b[i] - mb));
  const denominator = Math.sqrt(d3.sum(a, (v) => (v - ma) ** 2) * d3.sum(b, (v) => (v - mb) ** 2));
  return denominator ? numerator / denominator : 0;
}

function makeRows(source, insightByIso) {
  const rows = Object.values(source.countries).map((country) => ({
    name: country.name,
    iso3: country.iso3,
    n: country.n,
    scores: {
      trust: country.metrics.trust,
      safetyConfidence: country.metrics.safetyConfidence,
      useIntention: insightByIso.get(country.iso3)?.useIntention?.mean,
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
  const height = 184;
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
    }
    [
      { name: 'Selected countries', value: selectedMean, color: GROUP_COLORS.selected, y: yMid - 4, group: selected },
      { name: 'Remaining countries', value: otherMean, color: GROUP_COLORS.others, y: yMid + 4, group: others },
    ].forEach((point) => {
      if (!Number.isFinite(point.value)) return;
      svg.append('circle').attr('class', 'bump-dumbbell-point').attr('cx', x(point.value)).attr('cy', point.y)
        .attr('r', 4.5).attr('fill', point.color).attr('tabindex', 0)
        .attr('aria-label', `${item.label}: ${point.name}, ${point.value.toFixed(2)} out of 5`)
        .append('title').text(`${item.label}\n${point.name}: ${point.value.toFixed(2)} / 5\n${point.group.count} countries · ${point.group.n('enjoyment', item.key).toLocaleString()} valid responses`);
    });
  });
}

function drawSocial(host, selected, others, definitions) {
  const width = Math.max(280, Math.floor(host.clientWidth || 360));
  const margin = { top: 10, right: 8, bottom: 8, left: 112 };
  const rowHeight = 47;
  const height = margin.top + definitions.length * rowHeight + margin.bottom;
  const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const svg = d3.select(host).selectAll('svg').data([null]).join('svg')
    .attr('width', width).attr('height', height).attr('role', 'img')
    .attr('aria-label', 'Five-point response distributions for social influence items');
  svg.selectAll('*').remove();

  definitions.forEach((item, index) => {
    const y = margin.top + index * rowHeight;
    svg.append('text').attr('class', 'bump-social-label').attr('x', margin.left - 8).attr('y', y + 13)
      .attr('text-anchor', 'end').text(item.shortLabel || item.label);
    [
      { name: 'Selected', values: selected.distribution('socialInfluence', item.key), group: selected, y: y + 20 },
      { name: 'Others', values: others.distribution('socialInfluence', item.key), group: others, y: y + 34 },
    ].forEach((series) => {
      let offset = 0;
      series.values.forEach((share, responseIndex) => {
        const x0 = x(offset), x1 = x(offset + share);
        const segment = svg.append('rect').attr('class', 'bump-social-segment')
          .attr('x', x0).attr('y', series.y).attr('width', Math.max(0, x1 - x0)).attr('height', 8)
          .attr('fill', LIKERT_COLORS[responseIndex]).attr('rx', 1).attr('tabindex', 0)
          .attr('aria-label', `${item.label}, ${series.group.name}: ${LIKERT_LABELS[responseIndex]}, ${(share * 100).toFixed(1)} percent`);
        segment.append('title').text(`${item.label}\n${series.group.name}\n${LIKERT_LABELS[responseIndex]}: ${(share * 100).toFixed(1)}%`);
        offset += share;
      });
      svg.append('text').attr('class', 'bump-social-series-label').attr('x', margin.left - 8).attr('y', series.y + 7)
        .attr('text-anchor', 'end').text(series.name);
    });
  });
}

export function renderCountryBump(container, metricSource, insightData, {
  onCountryClick = () => {}, onCountryHover = () => {}, onBrushSelection = () => {},
} = {}) {
  const insightByIso = new Map(insightData.countries.map((country) => [country.iso3, country]));
  const rows = makeRows(metricSource, insightByIso);
  if (rows.length !== 17 || rows.some((row) => !insightByIso.has(row.iso3))) {
    throw new Error('Country bump chart requires matching metrics and insight data for all 17 countries.');
  }

  const chartHost = container.querySelector('#bump-chart-svg');
  const enjoyHost = container.querySelector('#bump-enjoyment-chart');
  const socialHost = container.querySelector('#bump-social-chart');
  const selectionCopy = container.querySelector('#bump-selection-copy');
  const selectionStatus = container.querySelector('#bump-selection-status');
  const clearButton = container.querySelector('.bump-clear');
  const tooltip = d3.select(container).selectAll('.bump-tooltip').data([null]).join('div')
    .attr('class', 'tooltip bump-tooltip').style('opacity', 0);
  const ranges = new Map();
  const brushes = new Map();
  const selectedIso = new Set();
  let hoveredIso = null;

  const enjoymentItems = insightData.items.enjoyment;
  const socialItems = insightData.items.socialInfluence.map((item) => ({
    ...item,
    shortLabel: ({ valuedOpinions: 'Opinions I value', behaviorInfluencers: 'People who influence me', importantPeople: 'Important people', recommend: 'Recommend to others' })[item.key] || item.label,
  }));
  const rho = (first, second) => pearson(rows.map((row) => row.ranks[first]), rows.map((row) => row.ranks[second]));
  container.querySelector('#bump-trust-safety-rho').textContent = `ρ = ${rho('trust', 'safetyConfidence').toFixed(2)}`;
  container.querySelector('#bump-trust-use-rho').textContent = `ρ = ${rho('trust', 'useIntention').toFixed(2)}`;

  const width = Math.max(480, Math.floor(chartHost.clientWidth || container.clientWidth || 720));
  const height = 370;
  const margin = { top: 72, right: 62, bottom: 34, left: 58 };
  const top = margin.top, bottom = height - margin.bottom;
  const x = d3.scalePoint().domain(AXES.map((axis) => axis.key)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([1, rows.length]).range([top, bottom]);
  const svg = d3.select(chartHost).selectAll('svg').data([null]).join('svg')
    .attr('class', 'country-bump-svg').attr('width', width).attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
    .attr('aria-label', 'Bump chart ranking 17 countries by trust, safety confidence and willingness to use. Rank 1 is the most positive score.');
  svg.selectAll('*').remove();

  const grid = svg.append('g').attr('class', 'bump-rank-grid');
  [1, 5, 9, 13, 17].forEach((rank) => {
    grid.append('line').attr('x1', margin.left - 10).attr('x2', width - margin.right + 10).attr('y1', y(rank)).attr('y2', y(rank));
    grid.append('text').attr('x', 12).attr('y', y(rank) + 4).attr('class', 'bump-grid-label').text(rank);
  });
  svg.append('text').attr('class', 'bump-rank-caption').attr('x', 12).attr('y', 52).text('RANK');

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
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (row) => `${row.name}: trust rank ${row.ranks.trust}; safety confidence rank ${row.ranks.safetyConfidence}; willingness to use rank ${row.ranks.useIntention}. Click to open country profile.`)
    .on('mouseenter focus', (event, row) => {
      hoveredIso = row.iso3;
      const hasBrush = [...ranges.values()].some(Boolean);
      pathLines.classed('is-hovered', (d) => d.iso3 === hoveredIso)
        .classed('is-muted', (d) => d.iso3 !== hoveredIso && (!hasBrush || !selectedIso.has(d.iso3)));
      onCountryHover(row.iso3);
      tooltip.html(`<strong>${row.name}</strong><br>Trust: ${row.scores.trust.toFixed(2)} / 5 · rank ${row.ranks.trust}<br>Safety confidence: ${row.scores.safetyConfidence.toFixed(2)} / 5 · rank ${row.ranks.safetyConfidence}<br>Willingness to use: ${row.scores.useIntention.toFixed(2)} / 5 · rank ${row.ranks.useIntention}<br>Respondents: ${row.n.toLocaleString()}`).style('opacity', 1).style('left', '8px').style('top', '8px');
    })
    .on('mouseleave blur', () => {
      hoveredIso = null;
      const hasBrush = [...ranges.values()].some(Boolean);
      pathLines.classed('is-hovered', false).classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
      onCountryHover(null);
      tooltip.style('opacity', 0);
    })
    .on('click keydown', (event, row) => {
      if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); onCountryClick(row.iso3);
      }
    });

  const pointLayer = svg.append('g').attr('class', 'bump-country-points');
  AXES.forEach((axis) => {
    pointLayer.selectAll(`circle.point-${axis.key}`).data(rows).join('circle')
      .attr('class', `bump-country-point point-${axis.key}`).attr('cx', x(axis.key))
      .attr('cy', (row) => y(row.ranks[axis.key])).attr('r', 3.8).attr('aria-hidden', 'true');
  });

  function updatePanel(matches, hasBrush) {
    const excluded = rows.filter((row) => !matches.some((match) => match.iso3 === row.iso3));
    const selectedGroup = groupRows(matches, insightByIso, 'Selected countries');
    const othersGroup = groupRows(excluded, insightByIso, 'Remaining countries');
    if (!hasBrush) {
      selectionCopy.textContent = 'Brush any rank axis to select countries and populate these two charts.';
      emptyChart(enjoyHost, 'Brush a rank range to compare perceived enjoyment.');
      emptyChart(socialHost, 'Brush a rank range to compare social influence.');
    } else if (!matches.length) {
      selectionCopy.textContent = 'No countries match every brushed range. Widen a brush or clear one axis.';
      emptyChart(enjoyHost, 'No countries match this combination of rank ranges.');
      emptyChart(socialHost, 'No countries match this combination of rank ranges.');
    } else if (!excluded.length) {
      selectionCopy.textContent = `${matches.length} countries selected · all 17 countries are included, so there is no remaining-country comparison.`;
      emptyChart(enjoyHost, 'Narrow the selection to compare it with the remaining countries.');
      emptyChart(socialHost, 'Narrow the selection to compare it with the remaining countries.');
    } else {
      selectionCopy.textContent = `${matches.length} of ${rows.length} countries selected · compared with ${excluded.length} remaining countries. Country averages are equally weighted.`;
      drawEnjoyment(enjoyHost, selectedGroup, othersGroup, enjoymentItems);
      drawSocial(socialHost, selectedGroup, othersGroup, socialItems);
    }
  }

  function updateSelection() {
    const activeRanges = [...ranges.entries()].filter(([, range]) => range);
    const hasBrush = activeRanges.length > 0;
    const matches = hasBrush ? rows.filter((row) => activeRanges.every(([key, range]) => row.ranks[key] >= range[0] && row.ranks[key] <= range[1])) : [];
    selectedIso.clear(); matches.forEach((row) => selectedIso.add(row.iso3));
    const anyHover = hoveredIso;
    pathLines.classed('is-selected', (row) => hasBrush && selectedIso.has(row.iso3))
      .classed('is-muted', (row) => anyHover ? row.iso3 !== anyHover && (!hasBrush || !selectedIso.has(row.iso3)) : hasBrush && !selectedIso.has(row.iso3));
    pointLayer.selectAll('.bump-country-point').classed('is-selected', (row) => hasBrush && selectedIso.has(row.iso3))
      .classed('is-muted', (row) => hasBrush && !selectedIso.has(row.iso3));
    selectionStatus.textContent = hasBrush ? `${matches.length} countries match` : 'No rank range selected';
    onBrushSelection(matches.map((row) => row.iso3));
    updatePanel(matches, hasBrush);
  }

  const brushLayer = svg.append('g').attr('class', 'bump-brushes');
  AXES.forEach((axis) => {
    const axisX = x(axis.key);
    const brush = d3.brushY().extent([[axisX - 19, top], [axisX + 19, bottom]])
      .on('brush end', (event) => {
        if (!event.sourceEvent) return;
        if (!event.selection) ranges.set(axis.key, null);
        else {
          const [y0, y1] = event.selection;
          const lower = Math.max(1, Math.ceil(y.invert(y0) - 0.5));
          const upper = Math.min(rows.length, Math.floor(y.invert(y1) + 0.5));
          const center = Math.max(1, Math.min(rows.length, Math.round(y.invert((y0 + y1) / 2))));
          ranges.set(axis.key, lower <= upper ? [lower, upper] : [center, center]);
        }
        updateSelection();
      });
    const group = brushLayer.append('g').attr('class', `bump-brush bump-brush-${axis.key}`).call(brush);
    group.selectAll('.overlay').attr('aria-label', `Brush ${axis.label} ranks`).attr('tabindex', 0);
    brushes.set(axis.key, { brush, group });
  });

  clearButton.addEventListener('click', () => {
    brushes.forEach(({ brush, group }, key) => { group.call(brush.move, null); ranges.set(key, null); });
    updateSelection();
  });
  updateSelection();
}
