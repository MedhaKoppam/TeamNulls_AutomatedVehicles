Team Nulls - L3Pilot country map on the original 1-5 scale

This update replaces the project’s existing public/data/l3pilot_clean.json
with the uploaded l3pilot_clean_countries.json respondent-level file. It contains 18,631 records and 17 cleaned country labels. Country joins
are based on country_label, not numeric country_code, because the numeric
assignments in this upload differ from the older repository mapping.

All map averages retain the original 1-5 scale. No Likert-to-100 conversion is
performed. Null and non-numeric values are excluded from each mean. The upload's
precomputed respondent-level composite values are used as supplied.

Map measures:
- Trust: trust_composite_score
- Adoption intention: intention_composite_score
- Trip-purpose intention: trip_purpose_intention_score
- Perceived safety: trust_safe_using_car_score (a single item that also
  contributes to the trust composite; it is not a separate safety composite)

The map, country profiles, country-level trust/use/safety comparisons, and
five-point willingness distribution use the uploaded dataset. The separate
use-vs-buy chart remains on the project's existing respondents.json asset:
the uploaded file does not contain the income-tier field used by that chart's
current filters, so this update leaves that chart and its filters unchanged.

Apply:
1. Extract this ZIP into the root of your TeamNulls_AutomatedVehicles repo.
2. From Terminal, cd to the repo root.
3. Run: python3 apply_1_to_5_update.py
4. Run: npm run build
5. Review the changes in GitHub Desktop, commit, and push to main.

This bundle does not change the original upstream DVP repository.
