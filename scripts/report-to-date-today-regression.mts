import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defaultReportToDate, toLocalIsoDate } from '../src/utils/dateDefaults';

const financial = fs.readFileSync('src/components/modules/FinancialReportsView.tsx', 'utf8');
const statement = fs.readFileSync('src/components/modules/StatementOfAccountView.tsx', 'utf8');

assert.equal(toLocalIsoDate(new Date(2026, 7, 28, 23, 59)), '2026-08-28');
assert.equal(defaultReportToDate(), toLocalIsoDate(new Date()));
assert.match(financial, /const \[toDate, setToDate\] = useState\(defaultReportToDate\)/);
assert.match(financial, /setToDate\(defaultReportToDate\(\)\)/g);
assert.doesNotMatch(financial, /useState\(\(\) => configuredFiscalPeriod\(fiscalYear\)\.end\)/);
assert.match(statement, /const \[toDate, setToDate\] = useState<string>\(defaultReportToDate\)/);
assert.match(statement, /setToDate\(defaultReportToDate\(\)\)/g);
assert.doesNotMatch(statement, /setToDate\(`\$\{fiscalYear\}-12-31`\)/);

console.log(`REPORT_TO_DATE_TODAY_OK default=${defaultReportToDate()} financialReports=true statementReports=true fiscalYearChange=true reset=true localCalendar=true`);
