import { mkdirSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';

const RAW_FILE = 'data/raw/l3pilot_labeled.xlsx';
const OUTPUT_FILE = 'public/data/respondents.json';
const F5_COLUMNS = [
  'f5_1_1_dropdown', 'f5_1_2_dropdown', 'f5_1_3_dropdown', 'f5_1_4_dropdown', 'f5_1_5_dropdown', 'f5_1_6',
  'f5_2_1_dropdown', 'f5_2_2_dropdown', 'f5_2_3_dropdown', 'f5_2_4_dropdown', 'f5_2_5_dropdown', 'f5_2_6',
];
const F13_COLUMNS = ['f13_1', 'f13_2', 'f13_3', 'f13_4'];

function blank(value) { return value === null || value === undefined || value === '' || value === '.'; }
function sourceCode(value) { if (blank(value)) return null; const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; }
// f16 is documented as a five-point agreement scale; code 6 is retained in
// the workbook but is not a scale response. Keep null rather than drop the row.
function agreementScore(value) { const code = sourceCode(value); return code >= 1 && code <= 5 ? code : null; }
function categorical(value) { return blank(value) ? null : String(value).trim(); }

const workbook = XLSX.readFile(RAW_FILE);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null, raw: true });
const respondents = rows.map((row) => {
  const output = {
    country: sourceCode(row.country),
    intention_use: agreementScore(row.f16_10),
    intention_buy: agreementScore(row.f16_23),
    price_surcharge_tier: sourceCode(row.f18a),
    age: sourceCode(row.s1),
    income_tier: sourceCode(row.s3),
  };
  for (const column of F13_COLUMNS) output[column] = sourceCode(row[column]);
  for (const column of F5_COLUMNS) output[column] = categorical(row[column]);
  return output;
});

mkdirSync('public/data', { recursive: true });
writeFileSync(OUTPUT_FILE, `${JSON.stringify(respondents)}\n`);
console.log(`Wrote ${respondents.length} respondents to ${OUTPUT_FILE}. No rows were dropped; invalid/non-scale/blank values are null.`);
for (const [country, values] of Object.entries(Object.groupBy(respondents, (row) => row.country))) console.log(`  country ${country}: n=${values.length}`);
