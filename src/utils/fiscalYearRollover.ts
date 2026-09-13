const RELATION_KEYS = new Set(['parentId','linkedAccountId','sourceAccountId','sourceEntityId','journalEntryId','reversalJournalEntryId','reversalByEntryId','costCenterId','subLedgerId','accountId','employeeId','customerId','vendorId','cashBoxId','bankAccountId','custodyId','trustId','openingEntryId']);

const cloneNode = (value: unknown, ids: Map<string, string>, sourceYear: string, targetYear: string, key = ''): unknown => {
  if (Array.isArray(value)) return value.map(item => cloneNode(item, ids, sourceYear, targetYear, key));
  if (!value || typeof value !== 'object') {
    if ((key === 'id' || RELATION_KEYS.has(key)) && typeof value === 'string' && ids.has(value)) return ids.get(value);
    if ((key === 'fiscalYear' || key === 'fiscal_year') && String(value) === sourceYear) return targetYear;
    if ((key === 'date' || key.endsWith('Date')) && typeof value === 'string') return value.replace(new RegExp(`^${sourceYear}(?=-)`), targetYear);
    return value;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, cloneNode(child, ids, sourceYear, targetYear, childKey)]));
};

export function cloneFiscalYearCollections<T extends Record<string, unknown[]>>(collections: T, sourceYear: string, targetYear: string): { collections: T; idMap: Map<string, string> } {
  const ids = new Map<string, string>();
  const collect = (value: unknown, collection: string, counter: { value: number }) => {
    if (Array.isArray(value)) { value.forEach(item => collect(item, collection, counter)); return; }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (typeof object.id === 'string') { counter.value += 1; ids.set(object.id, `${targetYear}-${collection}-${counter.value}-${object.id}`); }
    Object.values(object).forEach(child => collect(child, collection, counter));
  };
  Object.entries(collections).forEach(([name, rows]) => collect(rows, name, { value: 0 }));
  const cloned = Object.fromEntries(Object.entries(collections).map(([name, rows]) => [name, rows.map(row => ({ ...(cloneNode(row, ids, sourceYear, targetYear) as Record<string, unknown>), fiscalYear: targetYear }))])) as T;
  return { collections: cloned, idMap: ids };
}
