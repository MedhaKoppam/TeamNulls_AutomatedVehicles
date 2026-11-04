import * as d3 from 'd3';
import { feature } from 'topojson-client';

const fmt = d3.format('.1f');
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function renderMetricControls(container, source, state, actions, { showRanking = true } = {}) {
  const metric = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0];
  const controls = d3.select(container).selectAll('.map-controls').data([null]).join('div').attr('class', 'map-controls');
  controls.html('');
  const selector = controls.append('label').attr('class', 'metric-selector');
  selector.append('span').attr('class', 'metric-select-label').text('Map metric');
  selector.append('select').attr('class', 'metric-select').attr('aria-label', 'Choose map metric')
    .selectAll('option').data(source.metrics).join('option')
    .attr('value', (d) => d.key).property('selected', (d) => d.key === metric.key).text((d) => d.label);
  selector.select('select').on('change', function change() { actions.setMetric(this.value); });
  controls.append('p').attr('class', 'metric-description').text(metric.description);
  if (!showRanking) {
    d3.select(container).selectAll('.ranking-strip').remove();
    return;
  }
}

export function renderChoropleth(container, mapData, state, actions) {
  container.__mapRender = () => renderChoropleth(container, mapData, state, actions);
  if (!container.__mapResizeObserver) {
    let timer;
    container.__mapResizeObserver = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => container.__mapRender?.(), 100); });
    container.__mapResizeObserver.observe(container);
    const scroll = container.closest('.chart-scroll');
    if (scroll) container.__mapResizeObserver.observe(scroll);
  }
  const { metrics: source, geometry } = mapData;
  const metric = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0];
  const countries = Object.entries(source.countries).map(([id, country]) => ({ id, ...country }));
  const values = countries.map((country) => country.metrics[metric.key]).filter(Number.isFinite);
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
    : () => '#f0d58a';
  const countryById = new Map(countries.map((d) => [d.id, d]));
  const features = feature(geometry, geometry.objects.countries).features;
  // Use the map pane's full available space now that the color legend lives
  // in the adjacent summary rail. Keep the geographic aspect ratio intact.
  const width = Math.max(220, Math.floor(container.clientWidth || 900));
  const availableHeight = Math.floor(container.clientHeight || container.closest('.chart-scroll')?.clientHeight || 440);
  const mapHeight = Math.max(150, Math.min(availableHeight, width * (520 / 900)));
  const height = mapHeight;
  const projection = d3.geoNaturalEarth1().fitSize([width, mapHeight], { type: 'FeatureCollection', features });
  const path = d3.geoPath(projection);

  const svg = d3.select(container).selectAll('svg.choropleth-svg').data([null]).join('svg')
    .attr('class', 'choropleth-svg').attr('width', width).attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img').attr('aria-label', `${metric.label} by country`);
  svg.selectAll('*').remove();
  const defs = svg.append('defs');
  const hatch = defs.append('pattern').attr('id', 'no-data-hatch').attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
  hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#28323c'); hatch.append('line').attr('x1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#3d4a57').attr('stroke-width', 2);
  const viewport = svg.append('g').attr('class', 'map-viewport');
  const fillFor = (d) => { const c = countryById.get(String(d.id).padStart(3, '0')); return c && Number.isFinite(c.metrics[metric.key]) ? color(c.metrics[metric.key]) : 'url(#no-data-hatch)'; };
  const paths = viewport.selectAll('path.country').data(features).join('path').attr('class', 'country').attr('d', path).attr('fill', '#28323c')
    .attr('stroke-dasharray', (d) => countryById.get(String(d.id).padStart(3, '0'))?.lowSample ? '4 3' : null)
    .classed('selected', (d) => countryById.get(String(d.id).padStart(3, '0'))?.iso3 === state.selectedCountry)
    .classed('hovered', (d) => countryById.get(String(d.id).padStart(3, '0'))?.iso3 === state.hoveredCountry);
  paths.transition().duration(prefersReducedMotion() ? 0 : 500).attr('fill', fillFor);
  const dataPaths = paths.filter((d) => countryById.has(String(d.id).padStart(3, '0'))).attr('tabindex', 0).attr('role', 'button')
    .attr('data-country', (d) => countryById.get(String(d.id).padStart(3, '0')).iso3)
    .attr('aria-label', (d) => { const c = countryById.get(String(d.id).padStart(3, '0')); return `${c.name}, ${metric.label}: ${fmt(c.metrics[metric.key])} of 100. ${c.n} respondents.`; })
    .on('mouseenter focus', function enter() { d3.select(this).classed('hovered', true); })
    .on('mouseleave blur', function leave() { d3.select(this).classed('hovered', false); })
    .on('click keydown', (event, d) => { if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const c = countryById.get(String(d.id).padStart(3, '0')); actions.setCountry(state.selectedCountry === c.iso3 ? null : c.iso3); } });
  svg.on('keydown', (event) => { if (event.key === 'Escape') actions.setCountry(null); });



  const strip = d3.select(container).selectAll('.ranking-strip').data([null]).join('div').attr('class', 'ranking-strip'); strip.html(`<h3>${metric.label} ranking</h3>`);
  const sorted = countries.filter((d) => Number.isFinite(d.metrics[metric.key])).sort((a, b) => d3.descending(a.metrics[metric.key], b.metrics[metric.key]));
  const rWidth = Math.max(320, Math.floor(container.clientWidth || 720)), rHeight = Math.max(260, sorted.length * 25 + 38), margin = { top: 8, right: 40, bottom: 8, left: 164 };
  const rsvg = strip.append('svg').attr('width', rWidth).attr('height', rHeight).attr('aria-label', `Ranking of countries by ${metric.label}`), x = d3.scaleLinear().domain([0, max]).range([margin.left, rWidth - margin.right]), y = d3.scaleBand().domain(sorted.map((d) => d.iso3)).range([margin.top, rHeight - margin.bottom]).padding(.24);
  rsvg.selectAll('text.name').data(sorted).join('text').attr('class', 'rank-name').attr('x', margin.left - 8).attr('y', (d) => y(d.iso3) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text((d) => d.name);
  rsvg.selectAll('rect').data(sorted).join('rect').attr('class', (d) => `rank-bar${d.iso3 === state.selectedCountry ? ' selected' : ''}`).attr('x', margin.left).attr('y', (d) => y(d.iso3)).attr('height', y.bandwidth()).attr('width', (d) => x(d.metrics[metric.key]) - margin.left).attr('fill', (d) => color(d.metrics[metric.key]))
    .attr('tabindex', 0).attr('role', 'button').attr('aria-label', (d) => `${d.name}: ${fmt(d.metrics[metric.key])} / 100. Open country profile.`)
    .on('click keydown', (event, d) => {
      if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); actions.setCountry(state.selectedCountry === d.iso3 ? null : d.iso3);
      }
    });
}
