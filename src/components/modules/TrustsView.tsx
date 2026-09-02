import React, { useState } from 'react';
import {
 Vault,
 Banknote,
 Boxes,
 HandCoins,
 ShieldCheck,
 Plus,
 AlertCircle,
 CheckCircle2,
 Undo2,
 FileSignature,
 Landmark,
 Ban,
 Wallet,
 ArrowRightLeft,
 FileText,
 Calendar,
 Filter,
 Eye,
 History,
 Search
} from 'lucide-react';
import { Trust, TrustType, TrustStatus, TrustMovement, Account, JournalEntry, Employee } from '../../types/erp';
import { nextDocumentNumber, nextJournalNumber, isPostingAccount } from '../../utils/accountingEngine';
import { useToast } from '../ui/Toast';
import PageHeader from '../ui/PageHeader';
import EmptyState from '../ui/EmptyState';
import F9SearchInput from '../ui/F9SearchInput';
import ModalShell from '../ui/ModalShell';
import SmartDateInput, { smartDateToIso } from '../common/SmartDateInput';
import AmountInput from '../AmountInput';

interface Props {
 trusts: Trust[];
 accounts: Account[];
 journals: JournalEntry[];
 employees?: Employee[];
 onAddTrust: (trust: Trust) => void;
 onUpdateTrust: (id: string, updates: Partial<Trust>) => void;
 onAddJournal: (journal: JournalEntry) => boolean;
 currentUserName: string;
 closedYears?: string[];
}

const TRUST_TYPES: Record<TrustType, { label: string; short: string; icon: React.ElementType; chip: string }> = {
 CASH_ADVANCE: { label: 'عهدة نقدية', short: 'نقدية', icon: Banknote, chip: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
 IN_KIND: { label: 'عهدة عينية', short: 'عينية', icon: Boxes, chip: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
 DEPOSIT: { label: 'أمانة مستلمة', short: 'أمانة', icon: HandCoins, chip: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
 GUARANTEE: { label: 'ضمان / تأمين', short: 'ضمان', icon: ShieldCheck, chip: 'bg-sky-500/20 text-sky-400 border-sky-500/30' }
};

const TRUST_STATUS: Record<TrustStatus, { label: string; badge: string }> = {
 OPEN: { label: 'مفتوحة', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
 PARTIAL: { label: 'مسددة جزئياً', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
 SETTLED: { label: 'مسددة', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
 VOIDED: { label: 'ملغاة', badge: 'bg-red-500/20 text-red-300 border-red-500/30' }
};

const MOVEMENT_LABEL: Record<TrustMovement['type'], string> = {
 SETTLE: 'تصفية',
 RETURN: 'رد'
};

const fmt = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} YER`;
const nowStamp = () => new Date().toISOString().replace('T', ' ').substring(0, 16);
const today = () => new Date().toISOString().split('T')[0];

export default function TrustsView({
 trusts,
 accounts,
 journals,
 employees,
 onAddTrust,
 onUpdateTrust,
 onAddJournal,
 currentUserName,
 closedYears
}: Props) {
 const toast = useToast();

 const [statusFilter, setStatusFilter] = useState<'ALL' | TrustStatus>('ALL');
 const [typeFilter, setTypeFilter] = useState<'ALL' | TrustType>('ALL');
 const [search, setSearch] = useState('');

 const [isCreateOpen, setIsCreateOpen] = useState(false);
 const [createError, setCreateError] = useState('');
 const [createForm, setCreateForm] = useState({
  type: 'CASH_ADVANCE' as TrustType,
  title: '',
  employeeName: '',
  amount: 0,
  date: today(),
  referenceNumber: '',
  notes: ''
 });

 const [settleTarget, setSettleTarget] = useState<Trust | null>(null);
 const [settleAmount, setSettleAmount] = useState(0);
 const [settleDate, setSettleDate] = useState(today());
 const [settleReference, setSettleReference] = useState('');

 const [returnTarget, setReturnTarget] = useState<Trust | null>(null);
 const [returnAmount, setReturnAmount] = useState(0);
 const [returnDate, setReturnDate] = useState(today());
 const [returnReference, setReturnReference] = useState('');

 const [glTarget, setGlTarget] = useState<Trust | null>(null);
 const [glDebit, setGlDebit] = useState('');
 const [glCredit, setGlCredit] = useState('');
 const [glAmount, setGlAmount] = useState(0);

 const [detailsTarget, setDetailsTarget] = useState<Trust | null>(null);
 const [voidTarget, setVoidTarget] = useState<Trust | null>(null);

 const remaining = (t: Trust) => t.amount - t.settledAmount - t.returnedAmount;
 const progress = (t: Trust) => (t.amount > 0 ? Math.min(100, Math.round(((t.settledAmount + t.returnedAmount) / t.amount) * 100)) : 0);
 const openSettle = (t: Trust) => { setSettleTarget(t); setSettleAmount(0); setSettleDate(today()); setSettleReference(''); };
 const openReturn = (t: Trust) => { setReturnTarget(t); setReturnAmount(0); setReturnDate(today()); setReturnReference(''); };
 const openGL = (t: Trust) => { setGlTarget(t); setGlDebit(''); setGlCredit(''); setGlAmount(remaining(t)); };
 const openDetails = (t: Trust) => setDetailsTarget(t);

 const activeTrusts = trusts.filter(t => t.status !== 'VOIDED');
 const totalTrustValue = activeTrusts.reduce((s, t) => s + t.amount, 0);
 const totalRemaining = activeTrusts.reduce((s, t) => s + remaining(t), 0);
 const totalSettledReturned = activeTrusts.reduce((s, t) => s + (t.settledAmount + t.returnedAmount), 0);
 const openCount = activeTrusts.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').length;
 const totalMovements = trusts.reduce((s, t) => s + (t.movements ? t.movements.length : 0), 0);

 const usableAccounts = accounts.filter(isPostingAccount);
 const glDebitAcc = glDebit ? accounts.find(a => a.id === glDebit) : undefined;
 const glCreditAcc = glCredit ? accounts.find(a => a.id === glCredit) : undefined;

 const q = search.trim().toLowerCase();
 const filteredTrusts = trusts.filter(t =>
  (statusFilter === 'ALL' || t.status === statusFilter) &&
  (typeFilter === 'ALL' || t.type === typeFilter) &&
  (!q ||
   t.trustNumber.toLowerCase().includes(q) ||
   t.employeeName.toLowerCase().includes(q) ||
   t.title.toLowerCase().includes(q) ||
   (t.referenceNumber || '').toLowerCase().includes(q))
 );

 const handleCreate = (e: React.FormEvent) => {
  e.preventDefault();
  setCreateError('');
  const title = createForm.title.trim();
  const employeeName = createForm.employeeName.trim();
  const amount = Number(createForm.amount) || 0;
  if (!title) { setCreateError('يرجى إدخال وصف / غرض العهدة.'); return; }
  if (!employeeName) { setCreateError('يرجى إدخال اسم المكلف بالعهدة.'); return; }
  if (amount <= 0) { setCreateError('يرجى إدخال مبلغ العهدة (أكبر من صفر).'); return; }

  const matchedEmployee = employees?.find(e => e.nameAr.trim().toLowerCase() === employeeName.toLowerCase());

  onAddTrust({
   id: `tr-${Date.now()}`,
   trustNumber: nextDocumentNumber('TR', trusts),
   type: createForm.type,
   title,
   employeeName,
   employeeId: matchedEmployee ? matchedEmployee.id : undefined,
   amount,
   date: createForm.date || today(),
   referenceNumber: createForm.referenceNumber.trim() || undefined,
   notes: createForm.notes.trim() || undefined,
   status: 'OPEN',
   settledAmount: 0,
   returnedAmount: 0,
   movements: [],
   createdBy: currentUserName,
   createdAt: nowStamp()
  });
  toast('success', `تم إصدار عهدة جديدة: ${title} (${employeeName})`);
  setIsCreateOpen(false);
  setCreateForm({ type: 'CASH_ADVANCE', title: '', employeeName: '', amount: 0, date: today(), referenceNumber: '', notes: '' });
 };

 const handleSettle = (e: React.FormEvent) => {
  e.preventDefault();
  if (!settleTarget) return;
  const amount = Number(settleAmount) || 0;
  const max = remaining(settleTarget);
  if (amount <= 0) { toast('error', 'يرجى إدخال مبلغ التصفية.'); return; }
  if (amount > max) { toast('error', `مبلغ التصفية يتجاوز المتبقي (${fmt(max)}).`); return; }

  const movement: TrustMovement = {
   id: `tm-${Date.now()}`,
   type: 'SETTLE',
   amount,
   date: settleDate || today(),
   referenceNumber: settleReference.trim() || undefined,
   createdBy: currentUserName,
   createdAt: nowStamp()
  };
  const newSettled = settleTarget.settledAmount + amount;
  const newStatus: TrustStatus = newSettled + settleTarget.returnedAmount >= settleTarget.amount ? 'SETTLED' : 'PARTIAL';
  onUpdateTrust(settleTarget.id, {
   settledAmount: newSettled,
   settlementDate: settleDate || today(),
   status: newStatus,
   movements: [...(settleTarget.movements || []), movement]
  });
  toast('success', `تمت تصفية مبلغ ${fmt(amount)} من ${settleTarget.trustNumber}.`);
  setSettleTarget(null);
 };

 const handleReturn = (e: React.FormEvent) => {
  e.preventDefault();
  if (!returnTarget) return;
  const amount = Number(returnAmount) || 0;
  const max = remaining(returnTarget);
  if (amount <= 0) { toast('error', 'يرجى إدخال مبلغ الرد.'); return; }
  if (amount > max) { toast('error', `مبلغ الرد يتجاوز المتبقي (${fmt(max)}).`); return; }

  const movement: TrustMovement = {
   id: `tm-${Date.now()}`,
   type: 'RETURN',
   amount,
   date: returnDate || today(),
   referenceNumber: returnReference.trim() || undefined,
   createdBy: currentUserName,
   createdAt: nowStamp()
  };
  const newReturned = returnTarget.returnedAmount + amount;
  const newStatus: TrustStatus = returnTarget.settledAmount + newReturned >= returnTarget.amount ? 'SETTLED' : 'PARTIAL';
  onUpdateTrust(returnTarget.id, {
   returnedAmount: newReturned,
   settlementDate: returnDate || today(),
   status: newStatus,
   movements: [...(returnTarget.movements || []), movement]
  });
  toast('success', `تم رد مبلغ ${fmt(amount)} من ${returnTarget.trustNumber}.`);
  setReturnTarget(null);
 };

 const handlePostGL = (e: React.FormEvent) => {
  e.preventDefault();
  if (!glTarget) return;
  const amount = Number(glAmount) || 0;
  if (!glDebit || !glCredit) { toast('error', 'يرجى اختيار الحسابين (مدين / دائن).'); return; }
  if (glDebit === glCredit) { toast('error', 'لا يمكن أن يكون الحساب المدين والدائن نفسه.'); return; }
   if (amount <= 0) { toast('error', 'يرجى إدخال مبلغ صحيح.'); return; }
   const remainingAmt = Math.max(0, glTarget.amount - glTarget.settledAmount - glTarget.returnedAmount);
   if (amount > remainingAmt) { toast('error', `المبلغ يتجاوز المتبقي من العهدة (${fmt(remainingAmt)}).`); return; }
   if (!glDebitAcc || !glCreditAcc) { toast('error', 'تعذر العثور على الحسابات المختارة.'); return; }
   if (!isPostingAccount(glDebitAcc) || !isPostingAccount(glCreditAcc)) { toast('error', 'يجب اختيار حسابات فرعية قابلة للترحيل (مستوى 5).'); return; }
  if (closedYears?.includes(today().slice(0, 4))) {
    toast('error', `السنة المالية ${today().slice(0, 4)} مغلقة — لا يمكن ترحيل العهد إلى قيود اليومية. أعد فتحها من صفحة «الإقفالات والترحيل والرقابة» إذا لزم.`);
    return;
  }

  const typeLabel = TRUST_TYPES[glTarget.type].label;
  const journal: JournalEntry = {
   id: `je-trust-${Date.now()}`,
   entryNumber: nextJournalNumber(journals),
   date: today(),
   reference: `TRUST-${glTarget.trustNumber}`,
   narration: `ترحيل ${typeLabel} ${glTarget.trustNumber} - ${glTarget.title} (المكلف: ${glTarget.employeeName})`,
   currency: 'YER',
   exchangeRate: 1,
   status: 'POSTED',
   totalDebit: amount,
   totalCredit: amount,
   createdBy: currentUserName,
   createdAt: nowStamp(),
   postedBy: currentUserName,
   postedAt: nowStamp(),
   lines: [
    {
     id: `jl-trust-${Date.now()}-d`,
     accountId: glDebitAcc.id,
     accountCode: glDebitAcc.code,
     accountNameAr: glDebitAcc.nameAr,
     debit: amount,
     credit: 0,
     description: `${typeLabel} ${glTarget.trustNumber} - ${glTarget.title}`
    },
    {
     id: `jl-trust-${Date.now()}-c`,
     accountId: glCreditAcc.id,
     accountCode: glCreditAcc.code,
     accountNameAr: glCreditAcc.nameAr,
     debit: 0,
     credit: amount,
     description: `مقابل ${typeLabel} ${glTarget.trustNumber}`
    }
   ]
  };
  if (!onAddJournal(journal)) {
   toast('error', `تعذر ترحيل ${glTarget.trustNumber}؛ لم تُسجل أي حركة.`);
   return;
  }
  toast('success', `تم ترحيل ${glTarget.trustNumber} إلى قيود اليومية بقيمة ${fmt(amount)}.`);
  setGlTarget(null);
 };

 const handleVoid = () => {
  if (!voidTarget) return;
  onUpdateTrust(voidTarget.id, { status: 'VOIDED' });
  toast('info', `تم إلغاء العهدة ${voidTarget.trustNumber}.`);
  setVoidTarget(null);
 };

 const StatCard = ({ label, value, hint, icon: Icon, iconClass }: { label: string; value: string; hint: string; icon: React.ElementType; iconClass: string }) => (
  <div className="glass-elevated rounded-2xl p-5 relative overflow-hidden group">
   <div className="flex items-center justify-between relative">
    <p className="text-slate-400 text-xs font-semibold">{label}</p>
    <div className={`p-2.5 rounded-xl border border-white/10 shadow-lg ${iconClass}`}>
     <Icon className="w-5 h-5" />
    </div>
   </div>
   <p className="mt-3 text-2xl font-black tracking-tight text-white">{value}</p>
   <p className="mt-1 text-sm text-slate-500">{hint}</p>
  </div>
 );

 const DetailField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-xl p-3 border border-slate-700/60 bg-slate-800/40">
   <p className="text-sm font-semibold text-slate-400">{label}</p>
   <p className="mt-1 text-sm font-bold text-white">{value}</p>
  </div>
 );

 const TypeChip = ({ type }: { type: TrustType }) => {
  const meta = TRUST_TYPES[type];
  const Icon = meta.icon;
  return (
   <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-2 py-1 rounded-full border ${meta.chip}`}>
    <Icon className="w-3.5 h-3.5" />
    {meta.label}
   </span>
  );
 };

 const AmountField = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="rounded-xl p-3 border border-slate-700/60 bg-slate-800/40">
   <p className="text-sm font-semibold text-slate-400">{label}</p>
   <p className={`mt-1 text-sm font-bold font-mono ${color}`}>{value}</p>
  </div>
 );

 const formLabel = 'block text-xs font-semibold text-slate-300 mb-1';
 const formInput = 'w-full px-3 py-2 text-sm glass-input rounded-xl font-mono';

 return (
   <div data-enter-scope="" className="space-y-6 animate-fade-in">
   <PageHeader
    icon={<Vault className="w-6 h-6" />}
    title="إدارة العهد"
    subtitle="الإصدار والتصفية والرد والترحيل المحاسبي — مع سجل حركات متكامل ومتابعة الإنجاز"
    actions={
     <button
      type="button"
      onClick={() => { setCreateError(''); setIsCreateOpen(true); }}
      className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
     >
      <Plus className="w-4 h-4" />
      إصدار عهدة جديدة
     </button>
    }
   />

   {/* KPIs */}
   <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
    <StatCard label="إجمالي قيمة العهد" value={fmt(totalTrustValue)} hint="مجموع العهد النشطة (غير الملغاة)" icon={Wallet} iconClass="bg-amber-500/20 text-amber-400" />
    <StatCard label="المتبقي غير المسدد" value={fmt(totalRemaining)} hint="القيمة المتبقية بعد التصفية والرد" icon={ArrowRightLeft} iconClass="bg-red-500/20 text-red-400" />
    <StatCard label="المسدد والمرتجع" value={fmt(totalSettledReturned)} hint="إجمالي ما تم تسويته أو رده" icon={CheckCircle2} iconClass="bg-emerald-500/20 text-emerald-400" />
    <StatCard label="سجل الحركات" value={totalMovements.toLocaleString('en-US')} hint="عدد عمليات التصفية والرد المسجلة" icon={History} iconClass="bg-sky-500/20 text-sky-400" />
   </div>

   {/* Types breakdown */}
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {(Object.keys(TRUST_TYPES) as TrustType[]).map(type => {
     const meta = TRUST_TYPES[type];
     const Icon = meta.icon;
     const list = activeTrusts.filter(t => t.type === type);
     const total = list.reduce((s, t) => s + t.amount, 0);
     return (
      <button
       key={type}
       onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
       className={`text-right glass rounded-2xl p-4 border transition-all cursor-pointer ${typeFilter === type ? 'border-sky-500/50' : 'border-slate-700/50 hover:border-slate-600'}`}
      >
       <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl border ${meta.chip}`}>
         <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-bold text-slate-400">{list.length} عهدة</span>
       </div>
       <p className="mt-3 text-sm font-bold text-white">{meta.label}</p>
       <p className="mt-0.5 text-xs text-slate-400 font-mono">{fmt(total)}</p>
      </button>
     );
    })}
   </div>

   {/* Filters */}
   <div className="glass rounded-2xl p-4 border border-slate-700/50 flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
    <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
     <Filter className="w-4 h-4" />
     تصفية:
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <button
      onClick={() => setStatusFilter('ALL')}
      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-sky-500/25 text-sky-300 border-sky-500/40' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-slate-200'}`}
     >
      الكل
     </button>
     {(Object.keys(TRUST_STATUS) as TrustStatus[]).map(s => (
      <button
       key={s}
       onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
       className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${statusFilter === s ? 'bg-sky-500/25 text-sky-300 border-sky-500/40' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-slate-200'}`}
      >
       {TRUST_STATUS[s].label}
      </button>
     ))}
    </div>
    <div className="relative xl:flex-1 xl:min-w-[260px]">
     <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <F9SearchInput
       value={search}
       onChange={setSearch}

       className="w-full pr-9 pl-9 py-2 text-sm glass-input rounded-xl"
       items={filteredTrusts}
       columns={[
        { label: 'رقم العهدة', render: t => <span className="font-mono font-bold text-sky-400">{t.trustNumber}</span> },
        { label: 'المكلف', render: t => <span className="font-semibold text-white">{t.employeeName}</span> },
        { label: 'الغرض', render: t => <span className="text-slate-300">{t.title}</span> },
        { label: 'المبلغ', render: t => <span className="font-mono font-bold text-white">{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} YER</span> }
       ]}
       searchText={t => [t.trustNumber, t.employeeName, t.title, t.amount, t.status, t.date, t.referenceNumber || ''].join(' ')}
       browseTitle="استعراض العهد"
      />
    </div>
   </div>

   {/* Table */}
   <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
    <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
     <h3 className="font-bold text-white text-sm flex items-center gap-2">
      <FileText className="w-4 h-4 text-sky-400" />
      سجل العهد
     </h3>
     <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">النشطة: {activeTrusts.length}</span>
      <span className="text-xs text-slate-400 font-semibold">{filteredTrusts.length} سجل</span>
     </div>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full text-right text-sm">
      <thead className="bg-slate-900/60 text-slate-300 font-bold border-b border-slate-800">
       <tr>
        <th className="py-3.5 px-4">رقم العهدة</th>
        <th className="py-3.5 px-4">النوع</th>
        <th className="py-3.5 px-4">المكلف بالعهدة</th>
        <th className="py-3.5 px-4">الغرض / الوصف</th>
        <th className="py-3.5 px-4">المبلغ</th>
        <th className="py-3.5 px-4">التقدم</th>
        <th className="py-3.5 px-4">المتبقي</th>
        <th className="py-3.5 px-4">الحالة</th>
        <th className="py-3.5 px-4">تاريخ الإصدار</th>
        <th className="py-3.5 px-4">إجراءات</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60">
       {filteredTrusts.length === 0 && (
        <tr>
         <td colSpan={10} className="p-6">
          <EmptyState
           title="لا توجد عهد"
           description={search.trim() || statusFilter !== 'ALL' || typeFilter !== 'ALL' ? 'لا توجد نتائج مطابقة لمعايير البحث والتصفية.' : 'ابدأ بإصدار أول عهدة عبر زر (إصدار عهدة جديدة).'}
           compact
           icon={<Vault className="w-5 h-5" />}
          />
         </td>
        </tr>
       )}
       {filteredTrusts.map(t => {
        const typeMeta = TRUST_TYPES[t.type];
        const statusMeta = TRUST_STATUS[t.status];
        const left = remaining(t);
        const pct = progress(t);
        const movementCount = t.movements ? t.movements.length : 0;
        return (
         <tr key={t.id} className="hover:bg-white/5">
          <td className="py-3 px-4 font-mono font-bold text-sky-400">{t.trustNumber}</td>
          <td className="py-3 px-4">
           <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-2 py-1 rounded-full border ${typeMeta.chip}`}>
            <typeMeta.icon className="w-3.5 h-3.5" />
            {typeMeta.short}
           </span>
          </td>
          <td className="py-3 px-4 font-semibold text-white">{t.employeeName}</td>
          <td className="py-3 px-4 text-xs text-slate-300 max-w-[200px] truncate" title={t.title}>{t.title}</td>
          <td className="py-3 px-4 font-mono text-white">{fmt(t.amount)}</td>
          <td className="py-3 px-4">
           <div className="flex items-center gap-2" title={`مسدد: ${fmt(t.settledAmount)} | مرتجع: ${fmt(t.returnedAmount)}`}>
            <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
             <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-mono text-slate-400">{pct}%</span>
           </div>
          </td>
          <td className={`py-3 px-4 font-mono font-bold ${left > 0 ? 'text-red-400' : 'text-slate-500'}`}>{fmt(left)}</td>
          <td className="py-3 px-4">
           <span className={`inline-flex text-sm font-bold px-2 py-1 rounded-full border ${statusMeta.badge}`}>
            {statusMeta.label}
           </span>
          </td>
          <td className="py-3 px-4 text-xs text-slate-400 flex items-center gap-1">
           <Calendar className="w-3.5 h-3.5" />
           {t.date}
          </td>
          <td className="py-3 px-4">
           <div className="flex items-center gap-1.5">
            <button
             type="button"
             onClick={() => openDetails(t)}
             title={`التفاصيل وسجل الحركات (${movementCount})`}
             className="p-1.5 rounded-lg bg-slate-500/15 text-slate-300 hover:bg-slate-500/30 transition-colors cursor-pointer"
            >
             <Eye className="w-4 h-4" />
            </button>
            {t.status !== 'VOIDED' ? (
             <>
              <button
               type="button"
               onClick={() => openSettle(t)}
               title="تصفية العهدة"
               className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
              >
               <FileSignature className="w-4 h-4" />
              </button>
              <button
               type="button"
               onClick={() => openReturn(t)}
               title="رد العهدة"
               className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
              >
               <Undo2 className="w-4 h-4" />
              </button>
              <button
               type="button"
               onClick={() => openGL(t)}
               title="ترحيل محاسبي"
               className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
              >
               <Landmark className="w-4 h-4" />
              </button>
              <button
               type="button"
               onClick={() => setVoidTarget(t)}
               title="إلغاء العهدة"
               className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
              >
               <Ban className="w-4 h-4" />
              </button>
             </>
            ) : (
             <span className="text-sm text-slate-600">ملغاة</span>
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

   {/* Create Modal */}
   {isCreateOpen && (
    <ModalShell id="trust-create" open={!!isCreateOpen} title="إصدار عهدة جديدة" icon={Plus} onClose={() => setIsCreateOpen(false)} footer={null} closeOnBackdrop={false}>
     <form onSubmit={handleCreate} className="space-y-4">
      {createError && (
       <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{createError}</span>
       </div>
      )}

      <div className="grid grid-cols-2 gap-4">
       <div>
        <label className={formLabel}>نوع العهدة *</label>
        <select
         value={createForm.type}
         onChange={e => setCreateForm({ ...createForm, type: e.target.value as TrustType })}
         className="w-full px-3 py-2 text-sm glass-input rounded-xl"
        >
         {(Object.keys(TRUST_TYPES) as TrustType[]).map(t => (
          <option key={t} value={t} className="bg-slate-900 text-slate-200">{TRUST_TYPES[t].label}</option>
         ))}
        </select>
       </div>
       <div>
        <label className={formLabel}>تاريخ الإصدار</label>
        <SmartDateInput value={createForm.date} onChange={d => setCreateForm({ ...createForm, date: smartDateToIso(d) })} />
       </div>
      </div>

      <div>
       <label className={formLabel}>الغرض / وصف العهدة *</label>
       <input type="text" required value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} className="w-full px-3 py-2 text-sm glass-input rounded-xl" />
      </div>

      <div>
       <label className={formLabel}>المكلف بالعهدة *</label>
       <input
        type="text"
        required
        list="trust-employee-options"
        value={createForm.employeeName}
        onChange={e => setCreateForm({ ...createForm, employeeName: e.target.value })}

        className="w-full px-3 py-2 text-sm glass-input rounded-xl"
       />
       {employees && employees.length > 0 && (
        <datalist id="trust-employee-options">
         {employees.map(e => <option key={e.id} value={e.nameAr} />)}
        </datalist>
       )}
       <p className="mt-1 text-sm text-slate-500">اقتراحات من قاعدة بيانات الموظفين ({employees ? employees.length : 0} موظف)</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
       <div>
        <label className={formLabel}>قيمة العهدة (YER) *</label>
        <AmountInput required value={createForm.amount} onChange={v => setCreateForm({ ...createForm, amount: Number(v) })} className={formInput} />
       </div>
       <div>
        <label className={formLabel}>رقم المستند المرجعي</label>
        <input type="text" value={createForm.referenceNumber} onChange={e => setCreateForm({ ...createForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono" />
       </div>
      </div>

      <div>
       <label className={formLabel}>ملاحظات</label>
       <textarea value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm glass-input rounded-xl" />
      </div>

      <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
       <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
       <button type="submit" className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] rounded-xl text-sm font-bold shadow-lg cursor-pointer">إصدار العهدة</button>
      </div>
     </form>
    </ModalShell>
   )}

   {/* Settle Modal */}
   {settleTarget && (
    <ModalShell id="trust-settle" open={!!settleTarget} title={`تصفية العهدة ${settleTarget.trustNumber}`} icon={FileSignature} onClose={() => setSettleTarget(null)} footer={null} closeOnBackdrop={false}>
     <form onSubmit={handleSettle} className="space-y-4">
      <div className="rounded-xl p-4 border border-slate-700/60 bg-slate-800/40 space-y-2 text-sm">
       <div className="flex justify-between"><span className="text-slate-400">المكلف:</span><span className="font-semibold text-white">{settleTarget.employeeName}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">قيمة العهدة:</span><span className="font-mono text-white">{fmt(settleTarget.amount)}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">المسدد سابقاً:</span><span className="font-mono text-emerald-400">{fmt(settleTarget.settledAmount + settleTarget.returnedAmount)}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">المتبقي القابل للتصفية:</span><span className="font-mono font-bold text-red-400">{fmt(remaining(settleTarget))}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
       <div>
        <label className={formLabel}>مبلغ التصفية (YER) *</label>
        <AmountInput required value={settleAmount} onChange={v => setSettleAmount(Number(v))} className={formInput} />
       </div>
       <div>
        <label className={formLabel}>تاريخ التصفية</label>
        <SmartDateInput value={settleDate} onChange={d => setSettleDate(smartDateToIso(d))} />
       </div>
      </div>

      <div>
       <label className={formLabel}>رقم مستند التصفية</label>
       <input type="text" value={settleReference} onChange={e => setSettleReference(e.target.value)} className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono" />
      </div>

      {settleAmount > 0 && (
       <div className="rounded-xl p-4 border border-emerald-500/25 bg-emerald-500/5 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-400">المسدد بعد التصفية:</span><span className="font-mono font-bold text-white">{fmt(settleTarget.settledAmount + settleAmount)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">المتبقي بعد التصفية:</span><span className={`font-mono font-bold ${remaining(settleTarget) - settleAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(remaining(settleTarget) - settleAmount)}</span></div>
       </div>
      )}

      <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
       <button type="button" onClick={() => setSettleTarget(null)} className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
       <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer">تأكيد التصفية</button>
      </div>
     </form>
    </ModalShell>
   )}

   {/* Return Modal */}
   {returnTarget && (
    <ModalShell id="trust-return" open={!!returnTarget} title={`رد العهدة ${returnTarget.trustNumber}`} icon={Undo2} onClose={() => setReturnTarget(null)} footer={null} closeOnBackdrop={false}>
     <form onSubmit={handleReturn} className="space-y-4">
      <div className="rounded-xl p-4 border border-slate-700/60 bg-slate-800/40 space-y-2 text-sm">
       <div className="flex justify-between"><span className="text-slate-400">المكلف:</span><span className="font-semibold text-white">{returnTarget.employeeName}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">قيمة العهدة:</span><span className="font-mono text-white">{fmt(returnTarget.amount)}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">المسدد والمرتجع سابقاً:</span><span className="font-mono text-sky-400">{fmt(returnTarget.settledAmount + returnTarget.returnedAmount)}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">المتبقي القابل للرد:</span><span className="font-mono font-bold text-red-400">{fmt(remaining(returnTarget))}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
       <div>
        <label className={formLabel}>مبلغ الرد (YER) *</label>
        <AmountInput required value={returnAmount} onChange={v => setReturnAmount(Number(v))} className={formInput} />
       </div>
       <div>
        <label className={formLabel}>تاريخ الرد</label>
        <SmartDateInput value={returnDate} onChange={d => setReturnDate(smartDateToIso(d))} />
       </div>
      </div>

      <div>
       <label className={formLabel}>رقم مستند الرد</label>
       <input type="text" value={returnReference} onChange={e => setReturnReference(e.target.value)} className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono" />
      </div>

      {returnAmount > 0 && (
       <div className="rounded-xl p-4 border border-sky-500/25 bg-sky-500/5 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-400">المرتجع بعد الرد:</span><span className="font-mono font-bold text-white">{fmt(returnTarget.returnedAmount + returnAmount)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">المتبقي بعد الرد:</span><span className={`font-mono font-bold ${remaining(returnTarget) - returnAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(remaining(returnTarget) - returnAmount)}</span></div>
       </div>
      )}

      <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
       <button type="button" onClick={() => setReturnTarget(null)} className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
       <button type="submit" className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] rounded-xl text-sm font-bold shadow-lg cursor-pointer">تأكيد الرد</button>
      </div>
     </form>
    </ModalShell>
   )}

   {/* GL Posting Modal */}
   {glTarget && (
    <ModalShell id="trust-gl" open={!!glTarget} title={`الترحيل المحاسبي - ${glTarget.trustNumber}`} icon={Landmark} onClose={() => setGlTarget(null)} footer={null} closeOnBackdrop={false}>
     <form onSubmit={handlePostGL} className="space-y-4">
      <div className="rounded-xl p-4 border border-slate-700/60 bg-slate-800/40 space-y-2 text-sm">
       <div className="flex justify-between"><span className="text-slate-400">العهدة:</span><span className="font-semibold text-white">{glTarget.title}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">المكلف:</span><span className="font-semibold text-white">{glTarget.employeeName}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">قيمة العهدة:</span><span className="font-mono text-white">{fmt(glTarget.amount)}</span></div>
       <div className="flex justify-between"><span className="text-slate-400">المتبقي:</span><span className="font-mono font-bold text-red-400">{fmt(remaining(glTarget))}</span></div>
      </div>

      {usableAccounts.length < 2 && (
       <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>لا يوجد حسابان محاسبيان كافيان للترحيل. أضف حسابات في دليل الحسابات أولاً.</span>
       </div>
      )}

      <div className="grid grid-cols-2 gap-4">
       <div>
        <label className={formLabel}>مبلغ الترحيل (YER) *</label>
        <AmountInput required value={glAmount} onChange={v => setGlAmount(Number(v))} className={formInput} />
       </div>
       <div>
        <label className={formLabel}>الحساب المدين (العهدة) *</label>
        <select value={glDebit} onChange={e => setGlDebit(e.target.value)} className="w-full px-3 py-2 text-sm glass-input rounded-xl">
         <option value="" className="bg-slate-900 text-slate-200">— اختر حساباً —</option>
         {usableAccounts.map(a => <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">{a.code} - {a.nameAr}</option>)}
        </select>
       </div>
      </div>

      <div>
       <label className={formLabel}>الحساب الدائن (النقدية / البنك) *</label>
       <select value={glCredit} onChange={e => setGlCredit(e.target.value)} className="w-full px-3 py-2 text-sm glass-input rounded-xl">
        <option value="" className="bg-slate-900 text-slate-200">— اختر حساباً —</option>
        {usableAccounts.map(a => <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">{a.code} - {a.nameAr}</option>)}
       </select>
      </div>

      {glDebitAcc && glCreditAcc && glDebit !== glCredit && Number(glAmount) > 0 && (
       <div className="rounded-xl p-4 border border-sky-500/25 bg-sky-500/5 space-y-2">
        <p className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
         <Eye className="w-3.5 h-3.5" />
         معاينة القيد
        </p>
        <div className="flex items-center justify-between text-xs">
         <span className="font-bold text-emerald-400 w-12">مدين</span>
         <span className="text-slate-300 flex-1 mx-3 truncate text-left">{glDebitAcc.code} - {glDebitAcc.nameAr}</span>
         <span className="font-mono text-white">{fmt(Number(glAmount))}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
         <span className="font-bold text-red-400 w-12">دائن</span>
         <span className="text-slate-300 flex-1 mx-3 truncate text-left">{glCreditAcc.code} - {glCreditAcc.nameAr}</span>
         <span className="font-mono text-white">{fmt(Number(glAmount))}</span>
        </div>
        <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-2">
         <span className="text-slate-500">القيد متوازن</span>
         <span className="inline-flex items-center gap-1 text-emerald-400 font-bold"><CheckCircle2 className="w-3.5 h-3.5" />مضبوط</span>
        </div>
       </div>
      )}

      <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
       <button type="button" onClick={() => setGlTarget(null)} className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
       <button type="submit" disabled={usableAccounts.length < 2} className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] rounded-xl text-sm font-bold shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">ترحيل القيد</button>
      </div>
     </form>
    </ModalShell>
   )}

   {/* Details Modal */}
   {detailsTarget && (
    <ModalShell id="trust-details" open={!!detailsTarget} title={`تفاصيل العهدة ${detailsTarget.trustNumber}`} icon={Eye} onClose={() => setDetailsTarget(null)} footer={null} closeOnBackdrop={false}>
     <div className="space-y-4">
      <div className="flex items-center justify-between">
       <TypeChip type={detailsTarget.type} />
       <span className={`inline-flex text-sm font-bold px-2 py-1 rounded-full border ${TRUST_STATUS[detailsTarget.status].badge}`}>
        {TRUST_STATUS[detailsTarget.status].label}
       </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
       <DetailField label="المكلف بالعهدة" value={detailsTarget.employeeName} />
       <DetailField label="تاريخ الإصدار" value={detailsTarget.date} />
       <DetailField label="رقم المرجع" value={detailsTarget.referenceNumber || '—'} />
       <DetailField label="المنشئ" value={detailsTarget.createdBy || '—'} />
      </div>

      {detailsTarget.notes && (
       <div className="rounded-xl p-3 border border-slate-700/60 bg-slate-800/40 text-sm text-slate-300">
        <p className="text-sm font-semibold text-slate-400 mb-1">ملاحظات</p>
        {detailsTarget.notes}
       </div>
      )}

      <div className="grid grid-cols-2 gap-3">
       <AmountField label="قيمة العهدة" value={fmt(detailsTarget.amount)} color="text-white" />
       <AmountField label="مسدد" value={fmt(detailsTarget.settledAmount)} color="text-emerald-400" />
       <AmountField label="مرتجع" value={fmt(detailsTarget.returnedAmount)} color="text-sky-400" />
       <AmountField label="المتبقي" value={fmt(remaining(detailsTarget))} color={remaining(detailsTarget) > 0 ? 'text-red-400' : 'text-slate-400'} />
      </div>

      <div>
       <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400 font-semibold">نسبة الإنجاز</span>
        <span className="font-mono text-slate-300">{progress(detailsTarget)}%</span>
       </div>
       <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${progress(detailsTarget) >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${progress(detailsTarget)}%` }} />
       </div>
      </div>

      <div>
       <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5 text-sky-400" />
        سجل الحركات ({detailsTarget.movements ? detailsTarget.movements.length : 0})
       </p>
       {!detailsTarget.movements || detailsTarget.movements.length === 0 ? (
        <div className="rounded-xl p-4 border border-dashed border-slate-700 text-center text-xs text-slate-500">
         لا توجد حركات بعد — ابدأ بالتصفية أو الرد.
        </div>
       ) : (
        <div className="space-y-2">
         {[...detailsTarget.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(m => (
          <div key={m.id} className="rounded-xl p-3 border border-slate-700/60 bg-slate-800/40 flex items-center gap-3">
           <div className={`p-2 rounded-lg ${m.type === 'SETTLE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>
            {m.type === 'SETTLE' ? <FileSignature className="w-4 h-4" /> : <Undo2 className="w-4 h-4" />}
           </div>
           <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
             <span className={`text-xs font-bold ${m.type === 'SETTLE' ? 'text-emerald-400' : 'text-sky-400'}`}>{MOVEMENT_LABEL[m.type]}</span>
             <span className="font-mono text-white text-xs font-bold">{fmt(m.amount)}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-sm text-slate-500">
             <span className="truncate">{m.date}{m.referenceNumber ? ` • المرجع: ${m.referenceNumber}` : ''}</span>
             <span className="flex-shrink-0">{m.createdBy}</span>
            </div>
           </div>
          </div>
         ))}
        </div>
       )}
      </div>

      <div className="pt-4 border-t border-slate-800 flex justify-end">
       <button type="button" onClick={() => setDetailsTarget(null)} className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] rounded-xl text-sm font-bold shadow-lg cursor-pointer">إغلاق</button>
      </div>
     </div>
    </ModalShell>
   )}

   {/* Void confirm Modal */}
   {voidTarget && (
    <ModalShell id="trust-void" open={!!voidTarget} title="تأكيد إلغاء العهدة" icon={Ban} onClose={() => setVoidTarget(null)} footer={null} closeOnBackdrop={false} className="border-red-500/30">
     <div className="space-y-4">
      <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10 text-sm text-red-200 space-y-2">
       <div className="flex items-center gap-2 font-bold">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        إلغاء نهائي للعهدة
       </div>
       <p className="text-xs text-red-200/80">
        هل أنت متأكد من إلغاء العهدة <span className="font-mono font-bold">{voidTarget.trustNumber}</span>؟
        المكلف: <span className="font-bold">{voidTarget.employeeName}</span> — سيتم وضعها في حالة "ملغاة" ولن تظهر ضمن العهد النشطة.
       </p>
      </div>
      <div className="flex justify-end gap-3">
       <button type="button" onClick={() => setVoidTarget(null)} className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">تراجع</button>
       <button type="button" onClick={handleVoid} className="px-5 py-2 bg-red-500/15 hover:bg-red-500 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer">تأكيد الإلغاء</button>
      </div>
     </div>
    </ModalShell>
   )}
  </div>
 );
}
