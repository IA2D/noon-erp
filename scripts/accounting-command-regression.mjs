import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRelationalStore, RELATIONAL_COLLECTION_KEYS } from '../electron/relational-store.mjs';
import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';

const file = path.join(os.tmpdir(), `fullerp-command-${process.pid}.sqlite`);
const db = new DatabaseSync(file);
db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT 'app_state',updated_at TEXT NOT NULL DEFAULT(datetime('now')));`);
const relational = createRelationalStore(db);
const commands = createAccountingCommandStore(db, relational);
const journalKey = RELATIONAL_COLLECTION_KEYS.journals;
const accountKey = RELATIONAL_COLLECTION_KEYS.accounts;
const auditKey = 'elite-erp-auditlogs-v6';
const accounts = [
  { id: 'A1', code: '1101010001', nameAr: 'الصندوق العام', nameEn: '', level: 5, accountType: 1, reportType: 1, nature: 'DEBIT', category: 'ASSET', subLedgerType: 'NONE', defaultCurrency: 'YER', openingBalance: 0, isActive: true, currencies: [] },
  { id: 'A2', code: '1201020002', nameAr: 'حساب اختبار', nameEn: '', level: 5, accountType: 1, reportType: 1, nature: 'CREDIT', category: 'LIABILITY', subLedgerType: 'NONE', defaultCurrency: 'YER', openingBalance: 0, isActive: true, currencies: [] },
];
db.prepare('INSERT INTO kv_store(key,value,entity_type) VALUES(?,?,?)').run(accountKey, JSON.stringify(accounts), 'erp_state');
const journal = [{ id: 'J1', entryNumber: 'JV-1', date: '2026-08-27', reference: '', narration: 'atomic', lines: [{ id: 'JL1', accountId: 'A1', accountCode: '1101010001', accountNameAr: 'الصندوق العام', debit: 100000, credit: 0 }, { id: 'JL2', accountId: 'A2', accountCode: '1201020002', accountNameAr: 'حساب اختبار', debit: 0, credit: 100000 }], totalDebit: 100000, totalCredit: 100000, currency: 'YER', exchangeRate: 1, status: 'PENDING_POSTING', createdBy: 'test', createdAt: '2026-08-27' }];
const request = {
  idempotencyKey: 'POST:J1:v1', commandType: 'POST', documentType: 'JOURNAL', documentNumber: 'JV-1',
  expectedVersions: { [journalKey]: 0, [auditKey]: 0 },
  changes: [{ key: journalKey, value: JSON.stringify(journal) }, { key: auditKey, value: JSON.stringify([{ id: 'L1' }]) }],
};
const first = commands.execute(request);
assert.equal(first.ok, true);
assert.equal(first.replay, false);
assert.equal(db.prepare('SELECT count(*) AS count FROM erp_accounts').get().count, 2);
assert.equal(db.prepare('SELECT count(*) AS count FROM erp_journal_lines').get().count, 2);
assert.equal(commands.versionOf(journalKey), 1);
assert.equal(commands.execute(request).replay, true);
const duplicate = commands.execute({ ...request, idempotencyKey: 'POST:J1:v2', expectedVersions: { [journalKey]: 1, [auditKey]: 1 } });
assert.equal(duplicate.ok, false);
assert.equal(duplicate.duplicate, true);
const conflict = commands.execute({ ...request, idempotencyKey: 'POST:J2:v1', documentNumber: 'JV-2' });
assert.equal(conflict.conflict, true);
const auditBefore = db.prepare('SELECT value FROM kv_store WHERE key=?').get(auditKey).value;
const failed = commands.execute({ idempotencyKey: 'POST:J3:v1', commandType: 'POST', documentType: 'JOURNAL', documentNumber: 'JV-3', changes: [{ key: auditKey, value: '[{"id":"L2"}]' }, { key: journalKey, value: '{invalid' }] });
assert.equal(failed.ok, false);
assert.equal(db.prepare('SELECT value FROM kv_store WHERE key=?').get(auditKey).value, auditBefore);
assert.equal(db.prepare('SELECT count(*) AS count FROM accounting_command_receipts').get().count, 1);
const versionAfterCommand = commands.versionOf(journalKey);
const windowOne = commands.executeVersionedSet(journalKey, JSON.stringify(journal), versionAfterCommand);
assert.equal(windowOne.ok, true);
const staleWindow = commands.executeVersionedSet(journalKey, JSON.stringify(journal), versionAfterCommand);
assert.equal(staleWindow.ok, false);
assert.equal(staleWindow.conflict, true);
assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
db.close();
fs.rmSync(file, { force: true });
console.log('ACCOUNTING_COMMAND_REGRESSION_OK accountProjectionRepaired=true atomic=true idempotentReplay=true duplicateDocumentBlocked=true optimisticConflictBlocked=true staleWindowWriteBlocked=true failedCommandRolledBack=true receiptDurable=true integrity=ok');
