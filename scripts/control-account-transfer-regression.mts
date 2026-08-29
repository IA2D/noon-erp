import assert from 'node:assert/strict';
import type { Account, JournalEntry } from '../src/types/erp';
import { buildControlAccountTransfer, hasPostedEntityMovement } from '../src/utils/controlAccountTransfer';

const account = (id: string, code: string): Account => ({ id, code, nameAr: id, nameEn: id, level: 5, accountType: 2, reportType: 1, category: 'BALANCE_SHEET', nature: 'DEBIT', subLedgerType: 'CUSTOMER', currencies: [], defaultCurrency: 'YER', openingBalance: 0, isActive: true });
const accounts = [account('old', '1101'), account('new', '1102')];
const journal: JournalEntry = { id: 'j1', entryNumber: 'JV-1', date: '2026-01-01', reference: '', narration: '', lines: [{ id: 'l1', accountId: 'old', accountCode: '1101', accountNameAr: 'old', debit: 150, credit: 0, description: '', subLedgerType: 'CUSTOMER', subLedgerId: 'customer-1' }, { id: 'l2', accountId: 'new', accountCode: '1102', accountNameAr: 'new', debit: 0, credit: 150, description: '' }], totalDebit: 150, totalCredit: 150, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'x', createdAt: '' };
assert.equal(hasPostedEntityMovement([journal], 'customer-1', 'old'), true);
const result = buildControlAccountTransfer({ kind: 'CUSTOMER', entityId: 'customer-1', entityCode: 'CUS-1', entityName: 'عميل', fromAccountId: 'old', toAccountId: 'new', effectiveDate: '2026-08-27', reason: 'نقل حساب الرقابة', requestedBy: 'maker', approvedBy: 'checker', baseCurrency: 'YER' }, accounts, [journal], 0);
assert.equal(result.valid, true);
assert.equal(result.transferredBalance, 150);
assert.equal(result.journal?.totalDebit, 150);
assert.equal(result.journal?.lines[0].credit, 150);
assert.equal(result.journal?.lines[1].debit, 150);
assert.equal(result.record?.approvedBy, 'checker');
const noApproval = buildControlAccountTransfer({ kind: 'CUSTOMER', entityId: 'customer-1', entityCode: 'CUS-1', entityName: 'عميل', fromAccountId: 'old', toAccountId: 'new', effectiveDate: '2026-08-27', reason: 'x', requestedBy: 'maker', approvedBy: 'maker', baseCurrency: 'YER' }, accounts, [journal]);
assert.equal(noApproval.valid, false);
console.log('CONTROL_ACCOUNT_TRANSFER_REGRESSION_OK movementDetected=true independentApproval=true datedTransfer=true balanceMoved=true linkedJournal=true');
