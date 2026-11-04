import * as d3 from 'd3';
import { setText } from '../dom.js';

const dimensions = [
  ['Comfort giving control', 'trust_comfort_giving_control_score'], ['Relaxed during ride', 'trust_relaxed_during_ride_score'],
  ['Trust everyday travel', 'trust_everyday_travel_score'], ['Feel safe using car', 'trust_safe_using_car_score'],
];
export function renderTrustDimensions(container, data, state) {
  const rows = data.filter((row) => (!state.filters.country || row.country_label === state.filters.country) && (!state.filters.ageGroup || row.age_group === state.filters.ageGroup));
  const summary = dimensions.map(([label, field]) => ({ label, mean: d3.mean(rows.filter((d) => d[field] !== null), (d) => d[field]) }));
  const width = Math.max(320, container.clientWidth || 700), height = 260, margin = { top: 24, right: 25, bottom: 72, left: 44 };
  const x = d3.scaleBand().domain(summary.map((d) => d.label)).range([margin.left, width - margin.right]).padding(.25), y = d3.scaleLinear().domain([1, 5]).range([height - margin.bottom, margin.top]);
  const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Draft comparison of trust dimensions');
  svg.selectAll('*').remove(); svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x)).selectAll('text').attr('transform', 'rotate(-18)').style('text-anchor', 'end'); svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.append('g').selectAll('rect').data(summary).join('rect').attr('x', (d) => x(d.label)).attr('y', (d) => y(d.mean)).attr('width', x.bandwidth()).attr('height', (d) => y(1) - y(d.mean)).attr('fill', (d, index) => index === 0 ? '#7ee7e0' : '#52616a');
  return setText('.chart-meta', 'Phase 1 draft - values respond to active filters.', container.closest('.chart-shell'));
}
export function updateTrustDimensions(...args) { renderTrustDimensions(...args); }
