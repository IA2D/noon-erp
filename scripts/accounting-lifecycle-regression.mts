import assert from 'node:assert/strict';
import type { Account, JournalEntry } from '../src/types/erp';
import { buildLinkedReversal, linkOriginalToReversal } from '../src/utils/accountingLifecycle';
import { calculateAccountActivity } from '../src/utils/accountingEngine';

const account = (id: string): Account => ({ id, code: id, nameAr: id, nameEn: id, level: 5, accountType: 2, reportType: 1, nature: 'DEBIT', category: 'BALANCE_SHEET', subLedgerType: 'NONE', currencies: [], defaultCurrency: 'YER', openingBalance: 0, isActive: true });
const accounts = [account('cash'), account('expense')];
const original: JournalEntry = {
  id: 'j1', entryNumber: 'JV-1', date: '2026-01-01', reference: 'DOC-1', narration: 'original',
  lines: [
    { id: 'l1', accountId: 'expense', accountCode: 'expense', accountNameAr: 'expense', debit: 100, credit: 0, debitForeign: 20, creditForeign: 0, currency: 'USD', exchangeRate: 5, description: 'expense' },
    { id: 'l2', accountId: 'cash', accountCode: 'cash', accountNameAr: 'cash', debit: 0, credit: 100, debitForeign: 0, creditForeign: 20, currency: 'USD', exchangeRate: 5, description: 'cash' },
  ], totalDebit: 100, totalCredit: 100, currency: 'USD', exchangeRate: 5, status: 'POSTED', createdBy: 'test', createdAt: '2026-01-01', postedBy: 'test', postedAt: '2026-01-01',
};

const result = buildLinkedReversal(original, [original], 'manager', 'wrong account', '2026-02-01', '2026-02-01T00:00:00Z');
assert.equal(result.valid, true);
assert.ok(result.reversal);
assert.equal(result.reversal.entryNumber, 'REV-JV-1');
assert.equal(result.reversal.reversalOfEntryId, original.id);
assert.equal(result.reversal.lines[0].debit, 0);
assert.equal(result.reversal.lines[0].credit, 100);
assert.equal(result.reversal.lines[0].creditForeign, 20);
assert.equal(result.reversal.totalDebit, original.totalCredit);
assert.equal(result.reversal.totalCredit, original.totalDebit);
const linked = linkOriginalToReversal(original, result.reversal);
assert.equal(linked.status, 'POSTED');
assert.equal(linked.reversedByEntryId, result.reversal.id);
const activity = calculateAccountActivity(accounts, [linked, result.reversal]);
assert.deepEqual(activity.cash, { debit: 100, credit: 100 });
assert.deepEqual(activity.expense, { debit: 100, credit: 100 });
assert.equal(buildLinkedReversal(linked, [linked, result.reversal], 'manager', 'again').valid, false);
assert.equal(buildLinkedReversal({ ...original, id: 'pending', status: 'PENDING_POSTING' }, [], 'manager', 'pending').valid, false);
assert.equal(buildLinkedReversal(original, [original], 'manager', '').valid, false);

console.log('ACCOUNTING_LIFECYCLE_REGRESSION_OK linked=true originalImmutablePosted=true debitCreditSwapped=true foreignAmountsSwapped=true netLedgerZero=true duplicateReversalBlocked=true pendingReversalBlocked=true reasonRequired=true');
