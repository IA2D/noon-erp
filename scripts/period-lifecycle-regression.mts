import assert from 'node:assert/strict';
import { isDateClosedByRecords, newPeriodRecord, nextCloseStatus, transitionFinancialPeriod } from '../src/utils/periodLifecycle';

const open = newPeriodRecord('2026', 'YEAR');
assert.equal(nextCloseStatus(open.status), 'TEMP_CLOSED');
const temporary = transitionFinancialPeriod(open, { target: 'TEMP_CLOSED', actor: 'accountant', reason: 'month reconciliation complete', at: '2026-12-20T00:00:00Z' });
assert.equal(temporary.valid, true);
assert.equal(temporary.record.version, 1);
assert.equal(isDateClosedByRecords('2026-12-25', [temporary.record]), true);
assert.equal(transitionFinancialPeriod(temporary.record, { target: 'TEMP_CLOSED', actor: 'accountant', reason: 'retry' }).replay, true);
assert.equal(transitionFinancialPeriod(temporary.record, { target: 'FINAL_CLOSED', actor: 'accountant', reason: 'skip review' }).valid, false);
const reviewed = transitionFinancialPeriod(temporary.record, { target: 'REVIEWED', actor: 'reviewer', reason: 'trial balance approved', at: '2026-12-24T00:00:00Z' });
assert.equal(reviewed.valid, true);
const final = transitionFinancialPeriod(reviewed.record, { target: 'FINAL_CLOSED', actor: 'manager', reason: 'board approval', closingEntryId: 'close-2026', at: '2026-12-31T00:00:00Z' });
assert.equal(final.valid, true);
assert.equal(final.record.closingEntryId, 'close-2026');
assert.equal(final.record.history.length, 3);
assert.equal(transitionFinancialPeriod(final.record, { target: 'OPEN', actor: 'manager', reason: 'correction' }).valid, false);
assert.equal(transitionFinancialPeriod(final.record, { target: 'OPEN', actor: 'manager', reason: 'correction', approvedBy: 'manager' }).valid, false);
const reopened = transitionFinancialPeriod(final.record, { target: 'OPEN', actor: 'manager', reason: 'approved correction', approvedBy: 'controller', at: '2027-01-05T00:00:00Z' });
assert.equal(reopened.valid, true);
assert.equal(reopened.record.status, 'OPEN');
assert.equal(reopened.record.history.length, 4);
assert.equal(isDateClosedByRecords('2026-12-25', [reopened.record]), false);

console.log('PERIOD_LIFECYCLE_REGRESSION_OK temporary=true reviewed=true final=true skippedStageBlocked=true idempotentReplay=true finalReopenApprovalRequired=true independentApproverRequired=true historyAppendOnly=true closingEntryLinked=true reopened=true');
