import type { Account, JournalEntry } from '../types/erp';
import { roundTo } from './money';

/**
 * Projects the immutable stored ledger either to base-local values or to the
 * stored original-currency debit/credit. It never divides historical local
 * values by today's currency master rate.
 */
export function projectPostedJournalsToCurrency(
  journals: JournalEntry[],
  currency: string,
  baseCurrency: string,
  decimals: number
): JournalEntry[] {
  const original = currency !== baseCurrency;
  return journals.filter(entry => entry.status === 'POSTED').map(entry => {
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
      debit: roundTo(line.debitForeign || 0, decimals),
      credit: roundTo(line.creditForeign || 0, decimals),
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
