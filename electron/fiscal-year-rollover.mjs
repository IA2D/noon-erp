import { normalizeFiscalYear } from './fiscal-year-context.mjs';

const DEFAULT_COLLECTIONS = ['accounts','costCenters','cashBoxes','bankAccounts','employees','customers','vendors','journals','paymentVouchers','receiptVouchers','trusts','custodies','auditLogs'];
const RELATION_KEYS = new Set(['parentId','linkedAccountId','sourceAccountId','sourceEntityId','journalEntryId','reversalJournalEntryId','reversalByEntryId','costCenterId','subLedgerId','accountId','employeeId','customerId','vendorId','cashBoxId','bankAccountId','custodyId','trustId','openingEntryId']);

const cloneValue = (value, idMap, sourceYear, targetYear, key = '') => {
  if (Array.isArray(value)) return value.map(item => cloneValue(item, idMap, sourceYear, targetYear, key));
  if (!value || typeof value !== 'object') {
    if ((key === 'id' || RELATION_KEYS.has(key)) && typeof value === 'string' && idMap.has(value)) return idMap.get(value);
    if ((key === 'fiscalYear' || key === 'fiscal_year') && String(value) === sourceYear) return targetYear;
    if ((key === 'date' || key === 'voucherDate' || key === 'receiptDate') && typeof value === 'string') return value.replace(new RegExp(`^${sourceYear}(?=-)`), targetYear);
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, cloneValue(childValue, idMap, sourceYear, targetYear, childKey)]));
};

/** Clone an isolated fiscal-year graph. The returned graph contains no source IDs. */
export function cloneYearDataset(dataset, sourceYearInput, targetYearInput, collections = DEFAULT_COLLECTIONS) {
  const sourceYear = normalizeFiscalYear(sourceYearInput);
  const targetYear = normalizeFiscalYear(targetYearInput);
  if (sourceYear === targetYear) throw new Error('ROLLOVER_SOURCE_EQUALS_TARGET');
  const source = dataset || {};
  const selected = collections.filter(name => Array.isArray(source[name]));
  const idMap = new Map();
  const collectIds = (value, name, counter = { value: 0 }) => {
    if (Array.isArray(value)) { value.forEach(item => collectIds(item, name, counter)); return; }
    if (!value || typeof value !== 'object') return;
    if (value.id != null) {
      counter.value += 1;
      idMap.set(String(value.id), `${targetYear}-${name}-${counter.value}-${String(value.id)}`);
    }
    Object.values(value).forEach(child => collectIds(child, name, counter));
  };
  selected.forEach(name => collectIds(source[name], name));
  const result = {};
  selected.forEach(name => {
    result[name] = source[name].map(record => {
      const cloned = cloneValue(record, idMap, sourceYear, targetYear);
      if (cloned && typeof cloned === 'object') {
        if (record.id != null) cloned.id = idMap.get(String(record.id));
        cloned.fiscalYear = targetYear;
        if (cloned.createdAt && typeof cloned.createdAt === 'string') cloned.createdAt = cloned.createdAt.replace(new RegExp(`^${sourceYear}(?=-)`), targetYear);
      }
      return cloned;
    });
  });
  return { sourceYear, targetYear, idMap, collections: result };
}

export function validateClonedYearGraph(original, cloned) {
  const sourceIds = new Set(Object.values(original || {}).flatMap(rows => Array.isArray(rows) ? rows.map(row => String(row?.id ?? '')) : []));
  const clonedRows = Object.values(cloned?.collections || {}).flatMap(rows => rows || []);
  const clonedIds = clonedRows.map(row => String(row?.id ?? ''));
  if (clonedIds.some(id => sourceIds.has(id))) return { ok: false, error: 'SOURCE_ID_REUSED' };
  if (new Set(clonedIds).size !== clonedIds.length) return { ok: false, error: 'CLONED_ID_COLLISION' };
  if (clonedRows.some(row => row?.fiscalYear !== cloned.targetYear)) return { ok: false, error: 'TARGET_YEAR_MISSING' };
  return { ok: true, count: clonedRows.length };
}
