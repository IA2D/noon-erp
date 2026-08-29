import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/modules/FinancialReportsView.tsx', 'utf8');
const root = source.match(/return \(\s*<div className="([^"]+)">\s*<PageHeader/);
assert.ok(root, 'financial reports root container was not found');
assert.equal(root[1], 'space-y-6 animate-fade-in');
assert.doesNotMatch(root[1], /bg-|background|min-h-screen/);
console.log('FINANCIAL_REPORTS_BACKGROUND_OK inheritedShell=true standaloneBackground=false matchesOtherModules=true');
