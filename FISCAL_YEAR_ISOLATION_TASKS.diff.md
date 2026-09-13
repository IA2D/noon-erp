# Fiscal-year isolation implementation tasks

## Phase 0 — Baseline and safety
- [x] Capture current branch and baseline TypeScript build.
- [ ] Export a full SQLite backup and record SHA-256.
- [ ] Create a legacy-data inventory grouped by table and year evidence.

## Phase 1 — Data model
- [ ] Add `fiscal_years` registry with lifecycle/status fields.
- [ ] Add mandatory `fiscal_year_id` to every financial/business table.
- [ ] Keep company identity, users, permissions, UI, and system settings global.
- [ ] Add composite uniqueness for codes and document numbers per year.
- [ ] Add `entry_kind`, `affects_ledger`, and `read_only` to opening audit entries.

## Phase 2 — Repository isolation
- [ ] Introduce one year-scoped repository context for all reads/writes.
- [ ] Remove UI-only year filtering as the source of isolation.
- [ ] Enforce closed-year writes at the service/database boundary.
- [ ] Scope reports, searches, exports, attachments, and audit records.

## Phase 3 — Atomic rollover
- [ ] Implement `BEGIN IMMEDIATE` rollover transaction.
- [ ] Clone year-owned master/input records with new IDs.
- [ ] Remap all internal foreign keys and parent/analytical links.
- [ ] Calculate source closing balances by account, analytical account, currency, and cost center.
- [ ] Insert destination opening balances exactly once.
- [ ] Insert a read-only `OPEN-YYYY` audit journal excluded from ledger/report calculations.
- [ ] Validate debit/credit and source/destination equality before `COMMIT`.
- [ ] Roll back the entire operation on any failure.

## Phase 4 — Existing-data migration
- [ ] Assign the current legacy dataset to its source fiscal year.
- [ ] Rebuild any already-created destination year in a temporary workspace.
- [ ] Compare old-year reports before/after migration byte-for-byte at numeric level.
- [ ] Replace destination data only after reconciliation passes.

## Phase 5 — Verification and release
- [ ] Test year isolation for every CRUD module.
- [ ] Test multi-currency and analytical/control balances.
- [ ] Test closed-year read-only behavior.
- [ ] Test rollback by injecting failures at each transaction stage.
- [ ] Run full regression suite.
- [ ] Build installer and portable artifacts and verify hashes.
