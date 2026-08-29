import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_PRE_POSTING_STATUS, migrateLegacyWorkflowStatuses } from '../src/utils/statusMigration';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('src/App.tsx');
const types = read('src/types/erp.ts');
const contractTypes = read('src/types/contracts.ts');
const closing = read('src/components/modules/ClosingView.tsx');

const legacy = migrateLegacyWorkflowStatuses({
  journals: [{ id: 'j', status: LEGACY_PRE_POSTING_STATUS }] as any,
  payments: [{ id: 'p', status: LEGACY_PRE_POSTING_STATUS }] as any,
  receipts: [{ id: 'r', status: LEGACY_PRE_POSTING_STATUS }] as any,
  custodies: [{ id: 'c', status: LEGACY_PRE_POSTING_STATUS }] as any,
  contracts: [{ id: 'k', status: LEGACY_PRE_POSTING_STATUS }] as any,
});
assert.equal(legacy.journals[0].status, 'PENDING_POSTING');
assert.equal(legacy.payments[0].status, 'PENDING_POSTING');
assert.equal(legacy.receipts[0].status, 'PENDING_POSTING');
assert.equal(legacy.custodies[0].status, 'CREATED');
assert.equal(legacy.contracts[0].status, 'CREATED');

assert.match(types, /JournalStatus = 'PENDING_POSTING' \| 'POSTED' \| 'VOIDED'/);
assert.match(types, /PaymentVoucherStatus = 'PENDING_POSTING' \| 'POSTED' \| 'VOIDED'/);
assert.match(types, /ReceiptVoucherStatus = 'PENDING_POSTING' \| 'POSTED' \| 'VOIDED'/);
assert.match(types, /CustodyStatus =[\s\S]*?'CREATED'[\s\S]*?'PENDING_APPROVAL'/);
assert.match(contractTypes, /ContractStatus = 'CREATED' \| 'UNDER_REVIEW'/);

assert.match(app, /handleDailyBatchPost[\s\S]*?status === 'PENDING_POSTING'/);
assert.match(app, /handleCloseYear[\s\S]*?status === 'PENDING_POSTING'/);
assert.match(app, /handleCloseMonth[\s\S]*?status === 'PENDING_POSTING'/);
assert.match(closing, /pendingRows[\s\S]*?status === 'PENDING_POSTING'/);

const sourceFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(full) : /\.(?:ts|tsx|mts|mjs)$/.test(entry.name) ? [full] : [];
});
const violations: string[] = [];
for (const file of [...sourceFiles(path.join(root, 'src')), ...sourceFiles(path.join(root, 'scripts'))]) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.includes('/components/modules/opening/') || normalized.endsWith('/OpeningBalancesView.tsx') || normalized.endsWith('/opening-header-theme-regression.mts')) continue;
  if (normalized.endsWith('/workflow-status-regression.mts')) continue;
  let source = fs.readFileSync(file, 'utf8');
  if (normalized.endsWith('/App.tsx')) source = source.split(/\r?\n/).filter(line => !/openingBalances|OpeningBalances|SaveDraft|الأرصدة الافتتاحية/.test(line)).join('\n');
  if (/\bDRAFT\b|مسود|\bDraft\b/.test(source)) violations.push(path.relative(root, file));
}
assert.deepEqual(violations, []);

console.log('WORKFLOW_STATUS_OK nonOpeningDraftModes=0 pendingPosting=true legacyMigration=true journal=true payment=true receipt=true contracts=true custody=true dailyPosting=true monthlyCloseGuard=true yearlyCloseGuard=true openingBalancesDraftPreserved=true');
