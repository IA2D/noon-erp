import { roundTo } from './money';

/** Minimal shape shared by analytical statements and their summary projection. */
export interface StatementSummaryMovement {
  debit: number;
  credit: number;
  currency?: string;
}

export interface StatementSummarySource<T extends StatementSummaryMovement = StatementSummaryMovement> {
  key: string;
  subjectCode: string;
  subjectName: string;
  opening: number;
  openingByCurrency?: Record<string, number>;
  currencyCode?: string;
  rows: T[];
}

export interface StatementCurrencySummary {
  id: string;
  subjectCode: string;
  subjectName: string;
  currency: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

/** One currency's closing balance expressed in the reporting currency. */
export interface StatementCurrencyConversion {
  currency: string;
  closing: number;
  exchangeRate: number;
  localClosing: number;
}

/**
 * Aggregate statements retain original-currency balances, then disclose the
 * base-currency conversion using the current exchange rate for every currency.
 */
export function summarizeStatementCurrencyConversions(
  rows: Array<{ currency?: string; opening?: number; debit: number; credit: number }>,
  baseCurrency: string,
  exchangeRates: Record<string, number> = {},
): StatementCurrencyConversion[] {
  const groups = new Map<string, number>();
  rows.forEach(row => {
    const code = row.currency || baseCurrency;
    groups.set(code, roundTo((groups.get(code) || 0) + (row.opening || 0) + (row.debit || 0) - (row.credit || 0), 2));
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, closing]) => {
    const exchangeRate = currency === baseCurrency ? 1 : Number(exchangeRates[currency]) || 1;
    return { currency, closing, exchangeRate, localClosing: roundTo(closing * exchangeRate, 2) };
  });
}
/**
 * Build every aggregate row directly from the same analytical movements.
 * This prevents a summary report from having an independent filtering or
 * balance path: per-currency closing is always opening + debit - credit.
 */
export function summarizeStatementsByCurrency<T extends StatementSummaryMovement>(
  sources: StatementSummarySource<T>[],
  baseCurrency: string,
): StatementCurrencySummary[] {
  const result: StatementCurrencySummary[] = [];
  sources.forEach(source => {
    const rowsByCurrency = new Map<string, T[]>();
    source.rows.forEach(row => {
      const currency = row.currency || baseCurrency;
      const bucket = rowsByCurrency.get(currency) || [];
      bucket.push(row);
      rowsByCurrency.set(currency, bucket);
    });
    Object.keys(source.openingByCurrency || {}).forEach(currency => {
      if (!rowsByCurrency.has(currency)) rowsByCurrency.set(currency, []);
    });
    if (!rowsByCurrency.size) rowsByCurrency.set(source.currencyCode || baseCurrency, []);

    rowsByCurrency.forEach((rows, currency) => {
      const opening = roundTo(source.openingByCurrency?.[currency] ?? (rowsByCurrency.size === 1 ? source.opening : 0), 2);
      const debit = roundTo(rows.reduce((sum, row) => sum + (row.debit || 0), 0), 2);
      const credit = roundTo(rows.reduce((sum, row) => sum + (row.credit || 0), 0), 2);
      result.push({
        id: `${source.key}-${currency}`,
        subjectCode: source.subjectCode,
        subjectName: source.subjectName,
        currency,
        opening,
        debit,
        credit,
        closing: roundTo(opening + debit - credit, 2),
      });
    });
  });
  return result.sort((a, b) => a.currency.localeCompare(b.currency) || a.subjectName.localeCompare(b.subjectName, 'ar'));
}