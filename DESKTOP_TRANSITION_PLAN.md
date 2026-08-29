# FULLERP Desktop Transition Plan

## Chosen path
Keep the React/Vite renderer unchanged, wrap it with Electron, and persist ERP state through a preload IPC bridge into SQLite. This preserves the current UI/UX and avoids a front-end rewrite.

## Status
- [x] Baseline type-check and web production build captured.
- [x] Electron main window and preload bridge added.
- [x] SQLite database created in Electron user-data (`FULLERP.sqlite`, WAL mode).
- [x] Existing ERP state hook routed to SQLite with browser/localStorage fallback and lazy import.
- [x] Desktop development, build, packaging, and smoke-test commands added.
- [x] Windows unpacked desktop build produced and launched.
- [x] Unified financial-report printing on the “حركة الصندوق” master header/logo/footer shell.
- [x] Statement-of-account printing migrated to the same master shell; conflicting print zones isolated.
- [x] Windows print preview added with explicit A4 portrait/landscape control.
- [x] Remaining direct business settings/company backup calls moved from localStorage to the desktop store.
- [x] Versioned SQLite KV backup/transactional restore UI and migration report added.
- [x] Normalize accounts, journals, and payment/receipt vouchers into relational SQLite projections while preserving the renderer KV contract.
- [x] Fix accountant-reported period calculations, zero-account behavior, date validation, and add accounting regression tests.
- [x] Execute the grouped full-system remediation plan in `SYSTEM_EVALUATION_AND_REMEDIATION_PLAN.md` (P0 and P1 functional release gates complete).
- [x] Add product icon and installer metadata; produce verified installer, portable executable, and unpacked Windows release. Code signing remains dependent on a publisher certificate.

## Full-system remediation groups

- [x] **Task A — Posting integrity and immutable accounting lifecycle (P0)**
  - [x] Central posting validation for journals, payment vouchers, and receipt vouchers.
  - [x] Reject duplicate/retried posting, invalid totals, invalid dates/rates, non-posting accounts, and missing required sub-ledgers.
  - [x] Apply the same command boundary to custody, trust, generated-journal, and opening-balance posting.
  - [x] Block direct edits to posted journals and payment/receipt vouchers.
  - [x] Implement linked reversal commands, block restoration, and remove legacy unpost mutation behavior.
  - [x] Add a guided replacement-document command linked to the original and reversal.
  - [x] Commit journal/voucher/opening state + generated journal + audit event in one SQLite transaction.
  - [x] Add attachments to journals, payment/receipt vouchers, custody settlements, and opening balances.
  - [x] Block final posting until all configurable required supporting documents are attached and verified (validator + regression coverage).
  - [x] Add durable command idempotency receipts, optimistic KV versions, and document-number uniqueness constraints.
- [x] **Task B — Financial periods, closing, and statements (P0)**
  - [x] Implement temporary close, reviewed close, final close, controlled reopening, and approval history.
  - [x] Carry balances forward safely through linked, idempotent closing/opening entries.
  - [x] Add cash-flow and changes-in-equity statements and reconcile all reports against the trial balance.
  - [x] Test every report with accountant scenarios including empty, opening-only, contra, voided, and closed-period cases (regression coverage).
- [x] **Task C — Multi-currency and monetary precision (P0)**
  - [x] Guarantee and display original-currency and local-currency debit/credit on every journal and voucher line.
  - [x] Apply currency-specific decimal precision and historical/average/closing-rate rules.
  - [x] Add realized/unrealized exchange-difference and revaluation entries.
- [x] **Task D — Master data and referential controls (P0/P1)**
  - [x] Prevent deletion of financially referenced accounts/entities/cash boxes/banks/currencies; archive them, and block referenced cost-center deletion.
  - [x] Prevent silent control-account relinking after posted movement with a dated transfer workflow.
  - [x] Add SQLite foreign keys, unique indexes, and reference checks.
  - [x] Add duplicate review and traceable merge tooling for customers, vendors, and employees, including control-account mismatch protection.
- [x] **Task E — SQLite authority, concurrency, network use, and recovery (P0)**
  - [x] Make normalized SQLite repositories authoritative for accounting reads while retaining KV only as compatibility serialization.
  - [x] Prevent multi-window conflicts and duplicate numbering with transactions and optimistic versions.
  - [x] Define and test the supported multi-user/network deployment model, local-disk locking, disconnect recovery, and rotating verified backups.
- [x] **Task F — Authentication, authorization, and immutable audit evidence (P0)**
  - [x] Move users and sessions from embedded credentials/localStorage to protected SQLite records.
  - [x] Make audit events append-only and record before/after values, approvals, reversals, exports, failed posting, and overrides.
  - [x] Enforce permissions inside Electron IPC/domain commands.
- [x] **Task G — UI/UX consistency, accessibility, and maintainability (P1)**
  - [x] Audit and repair the reported financial controls, with inline validation and regression coverage.
  - [x] Complete global F9 and Enter-as-Tab behavior for eligible fields and use configured fiscal dates instead of hard-coded report dates.
  - [x] Scope repeated keyboard shortcuts: F9 targets the focused control, works globally only for one visible target, and stays inactive when multiple unfocused targets share an interface; row-level F2/F3/F4 remain focus-bound.
  - [x] Unify branding through one source; add shared dialog focus trap/restoration, accessible action names, prior-period UI, and reusable contract/data-quality modules.
- [x] **Task H — Automated assurance and operational readiness (P1)**
  - [x] Add the one-command `npm run p1:verify` release gate covering accountant workflows, roles, every requested print-preview/empty-report path, and accounting engines.
  - [x] Add schema-v1/v2/v3 migration fixtures, corrupt-backup rejection, 20,000-journal performance baseline, recovery, auth, audit, and relational SQLite tests.
- [x] **Task I — Contracts, approvals, and due obligations (P1)**
  - [x] Model creation, review, independent approval, rejection, classification, amendment, cancellation, and append-only action history.
  - [x] Generate idempotent obligations/due dates/installments/retention/tax and link settlements to posted payment/receipt vouchers and accounting dimensions.
  - [x] Add contract status, commitments, upcoming/overdue obligations, settlement metrics, supporting-document references, and traceable amendment reporting.

- [x] **Task J — Remove non-opening draft modes and preserve posting controls (P0/P1)**
  - [x] Keep `DRAFT / مسودة` exclusively for opening balances.
  - [x] Replace accounting document pre-posting state with `PENDING_POSTING / بانتظار الترحيل`.
  - [x] Replace contract and custody initial state with `CREATED / جديد`.
  - [x] Migrate legacy persisted journal, payment, receipt, contract, and custody statuses idempotently in SQLite-backed state.
  - [x] Preserve and verify individual/daily batch posting and month/year close guards against pending documents.

## Commands
- Development desktop: `npm run desktop:dev`
- SQLite smoke test: `npm run desktop:smoke`
- Accounting report regression: `npm run accounting:regression`
- Reproducible system evaluation metrics: `npm run system:evaluate`
- Unpacked desktop build: `npm run desktop:build`
- Windows installer/portable: `npm run desktop:package`

## Current checkpoint
P0 and P1 functional remediation gates are complete. The final Windows test release includes the SQLite desktop runtime, duplicate review/merge, contract lifecycle and obligations, unified reporting/printing, scoped shortcuts, authentication/settings fixes, prior-period comparison, the consolidated accounting/migration/recovery/printing/performance gate, and packaged-runtime smoke verification. Installer signing remains dependent on a publisher certificate.
