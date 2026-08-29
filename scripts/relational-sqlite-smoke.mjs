import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRelationalStore, RELATIONAL_COLLECTION_KEYS } from '../electron/relational-store.mjs';

const file = path.join(os.tmpdir(), `fullerp-relational-smoke-${process.pid}.sqlite`);
const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys=ON;');
const store = createRelationalStore(db);
store.ensureSchema();

const accounts = [
  { id: 'A-1', code: '1101', nameAr: 'النقدية', nameEn: 'Cash', level: 4, accountType: 1, reportType: 1, nature: 'DEBIT', category: 'ASSET', subLedgerType: 'NONE', defaultCurrency: 'YER', openingBalance: 0, isActive: true, currencies: [] },
  { id: 'A-2', code: '110101', nameAr: 'الصندوق', nameEn: 'Cash Box', level: 5, accountType: 2, reportType: 1, parentId: 'A-1', nature: 'DEBIT', category: 'ASSET', subLedgerType: 'CASH_BOX', defaultCurrency: 'YER', openingBalance: 100, isActive: true, currencies: [{ id: 'CUR-YER', code: 'YER', isDefault: true, isActive: true }] },
];
const journals = [{
  id: 'J-1', entryNumber: 'JV-1', date: '2026-08-27', reference: 'REF-1', narration: 'قيد تجريبي', totalDebit: 100, totalCredit: 100,
  currency: 'YER', exchangeRate: 1, status: 'POSTED', type: 'JV', sourceType: 'MANUAL', createdBy: 'admin', createdAt: '2026-08-27T00:00:00.000Z',
  lines: [
    { id: 'JL-1', accountId: 'A-2', accountCode: '110101', accountNameAr: 'الصندوق', debit: 100, credit: 0, description: 'مدين', currency: 'YER', exchangeRate: 1 },
    { id: 'JL-2', accountId: 'A-1', accountCode: '1101', accountNameAr: 'النقدية', debit: 0, credit: 100, description: 'دائن', currency: 'YER', exchangeRate: 1 },
  ],
}];
const paymentVouchers = [{
  id: 'PV-1', voucherNumber: 'PV-1', date: '2026-08-27', paymentMethod: 'CASH', sourceType: 'CASH_BOX', sourceAccountId: 'A-2', sourceAccountNameAr: 'الصندوق', payeeName: 'مورد', narration: 'صرف', currency: 'YER', exchangeRate: 1, subtotalAmount: 50, totalAmount: 50, amountInWordsAr: '', status: 'POSTED', createdBy: 'admin', createdAt: '2026-08-27T00:00:00.000Z', lines: [{ id: 'PVL-1', accountId: 'A-1', accountCode: '1101', accountNameAr: 'النقدية', description: 'صرف', amount: 50, totalAmount: 50, localAmount: 50 }] },
];
const receiptVouchers = [{
  id: 'RV-1', receiptNumber: 'RV-1', date: '2026-08-27', receiptMethod: 'CASH', sourceType: 'CASH_BOX', sourceAccountId: 'A-2', sourceAccountNameAr: 'الصندوق', payerName: 'عميل', narration: 'قبض', currency: 'YER', exchangeRate: 1, subtotalAmount: 75, totalAmount: 75, amountInWordsAr: '', status: 'POSTED', createdBy: 'admin', createdAt: '2026-08-27T00:00:00.000Z', lines: [{ id: 'RVL-1', accountId: 'A-1', accountCode: '1101', accountNameAr: 'النقدية', description: 'قبض', amount: 75, totalAmount: 75, localAmount: 75 }] },
];
const currencies = [{ id: 'CUR-YER', code: 'YER', nameAr: 'ريال يمني', decimals: 0, isBase: true, isActive: true }];
const costCenters = [{ id: 'CC-1', code: 'CC-1', nameAr: 'المركز الرئيسي' }];
const cashBoxes = [{ id: 'BOX-1', code: 'BOX-1', nameAr: 'الصندوق الرئيسي', linkedAccountId: 'A-2', isActive: true }];

const snapshot = new Map([
  [RELATIONAL_COLLECTION_KEYS.accounts, JSON.stringify(accounts)],
  [RELATIONAL_COLLECTION_KEYS.journals, JSON.stringify(journals)],
  [RELATIONAL_COLLECTION_KEYS.paymentVouchers, JSON.stringify(paymentVouchers)],
  [RELATIONAL_COLLECTION_KEYS.receiptVouchers, JSON.stringify(receiptVouchers)],
  [RELATIONAL_COLLECTION_KEYS.currencies, JSON.stringify(currencies)],
  [RELATIONAL_COLLECTION_KEYS.costCenters, JSON.stringify(costCenters)],
  [RELATIONAL_COLLECTION_KEYS.cashBoxes, JSON.stringify(cashBoxes)],
]);

db.exec('BEGIN IMMEDIATE');
store.rebuildAll(snapshot);
db.exec('COMMIT');
const initial = store.info();
db.prepare('UPDATE erp_journal_lines SET debit=321 WHERE id=?').run('JL-1');
const authoritativeRead = JSON.parse(store.readCollection(RELATIONAL_COLLECTION_KEYS.journals));
const authoritativeDebit = authoritativeRead[0].lines.find(line => line.id === 'JL-1')?.debit;

db.exec('BEGIN IMMEDIATE');
store.syncCollection(RELATIONAL_COLLECTION_KEYS.journals, JSON.stringify([{ ...journals[0], totalDebit: 125, totalCredit: 125, lines: journals[0].lines.slice(0, 1) }]));
db.exec('COMMIT');
const updatedDebit = db.prepare('SELECT total_debit FROM erp_journal_entries WHERE id=?').get('J-1')?.total_debit;
const updatedLines = db.prepare('SELECT count(*) AS count FROM erp_journal_lines WHERE journal_id=?').get('J-1')?.count;

db.exec('BEGIN IMMEDIATE');
store.clearCollection(RELATIONAL_COLLECTION_KEYS.paymentVouchers);
db.exec('COMMIT');
const afterDelete = store.info();

db.exec('BEGIN IMMEDIATE');
store.rebuildAll(snapshot);
db.exec('COMMIT');
const restored = store.info();
const diagnostics = store.diagnostics();
let missingAccountBlocked = false;
try {
  db.prepare(`INSERT INTO erp_journal_lines(id,journal_id,line_index,account_id,account_code,account_name_ar,debit,credit,description,exchange_rate,payload_json) VALUES ('BAD-L','J-1',99,'MISSING','X','X',1,0,'bad',1,'{}')`).run();
} catch { missingAccountBlocked = true; }
let referencedAccountDeleteBlocked = false;
try { db.prepare(`DELETE FROM erp_accounts WHERE id='A-2'`).run(); } catch { referencedAccountDeleteBlocked = true; }
let duplicateEntityBlocked = false;
db.exec('SAVEPOINT duplicate_test');
try {
  store.syncCollection(RELATIONAL_COLLECTION_KEYS.cashBoxes, JSON.stringify([...cashBoxes, { ...cashBoxes[0], id: 'BOX-2' }]));
} catch {
  duplicateEntityBlocked = true;
  db.exec('ROLLBACK TO duplicate_test');
}
db.exec('RELEASE duplicate_test');
const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
db.close();
fs.rmSync(file, { force: true });

const valid =
  initial.accounts === 2 && initial.accountCurrencies === 1 && initial.journals === 1 && initial.journalLines === 2 &&
  initial.paymentVouchers === 1 && initial.paymentVoucherLines === 1 && initial.receiptVouchers === 1 && initial.receiptVoucherLines === 1 &&
  initial.currencies === 1 && initial.costCenters === 1 && initial.masterEntities === 1 &&
  authoritativeDebit === 321 &&
  updatedDebit === 125 && updatedLines === 1 && afterDelete.paymentVouchers === 0 && afterDelete.paymentVoucherLines === 0 &&
  restored.journalLines === 2 && restored.paymentVouchers === 1 && diagnostics.ok && missingAccountBlocked && referencedAccountDeleteBlocked && duplicateEntityBlocked && integrity === 'ok';

if (!valid) {
  console.error({ initial, updatedDebit, updatedLines, afterDelete, restored, integrity });
  process.exit(1);
}

console.log(`RELATIONAL_SQLITE_SMOKE_OK accounts=${restored.accounts} journals=${restored.journals}/${restored.journalLines} payments=${restored.paymentVouchers}/${restored.paymentVoucherLines} receipts=${restored.receiptVouchers}/${restored.receiptVoucherLines} masters=${restored.masterEntities} authority=normalized authoritativeDebit=${authoritativeDebit} diagnostics=${diagnostics.ok} fkReferenceBlocked=${missingAccountBlocked} referencedDeleteBlocked=${referencedAccountDeleteBlocked} duplicateEntityBlocked=${duplicateEntityBlocked} updateDebit=${updatedDebit} deleteCascade=${afterDelete.paymentVoucherLines} integrity=${integrity}`);
