import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/modules/FinancialReportsView.tsx', 'utf8');
assert.doesNotMatch(source, /reportType === rt\s*\? 'bg-\[#006fba\] text-white shadow-lg shadow-sky-500\/30'/);
assert.doesNotMatch(source, /reportType === rt\s*\? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500\/30'/);
assert.match(source, /bg-sky-500\/15 text-sky-600[^\"]+dark:text-sky-400/);
assert.match(source, /bg-emerald-500\/15 text-emerald-600[^\"]+dark:text-emerald-400/);
console.log('REPORT_ICON_THEME_OK selectedMatchesPeers=true lightMode=true darkMode=true general=true entity=true');
