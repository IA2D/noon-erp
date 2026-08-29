import { useEnterAsTab } from '../../hooks/useEnterAsTab';

/**
 * مكوّن موحّد يجعل زر Enter يعمل كزر Tab في كافة النماذج وشبكات الإدخال:
 * - التنقل بين الحقول داخل النموذج/النافذة المنبثقة (Enter للأمام، Shift+Enter للخلف).
 * - التنقل بين خلايا جداول الإدخال وإنشاء سطر جديد تلقائياً عند آخر سطر.
 * - select يثبّت اختياره ثم ينتقل؛ textarea يحتفظ بسلوك Enter الأصلي.
 * يركّب مرة واحدة في الجذر (App) ولا يُظهر أي عنصر مرئي.
 */
export default function GlobalEnterNav() {
  useEnterAsTab();
  return null;
}
