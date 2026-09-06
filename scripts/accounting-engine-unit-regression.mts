import assert from 'node:assert/strict';
import { initialAccounts } from '../src/data/initialData';
import {
  aggregateAccountBalance, calculateAccountActivity, calculateBalanceSheet,
  calculateCashFlowStatement, calculateEquityChangesStatement, calculateIncomeStatement,
  calculateTrialBalance, canDeleteAccount, canPromoteToParent, childLevelOf, employeeAdvancePostingAccounts,
  expectedCodeLength, isPostingAccount, monthKey, monthlyEmployeeAdvancesAccount, nextAccountCode, nextDocumentNumber,
  nextEntityCode, percentChange, validateAccountCode, validateJournalEntryLines,
} from '../src/utils/accountingEngine';

const accounts = structuredClone(initialAccounts);
const debit = accounts.find(a => isPostingAccount(a) && a.nature === 'DEBIT');
const credit = accounts.find(a => isPostingAccount(a) && a.nature === 'CREDIT');
assert.ok(debit && credit, 'fixture must contain debit and credit posting accounts');
assert.deepEqual([1, 2, 3, 4, 5].map(expectedCodeLength), [1, 2, 4, 6, 10]);
assert.equal(validateAccountCode('1101010001', 5, '110101').valid, true);
assert.equal(validateAccountCode('ABC', 5).valid, false);
assert.equal(validateJournalEntryLines([
  { accountId: debit.id, debit: 100, credit: 0 },
  { accountId: credit.id, debit: 0, credit: 100 },
], accounts).isValid, true);
assert.equal(validateJournalEntryLines([{ accountId: debit.id, debit: 100, credit: 0 }], accounts).isValid, false);

const journal: any = { id: 'engine-unit-1', entryNumber: 'JV-1', date: '2026-08-27', status: 'POSTED', description: 'unit', lines: [
  { id: 'l1', accountId: debit.id, accountCode: debit.code, accountName: debit.nameAr, debit: 100, credit: 0 },
  { id: 'l2', accountId: credit.id, accountCode: credit.code, accountName: credit.nameAr, debit: 0, credit: 100 },
] };
const activity = calculateAccountActivity(accounts, [journal]);
assert.equal(activity[debit.id].debit >= 100, true);
assert.equal(calculateTrialBalance(accounts, [journal]).isBalanced, true);
assert.equal(Number.isFinite(calculateIncomeStatement(accounts, [journal]).netIncome), true);
assert.equal(Number.isFinite(calculateBalanceSheet(accounts, [journal]).totalAssets), true);
assert.ok(calculateCashFlowStatement(accounts, [journal]));
assert.ok(calculateEquityChangesStatement(accounts, [journal]));
const root = accounts.find(a => a.level === 1)!;
assert.equal(Number.isFinite(aggregateAccountBalance(root, accounts, activity)), true);
assert.equal(canDeleteAccount(root, accounts, []).allowed, false);
assert.equal(canPromoteToParent(debit, [journal]).allowed, false);
assert.equal(childLevelOf(root), 2);
assert.match(nextAccountCode(accounts, root.id), /^\d+$/);
assert.equal(nextEntityCode([{ code: 'CUS-001' }], 'CUS'), 'CUS-002');
assert.equal(nextDocumentNumber('JV', [{ entryNumber: 'JV-9' }]), 'JV-10');
assert.equal(percentChange(120, 100), 20);
assert.equal(percentChange(1, 0), null);
assert.equal(monthKey(new Date(2026, 7, 27)), '2026-08');
const monthlyAdvances = monthlyEmployeeAdvancesAccount();
assert.equal(monthlyAdvances.code, '1102060001');
assert.equal(monthlyAdvances.nameAr, 'سلف الموظفين الشهرية');
assert.equal(monthlyAdvances.level, 5);
assert.ok(accounts.some(account => account.code === '1102050001' && account.nameAr === 'عُهد الموظفين'));
assert.ok(accounts.some(account => account.code === '110206' && account.level === 4 && account.nameAr === 'سلف الموظفين الشهرية'));
assert.ok(accounts.some(account => account.code === '1102060001' && account.parentId === '110206' && account.nameAr === 'سلف الموظفين الشهرية'));
assert.deepEqual(employeeAdvancePostingAccounts(accounts).map(account => account.code).filter(code => code === '1102050001' || code === '1102060001'), ['1102050001', '1102060001']);
console.log('ACCOUNTING_ENGINE_UNIT_OK validation=true hierarchy=true activity=true statements=true numbering=true periods=true');
