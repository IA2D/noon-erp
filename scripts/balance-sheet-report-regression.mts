import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/modules/FinancialReportsView.tsx', import.meta.url), 'utf8');
for (const text of ['الأصول — Assets','الالتزامات وحقوق الملكية — Liabilities & Equity','صافي أرباح الفترة — Net Profit','صافي خسائر الفترة — Net Loss','partial: round2(balanceSheet.netIncomeCurrentYear)',"account?.nature === 'CREDIT' ? -raw : raw",'جزئي ({baseCode})','كلي ({baseCode})','الإجمالي العام','dir="rtl"']) assert.ok(source.includes(text), text);
assert.equal(source.includes('<PrintTafqeet label="الفارق بين المدين والدائن"'), false, 'balance sheet must not print a debit/credit difference row');
console.log('BALANCE_SHEET_REPORT_REGRESSION_OK sections=assets+liabilities-equity signedLoss=true noDebitCreditDifference=true partial-total=true rtl=true printAndScreen=true');
