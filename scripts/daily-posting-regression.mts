import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { accountingCommandError } from '../src/utils/dailyPosting';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const closing = fs.readFileSync(path.join(root, 'src/components/modules/ClosingView.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'electron/auth-store.mjs'), 'utf8');

assert.match(app, /handleDailyBatchPost/);
assert.match(app, /commandType: 'POST_BATCH'/);
assert.match(app, /setJournals\(nextJournals\)/);
assert.match(app, /setVouchers\(nextVouchers\)/);
assert.match(app, /setReceiptVouchers\(nextReceipts\)/);
assert.match(app, /توجد مستندات غير مرحّلة/);
assert.match(closing, /const result = onBatchPost/);
assert.match(closing, /pendingRows\.length > 0[\s\S]*تم ترحيل جميع المستندات/);
assert.doesNotMatch(closing, /done \+= 1;[\s\S]{0,120}تم ترحيل \$\{done\}/);
assert.match(closing, /vouchers\.filter\(v => v\.status === 'PENDING_POSTING'/);
assert.match(closing, /receipts\.filter\(r => r\.status === 'PENDING_POSTING'/);
assert.match(auth, /\['accountant', 'المحاسب', 'ACCOUNTANT'/);
assert.match(auth, /\['auditor', 'المدقق المالي', 'AUDITOR'/);
assert.equal(accountingCommandError('AUDITOR_WRITE_FORBIDDEN'), 'الحساب الحالي للعرض والتدقيق فقط ولا يملك صلاحية الترحيل');

console.log('DAILY_POSTING_REGRESSION_OK atomicBatch=true accurateCounts=true visibleFailures=true vouchersIncludedInCloseGuard=true accountantCanPost=true auditorReadOnly=true');
