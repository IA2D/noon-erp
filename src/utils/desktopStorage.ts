export const ERP_STORAGE_PREFIX = 'elite-erp-';

export interface PersistentStorageReport {
  engine: 'SQLite' | 'localStorage';
  schemaVersion: number;
  databasePath: string;
  storedEntries: number;
  legacyEntries: number;
  pendingMigrationEntries: number;
  relational?: ReturnType<NonNullable<Window['desktopStore']>['info']>['relational'];
}

export interface PersistentRestoreResult {
  ok: boolean;
  restored: number;
  removed: number;
  integrity: string;
  total: number;
  error?: string;
}

export interface AccountingCommandRequest {
  idempotencyKey: string;
  commandType: string;
  documentType: string;
  documentNumber: string;
  changes: Array<{ key: string; value: string }>;
  expectedVersions?: Record<string, number>;
}

export interface AccountingCommandResult {
  ok: boolean;
  replay?: boolean;
  conflict?: boolean;
  duplicate?: boolean;
  permissionDenied?: boolean;
  error?: string;
  key?: string;
  expectedVersion?: number;
  actualVersion?: number;
  versions?: Record<string, number>;
}

export function commitAccountingCommand(request: AccountingCommandRequest): AccountingCommandResult {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  if (!desktopStore) return { ok: false, error: 'SQLite accounting commands require the desktop runtime.' };
  const result = desktopStore.accountingCommand(request);
  if (result.ok && result.versions) window.dispatchEvent(new CustomEvent('fullerp:versions-updated', { detail: result.versions }));
  return result;
}

export function persistentVersion(key: string): number {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  return desktopStore ? desktopStore.version(key) : 0;
}

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getPersistentItem(key: string): string | null {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  if (desktopStore) {
    const stored = desktopStore.getItem(key);
    if (stored !== null) return stored;

    const legacy = browserStorage()?.getItem(key) ?? null;
    if (legacy !== null) desktopStore.setItem(key, legacy);
    return legacy;
  }
  return browserStorage()?.getItem(key) ?? null;
}

export function setPersistentItem(key: string, value: string): boolean {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  if (desktopStore) return desktopStore.setItem(key, value);
  const storage = browserStorage();
  if (!storage) return false;
  storage.setItem(key, value);
  return true;
}

export function removePersistentItem(key: string): boolean {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  if (desktopStore) return desktopStore.removeItem(key);
  const storage = browserStorage();
  if (!storage) return false;
  const existed = storage.getItem(key) !== null;
  storage.removeItem(key);
  return existed;
}

export function getPersistentEntries(prefix = ERP_STORAGE_PREFIX): Array<[string, string]> {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  if (desktopStore) {
    const current = new Map(desktopStore.entries());
    const legacy = browserStorage();
    if (legacy) {
      for (let index = 0; index < legacy.length; index += 1) {
        const key = legacy.key(index);
        if (!key || !key.startsWith(prefix) || current.has(key)) continue;
        const value = legacy.getItem(key);
        if (value === null) continue;
        desktopStore.setItem(key, value);
        current.set(key, value);
      }
    }
    return Array.from(current.entries()).filter(([key]) => key.startsWith(prefix));
  }

  const storage = browserStorage();
  if (!storage) return [];
  const result: Array<[string, string]> = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) result.push([key, storage.getItem(key) ?? '']);
  }
  return result;
}

export function replacePersistentEntries(entries: Array<[string, string]>, clearPrefixes = [ERP_STORAGE_PREFIX]): PersistentRestoreResult {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  if (desktopStore) return desktopStore.replaceEntries(entries, clearPrefixes);

  const storage = browserStorage();
  if (!storage) return { ok: false, restored: 0, removed: 0, integrity: 'not-applicable', total: 0, error: 'Storage unavailable' };
  const keys = Object.keys(storage);
  const removedKeys = keys.filter(key => clearPrefixes.some(prefix => key.startsWith(prefix)));
  removedKeys.forEach(key => storage.removeItem(key));
  entries.forEach(([key, value]) => storage.setItem(key, value));
  return { ok: true, restored: entries.length, removed: removedKeys.length, integrity: 'not-applicable', total: storage.length };
}

export function clearLegacyPersistentEntries(prefixes = [ERP_STORAGE_PREFIX]): number {
  const storage = browserStorage();
  if (!storage) return 0;
  const keys = Object.keys(storage).filter(key => prefixes.some(prefix => key.startsWith(prefix)));
  keys.forEach(key => storage.removeItem(key));
  return keys.length;
}

export function getPersistentStorageReport(): PersistentStorageReport {
  const desktopStore = typeof window !== 'undefined' ? window.desktopStore : undefined;
  const legacy = browserStorage();
  const legacyKeys = legacy ? Object.keys(legacy).filter(key => key.startsWith(ERP_STORAGE_PREFIX)) : [];

  if (!desktopStore) {
    return {
      engine: 'localStorage',
      schemaVersion: 0,
      databasePath: '',
      storedEntries: legacyKeys.length,
      legacyEntries: legacyKeys.length,
      pendingMigrationEntries: 0,
      relational: undefined,
    };
  }

  // Opening the migration report completes any remaining legacy ERP-key import.
  getPersistentEntries(ERP_STORAGE_PREFIX);
  const info = desktopStore.info();
  const sqliteKeys = new Set(desktopStore.entries().map(([key]) => key));
  return {
    engine: 'SQLite',
    schemaVersion: info.schemaVersion,
    databasePath: info.databasePath,
    storedEntries: info.entries,
    legacyEntries: legacyKeys.length,
    pendingMigrationEntries: legacyKeys.filter(key => !sqliteKeys.has(key)).length,
    relational: info.relational,
  };
}
