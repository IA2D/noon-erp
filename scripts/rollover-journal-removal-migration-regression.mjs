import { DatabaseSync } from 'node:sqlite';
import { createRelationalStore } from '../electron/relational-store.mjs';
import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
import { migrateRemoveRolloverJournals } from '../electron/legacy-fiscal-migration.mjs';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE app_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT 'app_state',updated_at TEXT);`);
const relational = createRelationalStore(db);
createAccountingCommandStore(db, relational);
const put = db.prepare("INSERT INTO kv_store(key,value,entity_type) VALUES(?,?,'erp_state')");
put.run('elite-erp-journals-v6::fiscal-year::2027', JSON.stringify([
  { id: 'open', entryKind: 'OPENING_AUDIT', entryNumber: 'OPEN-2027', reference: 'OPEN-2027', date: '2027-01-01', lines: [] },
  { id: 'real', entryNumber: 'JV-1', reference: 'REF', date: '2027-02-01', lines: [] },
]));
put.run('elite-erp-period-states-v1::fiscal-year::2026', JSON.stringify([{ id: 'p', key: '2026', openingEntryId: 'OPEN-2027', status: 'FINAL_CLOSED' }]));
const first = migrateRemoveRolloverJournals(db, relational);
const journals = JSON.parse(db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-journals-v6::fiscal-year::2027'").get().value);
const periods = JSON.parse(db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-period-states-v1::fiscal-year::2026'").get().value);
const second = migrateRemoveRolloverJournals(db, relational);
db.close();
if (!first.migrated || first.removed !== 1 || journals.length !== 1 || journals[0].id !== 'real' || periods[0].openingEntryId || second.migrated) throw new Error(JSON.stringify({ first, journals, periods, second }));
console.log('ROLLOVER_JOURNAL_REMOVAL_OK removed=1 realJournalPreserved=true periodLinkRemoved=true idempotent=true');
