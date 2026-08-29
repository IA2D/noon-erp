import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'src');
const files: string[] = [];
const walk = (dir: string) => readdirSync(dir).forEach(name => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) walk(path);
  else if (/\.tsx?$/.test(path)) files.push(path);
});
walk(src);

const rows = files.map(path => ({
  path: relative(root, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));
const all = rows.map(row => row.text).join('\n');
const count = (pattern: RegExp) => [...all.matchAll(pattern)].length;
const largeFiles = rows
  .map(row => ({ path: row.path, lines: row.text.split(/\r?\n/).length }))
  .filter(row => row.lines >= 750)
  .sort((a, b) => b.lines - a.lines);

const result = {
  sourceFiles: files.length,
  sourceLines: rows.reduce((sum, row) => sum + row.text.split(/\r?\n/).length, 0),
  largeFiles,
  buttons: count(/<button\b/g),
  ariaLabels: count(/aria-label=/g),
  hardcodedFiscalDates: count(/2025-01-01|2026-12-31/g),
  fixedTwoDecimalFormatting: count(/round2\(|toFixed\(2\)|maximumFractionDigits:\s*2/g),
  directLocalStorageCalls: count(/(?:window\.)?localStorage\./g),
  attachmentFieldsInFinancialDocuments: rows
    .filter(row => /types\/erp\.ts|JournalEntriesView|PaymentVouchersView|ReceiptVouchersWindow/.test(row.path))
    .reduce((sum, row) => sum + [...row.text.matchAll(/attachment|attachments|مرفق/g)].length, 0),
};

console.log(`SYSTEM_EVALUATION_OK ${JSON.stringify(result)}`);
