const ERP_PREFIX = 'elite-erp-';

export function createAccountingCommandStore(db, relationalStore) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounting_command_receipts (
      idempotency_key TEXT PRIMARY KEY,
      command_type TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      result_json TEXT NOT NULL,
      committed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_command_document
      ON accounting_command_receipts(command_type, document_type, document_number);
    CREATE TABLE IF NOT EXISTS kv_versions (
      key TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const readReceipt = db.prepare('SELECT result_json FROM accounting_command_receipts WHERE idempotency_key=?');
  const insertReceipt = db.prepare('INSERT INTO accounting_command_receipts(idempotency_key,command_type,document_type,document_number,result_json) VALUES(?,?,?,?,?)');
  const setKv = db.prepare(`INSERT INTO kv_store(key,value,entity_type,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,entity_type=excluded.entity_type,updated_at=datetime('now')`);
  const readVersion = db.prepare('SELECT version FROM kv_versions WHERE key=?');
  const bump = db.prepare(`INSERT INTO kv_versions(key,version,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=datetime('now') RETURNING version`);

  const versionOf = key => Number(readVersion.get(String(key))?.version || 0);
  const bumpVersion = key => Number(bump.get(String(key))?.version || 0);

  function execute(payload = {}) {
    const idempotencyKey = String(payload.idempotencyKey || '').trim();
    const commandType = String(payload.commandType || '').trim();
    const documentType = String(payload.documentType || '').trim();
    const documentNumber = String(payload.documentNumber || '').trim();
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    if (!idempotencyKey || !commandType || !documentType || !documentNumber) return { ok: false, error: 'Command identity is required.' };
    if (!changes.length || changes.length > 20) return { ok: false, error: 'Command changes must contain 1..20 entries.' };
    if (changes.some(change => !String(change?.key || '').startsWith(ERP_PREFIX) || typeof change?.value !== 'string')) return { ok: false, error: 'Only serialized ERP state changes are accepted.' };
    if (new Set(changes.map(change => String(change.key))).size !== changes.length) return { ok: false, error: 'Duplicate state key in command.' };

    try {
      db.exec('BEGIN IMMEDIATE');
      const replay = readReceipt.get(idempotencyKey);
      if (replay) {
        db.exec('COMMIT');
        return { ...JSON.parse(replay.result_json), replay: true };
      }
      const expected = payload.expectedVersions && typeof payload.expectedVersions === 'object' ? payload.expectedVersions : {};
      for (const change of changes) {
        const key = String(change.key);
        if (Object.prototype.hasOwnProperty.call(expected, key) && Number(expected[key]) !== versionOf(key)) {
          db.exec('ROLLBACK');
          return { ok: false, conflict: true, key, expectedVersion: Number(expected[key]), actualVersion: versionOf(key) };
        }
      }
      const versions = {};
      for (const change of changes) {
        const key = String(change.key);
        setKv.run(key, change.value, 'erp_state');
        relationalStore.syncCollection(key, change.value);
        versions[key] = bumpVersion(key);
      }
      const result = { ok: true, replay: false, idempotencyKey, commandType, documentType, documentNumber, versions };
      insertReceipt.run(idempotencyKey, commandType, documentType, documentNumber, JSON.stringify(result));
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      const duplicate = String(error).includes('idx_accounting_command_document') || String(error).includes('UNIQUE constraint failed');
      return { ok: false, duplicate, error: String(error) };
    }
  }

  function executeVersionedSet(keyInput, value, expectedVersion) {
    const key = String(keyInput || '');
    const expected = Number(expectedVersion) || 0;
    if (!key.startsWith(ERP_PREFIX) || typeof value !== 'string') return { ok: false, error: 'A serialized ERP state value is required.' };
    try {
      db.exec('BEGIN IMMEDIATE');
      const actual = versionOf(key);
      if (actual !== expected) {
        db.exec('ROLLBACK');
        return { ok: false, conflict: true, expectedVersion: expected, actualVersion: actual };
      }
      setKv.run(key, value, 'erp_state');
      relationalStore.syncCollection(key, value);
      const version = bumpVersion(key);
      db.exec('COMMIT');
      return { ok: true, version };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      return { ok: false, conflict: false, actualVersion: versionOf(key), error: String(error) };
    }
  }

  return { execute, executeVersionedSet, versionOf, bumpVersion };
}
