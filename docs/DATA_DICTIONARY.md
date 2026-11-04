# Clean Data Dictionary

`data/clean/l3pilot_clean.csv` and `public/data/l3pilot_clean.json` retain all 18,631 source rows. Blank cells and `.` become explicit `null`; source code `6` in agreement items is retained as a non-scale response with a `null` numeric score. No imputation or row deletion occurs.

The workbook contains coded country, gender, and education fields but no embedded codebook. Codes are kept without inventing labels. Trust and behavioral-intention item names follow the published L3Pilot documentation.

| Final column(s) | Type | Meaning / derivation | Allowed values |
| --- | --- | --- | --- |
| `respondent_id` | number | Raw `userid`; row identity. | Source numeric IDs |
| `country_code`, `country_label` | number, string | Raw `country` plus display label. | 1–17; `Country code N` |
| `region` | string | Explicit placeholder pending official country codebook. | `Unmapped — requires source codebook` |
| `response_start_date` | string/null | Trimmed raw `startdate`; localized string retained. | Date text/null |
| `respondent_age`, `age_group` | number, string | Raw `s1` and derived band. | 18–69; 18–24, 25–34, 35–44, 45–54, 55–69, Missing |
| `gender_source_code`, `gender_label` | number/null, string | Raw `s2` with non-invented label. | 1–3/null; `Gender code N` |
| `education_source_code`, `education_label` | number/null, string | Raw `s3` with non-invented label. | 1–12/null; `Education code N` |
| `trust_comfort_giving_control_*` | code, score, label | `f19[a-d]_1`: comfort giving control, coalesced across contexts. | Agreement encoding below |
| `trust_relaxed_during_ride_*` | code, score, label | `f19[a-d]_2`: relaxed during ride, coalesced across contexts. | Agreement encoding below |
| `trust_everyday_travel_*` | code, score, label | `f19[a-d]_5`: trust for everyday travel, coalesced across contexts. | Agreement encoding below |
| `trust_safe_using_car_*` | code, score, label | `f19[a-d]_6`: feeling safe using car, coalesced across contexts. | Agreement encoding below |
| `trust_item_count`, `trust_composite_score` | integer, number/null | Valid-item count and unweighted mean of four trust/safety scores. | 0–4; 1–5/null |
| `intention_use_future_*` | code, score, label | `f16_10`: intent to use in future. | Agreement encoding below |
| `intention_use_with_access_*` | code, score, label | `f16_12`: predicted use with access. | Agreement encoding below |
| `intention_use_everyday_*` | code, score, label | `f16_16`: intent to use for everyday trips. | Agreement encoding below |
| `intention_purchase_when_available_*` | code, score, label | `f16_23`: plan to buy when available. | Agreement encoding below |
| `intention_item_count`, `intention_composite_score` | integer, number/null | Valid-item count and unweighted mean of four behavioral-intention scores. | 0–4; 1–5/null |
| `use_commute_*`, `use_business_travel_*`, `use_errands_*`, `use_leisure_*`, `use_vacation_*` | code, score, label | `f20_1`–`f20_5`: intention to use for each travel purpose. | Agreement encoding below |
| `trip_purpose_item_count`, `trip_purpose_intention_score` | integer, number/null | Valid-item count and unweighted mean of five trip-purpose scores. | 0–5; 1–5/null |

For each `*_ *` group, output fields are `*_source_code`, `*_score`, and `*_label`. Scores map 1–5 from Strongly disagree to Strongly agree. Code 6 remains visible in source code/label and is excluded from means.

## Complete field contract

The following expands every generated field name. In each three-field item set, `source_code` is `number/null` (raw 1–6), `score` is `number/null` (valid 1–5 only), and `label` is `string` (the matching agreement text, Missing, or the explicit code-6 non-scale label).

| Exact final field(s) | Meaning |
| --- | --- |
| `trust_comfort_giving_control_source_code`, `trust_comfort_giving_control_score`, `trust_comfort_giving_control_label` | Comfort giving control to the L3 car. |
| `trust_relaxed_during_ride_source_code`, `trust_relaxed_during_ride_score`, `trust_relaxed_during_ride_label` | Feeling relaxed during an L3 ride. |
| `trust_everyday_travel_source_code`, `trust_everyday_travel_score`, `trust_everyday_travel_label` | Trusting an L3 car for everyday travel. |
| `trust_safe_using_car_source_code`, `trust_safe_using_car_score`, `trust_safe_using_car_label` | Feeling safe using an L3 car. |
| `intention_use_future_source_code`, `intention_use_future_score`, `intention_use_future_label` | Intention to use an L3 car in the future. |
| `intention_use_with_access_source_code`, `intention_use_with_access_score`, `intention_use_with_access_label` | Predicted use if an L3 car were accessible. |
| `intention_use_everyday_source_code`, `intention_use_everyday_score`, `intention_use_everyday_label` | Intended use for everyday trips. |
| `intention_purchase_when_available_source_code`, `intention_purchase_when_available_score`, `intention_purchase_when_available_label` | Plan to buy an L3 car once available. |
| `use_commute_source_code`, `use_commute_score`, `use_commute_label` | Intended use for commuting/study. |
| `use_business_travel_source_code`, `use_business_travel_score`, `use_business_travel_label` | Intended use for business travel. |
| `use_errands_source_code`, `use_errands_score`, `use_errands_label` | Intended use for errands. |
| `use_leisure_source_code`, `use_leisure_score`, `use_leisure_label` | Intended use for leisure activities. |
| `use_vacation_source_code`, `use_vacation_score`, `use_vacation_label` | Intended use for vacation trips. |
