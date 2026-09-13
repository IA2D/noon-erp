import assert from 'node:assert/strict';
import { buildFiscalYearOpeningSnapshot } from '../src/utils/fiscalYearClosing';
import type { Account, CashBox, JournalEntry } from '../src/types/erp';

const posting = (id: string, code: string, nameAr: string, subLedgerType: Account['subLedgerType']): Account => ({
  id, code, nameAr, nameEn: nameAr, level: 5, accountType: 2, reportType: 1,
  nature: code.startsWith('1') ? 'DEBIT' : 'CREDIT', category: 'BALANCE_SHEET', subLedgerType,
  currencies: [{ id: `${id}-yer`, code: 'YER', isDefault: true, isActive: true }, { id: `${id}-usd`, code: 'USD', isDefault: false, isActive: true }],
  defaultCurrency: 'YER', openingBalance: 0, isActive: true, openingBalances: [],
});
const accounts = [
  {
    ...posting('cash', '1101010001', 'الصندوق', 'CASH_BOX'),
    // Legacy restore fixture: the parent/control account stored the same total
    // that is already owned by its analytical cash-box row.
    openingBalance: 37.5,
    openingBalances: [{
      id: 'legacy-control-total', fiscalYear: '2026', accountId: 'cash', currency: 'YER', exchangeRate: 1,
      debit: 37.5, credit: 0, debitLocal: 37.5, creditLocal: 0, amount: 37.5, foreignAmount: 37.5, rate: 1,
    }],
  },
  { ...posting('equity', '2202010001', 'أرباح مبقاة', 'NONE'), openingBalance: -37.5, openingBalances: [{
    id: 'retained-opening', fiscalYear: '2026', accountId: 'equity', currency: 'YER', exchangeRate: 1,
    debit: 0, credit: 37.5, debitLocal: 0, creditLocal: 37.5, amount: -37.5, foreignAmount: -37.5, rate: 1,
  }] },
  { ...posting('revenue', '3101010001', 'إيرادات تشغيلية', 'NONE'), nature: 'CREDIT' as const, category: 'INCOME_STATEMENT' as const },
  { ...posting('expense', '4101010001', 'مصروفات تشغيلية', 'NONE'), nature: 'DEBIT' as const, category: 'INCOME_STATEMENT' as const },
];
const cashBox: CashBox = {
  id: 'box', code: 'CSH-1', nameAr: 'صندوق USD', nameEn: 'USD box', linkedAccountId: 'cash', defaultCurrency: 'USD', isActive: true,
  boxType: 'MAIN', currencies: [{ id: 'box-usd', code: 'USD', isDefault: true, isActive: true }], createdAt: '2026-01-01',
  openingBalance: 37.5, openingBalanceForeign: 10, openingBalances: [{
    id: 'box-opening', fiscalYear: '2026', accountId: 'cash', subAccountId: 'box', currency: 'USD', exchangeRate: 3.75,
    debit: 10, credit: 0, debitLocal: 37.5, creditLocal: 0, amount: 37.5, foreignAmount: 10, rate: 3.75,
  }, {
    // Legacy restore fixture: the same entity/currency row was appended twice.
    id: 'box-opening-legacy-duplicate', fiscalYear: '2026', accountId: 'cash', subAccountId: 'box', currency: 'USD', exchangeRate: 3.75,
    debit: 10, credit: 0, debitLocal: 37.5, creditLocal: 0, amount: 37.5, foreignAmount: 10, rate: 3.75,
  }],
};
const journal: JournalEntry = {
  id: 'j1', entryNumber: 'JV-1', date: '2026-06-01', reference: 'REF', narration: 'USD movement', status: 'POSTED',
  totalDebit: 18.75, totalCredit: 18.75, currency: 'YER', exchangeRate: 1, createdBy: 'test', createdAt: '2026-06-01', lines: [
    { id: 'l1', accountId: 'cash', accountCode: '1101010001', accountNameAr: 'الصندوق', description: 'cash', debit: 18.75, credit: 0, debitForeign: 5, creditForeign: 0, currency: 'USD', exchangeRate: 3.75, subLedgerType: 'CASH_BOX', subLedgerId: 'box', costCenterId: 'cc1' },
    { id: 'l2', accountId: 'equity', accountCode: '2202010001', accountNameAr: 'أرباح مبقاة', description: 'equity', debit: 0, credit: 18.75, currency: 'YER', exchangeRate: 1 },
  ],
};
const incomeJournal: JournalEntry = {
  id: 'j2', entryNumber: 'JV-2', date: '2026-12-31', reference: 'YEAR-END', narration: 'income statement result', status: 'POSTED',
  totalDebit: 100, totalCredit: 100, currency: 'YER', exchangeRate: 1, createdBy: 'test', createdAt: '2026-12-31', lines: [
    { id: 'l3', accountId: 'cash', accountCode: '1101010001', accountNameAr: 'الصندوق', description: 'cash', debit: 60, credit: 0, currency: 'YER', exchangeRate: 1, subLedgerType: 'CASH_BOX', subLedgerId: 'box' },
    { id: 'l4', accountId: 'expense', accountCode: '4101010001', accountNameAr: 'مصروفات تشغيلية', description: 'expense', debit: 40, credit: 0, currency: 'YER', exchangeRate: 1 },
    { id: 'l5', accountId: 'revenue', accountCode: '3101010001', accountNameAr: 'إيرادات تشغيلية', description: 'revenue', debit: 0, credit: 100, currency: 'YER', exchangeRate: 1 },
  ],
};
const snapshot = buildFiscalYearOpeningSnapshot({
  accounts, journals: [journal, incomeJournal], cashBoxes: [cashBox], bankAccounts: [], customers: [], vendors: [], employees: [],
  sourceYear: '2026', targetYear: '2027', baseCurrency: 'YER',
});
const box = snapshot.cashBoxes[0];
assert.equal(box.openingBalances?.length, 3);
assert.equal(box.openingBalances?.reduce((sum, row) => sum + (row.foreignAmount || 0), 0), 75);
assert.equal(box.openingBalances?.reduce((sum, row) => sum + (row.amount || 0), 0), 116.25);
assert.equal(box.openingBalances?.find(row => row.costCenterId === 'cc1')?.foreignAmount, 5);
assert.deepEqual(new Set(box.openingBalances?.map(row => row.currency)), new Set(['USD', 'YER']));
assert.ok(box.openingBalances?.every(row => row.fiscalYear === '2027'));
const control = snapshot.accounts.find(account => account.id === 'cash')!;
assert.equal(control.openingBalance, 116.25);
assert.equal(control.openingBalances?.reduce((sum, row) => sum + (row.foreignAmount || 0), 0), 75);
assert.equal(snapshot.openings.filter(row => row.accountId === 'equity' && row.currency === 'YER').length, 1);
assert.equal(snapshot.openings.reduce((sum, row) => sum + (row.debitLocal || 0), 0), 116.25);
assert.equal(snapshot.openings.reduce((sum, row) => sum + (row.creditLocal || 0), 0), 116.25);
assert.ok(snapshot.openings.every(row => row.documentRef === 'CARRY-2026-2027'));
assert.ok(snapshot.excludedAccountIds.has('revenue') && snapshot.excludedAccountIds.has('expense'));
assert.equal(snapshot.accounts.find(account => account.id === 'revenue')?.openingBalance, 0);
assert.equal(snapshot.accounts.find(account => account.id === 'expense')?.openingBalance, 0);
assert.deepEqual(snapshot.validation, { ok: true, sourceClosingLocal: 0, sourceIncomeStatementLocal: -60, targetOpeningLocal: 0, comparedKeys: 4, errors: [] });
assert.throws(() => buildFiscalYearOpeningSnapshot({
  accounts, journals: [{ ...journal, lines: journal.lines.slice(0, 1) }], cashBoxes: [cashBox], bankAccounts: [], customers: [], vendors: [], employees: [],
  sourceYear: '2026', targetYear: '2027', baseCurrency: 'YER',
}), /ROLLOVER_SOURCE_TRIAL_BALANCE_UNBALANCED/);
console.log('FISCAL_YEAR_CLOSING_OK sourceTrialBalance=true exactKeys=4 analytical=true currencies=USD+YER foreign=75 local=116.25 pnlClosedOnce=-60 chartPreserved=true balanced=true atomicReject=true noJournal=true');
