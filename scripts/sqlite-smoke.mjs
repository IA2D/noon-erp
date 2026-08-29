import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const file = path.join(os.tmpdir(), `fullerp-smoke-${process.pid}.sqlite`);
const db = new DatabaseSync(file);
db.exec(`
  CREATE TABLE kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'app_state',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
const set = db.prepare(`
  INSERT INTO kv_store(key,value,entity_type,updated_at) VALUES (?,?,?,datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value=excluded.value, entity_type=excluded.entity_type, updated_at=datetime('now')
`);
const remove = db.prepare('DELETE FROM kv_store WHERE key=?');
set.run('elite-erp-journals-v6', '[{"id":"J-1"}]', 'erp_state');
const value = db.prepare('SELECT value FROM kv_store WHERE key=?').get('elite-erp-journals-v6')?.value;

const restoreEntries = [
  ['elite-erp-settings-v6', '{"fiscalYear":"2026"}'],
  ['elite-erp-company-branches-v1', '[{"id":"br-main"}]'],
];
const previous = db.prepare('SELECT key FROM kv_store').all();
db.exec('BEGIN IMMEDIATE');
previous.filter(row => row.key.startsWith('elite-erp-')).forEach(row => remove.run(row.key));
restoreEntries.forEach(([key, entryValue]) => set.run(key, entryValue, 'erp_state'));
db.exec('COMMIT');

const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
const rows = db.prepare('SELECT key,value FROM kv_store ORDER BY key').all();
db.close();
fs.rmSync(file, { force: true });
if (
  value !== '[{"id":"J-1"}]' ||
  integrity !== 'ok' ||
  rows.length !== 2 ||
  rows.some(row => row.key === 'elite-erp-journals-v6')
) process.exit(1);
console.log(`SQLITE_BACKUP_RESTORE_SMOKE_OK baseline=${value} restored=${restoreEntries.length} removed=${previous.length} total=${rows.length} integrity=${integrity}`);
