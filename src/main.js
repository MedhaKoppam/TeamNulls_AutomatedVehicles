import './styles/main.css';
import './styles/willingness.css';
import './styles/countryBump.css';
import * as d3 from 'd3';
import { loadData, loadMapData, loadRespondents } from './data.js';
import { requireElement } from './dom.js';
import { getState, setSelectedCountry, setSelectedMetric, subscribe } from './state.js';
import { renderCountryDrilldown } from './charts/countryDrilldown.js';
import { renderCommercialGap } from './charts/commercialGap.js';
import { getStoryboardStats } from './charts/storyboardCharts.js';
import { renderWillingnessCars } from './charts/willingnessCars.js';
import { renderCountryBump } from './charts/countryBump.js';
import { sceneMarkup } from './scene/markup.js';
import { Road } from './scene/road.js';
import { Cockpit } from './scene/cockpit.js';

const app = requireElement('#app');
const team = 'Medha Koppam, Akhila Gadamsetty, Vishruth Shoba Balaji, Kruthi Shetty, Dipthi Dinesh';

function chartStep(id, number, nav, title, copy, howto, chartTitle) {
  return `<section class="step chart-step" id="${id}" data-nav="${nav}" aria-labelledby="${id}-title">
    <article class="screen screen-left"><p class="kicker">Finding ${number} <span>/ 04</span></p><h2 id="${id}-title">${title}</h2><p>${copy}</p><p class="howto">${howto}</p></article>
    <div class="screen screen-right chart-shell"><div class="screen-head"><h3>${chartTitle}</h3><span class="data-badge">L3Pilot survey</span></div><div class="chart-scroll" tabindex="0" role="region" aria-label="${chartTitle}. Scroll within this panel for the full chart."><div class="chart-meta"></div><div class="chart" id="${id}-chart"></div></div><div class="screen-foot"><span>Real survey data · 17 countries</span><span>Scroll panel to explore ↓</span></div></div>
  </section>`;
}

function willingnessIntroStep(stats) {
  const roundedAgree = Math.round(stats.agree);
  const roundedNeutral = Math.round(stats.neutral);
  const exact = (item) => item.share.toFixed(1);
  const neutral = stats.distribution[2];
  const agree = stats.distribution[3];
  const stronglyAgree = stats.distribution[4];
  return `<section class="step chart-step willingness-intro-step" id="willingness-intro" data-nav="Willingness" aria-labelledby="willingness-intro-title">
    <article class="screen screen-left"><p class="kicker">Finding 01 <span>/ 04</span></p><h2 id="willingness-intro-title">${roundedAgree}% would use a self-driving car, and ${roundedNeutral}% are neutral</h2>
      <p>Among ${stats.n.toLocaleString()} valid responses, <strong>${exact(agree)}% agree</strong> and <strong>${exact(stronglyAgree)}% strongly agree</strong> that they would use a self-driving car in the future. Another ${exact(neutral)}% are neutral, while ${stats.disagree.toFixed(1)}% disagree.</p>
      <p class="howto">Hover over a seat or a legend item to highlight one response group. Each car represents four seats.</p>
    </article>
    <div class="screen screen-right chart-shell willingness-shell">
      <div class="screen-head"><h3>Every 100 respondents, seated in 25 cars</h3><span class="data-badge">L3Pilot survey</span></div>
      <div class="chart-scroll willingness-scroll" tabindex="0" role="region" aria-label="A 100-seat illustration of the five-point willingness-to-use response distribution. Hover or focus a legend item to highlight its category."><div class="chart-meta"></div><div class="chart willingness-car-chart" id="willingness-intro-chart"></div></div>
      <div class="screen-foot"><span>${stats.n.toLocaleString()} valid responses · five-point agreement scale</span><span>100-seat illustration, rounded</span></div>
    </div>
  </section>`;
}

function countryBumpStep() {
  return `<section class="step chart-step bump-step" id="country-rank-insights" data-nav="Country ranks" aria-labelledby="country-bump-title">
    <article class="screen screen-left">
      <p class="kicker">Finding 04 <span>/ 04</span></p>
      <h2 id="country-bump-title">Trust and safety shape AV acceptance differently across countries</h2>
<p>Each line follows one country across three rankings. Rank 1 is the most positive score. Safety confidence is reverse-scored from concerns about safety, system failures and taking back control, so a higher score means fewer concerns.</p>
<p class="callout">Across the 17 country averages, trust aligns more closely with willingness to use, while safety concerns show a weaker association with stated intention to use. This suggests that trust and safety shape AV acceptance differently across countries. This is a descriptive country-level pattern, not evidence that either measure causes acceptance.</p>
<div class="bump-howto">
        <strong>How to explore</strong>
        <ol>
          <li>Drag <strong>up or down</strong> on a vertical rank axis to select a range. No left-to-right selection is needed.</li>
          <li>When you release, the next screen opens with insights for <strong>all countries</strong> in that rank range.</li>
          <li>A brush on a different axis replaces the previous selection; it does not narrow or intersect with it.</li>
          <li>Use “Back to rankings” to choose another axis, or “Clear vertical brushes” to reset.</li>
        </ol>
      </div>
    </article>
    <div class="screen screen-right chart-shell bump-screen">
      <div class="screen-head"><h3>How country rankings shift across the three measures</h3><span class="data-badge">17 countries · 1–5 scale</span></div>
      <div class="chart-scroll bump-scroll" tabindex="0" role="region" aria-label="Interactive country bump chart. Drag vertically on one rank axis. Releasing automatically opens insights for every country in that rank range. A new axis selection replaces the previous selection.">
        <div class="bump-explorer" id="country-bump-explorer">
          <div class="bump-rank-view" id="bump-rank-view">
            <div class="bump-chart-note"><span>Brush one axis vertically; release to open the selected-country insights</span><span>Rank 1 = highest / most positive</span></div>
            <div class="chart bump-chart-host" id="bump-chart-svg"></div>
            <div class="bump-correlation-strip" aria-label="Country-level rank correlations">
              <span>Trust ↔ safety confidence <strong id="bump-trust-safety-rho">ρ = ...</strong></span>
              <span>Trust ↔ willingness <strong id="bump-trust-use-rho">ρ = ...</strong></span>
              <span class="bump-correlation-note">Spearman rank correlation · 17 country averages</span>
            </div>
            <div class="bump-selection-toolbar">
              <p id="bump-selection-copy" class="bump-selection-copy">Drag vertically on one rank axis. Releasing opens insights for every country in that rank range.</p>
              <div class="bump-selection-actions">
                <span id="bump-selection-status" class="bump-selection-status">No rank range selected</span>
                <button class="bump-clear" type="button">Clear vertical brushes</button>
              </div>
            </div>
          </div>
          <section class="bump-insights" id="bump-insights" aria-labelledby="bump-insights-title" hidden>
            <div class="bump-insights-header">
              <div><p class="bump-section-kicker">FURTHER COUNTRY INSIGHTS</p><h4 id="bump-insights-title">Further insights</h4><p id="bump-insights-copy" class="bump-selection-copy"></p></div>
              <button class="bump-back" id="bump-back-to-ranks" type="button">← Back to rankings</button>
            </div>
            <div class="bump-insight-grid">
              <article class="bump-insight-card">
                <div class="bump-insight-card-heading"><h5>Perceived enjoyment</h5><p>Mean agreement with fun, entertaining and enjoyable statements.</p></div>
                <div id="bump-enjoyment-chart" class="bump-mini-chart"></div>
                <div class="bump-group-legend"><span><i class="selected-dot"></i><span id="bump-focused-legend">Focus countries</span></span><span><i class="others-dot"></i><span id="bump-comparison-legend">Other countries</span></span></div>
              </article>
              <article class="bump-insight-card">
                <div class="bump-insight-card-heading"><h5>Social influence</h5><p>How respondents view the opinions and expectations of people around them.</p></div>
                <div id="bump-social-chart" class="bump-mini-chart"></div>
                <div class="bump-likert-legend" aria-label="Strongly disagree, disagree, neutral, agree, strongly agree">
                  ${['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map((label, index) => `<span title="${label}"><i style="--response-color:${['#9d5662', '#e66767', '#c9c8c2', '#3d8de7', '#32ad9b'][index]}"></i>${label}</span>`).join('')}
                </div>
              </article>
            </div>
            <p class="bump-method-note">Insight charts compare country-level response distributions, with each country weighted equally. Blank and “I prefer not to respond” answers are excluded.</p>
          </section>
        </div>
      </div>
      <div class="screen-foot"><span>Source: L3Pilot Global User Acceptance Survey</span><span>Brush vertically to open group insights ↓</span></div>
    </div>
  </section>`;
}

function buildPage(stats, total) {
  app.innerHTML = `${sceneMarkup}<main id="story">
    <section class="step step-hero" data-nav="Start" aria-labelledby="page-title"><div class="hero"><p class="hero-course">CS 6730 Data Visualization &nbsp;|&nbsp; Team Nulls</p><p class="hero-team">${team}</p><h1 id="page-title">Would you get in?</h1><p class="hero-sub">How trust and safety shape acceptance of autonomous vehicles across 17 countries.</p><button class="start-cue" type="button" data-goto="1">Scroll to start the drive <span aria-hidden="true">↓</span></button></div></section>
    <section class="step step-intro" data-nav="Intro" aria-label="Introduction"><div class="hud"><p>Designing a self-driving car means designing for how people feel about it: whether they trust it, whether they feel safe in it, and whether those feelings hold from one market to the next. We looked at <strong>${total.toLocaleString()} survey responses from 17 countries</strong> to see where they line up and where they don't.</p></div></section>
    ${willingnessIntroStep(stats)}
    ${chartStep('country-trust', '02', 'By country', 'Compare country profiles', 'Acceptance looks different around the world. Choose a measure to compare the 17 surveyed countries, then explore the age, behavior, and readiness profile behind each country average.', 'Choose one of seven measures. Select a country on the map or in the ranking to open its profile. Use World map or Escape to return.', 'Global patterns and country profiles')}
    ${chartStep('commercial-gap', '03', 'Use vs buy', 'People may use it before they buy it', 'Use and purchase are not the same decision. Compare each country’s average intention to use and to buy. Filter by age and income to see how the commercial gap changes.', 'Use the age and income filters together. Hover or focus a dot for its sample size and use-to-buy gap. Reset to compare all respondents.', 'Intention to use vs. intention to buy')}
    ${countryBumpStep()}
    <section class="step" data-nav="Takeaways" aria-labelledby="takeaways-title"><article class="screen screen-left"><p class="kicker">Destination</p><h2 id="takeaways-title">What should AV teams remember?</h2><p>Trust, safety confidence, readiness and ownership are related, but they are not interchangeable.</p><p class="howto">Use the dashboard route to revisit any finding.</p></article><div class="screen screen-right"><ol class="takeaways"><li><div><strong>Start with trust.</strong> Countries with higher average trust also report higher willingness to use.</div></li><li><div><strong>Separate trust from safety confidence.</strong> The country rankings diverge, so strong trust should not be treated as evidence of low safety concern.</div></li><li><div><strong>Look beyond a global average.</strong> Country profiles reveal differences by age, secondary activities, and awareness.</div></li><li><div><strong>Separate use from ownership.</strong> Explore how the use-to-buy gap changes with age and income.</div></li></ol></div></section>
    <section class="step step-last" data-nav="Data" aria-labelledby="methods-title"><article class="screen screen-left"><p class="kicker">Parked</p><h2 id="methods-title">Data and methods</h2><p><strong>Source:</strong> L3Pilot Global User Acceptance Survey, Phase 1. ${total.toLocaleString()} responses from 17 countries.</p><p>Likert-based measures use the original five-point agreement scale. Prior awareness and L3 capability knowledge are percentages. Blank values and non-scale code 6 are excluded from Likert averages.</p><p>The source does not name motorway, urban, or traffic-jam conditions, so these charts do not assign driving-context labels.</p></article><div class="screen screen-right methods-screen"><div class="links"><a class="link-card" href="/data/l3pilot_clean.json" download>Cleaned survey data<span>JSON ↓</span></a><a class="link-card" href="/data/country_metrics.json" download>Country metrics<span>JSON ↓</span></a><a class="link-card" href="/data/respondents.json" download>Respondent extract<span>JSON ↓</span></a><a class="link-card" href="/docs/DATA_DICTIONARY.md">Data dictionary<span>Read ↗</span></a><a class="link-card" href="/docs/PROCESS_BOOK.md">Process book<span>Read ↗</span></a><a class="link-card" href="/data/l3pilot_labeled.xlsx" download>Raw workbook<span>XLSX ↓</span></a></div><p class="credits">Team Nulls · ${team}.<br>CS 6730 Data Visualization. Built with D3.js. Map: Natural Earth.</p><button class="start-cue small" type="button" data-goto="0">Back to the start ↑</button></div></section>
  </main><nav class="mobile-route" aria-label="Story navigation"><button type="button" data-previous aria-label="Previous chapter">← Previous</button><span class="mobile-chapter">Start</span><button type="button" data-next aria-label="Next chapter">Next →</button></nav>`;
}

function renderMapSummary(container, mapData, state) {
  const source = mapData.metrics;
  const metric = source.metrics.find((item) => item.key === state.selectedMetric) ?? source.metrics[0];
  const countries = Object.values(source.countries).filter((country) => Number.isFinite(country.metrics[metric.key]));
  const highest = d3.greatest(countries, (country) => country.metrics[metric.key]);
  const lowest = d3.least(countries, (country) => country.metrics[metric.key]);
  const sidePane = container.querySelector('.world-side-pane');
  if (!sidePane || !countries.length) return;

  // source.global[metric.key] is calculated from valid respondent-level answers
  // during data preparation. Re-read it for each selected criterion. The
  // displayed color range is then derived from that criterion's country gaps.
  const average = source.global[metric.key];
  const maxDeviation = Math.max(
    0.0001,
    d3.max(countries, (country) => Math.abs(country.metrics[metric.key] - average)) || 0
  );
  const isPercent = metric.unit === 'percent';
  const valueLabel = (value) => isPercent ? `${value.toFixed(1)}%` : `${value.toFixed(2)} / 5`;
  const deviationUnit = isPercent ? 'percentage points' : 'scale points';

  let legend = sidePane.querySelector('.map-color-legend');
  if (!legend) {
    legend = document.createElement('section');
    legend.className = 'map-color-legend';
    legend.setAttribute('aria-label', 'Difference from the selected metric global mean');
    sidePane.append(legend);
  }
  legend.innerHTML = `<h4>Difference from global mean</h4>
    <div class="map-color-bar" role="img" aria-label="Red means below the global mean, cream means at the mean, and teal means above the global mean. The scale is symmetric around zero."><span class="map-color-average-marker"></span></div>
    <div class="map-color-labels"><span>−${maxDeviation.toFixed(2)}</span><span>0</span><span>+${maxDeviation.toFixed(2)}</span></div>
    <p>Red: below · Cream: at · Teal: above. Global mean: ${valueLabel(average)}. Range: ±${maxDeviation.toFixed(2)} ${deviationUnit}.</p>`;
  legend.querySelector('.map-color-bar').style.background =
    'linear-gradient(90deg, #d95f59 0%, #f0d58a 50%, #278c78 100%)';
  legend.querySelector('.map-color-average-marker').style.left = '50%';

  let summary = sidePane.querySelector('.global-summary');
  if (!summary) {
    summary = document.createElement('section');
    summary.className = 'global-summary';
    summary.setAttribute('aria-label', 'Selected metric summary');
    sidePane.append(summary);
  }
  summary.innerHTML = `<div><span class="micro-label">Global average</span><strong>${valueLabel(average)}</strong><span>${metric.label}</span></div><div><span class="micro-label">Highest</span><strong>${highest.name}</strong><span>${valueLabel(highest.metrics[metric.key])}</span></div><div><span class="micro-label">Lowest</span><strong>${lowest.name}</strong><span>${valueLabel(lowest.metrics[metric.key])}</span></div>`;
}

async function initialize() {
  const [data, mapData, respondents, countryInsights] = await Promise.all([
    loadData(), loadMapData(), loadRespondents(),
    fetch('/data/country-insights.json').then((response) => {
      if (!response.ok) throw new Error(`Could not load country insights (${response.status}).`);
      return response.json();
    }),
  ]);
  const stats = getStoryboardStats(data);
  buildPage(stats, data.length);
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('layoutHarness') === '1') {
    const { initLayoutHarness } = await import('./dev/layoutHarness.js');
    initLayoutHarness();
  }
  renderWillingnessCars(requireElement('#willingness-intro-chart'), stats);
  const map = requireElement('#country-trust-chart');
  map.closest('.chart-scroll')?.classList.add('map-chart-scroll');
  const actions = { setMetric: setSelectedMetric, setCountry: setSelectedCountry };
  let brushedCountries = new Set();
  let hoveredBumpCountry = null;
  const syncBumpHighlightsToMap = () => {
    map.querySelectorAll('.country[data-country]').forEach((path) => {
      path.classList.toggle('brush-match', brushedCountries.has(path.dataset.country));
      path.classList.toggle('hovered', path.dataset.country === hoveredBumpCountry);
    });
  };
  const updateMap = (state) => {
    renderCountryDrilldown(map, mapData, state, actions);
    renderMapSummary(map, mapData, state);
    syncBumpHighlightsToMap();
  };
  subscribe(updateMap);
  updateMap(getState());
  renderCommercialGap(requireElement('#commercial-gap-chart'), respondents);
  renderCountryBump(requireElement('#country-bump-explorer'), mapData.metrics, countryInsights, {
    onCountryHover: (iso3) => { hoveredBumpCountry = iso3; syncBumpHighlightsToMap(); },
    onBrushSelection: (iso3s) => { brushedCountries = new Set(iso3s); syncBumpHighlightsToMap(); },
  });
  const steps = [...document.querySelectorAll('.step')];
  const road = new Road(requireElement('#road'));
  const cockpit = new Cockpit({
    steps, road, onStepChange(index) {
      document.querySelector('.mobile-chapter').textContent = steps[index].dataset.nav;
      document.querySelector('[data-previous]').disabled = index === 0;
      document.querySelector('[data-next]').disabled = index === steps.length - 1;
    }
  });
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
