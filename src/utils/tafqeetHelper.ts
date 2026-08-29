import { tafqeet } from './tafqeet';

export const CURRENCY_DECIMAL_NAMES: Record<string, string> = {
  SAR: 'هللة',
  YER: 'فلس',
  IQD: 'فلس',
  JOD: 'فلس',
  KWD: 'فلس',
  BHD: 'فلس',
  OMR: 'بيسة',
  LBP: 'فلس',
  EGP: 'قرش',
  SYP: 'قرش',
  AED: 'فلس',
  QAR: 'درهم',
  USD: 'سنت',
  EUR: 'سنت',
  GBP: 'بنس',
  TRY: 'كروش',
};

export function decimalNameFor(currencyCode?: string | null): string {
  if (!currencyCode) return 'فلس';
  return CURRENCY_DECIMAL_NAMES[String(currencyCode).toUpperCase()] || 'فلس';
}

export function tafqeetAmount(
  amount: number,
  currencyName?: string | null,
  currencyCode?: string | null
): string {
  const name = currencyName || 'ريال يمني';
  return tafqeet(amount, name, decimalNameFor(currencyCode));
}

export function balanceNature(amount: number): { isDebit: boolean; tag: string } {
  const isDebit = amount >= 0;
  return {
    isDebit,
    tag: isDebit ? 'إجمالي الرصيد عليكم (مدين)' : 'إجمالي الرصيد لكم (دائن)',
  };
}

export interface TafqeetResult {
  text: string;
  isDebit: boolean;
  tag: string;
}

export function tafqeetBalance(
  amount: number,
  currencyName?: string | null,
  currencyCode?: string | null
): TafqeetResult {
  const { isDebit, tag } = balanceNature(amount);
  return {
    text: tafqeetAmount(Math.abs(amount), currencyName, currencyCode),
    isDebit,
    tag,
  };
}
