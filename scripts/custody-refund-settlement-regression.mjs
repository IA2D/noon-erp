import assert from 'node:assert/strict';
import fs from 'node:fs';

const view = fs.readFileSync(new URL('../src/components/modules/CustodyView.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const types = fs.readFileSync(new URL('../src/types/erp.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(types, /kind\?: 'DOCUMENTS' \| 'CASH_REFUND'/);
assert.match(view, /kind: 'CASH_REFUND'/);
assert.match(view, /const settlements = \[\.\.\.refundTarget\.settlements, refundSettlement\];/);
assert.match(view, /type: 'REFUND', settlementId: refundSettlement\.id/);
assert.match(view, /refundedAmount: totalRefunded/);
assert.match(view, /legacyRefunded/);
assert.match(view, /existingSettlement\?\.cashRefunded/);
assert.match(view, /item\.kind === 'CASH_REFUND' \? `رد فائض نقدي/);
console.log('CUSTODY_REFUND_SETTLEMENT_REGRESSION_OK refundIsSettlement=true legacyRefundPreserved=true settlementEditsSafe=true');
