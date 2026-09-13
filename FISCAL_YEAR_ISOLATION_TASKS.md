# Fiscal-year isolation implementation tasks

## Phase 0 — Baseline and safety
- [x] Capture current branch and baseline TypeScript build.
- [ ] Export a full SQLite backup and record SHA-256.
- [ ] Create a legacy-data inventory grouped by table and year evidence.

## Phase 1 — Data model
- [x] Add `fiscal_years` registry with lifecycle/status fields.
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

### Progress 2026-09-13
- [x] Added rp_record_years mapping registry and automatic fiscal-year inference during relational projection (schema v4).
- [ ] Next: make repository queries and writes require the selected fiscal-year context.

- [x] Verify record-year mapping with relational SQLite smoke test.

- [x] Add shared fiscal-year normalization, record-year inference, and atomic transaction primitive.

- [x] Implement reusable year-dataset graph cloning with new IDs, FK remapping, date shifting, and clone validation.

- [x] Add renderer-side year-scoped dataset key, legacy partitioning, and fiscal-year stamping primitives.

- [x] Add React persistence hook that reloads and writes an authoritative fiscal-year namespace when the selected year changes.

### App integration
- [x] Bind all financial/master collections in App.tsx to the selected fiscal-year namespace; settings remain global.
- [x] Scope accounting command identity and document uniqueness by fiscal year.
- [x] Write rollover destination masters/openings/OPEN audit entry to new-year keys atomically without mutating source-year React state.
- [ ] Normalize scoped collections into year-aware relational tables.
