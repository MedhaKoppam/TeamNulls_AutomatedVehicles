import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json' with { type: 'json' };
import { COUNTRY_MAP } from './country-map.mjs';

const RAW_FILE = 'data/raw/l3pilot_labeled.xlsx';
const OUTPUT_FILE = 'public/data/country_metrics.json';
const GEOMETRY_OUTPUT = 'public/data/countries-110m.json';
const GEOMETRY_SOURCE = 'node_modules/world-atlas/countries-110m.json';
const LOW_SAMPLE_THRESHOLD = 30;

const METRICS = [
  { key: 'trust', label: 'Trust', description: 'Comfort, relaxation, safety, reliability, and predictability across automated-driving contexts.', higherIsBetter: true },
  { key: 'adoption', label: 'Adoption intention', description: 'Intention to use, use with access, use on everyday trips, and buy a conditionally automated car.', higherIsBetter: true },
  { key: 'safetyConfidence', label: 'Safety confidence', description: 'Inverse of concerns about safety, malfunctions, and resuming control after other activities.', higherIsBetter: true },
  { key: 'expectedBenefits', label: 'Expected benefits', description: 'Expected usefulness, safer arrival, and greater comfort.', higherIsBetter: true },
  { key: 'awareness', label: 'Prior awareness', description: 'Share who had heard of automated cars before the questionnaire.', higherIsBetter: true },
  { key: 'secondaryActivities', label: 'Secondary-activity willingness', description: 'Willingness to use automated-driving time for other activities.', higherIsBetter: true },
  { key: 'capabilityKnowledge', label: 'L3 capability knowledge', description: 'Share of answered capability statements classified correctly after the survey introduction.', higherIsBetter: true },
];

const ACTIVITIES = ['takingCareOfChildren', 'talkingWithFellowTravelers', 'internetOrVideo', 'playingGames', 'socializing', 'eatingOrDrinking', 'observingLandscape', 'relaxingOrResting', 'readingBook', 'working', 'other'];
const MISCONCEPTIONS = [
  ['laneKeeping', 'f6', 1], ['overtaking', 'f7', 1], ['allConditions', 'f8', 2],
  ['takeoverAnytime', 'f9', 1], ['otherActivitiesButNoSleeping', 'f10', 1],
];

function numeric(value) {
  if (value === null || value === undefined || value === '.' || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function likert(value) { const score = numeric(value); return score >= 1 && score <= 5 ? score : null; }
function mean(values) { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; }
function round(value) { return value === null || value === undefined ? null : Number(value.toFixed(1)); }
function score100(values) { const average = mean(values); return average === null ? null : (average - 1) * 25; }
function validSelection(value) { return value === 0 || value === 1 || value === '0' || value === '1'; }

function contextItems(row, itemNumber) {
  return ['a', 'b', 'c', 'd'].map((context) => likert(row[`f19${context}_${itemNumber}`]));
}

function respondent(row) {
  const capabilityAnswers = MISCONCEPTIONS
    .map(([, column, correct]) => [numeric(row[column]), correct])
    .filter(([answer]) => answer === 1 || answer === 2)
    .map(([answer, correct]) => answer === correct ? 100 : 0);
  const activitySelections = Object.fromEntries(ACTIVITIES.map((activity, index) => {
    const value = row[`f14b_${index + 1}`];
    return [activity, validSelection(value) ? Number(value) : null];
  }));
  const misconceptionResponses = Object.fromEntries(MISCONCEPTIONS.map(([key, column, correct]) => {
    const answer = numeric(row[column]);
    return [key, answer === 1 || answer === 2 ? (answer === correct ? 0 : 1) : null];
  }));

  return {
    countryCode: numeric(row.country),
    metrics: {
      trust: score100([1, 2, 5, 6, 8].flatMap((item) => contextItems(row, item))),
      adoption: score100([likert(row.f16_9), likert(row.f16_11), likert(row.f16_15), likert(row.f16_22)]),
      safetyConfidence: score100([7, 10, 11].flatMap((item) => contextItems(row, item)).map((value) => value === null ? null : 6 - value)),
      expectedBenefits: score100([likert(row.f16_1), likert(row.f16_2), likert(row.f16_4)]),
      awareness: numeric(row.f11) === 1 ? 100 : numeric(row.f11) === 2 ? 0 : null,
      secondaryActivities: score100([likert(row.f14)]),
      capabilityKnowledge: mean(capabilityAnswers),
    },
    behaviors: activitySelections,
    misconceptions: misconceptionResponses,
    demographics: {
      age: numeric(row.s1),
      genderCode: numeric(row.s2),
      incomeCode: numeric(row.s3),
      hasLicense: numeric(row.f22) === 1 ? 1 : numeric(row.f22) === 2 ? 0 : null,
      annualDistanceCode: numeric(row.f24a),
      educationCode: numeric(row.f30),
    },
  };
}

function summarize(rows) {
  const metrics = Object.fromEntries(METRICS.map(({ key }) => [key, round(mean(rows.map((row) => row.metrics[key])))]));
  const behaviors = Object.fromEntries(ACTIVITIES.map((activity) => [activity, round(mean(rows.map((row) => row.behaviors[activity])) * 100)]));
  const misconceptions = Object.fromEntries(MISCONCEPTIONS.map(([key]) => [key, round(mean(rows.map((row) => row.misconceptions[key])) * 100)]));
  const genderShares = Object.fromEntries([1, 2, 3].map((code) => [`code${code}`, round(mean(rows.map((row) => row.demographics.genderCode === code ? 1 : row.demographics.genderCode === null ? null : 0)) * 100)]));
  return {
    metrics, behaviors, misconceptions,
    demographics: {
      meanAge: round(mean(rows.map((row) => row.demographics.age))),
      genderShares,
      meanIncomeCode: round(mean(rows.map((row) => row.demographics.incomeCode))),
      licensedShare: round(mean(rows.map((row) => row.demographics.hasLicense)) * 100),
      meanAnnualDistanceCode: round(mean(rows.map((row) => row.demographics.annualDistanceCode))),
      meanEducationCode: round(mean(rows.map((row) => row.demographics.educationCode))),
    },
  };
}

// Age is the only demographic field with enough coverage and a meaningful
// ordered grouping across every survey country.  Keep metric-specific n so
// the client can suppress a bar when a particular response is missing.
const AGE_GROUPS = [
  ['18-24', 18, 24], ['25-34', 25, 34], ['35-44', 35, 44],
  ['45-54', 45, 54], ['55+', 55, Infinity],
];
function ageSubgroups(rows) {
  return AGE_GROUPS.map(([key, minimum, maximum]) => {
    const members = rows.filter((row) => row.demographics.age >= minimum && row.demographics.age <= maximum);
    return {
      key,
      label: key === '55+' ? '55+' : key,
      n: members.length,
      metrics: Object.fromEntries(METRICS.map(({ key: metricKey }) => [metricKey, round(mean(members.map((row) => row.metrics[metricKey])))])),
      metricN: Object.fromEntries(METRICS.map(({ key: metricKey }) => [metricKey, members.filter((row) => Number.isFinite(row.metrics[metricKey])).length])),
    };
  });
}

function assertGeometryCoverage() {
  const mapIds = new Set(feature(worldAtlas, worldAtlas.objects.countries).features.map((item) => String(item.id).padStart(3, '0')));
  const unmatched = Object.entries(COUNTRY_MAP).filter(([, country]) => !mapIds.has(country.isoNumeric));
  console.log('Unmatched-country report:');
  if (!unmatched.length) console.log('  None — all 17 mapped ISO numeric IDs exist in countries-110m.json.');
  else unmatched.forEach(([code, country]) => console.log(`  Country code ${code}: ${country.name} (${country.isoNumeric}) is missing from world-atlas.`));
  if (unmatched.length) throw new Error('Aborting: one or more dataset countries do not match the map geometry.');
}

const workbook = XLSX.readFile(RAW_FILE);
const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null, raw: true });
const groups = new Map();
for (const row of rawRows.map(respondent)) {
  if (!COUNTRY_MAP[row.countryCode]) throw new Error(`Dataset country code ${row.countryCode} has no entry in scripts/country-map.mjs.`);
  const group = groups.get(row.countryCode) ?? [];
  group.push(row); groups.set(row.countryCode, group);
}

assertGeometryCoverage();
const countries = {};
for (const [code, country] of Object.entries(COUNTRY_MAP)) {
  const rows = groups.get(Number(code));
  if (!rows) throw new Error(`Mapped country code ${code} (${country.name}) has no dataset rows; refusing to silently drop it.`);
  const summary = summarize(rows);
  countries[country.isoNumeric] = {
    name: country.name, iso3: country.iso3, region: country.region, n: rows.length,
    lowSample: rows.length < LOW_SAMPLE_THRESHOLD, ...summary,
    subgroups: { age: ageSubgroups(rows) },
  };
}
const allRows = [...groups.values()].flat();
const globalSummary = summarize(allRows);
const regions = Object.fromEntries([...new Set(Object.values(COUNTRY_MAP).map((country) => country.region))].map((region) => [region, summarize(allRows.filter((row) => COUNTRY_MAP[row.countryCode].region === region)).metrics]));
const output = { metrics: METRICS, global: globalSummary.metrics, globalDetails: { behaviors: globalSummary.behaviors, misconceptions: globalSummary.misconceptions, demographics: globalSummary.demographics }, regions, countries };

mkdirSync('public/data', { recursive: true });
copyFileSync(GEOMETRY_SOURCE, GEOMETRY_OUTPUT);
writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
console.log('\nFinal country list:');
for (const country of Object.values(countries)) console.log(`  ${country.iso3.padEnd(3)} ${country.name.padEnd(15)} n=${country.n}${country.lowSample ? ' (low sample)' : ''}`);
console.log(`\nWrote ${OUTPUT_FILE} and ${GEOMETRY_OUTPUT}.`);
