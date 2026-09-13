import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { createRelationalStore } from '../electron/relational-store.mjs';
import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
import { migrateRolloverOpeningResiduals } from '../electron/legacy-fiscal-migration.mjs';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE app_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT 'app_state',updated_at TEXT);`);
const relational = createRelationalStore(db); relational.ensureSchema(); createAccountingCommandStore(db, relational);
const put = db.prepare(`INSERT INTO kv_store(key,value,entity_type) VALUES(?,?,'erp_state')`);
const opening = (id, accountId, amount, ref) => ({ id, fiscalYear: '2027', accountId, currency: 'YER', exchangeRate: 1, rate: 1, debit: amount > 0 ? amount : 0, credit: amount < 0 ? -amount : 0, debitLocal: amount > 0 ? amount : 0, creditLocal: amount < 0 ? -amount : 0, amount, foreignAmount: amount, documentRef: ref });
const accounts = [
  { id: 'asset', code: '1101010001', nameAr: 'صندوق', openingBalance: 100, openingBalances: [opening('a', 'asset', 100, 'CARRY-2026-2027')] },
  { id: 'liability', code: '2101010001', nameAr: 'التزام', openingBalance: -160, openingBalances: [opening('l', 'liability', -160, 'CARRY-2026-2027')] },
  { id: 'retained', code: '2202010001', nameAr: 'أرباح مبقاة تراكمية', openingBalance: 0, openingBalances: [] },
];
put.run('elite-erp-accounts-v9::fiscal-year::2027', JSON.stringify(accounts));
put.run('elite-erp-opening-balances-status-v1::fiscal-year::2027', JSON.stringify('POSTED'));
put.run('elite-erp-currencies-v1::fiscal-year::2027', JSON.stringify([{ code: 'YER', isBase: true }]));
for (const key of ['elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1','elite-erp-employees-v1','elite-erp-customers-v1','elite-erp-vendors-v1']) put.run(`${key}::fiscal-year::2027`, '[]');
const first = migrateRolloverOpeningResiduals(db, relational);
const repaired = JSON.parse(db.prepare('SELECT value FROM kv_store WHERE key=?').get('elite-erp-accounts-v9::fiscal-year::2027').value);
const retained = repaired.find(row => row.id === 'retained');
const net = repaired.reduce((sum, account) => sum + (account.openingBalances || []).reduce((s, row) => s + Number(row.amount || 0), 0), 0);
const again = migrateRolloverOpeningResiduals(db, relational);
assert.equal(first.repairedYears, 1);
assert.equal(retained.openingBalance, 60);
assert.equal(retained.openingBalances.length, 1);
assert.equal(net, 0);
assert.equal(again.migrated, false);
db.close();
console.log('ROLLOVER_OPENING_RESIDUAL_OK missingRetainedRepaired=true residual=60 balanced=true oneRow=true idempotent=true');
