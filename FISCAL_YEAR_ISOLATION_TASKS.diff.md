diff --git a/FISCAL_YEAR_ISOLATION_TASKS.copy.md b/FISCAL_YEAR_ISOLATION_TASKS.copy.md
new file mode 100644
index 0000000..cc774a9
--- /dev/null
+++ b/FISCAL_YEAR_ISOLATION_TASKS.copy.md
@@ -0,0 +1,56 @@
+# Fiscal-year isolation implementation tasks
+
+## Phase 0 — Baseline and safety
+- [x] Capture the baseline commit and TypeScript build.
+- [x] Export an online SQLite backup and record SHA-256 plus `PRAGMA integrity_check`.
+- [x] Inventory legacy tables, scoped keys, and year evidence.
+
+## Phase 1 — Data model
+- [x] Add the fiscal-year registry and record/year ownership registry (schema v4).
+- [x] Store every annual collection in an isolated `::fiscal-year::YYYY` namespace and normalized fiscal-record projection.
+- [x] Keep settings, company identity, users, permissions, and UI preferences global.
+- [x] Scope record identity, document command identity, and uniqueness by year.
+- [x] Add `fiscalYear`, `entryKind`, `affectsLedger`, and `readOnly` to rollover audit journals.
+
+## Phase 2 — Repository isolation
+- [x] Bind all annual React persistence to the selected fiscal-year context.
+- [x] Bind SQLite read/write/projection to the same fiscal-year namespace.
+- [x] Enforce final-closed-year write rejection at the SQLite command boundary; allow an authorized reopen transition.
+- [x] Scope reports, searches, exports, attachments, audit logs, masters, operations, and opening-balance state.
+- [x] Discover all persisted fiscal years in the login/reporting selector.
+
+## Phase 3 — Atomic rollover
+- [x] Execute rollover under one `BEGIN IMMEDIATE` accounting command.
+- [x] Clone year-owned inputs/masters with new IDs.
+- [x] Remap internal parent, analytical, cost-center, account, entity, and journal relationships.
+- [x] Calculate closing/opening balances by account, analytical account, currency, and cost center.
+- [x] Insert destination opening balances exactly once.
+- [x] Insert `OPEN-YYYY` as a read-only audit journal with `affectsLedger=false`.
+- [x] Validate balance and target graph before `COMMIT`.
+- [x] Roll back every target write on conflict or broken relationship.
+- [x] Leave a new year without rollover empty and zeroed.
+
+## Phase 4 — Existing-data migration
+- [x] Detect the dominant source year without choosing a stray historical date or generated OPEN journal.
+- [x] Partition legacy source and already-created destination-year records into independent namespaces.
+- [x] Clone destination IDs and remap their relationships.
+- [x] Preserve original legacy keys and shared settings byte-for-byte.
+- [x] Verify the real database copy: source 2026 trial-balance numeric output is identical before/after migration.
+- [x] Validate every migrated year graph inside the migration transaction.
+
+## Phase 5 — Verification and release
+- [x] Test namespace isolation, ID independence, relationship remapping, and stale-write conflicts.
+- [x] Test analytical, multi-currency, and cost-center carry-forward.
+- [x] Test closed-year database rejection and reopen exception.
+- [x] Test conflict and invalid-graph rollback.
+- [x] Run the full P1 regression/build gate.
+- [x] Run targeted financial report, opening-balance, statement, balance-sheet, and login-year tests.
+- [x] Build fresh NSIS installer and portable executables.
+- [x] Run the packaged smoke probe against unpacked and portable editions.
+- [x] Verify artifact timestamps, sizes, SHA-256 hashes, and packed source hash.
+- [x] Test `ROLLBACK.sh` on a separate detached worktree and match the exact baseline tree.
+
+## Final state
+- Source/base commit: `a6fff06e5562a51d7622c9d6662ec3f4a2f8e529`.
+- Product-code commit packed in release: `52b6e2cb48e67e717e8ad9dd5db267bba46a1928`.
+- Release folder: `D:\Dev env\@commando\FULLERP\release-20260913-154919-fiscal-year-isolation-52b6e2cb`.
diff --git a/FISCAL_YEAR_ISOLATION_TASKS.md b/FISCAL_YEAR_ISOLATION_TASKS.md
new file mode 100644
index 0000000..cc774a9
--- /dev/null
+++ b/FISCAL_YEAR_ISOLATION_TASKS.md
@@ -0,0 +1,56 @@
+# Fiscal-year isolation implementation tasks
+
+## Phase 0 — Baseline and safety
+- [x] Capture the baseline commit and TypeScript build.
+- [x] Export an online SQLite backup and record SHA-256 plus `PRAGMA integrity_check`.
+- [x] Inventory legacy tables, scoped keys, and year evidence.
+
+## Phase 1 — Data model
+- [x] Add the fiscal-year registry and record/year ownership registry (schema v4).
+- [x] Store every annual collection in an isolated `::fiscal-year::YYYY` namespace and normalized fiscal-record projection.
+- [x] Keep settings, company identity, users, permissions, and UI preferences global.
+- [x] Scope record identity, document command identity, and uniqueness by year.
+- [x] Add `fiscalYear`, `entryKind`, `affectsLedger`, and `readOnly` to rollover audit journals.
+
+## Phase 2 — Repository isolation
+- [x] Bind all annual React persistence to the selected fiscal-year context.
+- [x] Bind SQLite read/write/projection to the same fiscal-year namespace.
+- [x] Enforce final-closed-year write rejection at the SQLite command boundary; allow an authorized reopen transition.
+- [x] Scope reports, searches, exports, attachments, audit logs, masters, operations, and opening-balance state.
+- [x] Discover all persisted fiscal years in the login/reporting selector.
+
+## Phase 3 — Atomic rollover
+- [x] Execute rollover under one `BEGIN IMMEDIATE` accounting command.
+- [x] Clone year-owned inputs/masters with new IDs.
+- [x] Remap internal parent, analytical, cost-center, account, entity, and journal relationships.
+- [x] Calculate closing/opening balances by account, analytical account, currency, and cost center.
+- [x] Insert destination opening balances exactly once.
+- [x] Insert `OPEN-YYYY` as a read-only audit journal with `affectsLedger=false`.
+- [x] Validate balance and target graph before `COMMIT`.
+- [x] Roll back every target write on conflict or broken relationship.
+- [x] Leave a new year without rollover empty and zeroed.
+
+## Phase 4 — Existing-data migration
+- [x] Detect the dominant source year without choosing a stray historical date or generated OPEN journal.
+- [x] Partition legacy source and already-created destination-year records into independent namespaces.
+- [x] Clone destination IDs and remap their relationships.
+- [x] Preserve original legacy keys and shared settings byte-for-byte.
+- [x] Verify the real database copy: source 2026 trial-balance numeric output is identical before/after migration.
+- [x] Validate every migrated year graph inside the migration transaction.
+
+## Phase 5 — Verification and release
+- [x] Test namespace isolation, ID independence, relationship remapping, and stale-write conflicts.
+- [x] Test analytical, multi-currency, and cost-center carry-forward.
+- [x] Test closed-year database rejection and reopen exception.
+- [x] Test conflict and invalid-graph rollback.
+- [x] Run the full P1 regression/build gate.
+- [x] Run targeted financial report, opening-balance, statement, balance-sheet, and login-year tests.
+- [x] Build fresh NSIS installer and portable executables.
+- [x] Run the packaged smoke probe against unpacked and portable editions.
+- [x] Verify artifact timestamps, sizes, SHA-256 hashes, and packed source hash.
+- [x] Test `ROLLBACK.sh` on a separate detached worktree and match the exact baseline tree.
+
+## Final state
+- Source/base commit: `a6fff06e5562a51d7622c9d6662ec3f4a2f8e529`.
+- Product-code commit packed in release: `52b6e2cb48e67e717e8ad9dd5db267bba46a1928`.
+- Release folder: `D:\Dev env\@commando\FULLERP\release-20260913-154919-fiscal-year-isolation-52b6e2cb`.
diff --git a/ROLLBACK.sh b/ROLLBACK.sh
new file mode 100755
index 0000000..f7901d9
--- /dev/null
+++ b/ROLLBACK.sh
@@ -0,0 +1,15 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+BASE_COMMIT="${1:-a6fff06e5562a51d7622c9d6662ec3f4a2f8e529}"
+git rev-parse --verify "${BASE_COMMIT}^{commit}" >/dev/null
+test -z "$(git status --porcelain)" || { echo "ROLLBACK_ABORTED dirty_worktree=true"; exit 2; }
+
+for commit in $(git rev-list "${BASE_COMMIT}..HEAD"); do
+  git revert --no-edit "$commit"
+done
+
+BASE_TREE="$(git rev-parse "${BASE_COMMIT}^{tree}")"
+RESTORED_TREE="$(git rev-parse 'HEAD^{tree}')"
+test "$BASE_TREE" = "$RESTORED_TREE"
+echo "ROLLBACK_OK base=${BASE_COMMIT} restored_tree=${RESTORED_TREE}"
diff --git a/VERIFICATION.txt b/VERIFICATION.txt
new file mode 100644
index 0000000..9b72a21
--- /dev/null
+++ b/VERIFICATION.txt
@@ -0,0 +1,87 @@
+FISCAL-YEAR ISOLATION VERIFICATION
+
+Branch: main
+Baseline commit: a6fff06e5562a51d7622c9d6662ec3f4a2f8e529
+Product-code commit packed in release: 52b6e2cb48e67e717e8ad9dd5db267bba46a1928
+Verification/rollback commit: ca13b7bf17de4109088a27e479b626637a44a654
+Changed branches/fields: storage key suffix ::fiscal-year::YYYY; erp_fiscal_years; erp_record_years; erp_fiscal_records; fiscalYear; entryKind=OPENING_AUDIT; affectsLedger=false; readOnly=true; OpeningBalanceRecord.costCenterId.
+Restored behavior/status: every year reads and writes an independent dataset; shared settings remain global; a final-closed year is read-only; rollover IDs and relationships are independent; OPEN-YYYY is visible only as a read-only audit record and is excluded from balances; target openings are counted once.
+
+FOUR REQUIRED ARTIFACTS
+MODIFIED_FILE: D:\Dev env\@commando\FULLERP\artifacts\fiscal-year-isolation\migration-verified-FULLERP-20260913.sqlite
+DIFF_FILE: D:\Dev env\@commando\FULLERP\FISCAL_YEAR_ISOLATION_TASKS.diff.md
+VERIFICATION: D:\Dev env\@commando\FULLERP\VERIFICATION.txt
+ROLLBACK: D:\Dev env\@commando\FULLERP\ROLLBACK.sh (git mode 100755)
+PRESERVED_BASELINE: D:\Dev env\@commando\FULLERP\artifacts\fiscal-year-isolation\baseline-FULLERP-20260913.sqlite
+PRESERVED_BASELINE_SHA256: 6ED9A480B895940630736539A793F9285E276C8E8CF1E84A2429F4DB2881CBFE
+MODIFIED_FILE_SHA256: 5C198ECC4239AC68FDA020A966718C73088229BFFED62B272D4BEFE599D62F0E
+
+BASELINE
+Command: python SQLite online-backup fixture creation followed by PRAGMA integrity_check
+Input: C:\Users\ahmed\AppData\Roaming\FULLERP\FULLERP.sqlite
+Literal output/result: SQLITE_BACKUP_OK integrity=ok
+Exit status: 0
+
+Command: npm run lint
+Input: baseline worktree at a6fff06e5562a51d7622c9d6662ec3f4a2f8e529
+Literal output/result: > fullerp-desktop@1.0.0 lint / > tsc --noEmit
+Exit status: 0
+
+MODIFIED
+Command: npx tsx scripts/verify-fiscal-migration-database.mts "artifacts\fiscal-year-isolation\baseline-FULLERP-20260913.sqlite" "artifacts\fiscal-year-isolation\migration-verified-FULLERP-20260913.sqlite"
+Input: preserved 11,452,416-byte database copy; legacy records for 2022, 2026, and 2027
+Literal output/result: FISCAL_MIGRATION_DATABASE_OK year=2026 years=2022,2026,2027 rows=7 debit=11646885.11 credit=11646885.11 sourceUnchanged=true settingsGlobal=true targetIndependent=true auditReadOnly=true integrity=ok output=artifacts\fiscal-year-isolation\migration-verified-FULLERP-20260913.sqlite
+Exit status: 0
+
+Command: npm run fiscal-year:regression
+Input: isolated 2026/2027 fixture, conflict fixture, broken-graph fixture, closed-year fixture, USD analytical/cost-center fixture
+Literal output/result: FISCAL_YEAR_ATOMIC_ROLLOVER_OK sourceUnchanged=true targetIndependent=true linksRemapped=true conflictRollback=true brokenGraphRollback=true closedWriteBlocked=true reopenAllowed=true
+Literal output/result: FISCAL_YEAR_REPORT_ISOLATION_OK sourceUnchanged=true openingOnce=true auditExcluded=true auditReadOnly=true
+Literal output/result: FISCAL_YEAR_CLOSING_OK analytical=true currencies=USD foreign=15 local=56.25 costCenter=true balanced=true
+Exit status: 0
+
+Command: npm run p1:verify
+Input: current full source tree and all P1 accounting, persistence, lifecycle, security, reports, printing, and production-build fixtures
+Literal output/result: ACCOUNTING_COMMAND_REGRESSION_OK accountProjectionRepaired=true atomic=true idempotentReplay=true duplicateDocumentBlocked=true optimisticConflictBlocked=true staleWindowWriteBlocked=true failedCommandRolledBack=true receiptDurable=true integrity=ok
+Literal output/result: RELATIONAL_SQLITE_SMOKE_OK accounts=2 journals=1/2 payments=1/1 receipts=1/1 masters=1 fiscalYears=2 scopedIsolation=true mappedJournalYear=fy-2026 authority=normalized authoritativeDebit=321 diagnostics=true fkReferenceBlocked=true referencedDeleteBlocked=true duplicateEntityBlocked=true duplicateJournalLinesRepaired=true updateDebit=125 deleteCascade=0 integrity=ok
+Literal output/result: ✓ built in 2m 33s
+Exit status: 0
+
+Command: npm run reports-ui:regression
+Input: financial report implementation including pending vouchers and affectsLedger/OPENING_AUDIT filtering
+Literal output/result: FINANCIAL_REPORTS_BACKGROUND_OK inheritedShell=true standaloneBackground=false matchesOtherModules=true entitySections=true currencySections=true combinedPrintJob=true summarySuppressesDetails=true pendingVouchersVisible=true analyticalProjection=true
+Exit status: 0
+
+PACKAGED RELEASE
+Command: npx electron-builder --win nsis portable --config.directories.output=release-20260913-154919-fiscal-year-isolation-52b6e2cb
+Input: production dist plus Electron sources at product-code commit 52b6e2cb48e67e717e8ad9dd5db267bba46a1928
+Literal output/result: target=nsis file=release-20260913-154919-fiscal-year-isolation-52b6e2cb\NOON-ERP-Setup-1.0.0-x64.exe
+Literal output/result: target=portable file=release-20260913-154919-fiscal-year-isolation-52b6e2cb\NOON-ERP-Portable-1.0.0-x64.exe
+Exit status: 0
+
+Installer: D:\Dev env\@commando\FULLERP\release-20260913-154919-fiscal-year-isolation-52b6e2cb\NOON-ERP-Setup-1.0.0-x64.exe
+Installer bytes: 112254780
+Installer SHA256: B182E02DD7F8147AE606E4728CC0648D1A36C24CB309C9DAE20983F20BD4126E
+Portable: D:\Dev env\@commando\FULLERP\release-20260913-154919-fiscal-year-isolation-52b6e2cb\NOON-ERP-Portable-1.0.0-x64.exe
+Portable bytes: 112063564
+Portable SHA256: 0D1F735FD07A4A06B48DB533446C5EDA2E97CA4A803B5D3F711B804F4A65733F
+Freshness result: NEW_TIME=2026-09-13T15:50:15.4635824+03:00; LATEST_PREVIOUS_TIME=2026-09-13T15:46:25.8722970+03:00; NEWER=True
+Packed source result: electron/main.mjs PACKED_MATCH=True; legacy-fiscal-migration.mjs PACKED_MATCH=True; accounting-command-store.mjs PACKED_MATCH=True
+
+Command: packaged smoke (win-unpacked) with FULLERP_SMOKE_TEST=1 and isolated --user-data-dir
+Input: D:\Dev env\@commando\FULLERP\release-20260913-154919-fiscal-year-isolation-52b6e2cb\win-unpacked\NOON ERP.exe
+Literal output/result: "ok": true; "brand": true; "loginForm": true; "fiscalYearSelector": true; "loginOk": true; "sqlite": true; "authority": "RELATIONAL_SQLITE"
+Exit status: 0
+
+Command: packaged smoke (portable) with FULLERP_SMOKE_TEST=1 and isolated --user-data-dir
+Input: D:\Dev env\@commando\FULLERP\release-20260913-154919-fiscal-year-isolation-52b6e2cb\NOON-ERP-Portable-1.0.0-x64.exe
+Literal output/result: "ok": true; "brand": true; "loginForm": true; "fiscalYearSelector": true; "loginOk": true; "sqlite": true; "authority": "RELATIONAL_SQLITE"
+Exit status: 0
+
+ROLLBACK
+Command: "C:\Program Files\Git\bin\bash.exe" ./ROLLBACK.sh
+Input: separate detached worktree at ca13b7bf17de4109088a27e479b626637a44a654; baseline a6fff06e5562a51d7622c9d6662ec3f4a2f8e529
+Literal output/result: ROLLBACK_OK base=a6fff06e5562a51d7622c9d6662ec3f4a2f8e529 restored_tree=d44062f47daaba3f6a5bd98e3e524b15e60084b0
+Literal output/result: ROLLBACK_TREE_MATCH=True
+Exit status: 0
+Restored behavior/status: the separate copy exactly matched the baseline commit tree; the primary worktree and MODIFIED_FILE remained changed.
diff --git a/electron/accounting-command-store.mjs b/electron/accounting-command-store.mjs
index 52ee307..838af43 100644
--- a/electron/accounting-command-store.mjs
+++ b/electron/accounting-command-store.mjs
@@ -1,6 +1,10 @@
 const ERP_PREFIX = 'elite-erp-';
 const ACCOUNT_COLLECTION_KEY = 'elite-erp-accounts-v9';
 const JOURNAL_COLLECTION_KEY = 'elite-erp-journals-v6';
+const PERIOD_STATES_KEY = 'elite-erp-period-states-v1';
+const CLOSED_YEARS_KEY = 'elite-erp-closed-years-v1';
+const AUDIT_LOGS_KEY = 'elite-erp-auditlogs-v6';
+const SCOPED_KEY = /^(.*)::fiscal-year::(\d{4})$/;
 
 export function createAccountingCommandStore(db, relationalStore) {
   db.exec(`
@@ -31,6 +35,24 @@ export function createAccountingCommandStore(db, relationalStore) {
   const versionOf = key => Number(readVersion.get(String(key))?.version || 0);
   const bumpVersion = key => Number(bump.get(String(key))?.version || 0);
 
+  const scopedParts = key => String(key || '').match(SCOPED_KEY);
+  const isFiscalYearClosed = year => {
+    try {
+      const periodRaw = db.prepare('SELECT value FROM kv_store WHERE key=?').get(`${PERIOD_STATES_KEY}::fiscal-year::${year}`)?.value;
+      const periods = periodRaw ? JSON.parse(periodRaw) : [];
+      if (Array.isArray(periods) && periods.some(item => item?.scope === 'YEAR' && String(item?.key) === year && item?.status === 'FINAL_CLOSED')) return true;
+      const closedRaw = db.prepare('SELECT value FROM kv_store WHERE key=?').get(`${CLOSED_YEARS_KEY}::fiscal-year::${year}`)?.value;
+      const closedYears = closedRaw ? JSON.parse(closedRaw) : [];
+      return Array.isArray(closedYears) && closedYears.map(String).includes(year);
+    } catch { return true; }
+  };
+  const isClosedYearWriteAllowed = (key, commandType = '') => {
+    const matched = scopedParts(key);
+    if (!matched || !isFiscalYearClosed(matched[2])) return true;
+    if (commandType === 'PERIOD_OPEN' || commandType === 'FISCAL_YEAR_CLONE') return true;
+    return [PERIOD_STATES_KEY, CLOSED_YEARS_KEY, AUDIT_LOGS_KEY].includes(matched[1]);
+  };
+
   function execute(payload = {}) {
     const idempotencyKey = String(payload.idempotencyKey || '').trim();
     const commandType = String(payload.commandType || '').trim();
@@ -81,6 +103,11 @@ export function createAccountingCommandStore(db, relationalStore) {
         deleteReceipt.run(existingDocument.idempotency_key);
       }
       const expected = payload.expectedVersions && typeof payload.expectedVersions === 'object' ? payload.expectedVersions : {};
+      const blocked = changes.find(change => !isClosedYearWriteAllowed(String(change.key), commandType));
+      if (blocked) {
+        db.exec('ROLLBACK');
+        return { ok: false, closed: true, key: String(blocked.key), error: 'FISCAL_YEAR_CLOSED' };
+      }
       for (const change of changes) {
         const key = String(change.key);
         if (Object.prototype.hasOwnProperty.call(expected, key) && Number(expected[key]) !== versionOf(key)) {
@@ -110,6 +137,12 @@ export function createAccountingCommandStore(db, relationalStore) {
         relationalStore.syncCollection(key, change.value);
         versions[key] = bumpVersion(key);
       }
+      if (commandType === 'FISCAL_YEAR_CLONE') {
+        const targetYear = documentNumber.match(/->(\d{4})$/)?.[1];
+        if (!targetYear) throw new Error('FISCAL_YEAR_CLONE_TARGET_MISSING');
+        const validation = relationalStore.validateFiscalYearDataset(targetYear);
+        if (!validation.ok) throw new Error(`FISCAL_YEAR_GRAPH_INVALID:${JSON.stringify(validation.broken.slice(0, 20))}`);
+      }
       const result = { ok: true, replay: false, idempotencyKey, commandType, documentType, documentNumber, versions };
       insertReceipt.run(idempotencyKey, commandType, documentType, documentNumber, JSON.stringify(result));
       db.exec('COMMIT');
@@ -127,6 +160,10 @@ export function createAccountingCommandStore(db, relationalStore) {
     if (!key.startsWith(ERP_PREFIX) || typeof value !== 'string') return { ok: false, error: 'A serialized ERP state value is required.' };
     try {
       db.exec('BEGIN IMMEDIATE');
+      if (!isClosedYearWriteAllowed(key)) {
+        db.exec('ROLLBACK');
+        return { ok: false, closed: true, actualVersion: versionOf(key), error: 'FISCAL_YEAR_CLOSED' };
+      }
       const actual = versionOf(key);
       if (actual !== expected) {
         db.exec('ROLLBACK');
diff --git a/electron/fiscal-year-context.mjs b/electron/fiscal-year-context.mjs
new file mode 100644
index 0000000..fe1550e
--- /dev/null
+++ b/electron/fiscal-year-context.mjs
@@ -0,0 +1,31 @@
+/** Shared fiscal-year primitives used by the relational repository and rollover service. */
+export function normalizeFiscalYear(value) {
+  const year = String(value ?? '').trim();
+  if (!/^\d{4}$/.test(year)) throw new Error(`INVALID_FISCAL_YEAR:${year}`);
+  return year;
+}
+
+export function fiscalYearId(value) {
+  return `fy-${normalizeFiscalYear(value)}`;
+}
+
+export function recordFiscalYear(record) {
+  const explicit = record?.fiscalYear ?? record?.fiscal_year;
+  if (explicit && /^\d{4}$/.test(String(explicit))) return normalizeFiscalYear(explicit);
+  const date = record?.date ?? record?.voucherDate ?? record?.receiptDate ?? record?.createdAt;
+  const match = String(date ?? '').match(/^(\d{4})-/);
+  return match ? match[1] : null;
+}
+
+/** Execute a rollover unit atomically and restore the transaction state on error. */
+export function runAtomic(db, callback) {
+  db.exec('BEGIN IMMEDIATE');
+  try {
+    const result = callback();
+    db.exec('COMMIT');
+    return result;
+  } catch (error) {
+    try { db.exec('ROLLBACK'); } catch {}
+    throw error;
+  }
+}
diff --git a/electron/fiscal-year-rollover.mjs b/electron/fiscal-year-rollover.mjs
new file mode 100644
index 0000000..23b2277
--- /dev/null
+++ b/electron/fiscal-year-rollover.mjs
@@ -0,0 +1,58 @@
+import { normalizeFiscalYear } from './fiscal-year-context.mjs';
+
+const DEFAULT_COLLECTIONS = ['accounts','costCenters','cashBoxes','bankAccounts','employees','customers','vendors','journals','paymentVouchers','receiptVouchers','trusts','custodies','auditLogs'];
+const RELATION_KEYS = new Set(['parentId','linkedAccountId','sourceAccountId','sourceEntityId','journalEntryId','reversalJournalEntryId','reversalByEntryId','costCenterId','subLedgerId','accountId','employeeId','customerId','vendorId','cashBoxId','bankAccountId','custodyId','trustId','openingEntryId']);
+
+const cloneValue = (value, idMap, sourceYear, targetYear, key = '') => {
+  if (Array.isArray(value)) return value.map(item => cloneValue(item, idMap, sourceYear, targetYear, key));
+  if (!value || typeof value !== 'object') {
+    if ((key === 'id' || RELATION_KEYS.has(key)) && typeof value === 'string' && idMap.has(value)) return idMap.get(value);
+    if ((key === 'fiscalYear' || key === 'fiscal_year') && String(value) === sourceYear) return targetYear;
+    if ((key === 'date' || key === 'voucherDate' || key === 'receiptDate') && typeof value === 'string') return value.replace(new RegExp(`^${sourceYear}(?=-)`), targetYear);
+    return value;
+  }
+  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, cloneValue(childValue, idMap, sourceYear, targetYear, childKey)]));
+};
+
+/** Clone an isolated fiscal-year graph. The returned graph contains no source IDs. */
+export function cloneYearDataset(dataset, sourceYearInput, targetYearInput, collections = DEFAULT_COLLECTIONS) {
+  const sourceYear = normalizeFiscalYear(sourceYearInput);
+  const targetYear = normalizeFiscalYear(targetYearInput);
+  if (sourceYear === targetYear) throw new Error('ROLLOVER_SOURCE_EQUALS_TARGET');
+  const source = dataset || {};
+  const selected = collections.filter(name => Array.isArray(source[name]));
+  const idMap = new Map();
+  const collectIds = (value, name, counter = { value: 0 }) => {
+    if (Array.isArray(value)) { value.forEach(item => collectIds(item, name, counter)); return; }
+    if (!value || typeof value !== 'object') return;
+    if (value.id != null) {
+      counter.value += 1;
+      idMap.set(String(value.id), `${targetYear}-${name}-${counter.value}-${String(value.id)}`);
+    }
+    Object.values(value).forEach(child => collectIds(child, name, counter));
+  };
+  selected.forEach(name => collectIds(source[name], name));
+  const result = {};
+  selected.forEach(name => {
+    result[name] = source[name].map(record => {
+      const cloned = cloneValue(record, idMap, sourceYear, targetYear);
+      if (cloned && typeof cloned === 'object') {
+        if (record.id != null) cloned.id = idMap.get(String(record.id));
+        cloned.fiscalYear = targetYear;
+        if (cloned.createdAt && typeof cloned.createdAt === 'string') cloned.createdAt = cloned.createdAt.replace(new RegExp(`^${sourceYear}(?=-)`), targetYear);
+      }
+      return cloned;
+    });
+  });
+  return { sourceYear, targetYear, idMap, collections: result };
+}
+
+export function validateClonedYearGraph(original, cloned) {
+  const sourceIds = new Set(Object.values(original || {}).flatMap(rows => Array.isArray(rows) ? rows.map(row => String(row?.id ?? '')) : []));
+  const clonedRows = Object.values(cloned?.collections || {}).flatMap(rows => rows || []);
+  const clonedIds = clonedRows.map(row => String(row?.id ?? ''));
+  if (clonedIds.some(id => sourceIds.has(id))) return { ok: false, error: 'SOURCE_ID_REUSED' };
+  if (new Set(clonedIds).size !== clonedIds.length) return { ok: false, error: 'CLONED_ID_COLLISION' };
+  if (clonedRows.some(row => row?.fiscalYear !== cloned.targetYear)) return { ok: false, error: 'TARGET_YEAR_MISSING' };
+  return { ok: true, count: clonedRows.length };
+}
diff --git a/electron/legacy-fiscal-migration.mjs b/electron/legacy-fiscal-migration.mjs
new file mode 100644
index 0000000..b6487ed
--- /dev/null
+++ b/electron/legacy-fiscal-migration.mjs
@@ -0,0 +1,129 @@
+import { cloneYearDataset } from './fiscal-year-rollover.mjs';
+
+const JOURNALS = 'elite-erp-journals-v6';
+const PERIOD_STATES = 'elite-erp-period-states-v1';
+const CLOSED_YEARS = 'elite-erp-closed-years-v1';
+export const YEAR_OWNED_KEYS = [
+  'elite-erp-accounts-v9','elite-erp-costcenters-v6','elite-erp-journals-v6','elite-erp-auditlogs-v6',
+  'elite-erp-trusts-v1','elite-erp-custodies-v1','elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1',
+  'elite-erp-vouchers-v1','elite-erp-receiptvouchers-v1','elite-erp-employees-v1','elite-erp-customers-v1',
+  'elite-erp-vendors-v1','elite-erp-currencies-v1','elite-erp-closed-years-v1','elite-erp-closed-months-v1',
+  'elite-erp-opening-balances-status-v1','elite-erp-opening-balance-attachments-v1','elite-erp-period-states-v1',
+];
+const DATE_KEYS = new Set(['elite-erp-journals-v6','elite-erp-auditlogs-v6','elite-erp-trusts-v1','elite-erp-custodies-v1','elite-erp-vouchers-v1','elite-erp-receiptvouchers-v1']);
+const MASTER_KEYS = new Set(['elite-erp-accounts-v9','elite-erp-costcenters-v6','elite-erp-cashboxes-v1','elite-erp-bankaccounts-v1','elite-erp-employees-v1','elite-erp-customers-v1','elite-erp-vendors-v1','elite-erp-currencies-v1']);
+const COLLECTION_NAMES = Object.fromEntries(YEAR_OWNED_KEYS.map((key, index) => [key, `collection${index}`]));
+
+const parse = (raw, fallback = []) => { try { return JSON.parse(raw ?? JSON.stringify(fallback)); } catch { return fallback; } };
+const yearOf = record => {
+  const explicit = record?.fiscalYear ?? record?.fiscal_year;
+  if (/^\d{4}$/.test(String(explicit || ''))) return String(explicit);
+  const value = record?.date ?? record?.voucherDate ?? record?.receiptDate ?? record?.requestedDate ?? record?.timestamp ?? record?.createdAt;
+  return String(value || '').match(/^(\d{4})-/)?.[1] ?? null;
+};
+
+/** Select the dominant operating year, ignoring generated OPEN journals and isolated outlier dates. */
+export function inferLegacyFiscalYear(rawJournals, fallback = '2026', rawPeriodStates = '[]') {
+  const counts = new Map();
+  const journals = parse(rawJournals);
+  if (Array.isArray(journals)) journals.forEach(row => {
+    if (/^OPEN-\d{4}$/.test(String(row?.reference || row?.entryNumber || ''))) return;
+    const year = yearOf(row);
+    if (year) counts.set(year, (counts.get(year) || 0) + 1);
+  });
+  if (counts.size) {
+    const ranked = [...counts].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
+    const tied = ranked.filter(([, count]) => count === ranked[0][1]).map(([year]) => year);
+    return tied.includes(fallback) ? fallback : ranked[0][0];
+  }
+  const periods = parse(rawPeriodStates);
+  const years = Array.isArray(periods) ? periods.filter(item => item?.scope === 'YEAR' && /^\d{4}$/.test(String(item?.key || ''))).map(item => String(item.key)).sort() : [];
+  return years.at(-1) || fallback;
+}
+
+const openingRowsForYear = (record, year, sourceYear) => {
+  if (!Array.isArray(record?.openingBalances)) return record;
+  const rows = record.openingBalances
+    .filter(item => String(item?.fiscalYear || sourceYear) === year)
+    .map(item => ({ ...item, fiscalYear: year }));
+  const openingBalance = rows.length
+    ? rows.reduce((sum, item) => sum + Number(item?.debitLocal || 0) - Number(item?.creditLocal || 0), 0)
+    : 0;
+  return { ...record, openingBalances: rows, openingBalance };
+};
+
+function valueForYear(key, value, year, sourceYear) {
+  if (key === CLOSED_YEARS) return Array.isArray(value) ? value.filter(item => String(item) === year) : [];
+  if (key === 'elite-erp-closed-months-v1') return Array.isArray(value) ? value.filter(item => String(item).startsWith(`${year}-`)) : [];
+  if (key === PERIOD_STATES) return Array.isArray(value) ? value.filter(item => String(item?.key || '').startsWith(year)) : [];
+  if (key === 'elite-erp-opening-balances-status-v1') return year === sourceYear ? value : 'NONE';
+  if (!Array.isArray(value)) return value;
+  if (DATE_KEYS.has(key)) return value.filter(item => yearOf(item) === year).map(item => {
+    const stamped = item && typeof item === 'object' ? { ...item, fiscalYear: year } : item;
+    if (key === JOURNALS && /^OPEN-\d{4}$/.test(String(stamped?.reference || stamped?.entryNumber || ''))) {
+      return { ...stamped, entryKind: 'OPENING_AUDIT', affectsLedger: false, readOnly: true };
+    }
+    return stamped;
+  });
+  if (MASTER_KEYS.has(key)) return value.map(item => ({ ...openingRowsForYear(item, year, sourceYear), fiscalYear: year }));
+  return value
+    .filter(item => !item || typeof item !== 'object' || String(item.fiscalYear || sourceYear) === year)
+    .map(item => item && typeof item === 'object' ? { ...item, fiscalYear: year } : item);
+}
+
+function detectedYears(values, sourceYear) {
+  const years = new Set([sourceYear]);
+  for (const [key, value] of Object.entries(values)) {
+    if (Array.isArray(value)) value.forEach(item => {
+      const direct = key === CLOSED_YEARS
+        ? String(item)
+        : key === PERIOD_STATES
+          ? String(item?.key || '').slice(0, 4)
+          : DATE_KEYS.has(key) ? yearOf(item) : null;
+      if (/^\d{4}$/.test(direct || '')) years.add(direct);
+      if (MASTER_KEYS.has(key) && Array.isArray(item?.openingBalances)) item.openingBalances.forEach(opening => {
+        if (/^\d{4}$/.test(String(opening?.fiscalYear || ''))) years.add(String(opening.fiscalYear));
+      });
+    });
+  }
+  return [...years].sort();
+}
+
+/** Atomic import into independent year namespaces. Global settings and legacy keys remain byte-identical. */
+export function migrateLegacyFiscalDataset(db, relationalStore, fallbackYear = '2026') {
+  const marker = db.prepare("SELECT value FROM app_metadata WHERE key='fiscal_isolation_migrated_v1'").get()?.value;
+  if (marker) return { migrated: false, year: marker, years: [marker], keys: 0 };
+  const read = db.prepare('SELECT value FROM kv_store WHERE key=?');
+  const write = db.prepare(`INSERT INTO kv_store(key,value,entity_type,updated_at) VALUES(?,?,'erp_state',datetime('now')) ON CONFLICT(key) DO NOTHING`);
+  const bump = db.prepare(`INSERT INTO kv_versions(key,version,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET version=version+1,updated_at=datetime('now')`);
+  const rawValues = Object.fromEntries(YEAR_OWNED_KEYS.map(key => [key, read.get(key)?.value]).filter(([, raw]) => raw != null));
+  const values = Object.fromEntries(Object.entries(rawValues).map(([key, raw]) => [key, parse(raw, raw)]));
+  const sourceYear = inferLegacyFiscalYear(rawValues[JOURNALS], fallbackYear, rawValues[PERIOD_STATES]);
+  const years = detectedYears(values, sourceYear);
+  let keys = 0;
+  db.exec('BEGIN IMMEDIATE');
+  try {
+    for (const year of years) {
+      const yearValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [COLLECTION_NAMES[key], valueForYear(key, value, year, sourceYear)]));
+      const cloned = year === sourceYear ? null : cloneYearDataset(yearValues, sourceYear, year, Object.keys(yearValues));
+      const finalValues = cloned ? { ...yearValues, ...cloned.collections } : yearValues;
+      for (const baseKey of Object.keys(values)) {
+        const scopedKey = `${baseKey}::fiscal-year::${year}`;
+        const serialized = JSON.stringify(finalValues[COLLECTION_NAMES[baseKey]]);
+        if (write.run(scopedKey, serialized).changes) {
+          relationalStore.syncCollection(scopedKey, serialized);
+          bump.run(scopedKey);
+          keys += 1;
+        }
+      }
+      const validation = relationalStore.validateFiscalYearDataset(year);
+      if (!validation.ok) throw new Error(`FISCAL_YEAR_MIGRATION_GRAPH_INVALID:${year}:${JSON.stringify(validation.broken.slice(0, 20))}`);
+    }
+    db.prepare("INSERT INTO app_metadata(key,value) VALUES('fiscal_isolation_migrated_v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(sourceYear);
+    db.exec('COMMIT');
+    return { migrated: true, year: sourceYear, years, keys };
+  } catch (error) {
+    try { db.exec('ROLLBACK'); } catch {}
+    throw error;
+  }
+}
diff --git a/electron/main.mjs b/electron/main.mjs
index ad7501f..a7fe002 100644
--- a/electron/main.mjs
+++ b/electron/main.mjs
@@ -9,6 +9,7 @@ import { createAccountingCommandStore } from './accounting-command-store.mjs';
 import { assertSupportedDataPath, createVerifiedBackup, createVerifiedBackupAt, listVerifiedBackups, restoreLatestVerifiedBackup, restoreVerifiedBackup, verifyDatabaseFile, verifyFullerpBackupFile } from './database-recovery.mjs';
 import { createAuthStore } from './auth-store.mjs';
 import { bindConfiguredUiScale, normalizeUiScalePercent, uiScaleToZoomFactor } from './ui-scale.mjs';
+import { migrateLegacyFiscalDataset } from './legacy-fiscal-migration.mjs';
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url));
 let db;
@@ -112,12 +113,13 @@ function openDatabase() {
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     CREATE INDEX IF NOT EXISTS idx_kv_store_entity_type ON kv_store(entity_type);
-    INSERT INTO app_metadata(key, value) VALUES ('schema_version', '2')
+    INSERT INTO app_metadata(key, value) VALUES ('schema_version', '4')
       ON CONFLICT(key) DO UPDATE SET value=excluded.value;
   `);
   relationalStore = createRelationalStore(db);
   relationalStore.ensureSchema();
   accountingCommandStore = createAccountingCommandStore(db, relationalStore);
+  migrateLegacyFiscalDataset(db, relationalStore, String(Math.max(2026, new Date().getFullYear())));
   authStore = createAuthStore(db);
   try {
     const rawSettings = db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-settings-v6'").get()?.value;
@@ -215,7 +217,7 @@ function registerStorageIpc() {
     }
   });
   ipcMain.on('desktop-store:info', event => {
-    event.returnValue = { databasePath, engine: 'SQLite', schemaVersion: 3, entries: entries.all().length, relational: relationalStore.info(), diagnostics: relationalStore.diagnostics(), authority: 'RELATIONAL_SQLITE', recovery: { dataPathPolicy: 'LOCAL_DISK_ONLY', backupRoot, verifiedBackups: listVerifiedBackups(backupRoot).length, lastBackup, startupRecovery } };
+    event.returnValue = { databasePath, engine: 'SQLite', schemaVersion: 4, entries: entries.all().length, relational: relationalStore.info(), diagnostics: relationalStore.diagnostics(), authority: 'RELATIONAL_SQLITE', recovery: { dataPathPolicy: 'LOCAL_DISK_ONLY', backupRoot, verifiedBackups: listVerifiedBackups(backupRoot).length, lastBackup, startupRecovery } };
   });
   ipcMain.on('desktop-store:create-backup', event => {
     try { event.returnValue = { ok: true, ...createInternalBackup('manual-safety') }; }
@@ -459,9 +461,17 @@ function runPackagedSmoke(window) {
   });
   window.webContents.once('did-finish-load', async () => {
     try {
-      // did-finish-load can precede React's first committed frame in a packaged
-      // renderer; wait briefly so the smoke probe validates the real login UI.
-      await new Promise(resolve => setTimeout(resolve, 1000));
+      // The portable launcher extracts the application on every run and its
+      // first React commit can be delayed by antivirus scanning. Poll the real
+      // rendered login screen instead of sampling a transient empty body.
+      for (let attempt = 0; attempt < 30; attempt += 1) {
+        const ready = await window.webContents.executeJavaScript(`(() => {
+          const text = document.body?.innerText || '';
+          return text.includes('NOON ERP') && text.includes('تسجيل الدخول') && text.includes('العام الافتراضي');
+        })()`);
+        if (ready) break;
+        await new Promise(resolve => setTimeout(resolve, 500));
+      }
       const renderer = await window.webContents.executeJavaScript(`(() => {
         const text = document.body?.innerText || '';
         const login = window.desktopStore?.login('admin', 'admin123');
diff --git a/electron/relational-store.mjs b/electron/relational-store.mjs
index 7005bb4..ec8dcd6 100644
--- a/electron/relational-store.mjs
+++ b/electron/relational-store.mjs
@@ -1,3 +1,5 @@
+import { recordFiscalYear, fiscalYearId } from './fiscal-year-context.mjs';
+
 export const RELATIONAL_COLLECTION_KEYS = Object.freeze({
   accounts: 'elite-erp-accounts-v9',
   journals: 'elite-erp-journals-v6',
@@ -14,6 +16,12 @@ export const RELATIONAL_COLLECTION_KEYS = Object.freeze({
 });
 
 const COLLECTION_NAMES = new Map(Object.entries(RELATIONAL_COLLECTION_KEYS).map(([name, key]) => [key, name]));
+const SCOPED_KEY = /^(.*)::fiscal-year::(\d{4})$/;
+const collectionDescriptor = key => {
+  const match = String(key).match(SCOPED_KEY);
+  const baseKey = match?.[1] ?? String(key);
+  return { key: String(key), baseKey, fiscalYear: match?.[2] ?? null, name: COLLECTION_NAMES.get(baseKey) };
+};
 
 const text = value => value === undefined || value === null ? null : String(value);
 const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
@@ -32,6 +40,39 @@ function parseRows(value, key) {
 export function createRelationalStore(db) {
   function ensureSchema() {
     db.exec(`
+      CREATE TABLE IF NOT EXISTS erp_fiscal_years (
+        id TEXT PRIMARY KEY,
+        year_code TEXT NOT NULL UNIQUE,
+        start_date TEXT NOT NULL,
+        end_date TEXT NOT NULL,
+        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PARTIAL_CLOSED','FINAL_CLOSED')),
+        created_at TEXT NOT NULL DEFAULT (datetime('now')),
+        closed_at TEXT,
+        payload_json TEXT NOT NULL DEFAULT '{}'
+      );
+      CREATE INDEX IF NOT EXISTS idx_erp_fiscal_years_status ON erp_fiscal_years(status);
+      CREATE TABLE IF NOT EXISTS erp_record_years (
+        collection_key TEXT NOT NULL,
+        record_id TEXT NOT NULL,
+        fiscal_year_id TEXT,
+        source TEXT NOT NULL DEFAULT 'payload',
+        PRIMARY KEY(collection_key, record_id),
+        FOREIGN KEY(fiscal_year_id) REFERENCES erp_fiscal_years(id) ON DELETE RESTRICT
+      );
+      CREATE INDEX IF NOT EXISTS idx_erp_record_years_year ON erp_record_years(fiscal_year_id);
+      CREATE TABLE IF NOT EXISTS erp_fiscal_records (
+        fiscal_year_id TEXT NOT NULL REFERENCES erp_fiscal_years(id) ON DELETE RESTRICT,
+        collection_key TEXT NOT NULL,
+        record_id TEXT NOT NULL,
+        record_code TEXT,
+        document_number TEXT,
+        payload_json TEXT NOT NULL,
+        PRIMARY KEY(fiscal_year_id, collection_key, record_id)
+      );
+      CREATE INDEX IF NOT EXISTS idx_erp_fiscal_records_collection ON erp_fiscal_records(fiscal_year_id, collection_key);
+      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_fiscal_records_code ON erp_fiscal_records(fiscal_year_id, collection_key, record_code) WHERE record_code IS NOT NULL AND record_code<>'';
+      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_fiscal_records_document ON erp_fiscal_records(fiscal_year_id, collection_key, document_number) WHERE document_number IS NOT NULL AND document_number<>'';
+
       CREATE TABLE IF NOT EXISTS erp_accounts (
         id TEXT PRIMARY KEY,
         code TEXT NOT NULL,
@@ -331,10 +372,41 @@ export function createRelationalStore(db) {
   const insertCurrency = db.prepare(`INSERT INTO erp_currencies(id,code,name_ar,decimals,is_base,is_active,payload_json) VALUES (?,?,?,?,?,?,?)`);
   const insertEntity = db.prepare(`INSERT INTO erp_master_entities(entity_type,id,code,name_ar,normalized_name,linked_account_id,is_active,payload_json) VALUES (?,?,?,?,?,?,?,?)`);
   const insertAudit = db.prepare(`INSERT OR IGNORE INTO erp_audit_events(id,timestamp,user_id,user_name,user_role,module,action,details,ip_address,before_json,after_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
+  const upsertRecordYear = db.prepare(`INSERT INTO erp_record_years(collection_key,record_id,fiscal_year_id,source)
+    VALUES (?,?,?,?) ON CONFLICT(collection_key,record_id) DO UPDATE SET fiscal_year_id=excluded.fiscal_year_id,source=excluded.source`);
+  const insertFiscalRecord = db.prepare(`INSERT INTO erp_fiscal_records(fiscal_year_id,collection_key,record_id,record_code,document_number,payload_json) VALUES (?,?,?,?,?,?)`);
+
+  function syncFiscalCollection(descriptor, rows) {
+    const fiscalId = `fy-${descriptor.fiscalYear}`;
+    ensureFiscalYear(descriptor.fiscalYear);
+    db.prepare('DELETE FROM erp_fiscal_records WHERE fiscal_year_id=? AND collection_key=?').run(fiscalId, descriptor.baseKey);
+    db.prepare('DELETE FROM erp_record_years WHERE collection_key=?').run(descriptor.key);
+    rows.forEach((record, index) => {
+      const recordId = String(record?.id ?? `${descriptor.name || 'record'}-${index + 1}`);
+      const code = record?.code ?? null;
+      const documentNumber = record?.entryNumber ?? record?.voucherNumber ?? record?.receiptNumber ?? null;
+      insertFiscalRecord.run(fiscalId, descriptor.baseKey, recordId, text(code), text(documentNumber), json({ ...record, fiscalYear: descriptor.fiscalYear }));
+      upsertRecordYear.run(descriptor.key, recordId, fiscalId, 'scoped-key');
+    });
+    projectionStatus.run(descriptor.key, rows.length);
+    return true;
+  }
+
+  function fiscalYearForRecord(record) {
+    const year = recordFiscalYear(record);
+    return year ? fiscalYearId(year) : null;
+  }
 
   function clearCollection(key) {
-    const name = COLLECTION_NAMES.get(key);
+    const descriptor = collectionDescriptor(key);
+    const { name } = descriptor;
     if (!name) return false;
+    if (descriptor.fiscalYear) {
+      db.prepare('DELETE FROM erp_fiscal_records WHERE fiscal_year_id=? AND collection_key=?').run(`fy-${descriptor.fiscalYear}`, descriptor.baseKey);
+      db.prepare('DELETE FROM erp_record_years WHERE collection_key=?').run(descriptor.key);
+      projectionStatus.run(descriptor.key, 0);
+      return true;
+    }
     if (name === 'accounts') db.exec('DELETE FROM erp_accounts');
     if (name === 'journals') db.exec('DELETE FROM erp_journal_entries');
     if (name === 'paymentVouchers') db.exec('DELETE FROM erp_payment_vouchers');
@@ -344,6 +416,7 @@ export function createRelationalStore(db) {
     if (name === 'costCenters') db.exec('UPDATE erp_cost_centers SET parent_id = NULL; DELETE FROM erp_cost_centers');
     if (name === 'currencies') db.exec('DELETE FROM erp_currencies');
     if (['cashBoxes','bankAccounts','employees','customers','vendors'].includes(name)) db.prepare('DELETE FROM erp_master_entities WHERE entity_type=?').run(name);
+    db.prepare('DELETE FROM erp_record_years WHERE collection_key=?').run(key);
     if (name === 'auditLogs') return true;
     projectionStatus.run(key, 0);
     return true;
@@ -404,15 +477,28 @@ export function createRelationalStore(db) {
   }
 
   function syncCollection(key, value) {
-    const name = COLLECTION_NAMES.get(key);
+    const descriptor = collectionDescriptor(key);
+    const { name } = descriptor;
     if (!name) return false;
     const rows = parseRows(value, key);
+    if (descriptor.fiscalYear) return syncFiscalCollection(descriptor, rows);
     if (name === 'auditLogs') {
       rows.slice().reverse().forEach(item => insertAudit.run(text(item.id), text(item.timestamp) ?? '', text(item.userId) ?? '', text(item.userName) ?? '', text(item.userRole) ?? '', text(item.module) ?? '', text(item.action) ?? '', text(item.details) ?? '', text(item.ipAddress) ?? '', text(item.beforeJson), text(item.afterJson), json(item)));
       projectionStatus.run(key, db.prepare('SELECT count(*) AS count FROM erp_audit_events').get().count);
       return true;
     }
     if (name !== 'accounts') clearCollection(key);
+    rows.forEach(record => {
+      const id = record?.id;
+      if (id) {
+        const fiscalYearId = fiscalYearForRecord(record);
+        if (fiscalYearId) {
+          db.prepare(`INSERT OR IGNORE INTO erp_fiscal_years(id,year_code,start_date,end_date,status,payload_json)
+            VALUES (?,?,?||'-01-01',?||'-12-31','OPEN','{}')`).run(fiscalYearId, fiscalYearId.slice(3), fiscalYearId.slice(3), fiscalYearId.slice(3));
+        }
+        upsertRecordYear.run(key, String(id), fiscalYearId, 'payload');
+      }
+    });
 
     if (name === 'accounts') {
       syncAccounts(rows, { removeMissing: true, projectionKey: key });
@@ -501,18 +587,25 @@ export function createRelationalStore(db) {
 
   function rebuildAll(entries) {
     clearAll();
+    db.exec('DELETE FROM erp_fiscal_records; DELETE FROM erp_record_years;');
     const values = entries instanceof Map ? entries : new Map(entries);
     Object.values(RELATIONAL_COLLECTION_KEYS).forEach(key => {
       const value = values.get(key);
       if (value !== undefined && value !== null) syncCollection(key, value);
     });
+    for (const [key, value] of values.entries()) {
+      if (!SCOPED_KEY.test(String(key)) || value === undefined || value === null) continue;
+      syncCollection(String(key), value);
+    }
   }
 
   function info() {
     const scalar = sql => Number(db.prepare(sql).get()?.count ?? 0);
     const lastSyncedAt = db.prepare('SELECT max(last_synced_at) AS value FROM relational_projection_status').get()?.value ?? null;
     return {
-      schemaVersion: 3,
+      schemaVersion: 4,
+      fiscalYears: scalar('SELECT count(*) AS count FROM erp_fiscal_years'),
+      fiscalRecords: scalar('SELECT count(*) AS count FROM erp_fiscal_records'),
       accounts: scalar('SELECT count(*) AS count FROM erp_accounts'),
       accountCurrencies: scalar('SELECT count(*) AS count FROM erp_account_currencies'),
       journals: scalar('SELECT count(*) AS count FROM erp_journal_entries'),
@@ -529,9 +622,51 @@ export function createRelationalStore(db) {
     };
   }
 
+  function ensureFiscalYear(yearCode, startDate = `${yearCode}-01-01`, endDate = `${yearCode}-12-31`, status = 'OPEN', payloadValue = {}) {
+    const code = String(yearCode);
+    const id = `fy-${code}`;
+    db.prepare(`INSERT INTO erp_fiscal_years(id,year_code,start_date,end_date,status,payload_json)
+      VALUES (?,?,?,?,?,?) ON CONFLICT(year_code) DO UPDATE SET start_date=excluded.start_date,
+      end_date=excluded.end_date,status=excluded.status,payload_json=excluded.payload_json`)
+      .run(id, code, String(startDate), String(endDate), String(status), json(payloadValue));
+    return db.prepare('SELECT * FROM erp_fiscal_years WHERE year_code=?').get(code);
+  }
+
+  function listFiscalYears() {
+    return db.prepare('SELECT * FROM erp_fiscal_years ORDER BY year_code').all();
+  }
+
+  function validateFiscalYearDataset(yearCode) {
+    const fiscalId = `fy-${yearCode}`;
+    const records = db.prepare('SELECT collection_key,record_id,payload_json FROM erp_fiscal_records WHERE fiscal_year_id=?').all(fiscalId);
+    const ids = new Set();
+    const collectIds = value => {
+      if (Array.isArray(value)) { value.forEach(collectIds); return; }
+      if (!value || typeof value !== 'object') return;
+      if (value.id != null) ids.add(String(value.id));
+      Object.values(value).forEach(collectIds);
+    };
+    const parsed = records.map(row => ({ ...row, value: payload(row.payload_json) }));
+    parsed.forEach(row => collectIds(row.value));
+    const relationKeys = new Set(['parentId','linkedAccountId','sourceAccountId','sourceEntityId','journalEntryId','reversalJournalEntryId','reversalByEntryId','costCenterId','subLedgerId','accountId','employeeId','customerId','vendorId','cashBoxId','bankAccountId','custodyId','trustId']);
+    const broken = [];
+    const inspect = (value, owner, key = '') => {
+      if (Array.isArray(value)) { value.forEach(item => inspect(item, owner, key)); return; }
+      if (!value || typeof value !== 'object') {
+        if (relationKeys.has(key) && value != null && String(value) && !ids.has(String(value))) broken.push({ owner, key, target: String(value) });
+        return;
+      }
+      Object.entries(value).forEach(([childKey, child]) => inspect(child, owner, childKey));
+    };
+    parsed.forEach(row => inspect(row.value, `${row.collection_key}:${row.record_id}`));
+    return { ok: broken.length === 0, year: String(yearCode), records: records.length, ids: ids.size, broken };
+  }
+
   function readCollection(key) {
-    const name = COLLECTION_NAMES.get(key);
+    const descriptor = collectionDescriptor(key);
+    const { name } = descriptor;
     if (!name) return null;
+    if (descriptor.fiscalYear) return JSON.stringify(db.prepare('SELECT payload_json FROM erp_fiscal_records WHERE fiscal_year_id=? AND collection_key=? ORDER BY rowid').all(`fy-${descriptor.fiscalYear}`, descriptor.baseKey).map(row => payload(row.payload_json)));
     if (name === 'accounts') {
       const currenciesByAccount = new Map();
       db.prepare('SELECT * FROM erp_account_currencies ORDER BY account_id,currency_code').all().forEach(row => {
@@ -585,5 +720,5 @@ export function createRelationalStore(db) {
     return { ok: issues === 0, issues, foreignKeyViolations, orphanJournalLines, orphanPaymentLines, orphanReceiptLines, duplicateDocumentNumbers, unbalancedPostedJournals, auditEvents: scalar('SELECT count(*) AS count FROM erp_audit_events') };
   }
 
-  return { ensureSchema, syncCollection, clearCollection, clearAll, ensureAccounts, rebuildAll, readCollection, diagnostics, info };
+  return { ensureSchema, syncCollection, clearCollection, clearAll, ensureAccounts, rebuildAll, readCollection, diagnostics, info, ensureFiscalYear, listFiscalYears, validateFiscalYearDataset };
 }
diff --git a/package.json b/package.json
index 5a00e7e..39f67b4 100644
--- a/package.json
+++ b/package.json
@@ -63,11 +63,12 @@
     "shortcuts:regression": "tsx scripts/scoped-shortcuts-regression.mts",
     "first-patch:regression": "tsx scripts/first-patch-regression.mts",
     "no-seed-master-data:regression": "tsx scripts/no-seed-master-data-regression.mts",
-    "p1:verify": "npm run lint && npm run engine:unit && npm run entity-merge:regression && npm run p1-ui:regression && npm run p1-workflow:regression && npm run performance:regression && npm run migration:regression && npm run posting:regression && npm run daily-posting:regression && npm run accounting:regression && npm run domain:regression && npm run lifecycle:regression && npm run period:regression && npm run currency:regression && npm run control-transfer:regression && npm run command:regression && npm run recovery:regression && npm run auth:regression && npm run audit:regression && npm run documents:regression && npm run relational:smoke && npm run print:smoke && npm run print:orientation && npm run print:unified-preview && npm run print:empty-reports && npm run build",
+    "p1:verify": "npm run lint && npm run fiscal-year:regression && npm run engine:unit && npm run entity-merge:regression && npm run p1-ui:regression && npm run p1-workflow:regression && npm run performance:regression && npm run migration:regression && npm run posting:regression && npm run daily-posting:regression && npm run accounting:regression && npm run domain:regression && npm run lifecycle:regression && npm run period:regression && npm run currency:regression && npm run control-transfer:regression && npm run command:regression && npm run recovery:regression && npm run auth:regression && npm run audit:regression && npm run documents:regression && npm run relational:smoke && npm run print:smoke && npm run print:orientation && npm run print:unified-preview && npm run print:empty-reports && npm run build",
     "opening-interaction:regression": "tsx scripts/opening-balances-interaction-regression.mts",
     "sub-ledger-scope:regression": "tsx scripts/sub-ledger-account-scope-regression.mts",
     "statement-summary:regression": "tsx scripts/statement-summary-regression.mts",
-    "balance-sheet:regression": "tsx scripts/balance-sheet-report-regression.mts"
+    "balance-sheet:regression": "tsx scripts/balance-sheet-report-regression.mts",
+    "fiscal-year:regression": "node scripts/fiscal-year-context-regression.mjs && node scripts/fiscal-year-rollover-regression.mjs && tsx scripts/fiscal-year-dataset-regression.mts && node scripts/fiscal-year-atomic-rollover-regression.mjs && node scripts/legacy-fiscal-migration-regression.mjs && tsx scripts/fiscal-year-report-isolation-regression.mts && tsx scripts/fiscal-year-closing-regression.mts"
   },
   "dependencies": {
     "@tailwindcss/vite": "^4.1.14",
diff --git a/scripts/financial-reports-background-regression.mts b/scripts/financial-reports-background-regression.mts
index 679879c..47d6acc 100644
--- a/scripts/financial-reports-background-regression.mts
+++ b/scripts/financial-reports-background-regression.mts
@@ -20,7 +20,8 @@ assert.match(source, /const isMonthlyEmployeeAdvanceAccount/);
 assert.match(source, /code\.startsWith\('110206'\)/);
 assert.match(source, /const pendingVoucherJournals = useMemo<JournalEntry\[\]>/);
 assert.match(source, /voucher\.status === 'VOIDED' \|\| knownJournalIds\.has\(voucher\.id\) \|\| knownDocumentNumbers\.has\(documentNumber\)/);
-assert.match(source, /\[\.\.\.journals\.filter\(journal => journal\.status !== 'VOIDED'\), \...pendingVoucherJournals\]/);
+assert.match(source, /\[\.\.\.journals\.filter\(journal => journal\.status !== 'VOIDED' && journal\.affectsLedger !== false\), \...pendingVoucherJournals\]/);
+assert.match(source, /journal\.entryKind !== 'OPENING_AUDIT'/);
 assert.match(source, /v\.status !== 'VOIDED' && \(!isOriginalCurrencyReport/);
 assert.match(source, /v\.status !== 'VOIDED'\) map\[`pending-voucher-\$\{v\.id\}`\] = 'سند صرف نقدي'/);
 assert.match(source, /r\.status !== 'VOIDED'\) map\[`pending-voucher-\$\{r\.id\}`\] = 'سند قبض نقدي'/);
diff --git a/scripts/fiscal-year-atomic-rollover-regression.mjs b/scripts/fiscal-year-atomic-rollover-regression.mjs
new file mode 100644
index 0000000..9d677ba
--- /dev/null
+++ b/scripts/fiscal-year-atomic-rollover-regression.mjs
@@ -0,0 +1,57 @@
+import { DatabaseSync } from 'node:sqlite';
+import { createRelationalStore, RELATIONAL_COLLECTION_KEYS } from '../electron/relational-store.mjs';
+import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
+import { cloneYearDataset } from '../electron/fiscal-year-rollover.mjs';
+
+const db = new DatabaseSync(':memory:');
+db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT,updated_at TEXT);`);
+const relational = createRelationalStore(db);
+const commands = createAccountingCommandStore(db, relational);
+const key = (base, year) => `${base}::fiscal-year::${year}`;
+const source = {
+  accounts: [{ id: 'A-2026', code: '1101', nameAr: 'الصندوق', nameEn: 'Cash', level: 5, accountType: 1, reportType: 1, nature: 'DEBIT', category: 'ASSET', subLedgerType: 'NONE', defaultCurrency: 'YER', openingBalance: 50, isActive: true, fiscalYear: '2026' }],
+  journals: [{ id: 'J-2026', entryNumber: 'JV-1', date: '2026-12-31', lines: [{ id: 'L-2026', accountId: 'A-2026', debit: 50, credit: 0 }], fiscalYear: '2026' }],
+};
+const sourceAccountKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2026');
+const sourceJournalKey = key(RELATIONAL_COLLECTION_KEYS.journals, '2026');
+commands.executeVersionedSet(sourceAccountKey, JSON.stringify(source.accounts), 0);
+commands.executeVersionedSet(sourceJournalKey, JSON.stringify(source.journals), 0);
+const sourceBefore = db.prepare('SELECT value FROM kv_store WHERE key=?').get(sourceAccountKey).value;
+const cloned = cloneYearDataset(source, '2026', '2027').collections;
+const targetAccountKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2027');
+const targetJournalKey = key(RELATIONAL_COLLECTION_KEYS.journals, '2027');
+const result = commands.execute({
+  idempotencyKey: 'FISCAL_YEAR_CLONE:2026:2027', commandType: 'FISCAL_YEAR_CLONE', documentType: 'YEAR_DATASET', documentNumber: '2026->2027',
+  changes: [{ key: targetAccountKey, value: JSON.stringify(cloned.accounts) }, { key: targetJournalKey, value: JSON.stringify(cloned.journals) }],
+  expectedVersions: { [targetAccountKey]: 0, [targetJournalKey]: 0 },
+});
+const sourceAfter = db.prepare('SELECT value FROM kv_store WHERE key=?').get(sourceAccountKey).value;
+const targetAccounts = JSON.parse(relational.readCollection(targetAccountKey));
+const targetJournals = JSON.parse(relational.readCollection(targetJournalKey));
+const failedKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2028');
+const failed = commands.execute({ idempotencyKey: 'FAIL-2028', commandType: 'FISCAL_YEAR_CLONE', documentType: 'YEAR_DATASET', documentNumber: '2027->2028', changes: [{ key: failedKey, value: '[]' }], expectedVersions: { [failedKey]: 99 } });
+const failedAbsent = !db.prepare('SELECT 1 AS found FROM kv_store WHERE key=?').get(failedKey);
+const brokenAccountKey = key(RELATIONAL_COLLECTION_KEYS.accounts, '2029');
+const brokenJournalKey = key(RELATIONAL_COLLECTION_KEYS.journals, '2029');
+const broken = commands.execute({
+  idempotencyKey: 'BROKEN-2029', commandType: 'FISCAL_YEAR_CLONE', documentType: 'YEAR_DATASET', documentNumber: '2028->2029',
+  changes: [
+    { key: brokenAccountKey, value: JSON.stringify([{ ...source.accounts[0], id: 'A-2029', fiscalYear: '2029' }]) },
+    { key: brokenJournalKey, value: JSON.stringify([{ ...source.journals[0], id: 'J-2029', fiscalYear: '2029', date: '2029-01-01', lines: [{ id: 'L-2029', accountId: 'MISSING-2029' }] }]) },
+  ], expectedVersions: { [brokenAccountKey]: 0, [brokenJournalKey]: 0 },
+});
+const brokenRolledBack = !db.prepare('SELECT 1 AS found FROM kv_store WHERE key IN (?,?) LIMIT 1').get(brokenAccountKey, brokenJournalKey);
+const closedYear = '2030';
+const closedPeriodKey = key('elite-erp-period-states-v1', closedYear);
+commands.executeVersionedSet(closedPeriodKey, JSON.stringify([{ key: closedYear, scope: 'YEAR', status: 'FINAL_CLOSED' }]), 0);
+const closedAccountsKey = key(RELATIONAL_COLLECTION_KEYS.accounts, closedYear);
+const closedWrite = commands.executeVersionedSet(closedAccountsKey, JSON.stringify(source.accounts), 0);
+const closedWriteAbsent = !db.prepare('SELECT 1 AS found FROM kv_store WHERE key=?').get(closedAccountsKey);
+const reopen = commands.execute({
+  idempotencyKey: 'REOPEN-2030', commandType: 'PERIOD_OPEN', documentType: 'YEAR', documentNumber: '2030:2',
+  changes: [{ key: closedPeriodKey, value: JSON.stringify([{ key: closedYear, scope: 'YEAR', status: 'OPEN' }]) }],
+  expectedVersions: { [closedPeriodKey]: commands.versionOf(closedPeriodKey) },
+});
+db.close();
+if (!result.ok || sourceBefore !== sourceAfter || targetAccounts.length !== 1 || targetJournals.length !== 1 || targetAccounts[0].id === source.accounts[0].id || targetJournals[0].lines[0].accountId !== targetAccounts[0].id || !failed.conflict || !failedAbsent || broken.ok || !String(broken.error).includes('FISCAL_YEAR_GRAPH_INVALID') || !brokenRolledBack || !closedWrite.closed || !closedWriteAbsent || !reopen.ok) throw new Error(JSON.stringify({ result, sourceUnchanged: sourceBefore === sourceAfter, targetAccounts, targetJournals, failed, failedAbsent, broken, brokenRolledBack, closedWrite, closedWriteAbsent, reopen }));
+console.log('FISCAL_YEAR_ATOMIC_ROLLOVER_OK sourceUnchanged=true targetIndependent=true linksRemapped=true conflictRollback=true brokenGraphRollback=true closedWriteBlocked=true reopenAllowed=true');
diff --git a/scripts/fiscal-year-closing-regression.mts b/scripts/fiscal-year-closing-regression.mts
new file mode 100644
index 0000000..9bd1f1b
--- /dev/null
+++ b/scripts/fiscal-year-closing-regression.mts
@@ -0,0 +1,42 @@
+import assert from 'node:assert/strict';
+import { buildFiscalYearOpeningSnapshot } from '../src/utils/fiscalYearClosing';
+import type { Account, CashBox, JournalEntry } from '../src/types/erp';
+
+const posting = (id: string, code: string, nameAr: string, subLedgerType: Account['subLedgerType']): Account => ({
+  id, code, nameAr, nameEn: nameAr, level: 5, accountType: 2, reportType: 1,
+  nature: code.startsWith('1') ? 'DEBIT' : 'CREDIT', category: 'BALANCE_SHEET', subLedgerType,
+  currencies: [{ id: `${id}-yer`, code: 'YER', isDefault: true, isActive: true }, { id: `${id}-usd`, code: 'USD', isDefault: false, isActive: true }],
+  defaultCurrency: 'YER', openingBalance: 0, isActive: true, openingBalances: [],
+});
+const accounts = [posting('cash', '1101010001', 'الصندوق', 'CASH_BOX'), posting('equity', '2202010001', 'أرباح مبقاة', 'NONE')];
+const cashBox: CashBox = {
+  id: 'box', code: 'CSH-1', nameAr: 'صندوق USD', nameEn: 'USD box', linkedAccountId: 'cash', defaultCurrency: 'USD', isActive: true,
+  boxType: 'MAIN', currencies: [{ id: 'box-usd', code: 'USD', isDefault: true, isActive: true }], createdAt: '2026-01-01',
+  openingBalance: 37.5, openingBalanceForeign: 10, openingBalances: [{
+    id: 'box-opening', fiscalYear: '2026', accountId: 'cash', subAccountId: 'box', currency: 'USD', exchangeRate: 3.75,
+    debit: 10, credit: 0, debitLocal: 37.5, creditLocal: 0, amount: 37.5, foreignAmount: 10, rate: 3.75,
+  }],
+};
+const journal: JournalEntry = {
+  id: 'j1', entryNumber: 'JV-1', date: '2026-06-01', reference: 'REF', narration: 'USD movement', status: 'POSTED',
+  totalDebit: 18.75, totalCredit: 18.75, currency: 'YER', exchangeRate: 1, createdBy: 'test', createdAt: '2026-06-01', lines: [
+    { id: 'l1', accountId: 'cash', accountCode: '1101010001', accountNameAr: 'الصندوق', description: 'cash', debit: 18.75, credit: 0, debitForeign: 5, creditForeign: 0, currency: 'USD', exchangeRate: 3.75, subLedgerType: 'CASH_BOX', subLedgerId: 'box', costCenterId: 'cc1' },
+    { id: 'l2', accountId: 'equity', accountCode: '2202010001', accountNameAr: 'أرباح مبقاة', description: 'equity', debit: 0, credit: 18.75, currency: 'YER', exchangeRate: 1 },
+  ],
+};
+const snapshot = buildFiscalYearOpeningSnapshot({
+  accounts, journals: [journal], cashBoxes: [cashBox], bankAccounts: [], customers: [], vendors: [], employees: [],
+  sourceYear: '2026', targetYear: '2027', baseCurrency: 'YER',
+});
+const box = snapshot.cashBoxes[0];
+assert.equal(box.openingBalances?.length, 2);
+assert.equal(box.openingBalances?.reduce((sum, row) => sum + (row.foreignAmount || 0), 0), 15);
+assert.equal(box.openingBalances?.reduce((sum, row) => sum + (row.amount || 0), 0), 56.25);
+assert.equal(box.openingBalances?.find(row => row.costCenterId === 'cc1')?.foreignAmount, 5);
+assert.ok(box.openingBalances?.every(row => row.currency === 'USD' && row.fiscalYear === '2027'));
+const control = snapshot.accounts.find(account => account.id === 'cash')!;
+assert.equal(control.openingBalance, 56.25);
+assert.equal(control.openingBalances?.[0].foreignAmount, 15);
+assert.equal(snapshot.lines.reduce((sum, line) => sum + line.debit, 0), 56.25);
+assert.equal(snapshot.lines.reduce((sum, line) => sum + line.credit, 0), 56.25);
+console.log('FISCAL_YEAR_CLOSING_OK analytical=true currencies=USD foreign=15 local=56.25 costCenter=true balanced=true');
diff --git a/scripts/fiscal-year-context-regression.mjs b/scripts/fiscal-year-context-regression.mjs
new file mode 100644
index 0000000..d9054a4
--- /dev/null
+++ b/scripts/fiscal-year-context-regression.mjs
@@ -0,0 +1,14 @@
+import { DatabaseSync } from 'node:sqlite';
+import { fiscalYearId, normalizeFiscalYear, recordFiscalYear, runAtomic } from '../electron/fiscal-year-context.mjs';
+
+if (normalizeFiscalYear('2027') !== '2027' || fiscalYearId('2027') !== 'fy-2027') throw new Error('YEAR_NORMALIZATION_FAILED');
+if (recordFiscalYear({ date: '2026-09-13' }) !== '2026') throw new Error('DATE_YEAR_FAILED');
+if (recordFiscalYear({ fiscalYear: '2027', date: '2026-09-13' }) !== '2027') throw new Error('EXPLICIT_YEAR_FAILED');
+const db = new DatabaseSync(':memory:');
+db.exec('CREATE TABLE t (value INTEGER)');
+runAtomic(db, () => db.prepare('INSERT INTO t VALUES (1)').run());
+let rolledBack = false;
+try { runAtomic(db, () => { db.prepare('INSERT INTO t VALUES (2)').run(); throw new Error('injected'); }); } catch { rolledBack = db.prepare('SELECT count(*) AS count FROM t').get().count === 1; }
+db.close();
+if (!rolledBack) throw new Error('ATOMIC_ROLLBACK_FAILED');
+console.log('FISCAL_YEAR_CONTEXT_OK normalization=true explicitYear=true atomicRollback=true');
diff --git a/scripts/fiscal-year-dataset-regression.mts b/scripts/fiscal-year-dataset-regression.mts
new file mode 100644
index 0000000..db664f9
--- /dev/null
+++ b/scripts/fiscal-year-dataset-regression.mts
@@ -0,0 +1,8 @@
+import { partitionLegacyRows, fiscalYearStorageKey, stampFiscalYear } from '../src/utils/fiscalYearDatasetStore';
+
+const rows = [{ id: 'old', date: '2026-12-31' }, { id: 'new', fiscalYear: '2027' }, { id: 'legacy' }];
+if (fiscalYearStorageKey('journals', '2027') !== 'journals::fiscal-year::2027') throw new Error('SCOPE_KEY_FAILED');
+if (partitionLegacyRows(rows, '2026', '2026').map(r => r.id).join(',') !== 'old,legacy') throw new Error('LEGACY_PARTITION_FAILED');
+if (partitionLegacyRows(rows, '2027', '2026').map(r => r.id).join(',') !== 'new') throw new Error('TARGET_PARTITION_FAILED');
+if ((stampFiscalYear([{ id: 'x' }], '2027')[0] as { fiscalYear?: string }).fiscalYear !== '2027') throw new Error('STAMP_FAILED');
+console.log('FISCAL_YEAR_DATASET_OK partition=true scopedKey=true stamp=true');
diff --git a/scripts/fiscal-year-report-isolation-regression.mts b/scripts/fiscal-year-report-isolation-regression.mts
new file mode 100644
index 0000000..8cb2f3a
--- /dev/null
+++ b/scripts/fiscal-year-report-isolation-regression.mts
@@ -0,0 +1,38 @@
+import assert from 'node:assert/strict';
+import { calculateAccountActivity, calculateTrialBalance } from '../src/utils/accountingEngine';
+import type { Account, JournalEntry } from '../src/types/erp';
+
+const account = (id: string, openingBalance: number): Account => ({
+  id, code: '1101010001', nameAr: 'الصندوق العام', nameEn: 'Cash', level: 5,
+  accountType: 2, reportType: 1, nature: 'DEBIT', category: 'BALANCE_SHEET',
+  subLedgerType: 'NONE', currencies: [{ id: `cur-${id}`, code: 'YER', isDefault: true, isActive: true }],
+  defaultCurrency: 'YER', openingBalance, isActive: true,
+});
+
+const sourceAccounts = [account('cash-2026', 100)];
+const sourceJournals: JournalEntry[] = [{
+  id: 'movement-2026', entryNumber: 'JV-1', date: '2026-06-01', reference: 'MOV-1', narration: 'movement',
+  lines: [{ id: 'line-2026', accountId: 'cash-2026', accountCode: '1101010001', accountNameAr: 'الصندوق العام', description: 'movement', debit: 25, credit: 0 }],
+  totalDebit: 25, totalCredit: 25, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'test', createdAt: '2026-06-01',
+}];
+const sourceBefore = JSON.stringify({ sourceAccounts, sourceJournals });
+const sourceClosing = calculateAccountActivity(sourceAccounts, sourceJournals)['cash-2026'];
+assert.equal(sourceClosing.debit - sourceClosing.credit, 125);
+
+const targetAccounts = [account('cash-2027', 125)];
+const openingAudit: JournalEntry = {
+  id: 'open-2027', entryNumber: 'OPEN-2027', date: '2027-01-01', reference: 'OPEN-2027', narration: 'opening audit',
+  lines: [{ id: 'open-line-2027', accountId: 'cash-2027', accountCode: '1101010001', accountNameAr: 'الصندوق العام', description: 'opening audit', debit: 125, credit: 0 }],
+  totalDebit: 125, totalCredit: 125, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'test', createdAt: '2027-01-01',
+  fiscalYear: '2027', entryKind: 'OPENING_AUDIT', affectsLedger: false, readOnly: true,
+};
+const targetActivity = calculateAccountActivity(targetAccounts, [openingAudit])['cash-2027'];
+assert.equal(targetActivity.debit - targetActivity.credit, 125, 'opening audit must not double the opening balance');
+const targetTrial = calculateTrialBalance(targetAccounts, [openingAudit]);
+assert.equal(targetTrial.totalDebit, 125);
+assert.equal(targetTrial.totalCredit, 0);
+assert.equal(JSON.stringify({ sourceAccounts, sourceJournals }), sourceBefore, 'source year must remain byte-identical');
+assert.equal(openingAudit.readOnly, true);
+assert.equal(openingAudit.affectsLedger, false);
+
+console.log('FISCAL_YEAR_REPORT_ISOLATION_OK sourceUnchanged=true openingOnce=true auditExcluded=true auditReadOnly=true');
diff --git a/scripts/fiscal-year-rollover-regression.mjs b/scripts/fiscal-year-rollover-regression.mjs
new file mode 100644
index 0000000..4b995ea
--- /dev/null
+++ b/scripts/fiscal-year-rollover-regression.mjs
@@ -0,0 +1,15 @@
+import { cloneYearDataset, validateClonedYearGraph } from '../electron/fiscal-year-rollover.mjs';
+
+const source = {
+  accounts: [{ id: 'A1', code: '1101', parentId: null, fiscalYear: '2026' }, { id: 'A2', code: '110101', parentId: 'A1', fiscalYear: '2026' }],
+  cashBoxes: [{ id: 'C1', linkedAccountId: 'A2', fiscalYear: '2026' }],
+  journals: [{ id: 'J1', date: '2026-12-31', fiscalYear: '2026', lines: [{ id: 'L1', accountId: 'A2' }] }],
+};
+const cloned = cloneYearDataset(source, '2026', '2027');
+const check = validateClonedYearGraph(source, cloned);
+if (!check.ok || check.count !== 4) throw new Error(`ROLLOVER_GRAPH_FAILED:${JSON.stringify({ check, cloned: cloned.collections })}`);
+const sourceAccount = source.accounts[0].id;
+const targetAccount = cloned.collections.accounts[0].id;
+if (sourceAccount === targetAccount || cloned.collections.accounts[1].parentId !== targetAccount || cloned.collections.cashBoxes[0].linkedAccountId !== cloned.collections.accounts[1].id) throw new Error('ROLLOVER_LINK_REMAP_FAILED');
+if (cloned.collections.journals[0].date !== '2027-12-31' || cloned.collections.journals[0].lines[0].accountId !== cloned.collections.accounts[1].id) throw new Error('ROLLOVER_DATE_OR_LINE_FAILED');
+console.log(`FISCAL_YEAR_ROLLOVER_OK rows=${check.count} sourceIdsIndependent=true linksRemapped=true datesShifted=true`);
diff --git a/scripts/legacy-fiscal-migration-regression.mjs b/scripts/legacy-fiscal-migration-regression.mjs
new file mode 100644
index 0000000..3cee8c3
--- /dev/null
+++ b/scripts/legacy-fiscal-migration-regression.mjs
@@ -0,0 +1,27 @@
+import { DatabaseSync } from 'node:sqlite';
+import { createRelationalStore } from '../electron/relational-store.mjs';
+import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
+import { migrateLegacyFiscalDataset } from '../electron/legacy-fiscal-migration.mjs';
+
+const db = new DatabaseSync(':memory:');
+db.exec(`CREATE TABLE app_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE kv_store(key TEXT PRIMARY KEY,value TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT 'app_state',updated_at TEXT);`);
+const relational = createRelationalStore(db);
+createAccountingCommandStore(db, relational);
+const put = db.prepare(`INSERT INTO kv_store(key,value,entity_type) VALUES(?,?,'erp_state')`);
+const accounts = [{ id: 'A1', code: '1101', nameAr: 'نقدية', nameEn: '', level: 5, accountType: 1, reportType: 1, nature: 'DEBIT', category: 'ASSET', subLedgerType: 'NONE', defaultCurrency: 'YER', openingBalances: [{ id: 'O26', amount: 10 }, { id: 'O27', fiscalYear: '2027', amount: 20 }] }];
+const journals = [{ id: 'J26', date: '2026-12-31' }, { id: 'J27', date: '2027-01-01' }];
+put.run('elite-erp-accounts-v9', JSON.stringify(accounts));
+put.run('elite-erp-journals-v6', JSON.stringify(journals));
+put.run('elite-erp-settings-v6', JSON.stringify({ shared: true }));
+const sourceBefore = db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-accounts-v9'").get().value;
+const result = migrateLegacyFiscalDataset(db, relational, '2026');
+const sourceAfter = db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-accounts-v9'").get().value;
+const migratedAccounts = JSON.parse(db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-accounts-v9::fiscal-year::2026'").get().value);
+const migratedJournals = JSON.parse(db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-journals-v6::fiscal-year::2026'").get().value);
+const targetAccounts = JSON.parse(db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-accounts-v9::fiscal-year::2027'").get().value);
+const targetJournals = JSON.parse(db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-journals-v6::fiscal-year::2027'").get().value);
+const settingsScoped = db.prepare("SELECT 1 AS found FROM kv_store WHERE key LIKE 'elite-erp-settings-v6::fiscal-year::%'").get();
+const again = migrateLegacyFiscalDataset(db, relational, '2026');
+db.close();
+if (!result.migrated || result.year !== '2026' || !result.years.includes('2027') || sourceBefore !== sourceAfter || migratedAccounts[0].fiscalYear !== '2026' || migratedAccounts[0].openingBalances.length !== 1 || migratedAccounts[0].openingBalances[0].fiscalYear !== '2026' || migratedJournals.length !== 1 || migratedJournals[0].id !== 'J26' || targetAccounts[0].id === 'A1' || targetAccounts[0].openingBalances.length !== 1 || targetAccounts[0].openingBalances[0].fiscalYear !== '2027' || targetJournals.length !== 1 || targetJournals[0].id === 'J27' || targetJournals[0].fiscalYear !== '2027' || settingsScoped || again.migrated) throw new Error(JSON.stringify({ result, sourceUnchanged: sourceBefore === sourceAfter, migratedAccounts, migratedJournals, targetAccounts, targetJournals, settingsScoped, again }));
+console.log('LEGACY_FISCAL_MIGRATION_OK sourceUnchanged=true sourceYear=2026 destinationYearsPreserved=true targetIdsIndependent=true settingsGlobal=true idempotent=true');
diff --git a/scripts/relational-sqlite-smoke.mjs b/scripts/relational-sqlite-smoke.mjs
index 4ed22d1..3bc8783 100644
--- a/scripts/relational-sqlite-smoke.mjs
+++ b/scripts/relational-sqlite-smoke.mjs
@@ -49,6 +49,16 @@ db.exec('BEGIN IMMEDIATE');
 store.rebuildAll(snapshot);
 db.exec('COMMIT');
 const initial = store.info();
+store.ensureFiscalYear('2026', '2026-01-01', '2026-12-31');
+store.ensureFiscalYear('2027', '2027-01-01', '2027-12-31');
+const scopedAccounts2026 = `${RELATIONAL_COLLECTION_KEYS.accounts}::fiscal-year::2026`;
+const scopedAccounts2027 = `${RELATIONAL_COLLECTION_KEYS.accounts}::fiscal-year::2027`;
+store.syncCollection(scopedAccounts2026, JSON.stringify([{ ...accounts[0], id: 'FY26-A1', fiscalYear: '2026' }]));
+store.syncCollection(scopedAccounts2027, JSON.stringify([{ ...accounts[0], id: 'FY27-A1', fiscalYear: '2027' }]));
+const scoped26 = JSON.parse(store.readCollection(scopedAccounts2026));
+const scoped27 = JSON.parse(store.readCollection(scopedAccounts2027));
+const fiscalYears = store.listFiscalYears();
+const mappedJournalYear = db.prepare('SELECT fiscal_year_id FROM erp_record_years WHERE collection_key=? AND record_id=?').get(RELATIONAL_COLLECTION_KEYS.journals, 'J-1')?.fiscal_year_id;
 db.prepare('UPDATE erp_journal_lines SET debit=321 WHERE id=?').run('JL-1');
 const authoritativeRead = JSON.parse(store.readCollection(RELATIONAL_COLLECTION_KEYS.journals));
 const authoritativeDebit = authoritativeRead[0].lines.find(line => line.id === 'JL-1')?.debit;
@@ -68,6 +78,11 @@ db.exec('BEGIN IMMEDIATE');
 store.rebuildAll(snapshot);
 db.exec('COMMIT');
 const restored = store.info();
+db.exec('BEGIN IMMEDIATE');
+store.rebuildAll(new Map([...snapshot, [scopedAccounts2026, JSON.stringify([{ ...accounts[0], id: 'FY26-A1', fiscalYear: '2026' }])], [scopedAccounts2027, JSON.stringify([{ ...accounts[0], id: 'FY27-A1', fiscalYear: '2027' }])]]));
+db.exec('COMMIT');
+const scopedRebuilt26 = JSON.parse(store.readCollection(scopedAccounts2026));
+const scopedRebuilt27 = JSON.parse(store.readCollection(scopedAccounts2027));
 const diagnostics = store.diagnostics();
 let missingAccountBlocked = false;
 try {
@@ -104,14 +119,15 @@ fs.rmSync(file, { force: true });
 const valid =
   initial.accounts === 2 && initial.accountCurrencies === 1 && initial.journals === 1 && initial.journalLines === 2 &&
   initial.paymentVouchers === 1 && initial.paymentVoucherLines === 1 && initial.receiptVouchers === 1 && initial.receiptVoucherLines === 1 &&
-  initial.currencies === 1 && initial.costCenters === 2 && initial.masterEntities === 1 &&
+  initial.currencies === 1 && initial.costCenters === 2 && initial.masterEntities === 1 && fiscalYears.length === 2 && mappedJournalYear === 'fy-2026' &&
+  scoped26.length === 1 && scoped27.length === 1 && scoped26[0].id === 'FY26-A1' && scoped27[0].id === 'FY27-A1' && scoped26[0].code === scoped27[0].code &&
   authoritativeDebit === 321 &&
   updatedDebit === 125 && updatedLines === 1 && afterDelete.paymentVouchers === 0 && afterDelete.paymentVoucherLines === 0 &&
-  restored.journalLines === 2 && restored.paymentVouchers === 1 && diagnostics.ok && missingAccountBlocked && referencedAccountDeleteBlocked && duplicateEntityBlocked && duplicateJournalLinesRepaired && integrity === 'ok';
+  restored.journalLines === 2 && restored.paymentVouchers === 1 && restored.fiscalRecords === 0 && scopedRebuilt26[0]?.id === 'FY26-A1' && scopedRebuilt27[0]?.id === 'FY27-A1' && diagnostics.ok && missingAccountBlocked && referencedAccountDeleteBlocked && duplicateEntityBlocked && duplicateJournalLinesRepaired && integrity === 'ok';
 
 if (!valid) {
-  console.error({ initial, updatedDebit, updatedLines, afterDelete, restored, integrity });
+  console.error({ initial, fiscalYears, mappedJournalYear, scoped26, scoped27, scopedRebuilt26, scopedRebuilt27, updatedDebit, updatedLines, afterDelete, restored, integrity });
   process.exit(1);
 }
 
-console.log(`RELATIONAL_SQLITE_SMOKE_OK accounts=${restored.accounts} journals=${restored.journals}/${restored.journalLines} payments=${restored.paymentVouchers}/${restored.paymentVoucherLines} receipts=${restored.receiptVouchers}/${restored.receiptVoucherLines} masters=${restored.masterEntities} authority=normalized authoritativeDebit=${authoritativeDebit} diagnostics=${diagnostics.ok} fkReferenceBlocked=${missingAccountBlocked} referencedDeleteBlocked=${referencedAccountDeleteBlocked} duplicateEntityBlocked=${duplicateEntityBlocked} duplicateJournalLinesRepaired=${duplicateJournalLinesRepaired} updateDebit=${updatedDebit} deleteCascade=${afterDelete.paymentVoucherLines} integrity=${integrity}`);
+console.log(`RELATIONAL_SQLITE_SMOKE_OK accounts=${restored.accounts} journals=${restored.journals}/${restored.journalLines} payments=${restored.paymentVouchers}/${restored.paymentVoucherLines} receipts=${restored.receiptVouchers}/${restored.receiptVoucherLines} masters=${restored.masterEntities} fiscalYears=${fiscalYears.length} scopedIsolation=${scoped26[0].id !== scoped27[0].id} mappedJournalYear=${mappedJournalYear} authority=normalized authoritativeDebit=${authoritativeDebit} diagnostics=${diagnostics.ok} fkReferenceBlocked=${missingAccountBlocked} referencedDeleteBlocked=${referencedAccountDeleteBlocked} duplicateEntityBlocked=${duplicateEntityBlocked} duplicateJournalLinesRepaired=${duplicateJournalLinesRepaired} updateDebit=${updatedDebit} deleteCascade=${afterDelete.paymentVoucherLines} integrity=${integrity}`);
diff --git a/scripts/verify-fiscal-migration-database.mts b/scripts/verify-fiscal-migration-database.mts
new file mode 100644
index 0000000..aae3e83
--- /dev/null
+++ b/scripts/verify-fiscal-migration-database.mts
@@ -0,0 +1,59 @@
+import fs from 'node:fs';
+import { DatabaseSync } from 'node:sqlite';
+import { createRelationalStore } from '../electron/relational-store.mjs';
+import { createAccountingCommandStore } from '../electron/accounting-command-store.mjs';
+import { inferLegacyFiscalYear, migrateLegacyFiscalDataset } from '../electron/legacy-fiscal-migration.mjs';
+import { calculateTrialBalance } from '../src/utils/accountingEngine';
+import type { Account, JournalEntry } from '../src/types/erp';
+
+const [sourcePath, targetPath] = process.argv.slice(2);
+if (!sourcePath || !targetPath) throw new Error('Usage: tsx verify-fiscal-migration-database.mts SOURCE TARGET');
+fs.copyFileSync(sourcePath, targetPath);
+const db = new DatabaseSync(targetPath);
+db.exec('PRAGMA foreign_keys=ON');
+const raw = (key: string) => String(db.prepare('SELECT value FROM kv_store WHERE key=?').get(key)?.value ?? '[]');
+const accountsKey = 'elite-erp-accounts-v9';
+const journalsKey = 'elite-erp-journals-v6';
+const settingsKey = 'elite-erp-settings-v6';
+const accountsBeforeRaw = raw(accountsKey);
+const journalsBeforeRaw = raw(journalsKey);
+const sourceYear = inferLegacyFiscalYear(raw(journalsKey));
+const normalizeAccounts = (rows: Account[]) => rows.map(account => {
+  const openingRows = (account.openingBalances || []).filter(item => !item.fiscalYear || item.fiscalYear === sourceYear);
+  const openingBalance = Array.isArray(account.openingBalances)
+    ? openingRows.reduce((sum, item) => sum + (item.debitLocal || 0) - (item.creditLocal || 0), 0)
+    : account.openingBalance || 0;
+  return { ...account, openingBalances: openingRows, openingBalance };
+});
+const sourceAccounts = normalizeAccounts(JSON.parse(raw(accountsKey)) as Account[]);
+const sourceJournals = (JSON.parse(raw(journalsKey)) as JournalEntry[]).filter(item => String(item.date || '').startsWith(`${sourceYear}-`));
+const before = calculateTrialBalance(sourceAccounts, sourceJournals);
+const settingsBefore = raw(settingsKey);
+const relational = createRelationalStore(db);
+createAccountingCommandStore(db, relational);
+const migrated = migrateLegacyFiscalDataset(db, relational, sourceYear);
+const scoped = (key: string) => `${key}::fiscal-year::${sourceYear}`;
+const migratedAccounts = normalizeAccounts(JSON.parse(raw(scoped(accountsKey))) as Account[]);
+const migratedJournals = JSON.parse(raw(scoped(journalsKey))) as JournalEntry[];
+const after = calculateTrialBalance(migratedAccounts, migratedJournals);
+const targetYear = String(Number(sourceYear) + 1);
+const targetAccountsRaw = raw(`${accountsKey}::fiscal-year::${targetYear}`);
+const targetJournalsRaw = raw(`${journalsKey}::fiscal-year::${targetYear}`);
+const targetAccounts = JSON.parse(targetAccountsRaw) as Account[];
+const targetJournals = JSON.parse(targetJournalsRaw) as JournalEntry[];
+const numeric = (report: typeof before) => ({
+  totalDebit: report.totalDebit,
+  totalCredit: report.totalCredit,
+  rows: report.rows.map(row => [row.accountCode, row.debitBalance, row.creditBalance]),
+});
+const sourceUnchanged = raw(accountsKey) === accountsBeforeRaw && raw(journalsKey) === journalsBeforeRaw && raw(settingsKey) === settingsBefore;
+const reportsEqual = JSON.stringify(numeric(before)) === JSON.stringify(numeric(after));
+const sourceIds = new Set(migratedAccounts.map(item => item.id));
+const targetIndependent = targetAccounts.length > 0 && targetAccounts.every(item => !sourceIds.has(item.id));
+const auditJournalsReadOnly = targetJournals.filter(item => /^OPEN-\d{4}$/.test(item.reference || item.entryNumber || '')).every(item => item.readOnly && item.affectsLedger === false && item.entryKind === 'OPENING_AUDIT');
+const integrity = String(db.prepare('PRAGMA integrity_check').get()?.integrity_check || '');
+db.close();
+if (!migrated.migrated || sourceYear !== '2026' || !reportsEqual || !sourceUnchanged || !targetIndependent || !auditJournalsReadOnly || integrity !== 'ok') {
+  throw new Error(JSON.stringify({ migrated, reportsEqual, sourceUnchanged, targetIndependent, auditJournalsReadOnly, integrity, before: numeric(before), after: numeric(after) }));
+}
+console.log(`FISCAL_MIGRATION_DATABASE_OK year=${sourceYear} years=${migrated.years.join(',')} rows=${before.rows.length} debit=${before.totalDebit} credit=${before.totalCredit} sourceUnchanged=true settingsGlobal=true targetIndependent=true auditReadOnly=true integrity=ok output=${targetPath}`);
diff --git a/src/App.tsx b/src/App.tsx
index 33d4383..4ed3196 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -37,7 +37,7 @@ import TabKeepAliveContainer from './components/ui/TabKeepAliveContainer';
 import { TabsProvider, useTabs, tabIdFor } from './tabs/TabsContext';
 import { LanguageProvider, useI18n } from './i18n';
 import { useTheme } from './utils/useTheme';
-import { commitAccountingCommand, getPersistentItem, persistentVersion, removePersistentItem, type AccountingCommandResult } from './utils/desktopStorage';
+import { commitAccountingCommand, getPersistentEntries, getPersistentItem, persistentVersion, removePersistentItem, type AccountingCommandResult } from './utils/desktopStorage';
 import { accountingCommandError, type DailyPostingBatchResult, type DailyPostingRequest } from './utils/dailyPosting';
 
 import {
@@ -61,9 +61,12 @@ import { Account, AccountCurrency, JournalEntry, JournalLine, AuditLog, CostCent
 import type { SavePayload } from './components/modules/opening/types';
 import { applyOpeningBalances, cleanupOpeningBalanceDuplicates, reconcileControlAccountOpenings } from './services/openingBalancesService';
 import { fitAmountInput, isAmountInput } from './utils/amountInputFit';
-import { useLocalStorageState } from './utils/useLocalStorageState';
+import { useFiscalYearStorageState } from './utils/useLocalStorageState';
+import { fiscalYearStorageKey } from './utils/fiscalYearDatasetStore';
+import { cloneFiscalYearCollections } from './utils/fiscalYearRollover';
+import { buildFiscalYearOpeningSnapshot } from './utils/fiscalYearClosing';
 import { isPeriodClosed } from './utils/periodGuard';
-import { reindexAccountCodes, ensureEmployeeAdvanceGroup, ensureMonthlyEmployeeAdvancesGroup, employeeAdvanceGeneralAccount, monthlyEmployeeAdvancesAccount, nextJournalNumber, calculateAccountActivity, netAccountBalance, isPostingAccount, accountFinancialType } from './utils/accountingEngine';
+import { reindexAccountCodes, ensureEmployeeAdvanceGroup, ensureMonthlyEmployeeAdvancesGroup, employeeAdvanceGeneralAccount, monthlyEmployeeAdvancesAccount, nextJournalNumber } from './utils/accountingEngine';
 import { CUSTODY_TYPE_LABEL, CUSTODY_STATUS_LABEL } from './utils/custodyEngine';
 import { deriveLegacySubLedgerType } from './utils/subLedger';
 import { validateGeneratedJournalForPosting, validateJournalForPosting, validateOpeningBalancesForPosting, validateVoucherForPosting } from './utils/postingValidation';
@@ -189,9 +192,15 @@ function repairCarriedControlOpenings(
 
 function reportingYearOptions(currentYear = new Date().getFullYear()): string[] {
   const effectiveCurrentYear = Math.max(MIN_REPORTING_YEAR, currentYear);
-  const years: string[] = [];
-  for (let year = MIN_REPORTING_YEAR; year <= effectiveCurrentYear + 1; year += 1) years.push(String(year));
-  return years.sort((a, b) => Number(b) - Number(a));
+  const years = new Set<string>();
+  for (let year = MIN_REPORTING_YEAR; year <= effectiveCurrentYear + 1; year += 1) years.add(String(year));
+  try {
+    getPersistentEntries().forEach(([key]) => {
+      const matched = key.match(/::fiscal-year::(\d{4})$/);
+      if (matched) years.add(matched[1]);
+    });
+  } catch {}
+  return [...years].sort((a, b) => Number(b) - Number(a));
 }
 
 const K = {
@@ -217,6 +226,24 @@ const K = {
   periodStates: 'elite-erp-period-states-v1'
 };
 
+function legacyDatasetYear(fallback: string): string {
+  try {
+    const rows = JSON.parse(getPersistentItem(K.journals) || '[]') as Array<{ date?: string; reference?: string; entryNumber?: string }>;
+    const counts = new Map<string, number>();
+    rows.forEach(row => {
+      if (/^OPEN-\d{4}$/.test(String(row.reference || row.entryNumber || ''))) return;
+      const year = String(row.date || '').slice(0, 4);
+      if (/^\d{4}$/.test(year)) counts.set(year, (counts.get(year) || 0) + 1);
+    });
+    if (counts.size) {
+      const ranked = [...counts].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
+      const tied = ranked.filter(([, count]) => count === ranked[0][1]).map(([year]) => year);
+      return tied.includes(fallback) ? fallback : ranked[0][0];
+    }
+  } catch {}
+  return fallback;
+}
+
 const REMOVED_MODULE_KEYS = [
   'elite-erp-customers-v6', 'elite-erp-vendors-v6', 'elite-erp-employees-v6',
   'elite-erp-invoices-v6', 'elite-erp-contracts-v1',
@@ -297,25 +324,27 @@ function AppInner() {
 
   const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => loadSession());
   const [reportingYear, setReportingYear] = useState<string>(restoredReportingYear);
+  const legacyFiscalYear = useMemo(() => legacyDatasetYear(reportingYear), []);
   const { activeModule, openModule, resetTabs, requestCloseTab } = useTabs();
 
-  const [accounts, setAccounts] = useLocalStorageState<Account[]>(K.accounts, initialAccounts);
-  const [costCenters, setCostCenters] = useLocalStorageState<CostCenter[]>(K.costCenters, initialCostCenters);
-  const [journals, setJournals] = useLocalStorageState<JournalEntry[]>(K.journals, initialJournalEntries);
-  const [auditLogs, setAuditLogs] = useLocalStorageState<AuditLog[]>(K.auditLogs, initialAuditLogs);
-  const [trusts, setTrusts] = useLocalStorageState<Trust[]>(K.trusts, initialTrusts);
-  const [custodies, setCustodies] = useLocalStorageState<Custody[]>(K.custodies, initialCustodies);
-  const [cashBoxes, setCashBoxes] = useLocalStorageState<CashBox[]>(K.cashBoxes, initialCashBoxes);
-  const [bankAccounts, setBankAccounts] = useLocalStorageState<BankAccount[]>(K.bankAccounts, initialBankAccounts);
-  const [vouchers, setVouchers] = useLocalStorageState<PaymentVoucher[]>(K.vouchers, initialPaymentVouchers);
-  const [receiptVouchers, setReceiptVouchers] = useLocalStorageState<ReceiptVoucher[]>(K.receipts, initialReceiptVouchers);
-  const [employees, setEmployees] = useLocalStorageState<Employee[]>(K.employees, initialEmployees);
-  const [customers, setCustomers] = useLocalStorageState<Customer[]>(K.customers, initialCustomers);
-  const [vendors, setVendors] = useLocalStorageState<Vendor[]>(K.vendors, initialVendors);
-  const [currencies, setCurrencies] = useLocalStorageState<Currency[]>(K.currencies, initialCurrencies);
-  const [closedYears, setClosedYears] = useLocalStorageState<string[]>(K.closedYears, []);
-  const [closedMonths, setClosedMonths] = useLocalStorageState<string[]>(K.closedMonths, []);
-  const [periodStates, setPeriodStates] = useLocalStorageState<FinancialPeriodRecord[]>(K.periodStates, []);
+  const annualSeed = <T,>(legacy: T, empty: T) => reportingYear === legacyFiscalYear ? legacy : empty;
+  const [accounts, setAccounts] = useFiscalYearStorageState<Account[]>(K.accounts, reportingYear, annualSeed(initialAccounts, []), legacyFiscalYear);
+  const [costCenters, setCostCenters] = useFiscalYearStorageState<CostCenter[]>(K.costCenters, reportingYear, annualSeed(initialCostCenters, []), legacyFiscalYear);
+  const [journals, setJournals] = useFiscalYearStorageState<JournalEntry[]>(K.journals, reportingYear, annualSeed(initialJournalEntries, []), legacyFiscalYear);
+  const [auditLogs, setAuditLogs] = useFiscalYearStorageState<AuditLog[]>(K.auditLogs, reportingYear, annualSeed(initialAuditLogs, []), legacyFiscalYear);
+  const [trusts, setTrusts] = useFiscalYearStorageState<Trust[]>(K.trusts, reportingYear, annualSeed(initialTrusts, []), legacyFiscalYear);
+  const [custodies, setCustodies] = useFiscalYearStorageState<Custody[]>(K.custodies, reportingYear, annualSeed(initialCustodies, []), legacyFiscalYear);
+  const [cashBoxes, setCashBoxes] = useFiscalYearStorageState<CashBox[]>(K.cashBoxes, reportingYear, annualSeed(initialCashBoxes, []), legacyFiscalYear);
+  const [bankAccounts, setBankAccounts] = useFiscalYearStorageState<BankAccount[]>(K.bankAccounts, reportingYear, annualSeed(initialBankAccounts, []), legacyFiscalYear);
+  const [vouchers, setVouchers] = useFiscalYearStorageState<PaymentVoucher[]>(K.vouchers, reportingYear, annualSeed(initialPaymentVouchers, []), legacyFiscalYear);
+  const [receiptVouchers, setReceiptVouchers] = useFiscalYearStorageState<ReceiptVoucher[]>(K.receipts, reportingYear, annualSeed(initialReceiptVouchers, []), legacyFiscalYear);
+  const [employees, setEmployees] = useFiscalYearStorageState<Employee[]>(K.employees, reportingYear, annualSeed(initialEmployees, []), legacyFiscalYear);
+  const [customers, setCustomers] = useFiscalYearStorageState<Customer[]>(K.customers, reportingYear, annualSeed(initialCustomers, []), legacyFiscalYear);
+  const [vendors, setVendors] = useFiscalYearStorageState<Vendor[]>(K.vendors, reportingYear, annualSeed(initialVendors, []), legacyFiscalYear);
+  const [currencies, setCurrencies] = useFiscalYearStorageState<Currency[]>(K.currencies, reportingYear, annualSeed(initialCurrencies, []), legacyFiscalYear);
+  const [closedYears, setClosedYears] = useFiscalYearStorageState<string[]>(K.closedYears, reportingYear, [], legacyFiscalYear);
+  const [closedMonths, setClosedMonths] = useFiscalYearStorageState<string[]>(K.closedMonths, reportingYear, [], legacyFiscalYear);
+  const [periodStates, setPeriodStates] = useFiscalYearStorageState<FinancialPeriodRecord[]>(K.periodStates, reportingYear, [], legacyFiscalYear);
   const availableReportingYears = useMemo(reportingYearOptions, []);
 
   useEffect(() => {
@@ -332,10 +361,10 @@ function AppInner() {
       return changed ? next : previous;
     });
   }, [closedYears, closedMonths, setPeriodStates]);
-  const [openingBalancesStatus, setOpeningBalancesStatus] = useLocalStorageState<'NONE' | 'DRAFT' | 'POSTED'>(K.openingBalancesStatus, 'NONE');
+  const [openingBalancesStatus, setOpeningBalancesStatus] = useFiscalYearStorageState<'NONE' | 'DRAFT' | 'POSTED'>(K.openingBalancesStatus, reportingYear, 'NONE', legacyFiscalYear);
   // Opening balances are a document in their own right; retain their supporting
   // documents independently from the per-account balance rows.
-  const [openingBalanceAttachments, setOpeningBalanceAttachments] = useLocalStorageState<SupportingDocument[]>(K.openingBalanceAttachments, []);
+  const [openingBalanceAttachments, setOpeningBalanceAttachments] = useFiscalYearStorageState<SupportingDocument[]>(K.openingBalanceAttachments, reportingYear, [], legacyFiscalYear);
 
   const [statementNavParams, setStatementNavParams] = useState<{ kind: string; id: string } | null>(null);
 
@@ -838,9 +867,16 @@ function AppInner() {
     audit: AuditLog
   ): AccountingCommandResult => {
     if (typeof window === 'undefined' || !window.desktopStore) return { ok: true };
-    const changes = [...stateChanges, { key: K.auditLogs, value: [audit, ...auditLogs] }].map(change => ({ key: change.key, value: JSON.stringify(change.value) }));
+    const scoped = (key: string) => key === K.settings ? key : fiscalYearStorageKey(key, reportingYear);
+    const changes = [...stateChanges, { key: K.auditLogs, value: [audit, ...auditLogs] }].map(change => ({ key: scoped(change.key), value: JSON.stringify(change.value) }));
     const expectedVersions = Object.fromEntries(changes.map(change => [change.key, persistentVersion(change.key)]));
-    return commitAccountingCommand({ ...identity, changes, expectedVersions });
+    return commitAccountingCommand({
+      ...identity,
+      idempotencyKey: `${reportingYear}:${identity.idempotencyKey}`,
+      documentNumber: `${reportingYear}:${identity.documentNumber}`,
+      changes,
+      expectedVersions,
+    });
   };
 
   const commitAccountingState = (
@@ -1379,7 +1415,7 @@ function AppInner() {
   };
 
   function reversePostedJournal(original: JournalEntry, reason: string, module: AuditLog['module'], extraStateChanges: Array<{ key: string; value: unknown }> = []): JournalEntry | null {
-    if (original.reference?.startsWith('OPEN-')) {
+    if (original.readOnly || original.entryKind === 'OPENING_AUDIT' || original.reference?.startsWith('OPEN-')) {
       addAuditLog(module, 'VOID', `رُفض عكس القيد الافتتاحي ${original.entryNumber}: القيد سجل تدوير للعرض فقط، ومصدر الرصيد هو الأرصدة الافتتاحية للسنة.`);
       return null;
     }
@@ -1440,43 +1476,26 @@ function AppInner() {
 
   const handleCreateOpeningEntry = (year: string) => {
     const nextYear = String(Number(year) + 1);
+    if (year !== reportingYear) return { ok: false, error: `السنة النشطة ${reportingYear} لا تطابق سنة التدوير ${year}.` };
     const sourcePeriod = periodRecordFor(periodStates, year, 'YEAR');
     if (sourcePeriod.status !== 'FINAL_CLOSED') {
       addAuditLog('GENERAL_LEDGER', 'POST', `رُفض تدوير أرصدة ${year}: الإقفال النهائي مطلوب`);
       return false;
     }
-    if (journals.some(j => j.reference === `OPEN-${nextYear}` && j.status === 'POSTED') || sourcePeriod.openingEntryId) return false;
-    const retained = accounts.find(a => a.code === '2202010001' && a.level === 5) ?? accounts.find(a => a.nameAr.includes('أرباح مبقاة') && a.level === 5);
-    const upToYear = journals.filter(j => j.status === 'POSTED' && yearOf(j.date) <= year);
-    const activity = calculateAccountActivity(accounts, upToYear);
-    const lines: JournalLine[] = [];
-    let totalDebit = 0;
-    let totalCredit = 0;
-    accounts.filter(isPostingAccount).forEach(acc => {
-      const type = accountFinancialType(acc, accounts);
-      if (type === 'REVENUE' || type === 'EXPENSE') return;
-      const net = round2(netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 }));
-      if (Math.abs(net) < 0.005) return;
-      if (net > 0) {
-        lines.push({ id: `op-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: net, credit: 0, description: `رصيد افتتاحي ${acc.nameAr}` });
-        totalDebit += net;
-      } else {
-        lines.push({ id: `op-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: 0, credit: Math.abs(net), description: `رصيد افتتاحي ${acc.nameAr}` });
-        totalCredit += Math.abs(net);
-      }
+    const targetAccountSnapshot = getPersistentItem(fiscalYearStorageKey(K.accounts, nextYear));
+    const targetJournalSnapshot = getPersistentItem(fiscalYearStorageKey(K.journals, nextYear));
+    const targetHasData = [targetAccountSnapshot, targetJournalSnapshot].some(raw => {
+      try { return Array.isArray(JSON.parse(raw || '[]')) && JSON.parse(raw || '[]').length > 0; } catch { return true; }
     });
-    totalDebit = round2(totalDebit);
-    totalCredit = round2(totalCredit);
-    const diff = round2(totalDebit - totalCredit);
-    if (Math.abs(diff) > 0.005 && retained) {
-      if (diff > 0) {
-        lines.push({ id: 'op-retained', accountId: retained.id, accountCode: retained.code, accountNameAr: retained.nameAr, debit: 0, credit: diff, description: `تسوية رصيد افتتاحي` });
-        totalCredit += diff;
-      } else {
-        lines.push({ id: 'op-retained', accountId: retained.id, accountCode: retained.code, accountNameAr: retained.nameAr, debit: Math.abs(diff), credit: 0, description: `تسوية رصيد افتتاحي` });
-        totalDebit += Math.abs(diff);
-      }
-    }
+    if (targetHasData) return { ok: false, error: `السنة المالية ${nextYear} تحتوي بيانات مستقلة بالفعل؛ لم تُستبدل.` };
+    const baseCurrency = currencies.find(c => c.isBase)?.code ?? 'YER';
+    const openingSnapshot = buildFiscalYearOpeningSnapshot({
+      accounts, journals, cashBoxes, bankAccounts, customers, vendors, employees,
+      sourceYear: year, targetYear: nextYear, baseCurrency,
+    });
+    const lines = openingSnapshot.lines;
+    const totalDebit = round2(lines.reduce((sum, line) => sum + (line.debit || 0), 0));
+    const totalCredit = round2(lines.reduce((sum, line) => sum + (line.credit || 0), 0));
     const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
     const entry: JournalEntry = {
       id: `open-${nextYear}-from-${year}`,
@@ -1490,6 +1509,10 @@ function AppInner() {
       currency: currencies.find(c => c.isBase)?.code ?? 'YER',
       exchangeRate: 1,
       status: 'POSTED',
+      fiscalYear: nextYear,
+      entryKind: 'OPENING_AUDIT',
+      affectsLedger: false,
+      readOnly: true,
       createdBy: currentUserName,
       createdAt: now,
       postedBy: currentUserName,
@@ -1500,54 +1523,45 @@ function AppInner() {
       addAuditLog('GENERAL_LEDGER', 'POST', `رُفض القيد الافتتاحي ${nextYear}: ${validation.errors.join(' | ')}`);
       return false;
     }
-    const linkedPeriod = { ...sourcePeriod, openingEntryId: entry.id };
+    const linkedPeriod = { ...sourcePeriod, openingEntryId: `OPEN-${nextYear}` };
     const nextPeriods = [...periodStates.filter(item => !(item.key === year && item.scope === 'YEAR')), linkedPeriod];
     const nextJournals = [entry, ...journals];
     // قيد OPEN-YYYY سجل تدقيق للعرض فقط. مصدر الحقيقة للسنة الجديدة هو
     // سجلات openingBalances المرتبطة بها، كي لا يدخل القيد كحركة بالتقارير.
-    const baseCurrency = currencies.find(c => c.isBase)?.code ?? 'YER';
-    const openingByAccount = new Map(lines.map(line => [line.accountId, line]));
-    const nextAccounts = accounts.map(account => {
-      const carried = openingByAccount.get(account.id);
-      if (!carried) return account;
-      const debit = round2(carried.debit || 0);
-      const credit = round2(carried.credit || 0);
-      const record: OpeningBalanceRecord = {
-        id: `rollover-opening-${nextYear}-${account.id}`,
-        fiscalYear: nextYear,
-        accountId: account.id,
-        currency: baseCurrency,
-        exchangeRate: 1,
-        debit,
-        credit,
-        debitLocal: debit,
-        creditLocal: credit,
-        amount: round2(debit - credit),
-        foreignAmount: round2(debit - credit),
-        rate: 1,
-        documentRef: entry.entryNumber,
-      };
-      const priorYears = (account.openingBalances || []).filter(item => item.fiscalYear !== nextYear);
-      return { ...account, openingBalances: [...priorYears, record] };
-    });
-    // فور التدوير حوّل أرصدة حسابات التحكم إلى الكيانات التحليلية نفسها؛
-    // وبذلك لا يظهر للمستخدم رصيد مجمّع غير قابل للتعديل في السنة الجديدة.
-    const carriedRepair = repairCarriedControlOpenings(nextAccounts, nextJournals, cashBoxes, bankAccounts, customers, vendors, employees);
     const audit = createAuditLog('GENERAL_LEDGER', 'POST', `توليد القيد الافتتاحي للسنة ${nextYear} من إقفال ${year}`);
-    const commit = commitAccountingStateResult({ idempotencyKey: `CARRY_FORWARD:${year}:${nextYear}`, commandType: 'CARRY_FORWARD', documentType: 'YEAR', documentNumber: nextYear }, [
-      { key: K.journals, value: nextJournals }, { key: K.accounts, value: carriedRepair.accounts },
-      { key: K.cashBoxes, value: carriedRepair.cashBoxes }, { key: K.bankAccounts, value: carriedRepair.bankAccounts },
-      { key: K.customers, value: carriedRepair.customers }, { key: K.vendors, value: carriedRepair.vendors },
-      { key: K.employees, value: carriedRepair.employees }, { key: K.periodStates, value: nextPeriods },
-    ], audit);
-    if (!commit.ok) return { ok: false, error: accountingCommandError(commit.error) };
-    setJournals(nextJournals);
-    setAccounts(carriedRepair.accounts);
-    setCashBoxes(carriedRepair.cashBoxes);
-    setBankAccounts(carriedRepair.bankAccounts);
-    setCustomers(carriedRepair.customers);
-    setVendors(carriedRepair.vendors);
-    setEmployees(carriedRepair.employees);
+    const clone = cloneFiscalYearCollections({
+      accounts: openingSnapshot.accounts, costCenters, currencies,
+      cashBoxes: openingSnapshot.cashBoxes, bankAccounts: openingSnapshot.bankAccounts,
+      employees: openingSnapshot.employees, customers: openingSnapshot.customers, vendors: openingSnapshot.vendors,
+      journals: [entry],
+    }, year, nextYear);
+    const target = clone.collections;
+    const changes = [
+      { key: fiscalYearStorageKey(K.accounts, nextYear), value: target.accounts },
+      { key: fiscalYearStorageKey(K.costCenters, nextYear), value: target.costCenters },
+      { key: fiscalYearStorageKey(K.currencies, nextYear), value: target.currencies },
+      { key: fiscalYearStorageKey(K.cashBoxes, nextYear), value: target.cashBoxes },
+      { key: fiscalYearStorageKey(K.bankAccounts, nextYear), value: target.bankAccounts },
+      { key: fiscalYearStorageKey(K.employees, nextYear), value: target.employees },
+      { key: fiscalYearStorageKey(K.customers, nextYear), value: target.customers },
+      { key: fiscalYearStorageKey(K.vendors, nextYear), value: target.vendors },
+      { key: fiscalYearStorageKey(K.journals, nextYear), value: target.journals },
+      { key: fiscalYearStorageKey(K.vouchers, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.receipts, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.trusts, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.custodies, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.closedYears, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.closedMonths, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.periodStates, nextYear), value: [] },
+      { key: fiscalYearStorageKey(K.openingBalancesStatus, nextYear), value: 'POSTED' },
+      { key: fiscalYearStorageKey(K.periodStates, reportingYear), value: nextPeriods },
+      { key: fiscalYearStorageKey(K.auditLogs, reportingYear), value: [audit, ...auditLogs] },
+    ].map(change => ({ key: change.key, value: JSON.stringify(change.value) }));
+    const expectedVersions = Object.fromEntries(changes.map(change => [change.key, persistentVersion(change.key)]));
+    const commit = typeof window !== 'undefined' && window.desktopStore
+      ? commitAccountingCommand({ idempotencyKey: `FISCAL_YEAR_CLONE:${year}:${nextYear}`, commandType: 'FISCAL_YEAR_CLONE', documentType: 'YEAR_DATASET', documentNumber: `${year}->${nextYear}`, changes, expectedVersions })
+      : (() => { changes.forEach(change => window.localStorage.setItem(change.key, change.value)); return { ok: true }; })();
+    if (!commit.ok) return { ok: false, error: accountingCommandError('error' in commit ? String(commit.error || '') : undefined) };
     setPeriodStates(nextPeriods);
     setAuditLogs(prev => [audit, ...prev]);
     return true;
@@ -2330,7 +2344,7 @@ function AppInner() {
       case 'AUDIT_SECURITY':
         return <AuditAndSecurityView auditLogs={auditLogs} />;
       case 'SETTINGS':
-        return <SettingsView currentUserName={currentUserName} currencies={currencies} onPasswordChanged={() => addAuditLog('SETTINGS', 'UPDATE', `تم تغيير كلمة مرور المستخدم: ${currentUserName}`)} />;
+        return <SettingsView currentUserName={currentUserName} currencies={currencies} fiscalYear={reportingYear} onPasswordChanged={() => addAuditLog('SETTINGS', 'UPDATE', `تم تغيير كلمة مرور المستخدم: ${currentUserName}`)} />;
       case 'ABOUT':
         return <AboutUs />;
       default:
@@ -2389,7 +2403,6 @@ function AppInner() {
 }
 
 const round2 = (n: number): number => Math.round(n * 100) / 100;
-const yearOf = (date: string): string => date.slice(0, 4);
 
 export default function App() {
   return (
diff --git a/src/components/modules/ClosingView.tsx b/src/components/modules/ClosingView.tsx
index 9eca9d1..66df085 100644
--- a/src/components/modules/ClosingView.tsx
+++ b/src/components/modules/ClosingView.tsx
@@ -271,7 +271,7 @@ export default function ClosingView({
   const unpostRows: PostRow[] = useMemo(() => {
     const rows: PostRow[] = [];
     journals
-      .filter(j => j.status === 'POSTED' && !j.reversedByEntryId && !j.reversalOfEntryId && (!j.sourceType || j.sourceType === 'MANUAL') && !j.reference?.startsWith('CLOSE-') && !j.reference?.startsWith('OPEN-'))
+      .filter(j => j.status === 'POSTED' && j.affectsLedger !== false && j.entryKind !== 'OPENING_AUDIT' && !j.reversedByEntryId && !j.reversalOfEntryId && (!j.sourceType || j.sourceType === 'MANUAL') && !j.reference?.startsWith('CLOSE-') && !j.reference?.startsWith('OPEN-'))
       .forEach(j => {
         rows.push({ kind: 'JOURNAL', id: j.id, docNo: j.entryNumber, date: j.date, amount: j.totalDebit, narration: j.narration, balanced: true });
       });
diff --git a/src/components/modules/FinancialReportsView.tsx b/src/components/modules/FinancialReportsView.tsx
index 9cf7aef..ca15c84 100644
--- a/src/components/modules/FinancialReportsView.tsx
+++ b/src/components/modules/FinancialReportsView.tsx
@@ -594,7 +594,7 @@ export default function FinancialReportsView({
   // from its own currency statement because its source side was stored as YER.
   const reportingJournals = useMemo(
     () => normalizeVoucherSourceJournalCurrencies(
-      [...journals.filter(journal => journal.status !== 'VOIDED'), ...pendingVoucherJournals].map(journal => ({ ...journal, date: dateToIso(journal.date) })),
+      [...journals.filter(journal => journal.status !== 'VOIDED' && journal.affectsLedger !== false), ...pendingVoucherJournals].map(journal => ({ ...journal, date: dateToIso(journal.date) })),
       [...vouchers, ...receiptVouchers],
       baseCode,
       selectedDecimals,
@@ -614,15 +614,11 @@ export default function FinancialReportsView({
     [fiscalReportingJournals, baseCode, currency, isOriginalCurrencyReport, selectedDecimals]
   );
 
-  const carryForwardJournals = useMemo(
-    () => baseJournals.filter(journal => journal.status === 'POSTED' &&
-      (/^OPEN-\d{4}$/.test(journal.reference || '') || /^OPEN-\d{4}$/.test(journal.entryNumber || '')) &&
-      (journal.reference === `OPEN-${fiscalYear}` || journal.entryNumber === `OPEN-${fiscalYear}`) &&
-      !journal.reversedByEntryId),
-    [baseJournals, fiscalYear]
-  );
-  const carryForwardIds = useMemo(() => new Set(carryForwardJournals.map(journal => journal.id)), [carryForwardJournals]);
-  const reportJournals = useMemo(() => baseJournals.filter(journal => !carryForwardIds.has(journal.id)), [baseJournals, carryForwardIds]);
+  const reportJournals = useMemo(() => baseJournals.filter(journal =>
+    journal.affectsLedger !== false &&
+    journal.entryKind !== 'OPENING_AUDIT' &&
+    !(/^OPEN-\d{4}$/.test(journal.reference || '') || /^OPEN-\d{4}$/.test(journal.entryNumber || ''))
+  ), [baseJournals]);
 
   const journalsInRange = useMemo(() => reportDocuments(reportJournals, fromDate, toDate, true), [reportJournals, fromDate, toDate]);
   // تشمل التقارير القيود والسندات المنتظرة من دون وسم حالة إضافي داخل التقرير.
diff --git a/src/components/modules/JournalEntriesView.tsx b/src/components/modules/JournalEntriesView.tsx
index 6ebc5bf..f2e1987 100644
--- a/src/components/modules/JournalEntriesView.tsx
+++ b/src/components/modules/JournalEntriesView.tsx
@@ -617,7 +617,7 @@ export default function JournalEntriesView({ journals, accounts, cashBoxes, bank
   {selectedEntry.status ==='POSTED' ?'مُرّحل معتمد' : selectedEntry.status ==='PENDING_POSTING' ?'بانتظار الترحيل' :'ملغى'}
   </span>
 
-   {selectedEntry.status === 'PENDING_POSTING' && (
+   {selectedEntry.status === 'PENDING_POSTING' && !selectedEntry.readOnly && selectedEntry.entryKind !== 'OPENING_AUDIT' && (
    <button
    onClick={() => openEditJournal(selectedEntry)}
    className="text-xs text-sky-400 hover:text-sky-300 font-medium hover:underline"
@@ -635,7 +635,7 @@ export default function JournalEntriesView({ journals, accounts, cashBoxes, bank
    <span className="inline-flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> طباعة</span>
    </button>
 
-  {selectedEntry.status ==='POSTED' && !selectedEntry.reference?.startsWith('OPEN-') && (
+  {selectedEntry.status ==='POSTED' && !selectedEntry.readOnly && selectedEntry.entryKind !== 'OPENING_AUDIT' && !selectedEntry.reference?.startsWith('OPEN-') && (
    <button
    onClick={() => { const reason = prompt('سبب إنشاء مستند بديل للقيد؟'); if (!reason?.trim()) return; const replacement = replacementJournal(selectedEntry, { ...selectedEntry, id: `replacement-${Date.now()}`, entryNumber: nextJournalNumber(journals), status: 'PENDING_POSTING', createdAt: new Date().toISOString(), postedAt: undefined, postedBy: undefined, replacementOfEntryId: selectedEntry.id, replacementReason: reason.trim(), attachments: [] }, currentUserName, reason); onAddJournal(replacement); }}
    className="text-xs text-amber-400 hover:text-amber-300 font-medium hover:underline"
@@ -645,7 +645,7 @@ export default function JournalEntriesView({ journals, accounts, cashBoxes, bank
    </button>
    )}
 
-   {selectedEntry.status ==='POSTED' && !selectedEntry.reference?.startsWith('OPEN-') && (
+   {selectedEntry.status ==='POSTED' && !selectedEntry.readOnly && selectedEntry.entryKind !== 'OPENING_AUDIT' && !selectedEntry.reference?.startsWith('OPEN-') && (
    <button
    onClick={() => confirm(`سيبقى القيد ${selectedEntry.entryNumber} مُرحّلاً وسيُنشأ قيد عكسي مرتبط. متابعة؟`) && onVoidJournal(selectedEntry.id)}
    className="text-xs text-red-400 hover:text-red-300 font-medium hover:underline"
@@ -654,7 +654,7 @@ export default function JournalEntriesView({ journals, accounts, cashBoxes, bank
    </button>
    )}
 
-   {selectedEntry.reference?.startsWith('OPEN-') && (
+   {(selectedEntry.readOnly || selectedEntry.entryKind === 'OPENING_AUDIT' || selectedEntry.reference?.startsWith('OPEN-')) && (
      <span className="text-xs font-bold text-slate-400">قيد تدوير للعرض فقط — الرصيد محفوظ في الأرصدة الافتتاحية</span>
    )}
 
diff --git a/src/components/modules/SettingsView.tsx b/src/components/modules/SettingsView.tsx
index 854e88f..e73730a 100644
--- a/src/components/modules/SettingsView.tsx
+++ b/src/components/modules/SettingsView.tsx
@@ -32,7 +32,6 @@ import { useTheme } from '../../utils/useTheme';
 import { Currency, CompanyBranch } from '../../types/erp';
 import ModalShell from '../ui/ModalShell';
 import { COMPANY_BRANCHES_KEY, DEFAULT_COMPANY_BRANCH, loadBranchesLocal, saveBranchesLocal } from '../../utils/companyStore';
-import { dateToIso } from '../../utils/dateInput';
 import {
   clearLegacyPersistentEntries,
   getPersistentEntries,
@@ -84,6 +83,7 @@ type SettingsTab = 'company' | 'financial' | 'security' | 'data' | 'appearance';
 interface Props {
   currentUserName?: string;
   currencies?: Currency[];
+  fiscalYear: string;
   onPasswordChanged?: () => void;
 }
 
@@ -207,7 +207,7 @@ function backupPayloadData(payload: Record<string, unknown>): Record<string, unk
   return payload;
 }
 
-export default function SettingsView({ currentUserName = 'مستخدم', onPasswordChanged }: Props) {
+export default function SettingsView({ currentUserName = 'مستخدم', fiscalYear, onPasswordChanged }: Props) {
   const [settings, setSettings] = useState<SettingsState>(loadSettings);
   const [identity, setIdentity] = useState<IdentityState>(loadIdentity);
   const [saved, setSaved] = useState(false);
@@ -432,40 +432,13 @@ export default function SettingsView({ currentUserName = 'مستخدم', onPassw
     try {
       const safety = window.desktopStore?.createBackup();
       if (safety && !safety.ok) throw new Error(safety.error || 'Safety backup failed');
-      const fiscalYear = loadBranchesLocal()[0]?.fiscalYear || String(new Date().getFullYear());
       const current = getPersistentEntries();
-      const fiscalDateKey: Record<string, string> = {
-        'elite-erp-journals-v6': 'date',
-        'elite-erp-vouchers-v1': 'date',
-        'elite-erp-receiptvouchers-v1': 'date',
-        'elite-erp-trusts-v1': 'date',
-        'elite-erp-custodies-v1': 'requestedDate',
-      };
-      const fiscalStateKeys = new Set([
-        'elite-erp-closed-years-v1',
-        'elite-erp-closed-months-v1',
-        'elite-erp-period-states-v1',
-      ]);
+      const scopeSuffix = `::fiscal-year::${fiscalYear}`;
       const entries = pendingFactoryReset === 'FULL_SYSTEM'
         ? [] as Array<[string, string]>
-        : current.map(([key, raw]) => {
-          const dateField = fiscalDateKey[key];
-          try {
-            const parsed = JSON.parse(raw);
-            if (fiscalStateKeys.has(key) && Array.isArray(parsed)) {
-              const kept = parsed.filter((record: unknown) => {
-                if (key === 'elite-erp-closed-years-v1') return String(record) !== fiscalYear;
-                if (key === 'elite-erp-closed-months-v1') return !String(record).startsWith(`${fiscalYear}-`);
-                return !(record && typeof record === 'object' && String((record as { key?: unknown }).key || '').startsWith(fiscalYear));
-              });
-              return [key, JSON.stringify(kept)] as [string, string];
-            }
-            if (!dateField) return [key, raw] as [string, string];
-            if (!Array.isArray(parsed)) return [key, raw] as [string, string];
-            const kept = parsed.filter((record: Record<string, unknown>) => !dateToIso(String(record[dateField] || '')).startsWith(`${fiscalYear}-`));
-            return [key, JSON.stringify(kept)] as [string, string];
-          } catch { return [key, raw] as [string, string]; }
-        });
+        : current.map(([key, raw]) => key.endsWith(scopeSuffix)
+          ? [key, key.startsWith('elite-erp-opening-balances-status-v1') ? JSON.stringify('NONE') : JSON.stringify([])] as [string, string]
+          : [key, raw] as [string, string]);
       const result = replacePersistentEntries(entries);
       if (!result.ok) throw new Error(result.error || 'Factory reset failed');
       // لا تسمح لنسخة localStorage القديمة بإعادة تعبئة SQLite بعد إعادة التحميل.
@@ -478,7 +451,10 @@ export default function SettingsView({ currentUserName = 'مستخدم', onPassw
         clearLegacyPersistentEntries();
         removeLocalKeys([COMPANY_BRANCHES_KEY, 'theme']);
       } else {
-        removeLocalKeys([...Object.keys(fiscalDateKey), ...fiscalStateKeys]);
+        try {
+          const scopedLocalKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter((key): key is string => Boolean(key?.endsWith(scopeSuffix)));
+          removeLocalKeys(scopedLocalKeys);
+        } catch { /* SQLite remains authoritative */ }
       }
       setPendingFactoryReset(null);
       setFactoryResetStep(1);
@@ -1113,7 +1089,6 @@ export default function SettingsView({ currentUserName = 'مستخدم', onPassw
       )}
 
       {pendingFactoryReset && (() => {
-        const fiscalYear = loadBranchesLocal()[0]?.fiscalYear || new Date().getFullYear();
         const full = pendingFactoryReset === 'FULL_SYSTEM';
         return <ModalShell id="settings-factory-reset" open title={full ? 'تأكيد ضبط مصنع كامل النظام' : 'تأكيد ضبط مصنع للسنة المالية'} icon={Trash2} size="sm" footer={null} onClose={() => setPendingFactoryReset(null)} closeOnBackdrop={false} bodyClassName="p-0">
           <div className="space-y-4 p-6">
@@ -1122,7 +1097,7 @@ export default function SettingsView({ currentUserName = 'مستخدم', onPassw
               <div className="flex justify-end gap-3"><button type="button" onClick={() => setPendingFactoryReset(null)} className="rounded-xl px-4 py-2 text-sm text-slate-400">إلغاء</button><button type="button" onClick={() => setFactoryResetStep(2)} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white">نعم، متابعة</button></div>
             </>}
             {factoryResetStep === 2 && <>
-              <p className="text-sm leading-relaxed text-slate-300">{full ? 'سيتم حذف الحسابات والكيانات والقيود والسندات والعهد والإعدادات وبيانات المنشأة بالكامل.' : `سيتم حذف قيود وسندات وعهد وحالات إقفال السنة المالية ${fiscalYear} فقط، مع إبقاء الدليل والكيانات والإعدادات والأرصدة الافتتاحية.`}</p>
+              <p className="text-sm leading-relaxed text-slate-300">{full ? 'سيتم حذف الحسابات والكيانات والقيود والسندات والعهد والإعدادات وبيانات المنشأة بالكامل.' : `سيتم حذف جميع بيانات السنة المالية ${fiscalYear}، بما فيها الدليل والكيانات والأرصدة والقيود والسندات والعهد، مع إبقاء إعدادات النظام والسنوات الأخرى دون تغيير.`}</p>
               <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">هذه العملية غير قابلة للاستعادة بعد التنفيذ. صدّر نسخة كاملة من قاعدة البيانات قبل المتابعة.</p>
               <div className="flex flex-wrap justify-between gap-2"><button type="button" onClick={handleBackup} className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-400">تصدير كامل لقاعدة البيانات</button><div className="flex gap-3"><button type="button" onClick={() => setFactoryResetStep(1)} className="rounded-xl px-4 py-2 text-sm text-slate-400">رجوع</button><button type="button" onClick={() => setFactoryResetStep(3)} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white">متابعة</button></div></div>
             </>}
diff --git a/src/components/ui/StorageConflictToastBridge.tsx b/src/components/ui/StorageConflictToastBridge.tsx
index a7423dd..9d064fe 100644
--- a/src/components/ui/StorageConflictToastBridge.tsx
+++ b/src/components/ui/StorageConflictToastBridge.tsx
@@ -9,7 +9,12 @@ export default function StorageConflictToastBridge() {
       toast('error', `تم تحديث البيانات من نافذة أخرى، لذلك أُعيد تحميل أحدث نسخة دون الكتابة فوقها${detail?.key ? ` (${detail.key})` : ''}.`);
     };
     window.addEventListener('fullerp:storage-conflict', onConflict);
-    return () => window.removeEventListener('fullerp:storage-conflict', onConflict);
+    const onClosed = () => toast('error', 'السنة المالية مقفلة نهائيًا — البيانات متاحة للاستعراض والتقارير فقط.');
+    window.addEventListener('fullerp:closed-year-write', onClosed);
+    return () => {
+      window.removeEventListener('fullerp:storage-conflict', onConflict);
+      window.removeEventListener('fullerp:closed-year-write', onClosed);
+    };
   }, [toast]);
   return null;
 }
diff --git a/src/types/electron.d.ts b/src/types/electron.d.ts
index ea97b10..eeaaa49 100644
--- a/src/types/electron.d.ts
+++ b/src/types/electron.d.ts
@@ -5,7 +5,7 @@ declare global {
     desktopStore?: {
       getItem(key: string): string | null;
       setItem(key: string, value: string): boolean;
-      setItemVersioned(key: string, value: string, expectedVersion: number): { ok: boolean; version?: number; conflict?: boolean; expectedVersion?: number; actualVersion?: number; error?: string };
+      setItemVersioned(key: string, value: string, expectedVersion: number): { ok: boolean; version?: number; conflict?: boolean; closed?: boolean; expectedVersion?: number; actualVersion?: number; error?: string };
       removeItem(key: string): boolean;
       entries(): Array<[string, string]>;
       replaceEntries(entries: Array<[string, string]>, clearPrefixes?: string[]): {
diff --git a/src/types/erp.ts b/src/types/erp.ts
index b565d76..d7d0e22 100644
--- a/src/types/erp.ts
+++ b/src/types/erp.ts
@@ -58,6 +58,8 @@ export interface OpeningBalanceRecord {
   accountId: string;
   /** معرف الحساب التحليلي (اختياري — للعملاء/الموردين/الموظفين/الصناديق/البنوك) */
   subAccountId?: string;
+  /** Optional carried dimension for cost-center-specific opening balances. */
+  costCenterId?: string;
   /** رمز العملة (YER / USD / SAR) */
   currency: string;
   /** سعر التحويل من العملة الأجنبية إلى المحلية */
@@ -218,6 +220,14 @@ export interface JournalEntry extends ExchangeRateEvidence {
   replacementOfEntryId?: string;
   replacementReason?: string;
   attachments?: SupportingDocument[];
+  /** Fiscal-year ownership for isolated datasets. */
+  fiscalYear?: string;
+  /** OPENING_AUDIT is a read-only rollover trace, not a ledger movement. */
+  entryKind?: 'STANDARD' | 'OPENING_AUDIT';
+  /** False means the journal is visible for audit only and is excluded from balances/reports. */
+  affectsLedger?: boolean;
+  /** Prevents edit, reversal, void, or deletion of system audit journals. */
+  readOnly?: boolean;
 }
 
 export interface AuditLog {
diff --git a/src/utils/accountingEngine.ts b/src/utils/accountingEngine.ts
index 39d696e..146ce07 100644
--- a/src/utils/accountingEngine.ts
+++ b/src/utils/accountingEngine.ts
@@ -711,7 +711,7 @@ export function calculateAccountActivity(accounts: Account[], journals: JournalE
   });
 
   journals
-    .filter(j => includeAllStatuses || j.status === 'POSTED')
+    .filter(j => j.affectsLedger !== false && (includeAllStatuses || j.status === 'POSTED'))
     .forEach(entry => {
       entry.lines.forEach(line => {
         if (!accountBalances[line.accountId]) {
diff --git a/src/utils/fiscalYearClosing.ts b/src/utils/fiscalYearClosing.ts
new file mode 100644
index 0000000..985e47f
--- /dev/null
+++ b/src/utils/fiscalYearClosing.ts
@@ -0,0 +1,177 @@
+import type { Account, BankAccount, CashBox, Customer, Employee, JournalEntry, JournalLine, OpeningBalanceRecord, Vendor } from '../types/erp';
+import { accountFinancialType, isPostingAccount } from './accountingEngine';
+import { reconcileControlAccountOpenings } from '../services/openingBalancesService';
+
+type Entity = (CashBox | BankAccount | Customer | Vendor | Employee) & { linkedAccountId?: string };
+type Input = {
+  accounts: Account[];
+  journals: JournalEntry[];
+  cashBoxes: CashBox[];
+  bankAccounts: BankAccount[];
+  customers: Customer[];
+  vendors: Vendor[];
+  employees: Employee[];
+  sourceYear: string;
+  targetYear: string;
+  baseCurrency: string;
+};
+
+type Bucket = {
+  accountId: string;
+  subLedgerId?: string;
+  costCenterId?: string;
+  currency: string;
+  local: number;
+  foreign: number;
+  lastRate: number;
+};
+
+const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
+const keyOf = (accountId: string, subLedgerId: string | undefined, costCenterId: string | undefined, currency: string) =>
+  [accountId, subLedgerId || '', costCenterId || '', currency].join('\u001f');
+
+function recordAmount(record: OpeningBalanceRecord, baseCurrency: string) {
+  const local = Number(record.debitLocal || 0) - Number(record.creditLocal || 0);
+  const foreignStored = Number(record.debit || 0) - Number(record.credit || 0);
+  const fallback = Number(record.foreignAmount ?? 0);
+  const foreign = record.currency === baseCurrency ? local : (foreignStored || fallback);
+  return { local, foreign, rate: Number(record.rate || record.exchangeRate || 1) };
+}
+
+function lineAmount(line: JournalLine, journal: JournalEntry, baseCurrency: string) {
+  const local = Number(line.debit || 0) - Number(line.credit || 0);
+  const currency = line.currency || journal.currency || baseCurrency;
+  const stored = Number(line.debitForeign || 0) - Number(line.creditForeign || 0);
+  const rate = Number(line.exchangeRate || journal.exchangeRate || 1);
+  const foreign = currency === baseCurrency ? local : (stored || (rate > 0 ? local / rate : 0));
+  return { local, foreign, currency, rate };
+}
+
+/** Produces one independent opening snapshot by account, analytical entity, currency, and cost center. */
+export function buildFiscalYearOpeningSnapshot(input: Input) {
+  const { sourceYear, targetYear, baseCurrency } = input;
+  const allEntities: Entity[] = [...input.cashBoxes, ...input.bankAccounts, ...input.customers, ...input.vendors, ...input.employees];
+  const entitiesByAccount = new Map<string, Entity[]>();
+  allEntities.forEach(entity => {
+    if (!entity.linkedAccountId) return;
+    const list = entitiesByAccount.get(entity.linkedAccountId) || [];
+    list.push(entity);
+    entitiesByAccount.set(entity.linkedAccountId, list);
+  });
+  const buckets = new Map<string, Bucket>();
+  const add = (accountId: string, subLedgerId: string | undefined, costCenterId: string | undefined, currency: string, local: number, foreign: number, rate: number) => {
+    const key = keyOf(accountId, subLedgerId, costCenterId, currency);
+    const bucket = buckets.get(key) || { accountId, subLedgerId, costCenterId, currency, local: 0, foreign: 0, lastRate: rate || 1 };
+    bucket.local += local;
+    bucket.foreign += foreign;
+    if (rate > 0) bucket.lastRate = rate;
+    buckets.set(key, bucket);
+  };
+
+  input.accounts.filter(isPostingAccount).forEach(account => {
+    const entities = entitiesByAccount.get(account.id) || [];
+    const analyticalRows = entities.flatMap(entity => (entity.openingBalances || []).filter(row => row.fiscalYear === sourceYear));
+    const accountRows = (account.openingBalances || []).filter(row => row.fiscalYear === sourceYear || (!row.fiscalYear && sourceYear === input.sourceYear));
+    const rows = entities.length && analyticalRows.length ? [] : accountRows;
+    rows.forEach(record => {
+      const amount = recordAmount(record, baseCurrency);
+      add(account.id, record.subAccountId, record.costCenterId, record.currency || baseCurrency, amount.local, amount.foreign, amount.rate);
+    });
+    if (!account.openingBalances && Math.abs(account.openingBalance || 0) >= 0.005) {
+      const local = Number(account.openingBalance || 0);
+      const currency = account.openingCurrency || account.defaultCurrency || baseCurrency;
+      const rate = Number(account.openingRate || 1);
+      const foreign = currency === baseCurrency ? local : Number(account.openingBalanceForeign || (rate > 0 ? local / rate : 0));
+      add(account.id, undefined, undefined, currency, local, foreign, rate);
+    }
+  });
+  allEntities.forEach(entity => {
+    if (!entity.linkedAccountId) return;
+    const rows = (entity.openingBalances || []).filter(record => record.fiscalYear === sourceYear || (!record.fiscalYear && sourceYear === input.sourceYear));
+    rows.forEach(record => {
+      const amount = recordAmount(record, baseCurrency);
+      add(entity.linkedAccountId!, entity.id, record.costCenterId, record.currency || entity.defaultCurrency || baseCurrency, amount.local, amount.foreign, amount.rate);
+    });
+    if (!entity.openingBalances && Math.abs(entity.openingBalance || 0) >= 0.005) {
+      const local = Number(entity.openingBalance || 0);
+      const currency = entity.openingCurrency || entity.defaultCurrency || baseCurrency;
+      const rate = Number(entity.openingRate || 1);
+      const foreign = currency === baseCurrency ? local : Number(entity.openingBalanceForeign || (rate > 0 ? local / rate : 0));
+      add(entity.linkedAccountId, entity.id, undefined, currency, local, foreign, rate);
+    }
+  });
+  input.journals
+    .filter(journal => journal.status === 'POSTED' && journal.affectsLedger !== false && journal.date.startsWith(`${sourceYear}-`))
+    .forEach(journal => journal.lines.forEach(line => {
+      const amount = lineAmount(line, journal, baseCurrency);
+      add(line.accountId, line.subLedgerId, line.costCenterId, amount.currency, amount.local, amount.foreign, amount.rate);
+    }));
+
+  let records = [...buckets.values()].filter(bucket => Math.abs(bucket.local) >= 0.005 || Math.abs(bucket.foreign) >= 0.005);
+  const accountType = new Map(input.accounts.map(account => [account.id, accountFinancialType(account, input.accounts)]));
+  records = records.filter(record => !['REVENUE', 'EXPENSE'].includes(accountType.get(record.accountId) || ''));
+  const localNet = round(records.reduce((sum, record) => sum + record.local, 0));
+  if (Math.abs(localNet) >= 0.005) {
+    const retained = input.accounts.find(account => account.code === '2202010001' && isPostingAccount(account))
+      || input.accounts.find(account => account.nameAr.includes('أرباح مبقاة') && isPostingAccount(account));
+    if (!retained) throw new Error(`ROLLOVER_UNBALANCED_WITHOUT_RETAINED_ACCOUNT:${localNet}`);
+    records.push({ accountId: retained.id, currency: baseCurrency, local: -localNet, foreign: -localNet, lastRate: 1 });
+  }
+
+  const openings: OpeningBalanceRecord[] = records.map((bucket, index) => {
+    const local = round(bucket.local);
+    const foreign = round(bucket.foreign);
+    const exchangeRate = bucket.currency === baseCurrency ? 1 : Math.abs(foreign) >= 0.005 ? Math.abs(local / foreign) : bucket.lastRate;
+    return {
+      id: `rollover-opening-${targetYear}-${index + 1}`,
+      fiscalYear: targetYear,
+      accountId: bucket.accountId,
+      subAccountId: bucket.subLedgerId,
+      costCenterId: bucket.costCenterId,
+      currency: bucket.currency,
+      exchangeRate,
+      debit: foreign > 0 ? foreign : 0,
+      credit: foreign < 0 ? Math.abs(foreign) : 0,
+      debitLocal: local > 0 ? local : 0,
+      creditLocal: local < 0 ? Math.abs(local) : 0,
+      amount: local,
+      foreignAmount: foreign,
+      rate: exchangeRate,
+      documentRef: `OPEN-${targetYear}`,
+    };
+  });
+  const byEntity = new Map<string, OpeningBalanceRecord[]>();
+  openings.filter(record => record.subAccountId).forEach(record => {
+    const list = byEntity.get(record.subAccountId!) || [];
+    list.push(record);
+    byEntity.set(record.subAccountId!, list);
+  });
+  const updateEntities = <T extends Entity>(items: T[]): T[] => items.map(item => {
+    const entityOpenings = byEntity.get(item.id) || [];
+    const openingBalance = round(entityOpenings.reduce((sum, record) => sum + Number(record.amount || 0), 0));
+    const foreign = entityOpenings.find(record => record.currency !== baseCurrency);
+    return { ...item, openingBalances: entityOpenings, openingBalance, openingBalanceForeign: foreign?.foreignAmount, openingCurrency: foreign?.currency, openingRate: foreign?.rate, fiscalYear: targetYear };
+  });
+  const cashBoxes = updateEntities(input.cashBoxes);
+  const bankAccounts = updateEntities(input.bankAccounts);
+  const customers = updateEntities(input.customers);
+  const vendors = updateEntities(input.vendors);
+  const employees = updateEntities(input.employees);
+  const ownByAccount = new Map<string, OpeningBalanceRecord[]>();
+  openings.filter(record => !record.subAccountId).forEach(record => {
+    const list = ownByAccount.get(record.accountId) || [];
+    list.push(record);
+    ownByAccount.set(record.accountId, list);
+  });
+  let accounts: Account[] = input.accounts.map(account => {
+    const own = ownByAccount.get(account.id) || [];
+    return { ...account, openingBalances: own, openingBalance: round(own.reduce((sum, record) => sum + Number(record.amount || 0), 0)), fiscalYear: targetYear };
+  });
+  accounts = reconcileControlAccountOpenings({ accounts, cashBoxes, bankAccounts, customers, vendors, employees }, targetYear).accounts;
+  const lines: JournalLine[] = input.accounts.filter(isPostingAccount).flatMap(account => {
+    const amount = round(openings.filter(record => record.accountId === account.id).reduce((sum, record) => sum + Number(record.amount || 0), 0));
+    if (Math.abs(amount) < 0.005) return [];
+    return [{ id: `open-line-${targetYear}-${account.id}`, accountId: account.id, accountCode: account.code, accountNameAr: account.nameAr, debit: amount > 0 ? amount : 0, credit: amount < 0 ? Math.abs(amount) : 0, description: `رصيد افتتاحي ${account.nameAr}` }];
+  });
+  return { accounts, cashBoxes, bankAccounts, customers, vendors, employees, openings, lines };
+}
diff --git a/src/utils/fiscalYearDatasetStore.ts b/src/utils/fiscalYearDatasetStore.ts
new file mode 100644
index 0000000..75eda5d
--- /dev/null
+++ b/src/utils/fiscalYearDatasetStore.ts
@@ -0,0 +1,24 @@
+/** Year-scoped storage primitives. Global settings intentionally never use this store. */
+export const fiscalYearStorageKey = (collectionKey: string, fiscalYear: string) => `${collectionKey}::fiscal-year::${fiscalYear}`;
+
+export function recordYear(record: unknown): string | null {
+  if (!record || typeof record !== 'object') return null;
+  const value = record as Record<string, unknown>;
+  const explicit = value.fiscalYear ?? value.fiscal_year;
+  if (/^\d{4}$/.test(String(explicit ?? ''))) return String(explicit);
+  const date = value.date ?? value.voucherDate ?? value.receiptDate ?? value.createdAt;
+  const match = String(date ?? '').match(/^(\d{4})-/);
+  return match?.[1] ?? null;
+}
+
+/** Partition legacy global rows without mutating them; undated rows belong to the supplied legacy year. */
+export function partitionLegacyRows<T>(rows: T[], fiscalYear: string, legacyYear: string): T[] {
+  return rows.filter(row => {
+    const year = recordYear(row);
+    return year ? year === fiscalYear : fiscalYear === legacyYear;
+  });
+}
+
+export function stampFiscalYear<T>(rows: T[], fiscalYear: string): T[] {
+  return rows.map(row => row && typeof row === 'object' ? { ...(row as Record<string, unknown>), fiscalYear } as T : row);
+}
diff --git a/src/utils/fiscalYearRollover.ts b/src/utils/fiscalYearRollover.ts
new file mode 100644
index 0000000..55acd75
--- /dev/null
+++ b/src/utils/fiscalYearRollover.ts
@@ -0,0 +1,26 @@
+const RELATION_KEYS = new Set(['parentId','linkedAccountId','sourceAccountId','sourceEntityId','journalEntryId','reversalJournalEntryId','reversalByEntryId','costCenterId','subLedgerId','accountId','employeeId','customerId','vendorId','cashBoxId','bankAccountId','custodyId','trustId','openingEntryId']);
+
+const cloneNode = (value: unknown, ids: Map<string, string>, sourceYear: string, targetYear: string, key = ''): unknown => {
+  if (Array.isArray(value)) return value.map(item => cloneNode(item, ids, sourceYear, targetYear, key));
+  if (!value || typeof value !== 'object') {
+    if ((key === 'id' || RELATION_KEYS.has(key)) && typeof value === 'string' && ids.has(value)) return ids.get(value);
+    if ((key === 'fiscalYear' || key === 'fiscal_year') && String(value) === sourceYear) return targetYear;
+    if ((key === 'date' || key.endsWith('Date')) && typeof value === 'string') return value.replace(new RegExp(`^${sourceYear}(?=-)`), targetYear);
+    return value;
+  }
+  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, cloneNode(child, ids, sourceYear, targetYear, childKey)]));
+};
+
+export function cloneFiscalYearCollections<T extends Record<string, unknown[]>>(collections: T, sourceYear: string, targetYear: string): { collections: T; idMap: Map<string, string> } {
+  const ids = new Map<string, string>();
+  const collect = (value: unknown, collection: string, counter: { value: number }) => {
+    if (Array.isArray(value)) { value.forEach(item => collect(item, collection, counter)); return; }
+    if (!value || typeof value !== 'object') return;
+    const object = value as Record<string, unknown>;
+    if (typeof object.id === 'string') { counter.value += 1; ids.set(object.id, `${targetYear}-${collection}-${counter.value}-${object.id}`); }
+    Object.values(object).forEach(child => collect(child, collection, counter));
+  };
+  Object.entries(collections).forEach(([name, rows]) => collect(rows, name, { value: 0 }));
+  const cloned = Object.fromEntries(Object.entries(collections).map(([name, rows]) => [name, rows.map(row => ({ ...(cloneNode(row, ids, sourceYear, targetYear) as Record<string, unknown>), fiscalYear: targetYear }))])) as T;
+  return { collections: cloned, idMap: ids };
+}
diff --git a/src/utils/useLocalStorageState.ts b/src/utils/useLocalStorageState.ts
index d51c638..ab4316b 100644
--- a/src/utils/useLocalStorageState.ts
+++ b/src/utils/useLocalStorageState.ts
@@ -58,3 +58,72 @@ export function useLocalStorageState<T>(
 
   return [state, setState];
 }
+
+/**
+ * Same persistence contract, but bound to a fiscal-year namespace. Changing the
+ * selected year reloads that year's authoritative value instead of retaining
+ * the previous year's React state.
+ */
+export function useFiscalYearStorageState<T>(
+  baseKey: string,
+  fiscalYear: string,
+  initialValue: T,
+  legacyYear = fiscalYear
+): [T, Dispatch<SetStateAction<T>>] {
+  const key = `${baseKey}::fiscal-year::${fiscalYear}`;
+  const read = (): T => {
+    try {
+      let stored = window.desktopStore?.getItem(key) ?? localStorage.getItem(key);
+      if ((stored === null || stored === 'null') && fiscalYear === legacyYear) {
+        stored = window.desktopStore?.getItem(baseKey) ?? localStorage.getItem(baseKey);
+        if (stored !== null && stored !== 'null') {
+          if (window.desktopStore) window.desktopStore.setItem(key, stored);
+          else localStorage.setItem(key, stored);
+        }
+      }
+      if (stored !== null && stored !== 'null') return JSON.parse(stored) as T;
+    } catch {}
+    return initialValue;
+  };
+  const [state, setState] = useState<T>(read);
+  const versionRef = useRef<number>(window.desktopStore?.version(key) ?? 0);
+  const loadedKeyRef = useRef(key);
+  const skipWriteRef = useRef(false);
+
+  useEffect(() => {
+    const syncVersion = (event: Event) => {
+      const versions = (event as CustomEvent<Record<string, number>>).detail;
+      if (versions && typeof versions[key] === 'number') versionRef.current = versions[key];
+    };
+    window.addEventListener('fullerp:versions-updated', syncVersion);
+    return () => window.removeEventListener('fullerp:versions-updated', syncVersion);
+  }, [key]);
+
+  useEffect(() => {
+    skipWriteRef.current = true;
+    loadedKeyRef.current = key;
+    versionRef.current = window.desktopStore?.version(key) ?? 0;
+    setState(read());
+  // initialValue is a fallback seed; a year switch is the reload boundary.
+  // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [key]);
+
+  useEffect(() => {
+    if (loadedKeyRef.current !== key) return;
+    if (skipWriteRef.current) { skipWriteRef.current = false; return; }
+    const serialized = JSON.stringify(state);
+    if (window.desktopStore) {
+      const result = window.desktopStore.setItemVersioned(key, serialized, versionRef.current);
+      if (result.ok) versionRef.current = result.version ?? versionRef.current + 1;
+      else {
+        versionRef.current = result.actualVersion ?? window.desktopStore.version(key);
+        const authoritative = window.desktopStore.getItem(key);
+        if (authoritative !== null) setState(JSON.parse(authoritative) as T);
+        window.dispatchEvent(new CustomEvent(result.closed ? 'fullerp:closed-year-write' : 'fullerp:storage-conflict', { detail: { key, error: result.error } }));
+      }
+    } else localStorage.setItem(key, serialized);
+  }, [key, state]);
+
+  const visibleState = loadedKeyRef.current === key ? state : read();
+  return [visibleState, setState];
+}
