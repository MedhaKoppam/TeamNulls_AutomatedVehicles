import * as d3 from 'd3';
import { setText } from '../dom.js';

export function renderAgeTrust(container, data, state, onAgeClick) {
  const rows = data.filter((row) => row.trust_composite_score !== null && (!state.filters.country || row.country_label === state.filters.country));
  const summary = d3.rollups(rows, (group) => d3.mean(group, (d) => d.trust_composite_score), (d) => d.age_group)
    .map(([age, mean]) => ({ age, mean })).filter((d) => d.age !== 'Missing').sort((a, b) => d3.ascending(a.age, b.age));
  const width = Math.max(320, container.clientWidth || 700), height = 280, margin = { top: 20, right: 20, bottom: 48, left: 46 };
  const x = d3.scaleBand().domain(summary.map((d) => d.age)).range([margin.left, width - margin.right]).padding(.24);
  const y = d3.scaleLinear().domain([1, 5]).range([height - margin.bottom, margin.top]);
  const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Average trust by age group');
  svg.selectAll('*').remove();
  svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x));
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.append('g').selectAll('rect').data(summary).join('rect').attr('x', (d) => x(d.age)).attr('y', (d) => y(d.mean)).attr('width', x.bandwidth()).attr('height', (d) => y(1) - y(d.mean)).attr('rx', 4)
    .attr('fill', (d) => state.filters.ageGroup === d.age ? '#7ee7e0' : '#52616a').attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.age}, trust ${d.mean.toFixed(2)}. Click to filter.`)
    .on('click keydown', (event, d) => { if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAgeClick(d.age); } });
  svg.append('text').attr('x', margin.left).attr('y', 14).attr('class', 'axis-label').text('Mean trust score');
  return setText('.chart-meta', 'Click an age group to filter the country view.', container.closest('.chart-shell'));
}

export function updateAgeTrust(...args) { renderAgeTrust(...args); }
