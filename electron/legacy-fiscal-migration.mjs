import { cloneYearDataset } from './fiscal-year-rollover.mjs';

const JOURNALS = 'elite-erp-journals-v6';
const PERIOD_STATES = 'elite-erp-period-states-v1';
const CLOSED_YEARS = 'elite-erp-closed-years-v1';
export const YEAR_OWNED_KEYS = [
  'elite-erp-accounts-v9','elite-erp-costcenters-v6','elite-erp-journals-v6','elite-erp-auditlogs-v6',
  'elite-erp-trusts-v1','elite-erp-custodies-v1','elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1',
  'elite-erp-vouchers-v1','elite-erp-receiptvouchers-v1','elite-erp-employees-v1','elite-erp-customers-v1',
  'elite-erp-vendors-v1','elite-erp-currencies-v1','elite-erp-closed-years-v1','elite-erp-closed-months-v1',
  'elite-erp-opening-balances-status-v1','elite-erp-opening-balance-attachments-v1','elite-erp-period-states-v1',
];
const DATE_KEYS = new Set(['elite-erp-journals-v6','elite-erp-auditlogs-v6','elite-erp-trusts-v1','elite-erp-custodies-v1','elite-erp-vouchers-v1','elite-erp-receiptvouchers-v1']);
const MASTER_KEYS = new Set(['elite-erp-accounts-v9','elite-erp-costcenters-v6','elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1','elite-erp-employees-v1','elite-erp-customers-v1','elite-erp-vendors-v1','elite-erp-currencies-v1']);
const COLLECTION_NAMES = Object.fromEntries(YEAR_OWNED_KEYS.map((key, index) => [key, `collection${index}`]));

const parse = (raw, fallback = []) => { try { return JSON.parse(raw ?? JSON.stringify(fallback)); } catch { return fallback; } };
const yearOf = record => {
  const explicit = record?.fiscalYear ?? record?.fiscal_year;
  if (/^\d{4}$/.test(String(explicit || ''))) return String(explicit);
  const value = record?.date ?? record?.voucherDate ?? record?.receiptDate ?? record?.requestedDate ?? record?.timestamp ?? record?.createdAt;
  return String(value || '').match(/^(\d{4})-/)?.[1] ?? null;
};

/** Select the dominant operating year, ignoring generated OPEN journals and isolated outlier dates. */
export function inferLegacyFiscalYear(rawJournals, fallback = '2026', rawPeriodStates = '[]') {
  const counts = new Map();
  const journals = parse(rawJournals);
  if (Array.isArray(journals)) journals.forEach(row => {
    if (/^OPEN-\d{4}$/.test(String(row?.reference || row?.entryNumber || ''))) return;
    const year = yearOf(row);
    if (year) counts.set(year, (counts.get(year) || 0) + 1);
  });
  if (counts.size) {
    const ranked = [...counts].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
    const tied = ranked.filter(([, count]) => count === ranked[0][1]).map(([year]) => year);
    return tied.includes(fallback) ? fallback : ranked[0][0];
  }
  const periods = parse(rawPeriodStates);
  const years = Array.isArray(periods) ? periods.filter(item => item?.scope === 'YEAR' && /^\d{4}$/.test(String(item?.key || ''))).map(item => String(item.key)).sort() : [];
  return years.at(-1) || fallback;
}

const openingRowsForYear = (record, year, sourceYear) => {
  if (!Array.isArray(record?.openingBalances)) return record;
  const rows = record.openingBalances
    .filter(item => String(item?.fiscalYear || sourceYear) === year)
    .map(item => ({ ...item, fiscalYear: year }));
  const openingBalance = rows.length
    ? rows.reduce((sum, item) => sum + Number(item?.debitLocal || 0) - Number(item?.creditLocal || 0), 0)
    : 0;
  return { ...record, openingBalances: rows, openingBalance };
};

function valueForYear(key, value, year, sourceYear) {
  if (key === CLOSED_YEARS) return Array.isArray(value) ? value.filter(item => String(item) === year) : [];
  if (key === 'elite-erp-closed-months-v1') return Array.isArray(value) ? value.filter(item => String(item).startsWith(`${year}-`)) : [];
  if (key === PERIOD_STATES) return Array.isArray(value) ? value.filter(item => String(item?.key || '').startsWith(year)) : [];
  if (key === 'elite-erp-opening-balances-status-v1') return year === sourceYear ? value : 'NONE';
  if (!Array.isArray(value)) return value;
  if (DATE_KEYS.has(key)) return value.filter(item => yearOf(item) === year).map(item => {
    const stamped = item && typeof item === 'object' ? { ...item, fiscalYear: year } : item;
    if (key === JOURNALS && /^OPEN-\d{4}$/.test(String(stamped?.reference || stamped?.entryNumber || ''))) {
      return { ...stamped, entryKind: 'OPENING_AUDIT', affectsLedger: false, readOnly: true };
    }
    return stamped;
  });
  if (MASTER_KEYS.has(key)) return value.map(item => ({ ...openingRowsForYear(item, year, sourceYear), fiscalYear: year }));
  return value
    .filter(item => !item || typeof item !== 'object' || String(item.fiscalYear || sourceYear) === year)
    .map(item => item && typeof item === 'object' ? { ...item, fiscalYear: year } : item);
}

function detectedYears(values, sourceYear) {
  const years = new Set([sourceYear]);
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach(item => {
      const direct = key === CLOSED_YEARS
        ? String(item)
        : key === PERIOD_STATES
          ? String(item?.key || '').slice(0, 4)
          : DATE_KEYS.has(key) ? yearOf(item) : null;
      if (/^\d{4}$/.test(direct || '')) years.add(direct);
      if (MASTER_KEYS.has(key) && Array.isArray(item?.openingBalances)) item.openingBalances.forEach(opening => {
        if (/^\d{4}$/.test(String(opening?.fiscalYear || ''))) years.add(String(opening.fiscalYear));
      });
    });
  }
  return [...years].sort();
}

/** Atomic import into independent year namespaces. Global settings and legacy keys remain byte-identical. */
export function migrateLegacyFiscalDataset(db, relationalStore, fallbackYear = '2026') {
  const marker = db.prepare("SELECT value FROM app_metadata WHERE key='fiscal_isolation_migrated_v1'").get()?.value;
  if (marker) return { migrated: false, year: marker, years: [marker], keys: 0 };
  const read = db.prepare('SELECT value FROM kv_store WHERE key=?');
  const write = db.prepare(`INSERT INTO kv_store(key,value,entity_type,updated_at) VALUES(?,?,'erp_state',datetime('now')) ON CONFLICT(key) DO NOTHING`);
  const bump = db.prepare(`INSERT INTO kv_versions(key,version,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=datetime('now')`);
  const rawValues = Object.fromEntries(YEAR_OWNED_KEYS.map(key => [key, read.get(key)?.value]).filter(([, raw]) => raw != null));
  const values = Object.fromEntries(Object.entries(rawValues).map(([key, raw]) => [key, parse(raw, raw)]));
  const sourceYear = inferLegacyFiscalYear(rawValues[JOURNALS], fallbackYear, rawValues[PERIOD_STATES]);
  const years = detectedYears(values, sourceYear);
  let keys = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const year of years) {
      const yearValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [COLLECTION_NAMES[key], valueForYear(key, value, year, sourceYear)]));
      const cloned = year === sourceYear ? null : cloneYearDataset(yearValues, sourceYear, year, Object.keys(yearValues));
      const finalValues = cloned ? { ...yearValues, ...cloned.collections } : yearValues;
      for (const baseKey of Object.keys(values)) {
        const scopedKey = `${baseKey}::fiscal-year::${year}`;
        const serialized = JSON.stringify(finalValues[COLLECTION_NAMES[baseKey]]);
        if (write.run(scopedKey, serialized).changes) {
          relationalStore.syncCollection(scopedKey, serialized);
          bump.run(scopedKey);
          keys += 1;
        }
      }
      const validation = relationalStore.validateFiscalYearDataset(year);
      if (!validation.ok) throw new Error(`FISCAL_YEAR_MIGRATION_GRAPH_INVALID:${year}:${JSON.stringify(validation.broken.slice(0, 20))}`);
    }
    db.prepare("INSERT INTO app_metadata(key,value) VALUES('fiscal_isolation_migrated_v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(sourceYear);
    db.exec('COMMIT');
    return { migrated: true, year: sourceYear, years, keys };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}
