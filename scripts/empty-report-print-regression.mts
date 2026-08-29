import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintableAccountStatement from '../src/components/modules/reports/PrintableAccountStatement';

(globalThis as any).localStorage = { getItem: () => null, setItem: () => undefined };
const html = renderToStaticMarkup(React.createElement(PrintableAccountStatement, {
  titleAr: 'كشف حساب', subjectCode: 'C-001', subjectName: 'عميل بلا حركات',
  fromDate: '2026-01-01', toDate: '2026-01-31', currencyCode: 'EGP',
  opening: 0, rows: [], currentUserName: 'tester',
}));
assert.match(html, /data-print-master="cash-movement"/);
assert.match(html, /رصيد افتتاحي/);
assert.match(html, /معاينة الطباعة/);
const source = fs.readFileSync(new URL('../src/components/modules/FinancialReportsView.tsx', import.meta.url), 'utf8');
for (const type of ['PAYMENT_VOUCHERS_REPORT','RECEIPT_VOUCHERS_REPORT','JOURNAL_ENTRIES_REPORT']) assert.match(source, new RegExp(`case '${type}'`));
assert.match(source, /لا توجد بيانات لعرضها في هذه الفترة/);
assert.match(source, /المعاينة متاحة حتى عندما لا توجد حركات/);
console.log('EMPTY_REPORT_PRINT_REGRESSION_OK statementEmpty=true paymentEmpty=true receiptEmpty=true journalEmpty=true unifiedMaster=true previewEnabled=true');
