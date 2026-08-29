import assert from 'node:assert/strict';
import type { Account, CashBox, Currency, JournalEntry, JournalLine } from '../src/types/erp';
import type { SavePayload } from '../src/components/modules/opening/types';
import { validateGeneratedJournalForPosting, validateOpeningBalancesForPosting } from '../src/utils/postingValidation';
import { accountRemovalDecision, costCenterRemovalDecision, currencyRemovalDecision, entityRemovalDecision, type MasterDataReferenceContext } from '../src/utils/masterDataGuards';

const account = (id: string, subLedgerType: Account['subLedgerType'] = 'NONE'): Account => ({
  id, code: id, nameAr: id, nameEn: id, level: 5, accountType: 2, reportType: 1, nature: 'DEBIT', category: 'BALANCE_SHEET',
  subLedgerType, currencies: [{ id: 'yer', code: 'YER', isDefault: true, isActive: true }], defaultCurrency: 'YER', openingBalance: 0, isActive: true,
});
const accounts = [account('cash'), account('capital'), account('cash-control', 'CASH_BOX')];
const currencies: Currency[] = [{ id: 'yer', code: 'YER', nameAr: 'ريال', nameEn: 'YER', symbol: 'ر.ي', decimals: 2, isBase: true, exchangeRate: 1, minExchangeRate: 1, maxExchangeRate: 1, isActive: true, createdAt: '2026-01-01' }];
const cashBox = { id: 'box-1', code: 'BOX-1', nameAr: 'صندوق', nameEn: 'Box', boxType: 'MAIN', currencies: [], defaultCurrency: 'YER', openingBalance: 0, linkedAccountId: 'cash-control', isActive: true, createdAt: '2026-01-01' } as CashBox;
const entities = { cashBoxes: [cashBox], bankAccounts: [], customers: [], vendors: [], employees: [] };
const payload: SavePayload = {
  accounts: [
    { id: 'cash', rowId: 'r1', openingBalance: 100, openingBalanceForeign: 100, debit: 100, credit: 0, debitLocal: 100, creditLocal: 0, currency: 'YER', rate: 1 },
    { id: 'capital', rowId: 'r2', openingBalance: -100, openingBalanceForeign: -100, debit: 0, credit: 100, debitLocal: 0, creditLocal: 100, currency: 'YER', rate: 1 },
  ], subLedgers: [],
};
assert.equal(validateOpeningBalancesForPosting(payload, accounts, entities, currencies).valid, true);
assert.equal(validateOpeningBalancesForPosting({ ...payload, accounts: [payload.accounts[0]] }, accounts, entities, currencies).errors.some(e => e.includes('غير متوازنة')), true);
assert.equal(validateOpeningBalancesForPosting({ ...payload, accounts: [{ ...payload.accounts[0], debitLocal: 90 }, payload.accounts[1]] }, accounts, entities, currencies).errors.some(e => e.includes('المعادل المحلي')), true);
assert.equal(validateOpeningBalancesForPosting({ accounts: [], subLedgers: [{ kind: 'CASH_BOX', id: 'missing', rowId: 's1', linkedAccountId: 'cash-control', openingBalance: 100, openingBalanceForeign: 100, debit: 100, credit: 0, debitLocal: 100, creditLocal: 0, currency: 'YER', rate: 1 }] }, accounts, entities, currencies).errors.some(e => e.includes('الكيان غير موجود')), true);

const line = (id: string, accountId: string, debit: number, credit: number): JournalLine => ({ id, accountId, accountCode: accountId, accountNameAr: accountId, debit, credit, description: id });
const generated: JournalEntry = { id: 'j1', entryNumber: 'JV-1', date: '2026-01-01', reference: 'C-1', referenceCode: 'C-1', sourceType: 'MANUAL', narration: 'test', lines: [line('l1', 'cash', 100, 0), line('l2', 'capital', 0, 100)], totalDebit: 100, totalCredit: 100, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'test', createdAt: '2026-01-01', postedBy: 'test', postedAt: '2026-01-01' };
assert.equal(validateGeneratedJournalForPosting(generated, accounts, []).valid, true);
assert.equal(validateGeneratedJournalForPosting({ ...generated, id: 'j2', entryNumber: 'JV-2' }, accounts, [generated]).errors.some(e => e.includes('رُحّل مسبقاً')), true);

const ctx: MasterDataReferenceContext = { accounts, costCenters: [{ id: 'cc1', code: '1', nameAr: 'CC', nameEn: 'CC' }], journals: [generated], trusts: [], custodies: [], cashBoxes: [cashBox], bankAccounts: [], vouchers: [], receipts: [], employees: [], customers: [], vendors: [], currencies };
assert.equal(accountRemovalDecision('cash', ctx).action, 'ARCHIVE');
assert.equal(accountRemovalDecision('unused', { ...ctx, accounts: [...accounts, account('unused')] }).action, 'DELETE');
assert.equal(entityRemovalDecision('CASH_BOX', 'box-1', ctx).action, 'DELETE');
assert.equal(entityRemovalDecision('CASH_BOX', 'box-1', { ...ctx, journals: [{ ...generated, lines: [{ ...generated.lines[0], accountId: 'cash-control' }, generated.lines[1]] }] }).action, 'ARCHIVE');
assert.equal(costCenterRemovalDecision('cc1', { ...ctx, journals: [{ ...generated, lines: [{ ...generated.lines[0], costCenterId: 'cc1' }, generated.lines[1]] }] }).action, 'BLOCK');
assert.equal(currencyRemovalDecision('yer', ctx).action, 'BLOCK');

console.log('DOMAIN_BOUNDARY_REGRESSION_OK openingValid=true openingImbalanceBlocked=true localMismatchBlocked=true missingEntityBlocked=true generatedJournalValid=true generatedRetryBlocked=true usedAccountArchived=true unusedAccountDeleted=true usedEntityArchived=true referencedCostCenterBlocked=true baseCurrencyBlocked=true');
