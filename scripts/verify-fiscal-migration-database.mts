import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createRelationalStore } from '../electron/relational-store.mjs';
import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
import { inferLegacyFiscalYear, migrateLegacyFiscalDataset } from '../electron/legacy-fiscal-migration.mjs';
import { calculateTrialBalance } from '../src/utils/accountingEngine';
import type { Account, JournalEntry } from '../src/types/erp';

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) throw new Error('Usage: tsx verify-fiscal-migration-database.mts SOURCE TARGET');
fs.copyFileSync(sourcePath, targetPath);
const db = new DatabaseSync(targetPath);
db.exec('PRAGMA foreign_keys=ON');
const raw = (key: string) => String(db.prepare('SELECT value FROM kv_store WHERE key=?').get(key)?.value ?? '[]');
const accountsKey = 'elite-erp-accounts-v9';
const journalsKey = 'elite-erp-journals-v6';
const settingsKey = 'elite-erp-settings-v6';
const accountsBeforeRaw = raw(accountsKey);
const journalsBeforeRaw = raw(journalsKey);
const sourceYear = inferLegacyFiscalYear(raw(journalsKey));
const normalizeAccounts = (rows: Account[]) => rows.map(account => {
  const openingRows = (account.openingBalances || []).filter(item => !item.fiscalYear || item.fiscalYear === sourceYear);
  const openingBalance = Array.isArray(account.openingBalances)
    ? openingRows.reduce((sum, item) => sum + (item.debitLocal || 0) - (item.creditLocal || 0), 0)
    : account.openingBalance || 0;
  return { ...account, openingBalances: openingRows, openingBalance };
});
const sourceAccounts = normalizeAccounts(JSON.parse(raw(accountsKey)) as Account[]);
const sourceJournals = (JSON.parse(raw(journalsKey)) as JournalEntry[]).filter(item => String(item.date || '').startsWith(`${sourceYear}-`));
const before = calculateTrialBalance(sourceAccounts, sourceJournals);
const settingsBefore = raw(settingsKey);
const relational = createRelationalStore(db);
createAccountingCommandStore(db, relational);
const migrated = migrateLegacyFiscalDataset(db, relational, sourceYear);
const scoped = (key: string) => `${key}::fiscal-year::${sourceYear}`;
const migratedAccounts = normalizeAccounts(JSON.parse(raw(scoped(accountsKey))) as Account[]);
const migratedJournals = JSON.parse(raw(scoped(journalsKey))) as JournalEntry[];
const after = calculateTrialBalance(migratedAccounts, migratedJournals);
const targetYear = String(Number(sourceYear) + 1);
const targetAccountsRaw = raw(`${accountsKey}::fiscal-year::${targetYear}`);
const targetJournalsRaw = raw(`${journalsKey}::fiscal-year::${targetYear}`);
const targetAccounts = JSON.parse(targetAccountsRaw) as Account[];
const targetJournals = JSON.parse(targetJournalsRaw) as JournalEntry[];
const numeric = (report: typeof before) => ({
  totalDebit: report.totalDebit,
  totalCredit: report.totalCredit,
  rows: report.rows.map(row => [row.accountCode, row.debitBalance, row.creditBalance]),
});
const sourceUnchanged = raw(accountsKey) === accountsBeforeRaw && raw(journalsKey) === journalsBeforeRaw && raw(settingsKey) === settingsBefore;
const reportsEqual = JSON.stringify(numeric(before)) === JSON.stringify(numeric(after));
const sourceIds = new Set(migratedAccounts.map(item => item.id));
const targetIndependent = targetAccounts.length > 0 && targetAccounts.every(item => !sourceIds.has(item.id));
const auditJournalsReadOnly = targetJournals.filter(item => /^OPEN-\d{4}$/.test(item.reference || item.entryNumber || '')).every(item => item.readOnly && item.affectsLedger === false && item.entryKind === 'OPENING_AUDIT');
const integrity = String(db.prepare('PRAGMA integrity_check').get()?.integrity_check || '');
db.close();
if (!migrated.migrated || sourceYear !== '2026' || !reportsEqual || !sourceUnchanged || !targetIndependent || !auditJournalsReadOnly || integrity !== 'ok') {
  throw new Error(JSON.stringify({ migrated, reportsEqual, sourceUnchanged, targetIndependent, auditJournalsReadOnly, integrity, before: numeric(before), after: numeric(after) }));
}
console.log(`FISCAL_MIGRATION_DATABASE_OK year=${sourceYear} years=${migrated.years.join(',')} rows=${before.rows.length} debit=${before.totalDebit} credit=${before.totalCredit} sourceUnchanged=true settingsGlobal=true targetIndependent=true auditReadOnly=true integrity=ok output=${targetPath}`);
