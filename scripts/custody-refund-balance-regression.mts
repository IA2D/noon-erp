import assert from 'node:assert/strict';
import { outstandingBalance, statusAfterSettlement } from '../src/utils/custodyEngine';
import type { Custody } from '../src/types/erp';

const custody = {
  id: 'c-1', custodyNumber: 'CST-1', amount: 100, disbursedAmount: 100,
  settledAmount: 90, refundedAmount: 10, apTransferredAmount: 0,
  status: 'FULL_SETTLED', settlements: [], transactions: [], type: 'TEMPORARY',
} as unknown as Custody;
// رد 10 هو تسوية، لذا تعديل المستندات من 90 إلى 80 يعيد رصيداً قائماً قدره 10.
const edited = { ...custody, settledAmount: 80, refundedAmount: 10 };
assert.equal(outstandingBalance(edited), 10);
assert.equal(statusAfterSettlement(edited, 0), 'PARTIAL_SETTLED');
// إزالة تصفية رد الفائض تعيد نفس مبلغ الرد إلى الرصيد القائم.
const afterRefundDelete = { ...custody, refundedAmount: 0 };
assert.equal(outstandingBalance(afterRefundDelete), 10);
assert.equal(statusAfterSettlement(afterRefundDelete, 0), 'PARTIAL_SETTLED');
console.log('CUSTODY_REFUND_BALANCE_REGRESSION_OK editRestoresBalance=10 deleteRefundRestoresBalance=10');
