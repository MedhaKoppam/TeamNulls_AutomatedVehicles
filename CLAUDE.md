# Codebase map: read before editing

Read this file before changing the project. Start with the lookup table in section 10, then inspect the target module(s) named there before editing. Never hand-edit generated files in `public/data/` or `data/clean/`; regenerate them through the scripts. Never modify `data/raw/l3pilot_labeled.xlsx`. After a change, run `npm run build` and the relevant check (`npm run check:insights` or `npm run check:countries`).

## 1. Stack and tooling

- **Runtime:** Vite static site, native ES modules, vanilla JavaScript. `index.html:12` loads `src/main.js`; there is no React, Vue, Svelte, TypeScript, router, store package, or backend.
- **Visualization:** D3 v7 directly creates SVG/HTML; `topojson-client` converts the checked-in world topology. The road is a Canvas 2D scene (`src/scene/road.js`).
- **Styles:** plain global CSS imported by `src/main.js:1-3`; no CSS modules, Tailwind, or CSS-in-JS.
- **Dependencies:** `d3`, `topojson-client`, `world-atlas`, and `@fontsource-variable/manrope` (the latter is not visibly imported); dev dependencies are `vite` and `xlsx` (`package.json`).
- **Scripts:** `dev` starts Vite; `build` runs `scripts/check-copy.mjs` then `vite build`; `preview` serves `dist`; `data` aliases `data:map`; `data:map` runs `scripts/build-country-metrics.mjs`; `check:insights` runs `scripts/check-insights.mjs`; `check:countries` runs `scripts/check-countries.mjs` (`package.json:5-13`). The README separately instructs `node scripts/convert-data.mjs` first and `npm run data` second.
- There is no `vite.config.*`, no alias configuration, and no `vercel.json` in this checkout. Vite defaults apply.

## 2. Directory tree

```text
repo root
|- index.html                  Vite document and #app mount
|- package.json                commands and dependencies
|- README.md                   run/deploy/data overview
|- AGENTS.md                   repository constraints
|- CLAUDE.md                   this change map
|- apply_1_to_5_fix.py         historical/manual patch helper; not runtime
|- src/
|  |- main.js                  bootstrap, page markup, chapter wiring
|  |- data.js, state.js        static-data fetches and tiny shared state store
|  |- dom.js, insights.js      DOM helpers and rule-based insight logic
|  |- charts/                  one module per chart or retained draft chart
|  |- scene/                   cockpit DOM, road canvas, scroll/cockpit controller
|  |- styles/                  tokens, fonts, cockpit, chart, view-specific CSS
|  |- data/countryMap.js       canonical 17-country workbook/ISO registry
|  `- dev/layoutHarness.js     DEV-only tuning harness enabled by query string
|- public/
|  |- data/                    browser static assets; mostly generated (do not edit)
|  |- docs/                    copied/stale readable project docs
|  `- fonts/                   locally bundled Inter/Barlow WOFF2 files
|- scripts/
|  |- convert-data.mjs         workbook -> cleaned respondent JSON/CSV
|  |- build-country-metrics.mjs workbook + cleaned JSON -> map metrics/topology
|  |- build-respondent-data.mjs workbook -> commercial scatter extract
|  |- check-*.mjs              copy, insight smoke, country integrity checks
|  `- country-map.mjs          re-exports canonical country registry
|- data/
|  |- raw/l3pilot_labeled.xlsx original source workbook; never modify
|  `- clean/                   generated CSV/JSON; never hand-edit
`- docs/                       source Markdown documentation and process material
```

`public/data/l3pilot-cleaned.json` is a 4-byte legacy-looking `null` asset; it is not fetched by `src/data.js`. `public/data/country-insights.json` is required by the live bump chart, but no generator for it was found in `scripts/`; see section 7.

## 3. Entry point and chapter system

- Bootstrap: `index.html:12` -> `src/main.js`; `initialize()` (`main.js:160`) concurrently fetches cleaned responses, map metrics/topology, commercial respondents, and country insights. It calculates willingness stats, injects all markup via `buildPage()` (`main.js:96`), renders charts, then creates `Road` and `Cockpit`.
- Chapter markup, order, titles, and narrative copy live predominantly in `chartStep()`, `willingnessIntroStep()`, `countryBumpStep()`, and `buildPage()` (`main.js:20-106`). `data-nav` is each chapter's dashboard/mobile label.
- Active chapter is maintained inside `Cockpit` (`src/scene/cockpit.js`, constructor, `update()`, `goTo()`, and `step()`); it derives the nearest step from scroll positions, toggles active/inert presentation, updates the dashboard route and invokes `onStepChange`. `step()` uses a pending target while a tween is running so rapid keyboard presses advance one chapter at a time. The callback at `main.js:216-224` updates mobile labels/buttons.
- Dashboard stops are built from `steps` in `Cockpit.buildNav()` and call `goTo(i)`. Desktop wheel navigation accumulates scroll delta, locks during animation, and leaves actual vertically scrollable panel gestures alone (`Cockpit.handleWheel()`).
- ArrowLeft/ArrowRight/ArrowUp/ArrowDown and PageUp/PageDown move chapters through `cockpit.step()`; Home and End jump to the first and last steps. Text-entry controls, sliders, listboxes, comboboxes, and focused vertically scrollable panels retain native behavior for vertical and boundary keys, while Left/Right always navigate. The hero cue switches between keyboard and touch instructions by input type. Mobile Previous/Next are wired at `main.js:238-239`.
- The paired left copy/right chart screens are generated in `chartStep()` and positioned/animated by `src/styles/cockpit.css` and `src/styles/main.css`; each `.step` has the two `.screen` panels. Reduced motion removes transforms (`main.css` reduced-motion rule).

## 4. Scene layer

- `src/scene/markup.js`: exported fixed cockpit DOM: `#road` canvas, windshield/pillars/dash, route mini-screen, and `#wheel` SVG mount.
- `src/scene/road.js`: `Road` Canvas 2D renderer for road, lane perspective, dusk background, and motion/bend state. `Cockpit` invokes `road.draw()` on construction/resize and changes its position/bend from scroll velocity.
- `src/scene/cockpit.js`: controller; programmatically builds steering wheel SVG (`buildWheel`), route stops (`buildNav`), translates scroll/wheel gestures into chapters (`handleWheel`, `goTo`, `update`), and animates wheel/road in `frame`.
- Its `reduced` flag comes from `prefers-reduced-motion`; in that mode the wheel target is zero and road position/bend do not animate. Chart modules also generally make transitions zero-duration when that preference is active.

## 5. Chart views

### Active in the current page

1. **Five-level willingness, illustrated as 100 seats/25 cars:** `src/charts/willingnessCars.js:57`, fed from `getStoryboardStats()` in `src/charts/storyboardCharts.js:48` using `public/data/l3pilot_clean.json` (`intention_use_future_score`, valid scores only). Seat allocation rounds to exactly 100; five response colors and an HTML legend encode response. Pointer/focus highlights a category and tooltip. CSS grid handles responsiveness (`src/styles/willingness.css`).
2. **Country map/ranking/profile:** `countryDrilldown.js:261` switches between `renderGlobalOverview()` and `profile()` by `state.selectedCountry`. Global view uses `choropleth.js:23`: Natural Earth SVG, a metric selector, an ISO-numeric topology join, and a diverging red/cream/teal scale centered on respondent-weighted global mean. Country SVG paths and ranking bars are click/Enter/Space controls; resize observers redraw. In current CSS the ranking strip is hidden (`charts.css`), though its D3 code remains.
   - Profile subviews in `countryDrilldown.js`: `renderHeatmap()` (age band x seven metric cells, metric-specific symmetric deviation colors, low-n hatch, tooltip/focus); `renderBehavior()` (country versus global behavioral shares); `renderTripPurposeSpider()` (five trip-purpose axes, country/global polygons, tooltip/resize). The active selector metric is outlined in the heatmap. All use `public/data/country_metrics.json`.
3. **Commercial gap scatter:** `commercialGap.js:170`, fed by `public/data/respondents.json`. It groups valid 1-5 `intention_use` / `intention_buy` values by canonical country, x=mean use, y=mean buy, radius=n, low-n ring/dash, equilibrium diagonal and two shaded regions. Local age and income buttons filter the input; hover/focus/click activates country dots and a tooltip. `draw()` recomputes height from the panel; a ResizeObserver redraws.
4. **Country bump and detailed selected-group comparison:** `countryBump.js:141`, fed by `country_metrics.json` plus `country-insights.json`. Three vertical rank axes (trust, safety confidence, adoption) connect country lines; brushY ranges support pointer dragging and keyboard slider controls. Hover sends ISO3 to the map through callbacks in `main.js:178-213`; filtered lines are also highlighted there. The detail view draws grouped enjoyment means and stacked social-influence Likert distributions.

### Retained but not rendered by `main.js`

- `storyboardCharts.js`: `renderWillingnessDistribution` (stacked five-level bar), `renderTrustUseScatter`, `renderTrustSafetyScatter`, and `renderCountryMeasureDots`; these are the requested trust/willingness scatter, trust/safety scatter, and three-measure country dot plot, but `main.js` imports only `getStoryboardStats`, not their render functions. They use cleaned responses and country metrics, responsive SVG, axes, focusable tooltip marks, regression (trust/use) or mean guides (trust/safety).
- `countryTrust.js`, `ageTrust.js`, and `trustDimensions.js` are earlier supplementary/draft chart modules. They depend on old `state.filters` (country/age) and are not imported by `main.js`. They should not be assumed live without re-wiring chapters and state.

This is a material README/request discrepancy: it describes six active original story views, while current `buildPage()` renders the four active chapter types above. The retained three storyboard views exist but are unused.

## 6. State and interaction

- Shared state is the module-local object in `src/state.js`: `selectedMetric` (initial `trust`), `selectedCountry`, `hoveredCountry`, and unused legacy `filters`. Setters clone state and notify the Set of subscribers; there is no URL persistence, context, or external store.
- `main.js` subscribes only `updateMap()` to map state. Map/profile title, metric selector and country selection flow through `actions = { setMetric, setCountry }` (`main.js:175-208`). Bump-map linking is callback/class based, not `state.js`.
- `commercialGap.js` owns its age/income filters locally; bump selection/hover are local too. The active chapter likewise lives only in `Cockpit`, not `state.js`.
- Map paths and (hidden) ranking bars are focusable buttons and respond to click/Enter/Space (`choropleth.js`). Escape on the SVG calls `setCountry(null)`; the profile has a back button in `main.js:189-200`. There is no literal button labeled “World map” in code; README wording refers to this return behavior. The dashboard “Clear” is the bump chart’s clear-selection control, not map clearing.
- Bump brush handles are `role=slider`, keyboard-operable with arrows, PageUp/PageDown, Home/End (`countryBump.js` around `updateKeyboardHandles` / brush setup); their prevented events bypass global chapter navigation. Chart marks generally have `role=graphics-symbol` and tooltips on mouse/focus.

## 7. Data pipeline

- `scripts/convert-data.mjs` reads `data/raw/l3pilot_labeled.xlsx`, cleans blanks, maps workbook country codes through `COUNTRY_MAP`, preserves source Likert code and label, maps only source codes 1-5 to numeric score, coalesces f19 context answers, derives age group and respondent-level trust/intention/trip-purpose means, then writes `public/data/l3pilot_clean.json` and `data/clean/l3pilot_clean.csv`. Age labels there are `18-24`, `25-34`, `35-44`, `45-54`, `55-69` (encoding shown in console may display en-dash corruption).
- `npm run data` executes only `scripts/build-country-metrics.mjs`, not `convert-data.mjs` or `build-respondent-data.mjs`. Run conversion first after raw-data changes. Metrics builder reads workbook and cleaned JSON, calculates summaries, copies `node_modules/world-atlas/countries-110m.json` to `public/data/countries-110m.json`, and writes `public/data/country_metrics.json`.
- `scripts/build-respondent-data.mjs` independently reads the workbook and writes `public/data/respondents.json`; it produces the commercial-gap extract with `f16_9` use and `f16_22` buy, accepting only codes 1-5 and converting 6/null to null. It is not called by any npm script.
- Map scoring is in `build-country-metrics.mjs`: trust=f19 items 1,2,5,6,8 across contexts; adoption=f16 9,11,15,22; safety confidence is reverse-scored f19 items 7,10,11 (`6-value`); expected benefits=f16 1,2,4; awareness=f11 heard share; secondary activities=f14; capability knowledge=f6-f10 correctness. `METRICS` defines the seven selector values. It excludes non-1-5 Likert source code 6. Age groups for profiles are 18-24, 25-34, 35-44, 45-54, 55+.
- `l3pilot_clean.json` is an array of respondent records. Keys include identity/demographics, every derived item as `*_source_code`, `*_score`, `*_label`, and composite/count fields such as `trust_composite_score`, `intention_composite_score`, and `trip_purpose_intention_score`. Example: `{ respondent_id: 87125670, country_code: 1, country_label: 'United Kingdom', respondent_age: 29, trust_composite_score: 3.333, intention_use_future_score: 5 }` (actual first record; full shape comes from `convert-data.mjs`).
- `country_metrics.json` is `{metrics, global, globalDetails, regions, countries, provenance}`. `countries` is keyed by zero-padded ISO numeric ID; a country value has `name`, `iso3`, `region`, `n`, `lowSample`, metric/behavior/misconception/demographic summaries, `subgroups.age`, and `tripPurposeItems`. Example: `countries['156']` is China with `metrics.trust: 3.908`, `metrics.awareness: 80.677`, and five age subgroups.
- Rule-based narrative insights are generated at runtime in `src/insights.js:4` (`generateInsights`, threshold 6) and smoke-printed by `check-insights`. The separate detailed `public/data/country-insights.json` used by the bump chart is prebuilt: no producing script was found, so treat it as a generated/opaque required asset until its provenance is recovered.

## 8. Styling and design tokens

- Reuse `src/styles/tokens.css`: page/card/background colors, `--accent` blue, warm accent, five Likert colors, spacing, radii, shadows, fonts, animation durations/ease, content width.
- Local font faces are declared in `src/styles/fonts.css` from `public/fonts/preview-*.woff2`; the token stacks choose Barlow then Inter.
- `src/styles/cockpit.css` owns fixed scene geometry, windshield/dash/wheel, screen layering, route and z-index relationships. `src/styles/main.css` provides global layout, panels, responsiveness and broad chart styling; `charts.css`, `willingness.css`, and `countryBump.css` own chart-specific presentation.
- Key breakpoint rules are around 1280px and 760px (also 560px height) in `main.css`/`charts.css`; profile panels deliberately become internally scrollable. `@media (prefers-reduced-motion: reduce)` suppresses transforms/animation.

## 9. Quality checks and deployment

- `check-copy.mjs` fails build if `index.html` or `src/` contains the literal em dash character, per repository rule.
- `check:insights` only prints generated rule-based insights for the first three country keys; it is a smoke check, not an assertion-heavy validator.
- `check:countries` validates all 17 canonical country codes/ISO3/ISO-numeric topology IDs across cleaned data, respondent extract, metrics, detailed insights and geometry; it also asserts key client join code remains ISO-based rather than display-name based.
- No Vercel config exists. README says Vercel auto-detects Vite, should run `npm run build`, and publishes `dist/`.
- Verification performed 2026-11-20: after `npm ci`, build passed (598 transformed modules; copy check passed); `check:insights` passed/printed three-country sample; `check:countries` passed. Initial commands using PowerShell `npm` failed because `npm.ps1` execution is disabled; `npm.cmd` succeeded. `npm ci` warned that esbuild's install script remains pending under npm's allow-scripts setting, but Vite built successfully.

## 10. Where do I change X?

| Change request | Edit here | Follow-up |
|---|---|---|
| Chapter copy/order/titles | `src/main.js`: `chartStep`, `willingnessIntroStep`, `countryBumpStep`, `buildPage` | Preserve IDs/data-nav and update dashboard/story numbering; build. |
| Add/change map metric | `scripts/build-country-metrics.mjs`: `METRICS` and respondent scoring; `src/charts/countryDrilldown.js`: labels/profile behavior | Regenerate cleaned data if source-field mapping changed, then `npm run data`; run country check. |
| Colors/color scale | `src/styles/tokens.css`; map scale in `src/charts/choropleth.js`; profile deviation scales in `countryDrilldown.js` | Keep contrast and color-independent labels; build. |
| Active map/ranking chart | `choropleth.js`; map shell/title logic in `main.js` | Retain canonical ISO joins; country check. |
| Country profile | `countryDrilldown.js` (`renderHeatmap`, `renderBehavior`, `renderTripPurposeSpider`, `profile`) and related `charts.css` | If data shape changes, regenerate metrics and country-check. |
| Commercial scatter axes/tooltips/filters | `src/charts/commercialGap.js` | For source fields, also `build-respondent-data.mjs`, rerun it, country check. |
| Willingness cars | `willingnessCars.js`; stats in `storyboardCharts.js:getStoryboardStats`; `willingness.css` | Build. |
| Bump axes/brush/detail views | `countryBump.js`, `countryBump.css`, bump markup in `main.js` | Detailed data is `country-insights.json`; preserve ISO3 joins; country check. |
| Retained trust/scatter/dot chart modules | `storyboardCharts.js`, plus `countryTrust.js`, `ageTrust.js`, `trustDimensions.js` | They are unused: add markup and imports/wiring in `main.js` before editing presentation alone. |
| Cockpit road/wheel/mirror/dashboard route | `scene/road.js`, `scene/cockpit.js`, `scene/markup.js`, `styles/cockpit.css` | Test reduced-motion and scroll-panel handoff; build. No mirror-specific runtime module exists beyond cockpit visual CSS/markup. |
| Sliding panels/layout | `styles/cockpit.css`, `styles/main.css`; screen markup in `main.js` | Test desktop, mobile and reduced motion. |
| Mobile navigation/layout | `.mobile-route` markup/listeners in `main.js`; responsive rules in `main.css`, chart CSS | Test navigation boundaries and internal panel scroll. |
| Keyboard/accessibility | global key guard in `main.js`; map in `choropleth.js`; bump sliders in `countryBump.js`; profile controls in `countryDrilldown.js` | Check tab/focus/Enter/Space/Escape manually; build. |
| Cleaning/derived metrics | `convert-data.mjs`, `build-country-metrics.mjs`, `build-respondent-data.mjs`, `data/countryMap.js` | Never edit generated outputs; run required generator(s), build, country check. |
| Final docs/download links | final Data section of `buildPage()` (`main.js`) and files under `docs/` / `public/docs/` | Keep the public copy synchronized intentionally; README warns public docs are stale. |
| Fonts/global styles | `styles/fonts.css`, `public/fonts/`, `styles/tokens.css`, `styles/main.css` | Fonts must stay local; build. |

## 11. Risks and conventions

- **Country identity is tightly coupled.** `src/data/countryMap.js` maps workbook code -> display name -> ISO3 -> ISO numeric topology ID. Map joins use ISO numeric, bump/storyboard joins use ISO3, and checks enforce all 17. Do not substitute display-name joins.
- **Generated assets are source-of-truth outputs, not editing targets.** The raw workbook, clean data, map metrics, topology and respondent extract each have different producers. `npm run data` alone does not rebuild everything.
- **Insight provenance gap:** live bump rendering requires `country-insights.json`, but no generator was found. A data rebuild can leave it stale without a failing default build.
- **README/docs mismatch:** README describes six live original views; current `main.js` renders four chapter types and leaves three storyboard renderers unused. `public/docs/` mirrors older documentation and README explicitly says its layout description may differ. The README says `npm run data` builds map outputs, but it omits explicit generation of `respondents.json` and `country-insights.json`.
- **Build dependency behavior:** Node and dependencies are required. On Windows PowerShell with script execution disabled, use `npm.cmd` rather than `npm`. `npm ci` may warn about pending esbuild install scripts, although the verified build worked.
- **Code style:** ES modules, named `render*`/`update*` exports, D3 data joins, camelCase, `const`, compact helper functions, and comments for non-obvious scoring/interaction. Keep modules focused under `src/charts/`, maintain local fonts/static assets, use accessible roles/focus behavior, respect reduced motion, and do not add em dashes to `index.html` or `src/`.
