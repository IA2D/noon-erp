/** Shared fiscal-year primitives used by the relational repository and rollover service. */
export function normalizeFiscalYear(value) {
  const year = String(value ?? '').trim();
  if (!/^\d{4}$/.test(year)) throw new Error(`INVALID_FISCAL_YEAR:${year}`);
  return year;
}

export function fiscalYearId(value) {
  return `fy-${normalizeFiscalYear(value)}`;
}

export function recordFiscalYear(record) {
  const explicit = record?.fiscalYear ?? record?.fiscal_year;
  if (explicit && /^\d{4}$/.test(String(explicit))) return normalizeFiscalYear(explicit);
  const date = record?.date ?? record?.voucherDate ?? record?.receiptDate ?? record?.createdAt;
  const match = String(date ?? '').match(/^(\d{4})-/);
  return match ? match[1] : null;
}

/** Execute a rollover unit atomically and restore the transaction state on error. */
export function runAtomic(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}
