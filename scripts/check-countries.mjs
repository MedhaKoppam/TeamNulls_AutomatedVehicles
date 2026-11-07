import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { COUNTRY_MAP } from './country-map.mjs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const fail = [];
const note = (message) => fail.push(message);
const expected = Object.entries(COUNTRY_MAP).map(([code, country]) => ({ code: Number(code), ...country }));
const expectedCodes = new Set(expected.map((country) => country.code));
const expectedIso3 = new Set(expected.map((country) => country.iso3));
const expectedNumeric = new Set(expected.map((country) => country.isoNumeric));

function duplicate(values) {
  const seen = new Set();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}
function sameSet(actual, expectedSet, label) {
  const values = new Set(actual);
  const missing = [...expectedSet].filter((value) => !values.has(value));
  const unexpected = [...values].filter((value) => !expectedSet.has(value));
  if (missing.length || unexpected.length) note(`${label}: missing [${missing.join(', ') || 'none'}]; unexpected [${unexpected.join(', ') || 'none'}].`);
}
function exactlyOnce(values, expectedSet, label) {
  const duplicates = duplicate(values);
  if (duplicates.length) note(`${label}: duplicate keys [${[...new Set(duplicates)].join(', ')}].`);
  sameSet(values, expectedSet, label);
}

const clean = readJson('public/data/l3pilot_clean.json');
const respondents = readJson('public/data/respondents.json');
const metrics = readJson('public/data/country_metrics.json');
const insights = readJson('public/data/country-insights.json');
const topology = readJson('public/data/countries-110m.json');

console.log('Country integrity audit');
console.log(`Canonical registry: ${expected.length} countries, keyed by workbook code, ISO3, and ISO numeric topology ID.`);
if (expected.length !== 17) note(`Canonical registry has ${expected.length} countries, expected 17.`);
if (duplicate(expected.map((country) => country.code)).length || duplicate(expected.map((country) => country.iso3)).length || duplicate(expected.map((country) => country.isoNumeric)).length) note('Canonical registry contains duplicate stable identifiers.');

const cleanCodes = clean.map((row) => Number(row.country_code));
sameSet(cleanCodes, expectedCodes, 'cleaned survey country codes');
for (const country of expected) {
  const rows = clean.filter((row) => Number(row.country_code) === country.code);
  if (!rows.length) note(`cleaned survey: ${country.iso3} has no respondents.`);
  const badLabels = rows.filter((row) => row.country_label !== country.name);
  if (badLabels.length) note(`cleaned survey: ${country.iso3} has ${badLabels.length} label(s) not equal to "${country.name}".`);
}

const respondentCodes = respondents.map((row) => Number(row.country));
sameSet(respondentCodes, expectedCodes, 'respondent extract country codes');
for (const country of expected) if (!respondentCodes.includes(country.code)) note(`respondent extract: ${country.iso3} has no respondents.`);

const metricEntries = Object.entries(metrics.countries);
exactlyOnce(metricEntries.map(([id]) => id), expectedNumeric, 'country metrics topology IDs');
exactlyOnce(metricEntries.map(([, country]) => country.iso3), expectedIso3, 'country metrics ISO3 IDs');
for (const country of expected) {
  const metric = metrics.countries[country.isoNumeric];
  if (!metric) continue;
  if (metric.iso3 !== country.iso3 || metric.name !== country.name) note(`country metrics: ${country.isoNumeric} is labeled ${metric.name} (${metric.iso3}), expected ${country.name} (${country.iso3}).`);
  const cleanCount = cleanCodes.filter((code) => code === country.code).length;
  if (metric.n !== cleanCount) note(`country metrics: ${country.iso3} n=${metric.n}, cleaned survey count=${cleanCount}.`);
  const age = metric.subgroups?.age ?? [];
  if (age.length !== 5) note(`country profile age data: ${country.iso3} has ${age.length} groups, expected 5.`);
}

exactlyOnce(insights.countries.map((country) => country.iso3), expectedIso3, 'detailed insights ISO3 IDs');
for (const country of expected) {
  const insight = insights.countries.find((item) => item.iso3 === country.iso3);
  if (!insight) continue;
  if (insight.countryCode !== country.code || insight.name !== country.name) note(`detailed insights: ${country.iso3} maps to ${insight.name} (code ${insight.countryCode}), expected ${country.name} (code ${country.code}).`);
  const metric = metrics.countries[country.isoNumeric];
  if (metric && insight.respondents !== metric.n) note(`detailed insights: ${country.iso3} respondents=${insight.respondents}, country metrics n=${metric.n}.`);
}

const topologyIds = new Set(feature(topology, topology.objects.countries).features.map((item) => String(item.id).padStart(3, '0')));
for (const country of expected) if (!topologyIds.has(country.isoNumeric)) note(`map topology: ${country.iso3} (${country.isoNumeric}) has no geometry.`);

// Guard the client join contract: keys and shared selection state must be ISO3;
// labels may only be rendered after the canonical record has been resolved.
const chartSources = [
  ['src/charts/choropleth.js', ['countryById.get(String(d.id).padStart(3, \'0\'))', 'c.iso3']],
  ['src/charts/countryDrilldown.js', ['country.iso3 === iso3']],
  ['src/charts/countryBump.js', ['insightByIso.get(row.iso3)', 'selectedIso.add(row.iso3)']],
  ['src/charts/storyboardCharts.js', ['metricByIso3.get(country.iso3)']],
];
for (const [path, required] of chartSources) {
  const source = readFileSync(path, 'utf8');
  for (const token of required) if (!source.includes(token)) note(`${path}: missing canonical country-key join guard "${token}".`);
}
if (readFileSync('src/charts/storyboardCharts.js', 'utf8').includes('metricByName.get(country.name)')) note('src/charts/storyboardCharts.js still joins map metrics by display name.');

if (fail.length) {
  console.error(`FAILED: ${fail.length} country-integrity issue(s)`);
  fail.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log('PASS: all 17 countries resolve once across cleaned data, respondent data, metrics, insights, and topology.');
  console.log('PASS: map, ranking, profile, rank-filter, detailed-insight, age-profile, and storyboard chart joins use verified canonical IDs.');
}
