import type { Account, JournalEntry } from '../types/erp';
import { roundTo } from './money';

/**
 * The source side of older payment/receipt voucher journals was stored in the
 * base currency even when the voucher itself was foreign-currency.  Keep the
 * ledger's local debit/credit intact, but restore the source line's original
 * currency metadata from the voucher before a report projects or groups it.
 *
 * This is deliberately a read-model normalization: historical journals remain
 * immutable while every report sees the same original-currency source amount.
 */
export function normalizeVoucherSourceJournalCurrencies(
  journals: JournalEntry[],
  vouchers: Array<{
    journalEntryId?: string;
    sourceAccountId?: string;
    currency?: string;
    exchangeRate?: number;
    totalAmount?: number;
    voucherNumber?: string;
    receiptNumber?: string;
  }>,
  baseCurrency: string,
  decimals: number,
): JournalEntry[] {
  const byJournalId = new Map<string, typeof vouchers[number]>();
  const byDocumentNumber = new Map<string, typeof vouchers[number]>();
  vouchers.forEach(voucher => {
    if (voucher.journalEntryId) byJournalId.set(voucher.journalEntryId, voucher);
    const documentNumber = voucher.voucherNumber || voucher.receiptNumber;
    if (documentNumber) byDocumentNumber.set(documentNumber, voucher);
  });

  return journals.map(journal => {
    const voucher = byJournalId.get(journal.id) || byDocumentNumber.get(journal.referenceCode || journal.reference);
    const sourceCurrency = voucher?.currency || baseCurrency;
    if (!voucher?.sourceAccountId || sourceCurrency === baseCurrency) return journal;

    const sourceAmount = roundTo(voucher.totalAmount || 0, decimals);
    if (!(sourceAmount > 0)) return journal;
    let changed = false;
    const lines = journal.lines.map(line => {
      if (line.accountId !== voucher.sourceAccountId) return line;
      // Correct only the legacy shape. Newly generated entries already carry
      // their original source-line currency and foreign amount.
      const isLegacyBaseLine = !line.currency || line.currency === baseCurrency;
      const hasForeignAmount = (line.debitForeign ?? 0) !== 0 || (line.creditForeign ?? 0) !== 0;
      if (!isLegacyBaseLine || hasForeignAmount) return line;
      changed = true;
      return {
        ...line,
        currency: sourceCurrency,
        exchangeRate: voucher.exchangeRate || line.exchangeRate || 1,
        debitForeign: line.debit > 0 ? sourceAmount : undefined,
        creditForeign: line.credit > 0 ? sourceAmount : undefined,
      };
    });
    return changed ? { ...journal, lines } : journal;
  });
}

/**
 * Projects the immutable stored ledger either to base-local values or to the
 * stored original-currency debit/credit. It never divides historical local
 * values by today's currency master rate.
 */
export function projectJournalsToCurrency(
  journals: JournalEntry[],
  currency: string,
  baseCurrency: string,
  decimals: number,
  includePending = false,
  includeVoided = false
): JournalEntry[] {
  const original = currency !== baseCurrency;
  return journals.filter(entry => entry.status === 'POSTED' || (includePending && entry.status === 'PENDING_POSTING') || (includeVoided && entry.status === 'VOIDED')).map(entry => {
    if (!original) return {
      ...entry,
      currency: baseCurrency,
      exchangeRate: 1,
      totalDebit: entry.totalDebit || 0,
      totalCredit: entry.totalCredit || 0,
      lines: entry.lines.map(line => ({ ...line, debit: line.debit || 0, credit: line.credit || 0 })),
    };
    const lines = entry.lines.filter(line => (line.currency || entry.currency) === currency).map(line => ({
      ...line,
      debit: roundTo(line.debitForeign ?? ((line.exchangeRate || entry.exchangeRate) > 0 ? (line.debit || 0) / (line.exchangeRate || entry.exchangeRate) : 0), decimals),
      credit: roundTo(line.creditForeign ?? ((line.exchangeRate || entry.exchangeRate) > 0 ? (line.credit || 0) / (line.exchangeRate || entry.exchangeRate) : 0), decimals),
    }));
    return {
      ...entry,
      currency,
      exchangeRate: 1,
      lines,
      totalDebit: roundTo(lines.reduce((sum, line) => sum + line.debit, 0), decimals),
      totalCredit: roundTo(lines.reduce((sum, line) => sum + line.credit, 0), decimals),
    };
  }).filter(entry => !original || entry.lines.length > 0);
}

export function accountsWithCurrencyOpenings(accounts: Account[], currency: string, baseCurrency: string, decimals: number): Account[] {
  if (currency === baseCurrency) return accounts;
  return accounts.map(account => ({
    ...account,
    openingBalance: roundTo((account.openingBalances || []).filter(row => row.currency === currency).reduce((sum, row) => sum + (row.debit || 0) - (row.credit || 0), 0), decimals),
  }));
}

export function projectPostedJournalsToCurrency(journals: JournalEntry[], currency: string, baseCurrency: string, decimals: number): JournalEntry[] {
  return projectJournalsToCurrency(journals, currency, baseCurrency, decimals);
}
