import { useEffect } from 'react';
import { useToast } from './Toast';

export default function StorageConflictToastBridge() {
  const toast = useToast();
  useEffect(() => {
    const onConflict = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      toast('error', `تم تحديث البيانات من نافذة أخرى، لذلك أُعيد تحميل أحدث نسخة دون الكتابة فوقها${detail?.key ? ` (${detail.key})` : ''}.`);
    };
    window.addEventListener('fullerp:storage-conflict', onConflict);
    return () => window.removeEventListener('fullerp:storage-conflict', onConflict);
  }, [toast]);
  return null;
}
