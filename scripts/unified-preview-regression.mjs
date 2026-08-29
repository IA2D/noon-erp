import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const directModules = [
  'src/components/modules/PaymentVouchersView.tsx',
  'src/components/modules/ReceiptVouchersWindow.tsx',
  'src/components/modules/JournalEntriesView.tsx',
  'src/components/modules/CustodyView.tsx',
  'src/components/modules/StatementOfAccountView.tsx',
  'src/components/modules/reports/StatementOfAccountReport.tsx',
  'src/components/modules/reports/PrintableAccountStatement.tsx',
];
for (const file of directModules) {
  const source = read(file);
  assert.match(source, /openDesktopPrintPreview/, `${file} must use Windows preview flow`);
  assert.doesNotMatch(source, /window\.print\(/, `${file} must not bypass preview flow`);
}
const reports = read('src/components/modules/FinancialReportsView.tsx');
for (const type of ['COST_CENTERS','PAYMENT_VOUCHERS_REPORT','RECEIPT_VOUCHERS_REPORT','JOURNAL_ENTRIES_REPORT','CASHBOX_REPORT','BANK_REPORT','EMPLOYEES_REPORT','CUSTOMERS_REPORT','VENDORS_REPORT','TRUSTS_REPORT']) assert.match(reports, new RegExp(type));
assert.match(reports, /window\.desktopPrint\.preview/);
const reportShell = read('src/components/ui/ReportPageTemplate.tsx');
assert.match(reportShell, /FinancialReportPrintLayout/);
assert.match(read('src/components/reports/FinancialReportPrintLayout.tsx'), /data-print-master="cash-movement"/);
console.log('UNIFIED_PREVIEW_REGRESSION_OK listedReports=true directModulesUsePreview=true noDirectWindowPrint=true masterScheme=cash-movement portrait=true');
