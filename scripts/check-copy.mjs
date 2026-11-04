import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const targets = ['index.html'];
function collect(directory) {
  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else targets.push(path);
  });
}
collect('src');
const violations = targets.filter((path) => readFileSync(path, 'utf8').includes('—'));
if (violations.length) {
  console.error(`Copy check failed. Em dash found in: ${violations.join(', ')}`);
  process.exit(1);
}
console.log('Copy check passed. No em dashes in index.html or src/.');
