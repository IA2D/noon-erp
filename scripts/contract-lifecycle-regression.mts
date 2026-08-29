import assert from 'node:assert/strict';
import { approveContract, amendContract, cancelContract, contractMetrics, linkContractVoucher, recordContractReview, submitContract } from '../src/utils/contractLifecycle';
import type { ERPContract } from '../src/types/contracts';

const contract: ERPContract = {
  id: 'c1', contractNumber: 'CON-1', title: 'توريد', partyType: 'VENDOR', partyId: 'v1', partyName: 'مورد', classification: 'PROCUREMENT', status: 'CREATED', currency: 'YER', exchangeRate: 1,
  totalValue: 1000, startDate: '2026-01-01', endDate: '2026-12-31', paymentTerms: 'مرحلتان', retentionRate: 0.1, taxRate: 0.15,
  milestones: [{ id: 'm1', title: 'دفعة أولى', dueDate: '2026-02-01', amount: 600, taxRate: 0.15, retentionRate: 0.1 }, { id: 'm2', title: 'دفعة نهائية', dueDate: '2026-12-01', amount: 400, taxRate: 0.15, retentionRate: 0.1 }],
  obligations: [], attachments: [], actions: [], amendments: [], createdBy: 'maker', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
};
const submitted = submitContract(contract, 'maker'); assert.equal(submitted.ok, true);
assert.equal(approveContract(submitted.contract, 'approver').ok, false);
const reviewed = recordContractReview(submitted.contract, 'reviewer', 'تمت المراجعة'); assert.equal(reviewed.ok, true);
assert.equal(approveContract(reviewed.contract, 'reviewer').ok, false);
const approved = approveContract(reviewed.contract, 'approver'); assert.equal(approved.ok, true); assert.equal(approved.contract.obligations.length, 2);
const replay = approveContract(approved.contract, 'other'); assert.equal(replay.ok, false);
const linked = linkContractVoucher(approved.contract, approved.contract.obligations[0].id, { voucherType: 'PAYMENT', voucherId: 'pv1', voucherNumber: 'PV-1', amount: 300, linkedBy: 'accountant' });
assert.equal(linked.ok, true); assert.equal(linked.contract.obligations[0].status, 'PARTIAL');
const over = linkContractVoucher(linked.contract, linked.contract.obligations[0].id, { voucherType: 'PAYMENT', voucherId: 'pv2', voucherNumber: 'PV-2', amount: 1_000, linkedBy: 'accountant' }); assert.equal(over.ok, false);
assert.equal(cancelContract(linked.contract, 'cfo', 'إلغاء').ok, false);
const amended = amendContract(approved.contract, 'maker', 'تغيير نطاق', 1200); assert.equal(amended.ok, true); assert.equal(amended.contract.amendments[0].revision, 1);
const metrics = contractMetrics([linked.contract], '2026-08-27'); assert.equal(metrics.overdue > 0, true); assert.equal(metrics.outstanding > 0, true);
console.log('CONTRACT_LIFECYCLE_REGRESSION_OK submit=true independentReview=true approve=true obligationsIdempotent=true partialSettlement=true overSettlementBlocked=true amendmentTrace=true cancellationProtected=true metrics=true');
