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

- [x] **Task K — System-wide report, date, and approval repair (P0/P1)**
  - [x] Route preview, print, PDF download, and PDF sharing through one A4 portrait renderer based on the `حركة الصندوق` master scheme.
  - [x] Reserve the physical page footer margin and render real page numbers at the bottom of every page without creating a footer-only page.
  - [x] Remove duplicate reference/source-document/currency columns, enlarge the report logo, and fit long values and headings inside their cells.
  - [x] Keep empty reports printable and verify all 16 report paths with actual Chromium-generated PDFs.
  - [x] Repair cost-center, journal, cash, bank, customer, supplier, employee, trust, and custody report data sources, including pending operational documents and posted-only financial statements.
  - [x] Bind cash/bank helper selectors to configured cash boxes and bank accounts rather than the chart of accounts.
  - [x] Standardize editable dates on `DD/MM/YYYY`, preserve calendar selection, accept full keyboard entry, and persist ISO dates internally.
  - [x] Reduce custody approval to one stage, migrate legacy pending approvals, remove custody guidance/notes, and preserve the approval audit trail.
  - [x] Simplify payment-voucher captions to `سعر الصرف` and `المبلغ المحلي`.
  - [x] Verify the changed system through 20 non-build suites plus browser UI, keyboard-date, and actual PDF evidence.

- [x] **Task L — Simplify chart-of-accounts maintenance (P1)**
  - [x] Remove instructional notes from account, cash-box, bank/exchange, customer, supplier, and employee add/edit forms.
  - [x] Remove account-currency management and sub-ledger-type input from the chart-of-accounts form; assign the base currency automatically and retain existing account currency metadata.
  - [x] Keep sub-ledger selection in transaction/master-data workflows and verify that linked customers, suppliers, employees, cash boxes, and banks still derive their sub-ledger type.
  - [x] Rename the shipped level-five accounts to `الصندوق العام`, `البنوك`, `الصرافات`, and `رأس المال`.
  - [x] Migrate only the known shipped legacy names in persisted data while preserving user-customized names.

- [x] **Task M — Currency, tables, opening balances, and operational UI repair (P1)**
  - [x] Keep only `YER`, `SAR`, and `USD` in the default currency directory and migrate legacy `GBP` master-data references out safely.
  - [x] Make every interactive table collapse control a direct, full-hit-area single-click action at the visual top-right of its header, including React-replaced table sections, with a minimum `0.5rem` inset on all four sides.
  - [x] Restore readable light-theme contrast for the chart-of-accounts currency inclusion/toggle controls while preserving their dark-theme colors.
  - [x] Restore inline account currency inclusion/toggling while keeping the removed account-level sub-ledger selector and separate currency-manager button absent.
  - [x] Load saved opening balances into the same primary editable entry table—without a modal or second table—while retaining autosave and incomplete-row decisions.
  - [x] Keep report values at the largest measured font that fits, reserve wider opening-balance columns for financial totals, and prevent mixed Arabic labels and LTR amounts from overlapping.
  - [x] Measure mixed-direction report pairs from their intrinsic child glyph widths and retain a two-pixel PDF rounding reserve, balancing readable sizing against edge clipping.
  - [x] Force printed report headings and values onto one line and shrink measured font size rather than wrapping cells.
  - [x] Measure left/right glyph overflow in addition to scroll width and isolate mixed RTL labels/LTR amounts so summary values remain inside their printed cells.
  - [x] Remove the data-quality/duplicate-merge section from permissions, navigation, and module rendering.
  - [x] Prevent Enter navigation across derived read-only journal amounts from writing zero to the debit/credit source field.
  - [x] Reflow the custody register to a 1540px fixed layout with isolated, generously sized columns, controlled horizontal overflow, non-wrapping values, and `DD/MM/YYYY` dates.

## Commands
- Development desktop: `npm run desktop:dev`
- SQLite smoke test: `npm run desktop:smoke`
- Accounting report regression: `npm run accounting:regression`
- Reproducible system evaluation metrics: `npm run system:evaluate`
- Unpacked desktop build: `npm run desktop:build`
- Windows installer/portable: `npm run desktop:package`

## Current checkpoint
Tasks A–M are complete. The source now includes the repaired report data paths, shared portrait print/PDF pipeline, bottom-of-page repeatable footers, keyboard-friendly dates, one-stage custody approval, simplified account maintenance, reliable top-right full-hit-area table collapsing, saved opening balances loaded into the primary editable grid, measured print-cell fitting, and the repaired custody/journal workflows. The current patches passed their non-build regression suites. Per the current workflow, no new installer was built; Windows packaging/signing remains a later release step.
