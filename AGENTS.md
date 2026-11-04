# Team Nulls — CS4460 Final Project

## Project context

This repository contains Team Nulls' Georgia Tech CS4460 Data Visualization final project: **Autonomous Vehicle Trust**. The source dataset is the L3Pilot Global User Acceptance Survey workbook at `data/raw/l3pilot_labeled.xlsx`. Never modify the raw workbook; transformations belong in `scripts/` and browser-ready output belongs in `public/data/`.

## Course requirements

- At least 5 visualizations total.
- At least 1 linked interaction between two views (e.g., brushing/filtering in one view updates another).
- At least 1 innovative/advanced visualization (not something easily made in Tableau).
- Must demonstrate storytelling (narrative flow, text, annotations).
- Project must be "click & run": a TA can run it with minimal steps. Provide a README with exact instructions, and also make sure `npm run build` outputs a deployable static `dist/`.
- Deployed on Vercel.
- Process book (PDF eventually) with screenshots, data link, innovative vis design, and interaction design.
Phase 1 (wk 8): clean data done, 1 vis partly implemented + 2 drafts, rough layout implemented, screenshots.
Phase 2 (wk 9): ~60% done, 1 vis polished, 2 more partial, storytelling clear, first innovative view designed/partly built, interactions documented, names of contributors.

## Code conventions

- Use vanilla JavaScript ES modules and D3; do not introduce a framework.
- Keep modules small. Put each chart in its own file under `src/charts/` and export render/update functions.
- Put shared filters and selections in `src/state.js` so linked views subscribe to the same state.
- Comment non-obvious logic, especially data transformation and interaction behavior.
- Use accessible colors: do not encode meaning by color alone, maintain contrast, and consider color-vision deficiencies.
- Always run `npm run build` before finishing a task and fix any errors.

## Design system

The user selected `would-you-get-in-preview.html` as the UI/layout reference. Use its cockpit, road, dashboard, Barlow/Inter fonts, blue UI accent, and translucent paired screens. Original chart calculations, data, and interactions remain the source of truth; do not replace them with the preview's illustrative chart values.

- Keep chart theme values in `src/styles/tokens.css`; cockpit geometry and appearance live in `src/styles/cockpit.css`.
- Keep scene logic under `src/scene/` and chart rendering under `src/charts/`.
- Support internal panel scrolling and horizontal scrolling for dense country-profile charts.
- Keep inactive chapters inert and respect reduced motion.
- Keep fonts and data local. No external services or credentials are required.
- Do not use em dashes in index.html or src/; the build enforces this.
