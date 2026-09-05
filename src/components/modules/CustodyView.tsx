import DateField from '../ui/DateField';
﻿import React, { useMemo, useRef, useState } from 'react';
import {
  Vault,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Send,
  ShieldCheck,
  ThumbsDown,
  Wallet,
  FileSignature,
  Undo2,
  RefreshCw,
  Ban,
  Lock,
  Eye,
  History,
  Search,
  Filter,
  Calendar,
  ArrowRightLeft,
  FileText,
  Coins,
  Timer,
  Banknote,
  Boxes,
  Percent,
  ScrollText,
  Printer,
  Download,
  Landmark,
  Building2,
  Users,
  Network,
  Save,
  MoreHorizontal,
  ReceiptText,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  Account,
  JournalEntry,
  Employee,
  Custody,
  CustodyType,
  CustodyStatus,
  DisbursementMethod,
  CustodyApproval,
  CustodySettlementItem,
  CustodySettlement,
  CustodyTransaction,
  CustodyDisbursementParty,
  CashBox,
  BankAccount,
  Vendor,
  CostCenter,
  Currency,
} from '../../types/erp';
import AttachmentPicker from '../ui/AttachmentPicker';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { openDesktopPrintPreview } from '../../utils/desktopPrintPreview';
import {
  CUSTODY_TYPE_LABEL,
  CUSTODY_STATUS_LABEL,
  OPEN_STATUSES,
  requiredApprovalLevel,
  APPROVAL_LEVEL_ROLES,
  canSubmit,
  canApprove,
  canDisburse,
  canReplenish,
  canReplenishLow,
  canSettle,
  canClose,
  canVoid,
  custodyPrincipal,
  outstandingBalance,
  isOverdue,
  overdueDays,
  validateNewCustody,
  findOverdueViolation,
  listOverdueCustodies,
  statusAfterSettlement,
  approvalsComplete,
  today,
  nowStamp,
} from '../../utils/custodyEngine';
import {
  buildDisbursementJournal,
  buildSettlementJournal,
  buildRefundJournal,
  buildShortageSettlementJournal,
  buildReplenishmentJournal,
  type JournalBuildContext,
} from '../../utils/custodyAccounting';
import { nextDocumentNumber, nextJournalNumber, isPostingAccount, payablePostingAccounts } from '../../utils/accountingEngine';
import { useToast } from '../ui/Toast';
import PageHeader from '../ui/PageHeader';
import EmptyState from '../ui/EmptyState';
import F9SearchInput from '../ui/F9SearchInput';
import SearchableSelect from '../ui/SearchableSelect';
import ModalShell from '../ui/ModalShell';
import AmountInput from '../AmountInput';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useExchangeRateGuard } from '../../hooks/useExchangeRateGuard';
import { tafqeet } from '../../utils/tafqeet';
import VoucherPrintTemplate from '../ui/VoucherPrintTemplate';
import { handleCurrencyFieldChange } from '../../utils/currencyMath';

interface Props {
  custodies: Custody[];
  accounts: Account[];
  journals: JournalEntry[];
  employees: Employee[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  vendors: Vendor[];
  costCenters: CostCenter[];
  currencies: Currency[];
  onAddCustody: (c: Custody) => void;
  onUpdateCustody: (id: string, updates: Partial<Custody>) => void;
  onAddJournal: (j: JournalEntry) => boolean;
  currentUserName: string;
  closedYears?: string[];
}

const CUSTODY_META: Record<CustodyType, { label: string; short: string; prefix: string; icon: React.ElementType; chip: string }> = {
  TEMPORARY: { label: 'عهدة مؤقتة', short: 'مؤقتة', prefix: 'CC', icon: Timer, chip: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  PETTY_CASH: { label: 'مستديمة / مصاريف نثرية', short: 'نثرية', prefix: 'PC', icon: Coins, chip: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
  ASSET: { label: 'عهدة عينية', short: 'عينية', prefix: 'AC', icon: Boxes, chip: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30' },
};

const CUSTODY_STATUS_META: Record<CustodyStatus, { label: string; badge: string }> = {
  CREATED: { label: 'جديدة', badge: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600' },
  PENDING_APPROVAL: { label: 'قيد المراجعة', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  APPROVED: { label: 'معتمدة', badge: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30' },
  DISBURSED: { label: 'مصروفة', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  PARTIAL_SETTLED: { label: 'مصفاة جزئياً', badge: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
  FULL_SETTLED: { label: 'مصفاة كلياً', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
  CLOSED: { label: 'مغلقة', badge: 'bg-slate-100 text-slate-500 dark:text-slate-400 border-slate-300 dark:bg-slate-800 dark:border-slate-600' },
  VOIDED: { label: 'ملغاة', badge: 'bg-red-100 text-red-700 border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30' },
};

const TXN_LABEL: Record<CustodyTransaction['type'], string> = {
  DISBURSE: 'صرف العهدة',
  REPLENISH: 'استعاضة',
  SETTLEMENT: 'تصفية بالمستندات',
  REFUND: 'رد نقدية (فائض)',
  SHORTAGE: 'عجز مستحق',
  CANCEL: 'إلغاء / رد كامل',
};

const fmt = (n: number) => `${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtC = (n: number, code: string) => `${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;

const CURRENCY_FRACTIONS: Record<string, string> = {
  YER: 'فلس',
  SAR: 'هللة',
  USD: 'سنت',
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const newDisbursementParty = (): CustodyDisbursementParty => ({
  id: `cdp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  amount: 0,
  referenceNumber: '',
  narration: '',
});

const disbursementPartyTotal = (parties: CustodyDisbursementParty[] = []) =>
  round2(parties.reduce((sum, party) => sum + (Number(party.amount) || 0), 0));

const validateDisbursementParties = (parties: CustodyDisbursementParty[] = [], amount: number): string | null => {
  if (parties.length === 0) return 'أضف طرفاً مستفيداً واحداً على الأقل لصرف العهدة.';
  if (parties.some(party => !party.name.trim() || !(Number(party.amount) > 0))) return 'أكمل اسم وقيمة كل طرف مستفيد من الصرف.';
  const total = disbursementPartyTotal(parties);
  if (Math.abs(total - amount) > 0.01) return `إجمالي الأطراف المستفيدة (${fmt(total)}) يجب أن يساوي قيمة العهدة (${fmt(amount)}).`;
  return null;
};

interface CustodyFormState {
  type: CustodyType;
  title: string;
  employeeId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  costCenterId: string;
  expectedClearanceDate: string;
  maxBalance: number;
  assetDescription: string;
  requestedDate: string;
  referenceNumber: string;
  narration: string;
  disbursementMethod: DisbursementMethod;
  disbursementSource: string;
  disbursementParties: CustodyDisbursementParty[];
  custodyCode: string;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = `${d.getDate()}`.padStart(2, '0');
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const DISBURSE_METHOD_META: Record<DisbursementMethod, { label: string; icon: React.ElementType }> = {
  CASH: { label: 'نقداً من صندوق', icon: Building2 },
  BANK_TRANSFER: { label: 'حساب بنكي / شيك', icon: Landmark },
  EXCHANGE: { label: 'شركة صرافة', icon: ArrowRightLeft },
};

const DISBURSE_SOURCE_LABEL: Record<DisbursementMethod, { label: string; searchPlaceholder: string; searchIcon: React.ElementType }> = {
  CASH: { label: 'مصدر النقدية (الصندوق) *', searchPlaceholder: 'بحث بالصندوق أو الحساب...', searchIcon: Wallet },
  BANK_TRANSFER: { label: 'البنك المسحوب منه *', searchPlaceholder: 'بحث بالبنك أو الحساب...', searchIcon: Landmark },
  EXCHANGE: { label: 'شركة الصرافة *', searchPlaceholder: 'بحث بشركة الصرافة أو الحساب...', searchIcon: ArrowRightLeft },
};

const FORM_LABEL = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1';
const FORM_INPUT = 'w-full h-10 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 font-mono';
const LOCKED_CLS = 'disabled:opacity-60 disabled:cursor-not-allowed';

const StatCard = ({ label, value, hint, icon: Icon, iconClass }: { label: string; value: string; hint: string; icon: React.ElementType; iconClass: string }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 relative overflow-hidden shadow-sm">
    <div className="flex items-center justify-between relative">
      <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{label}</p>
      <div className={`p-2.5 rounded-xl border border-white/10 shadow-lg ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
  </div>
);

const DetailField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const TypeChip = ({ type }: { type: CustodyType }) => {
  const meta = CUSTODY_META[type];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-2 py-1 rounded-full border ${meta.chip}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
};

const StatusChip = ({ status, overdue }: { status: CustodyStatus; overdue?: boolean }) => {
  const meta = CUSTODY_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full border ${overdue ? 'bg-red-100 text-red-700 border-red-300' : meta.badge}`}>
      {meta.label}
      {overdue && <span className="text-red-600">• متأخرة</span>}
    </span>
  );
};

type SourceEntity = { id: string; label: string; accountId: string; account: Account };

const CustodyFormFields = ({ form, setForm, locked, baseCode, employees, costCenters, cashBoxes, bankAccounts, cashSourceEntities, bankSourceEntities, exchangeSourceEntities, createCurrencyOptions, rateGuard, changeCurrency }: {
  form: CustodyFormState;
  setForm: React.Dispatch<React.SetStateAction<CustodyFormState>>;
  locked: boolean;
  baseCode: string;
  employees: Employee[];
  costCenters: CostCenter[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  cashSourceEntities: SourceEntity[];
  bankSourceEntities: SourceEntity[];
  exchangeSourceEntities: SourceEntity[];
  createCurrencyOptions: Currency[];
  rateGuard: { violationOf: (rate: number, code: string) => string | null };
  changeCurrency: (setForm: React.Dispatch<React.SetStateAction<CustodyFormState>>, code: string) => void;
}) => {
  const curCode = form.currency || baseCode || 'YER';
  const isBaseCur = curCode === baseCode;
  const update = (patch: Partial<CustodyFormState>) => setForm(prev => ({ ...prev, ...patch }));
  const localAmount = round2((Number(form.amount) || 0) * (Number(form.exchangeRate) || 1));
  const updateLocalAmount = (raw: string) => {
    if (isBaseCur) return;
    const local = Number(raw) || 0;
    const amount = Number(form.amount) || 0;
    if (amount <= 0) return;
    const next = handleCurrencyFieldChange('local', local, {
      foreignAmount: amount,
      exchangeRate: Number(form.exchangeRate) || 1,
      localAmount,
    });
    update({ exchangeRate: next.exchangeRate });
  };
  const methodSources =
    form.disbursementMethod === 'CASH'
      ? cashSourceEntities
      : form.disbursementMethod === 'BANK_TRANSFER'
        ? bankSourceEntities
        : exchangeSourceEntities;
  const selectedSource = [...cashSourceEntities, ...bankSourceEntities, ...exchangeSourceEntities].find(s => s.id === form.disbursementSource);
  const selectedEmployee = employees.find(e => e.id === form.employeeId);
  const rateViolation = isBaseCur ? null : rateGuard.violationOf(Number(form.exchangeRate) || 1, curCode);
  const methodSourceMeta = DISBURSE_SOURCE_LABEL[form.disbursementMethod];
  const partyTotal = disbursementPartyTotal(form.disbursementParties);
  const updateParty = (index: number, patch: Partial<CustodyDisbursementParty>) =>
    update({ disbursementParties: form.disbursementParties.map((party, i) => i === index ? { ...party, ...patch } : party) });
  const creditPreview = (() => {
    if (!selectedSource) return null;
    if (form.disbursementMethod === 'CASH') {
      const box = cashBoxes.find(b => b.id === selectedSource.id);
      return box ? { title: 'حـ/ الصندوق', name: box.nameAr } : { title: 'حـ/ الصندوق', name: selectedSource.account.nameAr };
    }
    const bank = bankAccounts.find(b => b.id === selectedSource.id);
    if (form.disbursementMethod === 'BANK_TRANSFER') {
      return { title: 'حـ/ البنك', name: bank ? bank.bankNameAr : selectedSource.account.nameAr };
    }
    return { title: 'حـ/ شركات الصرافة', name: bank ? bank.bankNameAr : selectedSource.account.nameAr };
  })();
  return (
    <div className="space-y-5">
      {locked && (
        <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" />
          العهدة مصروفة وقد رُحّل قيدها المحاسبي — الحقول المالية (النوع، الموظف، المبلغ، العملة، مصدر الصرف) محمية. يمكن تعديل البيانات الوصفية فقط.
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Vault className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white">بيانات العهدة والمسؤول</h3>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={FORM_LABEL}>رقم العهدة (تلقائي)</label>
            <div className="w-full px-3 py-2 rounded-xl bg-sky-50 border border-sky-300 text-sky-700 font-mono font-black text-sm flex items-center justify-between gap-2">
              <span>{form.custodyCode || 'CST-001'}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">تلقائي</span>
            </div>
          </div>
          <div>
            <label className={FORM_LABEL}>نوع العهدة *</label>
            <select value={form.type} disabled={locked} onChange={e => update({ type: e.target.value as CustodyType })} className={`w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 ${LOCKED_CLS}`}>
              {(Object.keys(CUSTODY_META) as CustodyType[]).map(t => <option key={t} value={t} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{CUSTODY_META[t].label}</option>)}
            </select>
          </div>
          <div>
            <label className={FORM_LABEL}>تاريخ الطلب *</label>
            <DateField  value={form.requestedDate} onChange={e => update({ requestedDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="sm:col-span-2">
            <label className={FORM_LABEL}>الموظف المكلف *</label>
            <SearchableSelect
              value={form.employeeId}
              disabled={locked}
              onChange={id => update({ employeeId: id })}
              options={employees.filter(e => e.isActive)}
              getValue={e => e.id}
              getLabel={e => <span>{e.code} - {e.nameAr}</span>}
              getSearchText={e => `${e.code} ${e.nameAr} ${e.jobTitle}`}

              searchPlaceholder="بحث بالرقم الوظيفي أو الاسم..."
              searchIcon={Users}
            />

          </div>
          <div className="sm:col-span-3">
            <label className={FORM_LABEL}>الغرض / بيان العهدة *</label>
            <input type="text" required value={form.title} onChange={e => update({ title: e.target.value })} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.type === 'TEMPORARY' && (
            <div>
              <label className={FORM_LABEL}>تاريخ الانقضاء (التصفية الإجبارية) *</label>
              <DateField  value={form.expectedClearanceDate} onChange={e => update({ expectedClearanceDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
            </div>
          )}
          {form.type === 'ASSET' && (
            <div>
              <label className={FORM_LABEL}>وصف العين المسندة *</label>
              <textarea value={form.assetDescription} onChange={e => update({ assetDescription: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30" />
            </div>
          )}
          <div className={form.type === 'PETTY_CASH' ? 'sm:col-span-2' : ''}>
            <label className={FORM_LABEL}>رقم المرجع</label>
            <input type="text" value={form.referenceNumber} onChange={e => update({ referenceNumber: e.target.value })} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 font-mono" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white">التوجيه المالي والمحاسبي</h3>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start w-full">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium whitespace-nowrap text-right">مركز التكلفة</label>
            <SearchableSelect
              value={form.costCenterId}
              onChange={id => update({ costCenterId: id })}
              options={costCenters}
              getValue={cc => cc.id}
              getLabel={cc => <span>{cc.code} - {cc.nameAr}</span>}
              getSearchText={cc => `${cc.code} ${cc.nameAr}`}

              allowClear
              clearLabel="بدون مركز تكلفة"
              searchPlaceholder="بحث بالكود أو الاسم..."
              searchIcon={Network}
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium whitespace-nowrap text-right">{form.type === 'PETTY_CASH' ? `الرصيد الأولي (${curCode}) *` : `قيمة العهدة (${curCode}) *`}</label>
            <AmountInput required disabled={locked} value={form.amount} onChange={v => update({ amount: Number(v) })} className="h-10 w-full px-3 py-2 text-sm border rounded-md bg-background border-input focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {form.type === 'PETTY_CASH' && (
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-sm font-medium whitespace-nowrap text-right">السقف المالي (Maximum Balance) *</label>
              <AmountInput required disabled={locked} value={form.maxBalance} onChange={v => update({ maxBalance: Number(v) })} className="h-10 w-full px-3 py-2 text-sm border rounded-md bg-background border-input focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium whitespace-nowrap text-right">العملة *</label>
            <select value={form.currency} disabled={locked} onChange={e => changeCurrency(setForm, e.target.value)} className="h-10 w-full px-3 py-2 text-sm border rounded-md bg-background border-input focus:outline-none focus:ring-2 focus:ring-primary">
              {createCurrencyOptions.map(c => <option key={c.id} value={c.code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{c.code} - {c.nameAr}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium whitespace-nowrap text-right">سعر الصرف</label>
            <input
              type="number"
              min={0.0001}
              step={0.0001}
              value={form.exchangeRate}
              disabled={isBaseCur || locked}
              onChange={e => update({ exchangeRate: Number(e.target.value) })}
              className="h-10 w-full px-3 py-2 text-sm border rounded-md bg-background border-input focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {!isBaseCur && rateViolation && <span className="text-xs text-red-600">{rateViolation}</span>}
          </div>
          {!isBaseCur && (
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-sm font-medium whitespace-nowrap text-right">المبلغ المحلي ({baseCode}) *</label>
              <AmountInput
                required
                disabled={locked}
                value={localAmount}
                onChange={updateLocalAmount}
                title="تحرير المبلغ المحلي يعيد حساب سعر الصرف تلقائياً = المحلي ÷ الأجنبي"
                className="h-10 w-full px-3 py-2 text-sm border rounded-md bg-background border-input focus:outline-none focus:ring-2 focus:ring-primary"
              />

            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white">الصرف الفوري والقيد الآلي</h3>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={FORM_LABEL}>طريقة الصرف *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(DISBURSE_METHOD_META) as DisbursementMethod[]).map(m => {
                const Icon = DISBURSE_METHOD_META[m].icon;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={locked}
                    onClick={() => update({ disbursementMethod: m, disbursementSource: '' })}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      form.disbursementMethod === m ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {DISBURSE_METHOD_META[m].label}
                  </button>
                );
              })}
            </div>

          </div>
          <div>
            <label className={FORM_LABEL}>{methodSourceMeta.label}</label>
            <SearchableSelect
              value={form.disbursementSource}
              disabled={locked}
              onChange={id => update({ disbursementSource: id })}
              options={methodSources}
              getValue={s => s.id}
              getLabel={s => <span>{s.label} <span className="text-slate-500 dark:text-slate-400 font-mono">({s.account.code})</span></span>}
              getSearchText={s => `${s.label} ${s.account.code} ${s.account.nameAr}`}

              searchPlaceholder={methodSourceMeta.searchPlaceholder}
              searchIcon={methodSourceMeta.searchIcon}
            />

          </div>
        </div>

        <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2.5">
          <p className="text-sm font-black text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <ScrollText className="w-3.5 h-3.5 text-sky-600" />
            القيد الآلي المتولد عند الترحيل
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg p-2.5 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30">
              <span className="text-slate-500 dark:text-slate-400">مدين: </span>
              <span className="font-bold text-sky-700">حـ/ عُهد الموظفين — {selectedEmployee ? selectedEmployee.nameAr : 'الموظف'}</span>
            </div>
            <div className="rounded-lg p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <span className="text-slate-500 dark:text-slate-400">دائن: </span>
              {creditPreview ? (
                <span className="font-bold text-emerald-600">{creditPreview.title} — {creditPreview.name}</span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">اختر مصدر الصرف لعرض القيد الآلي</span>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            القيمة: <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(Number(form.amount) || 0, curCode)}</span>
            {!isBaseCur && (
              <> • المعادل: <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(round2((Number(form.amount) || 0) * (Number(form.exchangeRate) || 1)), baseCode || 'YER')}</span></>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">الأطراف المستفيدة من صرف العهدة *</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">بنفس منطق سند الصرف: وزّع كامل مبلغ العهدة على المستفيدين الفعليين.</p>
            </div>
            {!locked && <button type="button" onClick={() => update({ disbursementParties: [...form.disbursementParties, newDisbursementParty()] })} className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" />إضافة طرف</button>}
          </div>
          {form.disbursementParties.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">لم تتم إضافة أطراف بعد.</div>
          ) : form.disbursementParties.map((party, index) => (
            <div key={party.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50 dark:bg-slate-800">
              <div className="sm:col-span-4"><label className={FORM_LABEL}>اسم الطرف *</label><input disabled={locked} value={party.name} onChange={e => updateParty(index, { name: e.target.value })} className={`${FORM_INPUT} ${LOCKED_CLS}`} /></div>
              <div className="sm:col-span-3"><label className={FORM_LABEL}>المبلغ ({curCode}) *</label><AmountInput disabled={locked} value={party.amount} onChange={value => updateParty(index, { amount: Number(value) || 0 })} className={`${FORM_INPUT} ${LOCKED_CLS}`} /></div>
              <div className="sm:col-span-2"><label className={FORM_LABEL}>رقم المرجع</label><input disabled={locked} value={party.referenceNumber || ''} onChange={e => updateParty(index, { referenceNumber: e.target.value })} className={`${FORM_INPUT} ${LOCKED_CLS}`} /></div>
              <div className="sm:col-span-2"><label className={FORM_LABEL}>البيان</label><input disabled={locked} value={party.narration || ''} onChange={e => updateParty(index, { narration: e.target.value })} className={`${FORM_INPUT} ${LOCKED_CLS}`} /></div>
              <div className="sm:col-span-1 flex items-end"><button type="button" disabled={locked} onClick={() => update({ disbursementParties: form.disbursementParties.filter((_, i) => i !== index) })} className="w-full h-10 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer flex items-center justify-center" title="حذف الطرف"><Trash2 className="w-4 h-4" /></button></div>
            </div>
          ))}
          <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold ${Math.abs(partyTotal - (Number(form.amount) || 0)) < 0.01 && form.disbursementParties.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <span>إجمالي الأطراف: {fmtC(partyTotal, curCode)}</span>
            <span>المطلوب: {fmtC(Number(form.amount) || 0, curCode)}</span>
          </div>
        </div>
      </section>

      <div>
        <label className={FORM_LABEL}>ملاحظات</label>
        <textarea value={form.narration} onChange={e => update({ narration: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30" />
      </div>
    </div>
  );
};

export default function CustodyView({
  custodies,
  accounts,
  journals,
  employees,
  cashBoxes,
  bankAccounts,
  vendors,
  costCenters,
  currencies,
  onAddCustody,
  onUpdateCustody,
  onAddJournal,
  currentUserName,
  closedYears,
}: Props) {
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<'ALL' | CustodyStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CustodyType>('ALL');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [attachments, setAttachments] = useState<SupportingDocument[]>([]);
  const { active: activeCurrencies, baseCode, rateOf } = useActiveCurrencies(currencies);
  const baseCurrency = baseCode || 'YER';
  const rateGuard = useExchangeRateGuard(currencies);
  const createCurrencyOptions = activeCurrencies.length > 0 ? activeCurrencies : currencies;
  const [createForm, setCreateForm] = useState<CustodyFormState>({
    type: 'TEMPORARY' as CustodyType,
    title: '',
    employeeId: '',
    amount: 0,
    currency: '',
    exchangeRate: 1,
    costCenterId: '',
    expectedClearanceDate: '',
    maxBalance: 0,
    assetDescription: '',
    requestedDate: today(),
    referenceNumber: '',
    narration: '',
    disbursementMethod: 'CASH' as DisbursementMethod,
    disbursementSource: '',
    disbursementParties: [],
    custodyCode: '',
  });

  const [editTarget, setEditTarget] = useState<Custody | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<CustodyFormState>({
    type: 'TEMPORARY' as CustodyType,
    title: '',
    employeeId: '',
    amount: 0,
    currency: '',
    exchangeRate: 1,
    costCenterId: '',
    expectedClearanceDate: '',
    maxBalance: 0,
    assetDescription: '',
    requestedDate: today(),
    referenceNumber: '',
    narration: '',
    disbursementMethod: 'CASH' as DisbursementMethod,
    disbursementSource: '',
    disbursementParties: [],
    custodyCode: '',
  });
  const [editError, setEditError] = useState('');

  const [printCustody, setPrintCustody] = useState<Custody | null>(null);
  const [printJournal, setPrintJournal] = useState<JournalEntry | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printablePaperRef = useRef<HTMLDivElement>(null);
  const handlePrintPreview = () => openDesktopPrintPreview(printablePaperRef.current, `كشف عهدة ${printCustody?.custodyNumber || ''}`, 'portrait');

  const [approveTarget, setApproveTarget] = useState<Custody | null>(null);
  const [disburseTarget, setDisburseTarget] = useState<Custody | null>(null);
  const [disburseSource, setDisburseSource] = useState('');
  const [settleTarget, setSettleTarget] = useState<Custody | null>(null);
  const [settleItems, setSettleItems] = useState<CustodySettlementItem[]>([]);
  const [settlementAttachments, setSettlementAttachments] = useState<SupportingDocument[]>([]);
  const [vatAccountId, setVatAccountId] = useState('');
  const [apAccountId, setApAccountId] = useState('');
  const [refundTarget, setRefundTarget] = useState<Custody | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundSource, setRefundSource] = useState('');
  const [replenishTarget, setReplenishTarget] = useState<Custody | null>(null);
  const [replenishItems, setReplenishItems] = useState<CustodySettlementItem[]>([]);
  const [replenishSource, setReplenishSource] = useState('');
  const [replenishVatAccountId, setReplenishVatAccountId] = useState('');
  const [closeTarget, setCloseTarget] = useState<Custody | null>(null);
  const [voidTarget, setVoidTarget] = useState<Custody | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Custody | null>(null);
  const [rowMenu, setRowMenu] = useState<{ c: Custody; x: number; y: number } | null>(null);
  const [statementTarget, setStatementTarget] = useState<Custody | null>(null);

  const activeCustodies = custodies.filter(c => c.status !== 'VOIDED');
  const overdueList = listOverdueCustodies(custodies);
  const openList = custodies.filter(c => OPEN_STATUSES.includes(c.status));
  const totalOpenValue = openList.reduce((s, c) => s + c.disbursedAmount, 0);
  const totalOutstanding = openList.reduce((s, c) => s + outstandingBalance(c), 0);
  const totalSettledRefunded = activeCustodies.reduce((s, c) => s + c.settledAmount + c.refundedAmount + c.apTransferredAmount, 0);
  const totalReplenished = activeCustodies.reduce((s, c) => s + c.replenishedAmount, 0);

  const postingAccounts = accounts.filter(isPostingAccount);
  const payableAccounts = payablePostingAccounts(accounts);

  const sourceEntities: Array<{ id: string; label: string; accountId: string; account: Account }> = [
    ...cashBoxes.filter(b => b.linkedAccountId).map(b => {
      const acc = accounts.find(a => a.id === b.linkedAccountId);
      return acc ? { id: b.id, label: `${b.code} — صندوق: ${b.nameAr}`, accountId: acc.id, account: acc } : null;
    }),
    ...bankAccounts.filter(b => b.linkedAccountId).map(b => {
      const acc = accounts.find(a => a.id === b.linkedAccountId);
      return acc ? { id: b.id, label: `${b.code} — ${b.entityType === 'BANK' ? 'بنك' : 'شركة صرافة'}: ${b.bankNameAr}`, accountId: acc.id, account: acc } : null;
    }),
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  const cashSourceEntities: Array<{ id: string; label: string; accountId: string; account: Account }> = cashBoxes
    .filter(b => b.isActive && b.linkedAccountId)
    .map(b => {
      const acc = accounts.find(a => a.id === b.linkedAccountId);
      return acc ? { id: b.id, label: `${b.code} — صندوق: ${b.nameAr}`, accountId: acc.id, account: acc } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const bankSourceEntities: Array<{ id: string; label: string; accountId: string; account: Account }> = bankAccounts
    .filter(b => b.isActive && b.linkedAccountId && b.entityType === 'BANK')
    .map(b => {
      const acc = accounts.find(a => a.id === b.linkedAccountId);
      return acc ? { id: b.id, label: `${b.code} — بنك: ${b.bankNameAr}`, accountId: acc.id, account: acc } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const exchangeSourceEntities: Array<{ id: string; label: string; accountId: string; account: Account }> = bankAccounts
    .filter(b => b.isActive && b.linkedAccountId && b.entityType === 'EXCHANGE')
    .map(b => {
      const acc = accounts.find(a => a.id === b.linkedAccountId);
      return acc ? { id: b.id, label: `${b.code} — شركة صرافة: ${b.bankNameAr}`, accountId: acc.id, account: acc } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const employeeOf = (c: Custody) => employees.find(e => e.id === c.employeeId);
  const employeeCustodyAccount = accounts.find(account => account.id === '1102050001' || account.code === '1102050001');
  const advanceAccountOf = (_c?: Custody): Account => employeeCustodyAccount ?? {
    id: '1102050001',
    code: '1102050001',
    nameAr: 'عُهد الموظفين',
    nameEn: 'Employee Custodies',
    level: 5,
    accountType: 2,
    reportType: 1,
    parentId: '110205',
    nature: 'DEBIT',
    category: 'RECEIVABLE',
    subLedgerType: 'EMPLOYEE',
    defaultCurrency: 'YER',
    openingBalance: 0,
    isActive: true,
    currencies: [],
  };

  const q = search.trim().toLowerCase();
  const filtered = custodies.filter(c =>
    (statusFilter === 'ALL' || c.status === statusFilter) &&
    (typeFilter === 'ALL' || c.type === typeFilter) &&
    (!overdueOnly || isOverdue(c)) &&
    (!q ||
      c.custodyNumber.toLowerCase().includes(q) ||
      c.employeeName.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.referenceNumber || '').toLowerCase().includes(q))
  );

  const openModal = (fn: () => void) => {
    if (closedYears?.includes(today().slice(0, 4))) {
      toast('error', `السنة المالية ${today().slice(0, 4)} مغلقة — أعد فتحها من صفحة «الإقفالات والرقابة» أولاً.`);
      return;
    }
    fn();
  };

  const newItem = (): CustodySettlementItem => ({
    id: `si-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    accountId: '',
    accountCode: '',
    accountNameAr: '',
    description: '',
    amount: 0,
    taxRate: 0,
    taxAmount: 0,
    vatInclusive: false,
    total: 0,
  });

  const recomputeItem = (it: CustodySettlementItem): CustodySettlementItem => {
    const gross = Number(it.amount) || 0;
    const rate = Number(it.taxRate) || 0;
    if (it.vatInclusive) {
      const total = gross;
      const tax = rate > 0 ? total - total / (1 + rate) : 0;
      return { ...it, total: Math.round(total * 100) / 100, taxAmount: Math.round(tax * 100) / 100, amount: Math.round((total - tax) * 100) / 100 };
    }
    const tax = gross * rate;
    return { ...it, amount: Math.round(gross * 100) / 100, taxAmount: Math.round(tax * 100) / 100, total: Math.round((gross + tax) * 100) / 100 };
  };

  const itemsTotal = (items: CustodySettlementItem[]) => Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100;

  const nextCustodyCode = (): string => {
    const raw = nextDocumentNumber('CST', custodies);
    const seq = parseInt(String(raw).replace(/^CST-/, ''), 10) || 0;
    return `CST-${String(seq).padStart(3, '0')}`;
  };

  const freshForm = (): CustodyFormState => ({
    type: 'TEMPORARY' as CustodyType,
    title: '',
    employeeId: '',
    amount: 0,
    currency: baseCode || 'YER',
    exchangeRate: 1,
    costCenterId: '',
    expectedClearanceDate: '',
    maxBalance: 0,
    assetDescription: '',
    requestedDate: today(),
    referenceNumber: '',
    narration: '',
    disbursementMethod: 'CASH' as DisbursementMethod,
    disbursementSource: '',
    disbursementParties: [],
    custodyCode: '',
  });

  const openCreate = () => {
    setCreateError('');
    setCreateForm({ ...freshForm(), currency: baseCode || 'YER', exchangeRate: rateOf(baseCode || 'YER'), custodyCode: nextCustodyCode() });
    setIsCreateOpen(true);
  };

  const changeCurrency = (setForm: React.Dispatch<React.SetStateAction<CustodyFormState>>, code: string) => {
    setForm(prev => ({ ...prev, currency: code, exchangeRate: rateOf(code), disbursementSource: '' }));
  };

  const canEditCustody = (c: Custody): boolean => c.status !== 'VOIDED' && c.status !== 'CLOSED' && c.status !== 'FULL_SETTLED';

  const openEdit = (c: Custody) => {
    openModal(() => {
      setEditError('');
      setEditForm({
        type: c.type,
        title: c.title,
        employeeId: c.employeeId,
        amount: c.amount,
        currency: c.currency || baseCode || 'YER',
        exchangeRate: c.exchangeRate || 1,
        costCenterId: c.costCenterId || '',
        expectedClearanceDate: c.expectedClearanceDate || '',
        maxBalance: c.maxBalance ?? 0,
        assetDescription: c.assetDescription || '',
        requestedDate: c.requestedDate || today(),
        referenceNumber: c.referenceNumber || '',
        narration: c.narration || '',
        disbursementMethod: c.disbursementMethod || 'CASH',
        disbursementSource: c.disbursementSource || '',
        disbursementParties: c.disbursementParties || [],
        custodyCode: c.custodyNumber,
      });
      setEditTarget(c);
      setIsEditOpen(true);
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const c = editTarget;
    const disbursed = c.disbursedAmount > 0;
    const form = editForm;
    const amount = Number(form.amount) || 0;
    const employee = employees.find(x => x.id === form.employeeId);
    const account = advanceAccountOf(c);

    const validation = validateNewCustody(
      form.type,
      form.title,
      employee,
      amount,
      form.expectedClearanceDate,
      Number(form.maxBalance) || 0,
      form.assetDescription,
      account
    );
    if (!validation.isValid) {
      setEditError(validation.errors.join(' '));
      return;
    }
    if (!disbursed && form.type === 'TEMPORARY') {
      const violation = findOverdueViolation(form.employeeId, custodies.filter(x => x.id !== c.id));
      if (violation) {
        setEditError(`لا يمكن تعديل العهدة لموظف لديه عهدة متأخرة (${violation.custodyNumber}) — صفّها أو حدّث تاريخ انقضائها أولاً.`);
        return;
      }
    }
    if (!disbursed) {
      const code = form.currency || baseCode || 'YER';
      const rate = Number(form.exchangeRate) || 1;
      if (code !== baseCode) {
        const v = rateGuard.violationOf(rate, code);
        if (v) {
          setEditError(`سعر الصرف خارج النطاق المسموح: ${v}`);
          return;
        }
      }
      const partiesError = validateDisbursementParties(form.disbursementParties, amount);
      if (partiesError) {
        setEditError(partiesError);
        return;
      }
    }

    const updates: Partial<Custody> = {
      type: form.type,
      title: form.title.trim(),
      employeeId: employee ? employee.id : c.employeeId,
      employeeName: employee ? employee.nameAr : c.employeeName,
      amount,
      currency: disbursed ? c.currency : form.currency || baseCode || 'YER',
      exchangeRate: disbursed ? c.exchangeRate : Number(form.exchangeRate) || 1,
      disbursementMethod: disbursed ? c.disbursementMethod : form.disbursementMethod,
      disbursementSource: disbursed ? c.disbursementSource : form.disbursementSource,
      disbursementParties: disbursed ? c.disbursementParties : form.disbursementParties.map(party => ({ ...party, name: party.name.trim(), referenceNumber: party.referenceNumber?.trim() || undefined, narration: party.narration?.trim() || undefined })),
      costCenterId: form.costCenterId || undefined,
      assetDescription: form.type === 'ASSET' ? form.assetDescription.trim() : undefined,
      maxBalance: form.type === 'PETTY_CASH' ? Number(form.maxBalance) || amount : undefined,
      requestedDate: form.requestedDate || today(),
      expectedClearanceDate: form.expectedClearanceDate || undefined,
      referenceNumber: form.referenceNumber.trim() || undefined,
      narration: form.narration.trim() || undefined,
      updatedAt: nowStamp(),
      attachments,
    };

    let extra: Partial<Custody> = {};
    if (!disbursed && (c.amount !== amount || c.employeeId !== (employee?.id ?? c.employeeId))) {
      const level = requiredApprovalLevel(amount, employee);
      const approvals: CustodyApproval[] = Array.from({ length: level }, (_, i) => ({
        id: `la-${Date.now()}-${i + 1}`,
        level: i + 1,
        approverName: APPROVAL_LEVEL_ROLES[i].roleName,
        action: 'PENDING' as const,
      }));
      extra = c.status === 'CREATED' ? { status: 'CREATED' } : { approvals, status: 'PENDING_APPROVAL' };
    }

    onUpdateCustody(c.id, { ...updates, ...extra });
    toast('success', extra.status === 'PENDING_APPROVAL' ? `تم تعديل ${c.custodyNumber} — أُعيدت للاعتماد بتسلسل جديد حسب القيمة المحدثة.` : `تم تعديل ${c.custodyNumber}.`);
    setIsEditOpen(false);
    setEditTarget(null);
  };

  const persistCustody = (printAfter: boolean) => {
    setCreateError('');
    const amount = Number(createForm.amount) || 0;
    const employee = employees.find(x => x.id === createForm.employeeId);
    const validation = validateNewCustody(
      createForm.type,
      createForm.title,
      employee,
      amount,
      createForm.expectedClearanceDate,
      Number(createForm.maxBalance) || 0,
      createForm.assetDescription,
      advanceAccountOf()
    );
    if (!validation.isValid) {
      setCreateError(validation.errors.join(' '));
      return;
    }
    const partiesError = validateDisbursementParties(createForm.disbursementParties, amount);
    if (partiesError) {
      setCreateError(partiesError);
      return;
    }
    if (createForm.type === 'TEMPORARY') {
      const violation = findOverdueViolation(createForm.employeeId, custodies);
      if (violation) {
        setCreateError(`لا يمكن إصدار عهدة مؤقتة جديدة — لدى ${violation.employeeName} عهدة متأخرة (${violation.custodyNumber}) تجاوزت تاريخ التصفية بـ ${overdueDays(violation)} يوم.`);
        return;
      }
    }
    const code = createForm.currency || baseCode || 'YER';
    const rate = Number(createForm.exchangeRate) || 1;
    if (code !== baseCode) {
      const violation = rateGuard.violationOf(rate, code);
      if (violation) {
        setCreateError(`سعر الصرف خارج النطاق المسموح: ${violation}`);
        return;
      }
    }
    if (!employee) {
      setCreateError('يرجى اختيار الموظف المكلف — يلزم ربط العهدة بأستاذ الموظفين.');
      return;
    }

    const custody: Custody = {
      id: `ls-${Date.now()}`,
      custodyNumber: createForm.custodyCode || nextCustodyCode(),
      type: createForm.type,
      title: createForm.title.trim(),
      employeeId: employee.id,
      employeeName: employee.nameAr,
      amount,
      currency: code,
      exchangeRate: rate,
      disbursementMethod: createForm.disbursementMethod,
      disbursementSource: createForm.disbursementSource || '',
      disbursementParties: createForm.disbursementParties.map(party => ({ ...party, name: party.name.trim(), referenceNumber: party.referenceNumber?.trim() || undefined, narration: party.narration?.trim() || undefined })),
      status: 'CREATED',
      costCenterId: createForm.costCenterId || undefined,
      assetDescription: createForm.type === 'ASSET' ? createForm.assetDescription.trim() : undefined,
      maxBalance: createForm.type === 'PETTY_CASH' ? Number(createForm.maxBalance) || amount : undefined,
      requestedDate: createForm.requestedDate || today(),
      expectedClearanceDate: createForm.expectedClearanceDate || undefined,
      approvals: [],
      settlements: [],
      transactions: [],
      disbursedAmount: 0,
      settledAmount: 0,
      refundedAmount: 0,
      shortageAmount: 0,
      apTransferredAmount: 0,
      replenishedAmount: 0,
      referenceNumber: createForm.referenceNumber.trim() || undefined,
      narration: createForm.narration.trim() || undefined,
      createdBy: currentUserName,
      createdAt: nowStamp(),
      updatedAt: nowStamp(),
    };

    onAddCustody(custody);
    toast('success', `تم حفظ العهدة ${custody.custodyNumber} كجديدة — جاهزة للاعتماد والصرف الآلي.`);
    setIsCreateOpen(false);
    setCreateForm(freshForm());
    if (printAfter) {
      setPrintCustody(custody);
      setPrintJournal(null);
      setIsPrintOpen(true);
    }
  };

  const handleSavePdf = async () => {
    if (!printablePaperRef.current || !printCustody) return;
    setPdfBusy(true);
    try {
      const { downloadVoucherPdf, voucherFileName } = await import('../../utils/voucherPdf');
      await downloadVoucherPdf(printablePaperRef.current, voucherFileName('CUSTODY', printCustody.custodyNumber));
      toast('success', 'تم حفظ السند PDF.');
    } catch {
      toast('error', 'تعذر إنشاء ملف PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const openRowMenu = (e: React.MouseEvent, c: Custody) => {
    e.preventDefault();
    e.stopPropagation();
    setRowMenu(prev => (prev && prev.c.id === c.id ? null : { c, x: Math.min(e.clientX, window.innerWidth - 250), y: Math.min(e.clientY, window.innerHeight - 360) }));
  };

  const openPrint = (c: Custody) => {
    setPrintCustody(c);
    setPrintJournal(null);
    setIsPrintOpen(true);
  };

  const handleSubmitForApproval = (c: Custody) => {
    const level = requiredApprovalLevel(c.amount, employeeOf(c));
    const approvals: CustodyApproval[] = Array.from({ length: level }, (_, i) => ({
      id: `la-${Date.now()}-${i + 1}`,
      level: i + 1,
      approverName: APPROVAL_LEVEL_ROLES[i].roleName,
      action: 'PENDING',
    }));
    onUpdateCustody(c.id, { approvals, status: 'PENDING_APPROVAL', updatedAt: nowStamp() });
    toast('success', `أُرسلت ${c.custodyNumber} للاعتماد.`);
  };

  const openApprove = (c: Custody) => {
    openModal(() => setApproveTarget(c));
  };

  const handleApprove = (level: number, action: 'APPROVED' | 'REJECTED') => {
    if (!approveTarget) return;
    const requiredLevel = requiredApprovalLevel(approveTarget.amount, employeeOf(approveTarget));
    if (!canApprove(approveTarget, level)) {
      toast('error', 'العهدة ليست بانتظار الاعتماد.');
      return;
    }
    const approvals: CustodyApproval[] = [
      ...approveTarget.approvals.filter(a => a.action !== 'PENDING'),
      { id: `approval-${Date.now()}`, level: 1, approverName: currentUserName, action, actionAt: nowStamp() },
    ];
    if (action === 'REJECTED') {
      onUpdateCustody(approveTarget.id, { approvals, status: 'CREATED', updatedAt: nowStamp() });
      toast('info', `تم رفض ${approveTarget.custodyNumber} — أُعيدت لحالة جديدة.`);
      setApproveTarget(null);
      return;
    }
    const complete = approvalsComplete(approvals, requiredLevel);
    onUpdateCustody(approveTarget.id, {
      approvals,
      status: complete ? 'APPROVED' : 'PENDING_APPROVAL',
      updatedAt: nowStamp(),
    });
    toast('success', complete ? `تم اعتماد ${approveTarget.custodyNumber}.` : `تم اعتماد المستوى ${level} من ${requiredLevel}.`);
    setApproveTarget(null);
  };

  const handleDisburse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseTarget) return;
    const source = sourceEntities.find(s => s.id === disburseSource);
    if (!source) {
      toast('error', 'يرجى اختيار مصدر التمويل (صندوق / بنك بحساب مرتبط).');
      return;
    }
    if (!canDisburse(disburseTarget)) {
      toast('error', 'هذه العهدة ليست جاهزة للاعتماد والصرف الآلي.');
      return;
    }
    if (disburseTarget.disbursedAmount > 0) {
      toast('error', 'العهدة مصروفة بالفعل.');
      return;
    }
    const partiesError = validateDisbursementParties(disburseTarget.disbursementParties, disburseTarget.amount);
    if (partiesError) {
      toast('error', partiesError);
      return;
    }
    const advanceAcc = advanceAccountOf(disburseTarget);
    const ctx: JournalBuildContext = {
      journalId: `je-${Date.now()}`,
      entryNumber: nextJournalNumber(journals),
      currency: disburseTarget.currency || 'YER',
      exchangeRate: disburseTarget.exchangeRate || 1,
      isForeignCurrency: (disburseTarget.currency || baseCurrency) !== baseCurrency,
      createdBy: currentUserName,
      reference: `CUSTODY-${disburseTarget.custodyNumber}`,
    };
    const journal = buildDisbursementJournal(ctx, { ...disburseTarget, disbursementSource: disburseSource }, advanceAcc, source.account);
    if (!onAddJournal(journal)) {
      toast('error', 'تعذر ترحيل قيد صرف العهدة؛ لم تُعدّل العهدة.');
      return;
    }
    const txn: CustodyTransaction = {
      id: `lt-${Date.now()}`,
      type: 'DISBURSE',
      date: today(),
      amount: disburseTarget.amount,
      journalEntryId: journal.id,
      narration: `صرف ${disburseTarget.custodyNumber} من ${source.account.nameAr}`,
      createdBy: currentUserName,
      createdAt: nowStamp(),
    };
    const approvals = disburseTarget.approvals.some(approval => approval.action === 'APPROVED')
      ? disburseTarget.approvals
      : [...disburseTarget.approvals.filter(approval => approval.action !== 'PENDING'), { id: `approval-${Date.now()}`, level: 1, approverName: currentUserName, action: 'APPROVED' as const, actionAt: nowStamp() }];
    onUpdateCustody(disburseTarget.id, {
      approvals,
      disbursedAmount: disburseTarget.amount,
      status: 'DISBURSED',
      transactions: [...disburseTarget.transactions, txn],
      updatedAt: nowStamp(),
    });
    toast('success', `تم اعتماد وصرف ${disburseTarget.custodyNumber} (${fmtC(disburseTarget.amount, disburseTarget.currency || baseCurrency)}) وترحيل القيد المحاسبي ${journal.entryNumber}.`);
    setDisburseTarget(null);
    setDisburseSource('');
  };

  const openSettle = (c: Custody) => {
    openModal(() => {
      setSettleTarget(c);
      setSettleItems([]);
      setSettlementAttachments([]);
      setVatAccountId('');
      setApAccountId('');
    });
  };

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    if (settleItems.length === 0) {
      toast('error', 'أضف بند مستند واحداً على الأقل للتصفية.');
      return;
    }
    const invalid = settleItems.find(it => !it.accountId || !it.description.trim() || it.total <= 0);
    if (invalid) {
      toast('error', 'أكمل بنود التصفية: حساب مصروف، وصف، وقيمة أكبر من صفر.');
      return;
    }
    const vendorNoVat = settleItems.find(it => {
      if (!it.vendorId) return false;
      const v = vendors.find(x => x.id === it.vendorId);
      return v && !v.vatNumber.trim() && it.total > 0;
    });
    if (vendorNoVat) {
      toast('error', `المورد «${vendorNoVat.vendorName}» لا يملك رقماً ضريبياً — الفاتورة غير صالحة للتصفية.`);
      return;
    }
    const expenseTotal = itemsTotal(settleItems);
    const remaining = outstandingBalance(settleTarget);
    const excess = Math.max(0, Math.round((expenseTotal - remaining) * 100) / 100);
    if (excess > 0 && !apAccountId) {
      toast('error', `قيمة المستندات (${fmtC(expenseTotal, settleTarget.currency || baseCurrency)}) تتجاوز الرصيد القائم (${fmtC(remaining, settleTarget.currency || baseCurrency)}) — اختر حساب دائن (AP) للمستحق للموظف.`);
      return;
    }
    const vatAcc = vatAccountId ? accounts.find(a => a.id === vatAccountId) : undefined;
    const apAcc = apAccountId ? accounts.find(a => a.id === apAccountId) : undefined;
    if (settleItems.some(it => it.taxAmount > 0) && !vatAcc) {
      toast('error', 'توجد بنود بضريبة قيمة مضافة دون تحديد حساب الضريبة.');
      return;
    }

    const advanceAcc = advanceAccountOf(settleTarget);
    const settleSource = sourceEntities.find(s => s.id === settleTarget.disbursementSource);
    const ctx: JournalBuildContext = {
      journalId: `je-${Date.now()}`,
      entryNumber: nextJournalNumber(journals),
      currency: settleTarget.currency || 'YER',
      exchangeRate: settleTarget.exchangeRate || 1,
      isForeignCurrency: (settleTarget.currency || baseCurrency) !== baseCurrency,
      createdBy: currentUserName,
      reference: `CUSTODY-${settleTarget.custodyNumber}`,
    };
    const journal = buildSettlementJournal(ctx, settleTarget, settleItems, advanceAcc, apAcc ?? null, vatAcc ?? null, settleSource?.account);
    if (!onAddJournal(journal)) {
      toast('error', 'تعذر ترحيل قيد تصفية العهدة؛ لم تُعدّل العهدة.');
      return;
    }

    const cashRefunded = Math.max(0, remaining - expenseTotal);
    const nextStatus = statusAfterSettlement(settleTarget, expenseTotal);
    const settlement: CustodySettlement = {
      id: `ls-${Date.now()}`,
      settlementNumber: `STL-${settleTarget.settlements.length + 1}`,
      date: today(),
      items: settleItems,
      totalExpense: expenseTotal,
      cashRefunded,
      shortageAmount: 0,
      apTransferred: excess,
      narration: `تصفية ${settleTarget.custodyNumber} بالمستندات`,
      journalEntryId: journal.id,
      createdBy: currentUserName,
      createdAt: nowStamp(),
      attachments: settlementAttachments,
    };
    const txns: CustodyTransaction[] = [
      { id: `lt-${Date.now()}`, type: 'SETTLEMENT', date: today(), amount: expenseTotal, journalEntryId: journal.id, settlementId: settlement.id, narration: `تصفية بالمستندات (${settleItems.length} بند)`, createdBy: currentUserName, createdAt: nowStamp() },
      ...(cashRefunded > 0
        ? [{ id: `lt-${Date.now()}-r`, type: 'REFUND' as const, date: today(), amount: cashRefunded, narration: 'رد فائض نقدي للصندوق', createdBy: currentUserName, createdAt: nowStamp() }]
        : []),
    ];
    onUpdateCustody(settleTarget.id, {
      settledAmount: Math.round((settleTarget.settledAmount + Math.min(expenseTotal, remaining)) * 100) / 100,
      refundedAmount: Math.round((settleTarget.refundedAmount + cashRefunded) * 100) / 100,
      shortageAmount: settleTarget.shortageAmount,
      apTransferredAmount: Math.round((settleTarget.apTransferredAmount + excess) * 100) / 100,
      status: nextStatus,
      actualClearanceDate: nextStatus === 'FULL_SETTLED' ? today() : undefined,
      settlements: [...settleTarget.settlements, settlement],
      transactions: [...settleTarget.transactions, ...txns],
      updatedAt: nowStamp(),
    });
    toast('success', `تمت تصفية ${settleTarget.custodyNumber} (${fmtC(expenseTotal, settleTarget.currency || baseCurrency)}) وترحيل القيد ${journal.entryNumber}. الحالة: ${CUSTODY_STATUS_LABEL[nextStatus]}`);
    setSettleTarget(null);
  };

  const openRefund = (c: Custody) => {
    openModal(() => {
      setRefundTarget(c);
      setRefundAmount(Math.max(0, outstandingBalance(c)));
      setRefundSource('');
    });
  };

  const handleRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    const amount = Number(refundAmount) || 0;
    const source = sourceEntities.find(s => s.id === refundSource);
    if (!source) {
      toast('error', 'يرجى اختيار حساب استلام الرد (صندوق / بنك).');
      return;
    }
    const max = outstandingBalance(refundTarget);
    if (amount <= 0) {
      toast('error', 'يرجى إدخال مبلغ الرد.');
      return;
    }
    if (amount > max) {
      toast('error', `مبلغ الرد يتجاوز الرصيد القائم (${fmtC(max, refundTarget.currency || baseCurrency)}).`);
      return;
    }
    const advanceAcc = advanceAccountOf(refundTarget);
    const ctx: JournalBuildContext = {
      journalId: `je-${Date.now()}`,
      entryNumber: nextJournalNumber(journals),
      currency: refundTarget.currency || 'YER',
      exchangeRate: refundTarget.exchangeRate || 1,
      isForeignCurrency: (refundTarget.currency || baseCurrency) !== baseCurrency,
      createdBy: currentUserName,
      reference: `CUSTODY-${refundTarget.custodyNumber}`,
    };
    const journal = buildRefundJournal(ctx, refundTarget, amount, advanceAcc, source.account);
    if (!onAddJournal(journal)) {
      toast('error', 'تعذر ترحيل قيد رد العهدة؛ لم تُعدّل العهدة.');
      return;
    }
    const txn: CustodyTransaction = {
      id: `lt-${Date.now()}`,
      type: 'REFUND',
      date: today(),
      amount,
      journalEntryId: journal.id,
      narration: `رد نقدية إلى ${source.account.nameAr}`,
      createdBy: currentUserName,
      createdAt: nowStamp(),
    };
    const newRefunded = refundTarget.refundedAmount + amount;
    const stillOpen = Math.round((refundTarget.disbursedAmount - refundTarget.settledAmount - newRefunded - refundTarget.apTransferredAmount) * 100) / 100;
    const nextStatus: CustodyStatus = stillOpen <= 0.01 ? (refundTarget.status === 'DISBURSED' || refundTarget.status === 'PARTIAL_SETTLED' ? 'FULL_SETTLED' : refundTarget.status) : 'PARTIAL_SETTLED';
    onUpdateCustody(refundTarget.id, {
      refundedAmount: newRefunded,
      status: nextStatus,
      actualClearanceDate: nextStatus === 'FULL_SETTLED' ? today() : refundTarget.actualClearanceDate,
      transactions: [...refundTarget.transactions, txn],
      updatedAt: nowStamp(),
    });
    toast('success', `تم رد ${fmtC(amount, refundTarget.currency || baseCurrency)} من ${refundTarget.custodyNumber} وترحيل القيد ${journal.entryNumber}.`);
    setRefundTarget(null);
  };

  const openReplenish = (c: Custody) => {
    openModal(() => {
      setReplenishTarget(c);
      setReplenishItems([]);
      setReplenishSource('');
      setReplenishVatAccountId('');
    });
  };

  const handleReplenish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishTarget) return;
    if (replenishItems.length === 0) {
      toast('error', 'أضف بنود الاستعاضة أولاً.');
      return;
    }
    const source = sourceEntities.find(s => s.id === replenishSource);
    if (!source) {
      toast('error', 'يرجى اختيار مصدر التمويل (صندوق / بنك بحساب مرتبط).');
      return;
    }
    const invalid = replenishItems.find(it => !it.accountId || !it.description.trim() || it.total <= 0);
    if (invalid) {
      toast('error', 'أكمل بنود الاستعاضة: حساب مصروف، وصف، وقيمة أكبر من صفر.');
      return;
    }
    const vatAcc = replenishVatAccountId ? accounts.find(a => a.id === replenishVatAccountId) : undefined;
    if (replenishItems.some(it => it.taxAmount > 0) && !vatAcc) {
      toast('error', 'توجد بنود بضريبة قيمة مضافة دون تحديد حساب الضريبة.');
      return;
    }
    const total = itemsTotal(replenishItems);
    const cap = (replenishTarget.maxBalance ?? replenishTarget.amount) - replenishTarget.disbursedAmount;
    if (cap > 0 && total > cap) {
      toast('error', `قيمة الاستعاضة (${fmtC(total, replenishTarget.currency || baseCurrency)}) تتجاوز المساحة المتاحة حتى السقف المالي (${fmtC(cap, replenishTarget.currency || baseCurrency)}).`);
      return;
    }
    const ctx: JournalBuildContext = {
      journalId: `je-${Date.now()}`,
      entryNumber: nextJournalNumber(journals),
      currency: replenishTarget.currency || 'YER',
      exchangeRate: replenishTarget.exchangeRate || 1,
      isForeignCurrency: (replenishTarget.currency || baseCurrency) !== baseCurrency,
      createdBy: currentUserName,
      reference: `CUSTODY-${replenishTarget.custodyNumber}`,
    };
    const journal = buildReplenishmentJournal(ctx, replenishTarget, replenishItems, source.account, vatAcc ?? null);
    if (!onAddJournal(journal)) {
      toast('error', 'تعذر ترحيل قيد استعاضة العهدة؛ لم تُعدّل العهدة.');
      return;
    }
    const txn: CustodyTransaction = {
      id: `lt-${Date.now()}`,
      type: 'REPLENISH',
      date: today(),
      amount: total,
      journalEntryId: journal.id,
      narration: `استعاضة من ${source.account.nameAr}`,
      createdBy: currentUserName,
      createdAt: nowStamp(),
    };
    onUpdateCustody(replenishTarget.id, {
      replenishedAmount: Math.round((replenishTarget.replenishedAmount + total) * 100) / 100,
      transactions: [...replenishTarget.transactions, txn],
      updatedAt: nowStamp(),
    });
    toast('success', `تمت استعاضة ${replenishTarget.custodyNumber} بقيمة ${fmtC(total, replenishTarget.currency || baseCurrency)} (لا تؤثر على رصيد العهدة الأساسي).`);
    setReplenishTarget(null);
  };

  const handleClose = () => {
    if (!closeTarget) return;
    onUpdateCustody(closeTarget.id, { status: 'CLOSED', actualClearanceDate: closeTarget.actualClearanceDate ?? today(), updatedAt: nowStamp() });
    toast('success', `تم إقفال ${closeTarget.custodyNumber}.`);
    setCloseTarget(null);
  };

  const handleVoid = () => {
    if (!voidTarget) return;
    if (voidTarget.disbursedAmount > 0 && outstandingBalance(voidTarget) > 0) {
      toast('error', `لا يمكن إلغاء ${voidTarget.custodyNumber} — يوجد رصيد قائم ${fmtC(outstandingBalance(voidTarget), voidTarget.currency || baseCurrency)}. صفّه أو ردّه أولاً.`);
      setVoidTarget(null);
      return;
    }
    onUpdateCustody(voidTarget.id, { status: 'VOIDED', updatedAt: nowStamp() });
    toast('info', `تم إلغاء ${voidTarget.custodyNumber}.`);
    setVoidTarget(null);
  };

  const SourceSelect = ({ value, onChange, excludeId }: { value: string; onChange: (v: string) => void; excludeId?: string }) => (
    <div>
      <label className={FORM_LABEL}>مصدر التمويل / الاستلام *</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30">
        <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">— اختر صندوقاً أو بنكاً أو شركة صرافة —</option>
        {sourceEntities.filter(s => !excludeId || s.id !== excludeId).map(s => (
          <option key={s.id} value={s.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{s.label} ({s.account.code})</option>
        ))}
      </select>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">الصناديق والبنوك غير المرتبطة بحساب محاسبي لا تظهر.</p>
    </div>
  );

  const ItemEditor = ({ items, setItems, vatAccountId, setVatAccountId, showVat, currency }: {
    items: CustodySettlementItem[];
    setItems: (items: CustodySettlementItem[]) => void;
    vatAccountId: string;
    setVatAccountId: (v: string) => void;
    showVat: boolean;
    currency: string;
  }) => {
    const updateItem = (idx: number, patch: Partial<CustodySettlementItem>) => {
      setItems(items.map((it, i) => (i === idx ? recomputeItem({ ...it, ...patch }) : it)));
    };
    const vendorName = (id: string) => vendors.find(v => v.id === id)?.nameAr ?? '';
    const addItem = () => setItems([...items, newItem()]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <ScrollText className="w-3.5 h-3.5 text-sky-600" />
            بنود المستندات
          </p>
          <button type="button" data-enter-nav="add-line" onClick={addItem} className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> بند
          </button>
        </div>
        {items.length === 0 && (
          <div className="rounded-xl p-3 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
            لا بنود بعد — أضف بنود المصروفات / الأصول مع الفواتير والضريبة.
          </div>
        )}
        {items.map((it, idx) => {
          const vatAcc = vatAccountId ? accounts.find(a => a.id === vatAccountId) : undefined;
          return (
            <div key={it.id} data-enter-row="" className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">البند {idx + 1}</span>
                <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-600 hover:bg-red-100 rounded cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={FORM_LABEL}>حساب المصروف / الأصل *</label>
                  <select value={it.accountId} onChange={e => {
                    const acc = accounts.find(a => a.id === e.target.value);
                    updateItem(idx, acc ? { accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr } : { accountId: '' });
                  }} className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30">
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">— اختر —</option>
                    {postingAccounts.map(a => <option key={a.id} value={a.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{a.code} - {a.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className={FORM_LABEL}>المورد</label>
                  <input type="text" list="custody-vendor-options" value={vendorName(it.vendorId ?? '')} onChange={e => {
                    const v = vendors.find(x => x.nameAr === e.target.value);
                    updateItem(idx, v ? { vendorId: v.id, vendorName: v.nameAr, vendorVatNumber: v.vatNumber } : { vendorId: undefined, vendorName: undefined });
                  }} className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30" />
                </div>
              </div>
              <div>
                <label className={FORM_LABEL}>الوصف *</label>
                <input type="text" value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={FORM_LABEL}>القيمة ({currency}) *</label>
                  <AmountInput value={it.amount} onChange={v => updateItem(idx, { amount: Number(v) })} className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30" />
                </div>
                <div>
                  <label className={FORM_LABEL}>الضريبة %</label>
                  <div className="relative">
                    <AmountInput value={it.taxRate} onChange={v => updateItem(idx, { taxRate: Number(v) / 100 })} className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 pl-7" />
                    <Percent className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={it.vatInclusive} onChange={e => updateItem(idx, { vatInclusive: e.target.checked })} className="accent-sky-500" />
                    شامل الضريبة
                  </label>
                </div>
              </div>
              {it.taxAmount > 0 && (
                <div className="rounded-lg p-2 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">ضريبة: <span className="font-mono text-emerald-600">{fmtC(it.taxAmount, currency)}</span></span>
                  <span className="text-slate-500 dark:text-slate-400">الإجمالي: <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(it.total, currency)}</span></span>
                  {showVat && !vatAcc && <span className="text-amber-400 font-bold">حدد حساب الضريبة</span>}
                  {showVat && vatAcc && <span className="text-emerald-600 font-bold">→ {vatAcc.code}</span>}
                </div>
              )}
            </div>
          );
        })}
        {items.length > 0 && (
          <div className="rounded-xl p-3 border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">إجمالي المستندات (شامل الضريبة):</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(itemsTotal(items), currency)}</span>
          </div>
        )}
        {showVat && (
          <div>
            <label className={FORM_LABEL}>حساب ضريبة القيمة المضافة (VAT)</label>
            <select value={vatAccountId} onChange={e => setVatAccountId(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30">
              <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">— بدون تفكيك ضريبة —</option>
              {postingAccounts.filter(a => /ضريبة|vat/i.test(a.nameAr + a.nameEn)).map(a => <option key={a.id} value={a.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{a.code} - {a.nameAr}</option>)}
            </select>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">عند اختياره تُفصل الضريبة في حساب مستقل (صافي + ضريبة).</p>
          </div>
        )}
        <datalist id="custody-vendor-options">
          {vendors.map(v => <option key={v.id} value={v.nameAr} />)}
        </datalist>
      </div>
    );
  };

  return (
    <div data-enter-scope="" className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Vault className="w-6 h-6" />}
        title="العُهد المالية والعينية"
        subtitle="دورة حياة متكاملة: إصدار → اعتماد وصرف آلي → تصفية بالمستندات → رد → إقفال — مع قيود محاسبية آلية وفق IFRS"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            عهدة جديدة
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="إجمالي المصروف (مفتوحة)" value={fmtC(totalOpenValue, baseCurrency)} hint={`${openList.length} عهدة مفتوحة`} icon={Wallet} iconClass="bg-amber-500/20 text-amber-400" />
        <StatCard label="الرصيد القائم" value={fmtC(totalOutstanding, baseCurrency)} hint="ما يجب تصفيته أو رده" icon={ArrowRightLeft} iconClass="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" />
        <StatCard label="مصفى + مرتجع" value={fmtC(totalSettledRefunded, baseCurrency)} hint="إجمالي المستندات والردود والفوائض" icon={CheckCircle2} iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard label="استعاضات المستديمة" value={fmtC(totalReplenished, baseCurrency)} hint="مصاريف نثرية دون مساس برصيد العهدة" icon={RefreshCw} iconClass="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400" />
        <StatCard label="العهد المتأخرة" value={`${overdueList.length}`} hint={overdueList.length > 0 ? `أقدمها تأخر ${overdueDays(overdueList[0])} يوم` : 'لا توجد متأخرات'} icon={Timer} iconClass="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(Object.keys(CUSTODY_META) as CustodyType[]).map(type => {
          const meta = CUSTODY_META[type];
          const Icon = meta.icon;
          const list = activeCustodies.filter(c => c.type === type);
          const total = list.reduce((s, c) => s + c.amount, 0);
          const open = list.filter(c => OPEN_STATUSES.includes(c.status)).length;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
              className={`text-right rounded-2xl p-4 border transition-all cursor-pointer bg-white dark:bg-slate-900 shadow-sm ${typeFilter === type ? 'border-sky-500 dark:border-sky-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl border ${meta.chip}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{list.length} عهدة</span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{meta.label}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">{fmtC(total, baseCurrency)} <span className="text-slate-500 dark:text-slate-400">• {open} مفتوحة</span></p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-bold">
          <Filter className="w-4 h-4" />
          تصفية:
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setStatusFilter('ALL')} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}>الكل</button>
          {(Object.keys(CUSTODY_STATUS_META) as CustodyStatus[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}>{CUSTODY_STATUS_META[s].label}</button>
          ))}
          <button onClick={() => setOverdueOnly(v => !v)} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${overdueOnly ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}>متأخرة فقط</button>
        </div>
        <div className="relative xl:flex-1 xl:min-w-[260px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
          <F9SearchInput
            value={search}
            onChange={setSearch}

            className="w-full pr-9 pl-9 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            items={filtered}
            columns={[
              { label: 'رقم العهدة', render: c => <span className="font-mono font-bold text-sky-600">{c.custodyNumber}</span> },
              { label: 'الموظف', render: c => <span className="font-semibold text-slate-900 dark:text-white">{c.employeeName}</span> },
              { label: 'الغرض', render: c => <span className="text-slate-600 dark:text-slate-400">{c.title}</span> },
              { label: 'الرصيد القائم', render: c => <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(outstandingBalance(c), c.currency || baseCurrency)}</span> },
            ]}
            searchText={c => [c.custodyNumber, c.employeeName, c.title, c.status, c.type, c.referenceNumber || ''].join(' ')}
            browseTitle="استعراض العهد"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            سجل العُهد
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">النشطة: {activeCustodies.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{filtered.length} سجل</span>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar" dir="rtl">
          <table className="w-full min-w-[1540px] table-fixed text-right text-xs" dir="rtl">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200">
              <tr>
                <th className="w-32 whitespace-nowrap px-4 py-3">رقم العهدة</th>
                <th className="w-36 whitespace-nowrap px-4 py-3">النوع</th>
                <th className="w-40 whitespace-nowrap px-4 py-3">الموظف</th>
                <th className="w-56 whitespace-nowrap px-4 py-3">الغرض</th>
                <th className="w-40 whitespace-nowrap px-4 py-3">المبلغ</th>
                <th className="w-40 whitespace-nowrap px-4 py-3">الرصيد القائم</th>
                <th className="w-44 whitespace-nowrap px-4 py-3">الانقضاء</th>
                <th className="w-48 whitespace-nowrap px-4 py-3">الحالة</th>
                <th className="w-36 whitespace-nowrap px-4 py-3">تاريخ الطلب</th>
                <th className="w-32 whitespace-nowrap px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6">
                    <EmptyState
                      title="لا توجد عهد"
                      description={search.trim() || statusFilter !== 'ALL' || typeFilter !== 'ALL' || overdueOnly ? 'لا توجد نتائج مطابقة لمعايير البحث والتصفية.' : 'ابدأ بإصدار أول عهدة عبر زر (عهدة جديدة).'}
                      compact
                      icon={<Vault className="w-5 h-5" />}
                    />
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const balance = outstandingBalance(c);
                const overdue = isOverdue(c);
                const meta = CUSTODY_META[c.type];
                const Icon = meta.icon;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="whitespace-nowrap overflow-hidden px-4 py-3 font-mono font-bold text-sky-600">{c.custodyNumber}</td>
                    <td className="whitespace-nowrap overflow-hidden px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-xs font-bold ${meta.chip}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {meta.short}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-3 font-semibold text-slate-900 dark:text-white" title={c.employeeName}><div className="truncate whitespace-nowrap">{c.employeeName}</div></td>
                    <td className="overflow-hidden px-4 py-3 text-slate-600 dark:text-slate-400" title={c.title}><div className="truncate whitespace-nowrap">{c.title}</div></td>
                    <td className="whitespace-nowrap overflow-hidden px-4 py-3 font-mono text-slate-900 dark:text-white" dir="ltr">{fmtC(c.amount, c.currency || baseCurrency)}</td>
                    <td className={`whitespace-nowrap overflow-hidden px-4 py-3 font-mono font-bold ${balance > 0 ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`} dir="ltr">{fmtC(balance, c.currency || baseCurrency)}</td>
                    <td className="whitespace-nowrap overflow-hidden px-4 py-3 text-slate-500 dark:text-slate-400">
                      {c.expectedClearanceDate ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(c.expectedClearanceDate)}
                          {overdue && <span className="text-red-600 font-bold">({overdueDays(c)}ي)</span>}
                        </span>
                      ) : <span className="text-slate-600 dark:text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap overflow-hidden px-4 py-3"><StatusChip status={c.status} overdue={overdue} /></td>
                    <td className="whitespace-nowrap overflow-hidden px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(c.requestedDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={e => openRowMenu(e, c)}
                        title="قائمة الإجراءات"
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${rowMenu?.c.id === c.id ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (() => {
        const selectedSource = [...cashSourceEntities, ...bankSourceEntities, ...exchangeSourceEntities].find(s => s.id === createForm.disbursementSource);
        const selectedEmployee = employees.find(e => e.id === createForm.employeeId);
        const createReady = Boolean(selectedEmployee && selectedSource && (Number(createForm.amount) || 0) > 0);
        return (
          <ModalShell
            id="custody-create"
            open={!!isCreateOpen}
            title="عهدة جديدة"
            icon={Plus}
            onClose={() => setIsCreateOpen(false)}
            footer={null}
            closeOnBackdrop={false}
            size="lg"
          >
            <form onSubmit={e => { e.preventDefault(); persistCustody(false); }} className="space-y-5">
              {createError && (
                <div className="rounded-xl p-3 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              <CustodyFormFields form={createForm} setForm={setCreateForm} locked={false} baseCode={baseCode} employees={employees} costCenters={costCenters} cashBoxes={cashBoxes} bankAccounts={bankAccounts} cashSourceEntities={cashSourceEntities} bankSourceEntities={bankSourceEntities} exchangeSourceEntities={exchangeSourceEntities} createCurrencyOptions={createCurrencyOptions} rateGuard={rateGuard} changeCurrency={changeCurrency} />
              <AttachmentPicker documents={attachments} onChange={setAttachments} uploadedBy={currentUserName} documentType="CUSTODY_SUPPORT" />

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-3">
                <div className="flex-1 text-sm text-slate-500 dark:text-slate-400">
                  {!createReady ? 'أكمل الموظف المكلف والمبلغ لتفعيل الحفظ.' : 'العهدة تُحفظ كجديدة — يمكن اعتمادها وصرفها آلياً من قائمة إجراءات العهدة.'}
                </div>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
                <button type="submit" disabled={!createReady} className="flex items-center gap-1.5 px-5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" />
                  حفظ
                </button>
              </div>
            </form>
          </ModalShell>
        );
      })()}

      {isEditOpen && editTarget && (() => {
        const locked = editTarget.disbursedAmount > 0;
        const selectedSource = [...cashSourceEntities, ...bankSourceEntities, ...exchangeSourceEntities].find(s => s.id === editForm.disbursementSource);
        const selectedEmployee = employees.find(e => e.id === editForm.employeeId);
        const editReady = locked ? true : Boolean(selectedEmployee && selectedSource && (Number(editForm.amount) || 0) > 0);
        return (
          <ModalShell
            id="custody-edit"
            open={!!(isEditOpen && editTarget)}
            title={`تعديل العهدة ${editTarget.custodyNumber}`}
            icon={Pencil}
            onClose={() => { setIsEditOpen(false); setEditTarget(null); }}
            footer={null}
            closeOnBackdrop={false}
            size="lg"
          >
            <form onSubmit={handleEdit} className="space-y-5">
              {editError && (
                <div className="rounded-xl p-3 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
              <CustodyFormFields form={editForm} setForm={setEditForm} locked={locked} baseCode={baseCode} employees={employees} costCenters={costCenters} cashBoxes={cashBoxes} bankAccounts={bankAccounts} cashSourceEntities={cashSourceEntities} bankSourceEntities={bankSourceEntities} exchangeSourceEntities={exchangeSourceEntities} createCurrencyOptions={createCurrencyOptions} rateGuard={rateGuard} changeCurrency={changeCurrency} />

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-3">
                <div className="flex-1 text-sm text-slate-500 dark:text-slate-400">
                  {locked ? 'تعديل بيانات وصفية فقط — الحقول المالية للعهدة المصروفة محمية.' : 'تحقق من البيانات — عند تغيير المبلغ أو الموظف تُعاد العهدة للاعتماد بتسلسل جديد.'}
                </div>
                <button type="button" onClick={() => { setIsEditOpen(false); setEditTarget(null); }} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
                <button type="submit" disabled={!editReady} className="flex items-center gap-1.5 px-5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" />
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </ModalShell>
        );
      })()}

      {approveTarget && (() => {
        const reqLevel = requiredApprovalLevel(approveTarget.amount, employeeOf(approveTarget));
        return (
          <ModalShell id="custody-approve" open={!!approveTarget} title={`الاعتماد — ${approveTarget.custodyNumber}`} icon={ShieldCheck} onClose={() => setApproveTarget(null)} footer={null} closeOnBackdrop={false}>
            <div className="space-y-4">
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الموظف:</span><span className="font-semibold text-slate-900 dark:text-white">{approveTarget.employeeName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">المبلغ:</span><span className="font-mono text-slate-900 dark:text-white">{fmtC(approveTarget.amount, approveTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الاعتماد المطلوب:</span><span className="font-mono font-bold text-sky-600">{reqLevel} مستوى</span></div>
              </div>
              <div className="space-y-2">
                {APPROVAL_LEVEL_ROLES.slice(0, reqLevel).map((lvl) => {
                  const a = approveTarget.status === 'PENDING_APPROVAL' ? undefined : approveTarget.approvals.find(x => x.level === lvl.level);
                  const isNext = canApprove(approveTarget, lvl.level);
                  return (
                    <div key={lvl.level} className={`rounded-xl p-3 border flex items-center justify-between ${isNext ? 'border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${a?.action === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : a?.action === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700 dark:text-slate-300'}`}>{lvl.level}</div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{lvl.roleName}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{a?.action === 'APPROVED' ? `اعتمد — ${a.actionAt}` : a?.action === 'REJECTED' ? `رُفض — ${a.actionAt}` : 'بانتظار الاعتماد'}</p>
                        </div>
                      </div>
                      {isNext && (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleApprove(lvl.level, 'APPROVED')} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد
                          </button>
                          <button type="button" onClick={() => handleApprove(lvl.level, 'REJECTED')} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-700 cursor-pointer flex items-center gap-1">
                            <ThumbsDown className="w-3.5 h-3.5" /> رفض
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button type="button" onClick={() => setApproveTarget(null)} className="px-5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">إغلاق</button>
              </div>
            </div>
          </ModalShell>
        );
      })()}

      {disburseTarget && (() => {
        const advanceAcc = advanceAccountOf(disburseTarget);
        return (
          <ModalShell id="custody-disburse" open={!!disburseTarget} title={`${disburseTarget.status === 'CREATED' ? 'اعتماد وصرف آلي' : 'صرف'} العهدة ${disburseTarget.custodyNumber}`} icon={Banknote} onClose={() => setDisburseTarget(null)} footer={null} closeOnBackdrop={false}>
            <form onSubmit={handleDisburse} className="space-y-4">
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الموظف:</span><span className="font-semibold text-slate-900 dark:text-white">{disburseTarget.employeeName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">قيمة الصرف:</span><span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(disburseTarget.amount, disburseTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">حساب عُهد الموظفين (مدين):</span><span className="font-mono text-sky-600">{advanceAcc.code} - {advanceAcc.nameAr}</span></div>
              </div>
              <SourceSelect value={disburseSource} onChange={setDisburseSource} />
              <div className="rounded-xl p-3 border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sm text-slate-500 dark:text-slate-400">
                القيد الآلي: من <span className="font-bold text-sky-700">حـ/ {advanceAcc.nameAr}</span> إلى <span className="font-bold text-emerald-600">حـ/ المصدر</span> — مدين/دائن {fmtC(disburseTarget.amount, disburseTarget.currency || baseCurrency)}.
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" onClick={() => setDisburseTarget(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer dark:bg-sky-950/60 dark:hover:bg-sky-900 dark:text-sky-400">{disburseTarget.status === 'CREATED' ? 'اعتماد وصرف آلي وترحيل القيد' : 'صرف وترحيل القيد'}</button>
              </div>
            </form>
          </ModalShell>
        );
      })()}

      {settleTarget && (() => {
        const remaining = outstandingBalance(settleTarget);
        const expenseTotal = itemsTotal(settleItems);
        const excess = Math.max(0, expenseTotal - remaining);
        const autoRefund = Math.max(0, remaining - expenseTotal);
        return (
          <ModalShell id="custody-settle" open={!!settleTarget} title={`تصفية ${settleTarget.custodyNumber} بالمستندات`} icon={FileSignature} onClose={() => setSettleTarget(null)} footer={null} closeOnBackdrop={false}>
            <form onSubmit={handleSettle} className="space-y-4">
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الموظف:</span><span className="font-semibold text-slate-900 dark:text-white">{settleTarget.employeeName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">المصروف:</span><span className="font-mono text-slate-900 dark:text-white">{fmtC(settleTarget.disbursedAmount, settleTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">المصفى سابقاً:</span><span className="font-mono text-emerald-600">{fmtC(settleTarget.settledAmount + settleTarget.apTransferredAmount, settleTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الرصيد القائم:</span><span className="font-mono font-bold text-red-600">{fmtC(remaining, settleTarget.currency || baseCurrency)}</span></div>
              </div>

              <ItemEditor items={settleItems} setItems={setSettleItems} vatAccountId={vatAccountId} setVatAccountId={setVatAccountId} showVat currency={settleTarget.currency || baseCurrency} />
              <AttachmentPicker documents={settlementAttachments} onChange={setSettlementAttachments} uploadedBy={currentUserName} documentType="CUSTODY_SETTLEMENT_SUPPORT" />

              {expenseTotal > 0 && (
                <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
                  {excess > 0 ? (
                    <div className="flex justify-between text-amber-600"><span className="text-slate-500 dark:text-slate-400">تجاوز عن الرصيد (مستحق للموظف → AP):</span><span className="font-mono font-bold">{fmtC(excess, settleTarget.currency || baseCurrency)}</span></div>
                  ) : (
                    <div className="flex justify-between text-emerald-600"><span className="text-slate-500 dark:text-slate-400">فائض يُرد للصندوق:</span><span className="font-mono font-bold">{fmtC(autoRefund, settleTarget.currency || baseCurrency)}</span></div>
                  )}
                </div>
              )}

              {excess > 0 && (
                <div>
                  <label className={FORM_LABEL}>حساب الدائنين (مستحق للموظف) *</label>
                  <select value={apAccountId} onChange={e => setApAccountId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30">
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">— اختر حساب دائن —</option>
                    {payableAccounts.map(a => <option key={a.id} value={a.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{a.code} - {a.nameAr}</option>)}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" onClick={() => setSettleTarget(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">تصفية وترحيل القيد</button>
              </div>
            </form>
          </ModalShell>
        );
      })()}

      {refundTarget && (
        <ModalShell id="custody-refund" open={!!refundTarget} title={`رد نقدية — ${refundTarget.custodyNumber}`} icon={Undo2} onClose={() => setRefundTarget(null)} footer={null} closeOnBackdrop={false}>
          <form onSubmit={handleRefund} className="space-y-4">
            <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الموظف:</span><span className="font-semibold text-slate-900 dark:text-white">{refundTarget.employeeName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الرصيد القائم (أقصى رد):</span><span className="font-mono font-bold text-red-600">{fmtC(outstandingBalance(refundTarget), refundTarget.currency || baseCurrency)}</span></div>
            </div>
            <div>
              <label className={FORM_LABEL}>مبلغ الرد ({refundTarget.currency || baseCurrency}) *</label>
              <AmountInput required value={refundAmount} onChange={v => setRefundAmount(Number(v))} className={FORM_INPUT} />
            </div>
            <SourceSelect value={refundSource} onChange={setRefundSource} excludeId={refundTarget.id} />
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button type="button" onClick={() => setRefundTarget(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
              <button type="submit" className="px-5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">تأكيد الرد وترحيل القيد</button>
            </div>
          </form>
        </ModalShell>
      )}

      {replenishTarget && (() => {
        const cap = (replenishTarget.maxBalance ?? replenishTarget.amount) - replenishTarget.disbursedAmount;
        const total = itemsTotal(replenishItems);
        return (
          <ModalShell id="custody-replenish" open={!!replenishTarget} title={`استعاضة المستديمة ${replenishTarget.custodyNumber}`} icon={RefreshCw} onClose={() => setReplenishTarget(null)} footer={null} closeOnBackdrop={false}>
            <form onSubmit={handleReplenish} className="space-y-4">
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">السقف المالي:</span><span className="font-mono text-slate-900 dark:text-white">{fmtC(replenishTarget.maxBalance ?? replenishTarget.amount, replenishTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">المصروف حتى الآن:</span><span className="font-mono text-slate-600">{fmtC(replenishTarget.disbursedAmount, replenishTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">المساحة المتاحة حتى السقف:</span><span className={`font-mono font-bold ${cap > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtC(Math.max(0, cap), replenishTarget.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">استعاضات سابقة:</span><span className="font-mono text-sky-600">{fmtC(replenishTarget.replenishedAmount, replenishTarget.currency || baseCurrency)}</span></div>
              </div>
              <ItemEditor items={replenishItems} setItems={setReplenishItems} vatAccountId={replenishVatAccountId} setVatAccountId={setReplenishVatAccountId} showVat currency={replenishTarget.currency || baseCurrency} />
              <SourceSelect value={replenishSource} onChange={setReplenishSource} />
              {total > 0 && (
                <div className="rounded-xl p-3 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">إجمالي الاستعاضة:</span>
                  <span className={`font-mono font-bold ${cap > 0 && total > cap ? 'text-red-600' : 'text-emerald-600'}`}>{fmtC(total, replenishTarget.currency || baseCurrency)}</span>
                </div>
              )}
              <div className="rounded-xl p-3 border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sm text-slate-500 dark:text-slate-400">
                الاستعاضة لا تُحصّل من رصيد العهدة الأساسي — تبقى العهدة كاملة المبلغ.
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" onClick={() => setReplenishTarget(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">تنفيذ الاستعاضة</button>
              </div>
            </form>
          </ModalShell>
        );
      })()}

      {closeTarget && (
        <ModalShell id="custody-close" open={!!closeTarget} title={`إقفال ${closeTarget.custodyNumber}`} icon={Lock} onClose={() => setCloseTarget(null)} footer={null} closeOnBackdrop={false}>
          <div className="space-y-4">
            <div className="rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-700 space-y-1.5">
              <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4" /> العهدة مصفاة كلياً</p>
              <p className="text-xs text-emerald-200/80">المصروف {fmtC(closeTarget.disbursedAmount, closeTarget.currency || baseCurrency)} / المصفى والمرتجع {fmtC(closeTarget.settledAmount + closeTarget.refundedAmount + closeTarget.apTransferredAmount, closeTarget.currency || baseCurrency)}. إقفالها يُنهي دورة حياتها.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setCloseTarget(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">تراجع</button>
              <button type="button" onClick={handleClose} className="px-5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">إقفال العهدة</button>
            </div>
          </div>
        </ModalShell>
      )}

      {voidTarget && (
        <ModalShell id="custody-void" open={!!voidTarget} title={`تأكيد إلغاء ${voidTarget.custodyNumber}`} icon={Ban} onClose={() => setVoidTarget(null)} footer={null} closeOnBackdrop={false} className="border-red-500/30">
          <div className="space-y-4">
            <div className="rounded-xl p-4 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 space-y-2">
              <div className="flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4 flex-shrink-0" /> إلغاء العهدة</div>
              <p className="text-xs text-red-200/80">
                هل أنت متأكد من إلغاء العهدة <span className="font-mono font-bold">{voidTarget.custodyNumber}</span>؟
                {voidTarget.disbursedAmount > 0 && outstandingBalance(voidTarget) > 0 && <span className="block mt-1 text-red-600">تنبيه: يوجد رصيد قائم {fmtC(outstandingBalance(voidTarget), voidTarget.currency || baseCurrency)} — لن يُسمح بالإلغاء قبل تصفيته.</span>}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setVoidTarget(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">تراجع</button>
              <button type="button" onClick={handleVoid} className="px-5 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">تأكيد الإلغاء</button>
            </div>
          </div>
        </ModalShell>
      )}

      {detailsTarget && (() => {
        const c = detailsTarget;
        const balance = outstandingBalance(c);
        const reqLevel = requiredApprovalLevel(c.amount, employeeOf(c));
        return (
          <ModalShell id="custody-details" open={!!detailsTarget} title={`تفاصيل ${c.custodyNumber}`} icon={Eye} onClose={() => setDetailsTarget(null)} footer={null} closeOnBackdrop={false}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <TypeChip type={c.type} />
                <StatusChip status={c.status} overdue={isOverdue(c)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailField label="الموظف المكلف" value={c.employeeName} />
                <DetailField label="رقم المرجع" value={c.referenceNumber || '—'} />
                <DetailField label="تاريخ الطلب" value={c.requestedDate} />
                <DetailField label="تاريخ الانقضاء" value={c.expectedClearanceDate || '—'} />
                <DetailField label="مركز التكلفة" value={c.costCenterId ? (costCenters.find(x => x.id === c.costCenterId)?.nameAr ?? c.costCenterId) : '—'} />
                <DetailField label="المنشئ" value={c.createdBy || '—'} />
                <DetailField label="المستويات المطلوبة للاعتماد" value={`${reqLevel}`} />
              </div>

              {c.assetDescription && (
                <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">وصف العين المسندة</p>
                  {c.assetDescription}
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  الأطراف المستفيدة من الصرف ({c.disbursementParties?.length || 0})
                </p>
                {c.disbursementParties?.length ? (
                  <div className="space-y-1.5">
                    {c.disbursementParties.map((party, index) => (
                      <div key={party.id} className="rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0"><span className="font-bold text-slate-900 dark:text-white">{index + 1}. {party.name}</span>{party.narration && <span className="block mt-0.5 text-slate-500 dark:text-slate-400 truncate">{party.narration}</span>}</div>
                        <div className="shrink-0 text-left"><span className="font-mono font-bold text-sky-700">{fmtC(party.amount, c.currency || baseCurrency)}</span>{party.referenceNumber && <span className="block text-slate-500 dark:text-slate-400">مرجع: {party.referenceNumber}</span>}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="rounded-xl p-3 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">لم تسجل أطراف مستفيدة لهذه العهدة.</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailField label="قيمة العهدة" value={<span className="font-mono">{fmtC(c.amount, c.currency || baseCurrency)}</span>} />
                <DetailField label="المصروف" value={<span className="font-mono text-slate-900 dark:text-white">{fmtC(c.disbursedAmount, c.currency || baseCurrency)}</span>} />
                <DetailField label="المصفى بالمستندات" value={<span className="font-mono text-emerald-600">{fmtC(c.settledAmount, c.currency || baseCurrency)}</span>} />
                <DetailField label="المحوَّل للدائنين (AP)" value={<span className="font-mono text-amber-400">{fmtC(c.apTransferredAmount, c.currency || baseCurrency)}</span>} />
                <DetailField label="النقدية المعادة" value={<span className="font-mono text-sky-600">{fmtC(c.refundedAmount, c.currency || baseCurrency)}</span>} />
                <DetailField label="الرصيد القائم" value={<span className={`font-mono ${balance > 0 ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>{fmtC(balance, c.currency || baseCurrency)}</span>} />
                {c.type === 'PETTY_CASH' && <DetailField label="استعاضات" value={<span className="font-mono text-sky-600">{fmtC(c.replenishedAmount, c.currency || baseCurrency)}</span>} />}
                {c.type === 'PETTY_CASH' && <DetailField label="السقف المالي" value={<span className="font-mono">{fmtC(c.maxBalance ?? c.amount, c.currency || baseCurrency)}</span>} />}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  سلسلة الاعتمادات ({c.approvals.length}/{reqLevel})
                </p>
                {c.approvals.length === 0 ? (
                  <div className="rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">لم تُرسل للاعتماد بعد.</div>
                ) : (
                  <div className="space-y-1.5">
                    {c.approvals.map(a => (
                      <div key={a.id} className="rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">المستوى {a.level}: {a.approverName}</span>
                        <span className={`font-bold ${a.action === 'APPROVED' ? 'text-emerald-600' : a.action === 'REJECTED' ? 'text-red-600' : 'text-amber-400'}`}>
                          {a.action === 'APPROVED' ? 'معتمد' : a.action === 'REJECTED' ? 'مرفوض' : 'بانتظار'} {a.actionAt ? ` • ${a.actionAt}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5 text-sky-600" />
                  سجل الحركات المالية ({c.transactions.length})
                </p>
                {c.transactions.length === 0 ? (
                  <div className="rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">لا حركات بعد.</div>
                ) : (
                  <div className="space-y-1.5">
                    {[...c.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(t => (
                      <div key={t.id} className="rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${t.type === 'SETTLEMENT' ? 'bg-emerald-100 text-emerald-700' : t.type === 'DISBURSE' ? 'bg-sky-100 text-sky-700' : t.type === 'REPLENISH' ? 'bg-sky-100 text-sky-700' : t.type === 'REFUND' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{TXN_LABEL[t.type]}</span>
                            <span className="font-mono text-slate-900 dark:text-white text-xs font-bold">{fmtC(t.amount, c.currency || baseCurrency)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            <span className="truncate">{t.date}{t.narration ? ` • ${t.narration}` : ''}</span>
                            <span className="flex-shrink-0">{t.createdBy}</span>
                          </div>
                          {t.journalEntryId && <p className="text-xs text-sky-500/70 font-mono">قيد: {t.journalEntryId}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  جلسات التصفية ({c.settlements.length})
                </p>
                {c.settlements.length === 0 ? (
                  <div className="rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">لا جلسات تصفية بعد.</div>
                ) : (
                  <div className="space-y-1.5">
                    {[...c.settlements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(s => (
                      <div key={s.id} className="rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-600">{s.settlementNumber} • {s.date}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtC(s.totalExpense, c.currency || baseCurrency)}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">{s.items.length} بند {s.cashRefunded > 0 ? `• فائض معاد: ${fmtC(s.cashRefunded, c.currency || baseCurrency)}` : ''}{s.apTransferred > 0 ? ` • محوَّل AP: ${fmtC(s.apTransferred, c.currency || baseCurrency)}` : ''}{s.shortageAmount > 0 ? ` • عجز: ${fmtC(s.shortageAmount, c.currency || baseCurrency)}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button type="button" onClick={() => setDetailsTarget(null)} className="px-5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-sm font-bold shadow-lg cursor-pointer">إغلاق</button>
              </div>
            </div>
          </ModalShell>
        );
      })()}

      {isPrintOpen && printCustody && (() => {
        const c = printCustody;
        const j = printJournal;
        const srcBox = cashBoxes.find(b => b.id === c.disbursementSource);
        const srcBank = bankAccounts.find(b => b.id === c.disbursementSource);
        const srcLabel = srcBox
          ? `${srcBox.code} — صندوق: ${srcBox.nameAr}`
          : srcBank
            ? `${srcBank.code} — ${srcBank.entityType === 'BANK' ? 'بنك' : 'شركة صرافة'}: ${srcBank.bankNameAr}`
            : '—';
        const advanceAcc = advanceAccountOf(c);
        const curCode = c.currency || baseCurrency;
        const curNameAr = currencies.find(x => x.code === curCode)?.nameAr || curCode;
        const curFrac = CURRENCY_FRACTIONS[curCode] || 'جزء من المئة';
        const localEquiv = round2(Number(c.amount) * (Number(c.exchangeRate) || 1));
        return (
          <ModalShell
            id="custody-print"
            open={!!(isPrintOpen && printCustody)}
            onClose={() => setIsPrintOpen(false)}
            title={`معاينة سند استلام العهدة النقدية (${c.custodyNumber})`}
            icon={Printer}
            size="lg"
            maxWidth="max-w-3xl"
            footer={null}
            closeOnBackdrop={false}
            className="print-modal"
            bodyClassName="p-0"
            topRight={
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void handlePrintPreview()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  طباعة السند
                </button>
                <button
                  onClick={handleSavePdf}
                  disabled={pdfBusy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {pdfBusy ? 'جاري الإنشاء...' : 'حفظ PDF'}
                </button>
              </div>
            }
          >
            <div ref={printablePaperRef} className="paper print-area bg-white text-slate-900 text-right overflow-y-auto" dir="rtl">
              <div className="p-8">
                <VoucherPrintTemplate
                  voucherTitleAr="سند استلام عهدة نقدية"
                  voucherTitleEn="Custody Receipt Voucher"
                  documentNumber={c.custodyNumber}
                  documentDate={c.requestedDate}
                  currency={curCode}
                  currentUserName={currentUserName}
                  metadata={[
                    { label: 'الموظف المكلف', value: c.employeeName },
                    { label: 'نوع العهدة', value: CUSTODY_TYPE_LABEL[c.type] },
                    { label: 'طريقة الصرف', value: c.disbursementMethod ? DISBURSE_METHOD_META[c.disbursementMethod].label : '—' },
                    { label: 'مصدر النقدية (دائن)', value: srcLabel },
                    { label: 'حساب العهدة (مدين)', value: `${advanceAcc.code} — ${advanceAcc.nameAr}` },
                    ...(c.disbursementParties?.length ? [{ label: 'الأطراف المستفيدة', value: c.disbursementParties.map(party => `${party.name} (${fmtC(party.amount, curCode)})`).join('، ') }] : []),
                    ...(c.costCenterId ? [{ label: 'مركز التكلفة', value: costCenters.find(x => x.id === c.costCenterId)?.nameAr ?? c.costCenterId }] : []),
                    ...(c.referenceNumber ? [{ label: 'رقم المرجع', value: c.referenceNumber }] : []),
                    ...(c.expectedClearanceDate ? [{ label: 'تاريخ الانقضاء', value: formatDate(c.expectedClearanceDate) }] : []),
                    { label: 'سعر الصرف', value: String(c.exchangeRate || 1) },
                    { label: 'البيان', value: c.title },
                    ...(j ? [{ label: 'رقم القيد المرتبط', value: j.entryNumber }] : []),
                  ]}
                  tafqeetText={tafqeet(Number(c.amount), curNameAr, curFrac)}
                  totalAmountText={`${Number(c.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curCode}`}
                  localEquivalentText={`${localEquiv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseCurrency}`}
                  signatures={[
                    { roleLabelAr: 'أعده / المحاسب', name: c.createdBy },
                    { roleLabelAr: 'استلم العهدة (الموظف)', name: c.employeeName },
                    { roleLabelAr: 'المراجع المالي' },
                    { roleLabelAr: 'المدير المالي / الاعتماد' },
                  ]}
                >
                  {j ? (
                    <table>
                      <thead>
                        <tr>
                          <th className="text-center">#</th>
                          <th>رقم الحساب</th>
                          <th>اسم الحساب</th>
                          <th>البيان</th>
                          <th className="text-left">مدين ({curCode})</th>
                          <th className="text-left">دائن ({curCode})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {j.lines.map((line, idx) => (
                          <tr key={line.id}>
                            <td className="text-center font-mono">{idx + 1}</td>
                            <td className="font-mono">{line.accountCode}</td>
                            <td className="font-semibold">{line.accountNameAr}</td>
                            <td className="text-slate-600">{line.description}</td>
                            <td className="font-bold text-left font-mono whitespace-nowrap">{line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                            <td className="font-bold text-left font-mono whitespace-nowrap">{line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="text-left font-bold">الإجمالي:</td>
                          <td className="font-bold text-left font-mono whitespace-nowrap">{j.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="font-bold text-left font-mono whitespace-nowrap">{j.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <p className="text-center text-slate-500 py-4 text-sm">لا توجد أسطر قيد محاسبي مرتبط بهذا السند</p>
                  )}
                </VoucherPrintTemplate>
              </div>
            </div>
          </ModalShell>
        );
      })()}

      {rowMenu && (
        <>
          <div className="fixed inset-0 z-[105]" onClick={() => setRowMenu(null)} />
          {(() => {
            const c = rowMenu.c;
            const nextPending = c.status === 'PENDING_APPROVAL' ? { level: 1 } : null;
            const canRep = canReplenishLow(c);
            const menuItem =
              'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-sky-50 hover:text-sky-700 transition-colors text-right cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed';
            return (
              <div
                className="fixed z-[110] w-60 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 p-1.5"
                style={{ left: rowMenu.x, top: rowMenu.y }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 mb-1">
                  <TypeChip type={c.type} />
                  <span className="flex-1 truncate text-xs font-bold text-slate-900 dark:text-white font-mono">{c.custodyNumber}</span>
                </div>

                <button type="button" onClick={() => { setDetailsTarget(c); setRowMenu(null); }} className={menuItem}>
                  <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  تفاصيل وحركة العهدة
                </button>
                <button type="button" onClick={() => { openPrint(c); setRowMenu(null); }} className={menuItem}>
                  <Printer className="w-4 h-4 text-sky-600" />
                  طباعة سند تسليم
                </button>
                <button type="button" onClick={() => { setStatementTarget(c); setRowMenu(null); }} className={menuItem}>
                  <ReceiptText className="w-4 h-4 text-emerald-600" />
                  كشف حساب العهدة
                </button>
                {canEditCustody(c) && (
                  <button type="button" onClick={() => { openEdit(c); setRowMenu(null); }} className={menuItem}>
                    <Pencil className="w-4 h-4 text-sky-600" />
                    تعديل العهدة
                  </button>
                )}

                <div className="my-1 border-t border-slate-200" />

                {c.status === 'PENDING_APPROVAL' && nextPending && (
                  <button type="button" onClick={() => { openApprove(c); setRowMenu(null); }} className={menuItem}>
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    اعتماد السجل السابق
                  </button>
                )}
                {canDisburse(c) && (
                  <button type="button" onClick={() => { openModal(() => { setDisburseTarget(c); setDisburseSource(c.disbursementSource || ''); }); setRowMenu(null); }} className={menuItem}>
                    <Banknote className="w-4 h-4 text-sky-600" />
                    {c.status === 'CREATED' ? 'اعتماد وصرف آلي' : 'صرف العهدة (قيد آلي)'}
                  </button>
                )}
                {canSettle(c) && (
                  <button type="button" onClick={() => { openSettle(c); setRowMenu(null); }} className={menuItem}>
                    <FileSignature className="w-4 h-4 text-emerald-600" />
                    تصفية العهدة بالمستندات
                  </button>
                )}
                {canSettle(c) && (
                  <button type="button" onClick={() => { openRefund(c); setRowMenu(null); }} className={menuItem}>
                    <Undo2 className="w-4 h-4 text-sky-600" />
                    رد نقدية (فائض)
                  </button>
                )}
                {canRep && (
                  <button type="button" onClick={() => { openReplenish(c); setRowMenu(null); }} className={menuItem}>
                    <RefreshCw className="w-4 h-4 text-emerald-600" />
                    استعاضة المستديمة
                  </button>
                )}
                {canClose(c) && (
                  <button type="button" onClick={() => { openModal(() => setCloseTarget(c)); setRowMenu(null); }} className={menuItem}>
                    <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    إقفال العهدة
                  </button>
                )}
                {canVoid(c) && (
                  <button type="button" onClick={() => { setVoidTarget(c); setRowMenu(null); }} className={menuItem}>
                    <Ban className="w-4 h-4 text-red-600" />
                    إلغاء العهدة
                  </button>
                )}
              </div>
            );
          })()}
        </>
      )}

      {statementTarget && (() => {
        const c = statementTarget;
        const sorted = [...c.transactions].sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date));
        const opening = custodyPrincipal(c);
        let running = opening;
        const rows = sorted.map(t => {
          if (t.type === 'SETTLEMENT' || t.type === 'REFUND') running = Math.max(0, Math.round((running - t.amount) * 100) / 100);
          if (t.type === 'CANCEL') running = 0;
          return { ...t, balance: running };
        });
        return (
          <ModalShell id="custody-statement" open={!!statementTarget} title={`كشف حساب ${c.custodyNumber}`} icon={ReceiptText} onClose={() => setStatementTarget(null)} footer={null} closeOnBackdrop={false}>
            <div className="space-y-4">
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الموظف:</span><span className="font-semibold text-slate-900 dark:text-white">{c.employeeName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">قيمة العهدة:</span><span className="font-mono text-slate-900 dark:text-white">{fmtC(custodyPrincipal(c), c.currency || baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">الرصيد القائم:</span><span className={`font-mono font-bold ${outstandingBalance(c) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtC(outstandingBalance(c), c.currency || baseCurrency)}</span></div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3">البيان</th>
                      <th className="py-2.5 px-3">القيمة</th>
                      <th className="py-2.5 px-3">القائم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">—</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">رصيد افتتاحي (قيمة العهدة)</td>
                      <td className="py-2.5 px-3 font-mono text-slate-900 dark:text-white">{fmtC(opening, c.currency || baseCurrency)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-400">{fmtC(opening, c.currency || baseCurrency)}</td>
                    </tr>
                    {rows.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-500 dark:text-slate-400">لا حركات بعد.</td></tr>
                    ) : (
                      rows.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{t.date}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{t.narration || TXN_LABEL[t.type]}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-900 dark:text-white">{fmtC(t.amount, c.currency || baseCurrency)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-600">{fmtC(t.balance, c.currency || baseCurrency)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">الكشف النهائي = أصل العهدة − المصفى بالمستندات − النقدية المعادة − المحوَّل للدائنين (AP).</p>
            </div>
          </ModalShell>
        );
      })()}
    </div>
  );
}
