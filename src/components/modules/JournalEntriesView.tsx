import React, { useState, useEffect, useMemo, useRef } from'react';
import { JournalEntry, JournalLine, Account, CostCenter, AuditLog, Currency, Employee, Customer, Vendor, CashBox, BankAccount, SubLedgerType} from'../../types/erp';
import { validateJournalEntryLines, nextJournalNumber, leafAccounts } from'../../utils/accountingEngine';
import { validateSubLedgerLines, SubLedgerDataset, subLedgerTypeOf } from'../../utils/subLedger';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useExchangeRateGuard } from '../../hooks/useExchangeRateGuard';
import { BookOpen, Plus, Trash2, CheckCircle2, AlertTriangle, FileText, Pencil, RotateCcw, Keyboard, X, Printer, Download} from'lucide-react';
import PageHeader from'../ui/PageHeader';
import F9SearchInput from'../ui/F9SearchInput';
import JournalSearchBar from'./JournalSearchBar';
import ModalShell from'../ui/ModalShell';
import { useModalStackStatus } from '../ui/ModalStack';
import { useMaximizableWindow, WindowControls, HiddenWindowBar } from'../ui/MaximizableWindow';
import SubLedgerF9Cell from'../ui/SubLedgerF9Cell';
import LineNarrationField from'../ui/LineNarrationField';
import ExchangeRateField from '../ui/ExchangeRateField';
import { useToast } from '../ui/Toast';
import AmountInput from'../AmountInput';
import { useTabDirty } from'../../tabs/TabsContext';
import { handleCurrencyFieldChange } from '../../utils/currencyMath';
import { isPeriodClosed, CLOSED_PERIOD_MESSAGE } from '../../utils/periodGuard';
import SmartDateInput, { smartDateToIso, todayIso } from '../common/SmartDateInput';
import VoucherPrintTemplate from '../ui/VoucherPrintTemplate';
import AttachmentPicker from '../ui/AttachmentPicker';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { openDesktopPrintPreview } from '../../utils/desktopPrintPreview';
import { replacementJournal } from '../../utils/supportingDocuments';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

interface Props {
 journals: JournalEntry[];
 accounts: Account[];
 cashBoxes: CashBox[];
 bankAccounts: BankAccount[];
 employees: Employee[];
 customers: Customer[];
 vendors: Vendor[];
 costCenters: CostCenter[];
 currencies: Currency[];
   onAddJournal: (entry: JournalEntry) => void;
   onUpdateJournal: (id: string, entry: JournalEntry) => void;
  onVoidJournal: (id: string) => void;
  onRestoreJournal: (id: string) => void;
  currentUserName: string;
  closedYears?: string[];
  closedMonths?: string[];
  /** صلاحية تجاوز الحدود المعتمدة لسعر التحويل (CAN_OVERRIDE_EXCHANGE_LIMITS) */
  canOverrideExchangeLimits?: boolean;
  /** تسجيل تحذيري في سجل التدقيق عند تجاوز حدود سعر الصرف بصلاحية خاصة */
  onAuditLog?: (details: string) => void;
}

export default function JournalEntriesView({ journals, accounts, cashBoxes, bankAccounts, employees, customers, vendors, costCenters, currencies, onAddJournal, onUpdateJournal, onVoidJournal, onRestoreJournal, currentUserName, closedYears, closedMonths, canOverrideExchangeLimits, onAuditLog }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalExpanded, setIsModalExpanded] = useState(false);
  // القيد قيد التعديل — عند تعيينه تُعبَّأ النافذة ببياناته ويصبح الحفظ تحديثاً
  const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
  // القيد النشط المعروض على الشاشة — يُحدد حصرياً من شريط البحث F9
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Print & PDF state
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printablePaperRef = useRef<HTMLDivElement>(null);
  const handlePrintPreview = () => openDesktopPrintPreview(printablePaperRef.current, `قيد يومية ${selectedEntryId || ''}`, 'portrait');

  // علامة "تعديلات غير محفوظة" على تبويب قيود اليومية
  const setDirty = useTabDirty('JOURNAL_ENTRIES');

  const { isMaximized, mode, toggleMaximize, hide, restore } = useMaximizableWindow();

  const { active: currencyOptions, baseCode } = useActiveCurrencies(currencies);

  // واقي حدود سعر التحويل: نطاق كل عملة (min/max) من دليل العملات
  const rateGuard = useExchangeRateGuard(currencies);
  const toast = useToast();
  const modalStatus = useModalStackStatus('journal-entry-form');

 // New Journal Form State
  const [entryDate, setEntryDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [attachments, setAttachments] = useState<SupportingDocument[]>([]);

  // الرقم التسلسلي التالي للقيد اليومي — يُولّد تلقائياً ويظهر في شاشة الإضافة
  const nextJournalNo = nextJournalNumber(journals);

  // كل حسابات المستوى الخامس (Leaf) النشطة في كل فئات الدليل — بحث F9
  // بلا أي فلترة مقيدة (أصول/خصوم/حقوق ملكية/إيرادات/مصروفات) مرتبة بالكود.
  const analyticalAccounts = useMemo(() => leafAccounts(accounts), [accounts]);

  const [lines, setLines] = useState<Array<{
  id: string;
  controlId: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string;
  costCenterId: string;
  subLedgerType?: SubLedgerType;
  subLedgerId?: string;
  subLedgerName?: string;
  currency: string;
  exchangeRate: number;
  referenceNumber: string;
  codeFilter?: string;
  }>>([
  { id:'1', accountId:'', controlId: '', debit: 0, credit: 0, description:'', costCenterId:'', currency: baseCode, exchangeRate: 1, referenceNumber:''},
  { id:'2', accountId:'', controlId: '', debit: 0, credit: 0, description:'', costCenterId:'', currency: baseCode, exchangeRate: 1, referenceNumber:''},
  ]);

  useEffect(() => {
    const hasContent =
      reference.trim() !== '' ||
      narration.trim() !== '' ||
      lines.some(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    setDirty(isModalOpen && hasContent);
  }, [isModalOpen, reference, narration, lines, setDirty]);

  const subLedgerDataset: SubLedgerDataset = { accounts, employees, customers, vendors, cashBoxes, banks: bankAccounts, costCenters };

  const [subLedgerError, setSubLedgerError] = useState('');

  const handleAccountCode = (lineId: string, code: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const trimmed = code.trim();
      const match = analyticalAccounts.find(a => a.code === trimmed);
      const next = { ...l, codeFilter: code };
      if (match) {
        next.accountId = match.id;
        next.subLedgerId = '';
        next.subLedgerName = '';
        next.subLedgerType = subLedgerTypeOf(match, subLedgerDataset);
      } else if (trimmed === '') {
        next.accountId = '';
        next.subLedgerId = '';
        next.subLedgerName = '';
      }
      return next;
    }));
  };

  const selectAccount = (lineId: string, acc: Account) => {
    setLines(prev => prev.map(l => (l.id === lineId ? {
      ...l,
      codeFilter: acc.code,
      accountId: acc.id,
      controlId: '',
      subLedgerId: '',
      subLedgerName: '',
      subLedgerType: subLedgerTypeOf(acc, subLedgerDataset),
    } : l)));
  };

  const changeLineCurrency = (lineId: string, code: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const found = currencyOptions.find(c => c.code === code);
      return {
        ...l,
        currency: code,
        // العملة الأساسية: سعر الصرف مقفل عند 1 والمبالغ محلية مباشرة
        exchangeRate: code === baseCode ? 1 : (found && found.exchangeRate > 0 ? found.exchangeRate : 1),
      };
    }));
  };

  /**
   * تغيير سعر التحويل لعملة أجنبية — يُعيد حساب المحلي فورياً:
   * المحلي الجديد = الأجنبي المخزّن × السعر الجديد (الأجنبي ثابت كمرجع).
   * العملة الأساسية لا تقبل تعديل السعر (مقفلة عند 1).
   */
  const changeLineRate = (lineId: string, raw: string) => {
    const rate = Math.max(0, Number(raw)) || 0;
    setLines(prev => prev.map(l => {
      if (l.id !== lineId || l.currency === baseCode) return l;
      const oldRate = Number(l.exchangeRate) || 1;
      const foreignDebit = l.debit > 0 ? l.debit / oldRate : 0;
      const foreignCredit = l.credit > 0 ? l.credit / oldRate : 0;
      return {
        ...l,
        exchangeRate: rate,
        debit: rate > 0 ? round2(foreignDebit * rate) : l.debit,
        credit: rate > 0 ? round2(foreignCredit * rate) : l.credit,
      };
    }));
  };

  const updateLineAmount = (lineId: string, side: 'debit' | 'credit', raw: string, source: 'local' | 'foreign') => {
    const val = Number(raw) || 0;
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const rate = Number(l.exchangeRate) || 1;
      const updated = { ...l };
      if (source === 'foreign') {
        // المحلي = الأجنبي × سعر التحويل (حساب فوري تفاعلي)
        const next = handleCurrencyFieldChange('foreign', val, {
          foreignAmount: val,
          exchangeRate: rate,
          localAmount: Number(l[side]) || 0,
        });
        updated[side] = round2(next.localAmount);
      } else {
       updated[side] = round2(val);
      }
      if (val > 0) {
        updated[side === 'debit' ? 'credit' : 'debit'] = 0;
      }
      return updated;
    }));
  };

  const validation = validateJournalEntryLines(lines, accounts);

 // حجب زر الحفظ عند وجود أي سطر بعملة أجنبية سعره خارج النطاق المسموح [min..max]
 const rateBlocked = lines.some(l => l.currency !== baseCode && rateGuard.outOfBounds(Number(l.exchangeRate) || 0, l.currency));

  const addLine = () => {
  setLines(prev => [
  ...prev,
  {
  id: Date.now().toString(),
  accountId: '',
  controlId: '',
  debit: 0,
  credit: 0,
  description: narration,
  costCenterId:'',
  subLedgerId:'',
  subLedgerName:'',
  currency: baseCode,
  exchangeRate: 1,
  referenceNumber:''
  }
  ]);
};

 const removeLine = (id: string) => {
 if (lines.length <= 2) return;
 setLines(prev => prev.filter(l => l.id !== id));
};

 const updateLine = (id: string, field: string, value: any) => {
 setLines(prev => prev.map(l => {
 if (l.id === id) {
 const updated = { ...l, [field]: value};
 // Clear opposite amount if one is typed
 if (field ==='debit' && Number(value) > 0) updated.credit = 0;
 if (field ==='credit' && Number(value) > 0) updated.debit = 0;
 return updated;
}
 return l;
}));
};

  /**
   * بوابة حدود سعر التحويل (حفظ):
   * تعيد false وتمنع الحفظ عند خروج أي سطر عن النطاق [min_rate..max_rate] لعملته.
   * تحقق إلزامي صارم — لا تجاوز بالصلاحية، والإشعار عبر Toast.
   */
  const enforceRateBoundaries = (): boolean => {
    const violations = lines
      .filter(l => l.currency !== baseCode)
      .map(l => rateGuard.violationOf(Number(l.exchangeRate) || 0, l.currency))
      .filter((m): m is string => Boolean(m));

    if (violations.length === 0) return true;
    toast('error', violations.join('\n'));
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validation.isValid) return;

  // قيد مرحّل لا يُعدَّل مباشرة — يجب إلغاء ترحيله أولاً حفاظاً على سلامة الدفاتر
  if (editingJournal && editingJournal.status === 'POSTED') {
    toast('error', 'لا يمكن تعديل قيد مرحّل. ألغِ ترحيله أولاً من شاشة «الإقفالات والترحيل» ثم عدّله.');
    return;
  }

  // حماية الفترات المغلقة: منع إنشاء/تعديل قيد بتاريخ داخل سنة أو شهر مقفل
  const saveDateIso = smartDateToIso(entryDate);
  if (isPeriodClosed(saveDateIso, closedYears, closedMonths)) {
    toast('error', CLOSED_PERIOD_MESSAGE);
    return;
  }

  // التحقق الموحد من الحسابات المساعدة قبل الحفظ (بأرقام الأسطر)
  const slCheck = validateSubLedgerLines(lines, accounts, subLedgerDataset);
  if (!slCheck.valid) {
    setSubLedgerError(slCheck.message || 'يرجى تحديد الحساب المساعد للسطر المطلوب.');
    return;
  }
  setSubLedgerError('');

  // بوابة حدود سعر التحويل: منع الحفظ عند خروج أي سطر بعملة أجنبية عن النطاق المسموح
  if (!enforceRateBoundaries()) return;

  const formattedLines: JournalLine[] = lines.map((l, index) => {
  const acc = accounts.find(a => a.id === l.accountId);
  const slType = subLedgerTypeOf(acc, subLedgerDataset);
  const lineCurrency = l.currency || baseCode;
  const lineRate = l.exchangeRate || 1;
  const isForeign = lineCurrency !== baseCode && lineRate > 0;
  return {
  id: editingJournal && l.id ? l.id : `jl-${index}-${Date.now()}`,
  accountId: l.accountId,
  accountCode: acc?.code ||'',
  accountNameAr: acc?.nameAr ||'',
  debit: Number(l.debit) || 0,
  credit: Number(l.credit) || 0,
  description: l.description || narration,
  costCenterId: l.costCenterId || undefined,
  subLedgerType: slType,
  subLedgerId: slType !== 'NONE' ? l.subLedgerId : undefined,
  subLedgerName: slType !== 'NONE' ? l.subLedgerName : undefined,
  referenceNumber: l.referenceNumber || undefined,
  currency: lineCurrency,
  exchangeRate: lineRate,
  rateType: 'TRANSACTION',
  rateEffectiveDate: saveDateIso,
  rateSource: 'MANUAL_ENTRY',
  debitForeign: isForeign && Number(l.debit) > 0 ? round2(Number(l.debit) / lineRate) : undefined,
  creditForeign: isForeign && Number(l.credit) > 0 ? round2(Number(l.credit) / lineRate) : undefined
};
});

   const newEntry: JournalEntry = {
 id: editingJournal?.id ?? `je-${Date.now()}`,
 entryNumber: editingJournal?.entryNumber ?? nextJournalNumber(journals),
 date: entryDate,
 reference,
   narration,
   currency: baseCode,
   exchangeRate: 1,
   rateType: 'TRANSACTION',
   rateEffectiveDate: saveDateIso,
   rateSource: 'MANUAL_ENTRY',
   status: 'PENDING_POSTING', // يُحفظ بانتظار الترحيل من شاشة «الإقفالات والترحيل والرقابة»
   type: 'JV', // قيد يومية يدوي أصلي (يستبعد من سندات الصرف والقبض الآلية)
 sourceType: 'MANUAL',
 attachments,
   referenceCode: reference || undefined,
  totalDebit: validation.totalDebit,
  totalCredit: validation.totalCredit,
  createdBy: editingJournal?.createdBy ?? currentUserName,
  createdAt: editingJournal?.createdAt ?? new Date().toISOString(),
  lines: formattedLines
 };

 if (editingJournal) {
  onUpdateJournal(editingJournal.id, newEntry);
 } else {
  onAddJournal(newEntry);
 }
 // عرض القيد المحفوظ/المعدّل مباشرة في الواجهة الرئيسية
 setSelectedEntryId(newEntry.id);
 closeJournalModal();

 // Reset form
 setReference('');
 setNarration('');
 setAttachments([]);
  setLines([
  { id:'1', accountId:'', controlId: '', debit: 0, credit: 0, description:'', costCenterId:'', currency: baseCode, exchangeRate: 1, referenceNumber:''},
  { id:'2', accountId:'', controlId: '', debit: 0, credit: 0, description:'', costCenterId:'', currency: baseCode, exchangeRate: 1, referenceNumber:''},
  ]);
};

  /** فتح نافذة تعديل قيد يومية — تعبئة النموذج ببيانات القيد الحالية */
  const openEditJournal = (journal: JournalEntry) => {
    if (modalStatus.isRegistered && modalStatus.isMinimized) {
      modalStatus.restore();
      return;
    }
    if (modalStatus.isRegistered) {
      modalStatus.raise();
      return;
    }
    setEditingJournal(journal);
    setEntryDate(journal.date);
    setReference(journal.reference || '');
    setNarration(journal.narration || '');
    setAttachments(journal.attachments || []);
    setSubLedgerError('');
    setLines(
      (journal.lines.length > 0 ? journal.lines : []).map(l => ({
        id: l.id,
        controlId: '',
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description,
        costCenterId: l.costCenterId || '',
        subLedgerType: l.subLedgerType,
        subLedgerId: l.subLedgerId,
        subLedgerName: l.subLedgerName,
        currency: l.currency || baseCode,
        exchangeRate: l.exchangeRate || 1,
        referenceNumber: l.referenceNumber || ''
      }))
    );
    setIsModalOpen(true);
  };

  /** إغلاق نافذة القيد مع تصفية وضع التعديل */
  const closeJournalModal = () => {
    setIsModalOpen(false);
    setEditingJournal(null);
  };

 /** تحديد ما إذا كان القيد مولّداً آلياً من سند صرف (PV) أو سند قبض (RV) — يُستبعد من دفتر القيود اليدوية */
 const isVoucherGeneratedEntry = (entry: JournalEntry): boolean => {
  // القيود الموسومة حديثاً: وسم المصدر/النوع يحدد المصدر قطعياً
  if (entry.sourceType === 'PAYMENT_VOUCHER' || entry.sourceType === 'RECEIPT_VOUCHER') return true;
  if (entry.type === 'PV' || entry.type === 'RV') return true;
  // البيانات القديمة (قبل إضافة الوسوم): المرجع = رقم السند (PV-… / RV-…)
  const ref = entry.referenceCode ?? entry.reference ?? '';
  return ref.startsWith('PV-') || ref.startsWith('RV-');
 };

 // القيود اليومية اليدوية الأصلية (JV) فقط — يستبعد أي قيد مصدره سند صرف أو سند قبض
 const manualJournalEntries = journals.filter(entry => !isVoucherGeneratedEntry(entry));

 // القيد النشط — يُشتق حياً من الـ journals ليعكس أي تعديل/إلغاء فوراً
 const selectedEntry = selectedEntryId ? journals.find(j => j.id === selectedEntryId) ?? null : null;

 // القيود اليدوية حسب فلتر الحالة — نص البحث يعالجه شريط البحث الداخلي (قائمة الإكمال التلقائي)
 const statusFilteredJournals = manualJournalEntries.filter(j => filterStatus ==='ALL' || j.status === filterStatus);

 const postedCount = manualJournalEntries.filter(j => j.status ==='POSTED').length;
 const pendingCount = manualJournalEntries.filter(j => j.status ==='PENDING_POSTING').length;
 const totalJournalValue = manualJournalEntries.reduce((sum, j) => sum + j.totalDebit, 0);

 /** اختيار قيد من شريط البحث — عرضه وحده في الواجهة الرئيسية */
 const handleSelectJournal = (journal: JournalEntry) => {
  setSelectedEntryId(journal.id);
  setSearchTerm(journal.entryNumber);
 };

 const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
 };

 const handleSavePdf = async () => {
  if (!printablePaperRef.current || pdfBusy) return;
  setPdfBusy(true);
  try {
   const { downloadVoucherPdf, voucherFileName } = await import('../../utils/voucherPdf');
   await downloadVoucherPdf(printablePaperRef.current, voucherFileName('journal-entry', selectedEntry?.entryNumber || 'JV'));
  } catch (err) {
   console.error('PDF generation failed', err);
   alert('تعذر إنشاء ملف PDF.');
  } finally {
   setPdfBusy(false);
  }
 };

 if (mode === 'hidden') {
  return (
  <HiddenWindowBar
  icon={<BookOpen className="w-5 h-5" />}
  title="دفتر القيود اليومية"
  subtitle="محرك قيد مزدوج واضح ومتحقق من التوازن مع متابعة دقيقة للعمليات المحاسبية"
  onRestore={restore}
  />
  );
 }

 return (
 <div data-enter-scope="" className={isMaximized ? 'fixed inset-0 z-[70] bg-slate-950 overflow-y-auto p-6 space-y-6' : 'space-y-6 animate-fade-in'}>
 <PageHeader
 icon={<BookOpen className="w-6 h-6" />}
 title="دفتر القيود اليومية"
 subtitle="محرك قيد مزدوج واضح ومتحقق من التوازن مع متابعة دقيقة للعمليات المحاسبية"
 actions={
 <>
 <WindowControls
 isMaximized={isMaximized}
 onToggleMaximize={toggleMaximize}
 onHide={hide}
 />
  <button
  onClick={() => {
    if (modalStatus.isRegistered && modalStatus.isMinimized) {
      modalStatus.restore();
    } else if (modalStatus.isRegistered) {
      modalStatus.raise();
    } else {
      setIsModalOpen(true);
    }
  }}
  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
  >
  <Plus className="w-4 h-4" />
  إنشاء قيد يومية جديد (JV)
  </button>
 </>
}
 />

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="glass rounded-2xl border border-slate-700/50 bg-slate-900/80 p-4">
  <div className="text-xs text-slate-400">إجمالي القيود اليدوية</div>
  <div className="text-xl font-bold text-white mt-1">{manualJournalEntries.length}</div>
  </div>
 <div className="glass rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
 <div className="text-xs text-emerald-300">قيود مرّحة</div>
 <div className="text-xl font-bold text-white mt-1">{postedCount}</div>
 </div>
 <div className="glass rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
 <div className="text-xs text-sky-300">إجمالي المدين</div>
  <div className="text-xl font-bold text-white mt-1">{totalJournalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
 </div>
 </div>

 {/* Filter and Status Bar */}
 <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
  <JournalSearchBar
  value={searchTerm}
  onChange={setSearchTerm}

  items={statusFilteredJournals}
  onSelect={handleSelectJournal}
  disabled={isModalOpen}
  />

 <div className="flex items-center gap-2">
 {['ALL','POSTED','PENDING_POSTING','VOIDED'].map(st => (
 <button
 key={st}
 onClick={() => setFilterStatus(st)}
 className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${filterStatus === st
 ?'bg-sky-500/15 text-sky-600 border-sky-400 shadow-md'
 :'glass text-slate-300 hover:bg-white/10 border-slate-700/60'
}`}
 >
 {st ==='ALL' &&'جميع القيود'}
 {st ==='POSTED' &&'رحّلت (Posted)'}
 {st ==='PENDING_POSTING' &&'بانتظار الترحيل'}
 {st ==='VOIDED' &&'ملغاة (Voided)'}
 </button>
 ))}
 </div>
 </div>

 {/* عرض القيد المحدد / واجهة البحث — لا قائمة عرض تلقائية */}
 <div className="space-y-4">
 {selectedEntry ? (
  <div key={selectedEntry.id} className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
  <div className="bg-slate-900/70 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
  <div className="flex items-center gap-3">
  <span className="font-mono font-bold text-sky-300 bg-slate-800 px-2.5 py-1 rounded-lg text-sm border border-slate-700">
  {selectedEntry.entryNumber}
  </span>

  <span className="text-slate-400 text-xs font-mono">التاريخ: {selectedEntry.date}</span>

  {selectedEntry.reference && (
  <span className="text-slate-300 text-xs bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700">
  المرجع: {selectedEntry.reference}
  </span>
  )}
  </div>

  <div className="flex items-center gap-3">
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${selectedEntry.status ==='POSTED' ?'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
  selectedEntry.status ==='PENDING_POSTING' ?'bg-amber-500/20 text-amber-300 border-amber-500/30' :
 'bg-slate-800 text-slate-400 border-slate-700'
 }`}>
  {selectedEntry.status ==='POSTED' ?'مُرّحل معتمد' : selectedEntry.status ==='PENDING_POSTING' ?'بانتظار الترحيل' :'ملغى'}
  </span>

   {selectedEntry.status === 'PENDING_POSTING' && (
   <button
   onClick={() => openEditJournal(selectedEntry)}
   className="text-xs text-sky-400 hover:text-sky-300 font-medium hover:underline"
   title="تعديل القيد قبل الترحيل"
   >
   <span className="inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> تعديل</span>
   </button>
   )}

   <button
   onClick={() => setIsPrintOpen(true)}
   className="text-xs text-sky-400 hover:text-sky-300 font-medium hover:underline"
   title="طباعة القيد اليومي"
   >
   <span className="inline-flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> طباعة</span>
   </button>

  {selectedEntry.status ==='POSTED' && (
   <button
   onClick={() => { const reason = prompt('سبب إنشاء مستند بديل للقيد؟'); if (!reason?.trim()) return; const replacement = replacementJournal(selectedEntry, { ...selectedEntry, id: `replacement-${Date.now()}`, entryNumber: nextJournalNumber(journals), status: 'PENDING_POSTING', createdAt: new Date().toISOString(), postedAt: undefined, postedBy: undefined, replacementOfEntryId: selectedEntry.id, replacementReason: reason.trim(), attachments: [] }, currentUserName, reason); onAddJournal(replacement); }}
   className="text-xs text-amber-400 hover:text-amber-300 font-medium hover:underline"
   title="إنشاء مستند بديل مرتبط بالقيد الأصلي"
   >
   مستند بديل
   </button>
   )}

   {selectedEntry.status ==='POSTED' && (
   <button
   onClick={() => confirm(`سيبقى القيد ${selectedEntry.entryNumber} مُرحّلاً وسيُنشأ قيد عكسي مرتبط. متابعة؟`) && onVoidJournal(selectedEntry.id)}
   className="text-xs text-red-400 hover:text-red-300 font-medium hover:underline"
   >
   عكس القيد
   </button>
   )}

   <button
   onClick={() => { setSelectedEntryId(null); setSearchTerm(''); }}
   className="text-xs text-slate-400 hover:text-slate-100 font-medium hover:underline"
   title="مسح الاختيار والعودة إلى واجهة البحث"
   >
   <span className="inline-flex items-center gap-1"><X className="w-3.5 h-3.5" /> مسح الاختيار</span>
   </button>
  </div>
  </div>

  <div className="p-4">
  <p className="text-sm font-semibold text-slate-200 mb-3">البيان الشارح: {selectedEntry.narration}</p>

  {/* Lines Table */}
  <div className="overflow-x-auto border border-slate-800 rounded-2xl">
  <table className="w-full text-right text-xs dir-rtl">
  <thead className="bg-slate-900/60 text-slate-300 font-bold border-b border-slate-800">
  <tr>
   <th className="py-2.5 px-3">رمز الحساب</th>
   <th className="py-2.5 px-3">اسم الحساب المحاسبي</th>
   <th className="py-2.5 px-3">البيان / التفاصيل</th>
   <th className="py-2.5 px-3">مركز التكلفة</th>
   <th className="py-2.5 px-3">رقم المرجع</th>
   <th className="py-2.5 px-3 text-left">مدين (Debit)</th>
   <th className="py-2.5 px-3 text-left">دائن (Credit)</th>
   </tr>
   </thead>
   <tbody className="divide-y divide-slate-800/60">
   {selectedEntry.lines.map(line => (
   <tr key={line.id} className="hover:bg-white/5">
   <td className="py-2 px-3 font-mono font-medium text-sky-400">{line.accountCode}</td>
   <td className="py-2 px-3 font-semibold text-white">{line.accountNameAr}</td>
   <td className="py-2 px-3 text-slate-400">{line.description}</td>
   <td className="py-2 px-3 text-slate-400">
   {line.costCenterId ? (() => {
     const cc = costCenters.find(c => c.id === line.costCenterId);
     return cc ? `${cc.code} — ${cc.nameAr}` : '—';
   })() : '—'}
   </td>
   <td className="py-2 px-3 font-mono text-slate-300">{line.referenceNumber || '—'}</td>
   <td className="py-2 px-3 font-mono font-bold text-emerald-400 text-left">
   {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :'-'}
   </td>
   <td className="py-2 px-3 font-mono font-bold text-sky-400 text-left">
   {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :'-'}
   </td>
   </tr>
   ))}
   </tbody>
    <tfoot className="bg-slate-900/60 font-bold text-white border-t border-slate-800">
    <tr>
    <td colSpan={5} className="py-2.5 px-3 text-left">إجمالي المبالغ:</td>
   <td className="py-2.5 px-3 font-mono text-emerald-400 text-left">
   {selectedEntry.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedEntry.currency}
   </td>
   <td className="py-2.5 px-3 font-mono text-sky-400 text-left">
   {selectedEntry.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedEntry.currency}
   </td>
   </tr>
    <tr>
    <td colSpan={7} className="py-2 px-3 text-left text-xs text-slate-400">
    المعادل بالعملة المحلية ({baseCode}): <span className="font-mono font-bold text-white">{(selectedEntry.totalDebit * (selectedEntry.exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</span>
    </td>
    </tr>
   </tfoot>
  </table>
  </div>

  <div className="mt-3 text-xs text-slate-400 flex justify-between items-center">
  <span>أُنشئ بواسطة: {selectedEntry.createdBy} في {selectedEntry.createdAt}</span>
  {selectedEntry.postedBy && <span>تم الترحيل بواسطة: {selectedEntry.postedBy}</span>}
  </div>
  </div>
  </div>
 ) : (
  <div className="glass-card rounded-3xl border border-slate-700/50 p-12 text-center">
  <div className="mx-auto mb-5 w-20 h-20 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
  <BookOpen className="w-10 h-10 text-sky-400" />
  </div>
  <p className="text-lg font-bold text-slate-100">استعراض قيد يومية محدد</p>
  <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
  اضغط F9 أو استخدم شريط البحث بالأعلى لاستعراض وتصفح قيد يومية محدد
  </p>
  <button
  onClick={() => {
   const el = document.getElementById('journal-entries-search');
   el?.focus();
   (el as HTMLInputElement | null)?.select();
  }}
  className="mt-6 inline-flex items-center gap-2 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
  >
  <Keyboard className="w-4 h-4" /> اضغط F9 للبحث عن قيد
  </button>
  </div>
 )}
 </div>

 {/* New Journal Modal */}
 {isModalOpen && (
 <ModalShell
  id="journal-entry-form"
  open={!!isModalOpen}
  onClose={() => closeJournalModal()}
  title={editingJournal ? `تعديل قيد يومية ${editingJournal.entryNumber}` : 'إنشاء قيد يومية مزدوج جديد (New Journal Entry)'}
   icon={BookOpen}
   size="xl"
   maxWidth="max-w-4xl"
   footer={null}
   closeOnBackdrop={false}
   bodyClassName="p-0"
   maximized={isModalExpanded}
   onToggleMaximize={() => setIsModalExpanded(v => !v)}
   topRight={
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-mono text-sm font-bold text-sky-300">
    <FileText className="w-3.5 h-3.5" />
    {editingJournal?.entryNumber ?? nextJournalNo}
    </span>
   }
  >
 <form onSubmit={handleSubmit} noValidate className="p-6 space-y-6">
  {/* Header Fields */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
  <div>
   <label className="block text-xs font-semibold text-slate-300 mb-1">رقم القيد {editingJournal ? '(تلقائي — ثابت)' : '(تلقائي)'}</label>
   <div className="w-full px-3 py-2 text-sm font-mono font-bold text-sky-300 glass-input rounded-xl flex items-center gap-2" dir="ltr">
   <FileText className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
   {editingJournal?.entryNumber ?? nextJournalNo}
   </div>
  </div>

  <div>
  <label className="block text-xs font-semibold text-slate-300 mb-1">تاريخ القيد *</label>
  <SmartDateInput value={entryDate} onChange={d => setEntryDate(smartDateToIso(d))} />
  </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">رقم المرجع (Ref)</label>
 <input
 type="text"
 value={reference}
 onChange={e => setReference(e.target.value)}

 className="w-full px-3 py-2 text-sm glass-input rounded-xl"
 />
 </div>

  <div className="md:col-span-3">
  <label className="block text-xs font-semibold text-slate-300 mb-1">البيان الشارح للقيد (Narration) *</label>
 <input
 type="text"
 required
 value={narration}
 onChange={e => setNarration(e.target.value)}

 className="w-full px-3 py-2 text-sm glass-input rounded-xl"
 />
 </div>
 </div>

 {/* Double-Entry Validation Live Alert */}
 <div className={`p-4 rounded-2xl border flex items-center justify-between ${validation.isValid ?'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :'bg-red-500/10 border-red-500/30 text-red-300'
}`}>
 <div className="flex items-center gap-3">
 {validation.isValid ? (
 <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
 ) : (
 <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
 )}

  <div>
  <div className="font-bold text-sm">
  {validation.isValid ?'القيد متوازن تماماً (Debit = Credit)' :'القيد غير متوازن (تنبيه القيد المزدوج)'}
  </div>
  {!validation.isValid && (
  <div className="text-xs mt-0.5">{validation.errorMessage}</div>
  )}
  </div>
  </div>
  </div>

 {subLedgerError && (
 <div className="p-3 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-200 text-xs font-semibold flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
 {subLedgerError}
 </div>
 )}

 {/* Entry Lines */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <h4 className="font-bold text-sm text-slate-200">أطراف القيد (Journal Lines)</h4>
 <button
  type="button"
  data-enter-nav="add-line"
  onClick={addLine}
  className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300"
  >
 <Plus className="w-4 h-4" />
 إضافة طرف قيد آخر
 </button>
 </div>

   <div className="overflow-x-auto border border-slate-800 rounded-2xl">
   <table className="w-full min-w-[1560px] text-right text-xs dir-rtl table-fixed">
   <colgroup>
   <col className="w-9" />
   <col className="w-[130px]" />
   <col className="w-[150px]" />
   <col className="w-[170px]" />
   <col className="w-20" />
   <col className="w-20" />
   <col className="w-[280px]" />
   <col className="w-[104px]" />
   <col className="w-[104px]" />
   <col className="w-[104px]" />
   <col className="w-[104px]" />
   <col className="w-[150px]" />
   <col className="w-[110px]" />
   <col className="w-10" />
   </colgroup>
   <thead>
   <tr className="bg-slate-900/60 text-slate-300 font-bold border-b border-slate-800">
   <th className="py-2.5 px-2 text-center">#</th>
   <th className="py-2.5 px-2 text-right">رقم الحساب <span className="text-slate-500 font-normal">(F9)</span></th>
   <th className="py-2.5 px-2 text-right">اسم الحساب</th>
   <th className="py-2.5 px-2 text-right">الحساب المساعد</th>
   <th className="py-2.5 px-2 text-center">العملة</th>
   <th className="py-2.5 px-2 text-center">سعر الصرف</th>
   <th className="py-2.5 px-2 text-right">البيان / التفاصيل</th>
   <th className="py-2.5 px-2 text-left">مدين (محلي)</th>
   <th className="py-2.5 px-2 text-left">مدين (أجنبي)</th>
   <th className="py-2.5 px-2 text-left">دائن (محلي)</th>
   <th className="py-2.5 px-2 text-left">دائن (أجنبي)</th>
   <th className="py-2.5 px-2 text-right">مركز التكلفة</th>
   <th className="py-2.5 px-2 text-right">رقم المرجع (Ref)</th>
   <th className="py-2.5 px-2 text-center">حذف</th>
   </tr>
   </thead>
  <tbody className="divide-y divide-slate-800/60">
  {lines.map((line, index) => {
  const account = accounts.find(a => a.id === line.accountId);
  const isBaseLine = line.currency === baseCode;
  const rate = Number(line.exchangeRate) || 1;
  // النطاق المسموح لسعر تحويل سطر القيد (الأساسية: {1..1})
  const rateBounds = rateGuard.boundsOf(line.currency);
  // العملة الأساسية: لا مبالغ أجنبية (0 ومعطّلة). العملة الأجنبية: مشتقة من المحلي ÷ السعر.
  const debitForeign = isBaseLine ? 0 : (line.debit === 0 ? 0 : round2(line.debit / rate));
  const creditForeign = isBaseLine ? 0 : (line.credit === 0 ? 0 : round2(line.credit / rate));
  return (
  <tr key={line.id} className="hover:bg-white/5 align-top">
  <td className="py-2 px-2 text-center text-slate-500 font-mono">{index + 1}</td>

  <td className="py-2 px-2">
  {analyticalAccounts.length === 0 ? (
  <div className="px-2 py-1.5 text-xs rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center gap-1.5">
  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
  لا توجد حسابات — أضفها من شجرة الحسابات أولاً
  </div>
  ) : (
  <F9SearchInput<Account>
  value={line.codeFilter ?? account?.code ?? ''}
  onChange={code => handleAccountCode(line.id, code)}
  onSelect={acc => selectAccount(line.id, acc)}

  className="w-full px-2 py-1.5 text-xs glass-input rounded font-mono font-semibold text-sky-300 bg-slate-900"
  items={analyticalAccounts}
  columns={[
  { label: 'الكود', render: a => <span className="font-mono font-bold text-sky-300">{a.code}</span>, className: 'w-24 font-mono' },
  { label: 'اسم الحساب', render: a => <span className="text-slate-200">{a.nameAr}</span> },
  ]}
  searchText={a => `${a.code} ${a.nameAr} ${a.nameEn || ''}`}
  browseTitle="اختيار الحساب المحاسبي (المستوى الخامس)"
  />
  )}
  </td>

  <td className="py-2 px-2">
  {account ? (
  <div tabIndex={0} className="text-slate-200 font-semibold leading-6 truncate w-full max-w-full focus:outline-none focus:ring-2 focus:ring-sky-500/40 rounded" title={`${account.code} - ${account.nameAr}`}>{account.nameAr}</div>
  ) : (
   <div className="text-slate-600 dark:text-slate-400 text-sm leading-6"></div>
  )}
  </td>

   <td className="py-2 px-2">
   <SubLedgerF9Cell
   dataset={subLedgerDataset}
   account={account}
   subLedgerId={line.subLedgerId}
   subLedgerName={line.subLedgerName}
   onChange={(subLedgerId, subLedgerName) => {
     updateLine(line.id, 'subLedgerId', subLedgerId);
     updateLine(line.id, 'subLedgerName', subLedgerName);
   }}
   compact
   />
   </td>

   <td className="py-2 px-2">
   <select
   value={line.currency}
   onChange={e => changeLineCurrency(line.id, e.target.value)}
   title="عملة السطر"
   className="w-full px-1 py-1.5 text-xs glass-input rounded bg-slate-900 text-white font-mono text-center"
   >
   {currencyOptions.map(c => (
   <option key={c.code} value={c.code}>{c.code}</option>
   ))}
   </select>
   </td>

  <td className="py-2 px-2">
  <ExchangeRateField
  value={isBaseLine ? 1 : (line.exchangeRate || 1)}
  onChange={v => changeLineRate(line.id, String(v))}
  disabled={isBaseLine}
  isBase={isBaseLine}
  min={rateBounds.min}
  max={rateBounds.max}
  currencyCode={line.currency}
  compact
  inputClassName="w-full px-1 py-1.5 text-xs bg-slate-900 rounded font-mono text-center"
  />
  </td>

   <td className="py-2 px-2">
   <LineNarrationField
   value={line.description}
   onChange={v => updateLine(line.id,'description', v)}
   mainNarration={narration.trim() || lines[0]?.description || ''}
   previousNarration={index > 0 ? lines[index - 1]?.description || '' : ''}
   hasPrevious={index > 0}
   rowIndex={index}

   className="w-full px-2 py-1.5 text-xs glass-input rounded"
   />
   </td>

   <td className="py-2 px-2">
   <AmountInput

   value={line.debit}
   onChange={v => updateLineAmount(line.id, 'debit', v, 'local')}
   title={!isBaseLine ? 'تحرير المحلي يعيد حساب سعر الصرف = المحلي ÷ الأجنبي' : undefined}
   className={`w-full px-2 py-1.5 text-xs rounded font-mono text-left glass-input font-bold ${isBaseLine ? 'text-emerald-400' : 'text-emerald-300'}`}
   />
   </td>

   <td className="py-2 px-2">
   <AmountInput

   value={debitForeign}
   onChange={v => updateLineAmount(line.id, 'debit', v, 'foreign')}
   readOnly={isBaseLine}
   className={`w-full px-2 py-1.5 text-xs rounded font-mono text-left ${!isBaseLine ? 'glass-input font-bold text-emerald-400' : 'bg-slate-800/40 text-slate-500'}`}
   />
   </td>

   <td className="py-2 px-2">
   <AmountInput

   value={line.credit}
   onChange={v => updateLineAmount(line.id, 'credit', v, 'local')}
   title={!isBaseLine ? 'تحرير المحلي يعيد حساب سعر الصرف = المحلي ÷ الأجنبي' : undefined}
   className={`w-full px-2 py-1.5 text-xs rounded font-mono text-left glass-input font-bold ${isBaseLine ? 'text-sky-400' : 'text-sky-300'}`}
   />
   </td>

   <td className="py-2 px-2">
   <AmountInput

   value={creditForeign}
   onChange={v => updateLineAmount(line.id, 'credit', v, 'foreign')}
   readOnly={isBaseLine}
   className={`w-full px-2 py-1.5 text-xs rounded font-mono text-left ${!isBaseLine ? 'glass-input font-bold text-sky-400' : 'bg-slate-800/40 text-slate-500'}`}
   />
   </td>

   <td className="py-2 px-2">
   <select
   value={line.costCenterId || ''}
   onChange={e => updateLine(line.id, 'costCenterId', e.target.value)}
   title="مركز التكلفة"
   className="w-full px-1 py-1.5 text-sm glass-input rounded bg-slate-900 text-white"
   >
   <option value="">بدون مركز تكلفة</option>
   {costCenters.map(cc => (
   <option key={cc.id} value={cc.id}>{cc.code} — {cc.nameAr}</option>
   ))}
   </select>
   </td>

   <td className="py-2 px-2">
   <input
   type="text"

   value={line.referenceNumber || ''}
   onChange={e => updateLine(line.id,'referenceNumber', e.target.value)}
   title="رقم المرجع على مستوى السطر"
   className="w-full px-2 py-1.5 text-xs glass-input rounded font-mono"
   />
   </td>

   <td className="py-2 px-2 text-center">
  <button
  type="button"
  onClick={() => removeLine(line.id)}
  disabled={lines.length <= 2}
  className="text-slate-500 hover:text-red-400 disabled:opacity-30 cursor-pointer"
  title="حذف السطر"
  >
  <Trash2 className="w-4 h-4 mx-auto" />
  </button>
  </td>
  </tr>
  );
  })}
  </tbody>
  <tfoot className="bg-slate-900/60 text-white border-t border-slate-800">
  <tr>
   <td colSpan={7} className="py-2.5 px-3 text-left text-sm text-slate-400">إجمالي المبالغ (بالعملة المحلية {baseCode}):</td>
   <td className="py-2.5 px-2 font-mono font-bold text-emerald-400 text-left">
   {validation.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   </td>
   <td className="py-2.5 px-2 text-slate-600 text-left">—</td>
   <td className="py-2.5 px-2 font-mono font-bold text-sky-400 text-left">
   {validation.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   </td>
   <td className="py-2.5 px-2 text-slate-600 text-left">—</td>
   <td className="py-2.5 px-2"></td>
   <td className="py-2.5 px-2"></td>
   <td className="py-2.5 px-2"></td>
   </tr>
   <tr>
   <td colSpan={14} className="py-2.5 px-3">
  <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${validation.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
  <span className="text-sm text-slate-400">إجمالي المدين:</span>
  <span className={`font-mono font-bold ${validation.isValid ? 'text-emerald-300' : 'text-red-300'}`}>{validation.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  <span className="text-sm text-slate-400">إجمالي الدائن:</span>
  <span className={`font-mono font-bold ${validation.isValid ? 'text-emerald-300' : 'text-red-300'}`}>{validation.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  <span className="text-sm text-slate-400">الفارق:</span>
  <span className={`font-mono font-bold ${validation.isValid ? 'text-emerald-300' : 'text-red-300'}`}>{validation.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  </div>
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${validation.isValid ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
  {validation.isValid ? (<><CheckCircle2 className="w-3.5 h-3.5" /> القيد متوازن — جاهز للحفظ</>) : (<><AlertTriangle className="w-3.5 h-3.5" /> القيد غير متوازن — أعد ضبط المبالغ</>)}
  </span>
  </div>
  </td>
  </tr>
  </tfoot>
  </table>
  </div>
  </div>

 <AttachmentPicker documents={attachments} onChange={setAttachments} uploadedBy={currentUserName} documentType="JOURNAL_SUPPORT" />

 <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
 <button
 type="button"
 onClick={() => closeJournalModal()}
 className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium"
 >
 إلغاء
 </button>
  <button
  type="submit"
  disabled={!validation.isValid || rateBlocked}
  className="px-6 py-2.5 bg-sky-500/15 hover:bg-sky-400 disabled:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer"
  >
  {editingJournal ? 'حفظ تعديلات القيد الحسابي' : 'حفظ القيد الحسابي'}
 </button>
 </div>
 </form>
 </ModalShell>
 )}

 {/* PRINT / VIEW JOURNAL ENTRY MODAL */}
 {isPrintOpen && selectedEntry && (
  <ModalShell
   id="journal-entry-print"
   open={!!(isPrintOpen && selectedEntry)}
   onClose={() => setIsPrintOpen(false)}
   title={`معاينة القيد اليومي (${selectedEntry.entryNumber})`}
   icon={Printer}
   size="lg"
   footer={null}
   closeOnBackdrop={false}
   className="print-modal"
   bodyClassName="p-0"
   topRight={
    <div className="flex items-center gap-3">
     <button
      onClick={() => void handlePrintPreview()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors shadow-md"
     >
      <Printer className="w-4 h-4" />
      طباعة القيد
     </button>
     <button
      onClick={handleSavePdf}
      disabled={pdfBusy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-md disabled:opacity-50"
     >
      <Download className="w-4 h-4" />
      {pdfBusy ? 'جاري الإنشاء...' : 'حفظ PDF'}
     </button>
    </div>
   }
  >
   <div ref={printablePaperRef} id="printable-journal-paper" className="paper print-area bg-white text-slate-900 text-right" dir="rtl">
    <div className="p-8">
     <VoucherPrintTemplate
      voucherTitleAr="قيد يومية عام"
      voucherTitleEn="General Journal Entry"
      documentNumber={selectedEntry.entryNumber}
      documentDate={selectedEntry.date}
      currency={selectedEntry.currency}
      currentUserName={selectedEntry.createdBy}
      metadata={[
       { label: 'حالة القيد', value: selectedEntry.status === 'POSTED' ? 'مُرّحل' : selectedEntry.status === 'PENDING_POSTING' ? 'بانتظار الترحيل' : 'ملغى' },
       { label: 'رقم المرجع', value: selectedEntry.reference || '—' },
       ...(selectedEntry.sourceType && selectedEntry.sourceType !== 'MANUAL' ? [{ label: 'المصدر', value: selectedEntry.sourceType === 'PAYMENT_VOUCHER' ? 'سند صرف' : 'سند قبض' }] : []),
       ...(selectedEntry.referenceCode ? [{ label: 'رقم مستند المصدر', value: selectedEntry.referenceCode }] : []),
       { label: 'البيان العام', value: selectedEntry.narration },
      ]}
      totalAmountText={`${selectedEntry.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selectedEntry.currency}`}
      signatures={[
       { roleLabelAr: 'أعده / المحاسب', name: selectedEntry.createdBy },
       { roleLabelAr: 'المراجع الداخلي / التدقيق' },
       { roleLabelAr: 'المدير المالي / الاعتماد' },
       { roleLabelAr: 'المحقق / المستلم' },
      ]}
     >
     <table>
       <colgroup>
        <col style={{ width: '3%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '23%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '10%' }} />
       </colgroup>
       <thead>
        <tr>
         <th className="text-center">#</th>
         <th>رقم الحساب</th>
         <th>اسم الحساب المحاسبي</th>
         <th>البيان / الشرح</th>
         <th>رقم المرجع</th>
         <th>مركز التكلفة</th>
         <th className="text-left">مدين ({selectedEntry.currency})</th>
         <th className="text-left">دائن ({selectedEntry.currency})</th>
        </tr>
       </thead>
       <tbody>
        {selectedEntry.lines.map((line, idx) => (
         <tr key={line.id}>
          <td className="text-center font-mono">{idx + 1}</td>
          <td className="font-mono">{line.accountCode}</td>
          <td className="font-semibold">{line.subLedgerName || line.accountNameAr}</td>
          <td className="text-slate-600">{line.description}</td>
          <td className="font-mono text-slate-600">{line.referenceNumber || '—'}</td>
          <td className="text-slate-600">
           {line.costCenterId ? (() => {
            const cc = costCenters.find(c => c.id === line.costCenterId);
            return cc ? `${cc.code} — ${cc.nameAr}` : '—';
           })() : '—'}
          </td>
          <td className="font-bold text-left font-mono whitespace-nowrap">{line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
          <td className="font-bold text-left font-mono whitespace-nowrap">{line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
         </tr>
        ))}
       </tbody>
       <tfoot>
        <tr>
         <td colSpan={6} className="text-left font-bold">الإجمالي:</td>
         <td className="font-bold text-left font-mono whitespace-nowrap">{selectedEntry.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
         <td className="font-bold text-left font-mono whitespace-nowrap">{selectedEntry.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
       </tfoot>
      </table>
     </VoucherPrintTemplate>
    </div>
   </div>
  </ModalShell>
 )}
 </div>
 );
}
