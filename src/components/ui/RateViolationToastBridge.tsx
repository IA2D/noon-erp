import React, { useEffect } from 'react';
import { useToast } from './Toast';
import { RATE_VIOLATION_EVENT, RateViolationDetail } from './ExchangeRateField';
import { fmtRate } from '../../utils/exchangeRate';

/**
 * جسر عالمي يستمع لحدث مخالفة سعر الصرف (RATE_VIOLATION_EVENT) الصادر من أي
 * حقل سعر تحويل في النظام ويحوّله إلى إشعار Toast منبثق — يُركَّب مرة واحدة
 * داخل ToastProvider في App، فلا تحتاج الشاشات لأي تمرير خصائص.
 */
export default function RateViolationToastBridge() {
  const toast = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RateViolationDetail>).detail;
      toast(
        'error',
        `تنبيه: سعر الصرف المدخل (${fmtRate(detail.rate)}) لعملة (${detail.currencyCode}) يجب أن يكون بين ${fmtRate(detail.min)} و ${fmtRate(detail.max)}`
      );
    };
    window.addEventListener(RATE_VIOLATION_EVENT, handler);
    return () => window.removeEventListener(RATE_VIOLATION_EVENT, handler);
  }, [toast]);

  return null;
}
