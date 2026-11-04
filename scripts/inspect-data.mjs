import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

const RAW_FILE = 'data/raw/l3pilot_labeled.xlsx';
const workbook = XLSX.readFile(RAW_FILE, { cellDates: true });

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function inferType(values) {
  const present = values.filter((value) => !isMissing(value));
  if (!present.length) return 'empty';
  if (present.every((value) => value instanceof Date)) return 'date';
  if (present.every((value) => typeof value === 'number')) return 'numeric';
  if (present.every((value) => typeof value === 'boolean')) return 'boolean';
  return 'string/categorical';
}

function formatValue(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

const output = [];
const print = (line = '') => output.push(line);
print(`# L3Pilot Data Profile\n`);
print(`- Source: \`${RAW_FILE}\``);
print(`- Sheets: ${workbook.SheetNames.map((name) => `\`${name}\``).join(', ')}\n`);

for (const sheetName of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  print(`## ${sheetName}\n`);
  print(`- Row count: ${rows.length}`);
  print(`- Column count: ${columns.length}\n`);
  print('| Column | Inferred type | Missing | Unique | Details |');
  print('| --- | --- | ---: | ---: | --- |');

  for (const column of columns) {
    const values = rows.map((row) => row[column]);
    const present = values.filter((value) => !isMissing(value));
    const unique = [...new Set(present.map(formatValue))];
    const type = inferType(values);
    let details = '';

    if (type === 'numeric') {
      const numeric = present;
      details = `min: ${Math.min(...numeric)}; max: ${Math.max(...numeric)}`;
    } else if ((type === 'string/categorical' || type === 'boolean') && unique.length <= 30) {
      details = unique.map((value) => `\`${value.replaceAll('`', "'")}\``).join(', ');
    } else if (type === 'string/categorical') {
      details = 'High-cardinality text';
    }

    print(`| ${column.replaceAll('|', '\\|')} | ${type} | ${values.length - present.length} | ${unique.length} | ${details} |`);
  }
  print('');
}

const report = `${output.join('\n')}\n`;
if (process.argv[2]) {
  mkdirSync('docs', { recursive: true });
  writeFileSync(process.argv[2], report);
}
console.log(report);
