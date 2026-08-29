import { useMemo } from 'react';
import { Currency } from '../types/erp';
import { ExchangeRateBounds, exchangeRateBoundsOf, isRateOutOfBounds, rateViolationText } from '../utils/exchangeRate';

export interface ExchangeRateGuard {
  boundsOf: (code: string) => ExchangeRateBounds;
  outOfBounds: (rate: number, code: string) => boolean;
  violationOf: (rate: number, code: string) => string | null;
  /** قائمة مخالفات مجموعة أسعار (ترويسة + أسطر) — مصفوفة فارغة تعني أن كل الأسعار ضمن النطاق */
  violationsOf: (items: Array<{ rate: number; code: string }>) => string[];
}

/**
 * واقي حدود سعر التحويل — مصدر موحد لكل شاشات المعاملات
 * (سندات الصرف، سندات القبض، قيود اليومية، الأرصدة الافتتاحية).
 */
export function useExchangeRateGuard(currencies: Currency[] = []): ExchangeRateGuard {
  return useMemo(() => {
    const boundsOf = (code: string): ExchangeRateBounds => exchangeRateBoundsOf(currencies, code);
    const outOfBounds = (rate: number, code: string): boolean => isRateOutOfBounds(rate, boundsOf(code));
    const violationOf = (rate: number, code: string): string | null => rateViolationText(rate, code, boundsOf(code));
    const violationsOf = (items: Array<{ rate: number; code: string }>): string[] =>
      items
        .map(it => rateViolationText(it.rate, it.code, boundsOf(it.code)))
        .filter((m): m is string => m !== null);
    return { boundsOf, outOfBounds, violationOf, violationsOf };
  }, [currencies]);
}
