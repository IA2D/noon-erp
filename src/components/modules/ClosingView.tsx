import React, { useState, useMemo } from 'react';
import { Account, JournalEntry, JournalLine, AuditLog, PaymentVoucher, ReceiptVoucher, Currency } from '../../types/erp';
import {
  calculateAccountActivity,
  isPostingAccount,
  netAccountBalance,
  accountFinancialType,
  nextJournalNumber
} from '../../utils/accountingEngine';
import {
  Lock,
  Unlock,
  FileText,
  Coins,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CalendarCheck,
  ArrowLeftRight,
  RotateCcw,
  History,
  Send,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Database,
  Download
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import ModalShell from '../ui/ModalShell';
import EmptyState from '../ui/EmptyState';
import KPICard from '../ui/KPICard';
import { periodRecordFor, periodStatusLabel, type FinancialPeriodRecord } from '../../utils/periodLifecycle';
import CurrencyRevaluationPanel from './CurrencyRevaluationPanel';
import type { DailyPostingBatchResult, DailyPostingRequest } from '../../utils/dailyPosting';

interface Props {
  accounts: Account[];
  journals: JournalEntry[];
  auditLogs: AuditLog[];
  vouchers: PaymentVoucher[];
  receipts: ReceiptVoucher[];
  closedYears: string[];
  closedMonths: string[];
  periodStates: FinancialPeriodRecord[];
  currencies: Currency[];
  onCloseYear: (year: string, closingEntry: JournalEntry | null) => boolean;
  onReopenYear: (year: string, request?: { reason?: string; approvedBy?: string }) => boolean;
  onCloseMonth: (month: string) => boolean;
  onReopenMonth: (month: string, request?: { reason?: string; approvedBy?: string }) => boolean;
  onBatchPost: (items: DailyPostingRequest[]) => DailyPostingBatchResult;
  onUnpostJournal: (id: string) => boolean;
  onUnpostVoucher: (kind: 'PAYMENT' | 'RECEIPT', id: string) => boolean;
  onCreateOpeningEntry: (year: string) => boolean;
  onCreateRevaluationJournal: (entry: JournalEntry) => boolean | void;
  currentUserName: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const yearOf = (date: string) => date.slice(0, 4);
const monthOf = (date: string) => date.slice(0, 7);

const MONTH_LABELS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const TABS: Array<{ id: 'posting' | 'monthly' | 'yearly' | 'audit'; label: string; icon: React.ElementType; iconClass: string; description: string; meta: string }> = [
  { id: 'posting', label: 'الترحيل اليومي والمرحلي', icon: Send, iconClass: 'bg-sky-500/20 text-sky-400', description: 'ترحيل القيود اليومية وسندات الصرف والقبض إلى الأستاذ العام', meta: 'مستندات بانتظار الترحيل' },
  { id: 'monthly', label: 'الإقفالات الشهرية والفترات', icon: CalendarCheck, iconClass: 'bg-amber-500/20 text-amber-400', description: 'إقفال الشهور المالية وفتراتها ومنع الترحيل عليها بعد الإقفال', meta: 'تقويم الشهور' },
  { id: 'yearly', label: 'الإقفال السنوي وتدوير الأرصدة', icon: Lock, iconClass: 'bg-emerald-500/20 text-emerald-400', description: 'إقفال السنة المالية وتوليد قيد الإقفال وتدوير الأرصدة إلى الأرباح المبقاة', meta: 'إقفال السنة' },
  { id: 'audit', label: 'سجل الرقابة وتدقيق العمليات', icon: ShieldCheck, iconClass: 'bg-sky-500/20 text-sky-400', description: 'سجل كامل لعمليات الترحيل والإقفال والتدقيق في النظام', meta: 'سجل التدقيق' }
];

type PostRow = {
  kind: 'JOURNAL' | 'PAYMENT' | 'RECEIPT';
  id: string;
  docNo: string;
  date: string;
  amount: number;
  narration: string;
  balanced: boolean;
  linkedJournal?: string;
};

export default function ClosingView({
  accounts,
  journals,
  auditLogs,
  vouchers,
  receipts,
  closedYears,
  closedMonths,
  periodStates,
  currencies,
  onCloseYear,
  onReopenYear,
  onCloseMonth,
  onReopenMonth,
  onBatchPost,
  onUnpostJournal,
  onUnpostVoucher,
  onCreateOpeningEntry,
  onCreateRevaluationJournal,
  currentUserName
}: Props) {
  const toast = useToast();
  const { lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;
  const [tab, setTab] = useState<'posting' | 'monthly' | 'yearly' | 'audit'>('posting');
  const [activeModal, setActiveModal] = useState<'posting' | 'monthly' | 'yearly' | 'audit' | null>(null);
  const activeDef = TABS.find(t => t.id === activeModal);

  const currentYear = String(new Date().getFullYear());
  const years = useMemo(() => {
    const set = new Set<string>([currentYear]);
    journals.forEach(j => set.add(yearOf(j.date)));
    vouchers.forEach(v => set.add(yearOf(v.date)));
    receipts.forEach(r => set.add(yearOf(r.date)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journals, vouchers, receipts]);

  const retainedAccount = useMemo(
    () =>
      accounts.find(a => a.code === '2202010001' && a.level === 5) ??
      accounts.find(a => a.nameAr.includes('أرباح مبقاة') && a.level === 5) ??
      accounts.find(a => a.code.startsWith('2202') && a.level === 5),
    [accounts]
  );

  const buildClosingEntry = (year: string): JournalEntry | null => {
    if (!retainedAccount) return null;
    const yearJournals = journals.filter(j => j.status === 'POSTED' && yearOf(j.date) === year);
    const activity = calculateAccountActivity(accounts, yearJournals);
    const postingAccounts = accounts.filter(isPostingAccount);

    const lines: JournalLine[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    postingAccounts.forEach(acc => {
      const type = accountFinancialType(acc, accounts);
      if (type !== 'REVENUE' && type !== 'EXPENSE') return;
      const net = round2(netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 }));
      if (Math.abs(net) < 0.005) return;
      if (type === 'REVENUE') {
        if (net > 0) {
          lines.push({ id: `cl-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: net, credit: 0, description: `إقفال الإيرادات ${acc.nameAr}` });
          totalDebit += net;
        } else {
          lines.push({ id: `cl-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: 0, credit: Math.abs(net), description: `عكس إيرادات ${acc.nameAr}` });
          totalCredit += Math.abs(net);
        }
      } else {
        if (net > 0) {
          lines.push({ id: `cl-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: 0, credit: net, description: `إقفال المصروفات ${acc.nameAr}` });
          totalCredit += net;
        } else {
          lines.push({ id: `cl-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: Math.abs(net), credit: 0, description: `عكس مصروف ${acc.nameAr}` });
          totalDebit += Math.abs(net);
        }
      }
    });

    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);
    const netIncome = round2(totalDebit - totalCredit);

    if (lines.length === 0 && Math.abs(netIncome) < 0.005) return null;

    if (netIncome > 0) {
      lines.push({ id: 'cl-retained', accountId: retainedAccount.id, accountCode: retainedAccount.code, accountNameAr: retainedAccount.nameAr, debit: 0, credit: netIncome, description: 'ترحيل صافي الربح إلى الأرباح المبقاة' });
      totalCredit += netIncome;
    } else if (netIncome < 0) {
      lines.push({ id: 'cl-retained', accountId: retainedAccount.id, accountCode: retainedAccount.code, accountNameAr: retainedAccount.nameAr, debit: Math.abs(netIncome), credit: 0, description: 'تغطية صافي الخسارة من الأرباح المبقاة' });
      totalDebit += Math.abs(netIncome);
    }

    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    return {
      id: `close-${year}-${Date.now()}`,
      entryNumber: nextJournalNumber(journals),
      date: `${year}-12-31`,
      reference: `CLOSE-${year}`,
      narration: `إقفال السنة المالية ${year} — ترحيل الإيرادات والمصروفات إلى الأرباح المبقاة`,
      lines,
      totalDebit,
      totalCredit,
      currency: 'YER',
      exchangeRate: 1,
      status: 'POSTED',
      createdBy: currentUserName,
      createdAt: now,
      postedBy: currentUserName,
      postedAt: now
    };
  };

  const pendingRows: PostRow[] = useMemo(() => {
    const rows: PostRow[] = [];
    journals
      .filter(j => j.status === 'PENDING_POSTING')
      .forEach(j => {
        const balanced = Math.abs(j.totalDebit - j.totalCredit) < 0.01;
        rows.push({ kind: 'JOURNAL', id: j.id, docNo: j.entryNumber, date: j.date, amount: j.totalDebit, narration: j.narration, balanced });
      });
    vouchers
      .filter(v => v.status === 'PENDING_POSTING')
      .forEach(v => {
        rows.push({ kind: 'PAYMENT', id: v.id, docNo: v.voucherNumber, date: v.date, amount: v.totalAmount, narration: `سند صرف — ${v.payeeName} — ${v.narration}`, balanced: true });
      });
    receipts
      .filter(r => r.status === 'PENDING_POSTING')
      .forEach(r => {
        rows.push({ kind: 'RECEIPT', id: r.id, docNo: r.receiptNumber, date: r.date, amount: r.totalAmount, narration: `سند قبض — ${r.payerName} — ${r.narration}`, balanced: true });
      });
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.docNo.localeCompare(b.docNo));
  }, [journals, vouchers, receipts]);

  const [docFilter, setDocFilter] = useState<'ALL' | 'JOURNAL' | 'PAYMENT' | 'RECEIPT'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredRows = useMemo(
    () => (docFilter === 'ALL' ? pendingRows : pendingRows.filter(r => r.kind === docFilter)),
    [pendingRows, docFilter]
  );

  const toggleSelect = (key: string) =>
    setSelectedIds(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const toggleSelectAll = () => {
    if (filteredRows.length === 0) return;
    const keys = filteredRows.map(r => `${r.kind}:${r.id}`);
    const allSelected = keys.every(k => selectedIds.includes(k));
    setSelectedIds(prev => (allSelected ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys]))));
  };

  const selectedRows = pendingRows.filter(r => selectedIds.includes(`${r.kind}:${r.id}`));

  const pendingJournals = journals.filter(j => j.status === 'PENDING_POSTING').length;
  const pendingPayments = vouchers.filter(v => v.status === 'PENDING_POSTING').length;
  const pendingReceipts = receipts.filter(r => r.status === 'PENDING_POSTING').length;

  const handleBatchPost = () => {
    if (selectedRows.length === 0) {
      toast('error', 'لم يتم تحديد أي مستندات للترحيل');
      return;
    }
    const blocked = selectedRows.filter(r => closedYears.includes(yearOf(r.date)) || closedMonths.includes(monthOf(r.date)));
    if (blocked.length > 0) {
      toast('error', `توقفت بعض المستندات في سنة/شهر مغلق: ${blocked.map(b => b.docNo).join('، ')}`);
      return;
    }
    const result = onBatchPost(selectedRows.map(({ kind, id, docNo }) => ({ kind, id, docNo })));
    const postedKeys = new Set(result.results.filter(item => item.ok).map(item => `${item.kind}:${item.id}`));
    setSelectedIds(previous => previous.filter(key => !postedKeys.has(key)));
    if (result.posted > 0) toast('success', `تم ترحيل ${result.posted} مستند بنجاح وإنشاء قيود السندات آليًا`);
    if (result.failed > 0) {
      const details = result.results.filter(item => !item.ok).map(item => `${item.docNo}: ${item.error}`).join('، ');
      toast('error', `تعذر ترحيل ${result.failed} مستند — ${details}`);
    }
  };

  const [confirmUnpost, setConfirmUnpost] = useState(false);
  const [unpostManagerOk, setUnpostManagerOk] = useState(false);
  const [unpostFilter, setUnpostFilter] = useState<'ALL' | 'JOURNAL' | 'PAYMENT' | 'RECEIPT'>('ALL');
  const [unpostSelected, setUnpostSelected] = useState<string[]>([]);

  /** المستندات المرحّلة القابلة للعكس؛ لا نكرر قيود السندات ولا نعرض ما عُكس سابقاً. */
  const unpostRows: PostRow[] = useMemo(() => {
    const rows: PostRow[] = [];
    journals
      .filter(j => j.status === 'POSTED' && !j.reversedByEntryId && !j.reversalOfEntryId && (!j.sourceType || j.sourceType === 'MANUAL') && !j.reference?.startsWith('CLOSE-') && !j.reference?.startsWith('OPEN-'))
      .forEach(j => {
        rows.push({ kind: 'JOURNAL', id: j.id, docNo: j.entryNumber, date: j.date, amount: j.totalDebit, narration: j.narration, balanced: true });
      });
    vouchers
      .filter(v => v.status === 'POSTED')
      .forEach(v => {
        const linked = journals.find(j => j.id === v.journalEntryId || j.reference === v.voucherNumber);
        rows.push({ kind: 'PAYMENT', id: v.id, docNo: v.voucherNumber, date: v.date, amount: v.totalAmount, narration: `سند صرف — ${v.payeeName} — ${v.narration}`, balanced: true, linkedJournal: linked?.entryNumber });
      });
    receipts
      .filter(r => r.status === 'POSTED')
      .forEach(r => {
        const linked = journals.find(j => j.id === r.journalEntryId || j.reference === r.receiptNumber);
        rows.push({ kind: 'RECEIPT', id: r.id, docNo: r.receiptNumber, date: r.date, amount: r.totalAmount, narration: `سند قبض — ${r.payerName} — ${r.narration}`, balanced: true, linkedJournal: linked?.entryNumber });
      });
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.docNo.localeCompare(b.docNo));
  }, [journals, vouchers, receipts]);

  const filteredUnpost = useMemo(
    () => (unpostFilter === 'ALL' ? unpostRows : unpostRows.filter(r => r.kind === unpostFilter)),
    [unpostRows, unpostFilter]
  );
  const selectedUnpostRows = unpostRows.filter(r => unpostSelected.includes(`${r.kind}:${r.id}`));

  const toggleSelectUnpost = (key: string) =>
    setUnpostSelected(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const toggleSelectAllUnpost = () => {
    if (filteredUnpost.length === 0) return;
    const keys = filteredUnpost.map(r => `${r.kind}:${r.id}`);
    const allSelected = keys.every(k => unpostSelected.includes(k));
    setUnpostSelected(prev => (allSelected ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys]))));
  };

  const handleUnpost = () => {
    if (!unpostManagerOk) {
      toast('error', 'يتطلب إلغاء الترحيل تأكيد صلاحية المدير أولاً');
      return;
    }
    if (selectedUnpostRows.length === 0) {
      toast('error', 'لم يتم تحديد أي مستندات مرحّلة للإلغاء');
      return;
    }
    let done = 0;
    selectedUnpostRows.forEach(r => {
      if (r.kind === 'JOURNAL') {
        if (onUnpostJournal(r.id)) done += 1;
      } else {
        if (onUnpostVoucher(r.kind === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT', r.id)) done += 1;
      }
    });
    setUnpostSelected([]);
    setConfirmUnpost(false);
    setUnpostManagerOk(false);
    toast(done ? 'success' : 'error', done ? `تم إنشاء قيود عكسية مرتبطة لـ ${done} مستند` : 'لم يتم عكس أي مستند');
  };

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const maxYear = journals.map(j => yearOf(j.date)).sort((a, b) => b.localeCompare(a))[0];
    return maxYear || currentYear;
  });

  const [confirmMonth, setConfirmMonth] = useState<string | null>(null);
  const [confirmReopenMonth, setConfirmReopenMonth] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('تصحيح معتمد بعد المراجعة');
  const [reopenApprover, setReopenApprover] = useState('');

  const monthRows = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mm = String(m).padStart(2, '0');
    const key = `${selectedYear}-${mm}`;
    const rows = journals.filter(j => yearOf(j.date) === selectedYear && monthOf(j.date) === key);
    const pending = rows.filter(j => j.status === 'PENDING_POSTING').length
      + vouchers.filter(v => v.status === 'PENDING_POSTING' && monthOf(v.date) === key).length
      + receipts.filter(r => r.status === 'PENDING_POSTING' && monthOf(r.date) === key).length;
    const posted = rows.filter(j => j.status === 'POSTED').length;
    const totalDebit = round2(rows.filter(j => j.status === 'POSTED').reduce((s, j) => s + j.totalDebit, 0));
    const totalCredit = round2(rows.filter(j => j.status === 'POSTED').reduce((s, j) => s + j.totalCredit, 0));
    const suspended = pending > 0;
    const period = periodRecordFor(periodStates, key, 'MONTH');
    const yearPeriod = periodRecordFor(periodStates, selectedYear, 'YEAR');
    const closed = period.status !== 'OPEN' || closedMonths.includes(key);
    const lockedYear = yearPeriod.status !== 'OPEN' || closedYears.includes(selectedYear);
    return { key, label: MONTH_LABELS[i], pending, posted, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01, suspended, closed, lockedYear, period };
  });

  const monthYearLocked = closedYears.includes(selectedYear);
  const monthHasPending = monthRows.some(r => r.suspended);
  const monthAllClosed = monthRows.every(r => r.closed);
  const monthOpenCount = monthRows.filter(r => !r.closed).length;
  const monthClosedCount = monthRows.filter(r => r.closed).length;

  const [selectedYearWizard, setSelectedYearWizard] = useState<string>(currentYear);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmRollover, setConfirmRollover] = useState(false);

  const wizardYearJournals = journals.filter(j => yearOf(j.date) === selectedYearWizard);
  const wizardPosted = wizardYearJournals.filter(j => j.status === 'POSTED');
  const wizardDebit = round2(wizardPosted.reduce((s, j) => s + j.totalDebit, 0));
  const wizardCredit = round2(wizardPosted.reduce((s, j) => s + j.totalCredit, 0));
  const wizardBalanced = Math.abs(wizardDebit - wizardCredit) < 0.01;
  const wizardPeriod = periodRecordFor(periodStates, selectedYearWizard, 'YEAR');
  const wizardYearClosed = wizardPeriod.status !== 'OPEN' || closedYears.includes(selectedYearWizard);
  const wizardFinalClosed = wizardPeriod.status === 'FINAL_CLOSED';
  const wizardNextStatus = wizardPeriod.status === 'OPEN' ? 'TEMP_CLOSED' : wizardPeriod.status === 'TEMP_CLOSED' ? 'REVIEWED' : wizardPeriod.status === 'REVIEWED' ? 'FINAL_CLOSED' : null;
  const wizardClosingEntry = journals.find(j => j.reference === `CLOSE-${selectedYearWizard}` && j.status === 'POSTED');
  const wizardOpeningEntry = journals.find(j => j.reference === `OPEN-${String(Number(selectedYearWizard) + 1)}` && j.status === 'POSTED');
  const wizardPreview = wizardFinalClosed ? null : buildClosingEntry(selectedYearWizard);

  const wizardTrial = useMemo(() => {
    const activity = calculateAccountActivity(accounts, wizardPosted);
    return accounts
      .filter(isPostingAccount)
      .map(acc => {
        const net = round2(netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 }));
        return { acc, net, type: accountFinancialType(acc, accounts) };
      })
      .filter(row => Math.abs(row.net) >= 0.005)
      .sort((a, b) => a.acc.code.localeCompare(b.acc.code));
  }, [accounts, wizardPosted]);

  const wizardCloseReason = !wizardBalanced
    ? 'الميزانية غير متوازنة — راجع فرق المدين/الدائن قبل الإقفال'
    : wizardClosingEntry
      ? 'يوجد قيد إقفال مرحل لهذه السنة بالفعل'
      : wizardPosted.length === 0
        ? 'لا توجد قيود مرحّلة في هذه السنة للإقفال'
        : null;

  const [auditModule, setAuditModule] = useState<'ALL' | 'GENERAL_LEDGER' | 'PAYMENT_VOUCHERS' | 'RECEIPT_VOUCHERS'>('ALL');
  const auditModuleLabels: Record<string, string> = {
    GENERAL_LEDGER: 'دفتر اليومية',
    PAYMENT_VOUCHERS: 'سندات الصرف',
    RECEIPT_VOUCHERS: 'سندات القبض'
  };
  const filteredAudits = useMemo(
    () =>
      (auditModule === 'ALL' ? auditLogs : auditLogs.filter(l => l.module === auditModule)).slice(0, 100),
    [auditLogs, auditModule]
  );

  const exportAudit = () => {
    const header = 'time,module,user,action,details';
    const lines = filteredAudits.map(l => `"${l.timestamp}","${auditModuleLabels[l.module] ?? l.module}","${l.userName}","${l.action}","${(l.details || '').replace(/"/g, '""')}"`);
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', 'تم تصدير سجل التدقيق كملف CSV');
  };

  const stepBadge = (step: number) => (
    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-black shadow-md shadow-blue-600/30 flex-shrink-0">{step}</div>
  );

  const chipActive = 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20';
  const chipIdle = 'bg-slate-900 text-slate-300 border border-slate-700/70 hover:border-sky-400 hover:text-white';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Lock className="w-6 h-6" />}
        title="الإقفالات والترحيل والرقابة"
        subtitle="ترحيل المستندات اليومية، إقفال الشهور والسنة المالية، وتدوير الأرصدة مع سجل رقابة كامل"
      />

      {/* شبكة أقسام الإقفالات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TABS.map(tabDef => {
          const TabIcon = tabDef.icon;
          const active = tab === tabDef.id;
          const postingMeta = pendingRows.length > 0
            ? `${pendingRows.length} مستند بانتظار الترحيل`
            : 'تم ترحيل جميع المستندات';
          const displayMeta = tabDef.id === 'posting' ? postingMeta : tabDef.meta;
          const postingComplete = tabDef.id === 'posting' && pendingRows.length === 0;
          return (
            <button
              key={tabDef.id}
              type="button"
              onClick={() => {
                setTab(tabDef.id);
                setActiveModal(tabDef.id);
              }}
              className={`group relative text-right glass rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden ${
                active ? 'border-sky-500/40' : 'border-slate-700/50 hover:border-sky-500/40'
              }`}
            >
              <div className={`p-3.5 rounded-2xl border border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-300 w-fit ${active ? tabDef.iconClass : 'bg-slate-800 text-slate-400'}`}>
                <TabIcon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 font-bold text-white text-base">{tabDef.label}</h3>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold rounded-full px-2.5 py-1 ${postingComplete ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-500 bg-slate-800/50'}`}>{displayMeta}</span>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold whitespace-nowrap">
                  <span>{active ? 'معروض الآن' : 'فتح'}</span>
                  <Arrow className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* نافذة القسم — تظهر عند النقر على أي مربع */}
      <ModalShell
        id="closing-section"
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title={activeDef ? activeDef.label : 'الإقفالات والترحيل والرقابة'}
        subtitle={activeDef?.description}
        icon={activeDef?.icon ?? Lock}
        size="xl"
        footer={null}
        bodyClassName="p-0"
      >
        <div key={tab} className="p-5 lg:p-6 space-y-6">

      {tab === 'posting' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="قيود يومية بانتظار الترحيل" value={`${pendingJournals}`} hint="بانتظار الترحيل" icon={FileText} iconClass="bg-sky-500/15 text-sky-400" />
            <KPICard title="سندات صرف بانتظار الترحيل" value={`${pendingPayments}`} hint="بانتظار الترحيل" icon={Coins} iconClass="bg-amber-500/15 text-amber-400" />
            <KPICard title="سندات قبض بانتظار الترحيل" value={`${pendingReceipts}`} hint="بانتظار الترحيل" icon={Coins} iconClass="bg-emerald-500/15 text-emerald-400" />
            <KPICard title="مستندات محددة" value={`${selectedIds.length}`} hint={selectedIds.length ? 'جاهزة للترحيل' : 'اختر من الجدول أدناه'} icon={ListChecks} iconClass="bg-sky-500/15 text-sky-400" />
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
                  <ListChecks className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">الترحيل اليومي والمرحلي</h3>
                  <p className="text-xs text-slate-400">المستندات المنتظرة — حدد المستندات ثم اضغط ترحيل</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'JOURNAL', 'PAYMENT', 'RECEIPT'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDocFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${docFilter === f ? chipActive : chipIdle}`}
                  >
                    {f === 'ALL' ? 'الكل' : f === 'JOURNAL' ? 'قيود يومية' : f === 'PAYMENT' ? 'سندات صرف' : 'سندات قبض'}
                  </button>
                ))}
              </div>
            </div>

            {pendingRows.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-7 h-7 text-sky-400" />}
                title="لا توجد مستندات معلقة"
                description="جميع القيود والسندات مرحلة، أو لا توجد مستندات جديدة تحتاج إلى ترحيل."
              />
            ) : filteredRows.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7 text-sky-400" />}
                title="لا توجد مستندات في هذا التصنيف"
                description="اختر تصنيفاً آخر أو عدّل الفلتر."
              />
            ) : (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-right text-[14px]">
                    <thead className="bg-slate-800/60 text-slate-300 font-bold text-xs">
                      <tr>
                        <th className="py-3 px-4 border-b border-slate-700 w-12">
                          <input
                            type="checkbox"
                            checked={filteredRows.length > 0 && filteredRows.every(r => selectedIds.includes(`${r.kind}:${r.id}`))}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="تحديد الكل"
                          />
                        </th>
                        <th className="py-3 px-4 border-b border-slate-700">رقم السند</th>
                        <th className="py-3 px-4 border-b border-slate-700">النوع</th>
                        <th className="py-3 px-4 border-b border-slate-700">التاريخ</th>
                        <th className="py-3 px-4 border-b border-slate-700 text-left">المبلغ</th>
                        <th className="py-3 px-4 border-b border-slate-700">البيان</th>
                        <th className="py-3 px-4 border-b border-slate-700 text-center">حالة التوازن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredRows.map(row => {
                        const key = `${row.kind}:${row.id}`;
                        const checked = selectedIds.includes(key);
                        return (
                          <tr key={key} className={`hover:bg-white/5 transition-colors ${checked ? 'bg-sky-500/10' : ''}`}>
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelect(key)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-white">{row.docNo}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-bold border ${
                                row.kind === 'JOURNAL'
                                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                  : row.kind === 'PAYMENT'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}>
                                {row.kind === 'JOURNAL' ? 'قيد يومية' : row.kind === 'PAYMENT' ? 'سند صرف' : 'سند قبض'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-xs">{row.date}</td>
                            <td className="py-3 px-4 font-mono font-bold text-white text-left">{fmt(row.amount)}</td>
                            <td className="py-3 px-4 text-slate-300 max-w-[260px] truncate">{row.narration}</td>
                            <td className="py-3 px-4 text-center">
                              {row.balanced ? (
                                <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><CheckCircle2 className="w-3.5 h-3.5" />متوازن</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30"><AlertTriangle className="w-3.5 h-3.5" />غير متوازن</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-800 bg-slate-900/40">
                  <div className="text-xs text-slate-300 font-bold">
                    تم تحديد <span className="text-sky-400">{selectedIds.length}</span> من {pendingRows.length} مستند
                    {selectedRows.some(r => !r.balanced) && (
                      <span className="mr-2 text-red-300">تنبيه: توجد قيود غير متوازنة — يجب تصحيحها في صفحة قيود اليومية قبل الترحيل</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBatchPost}
                      disabled={selectedIds.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      ترحيل السجلات المحددة
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">مستندات مرحلة قابلة للإلغاء</h3>
                  <p className="text-xs text-slate-400">إلغاء الترحيل يتطلب صلاحية المدير ويُسجل في سجل التدقيق — يُنشأ قيد عكسي مرتبط ويُبطل قيد السند</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'JOURNAL', 'PAYMENT', 'RECEIPT'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setUnpostFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${unpostFilter === f ? chipActive : chipIdle}`}
                  >
                    {f === 'ALL' ? 'الكل' : f === 'JOURNAL' ? 'قيود يومية' : f === 'PAYMENT' ? 'سندات صرف' : 'سندات قبض'}
                  </button>
                ))}
              </div>
            </div>

            {unpostRows.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-7 h-7 text-emerald-400" />}
                title="لا توجد مستندات مرحّلة"
                description="لا توجد قيود أو سندات مرحلة قابلة للعكس."
              />
            ) : filteredUnpost.length === 0 ? (
              <EmptyState
                icon={<RotateCcw className="w-7 h-7 text-amber-400" />}
                title="لا توجد مستندات في هذا التصنيف"
                description="اختر تصنيفاً آخر أو عدّل الفلتر."
              />
            ) : (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-right text-[14px]">
                    <thead className="bg-slate-800/60 text-slate-300 font-bold text-xs">
                      <tr>
                        <th className="py-3 px-4 border-b border-slate-700 w-12">
                          <input
                            type="checkbox"
                            checked={filteredUnpost.length > 0 && filteredUnpost.every(r => unpostSelected.includes(`${r.kind}:${r.id}`))}
                            onChange={toggleSelectAllUnpost}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="تحديد الكل"
                          />
                        </th>
                        <th className="py-3 px-4 border-b border-slate-700">رقم السند</th>
                        <th className="py-3 px-4 border-b border-slate-700">النوع</th>
                        <th className="py-3 px-4 border-b border-slate-700">التاريخ</th>
                        <th className="py-3 px-4 border-b border-slate-700 text-left">المبلغ</th>
                        <th className="py-3 px-4 border-b border-slate-700">البيان</th>
                        <th className="py-3 px-4 border-b border-slate-700">القيد المرتبط</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUnpost.map(row => {
                        const key = `${row.kind}:${row.id}`;
                        const checked = unpostSelected.includes(key);
                        return (
                          <tr key={key} className={`hover:bg-white/5 transition-colors ${checked ? 'bg-amber-500/10' : ''}`}>
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectUnpost(key)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-white">{row.docNo}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-bold border ${
                                row.kind === 'JOURNAL'
                                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                  : row.kind === 'PAYMENT'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}>
                                {row.kind === 'JOURNAL' ? 'قيد يومية' : row.kind === 'PAYMENT' ? 'سند صرف' : 'سند قبض'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-xs">{row.date}</td>
                            <td className="py-3 px-4 font-mono font-bold text-white text-left">{fmt(row.amount)}</td>
                            <td className="py-3 px-4 text-slate-300 max-w-[260px] truncate">{row.narration}</td>
                            <td className="py-3 px-4">
                              {row.linkedJournal ? (
                                <span className="font-mono text-xs text-sky-300">{row.linkedJournal}</span>
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-800 bg-slate-900/40">
                  <div className="text-xs text-slate-300 font-bold">
                    تم تحديد <span className="text-amber-400">{unpostSelected.length}</span> من {unpostRows.length} مستند مرحّل
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmUnpost(true)}
                      disabled={unpostSelected.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-4 h-4" />
                      عكس المحدد ({unpostSelected.length})
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="شهور مفتوحة" value={`${monthOpenCount}`} hint={`للسنة ${selectedYear}`} icon={CalendarCheck} iconClass="bg-emerald-500/15 text-emerald-400" />
            <KPICard title="شهور مغلقة" value={`${monthClosedCount}`} hint={`للسنة ${selectedYear}`} icon={Lock} iconClass="bg-sky-500/15 text-sky-400" />
            <KPICard title="قيود معلقة" value={`${monthRows.reduce((s, r) => s + r.pending, 0)}`} hint="تمنع الإقفال" icon={AlertTriangle} iconClass="bg-amber-500/15 text-amber-400" />
            <KPICard title="حالة السنة" value={monthYearLocked ? 'مقفلة' : 'مفتوحة'} hint={monthYearLocked ? 'ترحيل موقوف كلياً' : 'ترحيل مسموح'} icon={Unlock} iconClass={monthYearLocked ? 'bg-slate-700/50 text-slate-300' : 'bg-sky-500/15 text-sky-400'} />
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
                  <CalendarCheck className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">تقويم الشهور المالية — {selectedYear}</h3>
                  <p className="text-xs text-slate-400">كل شهر يُقفل منفرداً، مع تعطيل أي ترحيلات جديدة عليه بعد الإقفال</p>
                </div>
              </div>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {years.map(y => (
                  <option key={y} value={y}>السنة المالية {y}</option>
                ))}
              </select>
            </div>

            <div className="p-5 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {monthRows.map(month => (
                <div
                  key={month.key}
                  className={`rounded-2xl border p-4 transition-all ${
                    month.closed
                      ? 'bg-slate-950/60 border-slate-800'
                      : month.suspended
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-white text-sm">{month.label}</span>
                    {month.closed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        <Lock className="w-3 h-3" />{periodStatusLabel[month.period.status]}
                      </span>
                    ) : month.suspended ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />معلق
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />مفتوح
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-2 py-1.5">
                      <div className="text-slate-400">القيود</div>
                      <div className="font-mono font-bold text-white">{month.posted}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-2 py-1.5">
                      <div className="text-slate-400">بانتظار الترحيل</div>
                      <div className="font-mono font-bold text-amber-300">{month.pending}</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-2 py-1.5 col-span-2">
                      <div className="text-slate-400">مدين / دائن</div>
                      <div className={`font-mono font-bold ${month.balanced ? 'text-emerald-300' : 'text-red-300'}`}>{fmt(month.totalDebit)} / {fmt(month.totalCredit)}</div>
                    </div>
                  </div>
                  {month.period.status === 'FINAL_CLOSED' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReopenMonth(month.key)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      إعادة فتح الشهر النهائي
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={month.suspended || month.lockedYear}
                        title={month.suspended ? 'توجد قيود بانتظار الترحيل غير مرحّلة — ارحلها أولاً' : month.lockedYear ? 'السنة مقفلة — افتح السنة أولاً' : 'نقل الشهر للمرحلة التالية'}
                        onClick={() => setConfirmMonth(month.key)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {month.period.status === 'OPEN' ? 'إقفال مؤقت' : month.period.status === 'TEMP_CLOSED' ? 'اعتماد المراجعة' : 'إقفال نهائي'}
                      </button>
                      {month.period.status !== 'OPEN' && (
                        <button type="button" onClick={() => setConfirmReopenMonth(month.key)} title="إعادة فتح محكومة" className="px-3 py-2 rounded-xl border border-amber-500/30 text-amber-300 cursor-pointer"><Unlock className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden p-5">
            <h4 className="font-bold text-white flex items-center gap-2 mb-4 text-sm">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              قائمة التحقق قبل الإقفال — {selectedYear}
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className={`flex items-start gap-3 rounded-xl border p-4 ${monthHasPending ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
                {monthHasPending ? <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />}
                <div>
                  <div className="text-sm font-bold text-white">لا توجد قيود معلقة بالترحيل</div>
                  <p className="text-xs text-slate-400 mt-1">
                    {monthHasPending
                      ? 'توجد قيود بانتظار الترحيل في بعض الشهور — يجب ترحيلها أو إلغاؤها قبل إقفال الشهر.'
                      : 'جميع قيود السنة مرحّلة — لا توجد قيود بانتظار الترحيل تمنع الإقفال.'}
                  </p>
                </div>
              </div>
              <div className={`flex items-start gap-3 rounded-xl border p-4 ${monthAllClosed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/50'}`}>
                <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${monthAllClosed ? 'text-emerald-300' : 'text-slate-500'}`} />
                <div>
                  <div className="text-sm font-bold text-white">شهور مغلقة ({monthClosedCount} من 12)</div>
                  <p className="text-xs text-slate-400 mt-1">
                    {monthAllClosed
                      ? 'اكتمل إقفال جميع الشهور — يمكنك الانتقال إلى الإقفال السنوي وتدوير الأرصدة.'
                      : 'لا يزال هناك شهور مفتوحة — تُقفل كل فترة بعد ترحيل مستنداتها.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'yearly' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="قيود السنة" value={`${wizardPosted.length}`} hint={`للسنة ${selectedYearWizard}`} icon={FileText} iconClass="bg-sky-500/15 text-sky-400" />
            <KPICard title="التوازن" value={wizardBalanced ? 'متوازن' : 'فرق'} hint={wizardBalanced ? `${fmt(wizardDebit)} / ${fmt(wizardCredit)}` : `${fmt(Math.abs(wizardDebit - wizardCredit))}`} icon={wizardBalanced ? CheckCircle2 : AlertTriangle} iconClass={wizardBalanced ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'} />
            <KPICard title="قيد الإقفال" value={wizardClosingEntry ? 'مرحّل' : 'غير منشأ'} hint={wizardClosingEntry ? wizardClosingEntry.entryNumber : 'الخطوة الثانية أدناه'} icon={ArrowLeftRight} iconClass={wizardClosingEntry ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-700/50 text-slate-300'} />
            <KPICard title="حالة السنة" value={periodStatusLabel[wizardPeriod.status]} hint={wizardYearClosed ? 'الترحيل موقوف' : 'مؤهلة للترحيل'} icon={wizardYearClosed ? Lock : Unlock} iconClass={wizardYearClosed ? 'bg-sky-500/15 text-sky-400' : 'bg-emerald-500/15 text-emerald-400'} />
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
                  <Coins className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">معالج الإقفال السنوي وتدوير الأرصدة</h3>
                  <p className="text-xs text-slate-400">أربع خطوات متسلسلة: ميزان المراجعة ← قيد الإقفال ← التدوير ← قفل السنة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedYearWizard(prev => Math.max(Math.min(Number(prev) - 1, 2100), 2000).toString())}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-700 text-slate-400 hover:border-sky-400 hover:text-white transition-all cursor-pointer"
                  title="السنة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/70 text-white font-mono font-black text-sm">{selectedYearWizard}</span>
                <button
                  type="button"
                  onClick={() => setSelectedYearWizard(prev => Math.min(Math.max(Number(prev) + 1, 2000), 2100).toString())}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-700 text-slate-400 hover:border-sky-400 hover:text-white transition-all cursor-pointer"
                  title="السنة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* الخطوة 1: ميزان المراجعة */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
                  {stepBadge(1)}
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">ميزان المراجعة ومطابقة الحسابات</div>
                    <p className="text-xs text-slate-400">عرض أرصدة حسابات السنة {selectedYearWizard} والتحقق من التوازن</p>
                  </div>
                  {wizardBalanced ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><CheckCircle2 className="w-3.5 h-3.5" />متوازن</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30"><AlertTriangle className="w-3.5 h-3.5" />فرق {fmt(Math.abs(wizardDebit - wizardCredit))}</span>
                  )}
                </div>
                {wizardTrial.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-bold">لا توجد أرصدة في حسابات السنة {selectedYearWizard} — سجّل قيوداً ثم راجعها هنا</div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar max-h-72">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-800/60 text-slate-300 font-bold border-b border-slate-700 sticky top-0">
                        <tr>
                          <th className="py-2 px-4">الكود</th>
                          <th className="py-2 px-4">الحساب</th>
                          <th className="py-2 px-4">التصنيف</th>
                          <th className="py-2 px-4 text-left">المدين</th>
                          <th className="py-2 px-4 text-left">الدائن</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {wizardTrial.map(row => (
                          <tr key={row.acc.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 px-4 font-mono font-bold text-sky-400">{row.acc.code}</td>
                            <td className="py-2 px-4 font-bold text-white">{row.acc.nameAr}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                row.type === 'REVENUE' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : row.type === 'EXPENSE' ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                  : 'bg-slate-700/50 text-slate-300 border-slate-600/60'
                              }`}>
                                {row.type === 'REVENUE' ? 'إيراد' : row.type === 'EXPENSE' ? 'مصروف' : 'ميزانية'}
                              </span>
                            </td>
                            <td className="py-2 px-4 font-mono text-emerald-300 text-left">{row.net > 0 ? fmt(row.net) : '—'}</td>
                            <td className="py-2 px-4 font-mono text-sky-300 text-left">{row.net < 0 ? fmt(Math.abs(row.net)) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <CurrencyRevaluationPanel
                year={selectedYearWizard}
                accounts={accounts}
                journals={journals}
                currencies={currencies}
                currentUserName={currentUserName}
                onCreateJournal={onCreateRevaluationJournal}
              />

              {/* الخطوة 2: قيد الإقفال */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
                  {stepBadge(2)}
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">توليد قيد إقفال الأرباح والخسائر</div>
                    <p className="text-xs text-slate-400">نقل صافي النتيجة من الإيرادات والمصروفات إلى الأرباح المبقاة</p>
                  </div>
                  {wizardClosingEntry ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30"><FileText className="w-3.5 h-3.5" />مرحّل {wizardClosingEntry.entryNumber}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600"><FileText className="w-3.5 h-3.5" />يُرحّل مع الإقفال النهائي</span>
                  )}
                </div>
                {wizardCloseReason && !wizardClosingEntry && (
                  <div className="flex items-start gap-2 mx-4 mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{wizardCloseReason}</span>
                  </div>
                )}
                {wizardPreview && !wizardClosingEntry ? (
                  <div className="p-4">
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
                      <div className="flex items-center justify-between font-bold text-sky-300 mb-2">
                        <span className="flex items-center gap-1.5"><ArrowLeftRight className="w-4 h-4" />قيد الإقفال المتوقع ({wizardPreview.lines.length} سطر)</span>
                        <span className="font-mono">صافي النتيجة {fmt(wizardPreview.totalDebit - wizardPreview.totalCredit)}</span>
                      </div>
                      <div className="divide-y divide-sky-500/10">
                        {wizardPreview.lines.slice(0, 8).map(line => (
                          <div key={line.id} className="flex items-center justify-between py-1">
                            <span className="text-slate-300 truncate">{line.accountCode} — {line.accountNameAr}</span>
                            <span className="font-mono font-bold text-white whitespace-nowrap">{line.debit > 0 ? `مدين ${fmt(line.debit)}` : ''} {line.credit > 0 ? `دائن ${fmt(line.credit)}` : ''}</span>
                          </div>
                        ))}
                        {wizardPreview.lines.length > 8 && <div className="py-1 text-slate-400 font-bold">+{wizardPreview.lines.length - 8} سطر إضافي</div>}
                      </div>
                    </div>
                  </div>
                ) : wizardClosingEntry ? (
                  <div className="p-4 text-xs text-slate-300 font-bold">تم إنشاء وترحيل قيد الإقفال {wizardClosingEntry.entryNumber} بتاريخ {wizardClosingEntry.date}.</div>
                ) : null}
              </div>

              {/* الخطوة 3: تدوير الأرصدة */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
                  {stepBadge(3)}
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">تدوير أرصدة الميزانية للسنة الجديدة</div>
                    <p className="text-xs text-slate-400">توليد القيد الافتتاحي لسنة {Number(selectedYearWizard) + 1} من أرصدة الميزانية</p>
                  </div>
                  {wizardOpeningEntry ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30"><FileText className="w-3.5 h-3.5" />مرحّل {wizardOpeningEntry.entryNumber}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRollover(true)}
                      disabled={!wizardBalanced || !wizardFinalClosed}
                      title={!wizardFinalClosed ? 'الإقفال النهائي مطلوب قبل التدوير' : wizardBalanced ? 'توليد القيد الافتتاحي' : 'الميزانية غير متوازنة — لا يمكن التدوير'}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Database className="w-3.5 h-3.5" />
                      توليد القيد الافتتاحي للسنة {Number(selectedYearWizard) + 1}
                    </button>
                  )}
                </div>
                <div className="p-4 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 m-4 text-xs text-slate-300">
                  <ArrowLeftRight className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <span>
                    تُدحر الأرصدة المدينة والدائنة لحسابات الميزانية (الأصول والخصوم وحقوق الملكية) إلى قيد افتتاحي بتاريخ
                    01/01/{Number(selectedYearWizard) + 1}، بينما تُقفل حسابات الإيرادات والمصروفات في الخطوة الثانية. يُرفض التدوير إذا كانت الميزانية غير متوازنة.
                  </span>
                </div>
              </div>

              {/* الخطوة 4: قفل السنة */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
                  {stepBadge(4)}
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">دورة اعتماد إقفال السنة</div>
                    <p className="text-xs text-slate-400">إقفال مؤقت ← مراجعة معتمدة ← إقفال نهائي للسنة {selectedYearWizard}</p>
                  </div>
                  {wizardFinalClosed ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReopen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      طلب إعادة فتح نهائي
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30"><Lock className="w-3.5 h-3.5" />{periodStatusLabel[wizardPeriod.status]}</span>
                  )}
                </div>
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-300 max-w-xl">
                    {wizardFinalClosed
                      ? 'تم الإقفال النهائي. إعادة الفتح تتطلب سبباً ومعتمداً مستقلاً وتُنشئ قيداً عكسياً لقيد الإقفال.'
                      : `الحالة الحالية: ${periodStatusLabel[wizardPeriod.status]}. نفّذ المرحلة التالية بعد استكمال مراجعتها.`}
                  </p>
                  {!wizardFinalClosed && wizardNextStatus && (
                    <button
                      type="button"
                      onClick={() => setConfirmClose(true)}
                      disabled={!!wizardCloseReason}
                      title={wizardCloseReason || 'قفل السنة المالية'}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      {wizardNextStatus === 'TEMP_CLOSED' ? 'إقفال مؤقت' : wizardNextStatus === 'REVIEWED' ? 'اعتماد المراجعة' : 'إقفال نهائي'} — {selectedYearWizard}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="إجمالي الأحداث" value={`${auditLogs.length}`} hint="سجل التدقيق الكامل" icon={History} iconClass="bg-sky-500/15 text-sky-400" />
            <KPICard title="ترحيل" value={`${auditLogs.filter(l => l.action === 'POST').length}`} hint="عمليات ترحيل" icon={Send} iconClass="bg-emerald-500/15 text-emerald-400" />
            <KPICard title="إقفال وفتح" value={`${auditLogs.filter(l => l.details?.includes('إقفال') || l.details?.includes('فتح')).length}`} hint="شهرية وسنوية" icon={Lock} iconClass="bg-sky-500/15 text-sky-400" />
            <KPICard title="القيود العكسية" value={`${journals.filter(j => j.reversalOfEntryId).length}`} hint="مرتبطة بالأصل" icon={RotateCcw} iconClass="bg-amber-500/15 text-amber-400" />
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
                  <History className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">سجل الرقابة وتدقيق العمليات</h3>
                  <p className="text-xs text-slate-400">من قام بماذا ومتى — ترحيل، إقفال، تدوير أرصدة، إلغاء بصلاحية خاصة</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'GENERAL_LEDGER', 'PAYMENT_VOUCHERS', 'RECEIPT_VOUCHERS'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAuditModule(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${auditModule === m ? chipActive : chipIdle}`}
                  >
                    {m === 'ALL' ? 'الكل' : auditModuleLabels[m]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={exportAudit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير CSV
                </button>
              </div>
            </div>

            {filteredAudits.length === 0 ? (
              <EmptyState
                icon={<History className="w-7 h-7 text-sky-400" />}
                title="لا توجد أحداث تدقيق"
                description="ستُسجل هنا جميع عمليات الترحيل والإقفال والتدوير تلقائياً."
              />
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-800/60 text-slate-300 font-bold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">التاريخ والوقت</th>
                      <th className="py-3 px-4">الوحدة</th>
                      <th className="py-3 px-4">المستخدم</th>
                      <th className="py-3 px-4 text-center">العملية</th>
                      <th className="py-3 px-4">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAudits.map(log => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            log.module === 'GENERAL_LEDGER'
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                              : log.module === 'PAYMENT_VOUCHERS'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {auditModuleLabels[log.module] ?? log.module}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-white">{log.userName}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black ${
                            log.action === 'POST' ? 'bg-emerald-500/15 text-emerald-300'
                              : log.action === 'DELETE' ? 'bg-red-500/15 text-red-300'
                              : log.action === 'CREATE' ? 'bg-sky-500/15 text-sky-300'
                              : 'bg-slate-700/50 text-slate-300'
                          }`}>
                            {log.action === 'POST' ? 'ترحيل' : log.action === 'DELETE' ? 'إلغاء' : log.action === 'CREATE' ? 'إنشاء' : log.action === 'VOID' ? 'إبطال' : 'تحديث'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 max-w-[420px] truncate">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </ModalShell>

      {confirmMonth && (
        <ModalShell
          id="closing-month-confirm"
          open={!!confirmMonth}
          onClose={() => setConfirmMonth(null)}
          title={`تغيير حالة الشهر المالي ${confirmMonth}`}
          icon={Lock}
          size="sm"
          className="border-sky-500/30"
          closeOnBackdrop={false}
          bodyClassName="p-6 space-y-3"
          footer={
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button type="button" onClick={() => setConfirmMonth(null)} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => { const done = onCloseMonth(confirmMonth!); setConfirmMonth(null); toast(done ? 'success' : 'error', done ? `تم اعتماد المرحلة التالية للشهر ${confirmMonth}` : `تعذر تغيير حالة الشهر ${confirmMonth}`); }}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                اعتماد المرحلة التالية
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            سيتم نقل الشهر المالي {confirmMonth} إلى المرحلة التالية في دورة الإقفال، مع حفظ المنفذ والتوقيت في سجل تاريخ الفترة.
          </p>
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>تأكد من ترحيل جميع المستندات المنتظرة قبل الإقفال — القيود غير المرحلة تمنع إقفال الشهر تلقائياً.</span>
          </div>
        </ModalShell>
      )}

      {confirmReopenMonth && (
        <ModalShell
          id="closing-month-reopen"
          open={!!confirmReopenMonth}
          onClose={() => setConfirmReopenMonth(null)}
          title={`إعادة فتح الشهر المالي ${confirmReopenMonth}`}
          icon={Unlock}
          size="sm"
          className="border-amber-500/30"
          closeOnBackdrop={false}
          bodyClassName="p-6 space-y-3"
          footer={
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button type="button" onClick={() => setConfirmReopenMonth(null)} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => { const done = onReopenMonth(confirmReopenMonth!, { reason: reopenReason, approvedBy: reopenApprover || undefined }); if (done) setConfirmReopenMonth(null); toast(done ? 'success' : 'error', done ? `تم إعادة فتح الشهر المالي ${confirmReopenMonth}` : 'بيانات إعادة الفتح غير مكتملة أو الاعتماد غير مستقل'); }}
                className="flex items-center gap-2 px-5 py-2 border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl text-sm font-bold cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                تأكيد إعادة الفتح
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            سيتم إعادة فتح الشهر المالي {confirmReopenMonth} والسماح بالترحيل عليه من جديد.
          </p>
          <input value={reopenReason} onChange={e => setReopenReason(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          <input value={reopenApprover} onChange={e => setReopenApprover(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
        </ModalShell>
      )}

      {confirmUnpost && (
        <ModalShell
          id="closing-unpost-confirm"
          open={confirmUnpost}
          onClose={() => { setConfirmUnpost(false); setUnpostManagerOk(false); }}
          title="عكس المستندات المحددة"
          icon={ShieldCheck}
          size="sm"
          className="border-amber-500/30"
          closeOnBackdrop={false}
          bodyClassName="p-6 space-y-3"
          footer={
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button type="button" onClick={() => { setConfirmUnpost(false); setUnpostManagerOk(false); }} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleUnpost}
                disabled={!unpostManagerOk}
                className="flex items-center gap-2 px-5 py-2 border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 rounded-xl text-sm font-bold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                إنشاء قيود عكسية ({selectedUnpostRows.length} مستند)
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            سيُنشأ قيد عكسي مستقل ومرتبط لكل واحد من <b className="text-white">{selectedUnpostRows.length}</b> مستند، وسيبقى القيد الأصلي مُرحّلاً وغير قابل للتعديل.
          </p>
          <label className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={unpostManagerOk}
              onChange={e => setUnpostManagerOk(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-500 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>أؤكد أنني مدير النظام وأمتلك صلاحية إنشاء القيود العكسية — وسيُسجل هذا الإجراء في سجل التدقيق.</span>
          </label>
        </ModalShell>
      )}

      {confirmClose && (
        <ModalShell
          id="closing-confirm"
          open={!!confirmClose}
          onClose={() => setConfirmClose(false)}
          title={`اعتماد مرحلة إقفال السنة ${selectedYearWizard}`}
          icon={Lock}
          size="sm"
          className="border-sky-500/30"
          closeOnBackdrop={false}
          bodyClassName="p-6 space-y-3"
          footer={
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button type="button" onClick={() => setConfirmClose(false)} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const entry = wizardNextStatus === 'FINAL_CLOSED' ? buildClosingEntry(selectedYearWizard) : null;
                  const done = onCloseYear(selectedYearWizard, entry);
                  if (done) setConfirmClose(false);
                  toast(done ? 'success' : 'error', done ? `تم نقل السنة ${selectedYearWizard} إلى ${wizardNextStatus ? periodStatusLabel[wizardNextStatus] : 'المرحلة التالية'}` : `تعذر تغيير حالة السنة ${selectedYearWizard}`);
                }}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                اعتماد المرحلة
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            سيتم نقل السنة المالية {selectedYearWizard} من {periodStatusLabel[wizardPeriod.status]} إلى {wizardNextStatus ? periodStatusLabel[wizardNextStatus] : 'الحالة التالية'}.
            {wizardNextStatus === 'FINAL_CLOSED' && wizardPreview
              ? ` سيتم أيضاً ترحيل قيد إقفال (${wizardPreview.lines.length} سطر) ينقل صافي النتيجة ${fmt(wizardPreview.totalDebit - wizardPreview.totalCredit)} إلى الأرباح المبقاة.`
              : ' لا توجد أرصدة إيرادات أو مصروفات لترحيلها في هذه السنة.'}
          </p>
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>لا يمكن ترحيل أو تعديل قيود جديدة في السنة المغلقة إلا بعد إعادة فتحها من هنا.</span>
          </div>
        </ModalShell>
      )}

      {confirmReopen && (
        <ModalShell
          id="closing-reopen"
          open={!!confirmReopen}
          onClose={() => setConfirmReopen(false)}
          title={`إعادة فتح السنة ${selectedYearWizard}`}
          icon={Unlock}
          size="sm"
          className="border-amber-500/30"
          closeOnBackdrop={false}
          bodyClassName="p-6 space-y-3"
          footer={
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button type="button" onClick={() => setConfirmReopen(false)} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const done = onReopenYear(selectedYearWizard, { reason: reopenReason, approvedBy: reopenApprover || undefined });
                  if (done) setConfirmReopen(false);
                  toast(done ? 'success' : 'error', done ? `تم إعادة فتح السنة المالية ${selectedYearWizard} وإنشاء القيد العكسي المرتبط` : 'تتطلب إعادة الفتح النهائية سبباً ومعتمداً مستقلاً عن المنفذ');
                }}
                className="flex items-center gap-2 px-5 py-2 border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl text-sm font-bold cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                تأكيد إعادة الفتح
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            ستُعاد السنة المالية {selectedYearWizard} إلى الحالة المفتوحة، وسيبقى قيد الإقفال الأصلي مرحّلاً مع إنشاء قيد عكسي مرتبط عند وجوده.
          </p>
          <input value={reopenReason} onChange={e => setReopenReason(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          <input value={reopenApprover} onChange={e => setReopenApprover(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>يُسجل هذا الإجراء في سجل التدقيق. تأكد من صحة الأرصدة قبل إعادة الفتح.</span>
          </div>
        </ModalShell>
      )}

      {confirmRollover && (
        <ModalShell
          id="closing-rollover-confirm"
          open={confirmRollover}
          onClose={() => setConfirmRollover(false)}
          title={`توليد القيد الافتتاحي للسنة ${Number(selectedYearWizard) + 1}`}
          icon={Database}
          size="sm"
          className="border-sky-500/30"
          closeOnBackdrop={false}
          bodyClassName="p-6 space-y-3"
          footer={
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button type="button" onClick={() => setConfirmRollover(false)} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const done = onCreateOpeningEntry(selectedYearWizard);
                  if (done) setConfirmRollover(false);
                  toast(done ? 'success' : 'error', done ? `تم توليد القيد الافتتاحي للسنة ${Number(selectedYearWizard) + 1}` : 'تعذر التدوير: تحقق من الإقفال النهائي والتوازن وعدم وجود قيد سابق');
                }}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Database className="w-4 h-4" />
                توليد القيد الافتتاحي
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            سيتم تدوير أرصدة حسابات الميزانية (الأصول والخصوم وحقوق الملكية) للسنة {selectedYearWizard} إلى
            قيد افتتاحي بتاريخ 01/01/{Number(selectedYearWizard) + 1}. إذا تبين فرق غير متوازن، تُسوّى عبر حساب الأرباح المبقاة.
          </p>
          <div className="flex items-start gap-2 rounded-xl bg-sky-500/5 border border-sky-500/20 p-3 text-xs text-sky-300">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>يُنشأ القيد مرة واحدة فقط — أي محاولة تكرار تُرفض ويُسجل ذلك في سجل التدقيق.</span>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
