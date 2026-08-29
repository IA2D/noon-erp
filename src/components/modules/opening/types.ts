import type { Account } from '../../../types/erp';
import type { LinkedEntity } from '../../../services/openingBalancesService';
import type { SupportingDocument } from '../../../types/supportingDocuments';

export interface RowState {
  debit: number;
  credit: number;
  debitForeign: number;
  creditForeign: number;
  currency: string;
  rate: number;
  /** رقم الاعتماد / المرجع على مستوى السطر */
  documentRef?: string;
  /** تاريخ الاستحقاق (مفيد لحسابات الذمم) */
  dueDate?: string;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const zeroRow = (currency: string, rate: number): RowState => ({
  debit: 0,
  credit: 0,
  debitForeign: 0,
  creditForeign: 0,
  currency,
  rate,
});

export type SubLedgerKind = 'CASH_BOX' | 'BANK' | 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE';

export const SUB_LEDGER_KINDS: SubLedgerKind[] = ['CASH_BOX', 'BANK', 'CUSTOMER', 'VENDOR', 'EMPLOYEE'];

export const SUB_LEDGER_KIND_LABEL: Record<SubLedgerKind, string> = {
  CASH_BOX: 'صندوق نقدي',
  BANK: 'بنك / صرافة',
  CUSTOMER: 'عميل',
  VENDOR: 'مورد',
  EMPLOYEE: 'موظف',
};

export interface SubLedgerRow {
  kind: SubLedgerKind;
  id: string;
  code: string;
  nameAr: string;
  linkedAccountId: string;
  defaultCurrency: string;
  row: RowState;
}

export type CategoryTab = 'ALL' | 'GENERAL' | 'CASH_BANK' | 'CUSTOMER_VENDOR' | 'EMPLOYEE_TRUST';

export const CATEGORY_TABS: Array<{id: CategoryTab; label: string}> = [
  {id: 'ALL', label: 'الكل'},
  {id: 'GENERAL', label: 'الحسابات العامة'},
  {id: 'CASH_BANK', label: 'الصناديق والبنوك'},
  {id: 'CUSTOMER_VENDOR', label: 'العملاء والموردين'},
  {id: 'EMPLOYEE_TRUST', label: 'الموظفين والعُهد'},
];

export interface AccountSaveEntry {
  id: string;
  /** UUID فريد للصف — يصبح معرّف OpeningBalanceRecord */
  rowId: string;
  openingBalance: number;
  openingBalanceForeign: number;
  /** مدين بالعملة الأصلية */
  debit: number;
  /** دائن بالعملة الأصلية */
  credit: number;
  /** مدين بالعملة المحلية (= debit × exchangeRate) */
  debitLocal: number;
  /** دائن بالعملة المحلية (= credit × exchangeRate) */
  creditLocal: number;
  currency: string;
  rate: number;
  documentRef?: string;
  dueDate?: string;
}

export interface SubLedgerSaveEntry {
  kind: SubLedgerKind;
  id: string;
  /** UUID فريد للصف — يصبح معرّف OpeningBalanceRecord */
  rowId: string;
  linkedAccountId: string;
  openingBalance: number;
  openingBalanceForeign: number;
  /** مدين بالعملة الأصلية */
  debit: number;
  /** دائن بالعملة الأصلية */
  credit: number;
  /** مدين بالعملة المحلية (= debit × exchangeRate) */
  debitLocal: number;
  /** دائن بالعملة المحلية (= credit × exchangeRate) */
  creditLocal: number;
  currency: string;
  rate: number;
  documentRef?: string;
  dueDate?: string;
}

export interface SavePayload {
  accounts: AccountSaveEntry[];
  subLedgers: SubLedgerSaveEntry[];
  attachments?: SupportingDocument[];
}

export interface BaseAmounts {
  debit: number;
  credit: number;
}

/**
 * المبلغ الأصلي (كما أُدخل) لصف أرصدة افتتاحية، بعملة الصف نفسها تماماً:
 *  - صف أجنبي: الحقول الأجنبية (debitForeign / creditForeign)
 *  - صف أساسي: الحقول المحلية (debit / credit)
 * لا يُطبَّق أي تحويل هنا — هذا هو المصدر الوحيد الذي تُشتق منه القيم المحلية.
 */
export function nativeAmounts(r: RowState, baseCode: string): BaseAmounts {
  const isForeign = r.currency !== baseCode;
  return isForeign
    ? {debit: round2(r.debitForeign || 0), credit: round2(r.creditForeign || 0)}
    : {debit: round2(r.debit || 0), credit: round2(r.credit || 0)};
}

/**
 * المكافئ المحلي (بالعملة الأساسية) لصف أرصدة افتتاحية.
 *
 * المعادلة المعتمدة والوحيدة:
 *   BaseDebit  = NativeDebit  × ExchangeRate
 *   BaseCredit = NativeCredit × ExchangeRate
 *
 * القواعد الصارمة (لمنع أي خلط بين الأجنبي والمحلي):
 *  1) المصدر الوحيد للتحويل هو المبلغ الأصلي × سعر التحويل الخاص بالصف.
 *  2) لا يُجمَع المبلغ الأجنبي مع المحلي أبداً، ولا يُستخدم حقل محلي موازٍ للصف الأجنبي.
 *  3) سعر التحويل = سعر الصف إن وُجد (>0)، وإلا سعر الدليل لعملة الصف؛ والعملة الأساسية دائماً بالسعر 1.
 */
export function baseAmountsOf(r: RowState, baseCode: string, rateOf: (c: string) => number): BaseAmounts {
  const isForeign = r.currency !== baseCode;
  const rate = isForeign ? (r.rate > 0 ? r.rate : rateOf(r.currency)) : 1;
  const native = nativeAmounts(r, baseCode);
  return {
    debit: round2(native.debit * rate),
    credit: round2(native.credit * rate),
  };
}

/** اسم مستعار للتوافق مع الرمز القديم — مصدر التحويل المحلي الموحّد */
export function localOf(r: RowState, baseCode: string, rateOf: (c: string) => number): BaseAmounts {
  return baseAmountsOf(r, baseCode, rateOf);
}

export interface AggregateOpeningTotals {
  totalDebit: number;
  totalCredit: number;
  debit: number;
  credit: number;
  variance: number;
}

/**
 * تجميع مجاميع الأرصدة الافتتاحية بالعملة الأساسية عبر كل السطور.
 * كل عنصر يحمل `row: RowState | null`； ويُستبعَد أي سطر فارغ.
 * تُحوَّل المبالغ الأجنبية إلى الأساس باستخدام سعر صفها (أو سعر الدليل)،
 * بينما تبقى مبالغ العملة الأساسية كما هي بالسعر 1.
 */
export function aggregateOpeningTotals(
  items: Array<{ row?: RowState | null }>,
  baseCode: string,
  rateOf: (c: string) => number
): AggregateOpeningTotals {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const item of items) {
    const r = item.row ?? null;
    if (!r) continue;
    const isForeign = r.currency !== baseCode;
    const rate = isForeign ? (r.rate > 0 ? r.rate : rateOf(r.currency)) : 1;
    const nativeDebit = isForeign ? (r.debitForeign || 0) : (r.debit || 0);
    const nativeCredit = isForeign ? (r.creditForeign || 0) : (r.credit || 0);
    totalDebit += nativeDebit * rate;
    totalCredit += nativeCredit * rate;
  }
  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  return { totalDebit, totalCredit, debit: totalDebit, credit: totalCredit, variance: round2(totalDebit - totalCredit) };
}

/** الحقول القابلة للتحرير في صف شبكة الأرصدة الافتتاحية */
export type RowEditField = 'debit' | 'credit' | 'debitForeign' | 'creditForeign' | 'rate';

/**
 * المفتاح المركب الفريد للرصيد الافتتاحي:
 *   Account ID + "_" + (Sub-Ledger ID أو "NONE") + "_" + Currency
 * يُستخدم لمنع تكرار نفس (الحساب + المساعد + العملة) على مستوى ورقة العمل وقاعدة البيانات.
 */
export const compositeKey = (accountId: string, entityId: string | null | undefined, currency: string): string =>
  `${accountId}_${entityId || 'NONE'}_${currency}`;

/** سطر واحد في ورقة عمل الأرصدة الافتتاحية — حساب + مساعد اختياري + الحالة المحرَّرة */
export interface EntryLine {
  /** معرف ثابت للسطر */
  key: string;
  /** مصدر السطر: تم جلب حسابه عبر "جلب الحسابات" أو أُضيف يدوياً */
  kind: 'fetched' | 'manual';
  /** الحساب المُختار — null ما دام النص المدخل لم يُحسم بعد */
  account: Account | null;
  /** النص المكتوب في حقل رقم الحساب (يُحفظ حتى اختيار حساب من F9) */
  codeText: string;
  /** الحساب المساعد المُختار (لحسابات التحكم فقط) */
  entity: LinkedEntity | null;
  /** الحالة المحرَّرة للسطر */
  row: RowState;
  /**
   * المفتاح المركب لسجل قاعدة البيانات الذي يحرّره هذا السطر (تحميل من الاستعراض/جلب رصيد محفوظ).
   * السطر الذي يحمل editKey مطابقاً لمفتاحه مسموح بالحفظ (تحديث)، أما أي تركيبة محفوظة
   * بدون editKey مطابق تُعتبر تكراراً ممنوعاً.
   */
  editKey?: string;
}

/** صف في نافذة "استعراض الأرصدة المدخلة" */
export interface BrowseRow {
  key: string;
  /** UUID فريد للسجل المحفوظ في openingBalances[] — يُستخدم كمفتاح React */
  recordId?: string;
  kind: 'account' | 'subLedger';
  accountId: string;
  accountCode: string;
  accountName: string;
  entity: LinkedEntity | null;
  currency: string;
  rate: number;
  debit: number;
  credit: number;
  debitForeign: number;
  creditForeign: number;
  documentRef?: string;
  dueDate?: string;
  /** هل يوجد رصيد محفوظ لهذا السطر في قاعدة البيانات؟ */
  saved: boolean;
  /** هل السطر موجود حالياً في ورقة العمل؟ */
  onWorksheet: boolean;
}

let uidCounter = 0;
/** معرف فريد لصفوف ورقة العمل — UUID آمن فعلياً لمنع أي تداخل */
export const uid = (): string => {
  uidCounter++;
  try { return crypto.randomUUID(); } catch { return `ob-${Date.now().toString(36)}-${uidCounter.toString(36)}`; }
};
