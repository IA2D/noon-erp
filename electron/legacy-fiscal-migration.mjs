const JOURNALS = 'elite-erp-journals-v6';
export const YEAR_OWNED_KEYS = [
  'elite-erp-accounts-v9','elite-erp-costcenters-v6','elite-erp-journals-v6','elite-erp-auditlogs-v6',
  'elite-erp-trusts-v1','elite-erp-custodies-v1','elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1',
  'elite-erp-vouchers-v1','elite-erp-receiptvouchers-v1','elite-erp-employees-v1','elite-erp-customers-v1',
  'elite-erp-vendors-v1','elite-erp-currencies-v1','elite-erp-closed-years-v1','elite-erp-closed-months-v1',
  'elite-erp-opening-balances-status-v1','elite-erp-opening-balance-attachments-v1','elite-erp-period-states-v1',
];
const DATE_KEYS = new Set(['elite-erp-journals-v6','elite-erp-auditlogs-v6','elite-erp-trusts-v1','elite-erp-custodies-v1','elite-erp-vouchers-v1','elite-erp-receiptvouchers-v1']);
const MASTER_KEYS = new Set(['elite-erp-accounts-v9','elite-erp-costcenters-v6','elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1','elite-erp-employees-v1','elite-erp-customers-v1','elite-erp-vendors-v1','elite-erp-currencies-v1']);
const yearOf = record => {
  const explicit = record?.fiscalYear ?? record?.fiscal_year;
  if (/^\d{4}$/.test(String(explicit || ''))) return String(explicit);
  const value = record?.date ?? record?.voucherDate ?? record?.receiptDate ?? record?.requestedDate ?? record?.timestamp ?? record?.createdAt;
  return String(value || '').match(/^(\d{4})-/)?.[1] ?? null;
};

export function inferLegacyFiscalYear(rawJournals, fallback = '2026') {
  try {
    const rows = JSON.parse(rawJournals || '[]');
    const years = rows.map(yearOf).filter(Boolean).sort();
    return years[0] || fallback;
  } catch { return fallback; }
}

function migrateValue(key, raw, year) {
  let value;
  try { value = JSON.parse(raw); } catch { return raw; }
  if (!Array.isArray(value)) return JSON.stringify(value);
  if (key === 'elite-erp-closed-years-v1') return JSON.stringify(value.filter(item => String(item) === year));
  if (key === 'elite-erp-closed-months-v1') return JSON.stringify(value.filter(item => String(item).startsWith(`${year}-`)));
  if (key === 'elite-erp-period-states-v1') return JSON.stringify(value.filter(item => String(item?.key || '').startsWith(year)));
  if (DATE_KEYS.has(key)) value = value.filter(item => (yearOf(item) || year) === year);
  if (MASTER_KEYS.has(key)) value = value.map(item => ({
    ...item,
    fiscalYear: year,
    ...(Array.isArray(item?.openingBalances) ? { openingBalances: item.openingBalances.filter(record => !record?.fiscalYear || String(record.fiscalYear) === year).map(record => ({ ...record, fiscalYear: record.fiscalYear || year })) } : {}),
  }));
  else value = value.map(item => item && typeof item === 'object' ? { ...item, fiscalYear: year } : item);
  return JSON.stringify(value);
}

/** One-time, atomic import of the source fiscal year. Global settings and original legacy keys remain untouched. */
export function migrateLegacyFiscalDataset(db, relationalStore, fallbackYear = '2026') {
  const marker = db.prepare("SELECT value FROM app_metadata WHERE key='fiscal_isolation_migrated_v1'").get()?.value;
  if (marker) return { migrated: false, year: marker, keys: 0 };
  const read = db.prepare('SELECT value FROM kv_store WHERE key=?');
  const write = db.prepare(`INSERT INTO kv_store(key,value,entity_type,updated_at) VALUES(?,?,'erp_state',datetime('now')) ON CONFLICT(key) DO NOTHING`);
  const bump = db.prepare(`INSERT INTO kv_versions(key,version,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=datetime('now')`);
  const year = inferLegacyFiscalYear(read.get(JOURNALS)?.value, fallbackYear);
  let keys = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const baseKey of YEAR_OWNED_KEYS) {
      const raw = read.get(baseKey)?.value;
      if (raw == null) continue;
      const scopedKey = `${baseKey}::fiscal-year::${year}`;
      const serialized = migrateValue(baseKey, raw, year);
      if (write.run(scopedKey, serialized).changes) {
        relationalStore.syncCollection(scopedKey, serialized);
        bump.run(scopedKey);
        keys += 1;
      }
    }
    db.prepare("INSERT INTO app_metadata(key,value) VALUES('fiscal_isolation_migrated_v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(year);
    db.exec('COMMIT');
    return { migrated: true, year, keys };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}
