import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { createRelationalStore } from '../electron/relational-store.mjs';
import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
import { migrateCanonicalControlOpenings } from '../electron/legacy-fiscal-migration.mjs';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE app_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT 'app_state',updated_at TEXT);`);
const relational = createRelationalStore(db);
relational.ensureSchema();
createAccountingCommandStore(db, relational);
const put = db.prepare(`INSERT INTO kv_store(key,value,entity_type) VALUES(?,?,'erp_state')`);
const year = '2027';
const row = { id: 'child-1', fiscalYear: year, accountId: 'control', subAccountId: 'box-1', currency: 'YER', exchangeRate: 1, rate: 1, debit: 100, credit: 0, debitLocal: 100, creditLocal: 0, amount: 100, foreignAmount: 100 };
put.run(`elite-erp-accounts-v9::fiscal-year::${year}`, JSON.stringify([{ id: 'control', code: '1101', openingBalance: 100, openingBalances: [{ ...row, id: 'stale-parent', subAccountId: undefined }] }]));
put.run(`elite-erp-cashboxes-v1::fiscal-year::${year}`, JSON.stringify([
  { id: 'box-1', linkedAccountId: 'control', defaultCurrency: 'YER', openingBalance: 100, openingBalances: [row, { ...row, id: 'duplicate-new-id' }] },
  { id: 'box-2', linkedAccountId: 'control', defaultCurrency: 'YER', openingBalance: 50 },
]));
for (const key of ['elite-erp-bankaccounts-v1','elite-erp-employees-v1','elite-erp-customers-v1','elite-erp-vendors-v1']) put.run(`${key}::fiscal-year::${year}`, '[]');

const first = migrateCanonicalControlOpenings(db, relational);
const accounts = JSON.parse(db.prepare('SELECT value FROM kv_store WHERE key=?').get(`elite-erp-accounts-v9::fiscal-year::${year}`).value);
const boxes = JSON.parse(db.prepare('SELECT value FROM kv_store WHERE key=?').get(`elite-erp-cashboxes-v1::fiscal-year::${year}`).value);
const again = migrateCanonicalControlOpenings(db, relational);
assert.equal(first.migrated, true);
assert.equal(first.duplicatesRemoved, 1);
assert.equal(boxes[0].openingBalances.length, 1);
assert.equal(boxes[1].openingBalances.length, 1);
assert.equal(accounts[0].openingBalances.length, 1);
assert.equal(accounts[0].openingBalances[0].derivedFromSubLedgers, true);
assert.equal(accounts[0].openingBalance, 150);
assert.equal(again.migrated, false);
db.close();
console.log('CANONICAL_CONTROL_OPENINGS_OK analyticalSource=true duplicateRemoved=true scalarUpgraded=true parentDerivedOnce=true total=150 idempotent=true');
