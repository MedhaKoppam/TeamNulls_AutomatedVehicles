import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

const workbook = XLSX.readFile('data/raw/l3pilot_labeled.xlsx', { cellDates: true });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null, raw: true });

function cleanValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed === '' || trimmed === '.' ? null : trimmed;
}
function numeric(value) {
  const parsed = Number(cleanValue(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function likert(value) {
  const code = numeric(value);
  const labels = { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neither agree nor disagree', 4: 'Agree', 5: 'Strongly agree', 6: 'Non-scale response (source code 6)' };
  return { code, score: code >= 1 && code <= 5 ? code : null, label: code === null ? 'Missing' : (labels[code] ?? `Unmapped source code ${code}`) };
}
function mean(values) {
  const present = values.filter(Number.isFinite);
  return present.length ? Number((present.reduce((sum, value) => sum + value, 0) / present.length).toFixed(3)) : null;
}
function ageGroup(age) {
  if (!Number.isFinite(age)) return 'Missing';
  if (age <= 24) return '18–24'; if (age <= 34) return '25–34'; if (age <= 44) return '35–44'; if (age <= 54) return '45–54'; return '55–69';
}
function coalescedLikert(row, item) {
  const value = ['a', 'b', 'c', 'd'].map((suffix) => row[`f19${suffix}_${item}`]).find((candidate) => cleanValue(candidate) !== null);
  return likert(value);
}
function addLikert(target, name, answer) {
  target[`${name}_source_code`] = answer.code;
  target[`${name}_score`] = answer.score;
  target[`${name}_label`] = answer.label;
}

const clean = rows.map((row) => {
  const trustControl = coalescedLikert(row, 1), trustRelaxed = coalescedLikert(row, 2), trustEveryday = coalescedLikert(row, 5), trustSafe = coalescedLikert(row, 6);
  const intentFuture = likert(row.f16_10), intentAccess = likert(row.f16_12), intentEveryday = likert(row.f16_16), intentPurchase = likert(row.f16_23);
  const commute = likert(row.f20_1), business = likert(row.f20_2), errands = likert(row.f20_3), leisure = likert(row.f20_4), vacation = likert(row.f20_5);
  const age = numeric(row.s1);
  const countryCode = numeric(row.country), genderCode = numeric(row.s2), educationCode = numeric(row.s3);
  const output = {
    respondent_id: numeric(row.userid), country_code: countryCode, country_label: `Country code ${countryCode ?? 'missing'}`,
    region: 'Unmapped — requires source codebook', response_start_date: cleanValue(row.startdate), respondent_age: age, age_group: ageGroup(age),
    gender_source_code: genderCode, gender_label: `Gender code ${genderCode ?? 'missing'}`,
    education_source_code: educationCode, education_label: `Education code ${educationCode ?? 'missing'}`,
  };
  addLikert(output, 'trust_comfort_giving_control', trustControl); addLikert(output, 'trust_relaxed_during_ride', trustRelaxed); addLikert(output, 'trust_everyday_travel', trustEveryday); addLikert(output, 'trust_safe_using_car', trustSafe);
  output.trust_item_count = [trustControl, trustRelaxed, trustEveryday, trustSafe].filter((item) => item.score !== null).length;
  output.trust_composite_score = mean([trustControl.score, trustRelaxed.score, trustEveryday.score, trustSafe.score]);
  addLikert(output, 'intention_use_future', intentFuture); addLikert(output, 'intention_use_with_access', intentAccess); addLikert(output, 'intention_use_everyday', intentEveryday); addLikert(output, 'intention_purchase_when_available', intentPurchase);
  output.intention_item_count = [intentFuture, intentAccess, intentEveryday, intentPurchase].filter((item) => item.score !== null).length;
  output.intention_composite_score = mean([intentFuture.score, intentAccess.score, intentEveryday.score, intentPurchase.score]);
  addLikert(output, 'use_commute', commute); addLikert(output, 'use_business_travel', business); addLikert(output, 'use_errands', errands); addLikert(output, 'use_leisure', leisure); addLikert(output, 'use_vacation', vacation);
  output.trip_purpose_item_count = [commute, business, errands, leisure, vacation].filter((item) => item.score !== null).length;
  output.trip_purpose_intention_score = mean([commute.score, business.score, errands.score, leisure.score, vacation.score]);
  return output;
});

mkdirSync('data/clean', { recursive: true }); mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/l3pilot_clean.json', `${JSON.stringify(clean)}\n`);
writeFileSync('data/clean/l3pilot_clean.csv', XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(clean)));
console.log(`Wrote ${clean.length} rows to data/clean/l3pilot_clean.csv and public/data/l3pilot_clean.json. No source rows were dropped.`);
