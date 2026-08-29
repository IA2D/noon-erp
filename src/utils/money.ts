import type { Currency } from '../types/erp';

export const DEFAULT_AMOUNT_DECIMALS = 2;
export const DEFAULT_RATE_DECIMALS = 8;

export function normalizeDecimals(value: number | undefined, fallback = DEFAULT_AMOUNT_DECIMALS): number {
  return Number.isInteger(value) && value! >= 0 && value! <= 8 ? value! : fallback;
}

export function currencyDecimals(code: string | undefined, currencies: Currency[], fallback = DEFAULT_AMOUNT_DECIMALS): number {
  return normalizeDecimals(currencies.find(item => item.code === code)?.decimals, fallback);
}

export function roundTo(value: number, decimals = DEFAULT_AMOUNT_DECIMALS): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** normalizeDecimals(decimals);
  return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * factor) / factor;
}

export function toMinorUnits(value: number, decimals = DEFAULT_AMOUNT_DECIMALS): number {
  const factor = 10 ** normalizeDecimals(decimals);
  const minor = Math.round((Number(value) + Number.EPSILON * Math.sign(value || 1)) * factor);
  if (!Number.isSafeInteger(minor)) throw new RangeError('Monetary amount exceeds the safe integer range.');
  return minor;
}

export function fromMinorUnits(value: number, decimals = DEFAULT_AMOUNT_DECIMALS): number {
  if (!Number.isSafeInteger(value)) throw new RangeError('Minor-unit amount must be a safe integer.');
  return value / 10 ** normalizeDecimals(decimals);
}

export function multiplyMoney(amount: number, rate: number, outputDecimals = DEFAULT_AMOUNT_DECIMALS): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return 0;
  return roundTo(amount * rate, outputDecimals);
}

export function amountsEqual(left: number, right: number, decimals = DEFAULT_AMOUNT_DECIMALS): boolean {
  return toMinorUnits(left, decimals) === toMinorUnits(right, decimals);
}

export function hasExcessPrecision(value: number, decimals = DEFAULT_AMOUNT_DECIMALS): boolean {
  return Math.abs((Number(value) || 0) - roundTo(Number(value) || 0, decimals)) > 1e-9;
}

export function formatMoney(value: number, decimals: number, locale = 'en-US'): string {
  const normalized = normalizeDecimals(decimals);
  return roundTo(value, normalized).toLocaleString(locale, { minimumFractionDigits: normalized, maximumFractionDigits: normalized });
}
