import type {Account, Custody, CustodyApproval, CustodyStatus, CustodyType, Employee} from '../types/erp';

export const CUSTODY_TYPE_LABEL: Record<CustodyType, string> = {
  TEMPORARY: 'عهدة مؤقتة',
  PETTY_CASH: 'عهدة مستديمة (مصاريف نثرية)',
  ASSET: 'عهدة عينية',
};

export const CUSTODY_TYPE_SHORT: Record<CustodyType, string> = {
  TEMPORARY: 'مؤقتة',
  PETTY_CASH: 'نثرية',
  ASSET: 'عينية',
};

export const CUSTODY_STATUS_LABEL: Record<CustodyStatus, string> = {
  CREATED: 'جديدة',
  PENDING_APPROVAL: 'قيد المراجعة',
  APPROVED: 'معتمدة',
  DISBURSED: 'مصروفة',
  PARTIAL_SETTLED: 'مصفاة جزئياً',
  FULL_SETTLED: 'مصفاة كلياً',
  CLOSED: 'مغلقة',
  VOIDED: 'ملغاة',
};

export const OPEN_STATUSES: CustodyStatus[] = ['DISBURSED', 'PARTIAL_SETTLED'];

export const SETTLEMENT_PENDING_STATUSES: CustodyStatus[] = ['DISBURSED', 'PARTIAL_SETTLED', 'FULL_SETTLED'];

export const TRANSITIONS: Record<CustodyStatus, CustodyStatus[]> = {
  CREATED: ['PENDING_APPROVAL', 'VOIDED'],
  PENDING_APPROVAL: ['APPROVED', 'CREATED', 'VOIDED'],
  APPROVED: ['DISBURSED', 'VOIDED'],
  DISBURSED: ['PARTIAL_SETTLED', 'FULL_SETTLED', 'VOIDED'],
  PARTIAL_SETTLED: ['FULL_SETTLED', 'VOIDED'],
  FULL_SETTLED: ['CLOSED'],
  CLOSED: [],
  VOIDED: [],
};

export interface ApprovalLevelInfo {
  level: number;
  roleName: string;
}

export const APPROVAL_LEVEL_ROLES: ApprovalLevelInfo[] = [
  {level: 1, roleName: 'المعتمد المسؤول'},
];

/** One explicit approval for every amount; historical approval entries remain auditable. */
export function requiredApprovalLevel(_amount: number, _employee?: Employee): number { return 1; }

export function canTransition(from: CustodyStatus, to: CustodyStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function canSubmit(c: Custody): boolean {
  return canTransition(c.status, 'PENDING_APPROVAL');
}

export function canApprove(c: Custody, requiredLevel: number): boolean {
  if (c.status !== 'PENDING_APPROVAL') return false;
  return requiredLevel === 1;
}

export function canDisburse(c: Custody): boolean {
  return canTransition(c.status, 'DISBURSED') && c.disbursedAmount <= 0;
}

export function canReplenish(c: Custody): boolean {
  return c.type === 'PETTY_CASH' && (c.status === 'DISBURSED' || c.status === 'PARTIAL_SETTLED');
}

export function canReplenishLow(c: Custody): boolean {
  if (!canReplenish(c)) return false;
  const cap = c.maxBalance ?? c.amount;
  return outstandingBalance(c) < cap - 0.005;
}

export function canSettle(c: Custody): boolean {
  return (c.status === 'DISBURSED' || c.status === 'PARTIAL_SETTLED') && c.disbursedAmount > 0;
}

export function canClose(c: Custody): boolean {
  return c.status === 'FULL_SETTLED' && c.disbursedAmount > 0;
}

export function canVoid(c: Custody): boolean {
  return c.status !== 'VOIDED' && c.status !== 'CLOSED' && c.status !== 'FULL_SETTLED';
}

export function custodyPrincipal(c: Custody): number {
  return Math.max(c.amount, c.disbursedAmount);
}

export function outstandingBalance(c: Custody): number {
  return Math.max(0, Math.round((custodyPrincipal(c) - c.settledAmount - c.refundedAmount - c.apTransferredAmount) * 100) / 100);
}

export function expectedCashReturn(c: Custody, expenseTotal: number): number {
  return Math.max(0, Math.round((custodyPrincipal(c) - c.settledAmount - c.apTransferredAmount - expenseTotal) * 100) / 100);
}

export function isOverdue(c: Custody): boolean {
  if (!SETTLEMENT_PENDING_STATUSES.includes(c.status)) return false;
  if (!c.expectedClearanceDate) return false;
  const due = new Date(c.expectedClearanceDate + 'T00:00:00');
  return due.getTime() < Date.now();
}

export function overdueDays(c: Custody): number {
  if (!isOverdue(c) || !c.expectedClearanceDate) return 0;
  const due = new Date(c.expectedClearanceDate + 'T00:00:00');
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000));
}

export type AgingBucket = 'CURRENT' | '0-30' | '31-60' | '61-90' | '90+';

export function agingBucketOf(days: number): AgingBucket {
  if (days <= 0) return 'CURRENT';
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export interface CustodyValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateNewCustody(
  type: CustodyType,
  title: string,
  employee: Employee | undefined,
  amount: number,
  expectedClearanceDate: string,
  maxBalance: number,
  assetDescription: string,
  account: Account | undefined
): CustodyValidationResult {
  const errors: string[] = [];
  if (!title.trim()) errors.push('يرجى إدخال غرض/وصف العهدة.');
  if (!employee) errors.push('يرجى اختيار الموظف المكلف (الأستاذ المساعد إلزامي).');
  if (amount <= 0) errors.push('يرجى إدخال مبلغ العهدة (أكبر من صفر).');

  if (type === 'TEMPORARY') {
    if (!expectedClearanceDate) errors.push('العهدة المؤقتة تتطلب تاريخ انقضاء — تصفية إجبارية عند الاستحقاق.');
  }
  if (type === 'PETTY_CASH') {
    if (maxBalance <= 0) errors.push('العهدة المستديمة تتطلب سقفاً مالياً (Maximum Balance) أكبر من صفر.');
    if (amount > maxBalance) errors.push('قيمة العهدة تتجاوز السقف المالي المسموح.');
  }
  if (type === 'ASSET') {
    if (!assetDescription.trim()) errors.push('العهدة العينية تتطلب وصفاً للعين المسندة (لا توجد أصناف أصول مسجلة).');
  }
  if (employee && account) {
    if (account.subLedgerType !== 'NONE' && account.subLedgerType !== 'EMPLOYEE') {
      errors.push(`حساب سلف الموظفين المرتبط (${account.code}) من نوع ${account.subLedgerType} — يجب أن يكون حساباً خالصاً بلا أستاذ مساعد حاكم.`);
    }
  }
  return {isValid: errors.length === 0, errors};
}

export function findOverdueViolation(employeeId: string, custodies: Custody[]): Custody | null {
  return (
    custodies.find(
      c =>
        c.employeeId === employeeId &&
        c.type === 'TEMPORARY' &&
        SETTLEMENT_PENDING_STATUSES.includes(c.status) &&
        isOverdue(c)
    ) || null
  );
}

export function listOverdueCustodies(custodies: Custody[]): Custody[] {
  return custodies
    .filter(c => isOverdue(c) && c.status !== 'VOIDED')
    .sort((a, b) => {
      const ad = overdueDays(a);
      const bd = overdueDays(b);
      if (bd !== ad) return bd - ad;
      return (a.expectedClearanceDate || '').localeCompare(b.expectedClearanceDate || '');
    });
}

export function transition(c: Custody, to: CustodyStatus): string | null {
  if (!canTransition(c.status, to)) {
    return `لا يمكن الانتقال من «${CUSTODY_STATUS_LABEL[c.status]}» إلى «${CUSTODY_STATUS_LABEL[to]}».`;
  }
  return null;
}

export function statusAfterSettlement(c: Custody, newExpenseTotal: number): CustodyStatus {
  const remaining = Math.max(
    0,
    Math.round((custodyPrincipal(c) - c.settledAmount - c.apTransferredAmount - c.refundedAmount - newExpenseTotal) * 100) / 100
  );
  return remaining <= 0.01 ? 'FULL_SETTLED' : 'PARTIAL_SETTLED';
}

export function approvalsComplete(approvals: CustodyApproval[], requiredLevel: number): boolean {
  const approved = approvals.filter(a => a.action === 'APPROVED').length;
  return approved >= requiredLevel;
}

export const today = (): string => new Date().toISOString().split('T')[0];
export const nowStamp = (): string => new Date().toISOString().replace('T', ' ').substring(0, 16);
