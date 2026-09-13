import assert from 'node:assert/strict';
import { buildFiscalYearOpeningSnapshot } from '../src/utils/fiscalYearClosing';
import type { Account, CashBox, JournalEntry } from '../src/types/erp';

const posting = (id: string, code: string, nameAr: string, subLedgerType: Account['subLedgerType']): Account => ({
  id, code, nameAr, nameEn: nameAr, level: 5, accountType: 2, reportType: 1,
  nature: code.startsWith('1') ? 'DEBIT' : 'CREDIT', category: 'BALANCE_SHEET', subLedgerType,
  currencies: [{ id: `${id}-yer`, code: 'YER', isDefault: true, isActive: true }, { id: `${id}-usd`, code: 'USD', isDefault: false, isActive: true }],
  defaultCurrency: 'YER', openingBalance: 0, isActive: true, openingBalances: [],
});
const accounts = [posting('cash', '1101010001', 'الصندوق', 'CASH_BOX'), posting('equity', '2202010001', 'أرباح مبقاة', 'NONE')];
const cashBox: CashBox = {
  id: 'box', code: 'CSH-1', nameAr: 'صندوق USD', nameEn: 'USD box', linkedAccountId: 'cash', defaultCurrency: 'USD', isActive: true,
  boxType: 'MAIN', currencies: [{ id: 'box-usd', code: 'USD', isDefault: true, isActive: true }], createdAt: '2026-01-01',
  openingBalance: 37.5, openingBalanceForeign: 10, openingBalances: [{
    id: 'box-opening', fiscalYear: '2026', accountId: 'cash', subAccountId: 'box', currency: 'USD', exchangeRate: 3.75,
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
const snapshot = buildFiscalYearOpeningSnapshot({
  accounts, journals: [journal], cashBoxes: [cashBox], bankAccounts: [], customers: [], vendors: [], employees: [],
  sourceYear: '2026', targetYear: '2027', baseCurrency: 'YER',
});
const box = snapshot.cashBoxes[0];
assert.equal(box.openingBalances?.length, 2);
assert.equal(box.openingBalances?.reduce((sum, row) => sum + (row.foreignAmount || 0), 0), 15);
assert.equal(box.openingBalances?.reduce((sum, row) => sum + (row.amount || 0), 0), 56.25);
assert.equal(box.openingBalances?.find(row => row.costCenterId === 'cc1')?.foreignAmount, 5);
assert.ok(box.openingBalances?.every(row => row.currency === 'USD' && row.fiscalYear === '2027'));
const control = snapshot.accounts.find(account => account.id === 'cash')!;
assert.equal(control.openingBalance, 56.25);
assert.equal(control.openingBalances?.[0].foreignAmount, 15);
assert.equal(snapshot.lines.reduce((sum, line) => sum + line.debit, 0), 56.25);
assert.equal(snapshot.lines.reduce((sum, line) => sum + line.credit, 0), 56.25);
console.log('FISCAL_YEAR_CLOSING_OK analytical=true currencies=USD foreign=15 local=56.25 costCenter=true balanced=true');
