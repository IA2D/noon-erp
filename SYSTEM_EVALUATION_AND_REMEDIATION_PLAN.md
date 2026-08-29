# FULLERP — Full System Evaluation and Grouped Remediation Plan

## Evaluation scope

The review covered the React/Electron UI, accounting engines, journals and vouchers, period controls, closing workflows, reports and printing, multi-currency behavior, SQLite persistence, master-data relationships, access control, auditability, keyboard behavior, accessibility, and test coverage.

## Completed during this evaluation

- Corrected period openings so credit balances remain negative and prior posted movement is carried forward as debit-minus-credit.
- Corrected income statements so opening balances never leak into period revenue, expense, or profit.
- Corrected balance-sheet reports to calculate through the selected end date rather than only the selected movement window.
- Corrected “current-period debit/credit” columns so they exclude opening balances.
- Added explicit reversed-date validation and disabled report generation for invalid periods.
- Made zero-balance accounts hidden by default with an explicit “show zero accounts” option.
- Added deterministic regression coverage for posted-only filtering, drafts, signed openings, movements, income, and balance-sheet equality.

## Grouped implementation backlog

## Accountant-note traceability

| Accountant note still requiring work | Assigned task |
|---|---|
| Require supporting documents before final posting | Task A |
| Temporary/final closing, approvals, safe balance carry-forward | Task B |
| Complete report correction and accountant acceptance scenarios | Tasks B and H |
| Original/local currency debit-credit and exchange differences | Task C |
| Prevent deletion or relinking of financially used master records | Task D |
| Multi-user/network operation and disconnect/recovery behavior | Task E |
| Immutable audit log and enforcement of permissions | Task F |
| Repair every non-working field; complete F9, Enter-as-Tab, and date consistency | Tasks G and H |
| Contract approval, classification, obligations, and dues | Task I |

Items already completed—unified printing, Windows preview, corrected report-period calculations, zero-account opt-in, date-range validation, and journal/payment/receipt posting guards—remain recorded in the transition plan and regression suite.

### Task A — Posting integrity and immutable accounting lifecycle (P0)

**Finding:** UI forms validate many entries, but application-level posting handlers can change a draft to `POSTED` without rerunning balance, posting-account, amount, currency, and reference validation. Posted records can also be edited or toggled instead of being corrected by reversal.

- Put journal, payment, receipt, custody, and opening-balance posting behind one domain command service.
- Revalidate debit = credit, nonzero totals, level-5 active accounts, sub-ledger requirements, cost centers, exchange rates, closed periods, and duplicate document numbers at the command boundary.
- Make posted journals immutable; correct them with linked reversal and replacement entries.
- Make voucher + generated journal + audit record one SQLite transaction.
- Add document attachments and enforce configurable attachment requirements before final posting.
- Cover journals, payment/receipt vouchers, custody settlements, and opening balances; record attachment type, hash, uploader, timestamp, and verification status.
- Add database uniqueness for document numbers and idempotency keys for posting commands.

**Acceptance:** invalid or duplicate documents cannot be posted through any screen or direct handler; a failed command leaves voucher, journal, and audit state unchanged.

**Progress:** shared domain validation is active for manual/generated journals, payment/receipt vouchers, custody/trust-generated journals, and opening balances. Posted journals and vouchers are immutable; cancellation creates a separate linked reversal, keeps the original posted, blocks repeat reversal/restoration, and preserves a zero-net ledger result. Journal/voucher/opening posting and voucher reversal use multi-key SQLite transactions containing state, generated journal, and audit evidence. Durable idempotency receipts, command/document uniqueness, optimistic KV versions, and complete rollback on failure have deterministic regression coverage. Supporting-document hashing/status, persisted Settings requirements, final-posting enforcement, attachment pickers across all required workflows, and the guided replacement command are complete. P1 work remains outside this P0 objective.

**Daily-posting correction (27/08/2026):** the daily batch now validates all selected journals/payment/receipt vouchers, creates all generated journals against one accumulated state, and commits journals, vouchers, receipts, and audit evidence in one SQLite transaction. Success counts no longer include rejected documents; the screen keeps failures selected and shows their exact reasons. The legacy default `accountant` login is migrated from the read-only auditor role to `ACCOUNTANT`, while a separate `auditor` login retains read-only enforcement.

### Task B — Financial periods, closing, and statements (P0)

**Finding:** report defaults contain hard-coded 2025–2026 dates; closing supports reopening/mutation but does not model temporary versus final close as an auditable state machine. Cash-flow and retained-earnings statements are not first-class reports.

- Replace hard-coded dates with the active fiscal-year settings and reusable period selectors.
- Implement temporary close, review, final close, controlled reopen, and approval history.
- Generate idempotent closing/opening entries with explicit links and reversal records.
- Add cash-flow and changes-in-equity statements plus prior-period comparisons.
- Cross-foot trial balance → income statement → balance sheet and show explainable reconciliation differences.
- Add report tests for empty periods, opening-only periods, contra balances, range boundaries, voided entries, and closed years.
- Execute accountant-acceptance scenarios against representative real data for every on-screen, exported, and printed report.

**Acceptance:** every statement reconciles from the same posted ledger snapshot and repeated close/open commands cannot duplicate entries.

**Progress:** complete. Temporary, reviewed, and final close states use append-only history, controlled reopening, independent final-reopen approval, and linked idempotent carry-forward entries. Cash-flow/equity reports reconcile deterministically; prior-period comparison is presented from configured fiscal dates; accountant scenario, empty-report, unified-preview, orientation, and print-template regressions run in the P1 gate.

### Task C — Multi-currency and monetary precision (P0)

**Finding:** document lines retain foreign and local amounts, but reporting converts base totals with the currently selected rate. Currency-specific decimal settings exist while much of the system assumes two decimals.

- Introduce a shared Money type using integer minor units or decimal arithmetic.
- Respect each currency’s configured decimal count in input, validation, storage, totals, exports, and print.
- Separate transaction, historical, average, closing, and reporting rates.
- Add realized/unrealized exchange difference workflows and revaluation journals.
- Store the rate source, effective date, override reason, and approver.
- Display and reconcile original-currency and local-currency debit/credit on every journal and voucher line.

**Acceptance:** local totals always reproduce from stored foreign amount × stored rate; report reruns do not change historical amounts when current rates change.

**Progress:** completed. Posting validates the stored original amount × stored transaction rate against the local amount using each currency's configured decimals, rejects excess precision, and persists rate type/effective date/source/override evidence. Foreign-currency reports project stored original debit/credit and opening balances instead of dividing local history by the current master rate. The annual closing workspace can generate reviewed draft journals for both closing-rate unrealized revaluation and realized settlement differences; deterministic tests cover precision, historical invariance, position derivation, and balanced exchange-difference entries.

### Task D — Master data and referential controls (P0/P1)

**Finding:** accounts contain deletion safeguards, while cash-box and bank handlers can physically delete records without a central posted-movement check. Most relationships are still enforced in application code rather than SQLite constraints.

- Use inactive/archived states for any referenced account, entity, box, bank, currency, or cost center.
- Add foreign keys, unique indexes, and reference checks to relational tables.
- Prevent changing control-account links after posted movement without a dated transfer workflow.
- Add duplicate detection and merge tools for customers, vendors, and employees.

**Acceptance:** no master record referenced by financial history can be deleted or silently relinked.

**Progress:** complete. Central removal guards, SQLite constraints, dated control-account transfer, and duplicate review/merge are implemented. Merge candidates show evidence/confidence, differing control accounts are blocked, balances and aliases are consolidated, history is retained, and approved-contract party history is not silently reassigned.

### Task E — SQLite authority, concurrency, network use, and recovery (P0)

**Finding:** relational tables are synchronized projections while renderer KV collections remain the compatibility authority. Multi-window/concurrent updates do not use entity versions.

- Move accounting commands and reads to normalized SQLite repositories; retain KV only as a temporary compatibility cache.
- Add schema migrations, foreign keys, optimistic version columns, and conflict messages.
- Serialize numbering and posting in database transactions.
- Add automatic checkpoint/backup rotation, restore validation, and crash/interruption tests.
- Add data-integrity diagnostics for orphan lines, duplicate references, and projection drift.
- Define the supported multi-user/network deployment model; test locking, concurrent posting, disconnect/reconnect recovery, shared backup ownership, and workstation configuration.

**Acceptance:** two windows cannot create duplicate numbers or overwrite each other, and recovery preserves the last committed accounting transaction.

**Progress:** completed for the supported local-workstation model. Normalized relational reads are authoritative for the accounting collections, while the KV payload remains a compatibility/write-through representation. Versioned writes reject stale windows, accounting commands use immediate transactions and durable idempotency, and startup/shutdown/manual backups are integrity-verified and rotated. A network/UNC database path is rejected; multi-workstation use requires a future authenticated application service rather than direct SQLite file sharing. Diagnostics report foreign-key, orphan, duplicate-number, and posted-balance issues.

**Progress:** the accounting-command IPC now serializes writes with `BEGIN IMMEDIATE`, rejects stale expected versions, persists idempotency receipts, and enforces unique command/document identities. Normalized repositories are still projections, so full repository authority and conflict UX remain.

### Task F — Authentication, authorization, and audit evidence (P0)

**Finding:** default credentials are embedded in client source, session data is stored in browser local storage, and audit logs are mutable application state despite the UI describing them as non-editable.

- Store users in SQLite with salted password hashes and force default-password change.
- Enforce permissions inside Electron IPC/domain commands, not only by hiding UI controls.
- Implement real idle expiry, lockout, password policy, and optional MFA recovery codes.
- Move audit events to append-only relational storage with before/after values and linked document IDs.
- Record approvals, reversals, exports, restore operations, failed posting attempts, and privileged overrides.
- Store audit evidence as append-only SQLite events with actor, role, timestamp, document link, and before/after values.

**Acceptance:** renderer manipulation cannot bypass permissions, and accounting/audit history cannot be edited through normal application APIs.

**Progress:** completed for the desktop P0 boundary. Users, salted password hashes, failed-attempt lockout, idle/absolute session expiry, revocation, and forced default-password change are stored in SQLite. Electron IPC rejects accounting writes from the auditor role. Audit events are appended into a protected SQLite table with update/delete triggers, before/after JSON fields, and coverage for approvals, reversals, exports, failed posting, and overrides through the existing audit pathways. Deterministic authentication and append-only tests pass.

### Task G — UI/UX consistency, accessibility, and maintainability (P1)

**Finding:** branding is inconsistent (`FULLERP`, “نظام نون”, and “النخبة”); several modules exceed 1,000–2,900 lines; keyboard and validation behavior varies by form; icon-only controls have limited accessible names.

- Establish one product/company naming source and one shared design-token/theme layer.
- Split large report, custody, voucher, closing, and app modules into domain hooks, services, tables, dialogs, and print views.
- Standardize form labels, required markers, inline errors, unsaved-change prompts, empty states, loading states, and success feedback.
- Complete F9 lookup and Enter-as-Tab behavior across eligible financial inputs without overriding multiline or submit controls.
- Add accessible names, focus traps, focus restoration, contrast checks, and 100% keyboard workflows.
- Standardize visible dates as `DD/MM/YYYY` while retaining ISO dates in storage.
- Test common desktop resolutions, high DPI, Arabic RTL, English LTR, and long names/numbers.
- Inventory every reported non-working field/control, repair it, and add a regression case before marking it complete.

**Acceptance:** core workflows are keyboard-completable, screen-reader landmarks are meaningful, and common elements are changed from shared components rather than duplicated modules.

**Progress:** complete for the P1 functional gate. Branding is centralized, financial dates come from configured fiscal periods, global F9/Enter-as-Tab behavior excludes multiline/submit controls, modal focus is trapped/restored, actions have accessible names, and contract/data-quality logic is separated into reusable services and views. Prior-period comparison and shared report/preview components are active.

### Task H — Automated assurance and operational readiness (P1)

**Finding:** deterministic smoke tests now cover SQLite, relational projections, print templates, and core report math, but broad workflow, accessibility, and failure-recovery coverage is still missing.

- Add unit tests for every accounting engine and period/rounding rule.
- Add integration tests for every posting/reversal/close/restore transaction.
- Add end-to-end desktop tests for accountant workflows and role permissions.
- Add golden print/PDF checks for every report and page-break edge case.
- Add migration fixtures from each released schema and corrupted-backup rejection tests.
- Add performance baselines for large ledgers and long reports.

**Acceptance:** the complete suite runs from one command and blocks a release on accounting, migration, printing, accessibility, or integrity regression.

**Progress:** complete. `npm run p1:verify` runs TypeScript, accounting-engine rules, contract/merge workflows, UI/accessibility checks, posting/reversal/period/currency/control-transfer transactions, schema fixtures, corrupt recovery, roles/audit, relational SQLite, large-ledger performance, unified portrait preview, empty reports, print shell, and production build.

### Task I — Contracts, approvals, and due obligations (P1; workflow confirmation required)

**Finding:** the accountant notes refer to contract approval, classification, and transferring approved obligations to amounts due, while the current accounting scope has no complete contract lifecycle.

- Model contract draft, review, approval, rejection, classification, amendment, cancellation, and audit history.
- Store contract parties, value, currency, dates, milestones, installments, retention, taxes, guarantees, and supporting documents.
- Generate controlled payable/receivable obligations and due dates from an approved contract without duplicating accounting entries.
- Link approved obligations to payment/receipt vouchers, cost centers, projects, vendors/customers, and the general ledger.
- Add contract status, outstanding commitments, upcoming dues, overdue amounts, amendments, and settlement reports.
- Confirm the detailed workflow and terminology with the accountant before implementation.

**Acceptance:** only approved contracts create controlled obligations; amendments remain traceable; paid, outstanding, retained, and overdue amounts reconcile to vouchers and the general ledger.

**Progress:** complete. A Contracts workspace persists lifecycle/action history, requires independent review before approval, generates obligations once, protects approved history during entity merge, links posted voucher settlements without over-settlement, and reports commitments/upcoming/overdue/paid/retained totals.

## Deferred final release

Product icon, installer metadata, production code signing, and the final Windows release remain deliberately deferred until Tasks A–I reach their release gates.
