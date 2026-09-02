import assert from 'node:assert/strict';
import fs from 'node:fs';

const login = fs.readFileSync('src/components/LoginView.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const settings = fs.readFileSync('src/components/modules/SettingsView.tsx', 'utf8');
const reports = fs.readFileSync('src/components/modules/FinancialReportsView.tsx', 'utf8');
const statement = fs.readFileSync('src/components/modules/StatementOfAccountView.tsx', 'utf8');

assert.match(login, /العام الافتراضي للتقارير/);
assert.match(login, /onLogin\(username, password, fiscalYear\)/);
assert.match(login, /fiscalYears\.map/);
assert.doesNotMatch(settings, /السنة المالية الافتراضية|settings\.fiscalYear/);
assert.match(app, /availableReportingYears/);
assert.match(app, /const MIN_REPORTING_YEAR = 2026/);
assert.match(app, /Number\(value\) >= MIN_REPORTING_YEAR/);
assert.match(app, /for \(let year = MIN_REPORTING_YEAR;/);
assert.doesNotMatch(app, /current - 5/);
assert.match(app, /availableReportingYears\.includes\(fiscalYear\)/);
assert.match(app, /sessionStorage\.setItem\(REPORTING_YEAR_SESSION_KEY, fiscalYear\)/);
assert.match(app, /fiscalYears=\{availableReportingYears\}/);
assert.match(app, /fiscalYear=\{reportingYear\}/);
assert.match(reports, /configuredFiscalPeriod\(fiscalYear\)/);
assert.match(reports, /start: `\$\{year\}-01-01`, end: `\$\{year\}-12-31`/);
assert.match(statement, /setFromDate\(`\$\{fiscalYear\}-01-01`\)/);
assert.match(statement, /import \{ defaultReportToDate \}/);
assert.match(statement, /useState<string>\(defaultReportToDate\)/);
assert.ok((statement.match(/setToDate\(defaultReportToDate\(\)\)/g) || []).length >= 2);

console.log('LOGIN_FISCAL_YEAR_OK loginSelector=true movedFromSettings=true availableYearsFromData=true selectionValidated=true sessionScoped=true reportsPeriod=true statementsStartAtYear=true statementsEndAtToday=true');
