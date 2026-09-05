import type { JournalLine } from '../types/erp';

/**
 * مبلغ السطر الذي يطبع تحت رمز عملته.
 * القيود تحفظ دائماً المعادل المحلي في debit/credit للحفاظ على اتزان الأستاذ،
 * لكن التقرير يعرض قيمة العملة الأصلية عندما تكون عملة السطر أجنبية.
 */
export function journalPrintAmount(
  line: Pick<JournalLine, 'currency' | 'exchangeRate' | 'debit' | 'credit' | 'debitForeign' | 'creditForeign'>,
  side: 'debit' | 'credit',
  baseCurrency: string
): number {
  const localAmount = Number(line[side]) || 0;
  const currency = line.currency || baseCurrency;
  if (currency === baseCurrency) return localAmount;

  const storedForeignAmount = Number(side === 'debit' ? line.debitForeign : line.creditForeign) || 0;
  if (storedForeignAmount > 0) return storedForeignAmount;

  // توافق رجعي للقيود المحفوظة قبل إضافة حقلي debitForeign وcreditForeign.
  const rate = Number(line.exchangeRate) || 0;
  return rate > 0 ? localAmount / rate : localAmount;
}
