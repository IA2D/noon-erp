import React, { useState } from 'react';
import {
 CircleDollarSign,
 Plus,
 Search,
 Pencil,
  Trash2,
  Star,
 Power,
 ShieldAlert,
  CheckCircle2,
  Globe,
  Hash,
  Banknote,
  Landmark,
  Wallet,
  BookOpen
} from 'lucide-react';
import { Currency, Account, CashBox, BankAccount, JournalEntry } from '../../types/erp';
import { useToast } from '../ui/Toast';
import PageHeader from '../ui/PageHeader';
import EmptyState from '../ui/EmptyState';
import F9SearchInput from '../ui/F9SearchInput';
import ModalShell from '../ui/ModalShell';

/** العملات الأساسية المهيأة مع النظام وغير القابلة للحذف. */
const FIXED_CURRENCY_CODES = ['YER', 'SAR', 'USD'];

interface Props {
 currencies: Currency[];
 accounts: Account[];
 cashBoxes: CashBox[];
 bankAccounts: BankAccount[];
 journals: JournalEntry[];
 onAddCurrency: (currency: Omit<Currency, 'id' | 'createdAt'>) => void;
 onUpdateCurrency: (id: string, updates: Partial<Currency>) => void;
 onDeleteCurrency: (id: string) => void;
}

interface CurrencyForm {
 code: string;
 nameAr: string;
 nameEn: string;
 symbol: string;
 decimals: number;
 isBase: boolean;
 exchangeRate: number;
 minExchangeRate: number;
 maxExchangeRate: number;
 isActive: boolean;
}

function emptyForm(code: string): CurrencyForm {
 return { code, nameAr: '', nameEn: '', symbol: '', decimals: 2, isBase: false, exchangeRate: 1, minExchangeRate: 1, maxExchangeRate: 1, isActive: true };
}

const fmtRate = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });

interface UsageBreakdown {
 accounts: number;
 cashBoxes: number;
 bankAccounts: number;
 journals: number;
 total: number;
}

export default function CurrenciesView({ currencies, accounts, cashBoxes, bankAccounts, journals, onAddCurrency, onUpdateCurrency, onDeleteCurrency }: Props) {
 const toast = useToast();
 const [searchTerm, setSearchTerm] = useState('');
 const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string; form: CurrencyForm } | null>(null);
 const [formError, setFormError] = useState('');
 const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null);
 const [dependTarget, setDependTarget] = useState<{ currency: Currency; usage: UsageBreakdown } | null>(null);

 const usageDetailsOf = (code: string): UsageBreakdown => {
  const accountsCount = accounts.filter(a => a.currencies && a.currencies.some(c => c.code === code)).length;
  const cashBoxesCount = cashBoxes.filter(b => b.currencies && b.currencies.some(c => c.code === code)).length;
  const bankAccountsCount = bankAccounts.filter(b => b.currencies && b.currencies.some(c => c.code === code)).length;
  const journalsCount = journals.filter(j => j.currency === code).length;
  return {
   accounts: accountsCount,
   cashBoxes: cashBoxesCount,
   bankAccounts: bankAccountsCount,
   journals: journalsCount,
   total: accountsCount + cashBoxesCount + bankAccountsCount + journalsCount
  };
 };

 const usageOf = (code: string): number => usageDetailsOf(code).total;

 const baseCurrency = currencies.find(c => c.isBase);
 const activeCount = currencies.filter(c => c.isActive).length;
 const inactiveCount = currencies.filter(c => !c.isActive).length;

 const filtered = currencies.filter(c => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;
  return (
   c.code.toLowerCase().includes(term) ||
   c.nameAr.includes(searchTerm.trim()) ||
   c.nameEn.toLowerCase().includes(term) ||
   c.symbol.toLowerCase().includes(term)
  );
 });

 const openAdd = () => {
  setFormError('');
  setModal({ mode: 'add', form: emptyForm('') });
 };

 const openEdit = (c: Currency) => {
  setFormError('');
  setModal({
   mode: 'edit',
   id: c.id,
   form: {
    code: c.code,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    symbol: c.symbol || c.code,
    decimals: c.decimals,
    isBase: c.isBase,
    exchangeRate: c.exchangeRate,
    minExchangeRate: typeof c.minExchangeRate === 'number' ? c.minExchangeRate : 1,
    maxExchangeRate: typeof c.maxExchangeRate === 'number' ? c.maxExchangeRate : 1,
    isActive: c.isActive
   }
  });
 };

 const handleSave = (e: React.FormEvent) => {
  e.preventDefault();
  if (!modal) return;
  const f = modal.form;
  const code = f.code.trim().toUpperCase();
  if (!code) { setFormError('رمز العملة مطلوب.'); return; }
  if (!f.nameAr.trim()) { setFormError('اسم العملة بالعربية مطلوب.'); return; }
  if (!f.nameEn.trim()) { setFormError('اسم العملة بالإنجليزية مطلوب.'); return; }
   if (!f.symbol.trim()) { setFormError('رمز العرض مطلوب (مثال: ر.ي / $).'); return; }
  if (currencies.some(c => c.code.toUpperCase() === code && c.id !== modal.id)) { setFormError('رمز العملة مستخدم مسبقاً — استخدم رمزاً فريداً (مثل YER).'); return; }
  const rate = Number(f.exchangeRate) || 0;
  if (rate <= 0) { setFormError('سعر التحويل يجب أن يكون أكبر من صفر.'); return; }
  const minRate = Number(f.minExchangeRate) || 0;
  const maxRate = Number(f.maxExchangeRate) || 0;
  if (minRate <= 0 || maxRate <= 0) { setFormError('أدنى وأعلى سعر تحويل يجب أن يكونا أكبر من صفر.'); return; }
  if (minRate > rate || maxRate < rate) { setFormError('تحقق من نطاق التحويل: أدنى سعر ≤ سعر التحويل ≤ أعلى سعر.'); return; }

  if (modal.mode === 'add') {
   onAddCurrency({
    code,
    nameAr: f.nameAr.trim(),
    nameEn: f.nameEn.trim(),
    symbol: f.symbol.trim(),
    decimals: Number(f.decimals) || 2,
    isBase: f.isBase,
    exchangeRate: f.isBase ? 1 : rate,
    minExchangeRate: f.isBase ? 1 : minRate,
    maxExchangeRate: f.isBase ? 1 : maxRate,
    isActive: f.isActive
   });
   toast('success', `تمت إضافة العملة ${code} - ${f.nameAr.trim()}`);
  } else if (modal.id) {
   onUpdateCurrency(modal.id, {
    code,
    nameAr: f.nameAr.trim(),
    nameEn: f.nameEn.trim(),
    symbol: f.symbol.trim(),
    decimals: Number(f.decimals) || 2,
    isBase: f.isBase,
    exchangeRate: f.isBase ? 1 : rate,
    minExchangeRate: f.isBase ? 1 : minRate,
    maxExchangeRate: f.isBase ? 1 : maxRate,
    isActive: f.isActive
   });
   toast('success', `تم تحديث العملة ${code}`);
  }
  setModal(null);
 };

 const toggleActive = (c: Currency) => {
  if (c.isBase) { toast('error', 'لا يمكن إيقاف العملة الأساسية للنظام.'); return; }
  if (FIXED_CURRENCY_CODES.includes(c.code)) { toast('error', `لا يمكن إيقاف العملة ${c.code} — هي عملة ثابتة في النظام.`); return; }
  onUpdateCurrency(c.id, { isActive: !c.isActive });
  toast('info', `تم ${c.isActive ? 'إيقاف' : 'تفعيل'} العملة ${c.code}.`);
 };

 const openDelete = (c: Currency) => {
  if (c.isBase) { toast('error', 'لا يمكن حذف العملة الأساسية للنظام.'); return; }
  if (FIXED_CURRENCY_CODES.includes(c.code)) { toast('error', `لا يمكن حذف العملة ${c.code} — هي عملة ثابتة في النظام.`); return; }
  const usage = usageDetailsOf(c.code);
  if (usage.total > 0) {
   setDependTarget({ currency: c, usage });
   return;
  }
  setDeleteTarget(c);
 };

 const deactivateCurrency = () => {
  if (!dependTarget) return;
  onUpdateCurrency(dependTarget.currency.id, { isActive: false });
  toast('info', `تم تعطيل العملة ${dependTarget.currency.code} - ${dependTarget.currency.nameAr} بدلاً من حذفها.`);
  setDependTarget(null);
 };

 const confirmDelete = () => {
  if (!deleteTarget) return;
  onDeleteCurrency(deleteTarget.id);
  toast('success', `تم حذف العملة ${deleteTarget.code} - ${deleteTarget.nameAr}`);
  setDeleteTarget(null);
 };

 return (
  <div className="space-y-6 animate-fade-in">
   <PageHeader
    icon={<CircleDollarSign className="w-6 h-6" />}
    title="دليل العملات"
    subtitle="إدارة العملات المعتمدة في النظام ورموزها وأسعار التحويل"
    actions={
      <button
       type="button"
       onClick={openAdd}
       className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
      >
       <Plus className="w-4 h-4" />
       إضافة عملة جديدة
      </button>
    }
   />

   {/* الإحصائيات */}
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div className="glass p-4 rounded-2xl border border-slate-700/50">
     <div className="text-xs text-slate-400">إجمالي العملات</div>
     <div className="text-2xl font-black text-white mt-1">{currencies.length}</div>
     <div className="text-sm text-slate-500 mt-1">دليل العملات المعتمد</div>
    </div>
    <div className="glass p-4 rounded-2xl border border-slate-700/50">
     <div className="text-xs text-slate-400">عملات نشطة</div>
     <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
     <div className="text-sm text-slate-500 mt-1">متاحة للاستخدام في القيود</div>
    </div>
    <div className="glass p-4 rounded-2xl border border-slate-700/50">
     <div className="text-xs text-slate-400">عملات معطلة</div>
     <div className="text-2xl font-black text-red-400 mt-1">{inactiveCount}</div>
     <div className="text-sm text-slate-500 mt-1">موقوفة ولا تظهر في الاختيارات</div>
    </div>
    <div className="glass p-4 rounded-2xl border border-blue-500/30 bg-gradient-to-l from-blue-500/10 to-transparent">
     <div className="text-xs text-slate-400">العملة الأساسية</div>
     <div className="text-2xl font-black text-blue-400 mt-1">{baseCurrency ? baseCurrency.code : '—'}</div>
     <div className="text-sm text-slate-500 mt-1">{baseCurrency ? baseCurrency.nameAr : 'لا توجد عملة أساسية'}</div>
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
        { label: 'الرمز', render: (c: Currency) => <span className="font-mono font-bold text-sky-400">{c.code}</span> },
        { label: 'الاسم', render: (c: Currency) => (
         <div>
          <div className="font-bold text-white">{c.nameAr}</div>
          <div className="text-sm text-slate-400 font-mono">{c.nameEn}</div>
         </div>
        ) },
        { label: 'رمز العرض', render: (c: Currency) => <span className="font-mono font-bold text-white">{c.symbol || c.code}</span> }
       ]}
       searchText={c => `${c.code} ${c.nameAr} ${c.nameEn} ${c.symbol}`}
       browseTitle="استعراض العملات"
      />
     </div>
   </div>

   {/* جدول العملات */}
   <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
    <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
     <h3 className="font-bold text-white text-sm flex items-center gap-2">
      <Globe className="w-4 h-4 text-sky-400" />
      قائمة العملات
     </h3>
     <span className="text-xs text-slate-400 font-semibold">{filtered.length} عملة</span>
    </div>
    <div className="overflow-x-auto custom-scrollbar">
     <table className="w-full text-right text-sm">
      <thead className="bg-slate-900/60 text-slate-300 font-bold border-b border-slate-800">
       <tr>
        <th className="py-3.5 px-4">الرمز</th>
        <th className="py-3.5 px-4">الاسم</th>
        <th className="py-3.5 px-4">رمز العرض</th>
         <th className="py-3.5 px-4">الخانات</th>
         <th className="py-3.5 px-4">نطاق سعر التحويل</th>
        <th className="py-3.5 px-4">الاستخدام</th>
        <th className="py-3.5 px-4">الحالة</th>
        <th className="py-3.5 px-4">إجراءات</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60">
       {filtered.length === 0 && (
        <tr>
         <td colSpan={8} className="p-6">
          <EmptyState
           title="لا توجد عملات مطابقة"
           description={searchTerm.trim() ? 'جرّب تغيير نص البحث.' : 'ابدأ بإضافة أول عملة عبر زر (إضافة عملة جديدة).'}
           compact
           icon={<CircleDollarSign className="w-5 h-5" />}
          />
         </td>
        </tr>
       )}
       {filtered.map(c => {
        const usage = usageOf(c.code);
        return (
         <tr key={c.id} className="hover:bg-white/5">
          <td className="py-3 px-4">
           <div className="flex items-center gap-2">
             <div className={`p-1.5 rounded-lg border flex-shrink-0 ${c.isBase ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
             <CircleDollarSign className="w-4 h-4" />
            </div>
            <span className="font-mono font-bold text-sky-400">{c.code}</span>
            {c.isBase && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-300 border-blue-500/30">
              <Star className="w-3 h-3" />
              أساسية
             </span>
            )}
           </div>
          </td>
          <td className="py-3 px-4">
           <div className="font-bold text-white">{c.nameAr}</div>
           <div className="text-sm text-slate-400 font-mono">{c.nameEn}</div>
          </td>
           <td className="py-3 px-4 font-mono font-bold text-white">{c.symbol || c.code}</td>
          <td className="py-3 px-4">
           <span className="inline-flex items-center gap-1 text-xs text-slate-300 font-mono">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            {c.decimals}
           </span>
          </td>
          <td className="py-3 px-4">
           <div className="inline-flex items-stretch gap-1 font-mono text-xs">
            <div className="text-center px-1.5">
             <div className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">أدنى</div>
             <div className="text-slate-400">{fmtRate(c.minExchangeRate)}</div>
            </div>
            <div className="text-center px-2 rounded-lg bg-sky-500/10 border border-sky-500/25 flex flex-col justify-center">
             <div className="text-[9px] text-sky-400 font-semibold">التحويل</div>
              <div className={`font-bold ${c.isBase ? 'text-blue-400' : 'text-white'}`}>{fmtRate(c.exchangeRate)}</div>
            </div>
            <div className="text-center px-1.5">
             <div className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">أعلى</div>
             <div className="text-slate-400">{fmtRate(c.maxExchangeRate)}</div>
            </div>
           </div>
          </td>
          <td className="py-3 px-4">
           <span className={`inline-flex items-center gap-1 text-sm font-bold font-mono px-2 py-1 rounded-full border ${usage > 0 ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'}`}>
            {usage} استخدام
           </span>
          </td>
          <td className="py-3 px-4">
           <span className={`inline-flex text-sm font-bold px-2 py-1 rounded-full border ${c.isActive ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30'}`}>
            {c.isActive ? 'نشطة' : 'معطلة'}
           </span>
          </td>
          <td className="py-3 px-4">
           <div className="flex items-center gap-1.5">
            <button
             type="button"
             onClick={() => openEdit(c)}
             title="تعديل العملة"
             className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
            >
             <Pencil className="w-4 h-4" />
            </button>
            <button
             type="button"
             onClick={() => toggleActive(c)}
             title={c.isActive ? 'إيقاف العملة' : 'تفعيل العملة'}
             className={`p-1.5 rounded-lg transition-colors cursor-pointer ${c.isActive ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30'}`}
            >
             <Power className="w-4 h-4" />
            </button>
             {!FIXED_CURRENCY_CODES.includes(c.code) && (
             <button
              type="button"
              onClick={() => openDelete(c)}
              title="حذف العملة"
              className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
             >
              <Trash2 className="w-4 h-4" />
             </button>
             )}
           </div>
          </td>
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
   </div>

   {/* نافذة الإضافة / التعديل */}
   {modal && (
    <ModalShell
     id="currency-form"
     open={!!modal}
     onClose={() => setModal(null)}
     title={modal.mode === 'add' ? 'إضافة عملة جديدة' : 'تعديل بيانات العملة'}
     icon={CircleDollarSign}
     size="md"
     footer={null}
     closeOnBackdrop={false}
     bodyClassName="p-0"
    >

      <form onSubmit={handleSave} className="flex flex-1 flex-col min-h-0">
       <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
        {formError && (
         <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{formError}</span>
         </div>
        )}

        <div className="grid grid-cols-2 gap-4">
         <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">رمز العرض *</label>
          <input
           type="text"
           required
           value={modal.form.symbol}
           onChange={e => setModal({ ...modal, form: { ...modal.form, symbol: e.target.value } })}
           className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
           dir="ltr"

          />
         </div>
         <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">رمز العملة *</label>
          <input
           type="text"
           required
           value={modal.form.code}
           onChange={e => setModal({ ...modal, form: { ...modal.form, code: e.target.value.toUpperCase() } })}
           className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
           dir="ltr"

          />
         </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
         <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">اسم العملة بالعربية *</label>
          <input
           type="text"
           required
           value={modal.form.nameAr}
           onChange={e => setModal({ ...modal, form: { ...modal.form, nameAr: e.target.value } })}
           className="w-full px-3 py-2 text-sm glass-input rounded-xl"

          />
         </div>
         <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">اسم العملة بالإنجليزية *</label>
          <input
           type="text"
           required
           value={modal.form.nameEn}
           onChange={e => setModal({ ...modal, form: { ...modal.form, nameEn: e.target.value } })}
           className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
           dir="ltr"

          />
         </div>
        </div>

         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-xs font-semibold text-slate-300 mb-1">عدد الخانات العشرية</label>
           <input
            type="number"
            min="0"
            max="4"
            step="1"
            value={modal.form.decimals}
            onChange={e => setModal({ ...modal, form: { ...modal.form, decimals: Number(e.target.value) } })}
            className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
           />
          </div>
         </div>

         <div className="grid grid-cols-3 gap-4">
          <div>
           <label className="block text-xs font-semibold text-slate-300 mb-1">أدنى سعر تحويل *</label>
           <input
            type="number"
            min="0.0001"
            step="0.0001"
            required
            disabled={modal.form.isBase}
            value={modal.form.minExchangeRate}
            onChange={e => setModal({ ...modal, form: { ...modal.form, minExchangeRate: Number(e.target.value) } })}
            className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono disabled:opacity-50"
            dir="ltr"
           />
          </div>
          <div>
           <label className="block text-xs font-semibold text-slate-300 mb-1">سعر التحويل *</label>
           <input
            type="number"
            min="0.0001"
            step="0.0001"
            required
            disabled={modal.form.isBase}
            value={modal.form.exchangeRate}
            onChange={e => setModal({ ...modal, form: { ...modal.form, exchangeRate: Number(e.target.value) } })}
            className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono disabled:opacity-50"
            dir="ltr"
           />
          </div>
          <div>
           <label className="block text-xs font-semibold text-slate-300 mb-1">أعلى سعر تحويل *</label>
           <input
            type="number"
            min="0.0001"
            step="0.0001"
            required
            disabled={modal.form.isBase}
            value={modal.form.maxExchangeRate}
            onChange={e => setModal({ ...modal, form: { ...modal.form, maxExchangeRate: Number(e.target.value) } })}
            className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono disabled:opacity-50"
            dir="ltr"
           />
          </div>
         </div>

        <div className="grid grid-cols-2 gap-4">
         <label className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-slate-700/60 cursor-pointer">
          <input
           type="checkbox"
           checked={modal.form.isBase}
           onChange={e => setModal({ ...modal, form: { ...modal.form, isBase: e.target.checked, exchangeRate: e.target.checked ? 1 : modal.form.exchangeRate, minExchangeRate: e.target.checked ? 1 : modal.form.minExchangeRate, maxExchangeRate: e.target.checked ? 1 : modal.form.maxExchangeRate } })}
           className="accent-sky-500 w-4 h-4"
          />
          <span className="text-xs font-bold text-slate-200">عملة أساسية للنظام</span>
         </label>
         <label className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-slate-700/60 cursor-pointer">
          <input
           type="checkbox"
           checked={modal.form.isActive}
           onChange={e => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked } })}
           className="accent-emerald-500 w-4 h-4"
          />
          <span className="text-xs font-bold text-slate-200">عملة نشطة</span>
         </label>
        </div>

        {modal.form.isBase && (
         <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
          <Star className="w-4 h-4 flex-shrink-0" />
          <span>عند اعتماد هذه العملة كأساسية سيتم إلغاء الأساسية السابقة تلقائياً، ويُثبَّت نطاق التحويل بالكامل عند 1.</span>
         </div>
        )}

        <p className="text-sm text-slate-500 flex items-center gap-2">
         <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-sky-400" />
         العملات النشطة تظهر كخيارات في الحسابات والصناديق والبنوك والقيود. تأكد من صحة النطاق: أدنى سعر ≤ سعر التحويل ≤ أعلى سعر.
        </p>
       </div>

       <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/70 flex-shrink-0 flex justify-end gap-3">
        <button
         type="button"
         onClick={() => setModal(null)}
         className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
        >
         إلغاء
        </button>
        <button
         type="submit"
         className="px-5 py-2 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-[#ffffff] shadow-lg transition-all cursor-pointer"
        >
         {modal.mode === 'add' ? 'حفظ العملة' : 'حفظ التعديلات'}
        </button>
        </div>
       </form>
    </ModalShell>
    )}

   {/* نافذة تعذر الحذف — العملة مستخدمة */}
   {dependTarget && (
    <ModalShell
     id="currency-dependency"
     open={!!dependTarget}
     onClose={() => setDependTarget(null)}
     title="لا يمكن حذف العملة"
     icon={ShieldAlert}
     size="md"
     footer={null}
     closeOnBackdrop={false}
     className="border-amber-500/30"
     bodyClassName="p-0"
    >
       <p className="text-sm text-slate-300 leading-relaxed">
        لا يمكن حذف عملة <span className="font-bold text-white">{dependTarget.currency.nameAr} ({dependTarget.currency.code})</span>
        {' '}لأنها مرتبطة بـ <span className="font-bold text-amber-400">{dependTarget.usage.total} استخدام</span>.
        أوقف العملة بدلاً من الحذف، أو قم بفك الارتباطات أولاً.
       </p>

       <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="bg-slate-800/50 px-4 py-2 text-xs font-bold text-slate-300 border-b border-slate-700">
         أماكن استخدام العملة ({dependTarget.usage.total})
        </div>
        <div className="divide-y divide-slate-800/60 text-[14px]">
         {[
          { label: 'الحسابات المحاسبية', icon: <Banknote className="w-4 h-4" />, count: dependTarget.usage.accounts },
          { label: 'الصناديق النقدية', icon: <Wallet className="w-4 h-4" />, count: dependTarget.usage.cashBoxes },
          { label: 'البنوك والصرافين', icon: <Landmark className="w-4 h-4" />, count: dependTarget.usage.bankAccounts },
          { label: 'قيود اليومية', icon: <BookOpen className="w-4 h-4" />, count: dependTarget.usage.journals }
         ].map(row => (
          <div key={row.label} className={`flex items-center gap-2 px-4 py-2.5 ${row.count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
           <span className={row.count > 0 ? 'text-sky-400' : 'text-slate-600'}>{row.icon}</span>
           <span>{row.label}</span>
           <span className={`font-mono font-bold mr-auto ${row.count > 0 ? 'text-sky-300' : 'text-slate-600'}`}>
            {row.count > 0 ? `${row.count} استخدام` : '—'}
           </span>
          </div>
         ))}
        </div>
       </div>

       <div className="flex justify-end gap-3">
        <button
         type="button"
         onClick={() => setDependTarget(null)}
         className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
        >
         إلغاء
        </button>
        <button
         type="button"
         onClick={deactivateCurrency}
         className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl bg-amber-500/15 hover:bg-amber-400 text-amber-300 hover:text-white border border-amber-500/30 shadow-lg transition-all cursor-pointer"
        >
         <Power className="w-4 h-4" />
          تعطيل العملة بدلاً من الحذف
         </button>
        </div>
    </ModalShell>
    )}

   {/* نافذة تأكيد الحذف */}
   {deleteTarget && (
    <ModalShell
     id="currency-delete"
     open={!!deleteTarget}
     onClose={() => setDeleteTarget(null)}
     title="حذف العملة"
     icon={Trash2}
     size="sm"
     footer={null}
     closeOnBackdrop={false}
     className="border-red-500/30"
    >
       <p className="text-sm text-slate-300 leading-relaxed">
        هل أنت متأكد من حذف العملة <span className="font-bold text-white">{deleteTarget.code} - {deleteTarget.nameAr}</span>؟
        هذه العملة غير مرتبطة بأي حسابات أو صناديق أو بنوك أو قيود.
       </p>
       <div className="flex justify-end gap-3 mt-6">
        <button
         type="button"
         onClick={() => setDeleteTarget(null)}
         className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
        >
         إلغاء
        </button>
        <button
         type="button"
         onClick={confirmDelete}
         className="px-5 py-2 text-sm font-bold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-lg transition-all cursor-pointer"
        >
          حذف نهائي
         </button>
        </div>
    </ModalShell>
    )}

   {/* مصادر الاستخدام */}
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div className="flex items-center gap-2 text-sm text-slate-500 glass rounded-xl px-3 py-2.5 border border-slate-700/50">
     <Banknote className="w-3.5 h-3.5 flex-shrink-0" />
     <span>الحسابات المحاسبية</span>
     <span className="font-mono font-bold text-slate-300 mr-auto">{accounts.filter(a => a.currencies && a.currencies.length).length}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-slate-500 glass rounded-xl px-3 py-2.5 border border-slate-700/50">
     <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
     <span>الصناديق النقدية</span>
     <span className="font-mono font-bold text-slate-300 mr-auto">{cashBoxes.filter(b => b.currencies && b.currencies.length).length}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-slate-500 glass rounded-xl px-3 py-2.5 border border-slate-700/50">
     <Landmark className="w-3.5 h-3.5 flex-shrink-0" />
     <span>البنوك والصرافين</span>
     <span className="font-mono font-bold text-slate-300 mr-auto">{bankAccounts.filter(b => b.currencies && b.currencies.length).length}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-slate-500 glass rounded-xl px-3 py-2.5 border border-slate-700/50">
     <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
     <span>قيود اليومية</span>
     <span className="font-mono font-bold text-slate-300 mr-auto">{journals.length}</span>
    </div>
   </div>
  </div>
 );
}
