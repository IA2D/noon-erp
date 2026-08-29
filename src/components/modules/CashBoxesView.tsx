import React, { useState} from'react';
import {
  Wallet,
  Coins,
  CheckCircle2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  MapPin,
  User,
  ShieldAlert,
  Landmark
} from'lucide-react';
import { Account, AccountCurrency, Currency, JournalEntry, CashBox, CashBoxType} from'../../types/erp';
import { calculateAccountActivity, aggregateAccountBalance, cashBoxPostingAccounts, isLinkedOutOfDomain, nextEntityCode} from'../../utils/accountingEngine';
import { useActiveCurrencies, defaultIncludedCodes } from '../../hooks/useActiveCurrencies';
import { useToast} from'../ui/Toast';
import PageHeader from'../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import AmountInput from'../AmountInput';
import ModalShell from'../ui/ModalShell';

interface Props {
 cashBoxes: CashBox[];
 accounts: Account[];
 journals: JournalEntry[];
 currencies?: Currency[];
 onAddCashBox: (box: Omit<CashBox,'id'>) => void;
 onUpdateCashBox: (id: string, updates: Partial<CashBox>) => void;
 onDeleteCashBox: (id: string) => void;
}

const BOX_TYPE_LABELS: Record<CashBoxType, string> = {
 MAIN:'رئيسي',
 BRANCH:'فرعي',
 RECEPTION:'استقبال',
 OPERATIONS:'تشغيلي'
};

const BOX_TYPE_BADGES: Record<CashBoxType, string> = {
  MAIN:'bg-sky-500/20 text-sky-300 border-sky-500/30',
  BRANCH:'bg-sky-500/20 text-sky-300 border-sky-500/30',
  RECEPTION:'bg-sky-500/20 text-sky-300 border-sky-500/30',
  OPERATIONS:'bg-sky-500/20 text-sky-300 border-sky-500/30'
};

function buildCurrencies(codes: string[]): AccountCurrency[] {
  const ts = Date.now();
  return codes.map((code, i) => ({
    id: `cur-${ts}-${i}`,
    code,
    isDefault: i === 0,
    isActive: true
  }));
}

/** دمج العملات عند تعديل صندوق: تضمين/إيقاف مع الحفاظ على السجل (إيقاف بدلاً من الحذف) */
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

interface BoxForm {
  code: string;
  nameAr: string;
  nameEn: string;
  boxType: CashBoxType;
  includedCurrencies: string[];
  openingBalance: number;
  linkedAccountId: string;
  responsibleName: string;
  location: string;
  notes: string;
  isActive: boolean;
}

function emptyForm(code: string, includedCurrencies: string[]): BoxForm {
  return {
  code,
  nameAr:'',
  nameEn:'',
  boxType:'MAIN',
  includedCurrencies,
  openingBalance: 0,
  linkedAccountId:'',
  responsibleName:'',
  location:'',
  notes:'',
  isActive: true
};
}

function nextBoxCode(boxes: CashBox[]): string {
 // يُولّد تلقائياً الكود التسلسلي التالي للصندوق (MAX+1): CSH-###
 // مع مراعاة أكواد BX-### القديمة — CSH-001 -> CSH-002.
 return nextEntityCode(boxes, 'CSH', ['BX']);
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2});

export default function CashBoxesView({ cashBoxes, accounts, journals, currencies, onAddCashBox, onUpdateCashBox, onDeleteCashBox}: Props) {
 const toast = useToast();
 const [searchTerm, setSearchTerm] = useState('');
 const [modal, setModal] = useState<{ mode:'add' |'edit'; id?: string; form: BoxForm} | null>(null);
 const [formError, setFormError] = useState('');
 const [deleteTarget, setDeleteTarget] = useState<CashBox | null>(null);

 const { options: currencyOptions } = useActiveCurrencies(currencies);
 const defaultCodes = defaultIncludedCodes(currencies);

 const activity = calculateAccountActivity(accounts, journals);

 const boxBalance = (box: CashBox): number => {
 if (!box.linkedAccountId) return box.openingBalance;
 const linked = accounts.find(a => a.id === box.linkedAccountId);
 if (!linked) return box.openingBalance;
 return aggregateAccountBalance(linked, accounts, activity);
};

 const linkedName = (id?: string): string => {
 if (!id) return'—';
 const acc = accounts.find(a => a.id === id);
 return acc ? `${acc.code} - ${acc.nameAr}` :'—';
};

 const filtered = cashBoxes.filter(b => {
 const term = searchTerm.trim().toLowerCase();
 if (!term) return true;
 return (
 b.code.toLowerCase().includes(term) ||
 b.nameAr.includes(searchTerm.trim()) ||
 b.nameEn.toLowerCase().includes(term) ||
 (b.responsibleName ||'').includes(searchTerm.trim()) ||
 (b.location ||'').includes(searchTerm.trim())
 );
});

 const activeCount = cashBoxes.filter(b => b.isActive).length;
 const totalBalance = cashBoxes.reduce((sum, b) => sum + boxBalance(b), 0);

 const openAdd = () => {
 setFormError('');
  setModal({ mode:'add', form: emptyForm(nextBoxCode(cashBoxes), defaultCodes)});
};

  const openEdit = (box: CashBox) => {
  setFormError('');
  setModal({
  mode:'edit',
  id: box.id,
  form: {
  code: box.code,
  nameAr: box.nameAr,
  nameEn: box.nameEn,
  boxType: box.boxType,
  includedCurrencies: (box.currencies || []).filter(c => c.isActive).map(c => c.code),
  openingBalance: box.openingBalance,
  linkedAccountId: box.linkedAccountId ||'',
  responsibleName: box.responsibleName ||'',
  location: box.location ||'',
  notes: box.notes ||'',
  isActive: box.isActive
}
});
};

 const changeBoxType = (type: CashBoxType) => {
  setModal(prev => {
    if (!prev) return prev;
    const form = { ...prev.form, boxType: type };
    if (prev.mode === 'add') {
      form.code = nextBoxCode(cashBoxes);
    }
    return { ...prev, form };
  });
 };

 const handleSave = (e: React.FormEvent) => {
 e.preventDefault();
 if (!modal) return;
  const f = modal.form;
  const entityCode = f.code.trim();
   if (!entityCode) {
     setFormError('كود الصندوق مطلوب.');
     return;
   }
   if (!f.nameAr.trim()) {
     setFormError('اسم الصندوق بالعربية مطلوب.');
     return;
   }
   if (!f.linkedAccountId) {
    setFormError('يجب ربط الصندوق بحساب رئيسي من دليل الحسابات (حساب صندوق نقدي من المستوى الخامس).');
    return;
  }
   if (f.includedCurrencies.length === 0) {
    setFormError('يجب تضمين عملة واحدة على الأقل للصندوق.');
    return;
  }
   if (modal.mode ==='add') {
   if (cashBoxes.some(b => b.code.toLowerCase() === entityCode.toLowerCase())) {
   setFormError(`كود الصندوق ${entityCode} مستخدم مسبقاً — لا يمكن تكرار الكود.`);
   return;
 }
   onAddCashBox({
   code: entityCode,
  nameAr: f.nameAr.trim(),
  nameEn: f.nameEn.trim(),
  boxType: f.boxType,
  currencies: buildCurrencies(f.includedCurrencies),
  defaultCurrency: f.includedCurrencies[0] ||'YER',
  openingBalance: Number(f.openingBalance) || 0,
  linkedAccountId: f.linkedAccountId || undefined,
  responsibleName: f.responsibleName.trim(),
  location: f.location.trim(),
  notes: f.notes.trim(),
  isActive: f.isActive,
  createdAt: new Date().toISOString().substring(0, 10)
});
  toast('success', `تم إنشاء الصندوق ${entityCode} - ${f.nameAr.trim()}`);
} else if (modal.id) {
  const editing = cashBoxes.find(b => b.id === modal.id);
  onUpdateCashBox(modal.id, {
  code: entityCode,
  nameAr: f.nameAr.trim(),
  nameEn: f.nameEn.trim(),
  boxType: f.boxType,
  currencies: mergeCurrencies(editing?.currencies || [], f.includedCurrencies),
  defaultCurrency: f.includedCurrencies[0] || editing?.defaultCurrency ||'YER',
  openingBalance: Number(f.openingBalance) || 0,
  linkedAccountId: f.linkedAccountId || undefined,
  responsibleName: f.responsibleName.trim(),
  location: f.location.trim(),
  notes: f.notes.trim(),
  isActive: f.isActive
});
  toast('success', `تم تحديث بيانات الصندوق ${entityCode}`);
}
 setModal(null);
};

 const confirmDelete = () => {
 if (!deleteTarget) return;
 onDeleteCashBox(deleteTarget.id);
 toast('success', `تم حذف الصندوق ${deleteTarget.code} - ${deleteTarget.nameAr}`);
 setDeleteTarget(null);
};

 return (
 <div className="space-y-6 animate-fade-in">
 <PageHeader
 icon={<Wallet className="w-6 h-6" />}
 title="بيانات الصناديق"
 subtitle="إدارة الصناديق النقدية للشركة — الربط بالحسابات المحاسبية ومتابعة الأرصدة"
 actions={
 <button
 onClick={openAdd}
 className="flex items-center gap-2 bg-sky-500/15 hover:bg-sky-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
 >
 <Plus className="w-4 h-4" />
 إضافة صندوق جديد
 </button>
}
 />

 {/* الإحصائيات */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">إجمالي الصناديق</div>
 <div className="text-2xl font-black text-white mt-1">{cashBoxes.length}</div>
 </div>
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">صناديق نشطة</div>
 <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
 </div>
 <div className="glass p-4 rounded-2xl border border-slate-700/50">
 <div className="text-xs text-slate-400">مربوطة بحسابات محاسبية</div>
 <div className="text-2xl font-black text-sky-400 mt-1">{cashBoxes.filter(b => b.linkedAccountId).length}</div>
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
  { label: 'الكود', render: (b: CashBox) => <span className="font-mono font-bold text-sky-400">{b.code}</span> },
  { label: 'الاسم', render: (b: CashBox) => (
  <div>
  <div className="font-bold text-white">{b.nameAr}</div>
  <div className="text-sm text-slate-400 font-mono">{b.nameEn}</div>
  </div>
  ) },
  { label: 'المسؤول', render: (b: CashBox) => <span className="text-slate-300">{b.responsibleName || '—'}</span> },
  { label: 'الموقع', render: (b: CashBox) => <span className="text-slate-300">{b.location || '—'}</span> }
  ]}
  searchText={b => `${b.code} ${b.nameAr} ${b.nameEn} ${b.responsibleName || ''} ${b.location || ''}`}
  browseTitle="استعراض الصناديق"
  />
  </div>
 </div>

 {/* القائمة */}
 <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
 <div className="overflow-x-auto custom-scrollbar">
  <div className="min-w-[1060px]">
  {filtered.map(box => (
  <div key={box.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-white/5 transition-colors ${!box.isActive ?'opacity-50' :''}`}>
  <div className="w-12 flex-shrink-0 flex items-center justify-center">
  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-xs font-bold">
  {cashBoxes.indexOf(box) + 1}
  </span>
  </div>
  <div className="flex items-center gap-3 flex-1 min-w-[260px]">
 <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20 flex-shrink-0">
 <Coins className="w-4 h-4" />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-mono font-bold text-sky-400 text-sm">{box.code}</span>
 <span className="font-bold text-white whitespace-nowrap">{box.nameAr}</span>
 </div>
 <div className="text-sm text-slate-400 font-mono whitespace-nowrap">{box.nameEn}</div>
 </div>
 </div>

 <div className="w-24 flex-shrink-0">
 <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${BOX_TYPE_BADGES[box.boxType]}`}>
 {BOX_TYPE_LABELS[box.boxType]}
 </span>
 </div>

 <div className="w-32 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
 <MapPin className="w-3.5 h-3.5" />
 <span className="truncate">{box.location ||'—'}</span>
 </div>

 <div className="w-36 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
 <User className="w-3.5 h-3.5" />
 <span className="truncate">{box.responsibleName ||'—'}</span>
 </div>

 <div className="w-40 flex-shrink-0">
 <div className="text-sm text-slate-500">الرصيد الحالي</div>
 <div className="font-mono font-bold text-white text-sm">{fmt(boxBalance(box))} <span className="text-slate-400 text-xs">{box.defaultCurrency}</span></div>
 </div>

 <div className="w-44 flex-shrink-0">
 <div className="text-sm text-slate-500">الحساب المرتبط</div>
 <div className="text-xs text-sky-300 truncate" dir="ltr">{linkedName(box.linkedAccountId)}</div>
 </div>

 <div className="w-20 flex-shrink-0">
 <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border ${box.isActive
 ?'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
 :'bg-slate-800 text-slate-400 border-slate-700'
}`}>
 <Power className="w-3 h-3" />
 {box.isActive ?'نشط' :'موقوف'}
 </span>
 </div>

 <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
 <button
 onClick={() => openEdit(box)}
 title="تعديل الصندوق"
 className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button
 onClick={() => setDeleteTarget(box)}
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
 <Landmark className="w-10 h-10 text-slate-600" />
 <p className="font-bold text-white">لا توجد صناديق مطابقة</p>
 <p className="text-sm">جرّب تغيير نص البحث أو أضف صندوقاً جديداً</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* نافذة الإضافة / التعديل */}
 {modal && (
 <ModalShell
  id="cashbox-form"
  open={!!modal}
  onClose={() => setModal(null)}
  title={modal.mode ==='add' ?'إضافة صندوق نقدي جديد' :'تعديل بيانات الصندوق'}
  icon={Wallet}
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
  <label className="block text-xs font-semibold text-slate-300 mb-1">كود الصندوق (تلقائي)</label>
  <div className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900/60 border border-slate-700/60 font-mono font-bold text-sky-400 text-center" dir="ltr">
  {modal.form.code || '—'}
  </div>
  <p className="text-sm text-slate-500 mt-1">يولّد تلقائياً بدلالة التسلسل CSH-### للصناديق الرئيسية والفرعية.</p>
  </div>
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">نوع الصندوق</label>
 <select
 value={modal.form.boxType}
 onChange={e => changeBoxType(e.target.value as CashBoxType)}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
 >
 {(Object.keys(BOX_TYPE_LABELS) as CashBoxType[]).map(t => (
 <option key={t} value={t}>{BOX_TYPE_LABELS[t]}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الصندوق بالعربية *</label>
 <input
 type="text"
 required
 value={modal.form.nameAr}
 onChange={e => setModal({ ...modal, form: { ...modal.form, nameAr: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"

 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الصندوق بالإنجليزية</label>
 <input
 type="text"
 value={modal.form.nameEn}
 onChange={e => setModal({ ...modal, form: { ...modal.form, nameEn: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"

 />
 </div>
 </div>

  <div className="grid grid-cols-3 gap-4">
  <div className="col-span-3">
  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
  <Coins className="w-4 h-4 text-emerald-400" />
  العملات (تضمين / توقيف)
  </label>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
  {currencyOptions.map(c => {
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
  أول عملة مضمّنة تُعتبر الافتراضية للصندوق — تُوقف العملات بدلاً من حذفها لضمان سلامة السجل المحاسبي.
  </p>
  </div>
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
   <option value="">— اختر حساب صندوق نقدي —</option>
   {cashBoxPostingAccounts(accounts, modal.form.linkedAccountId).map(acc => (
   <option key={acc.id} value={acc.id}>{acc.code} - {acc.nameAr}</option>
   ))}
   </select>
   {isLinkedOutOfDomain(accounts, 'CASH_BOX', modal.form.linkedAccountId) ? (
   <p className="text-sm text-amber-400 mt-1">
   الحساب المرتبط حالياً خارج مجموعة الصناديق النقدية الرئيسية — اختر حساباً من القائمة أعلاه.
   </p>
   ) : (
   <p className="text-sm text-slate-500 mt-1">
    إجباري — تعرض القائمة حسابات الصناديق النقدية الرئيسية (المستوى الخامس)، وإن لم توجد تُعرض كل الحسابات النشطة.
   </p>
   )}
   </div>
  </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">أمين الصندوق / المسؤول</label>
 <div className="relative">
 <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <input
 type="text"
 value={modal.form.responsibleName}
 onChange={e => setModal({ ...modal, form: { ...modal.form, responsibleName: e.target.value}})}
 className="w-full px-9 py-2 text-sm glass-input rounded-xl"

 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">الموقع / الفرع</label>
 <div className="relative">
 <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <input
 type="text"
 value={modal.form.location}
 onChange={e => setModal({ ...modal, form: { ...modal.form, location: e.target.value}})}
 className="w-full px-9 py-2 text-sm glass-input rounded-xl"

 />
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
 id="box-active"
 checked={modal.form.isActive}
 onChange={e => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked}})}
 className="w-4 h-4 accent-emerald-500"
 />
 <label htmlFor="box-active" className="text-sm text-slate-300 font-semibold cursor-pointer">
 الصندوق نشط (يقبل العمليات النقدية)
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
  {modal.mode ==='add' ?'حفظ الصندوق' :'حفظ التعديلات'}
 </button>
 </div>
 </form>
 </ModalShell>
 )}

 {/* نافذة تأكيد الحذف */}
 {deleteTarget && (
 <ModalShell
  id="cashbox-delete"
  open={!!deleteTarget}
  onClose={() => setDeleteTarget(null)}
  title="حذف الصندوق"
  icon={Trash2}
  size="sm"
  footer={null}
  closeOnBackdrop={false}
  className="border-red-500/30"
  bodyClassName="p-6"
 >
 <p className="text-sm text-slate-300 leading-relaxed">
 هل أنت متأكد من حذف الصندوق <span className="font-bold text-white">{deleteTarget.code} - {deleteTarget.nameAr}</span>؟
 </p>
 <p className="text-xs text-amber-400 mt-2">تنبيه: تُستخدم ميزة"الإيقاف" بدلاً من الحذف عند وجود حركات مالية على الصندوق.</p>
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
