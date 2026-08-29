/**
 * حارس الفترات المغلقة — مصدر واحد للحقيقة عبر كل الشاشات.
 * صيغة السنوات: YYYY | صيغة الأشهر: YYYY-MM (نفس تخزين شاشة الإقفالات).
 */

export function yearOfDate(iso: string): string {
  return (iso || '').slice(0, 4);
}

export function monthOfDate(iso: string): string {
  return (iso || '').slice(0, 7);
}

export function isPeriodClosed(iso: string, closedYears?: string[], closedMonths?: string[], periodRecords?: FinancialPeriodRecord[]): boolean {
  if (!iso) return false;
  const y = yearOfDate(iso);
  const m = monthOfDate(iso);
  if (!/^\d{4}$/.test(y)) return false;
  return !!closedYears?.includes(y) || !!closedMonths?.includes(m) || !!periodRecords?.length && isDateClosedByRecords(iso, periodRecords);
}

export const CLOSED_PERIOD_MESSAGE =
  'لا يمكن الترحيل أو التعديل في فترة مغلقة — أعد فتح الفترة من شاشة «الإقفالات والترحيل» أولاً.';
import type { FinancialPeriodRecord } from './periodLifecycle';
import { isDateClosedByRecords } from './periodLifecycle';
