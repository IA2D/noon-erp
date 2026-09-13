/** Year-scoped storage primitives. Global settings intentionally never use this store. */
export const fiscalYearStorageKey = (collectionKey: string, fiscalYear: string) => `${collectionKey}::fiscal-year::${fiscalYear}`;

export function recordYear(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const value = record as Record<string, unknown>;
  const explicit = value.fiscalYear ?? value.fiscal_year;
  if (/^\d{4}$/.test(String(explicit ?? ''))) return String(explicit);
  const date = value.date ?? value.voucherDate ?? value.receiptDate ?? value.createdAt;
  const match = String(date ?? '').match(/^(\d{4})-/);
  return match?.[1] ?? null;
}

/** Partition legacy global rows without mutating them; undated rows belong to the supplied legacy year. */
export function partitionLegacyRows<T>(rows: T[], fiscalYear: string, legacyYear: string): T[] {
  return rows.filter(row => {
    const year = recordYear(row);
    return year ? year === fiscalYear : fiscalYear === legacyYear;
  });
}

export function stampFiscalYear<T>(rows: T[], fiscalYear: string): T[] {
  return rows.map(row => row && typeof row === 'object' ? { ...(row as Record<string, unknown>), fiscalYear } as T : row);
}
