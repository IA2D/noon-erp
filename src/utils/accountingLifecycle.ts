import type { JournalEntry, JournalLine } from '../types/erp';

export interface ReversalResult {
  valid: boolean;
  errors: string[];
  reversal?: JournalEntry;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

export function buildLinkedReversal(
  original: JournalEntry,
  journals: JournalEntry[],
  actor: string,
  reason: string,
  reversalDate = todayIso(),
  now = nowIso()
): ReversalResult {
  const errors: string[] = [];
  if (original.status !== 'POSTED') errors.push('لا يمكن عكس قيد غير مُرحّل.');
  if (original.reversalOfEntryId) errors.push('لا يمكن عكس قيد عكسي مرة أخرى مباشرة؛ أنشئ قيد تصحيح مستقل.');
  if (original.reversedByEntryId || journals.some(item => item.reversalOfEntryId === original.id && item.status === 'POSTED')) errors.push('تم عكس هذا القيد مسبقاً.');
  if (!reason.trim()) errors.push('سبب العكس مطلوب.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) errors.push('تاريخ القيد العكسي غير صالح.');
  if (errors.length) return { valid: false, errors };

  const suffix = original.id;
  const lines: JournalLine[] = original.lines.map((line, index) => ({
    ...line,
    id: `rev-line-${suffix}-${index}`,
    debit: line.credit,
    credit: line.debit,
    debitForeign: line.creditForeign,
    creditForeign: line.debitForeign,
    description: `عكس: ${line.description || original.narration}`,
  }));
  const reversal: JournalEntry = {
    id: `rev-${suffix}`,
    entryNumber: `REV-${original.entryNumber}`,
    date: reversalDate,
    reference: `REV-${original.entryNumber}`,
    narration: `عكس القيد ${original.entryNumber}: ${reason.trim()}`,
    lines,
    totalDebit: original.totalCredit,
    totalCredit: original.totalDebit,
    currency: original.currency,
    exchangeRate: original.exchangeRate,
    status: 'POSTED',
    type: 'JV',
    sourceType: 'MANUAL',
    referenceCode: `REV-${original.entryNumber}`,
    createdBy: actor,
    createdAt: now,
    postedBy: actor,
    postedAt: now,
    reversalOfEntryId: original.id,
    reversalReason: reason.trim(),
  };
  return { valid: true, errors: [], reversal };
}

export function linkOriginalToReversal(original: JournalEntry, reversal: JournalEntry): JournalEntry {
  return { ...original, reversedByEntryId: reversal.id };
}
