import { Currency } from '../types/erp';

export interface ExchangeRateBounds {
  min: number;
  max: number;
  default: number;
  isBase: boolean;
}

export function fmtRate(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : '0';
}

export function exchangeRateBoundsOf(currencies: Currency[] = [], code: string): ExchangeRateBounds {
  const c = (currencies || []).find(x => x.code === code);
  if (!c || c.isBase) return { min: 1, max: 1, default: 1, isBase: true };
  const min = typeof c.minExchangeRate === 'number' && c.minExchangeRate > 0 ? c.minExchangeRate : 1;
  const max = typeof c.maxExchangeRate === 'number' && c.maxExchangeRate > 0 ? c.maxExchangeRate : c.exchangeRate || 1;
  return { min, max, default: c.exchangeRate > 0 ? c.exchangeRate : 1, isBase: false };
}

export function isRateOutOfBounds(rate: number, bounds: ExchangeRateBounds): boolean {
  if (bounds.isBase) return false;
  if (!Number.isFinite(rate) || !(rate > 0)) return true;
  return rate < bounds.min || rate > bounds.max;
}

export function rateViolationText(rate: number, code: string, bounds: ExchangeRateBounds): string | null {
  if (!isRateOutOfBounds(rate, bounds)) return null;
  if (!Number.isFinite(rate) || !(rate > 0)) {
    return `سعر الصرف المدخل (${rate || 0}) خارج النطاق المسموح به (بين ${fmtRate(bounds.min)} و ${fmtRate(bounds.max)}) لهذه العملة`;
  }
  return `سعر الصرف المدخل (${fmtRate(rate)}) خارج النطاق المسموح به (بين ${fmtRate(bounds.min)} و ${fmtRate(bounds.max)}) لهذه العملة`;
}

export function rateRangeHint(bounds: ExchangeRateBounds): string {
  if (bounds.isBase) return 'سعر العملة الأساسية مثبت عند 1';
  return `المدى المسموح: [أدنى: ${fmtRate(bounds.min)} - أعلى: ${fmtRate(bounds.max)}]`;
}
