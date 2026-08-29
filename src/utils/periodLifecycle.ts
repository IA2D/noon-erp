export type FinancialPeriodScope = 'YEAR' | 'MONTH';
export type FinancialPeriodStatus = 'OPEN' | 'TEMP_CLOSED' | 'REVIEWED' | 'FINAL_CLOSED';

export interface FinancialPeriodEvent {
  id: string;
  from: FinancialPeriodStatus;
  to: FinancialPeriodStatus;
  actor: string;
  at: string;
  reason: string;
  approvedBy?: string;
}

export interface FinancialPeriodRecord {
  key: string;
  scope: FinancialPeriodScope;
  status: FinancialPeriodStatus;
  version: number;
  history: FinancialPeriodEvent[];
  closingEntryId?: string;
  openingEntryId?: string;
}

export interface PeriodTransitionCommand {
  target: FinancialPeriodStatus;
  actor: string;
  reason: string;
  approvedBy?: string;
  at?: string;
  closingEntryId?: string;
  openingEntryId?: string;
}

export interface PeriodTransitionResult {
  valid: boolean;
  replay: boolean;
  errors: string[];
  record: FinancialPeriodRecord;
}

export const newPeriodRecord = (key: string, scope: FinancialPeriodScope): FinancialPeriodRecord => ({ key, scope, status: 'OPEN', version: 0, history: [] });

const allowed: Record<FinancialPeriodStatus, FinancialPeriodStatus[]> = {
  OPEN: ['TEMP_CLOSED'],
  TEMP_CLOSED: ['REVIEWED', 'OPEN'],
  REVIEWED: ['FINAL_CLOSED', 'OPEN'],
  FINAL_CLOSED: ['OPEN'],
};

export function transitionFinancialPeriod(current: FinancialPeriodRecord, command: PeriodTransitionCommand): PeriodTransitionResult {
  const errors: string[] = [];
  if (current.status === command.target) return { valid: true, replay: true, errors: [], record: current };
  if (!allowed[current.status].includes(command.target)) errors.push(`انتقال الفترة غير مسموح: ${current.status} ← ${command.target}.`);
  if (!command.actor.trim()) errors.push('منفذ الإجراء مطلوب.');
  if (!command.reason.trim()) errors.push('سبب تغيير حالة الفترة مطلوب.');
  if (current.status === 'FINAL_CLOSED' && command.target === 'OPEN') {
    if (!command.approvedBy?.trim()) errors.push('إعادة فتح فترة نهائية تتطلب اعتماداً مستقلاً.');
    if (command.approvedBy === command.actor) errors.push('معتمد إعادة الفتح يجب أن يختلف عن منفذ الإجراء.');
  }
  if (errors.length) return { valid: false, replay: false, errors, record: current };
  const at = command.at || new Date().toISOString();
  const event: FinancialPeriodEvent = { id: `period-${current.key}-${current.version + 1}`, from: current.status, to: command.target, actor: command.actor, at, reason: command.reason.trim(), approvedBy: command.approvedBy };
  return {
    valid: true,
    replay: false,
    errors: [],
    record: {
      ...current,
      status: command.target,
      version: current.version + 1,
      history: [...current.history, event],
      closingEntryId: command.closingEntryId ?? current.closingEntryId,
      openingEntryId: command.openingEntryId ?? current.openingEntryId,
    },
  };
}

export const nextCloseStatus = (status: FinancialPeriodStatus): FinancialPeriodStatus | null =>
  status === 'OPEN' ? 'TEMP_CLOSED' : status === 'TEMP_CLOSED' ? 'REVIEWED' : status === 'REVIEWED' ? 'FINAL_CLOSED' : null;

export const periodStatusLabel: Record<FinancialPeriodStatus, string> = {
  OPEN: 'مفتوحة', TEMP_CLOSED: 'إقفال مؤقت', REVIEWED: 'مراجعة معتمدة', FINAL_CLOSED: 'إقفال نهائي',
};

export function periodRecordFor(records: FinancialPeriodRecord[], key: string, scope: FinancialPeriodScope): FinancialPeriodRecord {
  return records.find(item => item.key === key && item.scope === scope) ?? newPeriodRecord(key, scope);
}

export function isDateClosedByRecords(iso: string, records: FinancialPeriodRecord[]): boolean {
  const year = (iso || '').slice(0, 4);
  const month = (iso || '').slice(0, 7);
  return records.some(record => record.status !== 'OPEN' && ((record.scope === 'YEAR' && record.key === year) || (record.scope === 'MONTH' && record.key === month)));
}
