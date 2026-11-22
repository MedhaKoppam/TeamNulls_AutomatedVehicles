# Map metrics analysis — L3Pilot Global User Acceptance Survey

Status: analysis only; no UI or data files were created or changed.

## Scope and provenance

- Analysed `data/raw/l3pilot_labeled.xlsx`, Sheet1, 18,631 rows and 191 fields. The raw workbook was not modified.
- The source's first-phase questionnaire was used to verify the item sequence and answer options: [L3Pilot Deliverable D7.1, Annex 1](https://l3pilot.eu/fileadmin/user_upload/Downloads/Deliverables/Update_10082022/L3Pilot-SP7-D7.1-Annual_quantitative_survey_about_user_acceptance_towards_ADAS_and_vehicle_automation-v1.0_for_website.pdf). The official dataset record says that its `Description.pdf` documents coding and that v1.2 includes willingness-to-pay responses: [Zenodo record](https://zenodo.org/records/8389544).
- The workbook's `country` field is the only country/region field. It contains numeric codes `1`–`17`; it does **not** contain country names, ISO codes, regions, or a code-to-country value-label table. This analysis therefore reports `Country code N` and intentionally does not infer names.
- `data/clean/l3pilot_clean.csv` is useful only for its selected fields. It should not be used as the authority for this feature: for example, its dictionary calls raw `s3` education, whereas the official questionnaire identifies it as household monthly net income; education is raw `f30`.

## Shared scoring rules

All proposed map metrics are respondent-level scores aggregated to a country arithmetic mean. A respondent is included in a metric only when they supplied at least one valid component; the country metric is rendered only when that country has at least one valid respondent (the implementation should also display the valid-metric denominator alongside the overall `n`).

| Response type | Rule | 0–100 conversion |
| --- | --- | --- |
| Agreement item | Raw codes 1–5 are Strongly disagree through Strongly agree. | `25 × (score − 1)`; a multi-item metric averages valid item scores before conversion (equivalent to averaging item 0–100 scores). |
| Agreement code 6 | “I prefer not to respond,” not a point on the scale. | Exclude from that item and composite; do not impute. |
| Blank or `.` | Missing. | Exclude; do not impute. |
| Yes/no/Don't know knowledge items | Correct = 100; incorrect = 0. “I don't know” and missing are excluded, rather than treated as wrong. | Mean of answered items. |
| Familiarity yes/no | `Yes` = 100, `No` = 0. | Country mean is the percentage aware. |
| Negatively worded safety items | Reverse before composing a positive *safety confidence* score: `6 − raw agreement`. | Apply the agreement rule after reversal. |

No weighting, country rebalancing, or imputation is proposed. Country differences are descriptive, not causal.

## Theme inventory and proposed country metrics

The column-to-question mappings below follow the questionnaire ordering. `f19[a–d]_N` means all four automated-driving contexts (congested motorway, urban road, motorway, parking) are included with equal item weight for each respondent; this avoids arbitrarily selecting a context.

| Requested theme | Present? | Proposed country metric (higher is more of the named positive construct) | Exact raw columns and conversion |
| --- | --- | --- | --- |
| Trust in automated driving | Present | **Trust** | `f19[a-d]_1` comfort giving control; `_2` relaxed; `_5` feel safe; `_6` reliable; `_8` predictable. Valid 1–5 agreement responses are averaged across all valid context-items, then normalized with `25 × (mean − 1)`. |
| Willingness to use / adopt / pay | Present | **Adoption intention** (recommended universal selector) | `f16_9` intention to use in future; `f16_11` predicted use with access; `f16_15` use on everyday trips; `f16_22` plan to buy when available. Average valid agreement items, then 0–100 normalization. **Willingness to pay is also available but should be a separate, qualified metric:** `f17a`–`f17d`, ordered price brackets for the four contexts. Calculate `% any positive WTP` as the percentage of nonmissing answers with code 2–6 (code 1 is the zero-price option). Do not combine monetary brackets across countries: the questionnaire uses country-specific currencies/brackets, and WTP is absent by survey routing/wave for 13,967–13,978 records per item. |
| Perceived safety concerns / risk | Present | **Safety confidence** (inverse of concerns) | `f19[a-d]_7` concern about general safety, `_10` concern that failure/malfunction causes accidents, `_11` concern about taking over after other activities. Reverse each valid 1–5 agreement score (`6 − score`), average, then normalize. This gives a consistent direction with Trust; it must be labelled “safety confidence,” not “risk.” |
| Perceived benefits | Present | **Expected benefits** | `f16_1` useful for daily mobility needs; `f16_2` helps reach destination more safely; `f16_4` helps reach destination more comfortably. Average valid agreement scores, then normalize. |
| Familiarity / awareness / prior experience | Present | **Prior awareness** | `f11`, “Have you ever heard of automated cars before this questionnaire?” Raw code 1 = Yes and 2 = No; score Yes=100, No=0. This is awareness, not actual L3 use. The workbook also contains `f25_1`–`f25_9` for ownership/use of existing driver-assistance systems, but those are not L3 prior experience and should remain a drawer detail rather than be mixed into awareness. |
| Behaviors while automation is driving (secondary activities) | Present | **Secondary-activity willingness** | `f14`, “I would use the time … for other activities.” Valid 1–5 agreement score normalized to 0–100. `f14b_1`–`f14b_11` are conditional, multi-select preferred activities; report their per-activity percentages only among people routed to that question, not as one false numeric scale. |
| Misconceptions about system capabilities | Present | **L3 capability knowledge** | `f6` lane keeping (correct Yes/code 1); `f7` overtaking (Yes/1); `f8` operates in all conditions (No/2); `f9` may ask driver to take over anytime (Yes/1); `f10` other activities allowed but sleeping not allowed (Yes/1). Each answered response is 100 if correct, 0 if incorrect; code 3 “I don't know” is excluded. Average valid items. This measures post-instructions factual understanding, not a clinical misconception scale. |
| Demographics (age, gender, driving experience, etc.) | Present | **Profile fields, not one 0–100 metric** | `s1` age in years; `s2` gender (codes 1–3); `s3` household monthly net-income category (country-local categories); `f22` valid driving licence; `f24a` annual distance driven category, conditional on licence; `f30` highest education category; `f31` employment status. Do not rank country demographics on a common “demographic score.” |

The questionnaire also provides items related to privacy, technology readiness, social influence, expected mobility impacts, and ADAS use. They are real columns but are not used above because they do not directly match the requested themes.

## Per-country overall sample size

`n` is the number of workbook rows with that `country` code, before metric-specific exclusions. The low-sample rule is `n < 30`; none is low sample.

| Country identifier available in workbook | n | Flag |
| --- | ---: | --- |
| Country code 1 | 1,217 | — |
| Country code 2 | 1,056 | — |
| Country code 3 | 1,177 | — |
| Country code 4 | 1,133 | — |
| Country code 5 | 1,164 | — |
| Country code 6 | 1,004 | — |
| Country code 7 | 1,146 | — |
| Country code 8 | 1,186 | — |
| Country code 9 | 1,021 | — |
| Country code 10 | 1,074 | — |
| Country code 11 | 1,057 | — |
| Country code 12 | 1,059 | — |
| Country code 13 | 1,054 | — |
| Country code 14 | 1,074 | — |
| Country code 15 | 1,079 | — |
| Country code 16 | 1,070 | — |
| Country code 17 | 1,060 | — |

## Correlation analysis

Pearson correlations were calculated pairwise from the proposed metrics, using the metric rules above. Country-level correlations use the 17 country means. Respondent-level demographic correlations use pairwise-complete responses. These are associations, not evidence of direction or cause; country-level results are particularly vulnerable to ecological fallacy.

### Five notable relationships

| Level | Relationship | Pearson r | n | Interpretation bounded by the data |
| --- | --- | ---: | ---: | --- |
| Country | Trust ↔ Expected benefits | +0.979 | 17 countries | Countries with higher average trust also have higher expected-benefit ratings. The overlap in attitude constructs means this is a descriptive alignment, not independent validation. |
| Country | Trust ↔ Secondary-activity willingness | +0.976 | 17 countries | Higher-trust country averages coincide with greater willingness to use automated-driving time for other activities. |
| Country | Adoption intention ↔ Expected benefits | +0.954 | 17 countries | Countries with higher expected benefits also report stronger intentions to use/buy. |
| Respondent | Age ↔ Trust | −0.220 | 18,591 | Older respondents report modestly lower trust on the defined 0–100 score. |
| Respondent | Age ↔ Adoption intention | −0.213 | 18,595 | Older respondents report modestly lower use/purchase intention. |

Additional checks: age is also negatively associated with secondary-activity willingness (`r = −0.184`, `n = 18,487`); ordinal household-income category has modest positive associations with expected benefits (`r = +0.144`, `n = 18,597`) and adoption (`r = +0.133`, `n = 18,593`). Income bands are localized, so these should not be compared as literal monetary values across countries. Country-level L3 capability knowledge has a moderate inverse relationship with secondary-activity willingness (`r = −0.501`, `n = 17`) and with adoption intention (`r = −0.409`, `n = 17`); this is intriguing but not strong enough to headline without confirming the country-code mapping and design effects.

## Top uncertainties to resolve before implementation

1. **Country identity/join is blocked.** The raw workbook does not map country codes 1–17 to country names or ISO codes. Do not draw a choropleth, attach a world geometry join, or name a country until an official codebook/value-label export is supplied or verified.
2. **Wave/routing comparability is incomplete.** WTP is only available for a routed subset and uses country-specific price brackets. It should not be shown as a universal map selector or combined with adoption intention.
3. **Existing clean-field semantics are unreliable for this feature.** In addition to `s3`, the existing derived trust/intention labels do not match the verified questionnaire ordering. Use the raw mapping table above as the implementation contract, or first correct the cleaner and dictionary in a separate approved task.
4. **The proposed composites are transparent design choices, not supplied validated scales.** Items are equally weighted. A future validation pass could test reliability/factor structure, but that is outside this analysis-only request.
5. **“Knowledge” follows survey-provided instructions.** It is measured after respondents were shown a description of an L3 car, so it cannot be interpreted as pre-existing public knowledge.
