# Combined visualization and cockpit UI

The ZIP project supplies the data processing, source workbook, survey extracts, chart modules, and chart calculations. The HTML preview supplies the visual presentation: local fonts, dusk-road canvas scene, rear-view mirror, steering wheel, dashboard route, introduction, and paired narrative/chart screens.

## What is included

- All original source files, raw data, cleaned data, scripts, and documentation remain present.
- The original six story views remain active, with the seven-metric map and country ranking, the age/behavior/readiness drilldowns, the age/income commercial-gap filters, willingness distribution, two country scatter plots, and the three-measure comparison.
- Long charts and profiles scroll inside their screen. Dense country-profile plots retain readable pixel sizes and can scroll horizontally on narrow screens.
- Inactive chapters are inert. Map/ranking controls support keyboard selection, Escape returns from a country profile, and mobile navigation provides previous/next controls.
- All fonts and map geometry are local. Reduced-motion mode keeps the road and wheel static.
- The final chapter links to the original workbook, cleaned data, respondent extract, country metrics, data dictionary, and process book.

The HTML preview's illustrative chart data and extra illustrative analyses are not used. Statistics in the combined narrative are derived from the ZIP's original data, including 18,631 total responses, 18,452 valid willingness responses, and 17 countries.

## Validation

- `npm ci --no-audit --no-fund` completed using the original lockfile.
- `npm run build` passed, including the repository copy check.
- `npm run check:insights` completed for the sample country insights.
- Chromium checks verified all six story charts, 17 map countries, seven metric controls, 17 ranking controls, all three profile charts, keyboard ranking selection, Escape/back/clear behavior, combined age/income filters and reset, and all six data/document links.
- Chart mark counts: five willingness segments, 17 countries in each scatter plot, and 51 comparison symbols. No non-finite SVG values or browser runtime errors were found.
- Mobile checks verified chapter navigation, profile access, filtering, horizontal page containment, and readable horizontally scrolling profile plots. Normal and reduced-motion scene navigation were exercised.

## Run

Use Node.js 20.19+ or 22.12+ (validated here with Node.js 24).

```sh
npm ci
npm run dev
```

Prepared survey and map extracts are included. Use `npm run data` only when regenerating country metrics. For deployment, run `npm run build` and serve the resulting `dist/` directory over HTTP. The project does not require a backend, API keys, or external font/map requests.
