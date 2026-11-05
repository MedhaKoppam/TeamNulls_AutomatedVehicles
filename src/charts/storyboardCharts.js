import * as d3 from 'd3';
import { COUNTRY_MAP } from '../data/countryMap.js';

const MIN_WIDTH = 320;
const noMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function responsive(container, draw) {
  const render = () => draw(Math.max(MIN_WIDTH, Math.floor(container.clientWidth || MIN_WIDTH)));
  container.__storyResize?.disconnect();
  let timer;
  container.__storyResize = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(render, 100); });
  container.__storyResize.observe(container);
  const scroll = container.closest('.chart-scroll');
  if (scroll) container.__storyResize.observe(scroll);
  requestAnimationFrame(render);
}

function tooltip(host) {
  return d3.select(host).selectAll('.tooltip').data([null]).join('div').attr('class', 'tooltip').style('opacity', 0);
}

function countryRows(data, metrics) {
  const useByCode = d3.rollups(data.filter((row) => row.country_code && row.intention_use_future_score !== null), (rows) => ({
    use: d3.mean(rows, (row) => row.intention_use_future_score),
    trust: d3.mean(rows.filter((row) => row.trust_composite_score !== null), (row) => row.trust_composite_score),
    n: rows.length,
  }), (row) => row.country_code);
  const metricByName = new Map(Object.values(metrics.countries).map((country) => [country.name, country]));
  return useByCode.map(([code, values]) => {
    const country = COUNTRY_MAP[code];
    const mapCountry = metricByName.get(country.name);
    return { ...country, ...values, safetyConcern: mapCountry ? 1 + (100 - mapCountry.metrics.safetyConfidence) / 25 : null };
  }).filter((row) => Number.isFinite(row.trust) && Number.isFinite(row.safetyConcern));
}

function regression(rows) {
  const meanX = d3.mean(rows, (d) => d.trust), meanY = d3.mean(rows, (d) => d.use);
  const numerator = d3.sum(rows, (d) => (d.trust - meanX) * (d.use - meanY));
  const denominator = d3.sum(rows, (d) => (d.trust - meanX) ** 2);
  const slope = numerator / denominator, intercept = meanY - slope * meanX;
  const r = numerator / Math.sqrt(denominator * d3.sum(rows, (d) => (d.use - meanY) ** 2));
  return { slope, intercept, r };
}

export function getStoryboardStats(data) {
  // intention_use_future_score is question f16_9 (future-use intention).
  // The conversion mapping keeps f16_10 separate as the enjoyment item.
  const valid = data.filter((row) => row.intention_use_future_score !== null);
  const distribution = d3.range(1, 6).map((score) => ({ score, n: valid.filter((row) => row.intention_use_future_score === score).length }));
  distribution.forEach((item) => { item.share = item.n / valid.length * 100; });
  return {
    n: valid.length,
    distribution,
    disagree: distribution[0].share + distribution[1].share,
    neutral: distribution[2].share,
    agree: distribution[3].share + distribution[4].share,
  };
}

export function renderWillingnessDistribution(container, data) {
  const valid = data.filter((row) => row.intention_use_future_score !== null);
  const labels = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
  const colors = [token('--accent-warm'), token('--accent-warm'), token('--bg-hover'), token('--accent'), token('--accent')];
  const values = d3.range(1, 6).map((score, index) => ({ label: labels[index], share: valid.filter((row) => row.intention_use_future_score === score).length / valid.length * 100, index }));
  const tip = tooltip(container);
  responsive(container, (width) => {
    const height = 210, margin = { top: 34, right: 26, bottom: 52, left: 26 };
    const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('width', width).attr('height', height).attr('role', 'img').attr('aria-label', 'Distribution of willingness to use automated driving');
    svg.selectAll('*').remove();
    const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]);
    let offset = 0;
    values.forEach((item) => { item.start = offset; offset += item.share; });
    svg.selectAll('rect.segment').data(values).join('rect').attr('class', (d) => `willingness-segment${d.index === 2 ? ' neutral' : ''}`).attr('x', (d) => x(d.start)).attr('y', 63).attr('width', (d) => x(d.share) - x(0)).attr('height', 56).attr('rx', 3).attr('fill', (d) => colors[d.index]).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (d) => `${d.label}: ${d.share.toFixed(1)} percent`).on('mouseenter focus', (event, d) => tip.style('opacity', 1).html(`<strong>${d.label}</strong><br>${d.share.toFixed(1)}% · n=${valid.length.toLocaleString()}`).style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 8}px`)).on('mouseleave blur', () => tip.style('opacity', 0));
    svg.selectAll('text.segment-value').data(values).join('text').attr('class', 'segment-value').attr('x', (d) => x(d.start + d.share / 2)).attr('y', 96).attr('text-anchor', 'middle').attr('font-size', 14).text((d) => `${Math.round(d.share)}%`);
    svg.selectAll('text.segment-label').data(values).join('text').attr('class', 'segment-label').attr('x', (d) => x(d.start + d.share / 2)).attr('y', 143).attr('text-anchor', 'middle').attr('font-size', 12).each(function (d) {
      const label = d3.select(this);
      const words = d.label.split(' ');
      words.forEach((word, i) => label.append('tspan').attr('x', label.attr('x')).attr('dy', i ? 15 : 0).text(word));
    });
    svg.append('text').attr('class', 'story-annotation').attr('x', x(values[2].start + values[2].share / 2)).attr('y', 44).attr('text-anchor', 'middle').attr('font-size', 12).text('Still persuadable');
  });
}

function renderCountryScatter(container, rows, mode) {
  const tip = tooltip(container), accent = token('--accent'), muted = token('--text-muted'), primary = token('--text-primary');
  responsive(container, (width) => {
    const availableHeight = container.closest('.chart-scroll')?.clientHeight || 510;
    const height = Math.max(300, Math.min(510, availableHeight)), margin = { top: 48, right: 62, bottom: 64, left: 62 };
    const x = d3.scaleLinear().domain(d3.extent(rows, (d) => d.trust)).nice().range([margin.left, width - margin.right]);
    const yField = mode === 'trust-use' ? 'use' : 'safetyConcern';
    const yTitle = mode === 'trust-use' ? 'Mean willingness to use (1–5)' : 'Mean safety concern (1–5)';
    const y = d3.scaleLinear().domain(d3.extent(rows, (d) => d[yField])).nice().range([height - margin.bottom, margin.top]);
    const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('width', width).attr('height', height).attr('role', 'img').attr('aria-label', yTitle + ' by mean trust');
    svg.selectAll('*').remove();
    svg.append('g').attr('class', 'story-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append('g').attr('class', 'story-axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
    if (mode === 'trust-use') {
      const model = regression(rows), [x0, x1] = x.domain();
      svg.append('line').attr('class', 'story-regression').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(model.intercept + model.slope * x0)).attr('y2', y(model.intercept + model.slope * x1));
      svg.append('text').attr('class', 'story-stat-label').attr('x', width - margin.right).attr('y', margin.top + 10).attr('text-anchor', 'end').attr('font-size', 12).text(`r = ${model.r.toFixed(3)}`);
    } else {
      const mx = d3.mean(rows, (d) => d.trust), my = d3.mean(rows, (d) => d.safetyConcern);
      svg.append('line').attr('class', 'story-guide').attr('x1', x(mx)).attr('x2', x(mx)).attr('y1', margin.top).attr('y2', height - margin.bottom);
      svg.append('line').attr('class', 'story-guide').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', y(my)).attr('y2', y(my));
    }
    const focal = d3.greatest(rows, (d) => d.use);
    svg.selectAll('circle.country-point').data(rows).join('circle').attr('class', (d) => `country-point${mode === 'trust-safety' && d.name === focal.name ? ' focal' : ''}`).attr('cx', (d) => x(d.trust)).attr('cy', (d) => y(d[yField])).attr('r', (d) => mode === 'trust-safety' && d.name === focal.name ? 8 : 6).attr('fill', (d) => mode === 'trust-safety' && d.name === focal.name ? accent : muted).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (d) => `${d.name}: trust ${d.trust.toFixed(2)}, ${yTitle.toLowerCase()} ${d[yField].toFixed(2)}, n=${d.n}`).on('mouseenter focus', (event, d) => tip.style('opacity', 1).html(`<strong>${d.name}</strong><br>Trust: ${d.trust.toFixed(2)}<br>${yTitle}: ${d[yField].toFixed(2)}<br>n=${d.n.toLocaleString()}`).style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 8}px`)).on('mouseleave blur', () => tip.style('opacity', 0));
    svg.selectAll('text.country-label').data(rows).join('text').attr('class', 'country-label').attr('x', (d, i) => x(d.trust) + (i % 2 ? 9 : -9)).attr('y', (d, i) => y(d[yField]) + (i % 3 - 1) * 13).attr('text-anchor', (d, i) => i % 2 ? 'start' : 'end').attr('font-size', 12).attr('fill', (d) => mode === 'trust-safety' && d.name === focal.name ? accent : primary).text((d) => d.name);
    const occupied = [];
    svg.selectAll('text.country-label').each(function (d) {
      const label = d3.select(this), labelWidth = this.getComputedTextLength();
      const px = x(d.trust), py = y(d[yField]);
      const choices = [0, -16, 16, -32, 32, -48, 48].flatMap((dy) => [
        { left: px + 10, top: py + dy - 10 },
        { left: px - 10 - labelWidth, top: py + dy - 10 },
      ]);
      const candidate = choices.find((box) => {
        const right = box.left + labelWidth, bottom = box.top + 13;
        return box.left >= margin.left && right <= width - 8 && box.top >= margin.top - 22 && bottom < height - margin.bottom
          && !occupied.some((other) => box.left < other.right + 3 && right + 3 > other.left && box.top < other.bottom + 2 && bottom + 2 > other.top);
      }) || choices[0];
      occupied.push({ ...candidate, right: candidate.left + labelWidth, bottom: candidate.top + 13 });
      label.attr('x', candidate.left).attr('y', candidate.top + 10).attr('text-anchor', 'start');
    });
    svg.append('text').attr('class', 'story-axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 15).attr('text-anchor', 'middle').attr('font-size', 13).text('Mean trust (1–5)');
    svg.append('text').attr('class', 'story-axis-title').attr('transform', `translate(18,${height / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 13).text(yTitle);
  });
}

export function renderTrustUseScatter(container, data, metrics) { renderCountryScatter(container, countryRows(data, metrics), 'trust-use'); }
export function renderTrustSafetyScatter(container, data, metrics) { renderCountryScatter(container, countryRows(data, metrics), 'trust-safety'); }

export function renderCountryMeasureDots(container, data, metrics) {
  const rows = countryRows(data, metrics).sort((a, b) => d3.descending(a.trust, b.trust));
  const tip = tooltip(container), colors = [token('--accent'), token('--text-secondary'), token('--accent-warm')];
  const values = (row) => [{ key: 'Use', value: row.use, symbol: d3.symbolTriangle }, { key: 'Trust', value: row.trust, symbol: d3.symbolCircle }, { key: 'Safety concern', value: row.safetyConcern, symbol: d3.symbolSquare }];
  responsive(container, (width) => {
    const margin = { top: 56, right: 36, bottom: 58, left: 136 }, height = Math.max(480, rows.length * 31 + margin.top + margin.bottom);
    const x = d3.scaleLinear().domain([1, 5]).range([margin.left, width - margin.right]), y = d3.scaleBand().domain(rows.map((d) => d.name)).range([margin.top, height - margin.bottom]).padding(.32);
    const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('width', width).attr('height', height).attr('role', 'img').attr('aria-label', 'Country comparison of use, trust, and safety concern'); svg.selectAll('*').remove();
    svg.append('g').attr('class', 'story-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append('g').attr('class', 'story-axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickSize(0));
    const marks = rows.flatMap((row) => values(row).map((value, index) => ({ ...row, ...value, index })));
    svg.selectAll('path.measure-dot').data(marks).join('path').attr('class', 'measure-dot').attr('d', (d) => d3.symbol().type(d.symbol).size(86)()).attr('transform', (d) => `translate(${x(d.value)},${y(d.name) + y.bandwidth() / 2})`).attr('fill', (d) => colors[d.index]).attr('tabindex', 0).attr('role', 'graphics-symbol').attr('aria-label', (d) => `${d.name}, ${d.key}: ${d.value.toFixed(2)}, n=${d.n}`).on('mouseenter focus', (event, d) => tip.style('opacity', 1).html(`<strong>${d.name}</strong><br>${d.key}: ${d.value.toFixed(2)} / 5<br>n=${d.n.toLocaleString()}`).style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 8}px`)).on('mouseleave blur', () => tip.style('opacity', 0));
    const legend = svg.append('g').attr('class', 'story-dot-legend').attr('transform', `translate(${margin.left},24)`); ['Use', 'Trust', 'Safety concern'].forEach((label, index) => { const g = legend.append('g').attr('transform', `translate(${index * 160},0)`); g.append('path').attr('d', d3.symbol().type([d3.symbolTriangle, d3.symbolCircle, d3.symbolSquare][index]).size(70)()).attr('fill', colors[index]); g.append('text').attr('x', 12).attr('y', 4).attr('font-size', 12).text(label); });
    svg.append('text').attr('class', 'story-axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 14).attr('text-anchor', 'middle').attr('font-size', 13).text('Mean agreement score (1–5)');
  });
}
