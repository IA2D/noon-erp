import { useEffect, useRef } from 'react';
import { useToast } from './Toast';

export default function StorageConflictToastBridge() {
  const toast = useToast();
  const lastClosedToastRef = useRef<{ at: number; key: string }>({ at: 0, key: '' });
  useEffect(() => {
    const onConflict = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      toast('error', `تم تحديث البيانات من نافذة أخرى، لذلك أُعيد تحميل أحدث نسخة دون الكتابة فوقها${detail?.key ? ` (${detail.key})` : ''}.`);
    };
    window.addEventListener('fullerp:storage-conflict', onConflict);
    const onClosed = (event: Event) => {
      const key = String((event as CustomEvent<{ key?: string }>).detail?.key ?? '');
      const now = Date.now();
      const previous = lastClosedToastRef.current;
      // Several fiscal-year state hooks can be rejected in the same render.
      // One notification is enough; suppress the burst instead of stacking a
      // toast for every persisted collection.
      if (now - previous.at < 1200) return;
      lastClosedToastRef.current = { at: now, key };
      toast('error', 'السنة المالية مقفلة نهائيًا — البيانات متاحة للاستعراض والتقارير فقط.');
    };
    window.addEventListener('fullerp:closed-year-write', onClosed);
    return () => {
      window.removeEventListener('fullerp:storage-conflict', onConflict);
      window.removeEventListener('fullerp:closed-year-write', onClosed);
    };
  }, [toast]);
  return null;
}
