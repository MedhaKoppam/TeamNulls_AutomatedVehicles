import './styles/main.css';
import * as d3 from 'd3';
import { loadData, loadMapData, loadRespondents } from './data.js';
import { requireElement } from './dom.js';
import { getState, setSelectedCountry, setSelectedMetric, subscribe } from './state.js';
import { renderCountryDrilldown } from './charts/countryDrilldown.js';
import { renderCommercialGap } from './charts/commercialGap.js';
import { getStoryboardStats, renderCountryMeasureDots, renderTrustSafetyScatter, renderTrustUseScatter, renderWillingnessDistribution } from './charts/storyboardCharts.js';
import { sceneMarkup } from './scene/markup.js';
import { Road } from './scene/road.js';
import { Cockpit } from './scene/cockpit.js';

const app = requireElement('#app');
const team = 'Medha Koppam, Akhila Gadamsetty, Vishruth Shoba Balaji, Kruthi Shetty, Dipthi Dinesh';

function chartStep(id, number, nav, title, copy, howto, chartTitle) {
  return `<section class="step chart-step" id="${id}" data-nav="${nav}" aria-labelledby="${id}-title">
    <article class="screen screen-left"><p class="kicker">Finding ${number} <span>/ 06</span></p><h2 id="${id}-title">${title}</h2><p>${copy}</p><p class="howto">${howto}</p></article>
    <div class="screen screen-right chart-shell"><div class="screen-head"><h3>${chartTitle}</h3><span class="data-badge">L3Pilot survey</span></div><div class="chart-scroll" tabindex="0" role="region" aria-label="${chartTitle}. Scroll within this panel for the full chart."><div class="chart-meta"></div><div class="chart" id="${id}-chart"></div></div><div class="screen-foot"><span>Real survey data · 17 countries</span><span>Scroll panel to explore ↓</span></div></div>
  </section>`;
}

function buildPage(stats, total) {
  const pct = (v) => `${v.toFixed(1)}%`;
  app.innerHTML = `${sceneMarkup}<main id="story">
    <section class="step step-hero" data-nav="Start" aria-labelledby="page-title"><div class="hero"><p class="hero-course">CS 6730 Data Visualization &nbsp;|&nbsp; Team Nulls</p><p class="hero-team">${team}</p><h1 id="page-title">Would you get in?</h1><p class="hero-sub">How trust and safety shape acceptance of autonomous vehicles across 17 countries.</p><button class="start-cue" type="button" data-goto="1">Scroll to start the drive <span aria-hidden="true">↓</span></button></div></section>
    <section class="step step-intro" data-nav="Intro" aria-label="Introduction"><div class="hud"><p>Designing a self-driving car means designing for how people feel about it: whether they trust it, whether they feel safe in it, and whether those feelings hold from one market to the next. We looked at <strong>${total.toLocaleString()} survey responses from 17 countries</strong> to see where they line up and where they don't.</p></div></section>
    ${chartStep('country-trust', '01', 'By country', 'Compare country profiles', 'Acceptance looks different around the world. Choose a measure to compare the 17 surveyed countries, then explore the age, behavior, and readiness profile behind each country average.', 'Choose one of seven measures. Select a country on the map or in the ranking to open its profile. Use World map or Escape to return.', 'Global patterns and country profiles')}
    ${chartStep('commercial-gap', '02', 'Use vs buy', 'People may use it before they buy it', 'Use and purchase are not the same decision. Compare each country’s average intention to use and to buy. Filter by age and income to see how the commercial gap changes.', 'Use the age and income filters together. Hover or focus a dot for its sample size and use-to-buy gap. Reset to compare all respondents.', 'Intention to use vs. intention to buy')}
    ${chartStep('would-get-in', '03', 'Willingness', 'Would you get in?', `Of ${stats.n.toLocaleString()} valid responses, <strong>${pct(stats.agree)} agree</strong>, ${pct(stats.neutral)} are neutral, and ${pct(stats.disagree)} disagree. The neutral group may still be open to change.`, 'Hover or focus a segment to see the exact percentage for each response on the five-point agreement scale.', 'Willingness to use a self-driving car')}
    ${chartStep('trust-use', '04', 'Trust', 'Several factors shape willingness', `Countries with higher average trust also report higher average willingness to use. These measures move together closely (<strong>r = ${stats.correlation.toFixed(3)}</strong>). The line shows a pattern, not cause and effect.`, 'Hover or focus a country dot for its mean trust, willingness, and sample size.', 'Mean trust vs. willingness, per country')}
    ${chartStep('trust-safety', '05', 'Safety', 'Trust and safety are different', `<strong>${stats.highestUse.name}</strong> has the highest mean willingness to use (${stats.highestUse.use.toFixed(2)} / 5). It is highlighted here. Safety concern uses the reverse of the map’s safety-confidence measure.`, 'Use the dotted average guides to compare country positions. Hover or focus a dot for details.', 'Mean trust vs. safety concern')}
    ${chartStep('country-measures', '06', 'Compare', 'Willingness has several parts', 'Compare intended use, trust, and safety concern on the same five-point scale. Each symbol represents a different measure, so the comparison remains readable without relying on color alone.', 'Read across each country row. Hover or focus any symbol for its exact score and sample size.', 'Three measures, seventeen countries')}
    <section class="step" data-nav="Takeaways" aria-labelledby="takeaways-title"><article class="screen screen-left"><p class="kicker">Destination</p><h2 id="takeaways-title">What should AV teams remember?</h2><p>Trust, readiness, and ownership are related. They are not interchangeable.</p><p class="howto">Use the dashboard route to revisit any finding.</p></article><div class="screen screen-right"><ol class="takeaways"><li><div><strong>Start with trust.</strong> Countries with higher average trust also report higher willingness to use.</div></li><li><div><strong>Treat safety as its own workstream.</strong> Compare safety concern alongside trust instead of treating them as the same measure.</div></li><li><div><strong>Look beyond a global average.</strong> Country profiles reveal differences by age, secondary activities, and awareness.</div></li><li><div><strong>Separate use from ownership.</strong> Explore how the use-to-buy gap changes with age and income.</div></li></ol></div></section>
    <section class="step step-last" data-nav="Data" aria-labelledby="methods-title"><article class="screen screen-left"><p class="kicker">Parked</p><h2 id="methods-title">Data and methods</h2><p><strong>Source:</strong> L3Pilot Global User Acceptance Survey, Phase 1. ${total.toLocaleString()} responses from 17 countries.</p><p>Attitude questions use a five-point agreement scale. Blank values and non-scale code 6 are excluded from averages. Charts retain their original scoring and valid samples.</p><p>The source does not name motorway, urban, or traffic-jam conditions, so these charts do not assign driving-context labels.</p></article><div class="screen screen-right methods-screen"><div class="links"><a class="link-card" href="/data/l3pilot_clean.json" download>Cleaned survey data<span>JSON ↓</span></a><a class="link-card" href="/data/country_metrics.json" download>Country metrics<span>JSON ↓</span></a><a class="link-card" href="/data/respondents.json" download>Respondent extract<span>JSON ↓</span></a><a class="link-card" href="/docs/DATA_DICTIONARY.md">Data dictionary<span>Read ↗</span></a><a class="link-card" href="/docs/PROCESS_BOOK.md">Process book<span>Read ↗</span></a><a class="link-card" href="/data/l3pilot_labeled.xlsx" download>Raw workbook<span>XLSX ↓</span></a></div><p class="credits">Team Nulls · ${team}.<br>CS 6730 Data Visualization. Built with D3.js. Map: Natural Earth.</p><button class="start-cue small" type="button" data-goto="0">Back to the start ↑</button></div></section>
  </main><nav class="mobile-route" aria-label="Story navigation"><button type="button" data-previous aria-label="Previous chapter">← Previous</button><span class="mobile-chapter">Start</span><button type="button" data-next aria-label="Next chapter">Next →</button></nav>`;
}

function renderMapSummary(container, mapData, state) {
  const metric = mapData.metrics.metrics.find((item) => item.key === state.selectedMetric) ?? mapData.metrics.metrics[0];
  const countries = Object.values(mapData.metrics.countries).filter((country) => Number.isFinite(country.metrics[metric.key]));
  const highest = d3.greatest(countries, (country) => country.metrics[metric.key]);
  const lowest = d3.least(countries, (country) => country.metrics[metric.key]);
  const world = container.querySelector('.world-view');
  let summary = world.querySelector('.global-summary');
  if (!summary) { summary = document.createElement('section'); summary.className = 'global-summary'; summary.setAttribute('aria-label', 'Selected metric summary'); world.prepend(summary); }
  summary.innerHTML = `<div><span class="micro-label">Global average</span><strong>${mapData.metrics.global[metric.key].toFixed(1)}</strong><span>${metric.label}</span></div><div><span class="micro-label">Highest</span><strong>${highest.name}</strong><span>${highest.metrics[metric.key].toFixed(1)} / 100</span></div><div><span class="micro-label">Lowest</span><strong>${lowest.name}</strong><span>${lowest.metrics[metric.key].toFixed(1)} / 100</span></div>`;
}

async function initialize() {
  const [data, mapData, respondents] = await Promise.all([loadData(), loadMapData(), loadRespondents()]);
  buildPage(getStoryboardStats(data, mapData.metrics), data.length);
  const map = requireElement('#country-trust-chart');
  const actions = { setMetric: setSelectedMetric, setCountry: setSelectedCountry };
  const updateMap = (state) => {
    renderCountryDrilldown(map, mapData, state, actions);
    renderMapSummary(map, mapData, state);
    const selected = Object.values(mapData.metrics.countries).find((country) => country.iso3 === state.selectedCountry);
    document.querySelector('.pin-value').textContent = selected?.name || 'None. Select a country';
    document.querySelector('.pin-screen').classList.toggle('has-pin', !!selected);
    document.querySelector('.pin-clear').hidden = !selected;
  };
  subscribe(updateMap);
  updateMap(getState());
  document.querySelector('.pin-clear').addEventListener('click', () => setSelectedCountry(null));
  renderCommercialGap(requireElement('#commercial-gap-chart'), respondents);
  renderWillingnessDistribution(requireElement('#would-get-in-chart'), data);
  renderTrustUseScatter(requireElement('#trust-use-chart'), data, mapData.metrics);
  renderTrustSafetyScatter(requireElement('#trust-safety-chart'), data, mapData.metrics);
  renderCountryMeasureDots(requireElement('#country-measures-chart'), data, mapData.metrics);
  const steps = [...document.querySelectorAll('.step')];
  const road = new Road(requireElement('#road'), requireElement('#mirror'));
  const cockpit = new Cockpit({ steps, road, onStepChange(index) {
    document.querySelector('.mobile-chapter').textContent = steps[index].dataset.nav;
    document.querySelector('[data-previous]').disabled = index === 0;
    document.querySelector('[data-next]').disabled = index === steps.length - 1;
  } });
  document.querySelector('[data-previous]').addEventListener('click', () => cockpit.goTo(cockpit.active - 1));
  document.querySelector('[data-next]').addEventListener('click', () => cockpit.goTo(cockpit.active + 1));
  document.querySelectorAll('[data-goto]').forEach((button) => button.addEventListener('click', () => cockpit.goTo(Number(button.dataset.goto))));
  window.addEventListener('keydown', (event) => {
    // Keep keyboard navigation within filters, chart marks, and scrollable panels.
    if (event.target.closest('button, a, input, select, textarea, .chart-scroll, [tabindex]')) return;
    if (['PageDown', 'ArrowDown'].includes(event.key)) { event.preventDefault(); cockpit.goTo(cockpit.active + 1); }
    if (['PageUp', 'ArrowUp'].includes(event.key)) { event.preventDefault(); cockpit.goTo(cockpit.active - 1); }
  });
}

initialize().catch((error) => { app.innerHTML = '<p class="error" role="alert">Unable to load the visualization. Please refresh and try again.</p>'; console.error(error); });
