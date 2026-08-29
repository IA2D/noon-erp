import React, { useState} from'react';
import {
  Landmark,
  RefreshCw,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  CreditCard,
  Hash,
  Phone,
  Mail,
  User,
  ShieldAlert,
  Wallet,
  CheckCircle2,
  Coins
} from'lucide-react';
import { Account, AccountCurrency, Currency, JournalEntry, BankAccount, BankEntityType} from'../../types/erp';
import { calculateAccountActivity, aggregateAccountBalance, bankPostingAccounts, isLinkedOutOfDomain, nextEntityCode} from'../../utils/accountingEngine';
import { useActiveCurrencies, defaultIncludedCodes } from '../../hooks/useActiveCurrencies';
import { useToast} from'../ui/Toast';
import PageHeader from'../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import AmountInput from'../AmountInput';
import ModalShell from '../ui/ModalShell';

 interface Props {
  bankAccounts: BankAccount[];
  accounts: Account[];
  journals: JournalEntry[];
  currencies?: Currency[];
  onAddBank: (bank: Omit<BankAccount,'id'>) => void;
 onUpdateBank: (id: string, updates: Partial<BankAccount>) => void;
 onDeleteBank: (id: string) => void;
}

const ENTITY_TYPE_LABELS: Record<BankEntityType, string> = {
 BANK:'بنك',
 EXCHANGE:'شركة صرافة'
};

const ENTITY_TYPE_BADGES: Record<BankEntityType, string> = {
  BANK:'bg-sky-500/20 text-sky-300 border-sky-500/30',
  EXCHANGE:'bg-amber-500/15 text-amber-300 border-amber-500/30'
};

/** تطبيع الآيبان: حذف الفراغات ورفع الحالة — يُحفظ بصيغة موحدة بلا فراغات */
const normalizeIBAN = (s: string): string => (s || '').replace(/\s+/g, '').toUpperCase();

const formatIBAN = (s: string): string => normalizeIBAN(s).replace(/(.{4})/g, '$1 ').trim();

/** التحقق من بنية الآيبان: حرفان للدولة + رقمان تحقق + رمز الحساب البنكي (BBAN) — الطول الإجمالي 15-34 */
const isValidIBAN = (s: string): boolean => {
  const iban = normalizeIBAN(s);
  if (iban.length < 15 || iban.length > 34) return false;
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban);
};

/** التحقق من رمز السويفت: 8 أو 11 خانة أبجدية رقمية */
const isValidSWIFT = (s: string): boolean => /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(normalizeIBAN(s));

function buildCurrencies(codes: string[]): AccountCurrency[] {
  const ts = Date.now();
  return codes.map((code, i) => ({
    id: `cur-${ts}-${i}`,
    code,
    isDefault: i === 0,
    isActive: true
  }));
}

/** دمج العملات عند تعديل بنك/صراف: تضمين/إيقاف مع الحفاظ على السجل (إيقاف بدلاً من الحذف) */
function mergeCurrencies(existing: AccountCurrency[], included: string[]): AccountCurrency[] {
  const ts = Date.now();
  const next: AccountCurrency[] = [];
  existing.forEach(c => {
    const active = included.includes(c.code);
    next.push({ ...c, isActive: active, isDefault: included[0] === c.code });
  });
  included.forEach(code => {
    if (!existing.some(c => c.code === code)) {
      next.push({ id: `cur-${ts}-${code}`, code, isActive: true, isDefault: included[0] === code });
    }
  });
  return next;
}

interface BankForm {
  code: string;
  bankNameAr: string;
  bankNameEn: string;
  entityType: BankEntityType;
  accountNumber: string;
  iban: string;
  swift: string;
  branchName: string;
  branchCode: string;
  accountHolder: string;
  includedCurrencies: string[];
  openingBalance: number;
  linkedAccountId: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  isActive: boolean;
}

function emptyForm(code: string, includedCurrencies: string[]): BankForm {
  return {
  code,
  bankNameAr:'',
  bankNameEn:'',
  entityType:'BANK',
  accountNumber:'',
  iban:'',
  swift:'',
  branchName:'',
  branchCode:'',
  accountHolder:'',
  includedCurrencies,
  openingBalance: 0,
  linkedAccountId:'',
  contactPerson:'',
  contactPhone:'',
  contactEmail:'',
  notes:'',
  isActive: true
};
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2});

function nextBankCode(banks: BankAccount[], type: BankEntityType): string {
 // يُولّد تلقائياً بادئة وفق نوع الكيان: BNK-### للبنوك و EXC-### لشركات الصرافة
 // — يُحتسب MAX(code) للأنواع المطابقة ويُزاد بمقدار 1 (EXC-001 -> EXC-002).
 return type === 'EXCHANGE'
   ? nextEntityCode(banks, 'EXC')
   : nextEntityCode(banks, 'BNK', ['BANK']);
}

export default function BankAccountsView({ bankAccounts, accounts, journals, currencies, onAddBank, onUpdateBank, onDeleteBank}: Props) {
 const toast = useToast();
 const [searchTerm, setSearchTerm] = useState('');
 const [modal, setModal] = useState<{ mode:'add' |'edit'; id?: string; form: BankForm} | null>(null);
 const [formError, setFormError] = useState('');
 const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);

 const activity = calculateAccountActivity(accounts, journals);
 const { options: availableCurrencies } = useActiveCurrencies(currencies);
 const defaultCodes = defaultIncludedCodes(currencies);

 const bankBalance = (bank: BankAccount): number => {
 if (!bank.linkedAccountId) return bank.openingBalance;
 const linked = accounts.find(a => a.id === bank.linkedAccountId);
 if (!linked) return bank.openingBalance;
 return aggregateAccountBalance(linked, accounts, activity);
};

 const linkedName = (id?: string): string => {
 if (!id) return'—';
 const acc = accounts.find(a => a.id === id);
 return acc ? `${acc.code} - ${acc.nameAr}` :'—';
 };

 const filtered = bankAccounts.filter(b => {
 const term = searchTerm.trim().toLowerCase();
 if (!term) return true;
 return (
 b.code.toLowerCase().includes(term) ||
 b.bankNameAr.includes(searchTerm.trim()) ||
 b.bankNameEn.toLowerCase().includes(term) ||
 b.accountNumber.toLowerCase().includes(term) ||
 b.iban && normalizeIBAN(b.iban).toLowerCase().includes(term.replace(/\s+/g, '')) ||
 (b.branchName ||'').includes(searchTerm.trim())
 );
});

 const activeCount = bankAccounts.filter(b => b.isActive).length;
 const totalBalance = bankAccounts.reduce((sum, b) => sum + bankBalance(b), 0);

 const openAdd = () => {
 setFormError('');
  setModal({ mode:'add', form: emptyForm(nextBankCode(bankAccounts, 'BANK'), defaultCodes)});
};

 const openEdit = (bank: BankAccount) => {
 setFormError('');
 setModal({
 mode:'edit',
 id: bank.id,
 form: {
 code: bank.code,
 bankNameAr: bank.bankNameAr,
 bankNameEn: bank.bankNameEn,
 entityType: bank.entityType,
 accountNumber: bank.accountNumber,
 iban: bank.iban,
 swift: bank.swift,
  branchName: bank.branchName ||'',
  branchCode: bank.branchCode ||'',
  accountHolder: bank.accountHolder ||'',
  includedCurrencies: (bank.currencies || []).filter(c => c.isActive).map(c => c.code),
  openingBalance: bank.openingBalance,
 linkedAccountId: bank.linkedAccountId ||'',
 contactPerson: bank.contactPerson ||'',
 contactPhone: bank.contactPhone ||'',
 contactEmail: bank.contactEmail ||'',
 notes: bank.notes ||'',
 isActive: bank.isActive
}
});
};

 const changeEntityType = (type: BankEntityType) => {
  setModal(prev => {
    if (!prev) return prev;
    const form = { ...prev.form, entityType: type };
    if (prev.mode === 'add') {
      form.code = nextBankCode(bankAccounts, type);
    }
    return { ...prev, form };
  });
 };

 const handleSave = (e: React.FormEvent) => {
 e.preventDefault();
 if (!modal) return;
  const f = modal.form;
  const code = f.code.trim();
   if (!code) {
    setFormError('كود البنك / الصراف مطلوب.');
    return;
  }
   if (!f.bankNameAr.trim()) {
    setFormError('اسم البنك / الصراف بالعربية مطلوب.');
    return;
  }
   if (!f.linkedAccountId) {
    setFormError('يجب ربط البنك / الصراف بحساب رئيسي من دليل الحسابات (حساب بنكي من المستوى الخامس).');
    return;
  }
   if (f.includedCurrencies.length === 0) {
    setFormError('يجب تضمين عملة واحدة على الأقل للبنك / الصراف.');
    return;
  }
   if (f.iban.trim() && !isValidIBAN(f.iban)) {
    setFormError('رقم الآيبان غير صحيح — يجب أن يبدأ بحرفي الدولة ثم رقمان للتحقق (إجمالي 15-34 خانة).');
    return;
  }
   if (f.swift.trim() && !isValidSWIFT(f.swift)) {
    setFormError('رمز السويفت غير صحيح — يجب أن يكون 8 أو 11 خانة أبجدية رقمية.');
    return;
  }
   if (modal.mode ==='add') {
   if (bankAccounts.some(b => b.code.toLowerCase() === code.toLowerCase())) {
   setFormError(`كود البنك / الصراف ${code} مستخدم مسبقاً — لا يمكن تكرار الكود.`);
   return;
 }
   // العلاقة (One-to-Many): حساب التحكم الواحد في الدليل يقبل الارتباط بعدة
   // بنوك / صرافين في نفس الوقت — لا يُمنع إعادة استخدام الحساب المحاسبي المرتبط.
   try {
   onAddBank({
    code,
  bankNameAr: f.bankNameAr.trim(),
  bankNameEn: f.bankNameEn.trim(),
  entityType: f.entityType,
  accountNumber: f.accountNumber.trim(),
  iban: normalizeIBAN(f.iban),
  swift: f.swift.trim().replace(/\s+/g, '').toUpperCase(),
  branchName: f.branchName.trim(),
  branchCode: f.branchCode.trim(),
  accountHolder: f.accountHolder.trim(),
  currencies: buildCurrencies(f.includedCurrencies),
  defaultCurrency: f.includedCurrencies[0] ||'YER',
  openingBalance: Number(f.openingBalance) || 0,
  linkedAccountId: f.linkedAccountId || undefined,
  contactPerson: f.contactPerson.trim(),
  contactPhone: f.contactPhone.trim(),
  contactEmail: f.contactEmail.trim(),
  notes: f.notes.trim(),
  isActive: f.isActive,
  createdAt: new Date().toISOString().substring(0, 10)
  });
  toast('success', `تم إنشاء ${f.entityType ==='BANK' ?'البنك' :'الصراف'} ${code} - ${f.bankNameAr.trim()}`);
  } catch (err) {
  console.error('BankAccountsView: فشل حفظ البنك / الصراف', err);
  setFormError('تعذر حفظ البنك / الصراف — يرجى المحاولة مرة أخرى، وإذا استمرت المشكلة راجع وحدة التحكم.');
  toast('error', 'تعذر حفظ البنك / الصراف — حدث خطأ أثناء الحفظ.');
  return;
  }
} else if (modal.id) {
  const editingBank = bankAccounts.find(b => b.id === modal.id);
  try {
  onUpdateBank(modal.id, {
  code,
 bankNameAr: f.bankNameAr.trim(),
 bankNameEn: f.bankNameEn.trim(),
 entityType: f.entityType,
 accountNumber: f.accountNumber.trim(),
 iban: f.iban.trim(),
 swift: f.swift.trim().toUpperCase(),
  branchName: f.branchName.trim(),
  branchCode: f.branchCode.trim(),
  accountHolder: f.accountHolder.trim(),
  currencies: mergeCurrencies(editingBank?.currencies || [], f.includedCurrencies),
  defaultCurrency: f.includedCurrencies[0] || editingBank?.defaultCurrency ||'YER',
  openingBalance: Number(f.openingBalance) || 0,
  linkedAccountId: f.linkedAccountId || undefined,
  contactPerson: f.contactPerson.trim(),
  contactPhone: f.contactPhone.trim(),
  contactEmail: f.contactEmail.trim(),
  notes: f.notes.trim(),
  isActive: f.isActive
  });
  toast('success', `تم تحديث بيانات ${f.entityType ==='BANK' ?'البنك' :'الصراف'} ${code} - ${f.bankNameAr.trim()}`);
  } catch (err) {
  console.error('BankAccountsView: فشل تحديث البنك / الصراف', err);
  setFormError('تعذر تحديث بيانات البنك / الصراف — يرجى المحاولة مرة أخرى.');
  toast('error', 'تعذر تحديث بيانات البنك / الصراف — حدث خطأ أثناء الحفظ.');
  return;
  }
}
  setModal(null);
};

 const confirmDelete = () => {
 if (!deleteTarget) return;
 onDeleteBank(deleteTarget.id);
  toast('success', `تم حذف ${deleteTarget.entityType ==='BANK' ?'البنك' :'الصراف'} ${deleteTarget.code ? `${deleteTarget.code} - ` : ''}${deleteTarget.bankNameAr}`);
 setDeleteTarget(null);
};

 return (
 <div className="space-y-6 animate-fade-in">
 <PageHeader
 icon={<Landmark className="w-6 h-6" />}
 title="بيانات البنوك والصرافين"
 subtitle="إدارة الحسابات البنكية وشركات الصرافة — الآيبان والسويفت والربط المحاسبي"
 actions={
 <button
 onClick={openAdd}
 className="flex items-center gap-2 bg-sky-500/15 hover:bg-sky-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
 >
 <Plus className="w-4 h-4" />
 إضافة بنك / صراف
 </button>
}
 />

 {/* الإحصائيات */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">إجمالي الكيانات</div>
 <div className="text-2xl font-black text-white mt-1">{bankAccounts.length}</div>
 </div>
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">بنوك</div>
 <div className="text-2xl font-black text-sky-400 mt-1">{bankAccounts.filter(b => b.entityType ==='BANK').length}</div>
 </div>
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">شركات صرافة</div>
 <div className="text-2xl font-black text-sky-400 mt-1">{bankAccounts.filter(b => b.entityType ==='EXCHANGE').length}</div>
 </div>
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">إجمالي الأرصدة الحالية</div>
 <div className="text-2xl font-black gradient-text mt-1">{fmt(totalBalance)}</div>
 </div>
 </div>

 {/* البحث */}
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="relative">
  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
  <F9SearchInput
  value={searchTerm}
  onChange={v => setSearchTerm(v)}

  className="w-full px-10 py-2.5 text-sm glass-input rounded-xl"
  items={filtered}
  columns={[
  { label: 'الكود', render: (b: BankAccount) => <span className="font-mono font-bold text-sky-400">{b.code}</span> },
  { label: 'الاسم', render: (b: BankAccount) => (
  <div>
  <div className="font-bold text-white">{b.bankNameAr}</div>
  <div className="text-sm text-slate-400 font-mono">{b.bankNameEn}</div>
  </div>
  ) },
  { label: 'رقم الحساب', render: (b: BankAccount) => <span className="font-mono text-slate-300" dir="ltr">{b.accountNumber || '—'}</span> },
  { label: 'الآيبان', render: (b: BankAccount) => <span className="font-mono text-slate-300" dir="ltr">{b.iban ? formatIBAN(b.iban) : '—'}</span> }
  ]}
  searchText={b => `${b.code} ${b.bankNameAr} ${b.bankNameEn} ${b.accountNumber} ${b.iban}`}
  browseTitle="استعراض البنوك والصرافين"
  />
  </div>
 </div>

 {/* القائمة */}
 <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
 <div className="overflow-x-auto custom-scrollbar">
  <div className="min-w-[1240px]">
  {filtered.map(bank => (
  <div key={bank.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-white/5 transition-colors ${!bank.isActive ?'opacity-50' :''}`}>
  <div className="w-12 flex-shrink-0 flex items-center justify-center">
  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-xs font-bold">
  {bankAccounts.indexOf(bank) + 1}
  </span>
  </div>
  <div className="flex items-center gap-3 flex-1 min-w-[250px]">
 <div className={`p-2 rounded-xl flex-shrink-0 border bg-sky-500/15 text-sky-400 border-sky-500/20`}>
 {bank.entityType ==='BANK'
 ? <Landmark className="w-4 h-4" />
 : <RefreshCw className="w-4 h-4" />}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg font-mono font-bold text-sm border ${ENTITY_TYPE_BADGES[bank.entityType]}`} dir="ltr">{bank.code || '—'}</span>
 <span className="font-bold text-white whitespace-nowrap">{bank.bankNameAr}</span>
 </div>
 <div className="text-sm text-slate-400 font-mono whitespace-nowrap">{bank.bankNameEn}</div>
 </div>
 </div>

 <div className="w-28 flex-shrink-0">
 <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ENTITY_TYPE_BADGES[bank.entityType]}`}>
 {ENTITY_TYPE_LABELS[bank.entityType]}
 </span>
 </div>

 <div className="w-44 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
 <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
 <span className="font-mono truncate" dir="ltr">{bank.accountNumber ||'—'}</span>
 </div>

 <div className="w-44 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
 <Hash className="w-3.5 h-3.5 flex-shrink-0" />
  <span className="font-mono truncate" dir="ltr">{bank.iban ? formatIBAN(bank.iban) :'—'}</span>
 </div>

 <div className="w-28 flex-shrink-0">
 <div className="text-sm text-slate-500">الرصيد الحالي</div>
 <div className="font-mono font-bold text-white text-sm">{fmt(bankBalance(bank))} <span className="text-slate-400 text-xs">{bank.defaultCurrency}</span></div>
 </div>

 <div className="w-40 flex-shrink-0">
 <div className="text-sm text-slate-500">الحساب المرتبط</div>
 <div className="text-xs text-sky-300 truncate" dir="ltr">{linkedName(bank.linkedAccountId)}</div>
 </div>

 <div className="w-20 flex-shrink-0">
 <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border ${bank.isActive
 ?'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
 :'bg-slate-800 text-slate-400 border-slate-700'
}`}>
 <Power className="w-3 h-3" />
 {bank.isActive ?'نشط' :'موقوف'}
 </span>
 </div>

 <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
 <button
 onClick={() => openEdit(bank)}
 title="تعديل البنك / الصراف"
 className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button
 onClick={() => setDeleteTarget(bank)}
 title="حذف / إيقاف"
 className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 {filtered.length === 0 && (
 <div className="py-14 text-center text-slate-400">
 <div className="flex flex-col items-center gap-3">
 <Wallet className="w-10 h-10 text-slate-600" />
 <p className="font-bold text-white">لا توجد بنوك أو صرافين مطابقة</p>
 <p className="text-sm">جرّب تغيير نص البحث أو أضف كياناً جديداً</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* نافذة الإضافة / التعديل */}
 {modal && (
 <ModalShell
  id="bank-account-form"
  open={!!modal}
  onClose={() => setModal(null)}
  title={modal.mode ==='add' ?'إضافة بنك / شركة صرافة جديدة' :'تعديل بيانات البنك / الصراف'}
  icon={Landmark}
  size="lg"
  footer={null}
  closeOnBackdrop={false}
  bodyClassName="p-0"
 >

 <form onSubmit={handleSave} className="p-6 space-y-4">
 {formError && (
 <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
 <ShieldAlert className="w-4 h-4 flex-shrink-0" />
 <span>{formError}</span>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4">
  <div>
  <label className="block text-xs font-semibold text-slate-300 mb-1">كود البنك / الصراف (تلقائي)</label>
  <div className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900/60 border border-slate-700/60 font-mono font-bold text-center" dir="ltr">
  <span className={modal.form.entityType ==='BANK' ?'text-sky-400' :'text-amber-400'}>{modal.form.code || '—'}</span>
  </div>
  <p className="text-sm text-slate-500 mt-1">يُولّد تلقائياً بادئة حسب النوع: BNK-### للبنوك و EXC-### لشركات الصرافة — يتغير الكود تلقائياً عند تغيير النوع.</p>
  </div>
  <div>
  <label className="block text-xs font-semibold text-slate-300 mb-1">نوع الكيان</label>
  <select
  value={modal.form.entityType}
  onChange={e => changeEntityType(e.target.value as BankEntityType)}
  className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
  >
   <option value="BANK">بنك</option>
   <option value="EXCHANGE">شركة صرافة</option>
   </select>
   </div>
   </div>

  <div>
  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
  <Coins className="w-4 h-4 text-emerald-400" />
  العملات (تضمين / توقيف)
  </label>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
  {availableCurrencies.map(c => {
  const included = modal.form.includedCurrencies.includes(c.code);
  return (
  <button
  key={c.code}
  type="button"
  onClick={() => {
  const includedCurrencies = included
  ? modal.form.includedCurrencies.filter(code => code !== c.code)
  : [...modal.form.includedCurrencies, c.code];
  setModal({ ...modal, form: { ...modal.form, includedCurrencies}});
}}
  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
  included
  ?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
  :'border-slate-700 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
}`}
  >
  <span className="flex items-center gap-1.5">
  {included
  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  : <Power className="w-4 h-4" />}
  <span className="font-mono font-bold">{c.code}</span>
  </span>
  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${included
  ?'text-emerald-300 border-emerald-500/40 bg-emerald-500/15'
  :'text-slate-500 border-slate-700 bg-slate-800/60'
}`}>
  {included ?'تضمين' :'توقيف'}
  </span>
  </button>
  );
})}
  </div>
  <p className="text-sm text-slate-500 mt-2">
  أول عملة مضمّنة تُعتبر الافتراضية للبنك / الصراف — تُوقف العملات بدلاً من حذفها لضمان سلامة السجل المحاسبي.
  </p>
  </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">اسم البنك / الصراف بالعربية *</label>
 <input
 type="text"
 required
 value={modal.form.bankNameAr}
 onChange={e => setModal({ ...modal, form: { ...modal.form, bankNameAr: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"

 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">اسم البنك / الصراف بالإنجليزية</label>
 <input
 type="text"
 value={modal.form.bankNameEn}
 onChange={e => setModal({ ...modal, form: { ...modal.form, bankNameEn: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"

 />
 </div>
 </div>

 <div className="rounded-xl p-4 border border-slate-700/60 bg-slate-900/40">
 <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
 <CreditCard className="w-4 h-4 text-sky-400" />
 بيانات الحساب البنكي
 </p>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">رقم الحساب</label>
 <input
 type="text"
 value={modal.form.accountNumber}
 onChange={e => setModal({ ...modal, form: { ...modal.form, accountNumber: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
 dir="ltr"
 />
 </div>
  <div>
  <label className="block text-xs font-semibold text-slate-400 mb-1">رقم الآيبان (IBAN)</label>
  <input
  type="text"
  value={formatIBAN(modal.form.iban)}
  onChange={e => setModal({ ...modal, form: { ...modal.form, iban: normalizeIBAN(e.target.value)}})}
  className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono uppercase"
  dir="ltr"

  />
  {modal.form.iban && (
   isValidIBAN(modal.form.iban)
   ? <p className="text-sm text-emerald-400 mt-1">بنية الآيبان صحيحة — {normalizeIBAN(modal.form.iban).length} خانة</p>
   : <p className="text-sm text-amber-400 mt-1">الآيبان غير مكتمل — يبدأ بحرفي الدولة ثم رقمان للتحقق (15-34 خانة).</p>
  )}
  </div>
  <div>
  <label className="block text-xs font-semibold text-slate-400 mb-1">رمز السويفت (SWIFT)</label>
  <input
  type="text"
  value={modal.form.swift}
  onChange={e => setModal({ ...modal, form: { ...modal.form, swift: e.target.value.replace(/\s+/g, '').toUpperCase()}})}
  className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono uppercase"
  dir="ltr"

  />
  {modal.form.swift && (
   isValidSWIFT(modal.form.swift)
   ? <p className="text-sm text-emerald-400 mt-1">رمز السويفت صحيح ({modal.form.swift.length} خانة)</p>
   : <p className="text-sm text-amber-400 mt-1">يجب أن يكون 8 أو 11 خانة أبجدية رقمية.</p>
  )}
  </div>
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">اسم الفرع</label>
 <input
 type="text"
 value={modal.form.branchName}
 onChange={e => setModal({ ...modal, form: { ...modal.form, branchName: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">رمز الفرع</label>
 <input
 type="text"
 value={modal.form.branchCode}
 onChange={e => setModal({ ...modal, form: { ...modal.form, branchCode: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
 dir="ltr"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">الاسم على الحساب</label>
 <input
 type="text"
 value={modal.form.accountHolder}
 onChange={e => setModal({ ...modal, form: { ...modal.form, accountHolder: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"
 />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">الرصيد الافتتاحي</label>
  <AmountInput
  value={modal.form.openingBalance}
  onChange={v => setModal({ ...modal, form: { ...modal.form, openingBalance: Number(v) }})}
  className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
  />
 </div>
   <div className="col-span-3">
   <label className="block text-xs font-semibold text-slate-300 mb-1">الحساب المحاسبي المرتبط *</label>
   <select
   value={modal.form.linkedAccountId}
   onChange={e => {
     setFormError('');
     setModal({ ...modal, form: { ...modal.form, linkedAccountId: e.target.value}});
   }}
   className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white font-mono"
   dir="ltr"
   >
   <option value="">— اختر حساب بنك / صراف —</option>
  {bankPostingAccounts(accounts, modal.form.linkedAccountId).map(acc => (
  <option key={acc.id} value={acc.id}>{acc.code} - {acc.nameAr}</option>
  ))}
  </select>
  {isLinkedOutOfDomain(accounts, 'BANK', modal.form.linkedAccountId) ? (
  <p className="text-sm text-amber-400 mt-1">
  الحساب المرتبط حالياً خارج مجموعة البنوك الرئيسية — اختر حساباً من القائمة أعلاه.
  </p>
  ) : (
  <p className="text-sm text-slate-500 mt-1">
  إجباري — تعرض القائمة حسابات البنوك الرئيسية (المستوى الخامس)، وإن لم توجد تُعرض كل الحسابات النشطة.
  </p>
  )}
  </div>
 </div>

 <div className="rounded-xl p-4 border border-slate-700/60 bg-slate-900/40">
 <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
 <User className="w-4 h-4 text-sky-400" />
 بيانات التواصل
 </p>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">جهة الاتصال</label>
 <input
 type="text"
 value={modal.form.contactPerson}
 onChange={e => setModal({ ...modal, form: { ...modal.form, contactPerson: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">الهاتف</label>
 <div className="relative">
 <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <input
 type="text"
 value={modal.form.contactPhone}
 onChange={e => setModal({ ...modal, form: { ...modal.form, contactPhone: e.target.value}})}
 className="w-full px-9 py-2 text-sm glass-input rounded-xl"
 dir="ltr"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-400 mb-1">البريد الإلكتروني</label>
 <div className="relative">
 <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <input
 type="email"
 value={modal.form.contactEmail}
 onChange={e => setModal({ ...modal, form: { ...modal.form, contactEmail: e.target.value}})}
 className="w-full px-9 py-2 text-sm glass-input rounded-xl"
 dir="ltr"
 />
 </div>
 </div>
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات</label>
 <textarea
 value={modal.form.notes}
 onChange={e => setModal({ ...modal, form: { ...modal.form, notes: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"
 rows={2}

 />
 </div>

 <div className="flex items-center gap-3 rounded-xl p-3 border border-slate-700/60 bg-slate-900/40">
 <input
 type="checkbox"
 id="bank-active"
 checked={modal.form.isActive}
 onChange={e => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked}})}
 className="w-4 h-4 accent-emerald-500"
 />
 <label htmlFor="bank-active" className="text-sm text-slate-300 font-semibold cursor-pointer">
 البنك / الصراف نشط (يقبل العمليات)
 </label>
 </div>

 <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
 <button
 type="button"
 onClick={() => setModal(null)}
 className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
 >
 إلغاء
 </button>
 <button
 type="submit"
 className="px-5 py-2 text-sm font-bold rounded-xl bg-sky-500/15 hover:bg-sky-400 text-white shadow-lg transition-all cursor-pointer"
 >
 {modal.mode ==='add' ?'حفظ البنك / الصراف' :'حفظ التعديلات'}
 </button>
 </div>
 </form>
 </ModalShell>
 )}

 {/* نافذة تأكيد الحذف */}
 {deleteTarget && (
 <ModalShell
  id="bank-account-delete"
  open={!!deleteTarget}
  onClose={() => setDeleteTarget(null)}
  title="حذف البنك / الصراف"
  icon={Trash2}
  size="sm"
  footer={null}
  closeOnBackdrop={false}
  className="border-red-500/30"
 >
 <p className="text-sm text-slate-300 leading-relaxed">
  هل أنت متأكد من حذف <span className="font-bold text-white">{deleteTarget.code ? `${deleteTarget.code} - ` : ''}{deleteTarget.bankNameAr}</span>؟
 </p>
 <p className="text-xs text-amber-400 mt-2">تنبيه: تُستخدم ميزة"الإيقاف" بدلاً من الحذف عند وجود حركات مالية على الحساب.</p>
 <div className="flex justify-end gap-3 mt-6">
 <button
 onClick={() => setDeleteTarget(null)}
 className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
 >
 إلغاء
 </button>
 <button
 onClick={confirmDelete}
 className="px-5 py-2 text-sm font-bold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-lg transition-all cursor-pointer"
 >
 حذف نهائي
 </button>
 </div>
 </ModalShell>
 )}
 </div>
 );
}
