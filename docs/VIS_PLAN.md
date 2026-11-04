# Candidate Visualization Plan

All proposals use the cleaned, actual fields in `l3pilot_clean.*`. Country is initially treated as a coded category until the official codebook is incorporated; labels must not be inferred from numeric codes.

| # | Type | Question | Columns | Chart / interaction |
| ---: | --- | --- | --- | --- |
| 1 | Standard | How does trust vary across the 17 surveyed country codes? | `country_label`, `trust_composite_score`, `trust_item_count` | Ranked dot-and-interval plot with sample size and missingness. |
| 2 | Standard + linked | Which age groups are more or less trusting of L3 cars? | `age_group`, `trust_composite_score`, `country_label` | Box/violin plot; brushing an age group filters #1. |
| 3 | Standard | Which trust dimension is weakest or strongest? | Four `trust_*_score` fields | Diverging Likert stacked bars for control, relaxation, everyday trust, and safety. |
| 4 | Standard + linked | Does trust travel with intention to use or purchase? | `trust_composite_score`, `intention_composite_score`, `age_group`, `country_label` | Binned density scatterplot; rectangular brush filters #5. |
| 5 | Standard + linked | For which travel purposes do respondents intend to use an L3 car? | Five `use_*_score` fields, `country_label`, `age_group` | Small-multiple Likert distributions, updated by #4 selection. |
| 6 | Standard | Is purchase intention lower than willingness to use? | Four `intention_*_score` fields | Aggregate slope chart with country/age aggregation toggle. |
| 7 | Innovative / advanced | Are there recurring profiles of trust, adoption intent, and trip-purpose use—and where are they concentrated? | All `trust_*_score`, `intention_*_score`, `use_*_score`, `country_label`, `age_group` | Interactive parallel-coordinates density-ribbon profile explorer. Brushing an axis updates a country-by-age heatmap. This is the advanced view. |
| 8 | Standard | What share of each subgroup has usable evidence for the composite scores? | `country_label`, `age_group`, `trust_item_count`, `intention_item_count`, `trip_purpose_item_count` | Missingness matrix/heatmap, making source-code-6 handling transparent. |

## Recommended story

Begin with coverage (#8), establish country variation (#1), explain age variation (#2), unpack trust (#3), connect trust with readiness (#4–6), and end with multivariate profiles (#7). Views #2, #4, #5, and #7 provide linked interactions.
