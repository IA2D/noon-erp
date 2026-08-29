export type DailyPostingKind = 'JOURNAL' | 'PAYMENT' | 'RECEIPT';

export interface DailyPostingRequest {
  kind: DailyPostingKind;
  id: string;
  docNo: string;
}

export interface DailyPostingItemResult extends DailyPostingRequest {
  ok: boolean;
  error?: string;
}

export interface DailyPostingBatchResult {
  ok: boolean;
  posted: number;
  failed: number;
  results: DailyPostingItemResult[];
}

export function accountingCommandError(error?: string): string {
  if (error === 'AUDITOR_WRITE_FORBIDDEN') return 'الحساب الحالي للعرض والتدقيق فقط ولا يملك صلاحية الترحيل';
  if (error === 'AUTH_REQUIRED' || error === 'SESSION_EXPIRED') return 'انتهت جلسة الدخول؛ سجّل الدخول ثم أعد المحاولة';
  if (error === 'VERSION_CONFLICT') return 'تغيّرت البيانات في نافذة أخرى؛ أعد فتح الشاشة ثم حاول مجددًا';
  if (error === 'DUPLICATE_DOCUMENT' || error === 'DUPLICATE_COMMAND') return 'المستند مرحّل مسبقًا أو رقمه مكرر';
  return error ? `تعذر الحفظ في SQLite: ${error}` : 'تعذر حفظ عملية الترحيل في SQLite';
}
