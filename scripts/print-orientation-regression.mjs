import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/modules/FinancialReportsView.tsx', import.meta.url), 'utf8');
assert.match(source, /const LANDSCAPE_REPORTS: ReportType\[\] = \[\]/);
assert.doesNotMatch(source, /printReport\(true\)/);
assert.doesNotMatch(source, /orientation="landscape"/);
assert.doesNotMatch(source, /size:\s*A4 landscape/);
assert.match(fs.readFileSync(new URL('../electron/report-layout.mjs', import.meta.url),'utf8'), /size:\s*A4 portrait/);
assert.match(fs.readFileSync(new URL('../electron/report-pdf.mjs', import.meta.url),'utf8'), /landscape: false/);
console.log('PRINT_ORIENTATION_REGRESSION_OK allFinancialReports=portrait windowsPreviewLandscapeFlag=false embeddedPageRule=portrait');
