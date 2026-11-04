# Intention to Buy vs Intention to Use — data feasibility

Analysis date: 2026-10-23. Source inspected read-only: `data/raw/l3pilot_labeled.xlsx`, `Sheet1`, 18,631 respondent rows and 191 columns.

## Decision

The respondent-level **use vs buy** scatter is supported, provided it uses valid five-point agreement responses for `f16_10` and `f16_23`. It cannot support the requested price-surcharge filter: `f18a` is present as a header but blank for every source row.

`scripts/build-respondent-data.mjs` creates `public/data/respondents.json` with 18,631 rows and only the fields needed for this view. It does not modify the workbook or drop source rows.

## Requested source fields

“Label” below means a label embedded in the project documentation/workbook. The workbook has no embedded codebook for country, income, F13, or F5 response meanings, so coded levels are reported literally rather than expanded into invented labels.

| Requested field | Present / actual source field | Stored form and observed levels | Missing | Notes |
| --- | --- | --- | ---: | --- |
| Country | `country` | Numeric code: 1–17 | 0 | 17 survey-country codes; see per-country n table below. |
| Intention to use | `f16_10` | Numeric codes 1–6: 1=Strongly disagree, 2=Disagree, 3=Neither agree nor disagree, 4=Agree, 5=Strongly agree, 6=Non-scale response | 0 | Important correction: the observed instrument coding is **1–6**, not 1–7. Counts: 1: 1,421; 2: 1,505; 3: 4,934; 4: 6,582; 5: 4,010; 6: 179. |
| Intention to buy | `f16_23` | Numeric codes 1–6 with the same documented agreement encoding | 255 | Counts: 1: 2,266; 2: 2,524; 3: 5,623; 4: 5,082; 5: 2,672; 6: 209. |
| Price surcharge tier | `f18a` | Header exists; no observed values | 18,631 | `f18b`–`f18d` are also entirely blank. There are no price tiers to filter. |
| Age | `s1` | Numeric age in years, 18–69 | 0 | Exact observed levels are every integer 18–69. |
| Household income | `s3` | Numeric categorical code, 1–12 | 99 | No codebook labels are embedded. Counts by code: 1: 1,621; 2: 2,563; 3: 2,578; 4: 2,461; 5: 2,546; 6: 1,869; 7: 1,582; 8: 2,496; 9: 463; 10: 144; 11: 183; 12: 26. |
| Technology familiarity | `f13_1`, `f13_2`, `f13_3`, `f13_4` | Numeric coded levels 1–6 | 0 each | No item wording or level labels are embedded. Each field has observed 1–6 values. |
| ADAS/tech familiarity requested as `f5_1`, `f5_2` | **Not present under those exact names** | Actual families are listed below | — | The actual workbook fields are `f5_1_1_dropdown`…`f5_1_5_dropdown`, `f5_1_6`, and the corresponding `f5_2_*` fields. |

### Actual F5 fields

| Family | Actual columns | Form / values | Missing by column |
| --- | --- | --- | --- |
| `f5_1` family | `f5_1_1_dropdown` through `f5_1_5_dropdown`; `f5_1_6` | First five are categorical strings `0`, `1`, `2`, `3`; sixth is categorical string `0`, `1` | 2,399; 2,818; 3,121; 3,129; 2,692; 2,148 |
| `f5_2` family | `f5_2_1_dropdown` through `f5_2_5_dropdown`; `f5_2_6` | First five are categorical strings `0`, `1`, `2`, `3`; sixth is categorical string `0`, `1` | 2,508; 2,865; 3,052; 3,144; 2,883; 2,148 |

The F13 level counts are: `f13_1` 1:1,738, 2:2,805, 3:5,217, 4:6,186, 5:2,584, 6:101; `f13_2` 1:2,150, 2:3,805, 3:5,355, 4:4,882, 5:2,347, 6:92; `f13_3` 1:1,013, 2:1,879, 3:4,150, 4:7,730, 5:3,778, 6:81; `f13_4` 1:1,127, 2:1,623, 3:4,164, 4:7,828, 5:3,806, 6:83.

## Existing cleaned data

`data/clean/l3pilot_clean.csv` and `public/data/l3pilot_clean.json` already retain respondent-level rows (18,631), so the project is not limited to country aggregates. They include derived respondent-level fields for `f16_10` (`intention_use_future_score`) and `f16_23` (`intention_purchase_when_available_score`) plus age.

They do **not** retain `f18a`, the F13 fields, or the F5 families; additionally the existing cleaner names raw `s3` as `education_source_code`, while this proposed view needs it as the requested income-tier code. A compact purpose-built extract is therefore needed.

## Extracted respondent data

`scripts/build-respondent-data.mjs` outputs these raw-derived, cleaned fields per respondent:

`country`, `intention_use`, `intention_buy`, `price_surcharge_tier`, `age`, `income_tier`, `f13_1`–`f13_4`, and the twelve actual F5 fields listed above.

Missing-data rule:

- Every source row is retained.
- Blank strings and `.` become `null`.
- `intention_use` and `intention_buy` retain only source codes 1–5; code 6 and blanks become `null` because code 6 is a documented non-scale response.
- `f18a`, age, income, F13, and F5 are preserved as source codes/categories where present; no imputation is applied.
- Country averages for the planned scatter must use rows with non-null **both** `intention_use` and `intention_buy` after filters are applied, and must show their resulting n.

There are 18,054 rows with both valid intentions before any optional filters.

| Country code | n with valid use + buy |
| ---: | ---: |
| 1 | 1,196 |
| 2 | 1,043 |
| 3 | 1,143 |
| 4 | 1,101 |
| 5 | 1,139 |
| 6 | 994 |
| 7 | 1,123 |
| 8 | 1,151 |
| 9 | 743 |
| 10 | 1,063 |
| 11 | 1,047 |
| 12 | 1,044 |
| 13 | 1,042 |
| 14 | 1,069 |
| 15 | 1,048 |
| 16 | 1,058 |
| 17 | 1,050 |

## Subsample stability risks

1. **Price tier makes every country unusable.** `f18a` has zero non-missing values, so any price-tier selection creates n=0 for all 17 countries. The control should not be built from this workbook.
2. **Exact-age filtering is unstable.** Every country has at least some individual-age selections with n<30 after valid-use-and-buy filtering. Use broad age bands rather than a single-age slider. The five bands 18–24, 25–34, 35–44, 45–54, and 55–69 are all at least n=30 except country 9’s 18–24 band (n=22).
3. **Income extremes are thin.** With valid intentions, country 10 / income code 1 is n=21 and country 12 / income code 12 is n=26. Intersections of age, income, and familiarity filters will be thinner still; suppress or mark a country average when the resulting n<30.
4. **F13 level 6 is especially sparse.** It is under n=30 in nearly every country for every F13 item. It should not be a standalone filter level without a low-n warning.

## Price-tier interpretation risk

Even if a future source supplies `f18a`, filtering an intention-to-buy outcome by a price-surcharge/willingness-to-pay response would be conceptually confounded: willingness to pay is plausibly part of the same purchase-intent construct. Do not frame a split as an independent effect of price. Prefer wording such as **“purchase intention among respondents reporting this surcharge preference”** and show the subgroup n; do not claim that the price tier causes the difference.

## ADAS / technology familiarity buckets

No defensible “Novice” versus “Experienced ADAS user” bucket can be committed from this workbook alone. F13 and F5 level meanings/directions are not embedded, so mapping their numeric codes to experience would be a guess.

Conditional proposal only after obtaining the L3Pilot codebook:

- If the codebook confirms that F13 codes 1–5 are ordered from least to most familiar and that code 6 is non-substantive, calculate the median of valid `f13_1`–`f13_4` codes (require at least three valid items). Define **Novice** as median <=2 and **Experienced ADAS user** as median >=4; leave a median of 3 unbucketed and code 6 out of the score.
- Do not use the F5 families for the bucket unless the codebook confirms that their `0`–`3`/`0`–`1` categories represent ADAS use/experience rather than another response routing variable.

Until that documentation is available, expose the individual source-code filters only with neutral labels (for example, “F13 item 1: code 1”), or omit the familiarity filter.
