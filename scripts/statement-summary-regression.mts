import assert from 'node:assert/strict';
import { summarizeStatementsByCurrency } from '../src/utils/statementSummary';

const analyticalCashStatements = [
  {
    key: 'CASHBOX_REPORT-cash-yer', subjectCode: 'CSH-001', subjectName: 'صندوق يمني', opening: 1000,
    openingByCurrency: { YER: 1000 },
    rows: [
      { debit: 250, credit: 0, currency: 'YER' },
      { debit: 0, credit: 100, currency: 'YER' },
      { debit: 0, credit: 50, currency: 'YER' },
    ],
  },
  {
    key: 'CASHBOX_REPORT-cash-usd', subjectCode: 'CSH-002', subjectName: 'صندوق دولار', opening: 10,
    openingByCurrency: { USD: 10 },
    rows: [
      { debit: 50, credit: 0, currency: 'USD' },
      { debit: 0, credit: 12.5, currency: 'USD' },
      // This is a second movement that used to be the kind missed by an
      // independently-filtered aggregate report.
      { debit: 7.5, credit: 0, currency: 'USD' },
    ],
  },
  {
    key: 'CASHBOX_REPORT-cash-multi', subjectCode: 'CSH-003', subjectName: 'صندوق متعدد', opening: 0,
    openingByCurrency: { YER: 20, SAR: 5 },
    rows: [
      { debit: 30, credit: 0, currency: 'YER' },
      { debit: 0, credit: 2, currency: 'SAR' },
    ],
  },
];

const summary = summarizeStatementsByCurrency(analyticalCashStatements, 'YER');
const yer = summary.filter(row => row.currency === 'YER');
const usd = summary.find(row => row.currency === 'USD');
const sar = summary.find(row => row.currency === 'SAR');
assert.deepEqual(yer.map(row => [row.subjectCode, row.closing]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))), [['CSH-001', 1100], ['CSH-003', 50]]);
assert.deepEqual([usd?.opening, usd?.debit, usd?.credit, usd?.closing], [10, 57.5, 12.5, 55]);
assert.deepEqual([sar?.opening, sar?.debit, sar?.credit, sar?.closing], [5, 0, 2, 3]);
for (const row of summary) assert.equal(row.closing, row.opening + row.debit - row.credit);

console.log('STATEMENT_SUMMARY_REGRESSION_OK exactAnalyticalMovements=true perCurrencyClosing=true cashBoxMixedCurrencies=true');
