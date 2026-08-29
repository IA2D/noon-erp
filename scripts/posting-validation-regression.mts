import assert from 'node:assert/strict';
import type { Account, Currency, JournalEntry, JournalLine, PaymentVoucher } from '../src/types/erp';
import { validateJournalForPosting, validateVoucherForPosting } from '../src/utils/postingValidation';

const account = (id: string, code: string, level: 1 | 5, nature: 'DEBIT' | 'CREDIT', subLedgerType: Account['subLedgerType'] = 'NONE'): Account => ({
  id, code, level, nature, subLedgerType, nameAr: id, nameEn: id,
  accountType: level === 5 ? 2 : 1, reportType: 1, category: 'BALANCE_SHEET',
  currencies: [], defaultCurrency: 'YER', openingBalance: 0, isActive: true,
});
const accounts = [account('cash', '1101010001', 5, 'DEBIT'), account('expense', '4101010001', 5, 'DEBIT'), account('customer', '1102010001', 5, 'DEBIT', 'CUSTOMER'), account('group', '1', 1, 'DEBIT')];
const currencies: Currency[] = [
  { id: 'yer', code: 'YER', nameAr: 'ريال', nameEn: 'Rial', symbol: 'ر.ي', decimals: 0, isBase: true, exchangeRate: 1, minExchangeRate: 1, maxExchangeRate: 1, isActive: true, createdAt: '' },
  { id: 'usd', code: 'USD', nameAr: 'دولار', nameEn: 'Dollar', symbol: '$', decimals: 2, isBase: false, exchangeRate: 530, minExchangeRate: 1, maxExchangeRate: 1000, isActive: true, createdAt: '' },
];
const line = (id: string, accountId: string, debit: number, credit: number): JournalLine => ({ id, accountId, accountCode: accountId, accountNameAr: accountId, debit, credit, description: id });
const journal = (patch: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'j1', entryNumber: 'JV-1', date: '2026-01-01', reference: '', narration: '',
  lines: [line('l1', 'expense', 100, 0), line('l2', 'cash', 0, 100)], totalDebit: 100, totalCredit: 100,
  currency: 'YER', exchangeRate: 1, status: 'PENDING_POSTING', createdBy: 'test', createdAt: '2026-01-01T00:00:00Z', ...patch,
});

assert.equal(validateJournalForPosting(journal(), accounts, []).valid, true);
assert.equal(validateJournalForPosting(journal({ totalDebit: 90 }), accounts, []).valid, false);
assert.equal(validateJournalForPosting(journal(), accounts, [journal({ id: 'j2' })]).errors.some(item => item.includes('مستخدم مسبقاً')), true);
assert.equal(validateJournalForPosting(journal({ lines: [line('l1', 'group', 100, 0), line('l2', 'cash', 0, 100)] }), accounts, []).valid, false);
assert.equal(validateJournalForPosting(journal({ lines: [line('l1', 'customer', 100, 0), line('l2', 'cash', 0, 100)] }), accounts, []).errors.some(item => item.includes('الحساب المساعد')), true);
const foreignJournal = journal({ totalDebit: 530, totalCredit: 530, lines: [
  { ...line('l1', 'expense', 530, 0), currency: 'USD', exchangeRate: 530, debitForeign: 1 },
  { ...line('l2', 'cash', 0, 530), currency: 'YER', exchangeRate: 1 },
] });
assert.equal(validateJournalForPosting(foreignJournal, accounts, [], currencies).valid, true);
assert.equal(validateJournalForPosting({ ...foreignJournal, lines: [{ ...foreignJournal.lines[0], debit: 529 }, foreignJournal.lines[1]] }, accounts, [], currencies).errors.some(item => item.includes('الأصلي × السعر')), true);

const voucher = (patch: Partial<PaymentVoucher> = {}): PaymentVoucher => ({
  id: 'p1', voucherNumber: 'PV-1', date: '2026-01-01', paymentMethod: 'CASH', sourceType: 'ACCOUNT',
  sourceAccountId: 'cash', sourceAccountNameAr: 'cash', payeeName: 'Vendor', narration: 'Payment', currency: 'YER', exchangeRate: 1,
  lines: [{ id: 'pl1', accountId: 'expense', accountCode: '4101010001', accountNameAr: 'expense', description: 'expense', amount: 100, totalAmount: 100, exchangeRate: 1, localAmount: 100 }],
  subtotalAmount: 100, totalAmount: 100, amountInWordsAr: '', status: 'PENDING_POSTING', createdBy: 'test', createdAt: '2026-01-01T00:00:00Z', ...patch,
});
assert.equal(validateVoucherForPosting('PAYMENT', voucher(), accounts, [], []).valid, true);
assert.equal(validateVoucherForPosting('PAYMENT', voucher({ totalAmount: 90 }), accounts, [], []).errors.some(item => item.includes('مجموع سطور')), true);
assert.equal(validateVoucherForPosting('PAYMENT', voucher({ sourceAccountId: 'expense' }), accounts, [], []).errors.some(item => item.includes('حساب المصدر')), true);
assert.equal(validateVoucherForPosting('PAYMENT', voucher(), accounts, [], [journal({ status: 'POSTED', sourceType: 'PAYMENT_VOUCHER', referenceCode: 'PV-1' })]).errors.some(item => item.includes('رُحّل مسبقاً')), true);
const foreignVoucher = voucher({ currency: 'USD', exchangeRate: 530, lines: [{ ...voucher().lines[0], currency: 'USD', amount: 1.25, totalAmount: 1.25, exchangeRate: 530, localAmount: 663 }], subtotalAmount: 1.25, totalAmount: 1.25 });
assert.equal(validateVoucherForPosting('PAYMENT', foreignVoucher, accounts, [], [], currencies).valid, true);
assert.equal(validateVoucherForPosting('PAYMENT', { ...foreignVoucher, lines: [{ ...foreignVoucher.lines[0], localAmount: 662 }] }, accounts, [], [], currencies).errors.some(item => item.includes('المعادل المحلي')), true);
assert.equal(validateVoucherForPosting('PAYMENT', { ...foreignVoucher, totalAmount: 1.251, subtotalAmount: 1.251, lines: [{ ...foreignVoucher.lines[0], amount: 1.251, totalAmount: 1.251 }] }, accounts, [], [], currencies).errors.some(item => item.includes('يتجاوز دقة')), true);

console.log('POSTING_VALIDATION_REGRESSION_OK validJournal=true totalMismatchBlocked=true duplicateJournalBlocked=true nonPostingBlocked=true subledgerBlocked=true validVoucher=true voucherTotalBlocked=true sameAccountBlocked=true retryBlocked=true foreignJournalReproduced=true foreignMismatchBlocked=true currencyPrecision=true excessPrecisionBlocked=true');
