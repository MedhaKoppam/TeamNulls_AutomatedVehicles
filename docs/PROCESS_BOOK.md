# Process Book — Team Nulls

## Overview

Project question, audience, goals, and a concise summary of the final experience.

## Data

- Source workbook: [`../data/raw/l3pilot_labeled.xlsx`](../data/raw/l3pilot_labeled.xlsx)
- Clean browser dataset: [`../public/data/l3pilot_clean.json`](../public/data/l3pilot_clean.json)
- Describe source access, fields used, cleaning decisions, exclusions, and limitations.

### Country-map metrics

The static map data is generated with `npm run data` into `public/data/country_metrics.json`. All primary map measures are normalized to 0–100 and calculated as country means after excluding blanks, `.`, and the non-scale agreement response. Trust averages comfort giving control, relaxation, safety, reliability, and predictability. Adoption intention averages intended future use, expected use with access, everyday use, and purchase intention. Safety confidence reverse-scores safety/takeover/malfunction concerns. Expected benefits averages usefulness, safety, and comfort. Awareness is the percentage previously aware of automated cars; secondary-activity willingness is the agreement score for using automated-driving time for other activities; capability knowledge is the percentage correct across five L3 statements. Full field mappings and treatment of missingness are in [`MAP_METRICS.md`](MAP_METRICS.md).

The source workbook stores country codes 1–17 without names. `scripts/country-map.mjs` makes the L3Pilot country-to-ISO mapping explicit, then `scripts/build-country-metrics.mjs` checks every ISO 3166-1 numeric ID against `world-atlas` `countries-110m.json`. The build aborts if a country cannot be joined, preventing silent drops. The topology is copied to `public/data/`, so the deployed app uses same-origin static data only.

## Design decisions

Document encodings, layout, color, typography, accessibility, alternatives considered, and rationale.

### Continuous story and visualization questions

The page is one continuous scrolling story. Every section places its narrative above a full-width visualization card.

1. **Global map:** How do countries compare on each perception metric? The selector, summary cards, legend, and ranking strip provide a shared frame; selecting a country replaces the map in place with the profile.
2. **Market & commercial gap:** Where is intended use stronger than intended purchase? Respondent-level age and income filters recompute country means.
3. **Would you get in?:** What is the overall distribution of future-use willingness?
4. **Several factors shape willingness:** How closely do country mean trust and future-use willingness move together?
5. **Trust ≠ safety:** How do trust and reverse-scored safety concern coexist across countries?
6. **Willingness is multi-dimensional:** How do intended use, trust, and safety concern compare within each country?

Together the project contains more than five visualizations: choropleth, ranking strip, country heatmap, behavioral signature, readiness-position scatter, market/commercial-gap scatter, response distribution, two country scatters, and a multi-mark country dot plot.

### Storyboard verification and corrections

All calculations below use valid `f16_10` responses coded 1–5; source code 6 is excluded.

- **AG8:** 18,452 valid responses yield 57.40% agree/strongly agree, 26.74% neutral, and 15.86% disagree/strongly disagree. This agrees with the storyboard’s rounded 57% / 27% / 16%.
- **VB1:** The correlation between country mean four-item trust and country mean `f16_10` willingness is **r = 0.986**, which supports the storyboard’s rounded 0.98.
- **KS6:** The storyboard claim that India is highest on both willingness and safety concern is not supported. **Spain** has the highest mean willingness to use (4.32/5) and the highest safety-concern score (4.14/5 after inverting the map’s safety-confidence measure). India’s values are 3.55 and 3.62.
- **VB4:** The cleaned data documents five trip-purpose fields (commute, business travel, errands, leisure, vacation), not labelled motorway/urban/traffic-jam driving contexts. Their overall mean range is 0.11 points (not approximately 0.05); the country range for `f16_10` is 1.63 points (not approximately 1.3). The final dot plot therefore uses only the three fully documented and comparable country measures.

## Visualization sketches/screenshots

Add dated sketches and screenshots with captions. Include at least five planned/final views.

## Innovative vis design

Explain the advanced visualization, its interaction model, why it exceeds a standard Tableau chart, and include annotated screenshots.

### Candidate: linked country profile map

The choropleth-plus-profile system is the innovative/advanced visualization candidate. It joins a survey-derived multivariate country profile to geography, then connects three coordinated views: a metric-switching choropleth, a sorted linked ranking strip, and a selected-country deep dive containing a metric-by-age heatmap, behavioral comparison, and readiness-position scatter. It exceeds a static map or Tableau default because selection persists across named views and the active map metric directly outlines its corresponding heatmap column. The design exposes trade-offs such as high adoption alongside low awareness without implying a causal relationship.

## Interaction design

Describe filters, linked selections/brushing, feedback states, and how interactions support the analysis.

### Implemented map interactions

- **Metric switch:** The segmented selector updates choropleth colors, legend, ranking, global summary values, and the outlined column in the country deep-dive heatmap.
- **Map-to-profile navigation:** Clicking a map country or ranking bar (or pressing Enter/Space on a map country) persists the selection and replaces the map in the same frame with that country’s profile. The isolated back control or Escape restores the map.
- **Scatter filters:** Age and income controls are AND-combined over respondent rows. They recompute each country’s mean use/buy coordinates and node size; countries below `n=30` are visibly marked and the takeaway avoids unstable claims when too few countries remain.
- **Hover and accessibility:** Map countries, profile chart marks, and scatter nodes expose accessible labels and tooltips. No-data hatching and low-sample outlines avoid encoding information with color alone. Reduced-motion preferences suppress transitions.

## Storytelling flow

Outline the narrative sequence, annotations, transitions between views, and intended takeaways.

## Phase 1 log

Record progress toward: cleaned data, one partial visualization, two drafts, rough layout, and screenshots.

## Phase 2 log

Record progress toward: ~60% completion, one polished visualization, two additional partial views, clear story, innovative-view prototype, documented interactions, and contributor names.

## Final reflection

Discuss outcomes, limitations, lessons learned, and future improvements.

## Team contributions

| Contributor | Contributions |
| --- | --- |
| Placeholder name | Placeholder work |
