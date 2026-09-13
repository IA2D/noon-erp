import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const reports = readFileSync('src/components/modules/FinancialReportsView.tsx', 'utf8');
const statement = readFileSync('src/components/modules/StatementOfAccountView.tsx', 'utf8');
const indicators = readFileSync('src/components/modules/DashboardView.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const closing = readFileSync('src/components/modules/ClosingView.tsx', 'utf8');

const rollover = app.slice(app.indexOf('const handleCreateOpeningEntry'), app.indexOf('const handleUpdateJournalBoolean'));
assert.match(rollover, /journals:\s*\[\]/, 'target year must not receive a rollover journal');
assert.doesNotMatch(rollover, /entryKind:\s*'OPENING_AUDIT'/, 'rollover must not create an audit journal');
assert.match(rollover, /openingEntryId:\s*undefined/, 'source period must not link a removed rollover journal');
assert.match(reports, /سنة بيانات التقرير/);
assert.match(statement, /سنة كشف الحساب/);
assert.match(indicators, /سنة المؤشرات المالية/);
assert.match(indicators, /financial-indicators-comparison-year/);
assert.match(indicators, /مؤشرات المركز المالي/);
assert.match(indicators, /نسبة التداول/);
assert.match(indicators, /الذمم المدينة/);
assert.match(app, /loadFiscalYearReportDataset/);
assert.match(navbar, /data-testid="navbar-fiscal-year"/);
assert.doesNotMatch(navbar, /absolute left-1\/2 -translate-x-1\/2/);
assert.match(closing, /دون إنشاء قيد يومية/);

console.log('FISCAL_YEAR_CROSS_REPORTING_OK reportYearSelector=true statementYearSelector=true indicatorsYearSelector=true indicatorsOperational=true navbarLeftTools=true noRolloverJournal=true');
