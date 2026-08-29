import { useMemo } from 'react';
import { Currency } from '../types/erp';

/**
 * المصدر الموحد لعملات النظام (يمثل GET /api/v1/currencies?is_active=true):
 * يقرأ دليل العملات ويُخرج النشطة فقط — أي عملة ملغاة أو معطّلة (مثل EUR/GBP)
 * تختفي فوراً من كل القوائم والنوافذ بلا أي قائمة ثابتة مسبقة الكود.
 */
export interface ActiveCurrencyOption {
  code: string;
  label: string;
  symbol: string;
  rate: number;
  currency: Currency;
}

export interface ActiveCurrenciesBag {
  active: Currency[];
  /** العملة الأساسية النشطة (isBase) — وأول نشطة كبديل إن لم تُعيّن أساسية */
  base: Currency | undefined;
  baseCode: string;
  codes: string[];
  /** خيارات العرض للقوائم (رمز + اسم عربي) */
  options: ActiveCurrencyOption[];
  /** سعر التحويل لعملة (1 إن لم توجد) */
  rateOf: (code: string) => number;
  /** رمز العرض لعملة (الرمز نفسه إن لم توجد) */
  symbolOf: (code: string) => string;
}

export function useActiveCurrencies(currencies: Currency[] = []): ActiveCurrenciesBag {
  return useMemo(() => {
    const active = (currencies || []).filter(c => c.isActive);
    const base = active.find(c => c.isBase) || active[0];
    const baseCode = base?.code || '';
    const rateOf = (code: string): number => {
      if (code === baseCode) return 1;
      const c = active.find(x => x.code === code);
      return c && c.exchangeRate > 0 ? c.exchangeRate : 1;
    };
    return {
      active,
      base,
      baseCode,
      codes: active.map(c => c.code),
      options: active.map(c => ({
        code: c.code,
        label: c.nameAr,
        symbol: c.symbol,
        rate: rateOf(c.code),
        currency: c
      })),
      rateOf,
      symbolOf: (code: string) => active.find(c => c.code === code)?.symbol || code
    };
  }, [currencies]);
}

/** العملات الافتراضية لنماذج الإضافة: عملة النظام الأساسية تلقائياً (لا رموز ثابتة) */
export function defaultIncludedCodes(currencies: Currency[] = []): string[] {
  const active = (currencies || []).filter(c => c.isActive);
  const base = active.find(c => c.isBase) || active[0];
  return base ? [base.code] : [];
}
