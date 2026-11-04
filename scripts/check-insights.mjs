import { readFileSync } from 'node:fs';
import { generateInsights } from '../src/insights.js';

const data = JSON.parse(readFileSync('public/data/country_metrics.json', 'utf8'));
const keys = Object.keys(data.countries).slice(0, 3);
for (const key of keys) {
  const country = data.countries[key];
  console.log(`\n${country.name} (${key})`);
  console.log(JSON.stringify(generateInsights(key, data), null, 2));
}
