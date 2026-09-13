import assert from 'node:assert/strict';
import { calculateAccountActivity, calculateTrialBalance } from '../src/utils/accountingEngine';
import type { Account, JournalEntry } from '../src/types/erp';

const account = (id: string, openingBalance: number): Account => ({
  id, code: '1101010001', nameAr: 'الصندوق العام', nameEn: 'Cash', level: 5,
  accountType: 2, reportType: 1, nature: 'DEBIT', category: 'BALANCE_SHEET',
  subLedgerType: 'NONE', currencies: [{ id: `cur-${id}`, code: 'YER', isDefault: true, isActive: true }],
  defaultCurrency: 'YER', openingBalance, isActive: true,
});

const sourceAccounts = [account('cash-2026', 100)];
const sourceJournals: JournalEntry[] = [{
  id: 'movement-2026', entryNumber: 'JV-1', date: '2026-06-01', reference: 'MOV-1', narration: 'movement',
  lines: [{ id: 'line-2026', accountId: 'cash-2026', accountCode: '1101010001', accountNameAr: 'الصندوق العام', description: 'movement', debit: 25, credit: 0 }],
  totalDebit: 25, totalCredit: 25, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'test', createdAt: '2026-06-01',
}];
const sourceBefore = JSON.stringify({ sourceAccounts, sourceJournals });
const sourceClosing = calculateAccountActivity(sourceAccounts, sourceJournals)['cash-2026'];
assert.equal(sourceClosing.debit - sourceClosing.credit, 125);

const targetAccounts = [account('cash-2027', 125)];
const openingAudit: JournalEntry = {
  id: 'open-2027', entryNumber: 'OPEN-2027', date: '2027-01-01', reference: 'OPEN-2027', narration: 'opening audit',
  lines: [{ id: 'open-line-2027', accountId: 'cash-2027', accountCode: '1101010001', accountNameAr: 'الصندوق العام', description: 'opening audit', debit: 125, credit: 0 }],
  totalDebit: 125, totalCredit: 125, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'test', createdAt: '2027-01-01',
  fiscalYear: '2027', entryKind: 'OPENING_AUDIT', affectsLedger: false, readOnly: true,
};
const targetActivity = calculateAccountActivity(targetAccounts, [openingAudit])['cash-2027'];
assert.equal(targetActivity.debit - targetActivity.credit, 125, 'opening audit must not double the opening balance');
const targetTrial = calculateTrialBalance(targetAccounts, [openingAudit]);
assert.equal(targetTrial.totalDebit, 125);
assert.equal(targetTrial.totalCredit, 0);
assert.equal(JSON.stringify({ sourceAccounts, sourceJournals }), sourceBefore, 'source year must remain byte-identical');
assert.equal(openingAudit.readOnly, true);
assert.equal(openingAudit.affectsLedger, false);

console.log('FISCAL_YEAR_REPORT_ISOLATION_OK sourceUnchanged=true openingOnce=true auditExcluded=true auditReadOnly=true');
