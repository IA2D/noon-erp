import assert from 'node:assert/strict';
import { journalPrintAmount } from '../src/utils/journalPrintAmounts';

const saudiDebit = {
  currency: 'SAR',
  exchangeRate: 145,
  debit: 14_000_000,
  credit: 0,
  debitForeign: 96_551.72,
  creditForeign: 0
};
assert.equal(journalPrintAmount(saudiDebit, 'debit', 'YER'), 96_551.72);
assert.equal(journalPrintAmount(saudiDebit, 'credit', 'YER'), 0);

const legacyForeignDebit = { currency: 'USD', exchangeRate: 500, debit: 50_000, credit: 0 };
assert.equal(journalPrintAmount(legacyForeignDebit, 'debit', 'YER'), 100);
assert.equal(journalPrintAmount({ ...legacyForeignDebit, currency: 'YER' }, 'debit', 'YER'), 50_000);

console.log('JOURNAL_PRINT_CURRENCY_OK originalForeign=true legacyDerived=true baseUnchanged=true');
