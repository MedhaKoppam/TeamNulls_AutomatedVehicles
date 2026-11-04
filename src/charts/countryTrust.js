import * as d3 from 'd3';
import { setText } from '../dom.js';

const palette = { low: '#46535c', high: '#7ee7e0' };

function filtered(data, state) {
  return data.filter((row) => row.trust_composite_score !== null
    && (!state.filters.ageGroup || row.age_group === state.filters.ageGroup)
    && (!state.filters.country || row.country_label === state.filters.country));
}

export function renderCountryTrust(container, data, state, onCountryClick) {
  const rows = filtered(data, state);
  const summary = d3.rollups(rows, (group) => ({ mean: d3.mean(group, (d) => d.trust_composite_score), n: group.length }), (d) => d.country_label)
    .map(([country, values]) => ({ country, ...values })).sort((a, b) => d3.descending(a.mean, b.mean));
  const width = Math.max(320, container.clientWidth || 700);
  const margin = { top: 20, right: 52, bottom: 36, left: 125 };
  const height = Math.max(300, summary.length * 28 + margin.top + margin.bottom);
  const x = d3.scaleLinear().domain([1, 5]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(summary.map((d) => d.country)).range([margin.top, height - margin.bottom]).padding(.38);
  const color = d3.scaleLinear().domain([1, 5]).range([palette.low, palette.high]);
  const tooltip = d3.select(container).selectAll('.tooltip').data([null]).join('div').attr('class', 'tooltip').style('opacity', 0);
  const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Average trust score by country code');
  svg.selectAll('*').remove();
  svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5)).call((g) => g.select('.domain').remove());
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickSize(0)).call((g) => g.select('.domain').remove());
  svg.append('text').attr('x', margin.left).attr('y', height - 6).attr('class', 'axis-label').text('Mean trust score (1 = strongly disagree, 5 = strongly agree)');
  svg.append('g').selectAll('line').data(summary).join('line').attr('x1', x(1)).attr('x2', x(5)).attr('y1', (d) => y(d.country) + y.bandwidth() / 2).attr('y2', (d) => y(d.country) + y.bandwidth() / 2).attr('stroke', '#53616a');
  svg.append('g').selectAll('circle').data(summary).join('circle').attr('cx', (d) => x(d.mean)).attr('cy', (d) => y(d.country) + y.bandwidth() / 2).attr('r', 7).attr('fill', (d) => color(d.mean)).attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.country}: average trust ${d.mean.toFixed(2)}, ${d.n} responses. Click to filter.`)
    .on('mouseenter focus', (event, d) => tooltip.style('opacity', 1).html(`<strong>${d.country}</strong><br>Mean trust: ${d.mean.toFixed(2)} / 5<br>Responses: ${d.n.toLocaleString()}`))
    .on('mousemove', (event) => tooltip.style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 12}px`))
    .on('mouseleave blur', () => tooltip.style('opacity', 0))
    .on('click keydown', (event, d) => { if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCountryClick(d.country); } });
  return setText('.chart-meta', `${rows.length.toLocaleString()} responses shown`, container.closest('.chart-shell'));
}

export function updateCountryTrust(...args) { renderCountryTrust(...args); }
