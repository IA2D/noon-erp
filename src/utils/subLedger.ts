import {
  Account,
  SubLedgerType,
  Employee,
  Customer,
  Vendor,
  CashBox,
  BankAccount,
  CostCenter
} from '../types/erp';

export const SUB_LEDGER_TYPES: SubLedgerType[] = [
  'NONE',
  'EMPLOYEE',
  'CUSTOMER',
  'SUPPLIER',
  'CASH_BOX',
  'BANK',
  'EXCHANGER',
  'ASSET',
  'COST_CENTER',
  'ITEM'
];

export interface SubLedgerMeta {
  label: string;
  labelEn: string;
  hint: string;
}

/** دليل الأنواع: يُعرض في شاشات البحث وعند تظليل/تفعيل الخلية */
export const SUB_LEDGER_META: Record<SubLedgerType, SubLedgerMeta> = {
  NONE: { label: 'بدون حساب تحليلي', labelEn: 'No Analytical Account', hint: 'حساب عام — لا يتطلب حساباً تحليلياً.' },
  EMPLOYEE: { label: 'موظف', labelEn: 'Employee', hint: 'يتطلب اختيار موظف من دليل الموظفين.' },
  CUSTOMER: { label: 'عميل', labelEn: 'Customer', hint: 'يتطلب اختيار عميل من دليل العملاء.' },
  SUPPLIER: { label: 'مورد', labelEn: 'Supplier', hint: 'يتطلب اختيار مورد من دليل الموردين.' },
  CASH_BOX: { label: 'صندوق نقدي', labelEn: 'Cash Box', hint: 'يتطلب اختيار صندوق نقدي.' },
  BANK: { label: 'بنك', labelEn: 'Bank', hint: 'يتطلب اختيار بنك من دليل البنوك.' },
  EXCHANGER: { label: 'صراف', labelEn: 'Exchange', hint: 'يتطلب اختيار شركة صرافة من دليل الصرافين.' },
  ASSET: { label: 'أصل ثابت', labelEn: 'Fixed Asset', hint: 'يتطلب اختيار أصل من سجل الأصول الثابتة.' },
  COST_CENTER: { label: 'مركز تكلفة', labelEn: 'Cost Center', hint: 'يتطلب اختيار مركز تكلفة.' },
  ITEM: { label: 'صنف / مخزون', labelEn: 'Item / Inventory', hint: 'يتطلب اختيار صنف من دليل الأصناف.' }
};

export interface SubLedgerDataset {
  accounts: Account[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  cashBoxes: CashBox[];
  banks: BankAccount[];
  costCenters: CostCenter[];
}

export interface SubLedgerEntity {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  accountId?: string;
  meta?: string;
  isActive?: boolean;
}

function toEntity(
  e: { id: string; code: string; nameAr: string; nameEn: string; linkedAccountId?: string; isActive?: boolean },
  meta?: string
): SubLedgerEntity {
  return { id: e.id, code: e.code, nameAr: e.nameAr, nameEn: e.nameEn, accountId: e.linkedAccountId, meta, isActive: e.isActive };
}

/** الحسابات التشغيلية (مستوى 5 نشط) — تُستخدم كجدول فرعي لأنواع ASSET/ITEM */
function postingOf(ds: SubLedgerDataset): Account[] {
  return ds.accounts.filter(a => a.level === 5 && a.isActive);
}

function cashBoxTypeLabel(t?: CashBox['boxType']): string {
  switch (t) {
    case 'MAIN': return 'صندوق رئيسي';
    case 'BRANCH': return 'صندوق فرعي';
    case 'RECEPTION': return 'صندوق استقبال';
    case 'OPERATIONS': return 'صندوق تشغيلي';
    default: return '—';
  }
}

/**
 * "Dynamic Lookup API" الموحّد:
 * موزّع يجلب قائمة كيانات الحساب التحليلي من الجدول المناسب حسب type.
 * (يقابل GET /api/v1/analytical-accounts/search?type={type}&query={q} في بيئة Backend)
 */
export function listSubLedgers(ds: SubLedgerDataset, type: SubLedgerType): SubLedgerEntity[] {
  switch (type) {
    case 'EMPLOYEE':
      return ds.employees.map(e => toEntity(e, e.jobTitle));
    case 'CUSTOMER':
      return ds.customers.map(c => toEntity(c, c.city));
    case 'SUPPLIER':
      return ds.vendors.map(v => toEntity(v, v.city));
    case 'CASH_BOX':
      return ds.cashBoxes.map(b => toEntity({ ...b, nameAr: b.nameAr, nameEn: b.nameEn }, cashBoxTypeLabel(b.boxType)));
    case 'BANK':
      return ds.banks
        .filter(b => b.entityType === 'BANK')
        .map(b => toEntity(
          { id: b.id, code: b.code, nameAr: b.bankNameAr, nameEn: b.bankNameEn, linkedAccountId: b.linkedAccountId, isActive: b.isActive },
          b.accountNumber
        ));
    case 'EXCHANGER':
      return ds.banks
        .filter(b => b.entityType === 'EXCHANGE')
        .map(b => toEntity(
          { id: b.id, code: b.code, nameAr: b.bankNameAr, nameEn: b.bankNameEn, linkedAccountId: b.linkedAccountId, isActive: b.isActive },
          b.accountNumber
        ));
    case 'COST_CENTER':
      return ds.costCenters.map(cc => toEntity({ ...cc, isActive: true }));
    case 'ASSET':
      return postingOf(ds)
        .filter(a => a.code.startsWith('12'))
        .map(a => toEntity({ id: a.id, code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, linkedAccountId: a.id, isActive: a.isActive }, 'أصل ثابت'));
    case 'ITEM':
      return [];
    case 'NONE':
    default:
      return [];
  }
}

export function searchSubLedgers(ds: SubLedgerDataset, type: SubLedgerType, query: string): SubLedgerEntity[] {
  const q = (query || '').trim().toLowerCase();
  const list = listSubLedgers(ds, type);
  if (!q) return list;
  return list.filter(e =>
    e.code.toLowerCase().includes(q) ||
    e.nameAr.toLowerCase().includes(q) ||
    e.nameEn.toLowerCase().includes(q) ||
    (e.meta || '').toLowerCase().includes(q)
  );
}

/**
 * استخراج نوع الحساب التحليلي لحساب مختار:
 * 1) القيمة المكوّنة في دليل الحسابات (subLedgerType) إن لم تكن NONE.
 * 2) الاشتقاق الرجعي من الكيانات المرتبطة (مفّريشن للبيانات القديمة).
 * 3) وإلا NONE.
 */
export function subLedgerTypeOf(account: Account | undefined, ds: SubLedgerDataset): SubLedgerType {
  if (!account) return 'NONE';
  if (account.subLedgerType && account.subLedgerType !== 'NONE') return account.subLedgerType;

  const linked = (list: { linkedAccountId?: string }[]) => list.some(x => x.linkedAccountId === account.id);
  if (linked(ds.employees)) return 'EMPLOYEE';
  if (linked(ds.customers)) return 'CUSTOMER';
  if (linked(ds.vendors)) return 'SUPPLIER';
  if (linked(ds.cashBoxes)) return 'CASH_BOX';
  if (ds.banks.some(b => b.linkedAccountId === account.id && b.entityType === 'BANK')) return 'BANK';
  if (ds.banks.some(b => b.linkedAccountId === account.id && b.entityType === 'EXCHANGE')) return 'EXCHANGER';
  return 'NONE';
}

export function subLedgerEntityById(ds: SubLedgerDataset, type: SubLedgerType, id?: string): SubLedgerEntity | undefined {
  if (!id) return undefined;
  return listSubLedgers(ds, type).find(e => e.id === id);
}

export function resolveSubLedgerName(ds: SubLedgerDataset, type: SubLedgerType, id?: string): string {
  const entity = subLedgerEntityById(ds, type, id);
  return entity ? entity.nameAr : '';
}

/**
 * قواعد التحقق الموحدة قبل الحفظ:
 * يُمنع الحفظ إذا كان نوع الحساب التحليلي يتطلب كياناً (غير NONE)
 * ولم يتم تحديد sub_ledger_id.
 */
export function validateSubLedger(
  account: Account | undefined,
  subLedgerId: string | undefined,
  ds: SubLedgerDataset
): { valid: boolean; message?: string } {
  const type = subLedgerTypeOf(account, ds);
  if (type === 'NONE') return { valid: true };

  if (type === 'ITEM') {
    return { valid: false, message: 'وحدة المخزون غير مفعّلة — لا يمكن اختيار صنف لهذا الحساب.' };
  }

  if (!subLedgerId) {
    return {
      valid: false,
      message: `الحساب «${account?.nameAr || ''}» من نوع ${SUB_LEDGER_META[type].label} — يجب تحديد الكيان التحليلي (${SUB_LEDGER_META[type].labelEn}).`
    };
  }

  if (!subLedgerEntityById(ds, type, subLedgerId)) {
    return { valid: false, message: 'الكيان التحليلي المحدد لم يعد موجوداً — أعد اختياره من البحث.' };
  }

  return { valid: true };
}

export function subLedgerBadge(type: SubLedgerType): { text: string; cls: string } {
  switch (type) {
    case 'EMPLOYEE': return { text: 'موظف', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'CUSTOMER': return { text: 'عميل', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'SUPPLIER': return { text: 'مورد', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'CASH_BOX': return { text: 'صندوق', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'BANK': return { text: 'بنك', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    case 'EXCHANGER': return { text: 'صراف', cls: 'bg-teal-500/15 text-teal-300 border-teal-500/30' };
    case 'ASSET': return { text: 'أصل', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'COST_CENTER': return { text: 'مركز تكلفة', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'ITEM': return { text: 'صنف', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    default: return { text: '—', cls: 'bg-slate-700/40 text-slate-400 border-slate-600/40' };
  }
}

/** الاشتقاق الرجعي لنوع الحساب التحليلي عند تهيئة بيانات قديمة (يُستخدم في App.tsx) */
export function deriveLegacySubLedgerType(accountId: string, ds: SubLedgerDataset): SubLedgerType {
  const linked = (list: { linkedAccountId?: string }[]) => list.some(x => x.linkedAccountId === accountId);
  if (linked(ds.employees)) return 'EMPLOYEE';
  if (linked(ds.customers)) return 'CUSTOMER';
  if (linked(ds.vendors)) return 'SUPPLIER';
  if (linked(ds.cashBoxes)) return 'CASH_BOX';
  if (ds.banks.some(b => b.linkedAccountId === accountId && b.entityType === 'BANK')) return 'BANK';
  if (ds.banks.some(b => b.linkedAccountId === accountId && b.entityType === 'EXCHANGE')) return 'EXCHANGER';
  return 'NONE';
}

export interface SubLedgerLineLike {
  accountId: string;
  subLedgerId?: string;
}

/**
 * التحقق الموحد من الحسابات التحليلية لصف من الأسطر قبل الحفظ:
 * يفحص كل سطر بالترتيب، ويعيد أول سطر مخالف مع رقمه (يبدأ من 1).
 * يُستخدم من كل شاشات الإدخال (قيود/سندات صرف/قبض) — لا تكرار للمنطق.
 */
export function validateSubLedgerLines(
  lines: SubLedgerLineLike[],
  accounts: Account[],
  ds: SubLedgerDataset
): { valid: boolean; message?: string; lineIndex?: number } {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const acc = accounts.find(a => a.id === line.accountId);
    const check = validateSubLedger(acc, line.subLedgerId, ds);
    if (!check.valid) {
      const lineNo = i + 1;
      return {
        valid: false,
        lineIndex: i,
        message: `يرجى تحديد الحساب التحليلي للسطر رقم (${lineNo}): ${check.message}`
      };
    }
  }
  return { valid: true };
}
