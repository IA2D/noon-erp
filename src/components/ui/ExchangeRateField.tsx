import React from 'react';
import { rateViolationText } from '../../utils/exchangeRate';

/** اسم الحدث العالمي عند مغادرة حقل سعر صرف بقيمة خارج النطاق المسموح */
export const RATE_VIOLATION_EVENT = 'erp:rate-violation';

export interface RateViolationDetail {
  rate: number;
  currencyCode: string;
  min: number;
  max: number;
}

interface Props {
  /** القيمة الحالية لسعر الصرف */
  value: number | '';
  onChange: (v: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  isBase?: boolean;
  /** الحد الأدنى المسموح (من دليل العملات) */
  min: number;
  /** الحد الأقصى المسموح (من دليل العملات) */
  max: number;
  /** رمز العملة (للرسائل) */
  currencyCode: string;
  /** هل الحقل في خلية جدول مدمجة؟ (تصغير المسافات) */
  compact?: boolean;
  /** خطأ خارجي من فحص النموذج (إطار أحمر فقط) */
  error?: string;
  inputClassName?: string;
  className?: string;
  /** معرف اختبار / DOM مفيد لربط التنقل */
  'data-enter-field'?: string;
  /** يُمرَّر إلى حقل الإدخال (مثل تنقل Enter بين الخلايا) */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * حقل سعر التحويل — تحقق إلزامي صارم دون أي نصوص تحت الحقل:
 * - القيمة خارج النطاق [min..max]: إطار أحمر فوري فقط + title أصلي عند التمرير.
 * - عند مغادرة الحقل بقيمة خارج النطاق يُطلق إشعار Toast عالمي
 *   (حدث RATE_VIOLATION_EVENT) دون أي تغيير في أبعاد الصف/الخلية.
 * - العملة الأساسية: مقفلة عند 1 بلا فحص نطاق.
 */
export default function ExchangeRateField({
  value,
  onChange,
  onBlur,
  disabled,
  isBase = false,
  min,
  max,
  currencyCode,
  error,
  inputClassName,
  className,
  'data-enter-field': enterField,
  onKeyDown,
}: Props) {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  const violation = isBase
    ? null
    : rateViolationText(num, currencyCode, { min, max, default: num || min, isBase: false });
  const invalid = Boolean(violation || error);

  const handleBlur = () => {
    if (onBlur) onBlur();
    if (violation) {
      window.dispatchEvent(
        new CustomEvent<RateViolationDetail>(RATE_VIOLATION_EVENT, {
          detail: { rate: num, currencyCode, min, max },
        })
      );
    }
  };

  const inputCls =
    inputClassName ||
    `w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed ${
      invalid ? 'border-red-500/80' : 'border-slate-700/80'
    }`;

  return (
    <div className={className} data-enter-field={enterField}>
      <input
        type="number"
        step="0.0001"
        value={value}
        disabled={disabled}
        readOnly={isBase}
        onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        title={
          isBase ? 'سعر العملة الأساسية مثبت عند 1' : violation || 'سعر الصرف مقابل العملة الأساسية'
        }
        className={inputCls}
      />
    </div>
  );
}
