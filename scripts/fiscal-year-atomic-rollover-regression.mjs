import { DatabaseSync } from 'node:sqlite';
import { createRelationalStore, RELATIONAL_COLLECTION_KEYS } from '../electron/relational-store.mjs';
import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
import { cloneYearDataset } from '../electron/fiscal-year-rollover.mjs';

const db = new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT,updated_at TEXT);`);
const relational = createRelationalStore(db);
const commands = createAccountingCommandStore(db, relational);
const key = (base, year) => `${base}::fiscal-year::${year}`;
const source = {
  accounts: [{ id: 'A-2026', code: '1101', nameAr: 'الصندوق', nameEn: 'Cash', level: 5, accountType: 1, reportType: 1, nature: 'DEBIT', category: 'ASSET', subLedgerType: 'NONE', defaultCurrency: 'YER', openingBalance: 50, isActive: true, fiscalYear: '2026' }],
  journals: [{ id: 'J-2026', entryNumber: 'JV-1', date: '2026-12-31', lines: [{ id: 'L-2026', accountId: 'A-2026', debit: 50, credit: 0 }], fiscalYear: '2026' }],
};
const sourceAccountKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2026');
const sourceJournalKey = key(RELATIONAL_COLLECTION_KEYS.journals, '2026');
commands.executeVersionedSet(sourceAccountKey, JSON.stringify(source.accounts), 0);
commands.executeVersionedSet(sourceJournalKey, JSON.stringify(source.journals), 0);
const sourceBefore = db.prepare('SELECT value FROM kv_store WHERE key=?').get(sourceAccountKey).value;
const cloned = cloneYearDataset(source, '2026', '2027').collections;
const targetAccountKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2027');
const targetJournalKey = key(RELATIONAL_COLLECTION_KEYS.journals, '2027');
const result = commands.execute({
  idempotencyKey: 'FISCAL_YEAR_CLONE:2026:2027', commandType: 'FISCAL_YEAR_CLONE', documentType: 'YEAR_DATASET', documentNumber: '2026->2027',
  changes: [{ key: targetAccountKey, value: JSON.stringify(cloned.accounts) }, { key: targetJournalKey, value: JSON.stringify(cloned.journals) }],
  expectedVersions: { [targetAccountKey]: 0, [targetJournalKey]: 0 },
});
const sourceAfter = db.prepare('SELECT value FROM kv_store WHERE key=?').get(sourceAccountKey).value;
const targetAccounts = JSON.parse(relational.readCollection(targetAccountKey));
const targetJournals = JSON.parse(relational.readCollection(targetJournalKey));
const failedKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2028');
const failed = commands.execute({ idempotencyKey: 'FAIL-2028', commandType: 'FISCAL_YEAR_CLONE', documentType: 'YEAR_DATASET', documentNumber: '2027->2028', changes: [{ key: failedKey, value: '[]' }], expectedVersions: { [failedKey]: 99 } });
const failedAbsent = !db.prepare('SELECT 1 AS found FROM kv_store WHERE key=?').get(failedKey);
db.close();
if (!result.ok || sourceBefore !== sourceAfter || targetAccounts.length !== 1 || targetJournals.length !== 1 || targetAccounts[0].id === source.accounts[0].id || targetJournals[0].lines[0].accountId !== targetAccounts[0].id || !failed.conflict || !failedAbsent) throw new Error(JSON.stringify({ result, sourceUnchanged: sourceBefore === sourceAfter, targetAccounts, targetJournals, failed, failedAbsent }));
console.log('FISCAL_YEAR_ATOMIC_ROLLOVER_OK sourceUnchanged=true targetIndependent=true linksRemapped=true conflictRollback=true');
