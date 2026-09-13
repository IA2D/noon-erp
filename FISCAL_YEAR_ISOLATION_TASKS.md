# Fiscal-year isolation implementation tasks

## Phase 0 — Baseline and safety
- [x] Capture the baseline commit and TypeScript build.
- [x] Export an online SQLite backup and record SHA-256 plus `PRAGMA integrity_check`.
- [x] Inventory legacy tables, scoped keys, and year evidence.

## Phase 1 — Data model
- [x] Add the fiscal-year registry and record/year ownership registry (schema v4).
- [x] Store every annual collection in an isolated `::fiscal-year::YYYY` namespace and normalized fiscal-record projection.
- [x] Keep settings, company identity, users, permissions, and UI preferences global.
- [x] Scope record identity, document command identity, and uniqueness by year.
- [x] Add `fiscalYear`, `entryKind`, `affectsLedger`, and `readOnly` to rollover audit journals.

## Phase 2 — Repository isolation
- [x] Bind all annual React persistence to the selected fiscal-year context.
- [x] Bind SQLite read/write/projection to the same fiscal-year namespace.
- [x] Enforce final-closed-year write rejection at the SQLite command boundary; allow an authorized reopen transition.
- [x] Scope reports, searches, exports, attachments, audit logs, masters, operations, and opening-balance state.
- [x] Discover all persisted fiscal years in the login/reporting selector.

## Phase 3 — Atomic rollover
- [x] Execute rollover under one `BEGIN IMMEDIATE` accounting command.
- [x] Clone year-owned inputs/masters with new IDs.
- [x] Remap internal parent, analytical, cost-center, account, entity, and journal relationships.
- [x] Calculate closing/opening balances by account, analytical account, currency, and cost center.
- [x] Insert destination opening balances exactly once.
- [x] Insert `OPEN-YYYY` as a read-only audit journal with `affectsLedger=false`.
- [x] Validate balance and target graph before `COMMIT`.
- [x] Roll back every target write on conflict or broken relationship.
- [x] Leave a new year without rollover empty and zeroed.

## Phase 4 — Existing-data migration
- [x] Detect the dominant source year without choosing a stray historical date or generated OPEN journal.
- [x] Partition legacy source and already-created destination-year records into independent namespaces.
- [x] Clone destination IDs and remap their relationships.
- [x] Preserve original legacy keys and shared settings byte-for-byte.
- [x] Verify the real database copy: source 2026 trial-balance numeric output is identical before/after migration.
- [x] Validate every migrated year graph inside the migration transaction.

## Phase 5 — Verification and release
- [x] Test namespace isolation, ID independence, relationship remapping, and stale-write conflicts.
- [x] Test analytical, multi-currency, and cost-center carry-forward.
- [x] Test closed-year database rejection and reopen exception.
- [x] Test conflict and invalid-graph rollback.
- [x] Run the full P1 regression/build gate.
- [x] Run targeted financial report, opening-balance, statement, balance-sheet, and login-year tests.
- [x] Build fresh NSIS installer and portable executables.
- [x] Run the packaged smoke probe against unpacked and portable editions.
- [x] Verify artifact timestamps, sizes, SHA-256 hashes, and packed source hash.
- [x] Test `ROLLBACK.sh` on a separate detached worktree and match the exact baseline tree.

## Final state
- Source/base commit: `a6fff06e5562a51d7622c9d6662ec3f4a2f8e529`.
- Product-code commit packed in release: `dcc50ae7b78fd19db5083fffb8e30d4350f76be2`.
- Release folder: `D:\Dev env\@commando\FULLERP\release-20260913-160651-fiscal-year-isolation-dcc50ae7`.

