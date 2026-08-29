import type { Account, ControlAccountTransferRecord, JournalEntry, SubLedgerType } from '../types/erp';
import { isPostingAccount, nextJournalNumber } from './accountingEngine';
import { roundTo } from './money';

export type ControlEntityKind = 'CASH_BOX' | 'BANK' | 'EMPLOYEE' | 'CUSTOMER' | 'VENDOR';

const subLedgerTypeByKind: Record<ControlEntityKind, SubLedgerType> = {
  CASH_BOX: 'CASH_BOX', BANK: 'BANK', EMPLOYEE: 'EMPLOYEE', CUSTOMER: 'CUSTOMER', VENDOR: 'SUPPLIER',
};

export function hasPostedEntityMovement(journals: JournalEntry[], entityId: string, linkedAccountId: string): boolean {
  return journals.some(entry => entry.status === 'POSTED' && entry.lines.some(line => line.accountId === linkedAccountId && line.subLedgerId === entityId));
}

export interface ControlAccountTransferRequest {
  kind: ControlEntityKind;
  entityId: string;
  entityCode: string;
  entityName: string;
  fromAccountId: string;
  toAccountId: string;
  effectiveDate: string;
  reason: string;
  requestedBy: string;
  approvedBy: string;
  baseCurrency: string;
}

export interface ControlAccountTransferResult {
  valid: boolean;
  errors: string[];
  record?: ControlAccountTransferRecord;
  journal?: JournalEntry;
  transferredBalance: number;
}

export function buildControlAccountTransfer(
  request: ControlAccountTransferRequest,
  accounts: Account[],
  journals: JournalEntry[],
  localDecimals = 2
): ControlAccountTransferResult {
  const errors: string[] = [];
  const from = accounts.find(item => item.id === request.fromAccountId);
  const to = accounts.find(item => item.id === request.toAccountId);
  if (!from || !isPostingAccount(from)) errors.push('حساب الربط السابق غير موجود أو غير تشغيلي.');
  if (!to || !isPostingAccount(to)) errors.push('حساب الربط الجديد غير موجود أو غير تشغيلي.');
  if (request.fromAccountId === request.toAccountId) errors.push('حساب الربط الجديد يطابق الحساب السابق.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.effectiveDate)) errors.push('تاريخ التحويل غير صالح.');
  if (!request.reason.trim()) errors.push('سبب التحويل مطلوب.');
  if (!request.approvedBy.trim() || request.approvedBy.trim() === request.requestedBy.trim()) errors.push('يجب اعتماد التحويل بواسطة مستخدم مستقل.');
  const expectedSubLedger = subLedgerTypeByKind[request.kind];
  if (from && from.subLedgerType !== expectedSubLedger) errors.push('نوع الحساب السابق لا يطابق نوع الكيان.');
  if (to && to.subLedgerType !== expectedSubLedger) errors.push('نوع الحساب الجديد لا يطابق نوع الكيان.');
  if (errors.length || !from || !to) return { valid: false, errors, transferredBalance: 0 };

  const signedBalance = roundTo(journals.filter(entry => entry.status === 'POSTED' && entry.date <= request.effectiveDate).reduce((sum, entry) => sum + entry.lines.filter(line => line.accountId === from.id && line.subLedgerId === request.entityId).reduce((lineSum, line) => lineSum + (line.debit || 0) - (line.credit || 0), 0), 0), localDecimals);
  const id = `control-transfer-${request.kind.toLowerCase()}-${request.entityId}-${request.effectiveDate}-${Date.now()}`;
  let journal: JournalEntry | undefined;
  if (signedBalance !== 0) {
    const amount = Math.abs(signedBalance);
    const debitNew = signedBalance > 0;
    const subLedgerType = subLedgerTypeByKind[request.kind];
    const now = new Date().toISOString();
    journal = {
      id: `${id}-journal`, entryNumber: nextJournalNumber(journals), date: request.effectiveDate,
      reference: `CONTROL-TRANSFER-${request.entityCode}`, narration: `تحويل حساب الربط للكيان ${request.entityName}: ${request.reason}`,
      lines: [
        { id: `${id}-old`, accountId: from.id, accountCode: from.code, accountNameAr: from.nameAr, debit: debitNew ? 0 : amount, credit: debitNew ? amount : 0, description: `إقفال الرصيد على حساب الربط السابق`, subLedgerType, subLedgerId: request.entityId, subLedgerName: request.entityName },
        { id: `${id}-new`, accountId: to.id, accountCode: to.code, accountNameAr: to.nameAr, debit: debitNew ? amount : 0, credit: debitNew ? 0 : amount, description: `نقل الرصيد إلى حساب الربط الجديد`, subLedgerType, subLedgerId: request.entityId, subLedgerName: request.entityName },
      ],
      totalDebit: amount, totalCredit: amount, currency: request.baseCurrency, exchangeRate: 1,
      status: 'POSTED', type: 'JV', sourceType: 'MANUAL', createdBy: request.requestedBy, createdAt: now, postedBy: request.requestedBy, postedAt: now,
    };
  }
  const record: ControlAccountTransferRecord = {
    id, effectiveDate: request.effectiveDate, fromAccountId: from.id, toAccountId: to.id, reason: request.reason.trim(),
    requestedBy: request.requestedBy, approvedBy: request.approvedBy.trim(), journalEntryId: journal?.id, createdAt: new Date().toISOString(),
  };
  return { valid: true, errors: [], record, journal, transferredBalance: signedBalance };
}
