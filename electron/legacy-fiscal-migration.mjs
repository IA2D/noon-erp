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

const isRolloverAuditJournal = row => row?.entryKind === 'OPENING_AUDIT'
  || /^OPEN-\d{4}$/.test(String(row?.reference || row?.entryNumber || ''));

/** One-time cleanup after opening balances became the sole rollover source of truth. */
export function migrateRemoveRolloverJournals(db, relationalStore) {
  const markerKey = 'rollover_audit_journals_removed_v1';
  if (db.prepare('SELECT value FROM app_metadata WHERE key=?').get(markerKey)?.value) return { migrated: false, removed: 0, keys: 0 };
  const rows = db.prepare("SELECT key,value FROM kv_store WHERE key=? OR key GLOB ?")
    .all(JOURNALS, `${JOURNALS}::fiscal-year::*`);
  const periodRows = db.prepare("SELECT key,value FROM kv_store WHERE key=? OR key GLOB ?")
    .all(PERIOD_STATES, `${PERIOD_STATES}::fiscal-year::*`);
  const write = db.prepare("UPDATE kv_store SET value=?,updated_at=datetime('now') WHERE key=?");
  const bump = db.prepare(`INSERT INTO kv_versions(key,version,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=datetime('now')`);
  let removed = 0;
  let keys = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const journals = parse(row.value);
      if (!Array.isArray(journals)) continue;
      const kept = journals.filter(item => !isRolloverAuditJournal(item));
      if (kept.length === journals.length) continue;
      removed += journals.length - kept.length;
      const serialized = JSON.stringify(kept);
      write.run(serialized, row.key);
      relationalStore.syncCollection(row.key, serialized);
      bump.run(row.key);
      keys += 1;
    }
    for (const row of periodRows) {
      const periods = parse(row.value);
      if (!Array.isArray(periods) || !periods.some(item => item?.openingEntryId)) continue;
      const cleaned = periods.map(item => item?.openingEntryId ? { ...item, openingEntryId: undefined } : item);
      const serialized = JSON.stringify(cleaned);
      write.run(serialized, row.key);
      relationalStore.syncCollection(row.key, serialized);
      bump.run(row.key);
      keys += 1;
    }
    db.prepare('INSERT INTO app_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(markerKey, new Date().toISOString());
    db.exec('COMMIT');
    return { migrated: true, removed, keys };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

const CONTROL_ENTITY_KEYS = [
  'elite-erp-cashboxes-v1', 'elite-erp-bankaccounts-v1', 'elite-erp-employees-v1',
  'elite-erp-customers-v1', 'elite-erp-vendors-v1',
];
const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const openingFingerprint = row => [
  row?.fiscalYear || '', row?.accountId || '', row?.subAccountId || '', row?.costCenterId || '', row?.currency || '',
  round2(row?.debit), round2(row?.credit), round2(row?.debitLocal), round2(row?.creditLocal),
  round2(row?.amount), round2(row?.foreignAmount), Number(row?.rate || row?.exchangeRate || 1), row?.documentRef || '', row?.dueDate || '',
].join('|');
const uniqueOpenings = rows => [...new Map((Array.isArray(rows) ? rows : []).map(row => [openingFingerprint(row), row])).values()];

/**
 * Canonicalizes restored fiscal-year datasets. Analytical entities own their
 * openings; a control account stores only one derived cache per currency.
 * This migration is deliberately independent from the source backup marker so
 * it also runs after restoring a database produced by an older application.
 */
export function migrateCanonicalControlOpenings(db, relationalStore) {
  const markerKey = 'canonical_control_openings_v1';
  if (db.prepare('SELECT value FROM app_metadata WHERE key=?').get(markerKey)?.value) return { migrated: false, years: 0, keys: 0, duplicatesRemoved: 0 };
  const read = db.prepare('SELECT value FROM kv_store WHERE key=?');
  const scopedAccounts = db.prepare("SELECT key,value FROM kv_store WHERE key GLOB 'elite-erp-accounts-v9::fiscal-year::*'").all();
  const write = db.prepare("UPDATE kv_store SET value=?,updated_at=datetime('now') WHERE key=?");
  const bump = db.prepare(`INSERT INTO kv_versions(key,version,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=datetime('now')`);
  let keys = 0;
  let duplicatesRemoved = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const accountRow of scopedAccounts) {
      const year = accountRow.key.match(/::fiscal-year::(\d{4})$/)?.[1];
      if (!year) continue;
      const accounts = parse(accountRow.value);
      if (!Array.isArray(accounts)) continue;
      const entityCollections = CONTROL_ENTITY_KEYS.map(baseKey => {
        const key = `${baseKey}::fiscal-year::${year}`;
        return { key, rows: parse(read.get(key)?.value) };
      }).filter(collection => Array.isArray(collection.rows));
      const entitiesByAccount = new Map();
      for (const collection of entityCollections) {
        let collectionChanged = false;
        collection.rows = collection.rows.map(entity => {
          if (!entity?.linkedAccountId) return entity;
          let rows = uniqueOpenings((entity.openingBalances || []).filter(row => String(row?.fiscalYear || year) === year));
          duplicatesRemoved += Math.max(0, (entity.openingBalances || []).filter(row => String(row?.fiscalYear || year) === year).length - rows.length);
          if (!rows.length && Math.abs(Number(entity.openingBalance || 0)) >= 0.005) {
            const local = round2(entity.openingBalance);
            const currency = entity.openingCurrency || entity.defaultCurrency || 'YER';
            const rate = Number(entity.openingRate || 1);
            const foreign = currency === 'YER' ? local : round2(entity.openingBalanceForeign || (rate > 0 ? local / rate : 0));
            rows = [{ id: `restored-opening-${year}-${entity.id}-${currency}`, fiscalYear: year, accountId: entity.linkedAccountId, subAccountId: entity.id, currency, exchangeRate: rate, rate, debit: foreign > 0 ? foreign : 0, credit: foreign < 0 ? Math.abs(foreign) : 0, debitLocal: local > 0 ? local : 0, creditLocal: local < 0 ? Math.abs(local) : 0, amount: local, foreignAmount: foreign }];
          }
          if (rows.length) {
            const list = entitiesByAccount.get(entity.linkedAccountId) || [];
            list.push(...rows);
            entitiesByAccount.set(entity.linkedAccountId, list);
          }
          const preserved = (entity.openingBalances || []).filter(row => String(row?.fiscalYear || year) !== year);
          const nextRows = [...preserved, ...rows];
          if (JSON.stringify(nextRows) !== JSON.stringify(entity.openingBalances || [])) collectionChanged = true;
          return { ...entity, openingBalances: nextRows, openingBalance: round2(rows.reduce((sum, row) => sum + Number(row.amount ?? (Number(row.debitLocal || 0) - Number(row.creditLocal || 0))), 0)) };
        });
        if (collectionChanged) {
          const serialized = JSON.stringify(collection.rows);
          write.run(serialized, collection.key); relationalStore.syncCollection(collection.key, serialized); bump.run(collection.key); keys += 1;
        }
      }
      let accountsChanged = false;
      const nextAccounts = accounts.map(account => {
        const analytical = entitiesByAccount.get(account.id);
        if (!analytical?.length) return account;
        const byCurrency = new Map();
        analytical.forEach(row => {
          const currency = row.currency || account.defaultCurrency || 'YER';
          const list = byCurrency.get(currency) || []; list.push(row); byCurrency.set(currency, list);
        });
        const derived = [...byCurrency].map(([currency, rows]) => {
          const debit = round2(rows.reduce((s, row) => s + Number(row.debit || 0), 0));
          const credit = round2(rows.reduce((s, row) => s + Number(row.credit || 0), 0));
          const debitLocal = round2(rows.reduce((s, row) => s + Number(row.debitLocal ?? Math.max(0, row.amount || 0)), 0));
          const creditLocal = round2(rows.reduce((s, row) => s + Number(row.creditLocal ?? Math.max(0, -(row.amount || 0))), 0));
          const rate = Number(rows.find(row => Number(row.rate || row.exchangeRate || 0) > 0)?.rate || rows[0]?.exchangeRate || 1);
          return { id: `control-opening-${account.id}-${currency}-${year}`, fiscalYear: year, accountId: account.id, currency, exchangeRate: rate, rate, debit, credit, debitLocal, creditLocal, amount: round2(debitLocal - creditLocal), foreignAmount: round2(debit - credit), derivedFromSubLedgers: true };
        });
        const preserved = (account.openingBalances || []).filter(row => String(row?.fiscalYear || year) !== year);
        const openingBalances = [...preserved, ...derived];
        const openingBalance = round2(derived.reduce((sum, row) => sum + row.amount, 0));
        const next = { ...account, openingBalances, openingBalance };
        if (JSON.stringify(next) !== JSON.stringify(account)) accountsChanged = true;
        return next;
      });
      if (accountsChanged) {
        const serialized = JSON.stringify(nextAccounts);
        write.run(serialized, accountRow.key); relationalStore.syncCollection(accountRow.key, serialized); bump.run(accountRow.key); keys += 1;
      }
    }
    db.prepare('INSERT INTO app_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(markerKey, new Date().toISOString());
    db.exec('COMMIT');
    return { migrated: true, years: scopedAccounts.length, keys, duplicatesRemoved };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}
