import assert from 'node:assert/strict';
import type { Account, JournalEntry, JournalLine } from '../src/types/erp';
import { calculateBalanceSheet, calculateCashFlowStatement, calculateEquityChangesStatement, calculateIncomeStatement } from '../src/utils/accountingEngine';
import { buildPeriodAccounts, calculatePeriodMovement, postedJournalsInRange, validateReportPeriod } from '../src/utils/reportingPeriod';

const account = (id: string, code: string, level: 1 | 2 | 3 | 4 | 5, nature: 'DEBIT' | 'CREDIT', parentId?: string, openingBalance = 0): Account => ({
  id, code, level, nature, parentId, openingBalance,
  nameAr: code, nameEn: code, accountType: level === 5 ? 2 : 1,
  reportType: code.startsWith('3') || code.startsWith('4') ? 2 : 1,
  category: code.startsWith('3') || code.startsWith('4') ? 'INCOME_STATEMENT' : 'BALANCE_SHEET',
  subLedgerType: 'NONE', currencies: [], defaultCurrency: 'YER', isActive: true,
});

const line = (id: string, accountId: string, debit: number, credit: number): JournalLine => ({
  id, accountId, accountCode: accountId, accountNameAr: accountId, debit, credit, description: id,
});

const journal = (id: string, date: string, lines: JournalLine[], status: JournalEntry['status'] = 'POSTED'): JournalEntry => ({
  id, entryNumber: id, date, reference: id, narration: id, lines,
  totalDebit: lines.reduce((sum, item) => sum + item.debit, 0),
  totalCredit: lines.reduce((sum, item) => sum + item.credit, 0),
  currency: 'YER', exchangeRate: 1, status, createdBy: 'test', createdAt: `${date}T00:00:00.000Z`,
});

const accounts: Account[] = [
  account('assets-root', '1', 1, 'DEBIT'),
  account('current-assets', '11', 2, 'DEBIT', 'assets-root'),
  account('cash-group', '1101', 3, 'DEBIT', 'current-assets'),
  account('cash-control', '110101', 4, 'DEBIT', 'cash-group'),
  account('cash', '1101010001', 5, 'DEBIT', 'cash-control', 100),
  account('equity-root', '2', 1, 'CREDIT'),
  account('equity', '22', 2, 'CREDIT', 'equity-root'),
  account('equity-group', '2201', 3, 'CREDIT', 'equity'),
  account('capital-control', '220101', 4, 'CREDIT', 'equity-group'),
  account('capital', '2201010001', 5, 'CREDIT', 'capital-control', -100),
  account('revenue-root', '3', 1, 'CREDIT'),
  account('revenue', '31', 2, 'CREDIT', 'revenue-root'),
  account('revenue-group', '3101', 3, 'CREDIT', 'revenue'),
  account('revenue-control', '310101', 4, 'CREDIT', 'revenue-group'),
  account('sales', '3101010001', 5, 'CREDIT', 'revenue-control', -999),
  account('expense-root', '4', 1, 'DEBIT'),
  account('expense', '41', 2, 'DEBIT', 'expense-root'),
  account('expense-group', '4101', 3, 'DEBIT', 'expense'),
  account('expense-control', '410101', 4, 'DEBIT', 'expense-group'),
  account('rent', '4101010001', 5, 'DEBIT', 'expense-control', 777),
];

const journals = [
  journal('before', '2025-12-31', [line('b1', 'cash', 20, 0), line('b2', 'capital', 0, 20)]),
  journal('sale', '2026-01-10', [line('s1', 'cash', 40, 0), line('s2', 'sales', 0, 40)]),
  journal('rent', '2026-01-11', [line('r1', 'rent', 10, 0), line('r2', 'cash', 0, 10)]),
  journal('pending', '2026-01-12', [line('d1', 'cash', 500, 0), line('d2', 'sales', 0, 500)], 'PENDING_POSTING'),
  journal('after', '2026-02-01', [line('a1', 'cash', 900, 0), line('a2', 'sales', 0, 900)]),
  journal('voided', '2026-01-15', [line('v1', 'cash', 700, 0), line('v2', 'sales', 0, 700)], 'VOIDED'),
  journal('contra', '2026-01-16', [line('c1', 'cash', 15, 0), line('c2', 'cash', 0, 15)]),
];

assert.deepEqual(validateReportPeriod('2026-01-01', '2026-01-31'), { valid: true });
assert.equal(validateReportPeriod('2026-02-01', '2026-01-31').valid, false);

const allPeriodJournals = postedJournalsInRange(journals, '2026-01-01', '2026-01-31');
const periodJournals = allPeriodJournals.filter(item => item.id !== 'contra');
assert.deepEqual(allPeriodJournals.map(item => item.id), ['sale', 'rent', 'contra']);
assert.equal(postedJournalsInRange([], '2026-01-01', '2026-01-31').length, 0, 'empty report must be supported');
assert.equal(periodJournals.some(item => item.id === 'voided'), false, 'voided entries must be excluded');

const periodAccounts = buildPeriodAccounts(accounts, journals, '2026-01-01', true);
assert.equal(calculatePeriodMovement(periodAccounts, allPeriodJournals).cash.debit, 55, 'contra movement must net normally');
assert.equal(buildPeriodAccounts(accounts, journals, '2026-03-01', true).find(item => item.id === 'cash')?.openingBalance, 1050, 'opening-only period must retain opening balance');
assert.equal(periodAccounts.find(item => item.id === 'cash')?.openingBalance, 120);
assert.equal(periodAccounts.find(item => item.id === 'capital')?.openingBalance, -120);
assert.equal(periodAccounts.find(item => item.id === 'sales')?.openingBalance, -999);
assert.equal(buildPeriodAccounts(accounts, journals, '2026-01-01', false).find(item => item.id === 'cash')?.openingBalance, 0);

const movement = calculatePeriodMovement(periodAccounts, periodJournals);
assert.deepEqual(movement.cash, { debit: 40, credit: 10 });

const income = calculateIncomeStatement(periodAccounts, periodJournals);
assert.equal(income.totalRevenues, 40, 'income report must exclude revenue opening balances');
assert.equal(income.totalOperatingExpenses, 10, 'income report must exclude expense opening balances');
assert.equal(income.netIncome, 30);

const asOf = calculateBalanceSheet(
  accounts.map(item => ({ ...item, openingBalance: item.id === 'sales' || item.id === 'rent' ? 0 : item.openingBalance })),
  postedJournalsInRange(journals, '1900-01-01', '2026-01-31')
);
assert.equal(asOf.totalAssets, 150);
assert.equal(asOf.totalEquity, 150);
assert.equal(asOf.totalLiabilitiesAndEquity, 150);
assert.equal(asOf.isBalanced, true);

const cashFlow = calculateCashFlowStatement(periodAccounts, periodJournals);
assert.equal(cashFlow.operating, 30);
assert.equal(cashFlow.netChange, 30);
assert.equal(cashFlow.openingCash, 120);
assert.equal(cashFlow.closingCash, 150);
assert.equal(cashFlow.isReconciled, true);

const equityChanges = calculateEquityChangesStatement(
  accounts.map(item => ({ ...item, openingBalance: item.id === 'sales' || item.id === 'rent' ? 0 : item.openingBalance })),
  postedJournalsInRange(journals, '1900-01-01', '2026-01-31')
);
assert.equal(equityChanges.openingEquity, 100);
assert.equal(equityChanges.ownerMovements, 20);
assert.equal(equityChanges.netIncome, 30);
assert.equal(equityChanges.closingEquity, 150);
assert.equal(equityChanges.isReconciled, true);

console.log('ACCOUNTING_REPORT_REGRESSION_OK period=2026-01 openingCash=120 openingCapital=-120 movementCash=40/10 revenue=40 expense=10 netIncome=30 assets=150 liabilitiesEquity=150 cashFlowClosing=150 cashFlowReconciled=true equityClosing=150 equityReconciled=true balanced=true pendingExcluded=true');
