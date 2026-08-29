import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Printer,
  XCircle,
  CheckCircle2,
  ArrowUpRight,
  Wallet,
  Landmark,
  FileText,
  Hash,
  Trash2,
  Download,
  Share2,
  Lock,
  Pencil,
  RotateCw,
  Eye,
  CalendarDays,
} from 'lucide-react';
import {
  Account,
  BankAccount,
  CashBox,
  CostCenter,
  Currency,
  Customer,
  Employee,
  JournalEntry,
  ReceiptMethod,
  ReceiptSourceType,
  ReceiptVoucher,
  ReceiptVoucherLine,
  ReceiptVoucherStatus,
  SubLedgerType,
  Vendor,
} from '../../types/erp';
import { isPostingAccount, nextReceiptVoucherNumber, level4GroupOf } from '../../utils/accountingEngine';
import { validateSubLedgerLines, SubLedgerDataset, subLedgerTypeOf } from '../../utils/subLedger';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useExchangeRateGuard } from '../../hooks/useExchangeRateGuard';
import { tafqeet } from '../../utils/tafqeet';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import ModalShell from '../ui/ModalShell';
import { useModalStackStatus } from '../ui/ModalStack';
import AmountInput from '../AmountInput';
import SubLedgerF9Cell from '../ui/SubLedgerF9Cell';
import LineNarrationField from '../ui/LineNarrationField';
import ExchangeRateField from '../ui/ExchangeRateField';
import { useToast } from '../ui/Toast';
import { useTabDirty } from '../../tabs/TabsContext';
import VoucherPrintTemplate from '../ui/VoucherPrintTemplate';
import { handleCurrencyFieldChange } from '../../utils/currencyMath';
import SmartDateInput, { smartDateToIso, todayIso } from '../common/SmartDateInput';
import { loadBranchesLocal } from '../../utils/companyStore';
import AttachmentPicker from '../ui/AttachmentPicker';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { openDesktopPrintPreview } from '../../utils/desktopPrintPreview';

interface Props {
  receipts: ReceiptVoucher[];
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  costCenters: CostCenter[];
  journals: JournalEntry[];
  currencies: Currency[];
  onAddReceipt: (receipt: ReceiptVoucher, journalEntry?: JournalEntry) => void;
  onUpdateReceipt: (id: string, receipt: ReceiptVoucher, journalEntry?: JournalEntry, oldJournalEntryId?: string) => void;
  onVoidReceipt: (id: string, journalEntryId?: string) => boolean;
  onRestoreReceipt: (id: string, journalEntryId?: string) => boolean;
  onPostPending: (receipt: ReceiptVoucher, journalEntry: JournalEntry) => void;
  currentUserName: string;
  closedYears?: string[];
  closedMonths?: string[];
  /** صلاحية تجاوز الحدود المعتمدة لسعر التحويل (CAN_OVERRIDE_EXCHANGE_LIMITS) */
  canOverrideExchangeLimits?: boolean;
  /** تسجيل تحذيري في سجل التدقيق عند تجاوز حدود سعر الصرف بصلاحية خاصة */
  onAuditLog?: (details: string) => void;
  onClose?: () => void;
}

/** كسور العملات (الأجزاء) للتفقيط العربي */
const CURRENCY_FRACTIONS: Record<string, string> = {
  YER: 'فلس',
  SAR: 'هللة',
  USD: 'سنت'
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** تنسيق التاريخ إلى صيغة يوم/شهر/سنة */
const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const fmt = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** المعادل المحلي للسند = المبلغ الأجنبي × سعر الصرف */
const localOf = (r: ReceiptVoucher): number => round2((r.totalAmount || 0) * (r.exchangeRate || 1));

const RECEIPT_METHOD_LABELS: Record<ReceiptMethod, string> = {
  CASH: 'نقداً',
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك بنكي'
};

const CURRENCY_PREFS = ['YER', 'USD'];

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-bold text-slate-800 dark:text-white mt-0.5 break-words">{value}</p>
    </div>
  );
}

export default function ReceiptVouchersWindow({
  receipts,
  accounts,
  cashBoxes,
  bankAccounts,
  employees,
  customers,
  vendors,
  costCenters,
  journals,
  currencies,
  onAddReceipt,
  onUpdateReceipt,
  onVoidReceipt,
  onRestoreReceipt,
  currentUserName,
  closedYears,
  closedMonths,
  canOverrideExchangeLimits,
  onAuditLog,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReceiptVoucherStatus>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR'>('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  const modalStatus = useModalStackStatus('receipt-voucher-create');
  // السند قيد التعديل (قبل الترحيل فقط) — عند تعيينه، تُعبَّأ النافذة ببياناته ويصبح الحفظ تحديثاً
  const [editingReceipt, setEditingReceipt] = useState<ReceiptVoucher | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptVoucher | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printablePaperRef = useRef<HTMLDivElement>(null);
  const handlePrintPreview = () => openDesktopPrintPreview(printablePaperRef.current, `سند قبض ${selectedReceipt?.receiptNumber || ''}`, 'portrait');

  // Form State for New Receipt Voucher
  const { active: currencyOptions, baseCode } = useActiveCurrencies(currencies);
  // واقي حدود سعر التحويل: نطاق كل عملة (min/max) من دليل العملات
  const rateGuard = useExchangeRateGuard(currencies);
  const toast = useToast();
  const [receiptDate, setReceiptDate] = useState<string>(todayIso());
  const [receiptMethod, setReceiptMethod] = useState<ReceiptMethod>('CASH');
  const [sourceType, setSourceType] = useState<ReceiptSourceType>('CASH_BOX');
  const [selectedSourceEntityId, setSelectedSourceEntityId] = useState<string>('');
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [chequeDueDate, setChequeDueDate] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [currency, setCurrency] = useState<string>(baseCode);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  // المبلغ الأجنبي الإجمالي لجهة المدين (رأس السند) — المدخل الفعلي في العملات الأجنبية
  const [foreignTotalAmount, setForeignTotalAmount] = useState<number>(0);
  // المبلغ المحلي الإجمالي لجهة المدين — قابل للتحرير في العملة الأساسية فقط
  const [debitLocalAmount, setDebitLocalAmount] = useState<number>(0);
  const [attachments, setAttachments] = useState<SupportingDocument[]>([]);

  const baseCurrencyCode = baseCode;
  const isBaseCurrency = currency === baseCurrencyCode;

  const companyBranch = useMemo(() => loadBranchesLocal()[0], []);

  /** العملات النشطة المضمّنة للصندوق/البنك المحدد فقط — بدون الرجوع للقائمة العامة */
  const sourceEntityActiveCurrencies = (): Currency[] => {
    let entityCurrencies: { code: string; isActive: boolean }[] | undefined;
    if (sourceType === 'CASH_BOX') {
      entityCurrencies = cashBoxes.find(b => b.id === selectedSourceEntityId)?.currencies;
    } else if (sourceType === 'BANK_ACCOUNT') {
      entityCurrencies = bankAccounts.find(b => b.id === selectedSourceEntityId)?.currencies;
    }
    const active = (entityCurrencies || []).filter(c => c.isActive);
    if (active.length > 0) {
      return active
        .map(ac => currencyOptions.find(c => c.code === ac.code))
        .filter((c): c is Currency => Boolean(c));
    }
    return [];
  };

  /** العملات المتاحة للصندوق/البنك المحدد — يرث العملات المضمّنة للكيان أو كامل القائمة */
  const sourceCurrencies = (): Currency[] => {
    const entityCurrencies = sourceEntityActiveCurrencies();
    if (entityCurrencies.length > 0) return entityCurrencies;
    return currencyOptions;
  };

  /** العملة الافتراضية للصندوق/البنك المحدد */
  const defaultCurrencyOfSource = sourceType === 'CASH_BOX'
    ? cashBoxes.find(b => b.id === selectedSourceEntityId)?.defaultCurrency
    : sourceType === 'BANK_ACCOUNT'
      ? bankAccounts.find(b => b.id === selectedSourceEntityId)?.defaultCurrency
      : undefined;

  /** جاهزية جهة المدين لإدخال المبالغ: عملة محددة ومحمّلة من الصندوق/البنك المحدد */
  const headerCurrencyReady = !!currency &&
    !!selectedSourceEntityId &&
    (sourceEntityActiveCurrencies().length > 0 || !!defaultCurrencyOfSource);

  /** تطبيق عملة: تحديث الرمز + سعر الصرف تلقائياً + تصفير المبلغ الأجنبي (عملة مستقلة عن السابقة) */
  const applyCurrency = (code: string) => {
    setCurrency(code);
    const found = currencyOptions.find(c => c.code === code);
    setExchangeRate(found ? found.exchangeRate : 1.0);
    setForeignTotalAmount(0);
  };

  const currencyNameAr = currencyOptions.find(c => c.code === currency)?.nameAr || currency;
  const currencyFractionAr = CURRENCY_FRACTIONS[currency] || 'جزء من المئة';

  // الرقم التسلسلي التالي لسند القبض — يُولّد تلقائياً ويظهر في شاشة الإضافة
  const nextReceiptNo = nextReceiptVoucherNumber(receipts);

  // Line items state for create modal
  const [lines, setLines] = useState<Array<{
    id: string;
    controlId: string;
    accountId: string;
    description: string;
    amount: number;
    localAmount?: number;
    costCenterId: string;
    currency: string;
    exchangeRate: number;
    referenceNumber: string;
    subLedgerType?: SubLedgerType;
    subLedgerId?: string;
    subLedgerName?: string;
  }>>([
    {
      id: `line-${Date.now()}-1`,
      controlId: '',
      accountId: '',
      description: '',
      amount: 0,
      costCenterId: '',
      currency: baseCode,
      exchangeRate: 1,
      referenceNumber: ''
    }
  ]);

  // علامة "تعديلات غير محفوظة" على تبويب سندات القبض
  const setDirty = useTabDirty('RECEIPT_VOUCHERS');
  useEffect(() => {
    const hasContent =
      payerName.trim() !== '' ||
      referenceNumber.trim() !== '' ||
      narration.trim() !== '' ||
      selectedSourceEntityId !== '' ||
      Number(foreignTotalAmount) > 0 ||
      Number(debitLocalAmount) > 0 ||
      lines.some(l => l.accountId && Number(l.amount) > 0);
    setDirty(isCreateOpen && hasContent);
  }, [isCreateOpen, payerName, referenceNumber, narration, selectedSourceEntityId, foreignTotalAmount, debitLocalAmount, lines, setDirty]);

  const subLedgerDataset: SubLedgerDataset = { accounts, employees, customers, vendors, cashBoxes, banks: bankAccounts, costCenters };

  /** العملة الافتراضية لكيان الحساب المساعد المختار — تُنزّل تلقائياً في السطر عند التفعيل */
  const defaultCurrencyOfSubLedger = (type: SubLedgerType | undefined, entityId: string): string | undefined => {
    if (!type || !entityId) return undefined;
    switch (type) {
      case 'EMPLOYEE': return employees.find(e => e.id === entityId)?.defaultCurrency;
      case 'CUSTOMER': return customers.find(c => c.id === entityId)?.defaultCurrency;
      case 'SUPPLIER': return vendors.find(v => v.id === entityId)?.defaultCurrency;
      case 'CASH_BOX': return cashBoxes.find(b => b.id === entityId)?.defaultCurrency;
      case 'BANK':
      case 'EXCHANGER': return bankAccounts.find(b => b.id === entityId)?.defaultCurrency;
      default: return undefined;
    }
  };

  const postingAccounts = accounts.filter(isPostingAccount);

  // F9 — البحث في دليل الحسابات (المستوى الخامس) لتعيين الحساب المحاسبي للسطر
  const [f9Open, setF9Open] = useState(false);
  const [f9LineId, setF9LineId] = useState<string | null>(null);
  const [f9Query, setF9Query] = useState('');

  const f9Level5 = useMemo(
    () =>
      accounts
        .filter(a => a.level === 5 && a.isActive)
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })),
    [accounts]
  );

  const f9List = useMemo(() => {
    const q = f9Query.trim().toLowerCase();
    if (!q) return f9Level5;
    return f9Level5.filter(a =>
      a.code.toLowerCase().includes(q) ||
      a.nameAr.includes(f9Query.trim()) ||
      a.nameEn.toLowerCase().includes(q)
    );
  }, [f9Query, f9Level5]);

  const openF9 = (lineId: string) => {
    setF9LineId(lineId);
    setF9Query('');
    setF9Open(true);
  };

  const applyF9Account = (account: Account) => {
    if (!f9LineId) return;
    const targetLineId = f9LineId;
    const control = level4GroupOf(account, accounts);
    const slType = subLedgerTypeOf(account, subLedgerDataset);
    // مسح القيم الراجعة عند تغيير الحساب: تصفير الحساب المساعد والعملة والمبلغ لإعادة السلسلة من جديد
    setLines(prev => prev.map(l => l.id === targetLineId ? {
      ...l,
      accountId: account.id,
      controlId: control ? control.id : '',
      subLedgerId: '',
      subLedgerName: '',
      subLedgerType: slType,
      currency,
      exchangeRate,
      amount: 0,
      localAmount: 0
    } : l));
    setF9Open(false);
    setF9LineId(null);
    // التركيز على الخانة التالية في السلسلة: المساعد إن لزم، وإلا العملة
    window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`tr[data-rv-line="${targetLineId}"]`);
      if (!row) return;
      if (slType !== 'NONE') {
        const sl = row.querySelector<HTMLElement>(`[data-subledger-line="${targetLineId}"] [tabindex="0"]`);
        if (sl) {
          sl.focus({ preventScroll: true });
          return;
        }
      }
      const cur = row.querySelector<HTMLElement>(`select[data-currency-line="${targetLineId}"]`);
      if (cur) cur.focus({ preventScroll: true });
    }, 50);
  };

  // Filter available source accounts based on sourceType
  const getSourceOptions = () => {
    if (sourceType === 'CASH_BOX') {
      if (cashBoxes.length > 0) {
        return cashBoxes.map(b => ({
          id: b.id,
          name: [b.code, b.nameAr].filter(Boolean).join(' - '),
          accountId: b.linkedAccountId || '1101010001',
          balance: b.openingBalance
        }));
      }
      return [{ id: '', name: 'لا توجد صناديق نقدية — أنشئ صندوقاً من (بيانات الصناديق) أولاً', accountId: '' }];
    } else if (sourceType === 'BANK_ACCOUNT') {
      if (bankAccounts.length > 0) {
        return bankAccounts.map(b => ({
          id: b.id,
          name: [b.code, `${b.bankNameAr} (${b.accountNumber})`].filter(Boolean).join(' - '),
          accountId: b.linkedAccountId || '1101020001',
          balance: b.openingBalance
        }));
      }
      return [{ id: '', name: 'لا توجد بنوك / صرافين — أنشئ بنكاً من (بيانات البنوك) أولاً', accountId: '' }];
    } else {
      return postingAccounts
        .filter(a => a.code.startsWith('1101'))
        .map(a => ({ id: a.id, name: `${a.code} - ${a.nameAr}`, accountId: a.id, balance: 0 }));
    }
  };

  // Reset Form
  const resetForm = () => {
    setReceiptDate(todayIso());
    setReceiptMethod('CASH');
    setSourceType('CASH_BOX');
    setSelectedSourceEntityId('');
    setSelectedSourceAccountId('');
    setPayerName('');
    setReferenceNumber('');
    setChequeDueDate('');
    setNarration('');
    setCurrency(baseCode);
    setExchangeRate(1.0);
    setForeignTotalAmount(0);
    setDebitLocalAmount(0);
    setAttachments([]);
    setLines([
      {
        id: `line-${Date.now()}-1`,
        controlId: '',
        accountId: '',
        description: '',
        amount: 0,
        costCenterId: '',
        currency: baseCode,
        exchangeRate: 1,
        referenceNumber: ''
      }
    ]);
  };

  const openCreateModal = () => {
    if (modalStatus.isRegistered && modalStatus.isMinimized) {
      modalStatus.restore();
      return;
    }
    if (modalStatus.isRegistered) {
      modalStatus.raise();
      return;
    }
    resetForm();
    setEditingReceipt(null);
    // Auto-select first cashbox or source account if available
    const sources = getSourceOptions();
    if (sources.length > 0) {
      setSelectedSourceEntityId(sources[0].id);
      setSelectedSourceAccountId(sources[0].accountId);
      // تطبيق العملة الافتراضية لأول صندوق/بنك
      const defCode = sourceType === 'CASH_BOX'
        ? cashBoxes.find(b => b.id === sources[0].id)?.defaultCurrency
        : sourceType === 'BANK_ACCOUNT'
          ? bankAccounts.find(b => b.id === sources[0].id)?.defaultCurrency
          : undefined;
      if (defCode && currencyOptions.some(c => c.code === defCode)) {
        applyCurrency(defCode);
      }
    }
    setIsCreateOpen(true);
  };

  /** فتح نافذة التعديل لسند بانتظار الترحيل — تعبئة النموذج بالبيانات الحالية للسند */
  const openEditModal = (receipt: ReceiptVoucher) => {
    if (modalStatus.isRegistered && modalStatus.isMinimized) {
      modalStatus.restore();
      return;
    }
    if (modalStatus.isRegistered) {
      modalStatus.raise();
      return;
    }
    resetForm();
    setEditingReceipt(receipt);
    setAttachments(receipt.attachments || []);
    const isBase = !receipt.currency || receipt.currency === baseCode;
    setReceiptDate(receipt.date);
    setReceiptMethod(receipt.receiptMethod);
    setSourceType(receipt.sourceType);
    setSelectedSourceEntityId(receipt.sourceEntityId || '');
    setSelectedSourceAccountId(receipt.sourceAccountId);
    setPayerName(receipt.payerName);
    setReferenceNumber(receipt.referenceNumber || '');
    setChequeDueDate(receipt.chequeDueDate || '');
    setNarration(receipt.narration);
    setCurrency(receipt.currency || baseCode);
    setExchangeRate(receipt.exchangeRate || 1);
    setForeignTotalAmount(isBase ? 0 : (receipt.subtotalAmount || receipt.totalAmount || 0));
    setDebitLocalAmount(isBase ? (receipt.totalAmount || 0) : 0);
    setLines(
      (receipt.lines.length > 0 ? receipt.lines : []).map(l => ({
        id: l.id,
        controlId: '',
        accountId: l.accountId,
        description: l.description,
        amount: Number(l.totalAmount) || Number(l.amount) || 0,
        localAmount: l.localAmount,
        costCenterId: l.costCenterId || '',
        currency: l.currency || receipt.currency || baseCode,
        exchangeRate: l.exchangeRate || receipt.exchangeRate || 1,
        referenceNumber: l.referenceNumber || '',
        subLedgerType: l.subLedgerType,
        subLedgerId: l.subLedgerId,
        subLedgerName: l.subLedgerName
      }))
    );
    setIsCreateOpen(true);
  };

  /** إغلاق نافذة الإضافة/التعديل مع تصفية وضع التعديل */
  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setEditingReceipt(null);
  };

  // Handle source type change
  const handleReceiptMethodChange = (method: ReceiptMethod) => {
    setReceiptMethod(method);
    let newSourceType: ReceiptSourceType = 'CASH_BOX';
    if (method === 'CASH') {
      newSourceType = 'CASH_BOX';
    } else {
      newSourceType = 'BANK_ACCOUNT';
    }
    setSourceType(newSourceType);
    if (method !== 'CHEQUE') setChequeDueDate('');

    // Update selected source
    setTimeout(() => {
      let options: Array<{ id: string; name: string; accountId: string }>;
      if (newSourceType === 'CASH_BOX') {
        options = cashBoxes.map(b => ({ id: b.id, name: b.nameAr, accountId: b.linkedAccountId || '1101010001' }));
      } else {
        options = bankAccounts.map(b => ({ id: b.id, name: b.bankNameAr, accountId: b.linkedAccountId || '1101020001' }));
      }
      if (options.length > 0) {
        setSelectedSourceEntityId(options[0].id);
        setSelectedSourceAccountId(options[0].accountId);
      }
    }, 50);
  };

  // Line computations
  const computedLines: ReceiptVoucherLine[] = lines.map(line => {
    const account = accounts.find(a => a.id === line.accountId);
    const amount = Number(line.amount) || 0;
    const totalAmount = Math.round(amount * 100) / 100;
    const rate = Number(line.exchangeRate) || 1;
    const lineBase = !line.currency || line.currency === baseCurrencyCode;
    // المعادل المحلي للسطر: عملة أساسية = المبلغ المحلي مباشرة، عملة أجنبية = المبلغ الأجنبي × سعر الصرف (فوري)
    const localAmount = lineBase
      ? Math.round((Number(line.localAmount ?? line.amount) || 0) * 100) / 100
      : Math.round(amount * rate * 100) / 100;
    const slType = subLedgerTypeOf(account, subLedgerDataset);

    return {
      id: line.id,
      accountId: line.accountId,
      accountCode: account ? account.code : '',
      accountNameAr: account ? account.nameAr : '',
      description: line.description || narration || 'مقبوضات سند قبض',
      amount,
      totalAmount,
      costCenterId: line.costCenterId || undefined,
      currency: line.currency || currency,
      exchangeRate: rate,
      localAmount,
      referenceNumber: line.referenceNumber || undefined,
      subLedgerType: slType,
      subLedgerId: slType !== 'NONE' ? line.subLedgerId : undefined,
      subLedgerName: slType !== 'NONE' ? line.subLedgerName : undefined
    };
  });

  // ——— المبالغ ثنائية الجانب (مدين / دائن) بالعملة المحلية ———
  // إجمالي الدائن (محلي) = مجموع المعادلات المحلية لأسطر الحسابات المستحقة عليها القبض
  const creditLocalTotal = Math.round(computedLines.reduce((sum, l) => sum + (l.localAmount ?? l.amount), 0) * 100) / 100;
  // إجمالي المدين (محلي) — جهة الصندوق/البنك المستلم للمقبوض:
  //  - عملة أساسية: المبلغ المحلي المُدخل مباشرة من المستخدم
  //  - عملة أجنبية: المبلغ الأجنبي × سعر الصرف (يُحسب تلقائياً وفورياً)
  const debitLocalTotal = isBaseCurrency
    ? Math.round((Number(debitLocalAmount) || 0) * 100) / 100
    : Math.round(((Number(foreignTotalAmount) || 0) * (Number(exchangeRate) || 1)) * 100) / 100;
  // إجمالي المدين (أجنبي) — صفر في العملة الأساسية
  const debitForeignTotal = isBaseCurrency ? 0 : Number(foreignTotalAmount) || 0;
  // الفارق بين المدين والدائن (محلي) — يجب أن يساوي صفراً للترحيل
  // الفارق بين المدين والدائن (محلي) — يجب أن يساوي صفراً للحفظ
  const balanceDifference = Math.round((debitLocalTotal - creditLocalTotal) * 100) / 100;
  // حجب الحفظ عند وجود أي سعر صرف خارج النطاق المسموح [min..max] (ترويسة + أسطر)
  const rateBlocked = useMemo(() => {
    const items: { rate: number; code: string }[] = [];
    if (!isBaseCurrency) items.push({ rate: Number(exchangeRate) || 0, code: currency });
    lines.forEach(l => {
      const code = l.currency || currency;
      if (code && code !== baseCurrencyCode) items.push({ rate: Number(l.exchangeRate) || 0, code });
    });
    return rateGuard.violationsOf(items).length > 0;
  }, [isBaseCurrency, exchangeRate, currency, lines, rateGuard, baseCurrencyCode]);
  // اكتمال السند يتطلب: أسطر كاملة (حساب + عملة + مبلغ > 0)، مبلغ مقبوض > 0، وتوازناً تاماً بين المدين والدائن
  const canPost =
    lines.length > 0 &&
    lines.every(l => !!l.accountId && !!l.currency && Number(l.amount) > 0) &&
    debitLocalTotal > 0 &&
    Math.abs(balanceDifference) <= 0.005;
  const wordsTafqeet = tafqeet(isBaseCurrency ? debitLocalTotal : debitForeignTotal, currencyNameAr, currencyFractionAr);

  // إدخال المبلغ الأجنبي لجهة المدين (عملة أجنبية فقط) — يُحسب المبلغ المحلي تلقائياً = الأجنبي × سعر الصرف
  const handleDebitForeignAmountChange = (v: string) => {
    const val = parseFloat(v) || 0;
    setForeignTotalAmount(val);
  };

  // إدخال المبلغ المحلي لجهة المدين:
  //  - عملة أساسية: يُؤخذ مباشرة من المستخدم.
  //  - عملة أجنبية: يُعاد حساب سعر الصرف الفعلي فورياً = المحلي ÷ الأجنبي (ربط مثلثي تلقائي).
  const handleDebitLocalAmountChange = (v: string) => {
    const val = parseFloat(v) || 0;
    if (isBaseCurrency) {
      setDebitLocalAmount(val);
      return;
    }
    const foreign = Number(foreignTotalAmount) || 0;
    if (foreign > 0) {
      const next = handleCurrencyFieldChange('local', val, {
        foreignAmount: foreign,
        exchangeRate: Number(exchangeRate) || 1,
        localAmount: debitLocalTotal,
      });
      setExchangeRate(next.exchangeRate);
    }
  };

  /**
   * بوابة حدود سعر التحويل (حفظ):
   * تعيد false وتمنع الحفظ عند خروج سعر ترويسة السند أو أي سطر عن النطاق [min_rate..max_rate].
   * تحقق إلزامي صارم — لا تجاوز بالصلاحية، والإشعار عبر Toast.
   */
  const enforceRateBoundaries = (): boolean => {
    const violations: string[] = [];
    if (!isBaseCurrency) {
      const msg = rateGuard.violationOf(Number(exchangeRate) || 0, currency);
      if (msg) violations.push(`ترويسة السند (${currency}): ${msg}`);
    }
    lines.forEach(l => {
      const code = l.currency || currency;
      if (!code || code === baseCurrencyCode) return;
      const msg = rateGuard.violationOf(Number(l.exchangeRate) || 0, code);
      if (msg) violations.push(`سطر ${l.id.split('-').pop() || ''} (${code}): ${msg}`);
    });
    if (violations.length === 0) return true;
    toast('error', violations.join('\n'));
    return false;
  };

  /** التحقق من بيانات السند — تعيد null عند وجود خطأ (مع إظهار رسالة) */
  const validateAndBuildReceipt = (): ReceiptVoucher | null => {
    if (!payerName.trim()) {
      alert('يرجى إدخال اسم السداد / المدفوع منه.');
      return null;
    }

    if (!selectedSourceAccountId) {
      alert('يرجى اختيار الحساب أو الصندوق/البنك المستلم للمقبوض.');
      return null;
    }

    if (receiptMethod === 'CHEQUE' && !referenceNumber.trim()) {
      alert('يرجى إدخال رقم الشيك.');
      return null;
    }

    if (receiptMethod === 'CHEQUE' && !chequeDueDate) {
      alert('يرجى تحديد تاريخ استحقاق الشيك.');
      return null;
    }

    if (receiptMethod === 'BANK_TRANSFER' && !referenceNumber.trim()) {
      alert('يرجى إدخال رقم الحوالة / الإشعار البنكي.');
      return null;
    }

    // بوابة حدود سعر التحويل: منع الحفظ عند خروج أي سعر عن النطاق المسموح
    if (!enforceRateBoundaries()) return null;

    const invalidLine = lines.find(l => !l.accountId || !l.currency || Number(l.amount) <= 0);
    if (invalidLine) {
      alert('يرجى التأكد من اختيار الحساب والعملة وإدخال مبلغ أكبر من صفر لكل سطر في جدول القبض.');
      return null;
    }

    if (debitLocalTotal <= 0) {
      alert('يرجى إدخال المبلغ الإجمالي للمقبوض (الصندوق/البنك المستلم) — يجب أن يكون أكبر من صفر.');
      return null;
    }

    // التحقق الموحد من الحسابات المساعدة قبل الحفظ (بأرقام الأسطر)
    const slCheck = validateSubLedgerLines(computedLines, accounts, subLedgerDataset);
    if (!slCheck.valid) {
      alert(slCheck.message || 'يرجى تحديد الحساب المساعد للسطر المطلوب.');
      return null;
    }

    if (Math.abs(balanceDifference) > 0.005) {
      alert('لا يمكن حفظ السند — يجب أن يتساوى إجمالي المدين (المقبوض) مع إجمالي الدائن (البنود).');
      return null;
    }

    const liveSourceAccountId = sourceType === 'CASH_BOX'
      ? cashBoxes.find(item => item.id === selectedSourceEntityId)?.linkedAccountId || selectedSourceAccountId
      : bankAccounts.find(item => item.id === selectedSourceEntityId)?.linkedAccountId || selectedSourceAccountId;
    const sourceAccount = accounts.find(a => a.id === liveSourceAccountId);
    const sourceAccountName = sourceAccount ? sourceAccount.nameAr : 'حساب الصناديق / البنوك';
    // وضع التعديل: يُحتفظ برقم السند ومعرفه وبيانات إنشائه الأصلية
    const receiptId = editingReceipt?.id ?? `rv-${Date.now()}`;
    const finalReceiptNo = editingReceipt?.receiptNumber ?? nextReceiptNo;

    const newReceipt: ReceiptVoucher = {
      id: receiptId,
      receiptNumber: finalReceiptNo,
      date: receiptDate,
      receiptMethod,
      sourceType,
      sourceEntityId: selectedSourceEntityId,
      sourceAccountId: liveSourceAccountId,
      sourceAccountNameAr: sourceAccountName,
      payerName,
      referenceNumber: referenceNumber || undefined,
      chequeBankName: receiptMethod === 'CHEQUE'
        ? bankAccounts.find(b => b.id === selectedSourceEntityId)?.bankNameAr
        : undefined,
      chequeDueDate: receiptMethod === 'CHEQUE' ? chequeDueDate || undefined : undefined,
      narration: narration || `سند قبض من ${payerName}`,
      currency,
      exchangeRate,
      lines: computedLines,
      subtotalAmount: isBaseCurrency ? debitLocalTotal : debitForeignTotal,
      totalAmount: isBaseCurrency ? debitLocalTotal : debitForeignTotal,
      amountInWordsAr: wordsTafqeet,
      attachments,
      status: 'PENDING_POSTING', // يُحفظ بانتظار الترحيل من شاشة «الإقفالات والترحيل والرقابة»
      createdBy: editingReceipt?.createdBy ?? currentUserName,
      createdAt: editingReceipt?.createdAt ?? new Date().toISOString()
    };

    if (editingReceipt) {
      onUpdateReceipt(editingReceipt.id, newReceipt);
    } else {
      onAddReceipt(newReceipt);
    }
    return newReceipt;
  };

  const handleSaveReceipt = () => {
    const saved = validateAndBuildReceipt();
    if (saved) closeCreateModal();
  };

  /** حفظ السند ثم فتح معاينة الطباعة مباشرة */
  const handleSaveReceiptAndPrint = () => {
    const saved = validateAndBuildReceipt();
    if (saved) {
      closeCreateModal();
      setSelectedReceipt(saved);
      setAutoPrint(true);
      setIsPrintOpen(true);
    }
  };

  // الطباعة التلقائية بعد فتح معاينة السند (من زر «حفظ السند مع الطباعة»)
  useEffect(() => {
    if (isPrintOpen && selectedReceipt && autoPrint) {
      const t = setTimeout(() => {
        void handlePrintPreview();
        setAutoPrint(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isPrintOpen, selectedReceipt, autoPrint]);

  const handleSavePdf = async () => {
    if (!printablePaperRef.current || pdfBusy || !selectedReceipt) return;
    setPdfBusy(true);
    try {
      const { downloadVoucherPdf, voucherFileName } = await import('../../utils/voucherPdf');
      await downloadVoucherPdf(printablePaperRef.current, voucherFileName('receipt-voucher', selectedReceipt.receiptNumber));
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('تعذر إنشاء ملف PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleShareReceipt = async () => {
    if (!printablePaperRef.current || pdfBusy || !selectedReceipt) return;
    setPdfBusy(true);
    try {
      const { downloadVoucherPdf, shareVoucherPdf, voucherFileName } = await import('../../utils/voucherPdf');
      const fileName = voucherFileName('receipt-voucher', selectedReceipt.receiptNumber);
      const shared = await shareVoucherPdf(printablePaperRef.current, fileName, `سند قبض رقم ${selectedReceipt.receiptNumber}`);
      if (!shared) {
        await downloadVoucherPdf(printablePaperRef.current, fileName);
      }
    } catch (err) {
      console.error('Share failed', err);
    } finally {
      setPdfBusy(false);
    }
  };

  // Filtered Receipts
  const currencyOptionsList = useMemo(() => {
    const found = Array.from(new Set(receipts.map(r => r.currency).filter(Boolean) as string[]));
    return ['ALL', ...CURRENCY_PREFS, ...found.filter(c => !CURRENCY_PREFS.includes(c))];
  }, [receipts]);

  const matchesDateFilter = (iso: string): boolean => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return true;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const now = new Date();
    switch (dateFilter) {
      case 'TODAY':
        return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
      case 'THIS_WEEK': {
        const daysSinceMonday = (now.getDay() + 6) % 7;
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
        return dt >= weekStart && dt <= now;
      }
      case 'THIS_MONTH':
        return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
      case 'THIS_YEAR':
        return dt.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const filteredReceipts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return receipts.filter(r => {
      if (q) {
        const hay = `${r.receiptNumber} ${r.date} ${r.payerName} ${r.narration} ${r.referenceNumber || ''} ${r.sourceAccountNameAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (currencyFilter !== 'ALL' && r.currency !== currencyFilter) return false;
      if (dateFilter !== 'ALL' && !matchesDateFilter(r.date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, searchTerm, statusFilter, currencyFilter, dateFilter]);

  // KPI Statistics
  const postedReceipts = receipts.filter(r => r.status === 'POSTED');
  const totalReceived = postedReceipts.reduce((s, r) => s + localOf(r), 0);
  const postedCount = postedReceipts.length;
  const cashReceived = postedReceipts.filter(r => r.receiptMethod === 'CASH').reduce((s, r) => s + localOf(r), 0);
  const bankReceived = postedReceipts.filter(r => r.receiptMethod === 'BANK_TRANSFER' || r.receiptMethod === 'CHEQUE').reduce((s, r) => s + localOf(r), 0);

  const handleVoid = (r: ReceiptVoucher) => {
    if (confirm(r.status === 'POSTED' ? `سيُنشأ قيد عكسي مرتبط لسند القبض ${r.receiptNumber}. متابعة؟` : `هل تريد إلغاء بانتظار الترحيل سند القبض ${r.receiptNumber}؟`)) {
      const done = onVoidReceipt(r.id, r.journalEntryId);
      toast(done ? 'success' : 'error', done ? `تم عكس/إلغاء سند القبض ${r.receiptNumber}` : `لم يتم إلغاء سند القبض ${r.receiptNumber}`);
    }
  };

  const handleRestore = (r: ReceiptVoucher) => {
    toast('error', `السند ${r.receiptNumber} غير قابل للاستعادة؛ أنشئ سند استبدال جديداً.`);
  };

  const getMethodBadge = (method: ReceiptMethod) => {
    switch (method) {
      case 'CASH':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"><Wallet className="w-3.5 h-3.5" /> نقداً</span>;
      case 'BANK_TRANSFER':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30"><Landmark className="w-3.5 h-3.5" /> تحويل بنكي</span>;
      case 'CHEQUE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"><FileText className="w-3.5 h-3.5" /> شيك بنكي</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ReceiptVoucherStatus) => {
    switch (status) {
      case 'POSTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">مرحل</span>;
      case 'PENDING_POSTING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">بانتظار الترحيل</span>;
      case 'VOIDED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30">ملغى</span>;
      default:
        return null;
    }
  };

  return (
    <div data-enter-scope="" className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Receipt className="w-6 h-6" />}
        title="سندات القبض"
        subtitle="إدارة وإصدار سندات القبض النقدية والبنكية — تُحفظ بانتظار الترحيل من شاشة الإقفالات"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            سند قبض جديد
          </button>
        }
      />

      {/* إحصائيات سندات القبض */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المقبوضات (مرحلة)</p>
            <p className="text-xl font-black text-slate-800 mt-1">{fmt(totalReceived)} <span className="text-xs text-blue-600 font-normal">{baseCode}</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">السندات المرحلة</p>
            <p className="text-xl font-black text-slate-800 mt-1">{postedCount.toLocaleString('en-US')} <span className="text-xs text-slate-400 font-normal">سند</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">مقبوضات نقدية</p>
            <p className="text-xl font-black text-slate-800 mt-1">{fmt(cashReceived)} <span className="text-xs text-slate-400 font-normal">{baseCode}</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">مقبوضات بنكية وشيكات</p>
            <p className="text-xl font-black text-slate-800 mt-1">{fmt(bankReceived)} <span className="text-xs text-slate-400 font-normal">{baseCode}</span></p>
          </div>
        </div>
      </div>

      {/* شريط البحث والتصفية */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <F9SearchInput
            value={searchTerm}
            onChange={setSearchTerm}

            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pr-9 pl-9 py-2 text-xs text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            items={filteredReceipts}
            columns={[
              { label: 'رقم السند', render: r => <span className="font-mono font-bold text-blue-600">{r.receiptNumber}</span> },
              { label: 'التاريخ', render: r => <span className="text-slate-600 dark:text-slate-400">{formatDate(r.date)}</span> },
              { label: 'المقبوض منه', render: r => <span className="font-semibold text-slate-800">{r.payerName}</span> },
              { label: 'الإجمالي', render: r => <span className="font-mono font-bold text-slate-800">{fmt(r.totalAmount)} <span className="text-blue-600 text-sm">{r.currency || 'YER'}</span></span> }
            ]}
            searchText={r => [r.receiptNumber, r.date, r.payerName, r.narration, r.referenceNumber || '', r.totalAmount, r.currency, r.status, r.receiptMethod, r.sourceAccountNameAr].join(' ')}
            browseTitle="استعراض سندات القبض"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">العملة:</span>
            <select
              value={currencyFilter}
              onChange={e => setCurrencyFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">كافة العملات</option>
              {currencyOptionsList.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">التاريخ:</span>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">كل الفترات</option>
              <option value="TODAY">اليوم</option>
              <option value="THIS_WEEK">هذا الأسبوع</option>
              <option value="THIS_MONTH">هذا الشهر</option>
              <option value="THIS_YEAR">السنة المالية</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الحالة:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">الجميع</option>
              <option value="POSTED">مرحل</option>
              <option value="PENDING_POSTING">بانتظار الترحيل</option>
              <option value="VOIDED">ملغى</option>
            </select>
          </div>
        </div>
      </div>

      {receipts.length === 0 ? (
        /* حالة عدم وجود أي سندات */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Receipt className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">لا توجد سندات قبض مسجلة</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">ابدأ بإصدار أول سند قبض نقدي أو بنكي للنظام</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm"
            >
              + إضافة سند قبض
            </button>
          </div>
        </div>
      ) : (
        /* جدول سندات القبض */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse min-w-[1200px]">
              <thead className="bg-slate-100/90 dark:bg-slate-800/60 text-slate-700 dark:text-slate-400 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-center">رقم السند</th>
                  <th className="py-3 px-4 text-center">التاريخ</th>
                  <th className="py-3 px-4">الصندوق/البنك المودع فيه</th>
                  <th className="py-3 px-4">المقبوض منه / الحساب الدائن</th>
                  <th className="py-3 px-4 text-center">المبلغ والعملة</th>
                  <th className="py-3 px-4 text-center">المبلغ المحلي</th>
                  <th className="py-3 px-4">البيان العام</th>
                  <th className="py-3 px-4 text-center">حالة الترحيل</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400 text-xs font-bold">
                      لا توجد سندات قبض مطابقة لشروط التصفية الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map(r => {
                    const firstCredit = r.lines?.[0];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">{r.receiptNumber}</td>
                        <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{r.sourceAccountNameAr}</div>
                          <div className="text-sm text-slate-400">{RECEIPT_METHOD_LABELS[r.receiptMethod]}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{r.payerName}</div>
                          {firstCredit && (
                            <div className="text-sm text-slate-400 truncate max-w-[220px]">{firstCredit.accountCode} - {firstCredit.accountNameAr}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-700">
                          {fmt(r.totalAmount)} <span className="text-sm text-blue-600 font-semibold">{r.currency || 'YER'}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                          {fmt(localOf(r))} <span className="text-xs text-slate-400 font-normal">{baseCode}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{r.narration || '—'}</td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(r.status)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setSelectedReceipt(r); setIsDetailsOpen(true); }}
                              title="عرض تفاصيل السند"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {r.status === 'PENDING_POSTING' && (
                              <button
                                type="button"
                                onClick={() => openEditModal(r)}
                                title="تعديل السند قبل الترحيل"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setSelectedReceipt(r); setAutoPrint(false); setIsPrintOpen(true); }}
                              title="طباعة سند القبض"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {r.status !== 'VOIDED' ? (
                              <button
                                type="button"
                                onClick={() => handleVoid(r)}
                                title={r.status === 'POSTED' ? 'عكس وإلغاء السند' : 'إلغاء السند المنتظر'}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل السند */}
      {isDetailsOpen && selectedReceipt && (
        <ModalShell
          id="receipt-details"
          open={isDetailsOpen}
          title={`تفاصيل سند القبض: ${selectedReceipt.receiptNumber}`}
          subtitle={`صادر في ${formatDate(selectedReceipt.date)} — ${selectedReceipt.payerName}`}
          icon={Receipt}
          size="lg"
          onClose={() => setIsDetailsOpen(false)}
          footer={null}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <DetailBox label="رقم السند" value={selectedReceipt.receiptNumber} />
              <DetailBox label="التاريخ" value={formatDate(selectedReceipt.date)} />
              <DetailBox label="المقبوض منه" value={selectedReceipt.payerName} />
              <DetailBox label="طريقة الاستلام" value={RECEIPT_METHOD_LABELS[selectedReceipt.receiptMethod]} />
              <DetailBox label="حساب الاستلام (مدين)" value={selectedReceipt.sourceAccountNameAr} />
              <DetailBox label="الحالة" value={selectedReceipt.status === 'POSTED' ? 'مرحل' : selectedReceipt.status === 'PENDING_POSTING' ? 'بانتظار الترحيل' : 'ملغى'} />
              <DetailBox label="المبلغ والعملة" value={`${fmt(selectedReceipt.totalAmount)} ${selectedReceipt.currency || 'YER'}`} />
              <DetailBox label="المبلغ المحلي" value={`${fmt(localOf(selectedReceipt))} ${baseCode}`} />
              {selectedReceipt.referenceNumber && <DetailBox label="رقم المرجع" value={selectedReceipt.referenceNumber} />}
              {selectedReceipt.chequeBankName && <DetailBox label="بنك الشيك" value={selectedReceipt.chequeBankName} />}
              {selectedReceipt.chequeDueDate && <DetailBox label="تاريخ استحقاق الشيك" value={formatDate(selectedReceipt.chequeDueDate)} />}
              <DetailBox label="البيان العام" value={selectedReceipt.narration || '—'} />
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">بنود السند التفصيلية</h4>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">الحساب</th>
                      <th className="py-2 px-3">البيان</th>
                      <th className="py-2 px-3 text-center">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300">
                    {selectedReceipt.lines?.length ? selectedReceipt.lines.map(l => (
                      <tr key={l.id}>
                        <td className="py-2 px-3 font-semibold">{l.accountNameAr}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{l.description || '—'}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{fmt(l.totalAmount || l.amount)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">لا توجد بنود تفصيلية.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
              <span>أنشئ بواسطة: {selectedReceipt.createdBy || '—'}</span>
              {selectedReceipt.createdAt && <span>بتاريخ: {formatDate(selectedReceipt.createdAt)}</span>}
              {selectedReceipt.postedBy && <span>رُحّل بواسطة: {selectedReceipt.postedBy}</span>}
            </div>
          </div>
        </ModalShell>
      )}

      {/* CREATE RECEIPT VOUCHER MODAL */}
      {isCreateOpen && (
        <ModalShell
          id="receipt-voucher-create"
          open={!!isCreateOpen}
          onClose={() => closeCreateModal()}
          title={editingReceipt ? `تعديل سند قبض رقم ${editingReceipt.receiptNumber}` : 'إصدار سند قبض جديد'}
          subtitle={editingReceipt
            ? 'تعديل بيانات التوزيع المحاسبي وحساب الاستلام — متاح للسندات المنتظرة للترحيل فقط'
            : 'تعبئة بيانات التوزيع المحاسبي وحساب الاستلام — يُحفظ السند بانتظار الترحيل من شاشة الإقفالات'}
          icon={Receipt}
          size="xl"
          maxWidth="max-w-6xl"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
          maximized={isCreateExpanded}
          onToggleMaximize={() => setIsCreateExpanded(v => !v)}
          topRight={
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 font-mono text-sm font-bold text-sky-300">
              <Hash className="w-3.5 h-3.5" />
              {editingReceipt?.receiptNumber ?? nextReceiptNo}
            </span>
          }
        >
          <div className="flex flex-col h-full">
            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-right">
              {/* Row 1: General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">رقم السند {editingReceipt ? '(تلقائي — ثابت)' : '(تلقائي)'}</label>
                  <div className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-sky-300 flex items-center gap-2" dir="ltr">
                    <Hash className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                    {editingReceipt?.receiptNumber ?? nextReceiptNo}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ السند</label>
                  <SmartDateInput value={receiptDate} onChange={d => setReceiptDate(smartDateToIso(d))} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">اسم السداد / المدفوع منه *</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={e => setPayerName(e.target.value)}

                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">طريقة الاستلام</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReceiptMethodChange('CASH')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        receiptMethod === 'CASH'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      نقداً
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReceiptMethodChange('BANK_TRANSFER')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        receiptMethod === 'BANK_TRANSFER'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      تحويل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReceiptMethodChange('CHEQUE')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        receiptMethod === 'CHEQUE'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      شيك
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Source Account, Currency & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {receiptMethod === 'CASH' ? 'الصندوق النقدي المستلم (من)' : receiptMethod === 'BANK_TRANSFER' ? 'البنك / الحساب المصرفي المستلم' : 'البنك المستلم للشيك'}
                  </label>
                  <select
                    value={selectedSourceEntityId}
                    onChange={e => {
                      const entityId = e.target.value;
                      setSelectedSourceEntityId(entityId);
                      const selectedOpt = getSourceOptions().find(o => o.id === entityId);
                      if (selectedOpt) {
                        setSelectedSourceAccountId(selectedOpt.accountId);
                      }
                      // تطبيق العملة الافتراضية للصندوق/البنك المحدد
                      const defCode = sourceType === 'CASH_BOX'
                        ? cashBoxes.find(b => b.id === entityId)?.defaultCurrency
                        : sourceType === 'BANK_ACCOUNT'
                          ? bankAccounts.find(b => b.id === entityId)?.defaultCurrency
                          : undefined;
                      if (defCode && currencyOptions.some(c => c.code === defCode)) {
                        applyCurrency(defCode);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {getSourceOptions().map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">عملة السند (حسب الصندوق/البنك)</label>
                  <select
                    value={currency}
                    onChange={e => applyCurrency(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {sourceCurrencies().map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 leading-none">سعر الصرف مقابل {baseCode}</label>
                      <ExchangeRateField
                        value={exchangeRate}
                        onChange={v => setExchangeRate(v)}
                        disabled={isBaseCurrency}
                        isBase={isBaseCurrency}
                        min={rateGuard.boundsOf(currency).min}
                        max={rateGuard.boundsOf(currency).max}
                        currencyCode={currency}
                        inputClassName="w-full bg-slate-900 border rounded-xl px-2 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        className="mt-1.5"
                      />
                      <div className="min-h-[1.05rem] mt-1.5 leading-none"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 leading-none">المبلغ المحلي ({baseCode})</label>
                      {isBaseCurrency ? (
                        <AmountInput
                          value={debitLocalAmount || ''}
                          onChange={handleDebitLocalAmountChange}
                          disabled={!headerCurrencyReady}

                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      ) : (
                        <AmountInput
                          value={debitLocalTotal}
                          onChange={handleDebitLocalAmountChange}
                          disabled={!headerCurrencyReady}

                          title="تحرير المبلغ المحلي يعيد حساب سعر الصرف تلقائياً = المحلي ÷ الأجنبي"
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      )}
                      <div className="min-h-[1.05rem] mt-1.5 leading-none"></div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 leading-none">المبلغ الأجنبي {!isBaseCurrency && `(${currency})`}</label>
                  {isBaseCurrency ? (
                    <div
                      className="w-full bg-slate-900/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-500 text-center select-none"
                      title="العملة الأساسية — لا يوجد مبلغ أجنبي"
                    >
                      0.00
                    </div>
                  ) : (
                    <AmountInput
                      value={foreignTotalAmount || ''}
                      onChange={handleDebitForeignAmountChange}
                      disabled={!headerCurrencyReady}

                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}
                  <div className="min-h-[1.05rem] mt-1.5 leading-none"></div>
                </div>

                <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {receiptMethod === 'CASH' ? 'رقم الإيصال / المرجع (اختياري)' : receiptMethod === 'CHEQUE' ? 'رقم الشيك (Cheque Number) *' : 'رقم الحوالة / الإشعار البنكي (Transfer Ref No) *'}
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}

                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  {receiptMethod === 'CHEQUE' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ استحقاق الشيك (Cheque Due Date) *</label>
                      <SmartDateInput value={chequeDueDate} onChange={d => setChequeDueDate(smartDateToIso(d))} />
                    </div>
                  )}

                  <div className={receiptMethod === 'CHEQUE' ? '' : 'sm:col-span-2'}>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">البيان العام لسند القبض</label>
                    <input
                      type="text"
                      value={narration}
                      onChange={e => setNarration(e.target.value)}

                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* فاصل بين بيانات المدين وبيانات الدائن */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">بيانات المدين (المستلم للمقبوض)</span>
                <div className="h-px flex-1 bg-slate-700/80" />
                <span className="text-xs font-bold text-sky-400 whitespace-nowrap">بيانات الدائن (الحسابات المستحقة)</span>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    جدول الحسابات والبنود المستحقة عليها القبض (دائن)
                  </h4>
                  <button
                    type="button"
                    data-enter-nav="add-line"
                    onClick={() => {
                      setLines(prev => [
                        ...prev,
                        {
                          id: `line-${Date.now()}-${prev.length + 1}`,
                          controlId: '',
                          accountId: '',
                          description: '',
                          amount: 0,
                          costCenterId: '',
                          currency,
                          exchangeRate,
                          referenceNumber: ''
                        }
                      ]);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة سطر حساب
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  <div className="overflow-x-auto overflow-y-visible custom-scrollbar">
                    <table className="w-full text-right text-sm min-w-[1450px]">
                      <thead>
                        <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                          <th className="p-3 w-10 min-w-[40px] text-center whitespace-nowrap" title="#">#</th>
                          <th className="p-3 min-w-[260px] whitespace-nowrap" title="الحساب المحاسبي (المستوى 5) — اضغط F9 للبحث">الحساب المحاسبي (المستوى 5) *</th>
                          <th className="p-3 min-w-[150px] whitespace-nowrap" title="الحساب المساعد (Sub-Ledger) — يظهر عند الحسابات ذات الكيان المساعد">الحساب المساعد (Sub-Ledger)</th>
                          <th className="p-3 min-w-[95px] whitespace-nowrap" title="العملة">العملة</th>
                          <th className="p-3 min-w-[90px] whitespace-nowrap" title="سعر الصرف">سعر الصرف</th>
                          <th className="p-3 min-w-[240px] whitespace-nowrap" title="البيان التفصيلي للسطر">البيان التفصيلي للسطر</th>
                          <th className="p-3 min-w-[130px] whitespace-nowrap" title={`المبلغ المحلي (${baseCode})`}>المبلغ المحلي ({baseCode})</th>
                          <th className="p-3 min-w-[130px] whitespace-nowrap" title="المبلغ الأجنبي">المبلغ الأجنبي</th>
                          <th className="p-3 min-w-[140px] whitespace-nowrap" title="مركز التكلفة">مركز التكلفة</th>
                          <th className="p-3 min-w-[130px] whitespace-nowrap" title="رقم المرجع">رقم المرجع</th>
                          <th className="p-3 w-12 min-w-[45px] text-center whitespace-nowrap" title=""></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {lines.map((line, idx) => {
                          const computed = computedLines[idx];
                          const baseLine = !line.currency || line.currency === baseCurrencyCode;
                          const slType = line.subLedgerType || (line.accountId ? subLedgerTypeOf(accounts.find(a => a.id === line.accountId), subLedgerDataset) : 'NONE');
                          // السلسلة المتسلسلة: العملة وسعر الصرف لا يُفعّلان إلا بعد اكتمال الخطوة السابقة
                          const currencyActive = !!line.accountId && (slType === 'NONE' || !!line.subLedgerId);
                          // النطاق المسموح لسعر تحويل السطر (الأساسية: {1..1})
                          const lineBounds = rateGuard.boundsOf(line.currency || currency);
                          return (
                            <tr key={line.id} data-rv-line={line.id} className="hover:bg-slate-900/40">
                              <td className="p-2.5 text-center text-slate-500 dark:text-slate-400 font-mono">{idx + 1}</td>
                              <td className="p-2.5">
                                <div className="relative">
                                  <input
                                    type="text"
                                    readOnly
                                    value={computed.accountId ? `${computed.accountCode} - ${computed.accountNameAr}` : ''}
                                    onKeyDown={e => {
                                      if (e.key === 'F9') {
                                        e.preventDefault();
                                        openF9(line.id);
                                      }
                                    }}
                                    onClick={() => openF9(line.id)}

                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                                  />
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => openF9(line.id)}
                                    title="اضغط F9 للبحث في دليل الحسابات"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-colors cursor-pointer"
                                  >
                                    F9
                                  </button>
                                </div>
                              </td>
                              <td className="p-2.5">
                                {!line.accountId ? (
                                  <div
                                    className="w-full bg-slate-900/40 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 flex items-center justify-between select-none"
                                    title="اختر الحساب المحاسبي أولاً لتفعيل الحساب المساعد"
                                  >
                                    <span>—</span>
                                    <Lock className="w-3.5 h-3.5 opacity-50" />
                                  </div>
                                ) : slType === 'NONE' ? (
                                  <div
                                    className="w-full bg-slate-900/40 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-500 flex items-center justify-between select-none"
                                    title="هذا الحساب لا يتطلب كياناً مساعداً"
                                  >
                                    <span>بدون حساب مساعد</span>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                                  </div>
                                ) : (
                                  <div data-subledger-line={line.id}>
                                    <SubLedgerF9Cell
                                      dataset={subLedgerDataset}
                                      account={accounts.find(a => a.id === line.accountId)}
                                      subLedgerId={line.subLedgerId}
                                      subLedgerName={line.subLedgerName}
                                      onChange={(subLedgerId, subLedgerName) => {
                                        // تنزيل العملة الافتراضية للكيان المساعد (إن كانت معتمدة) أو عملة السند تلقائياً
                                        const defCode = subLedgerId
                                          ? defaultCurrencyOfSubLedger(line.subLedgerType, subLedgerId)
                                          : undefined;
                                        const approved = defCode && currencyOptions.some(c => c.code === defCode) ? defCode : undefined;
                                        setLines(prev => prev.map(l => l.id === line.id ? {
                                          ...l,
                                          subLedgerId,
                                          subLedgerName,
                                          currency: subLedgerId ? (approved || l.currency || currency) : currency,
                                          exchangeRate: subLedgerId
                                            ? (approved ? (currencyOptions.find(c => c.code === approved)?.exchangeRate || 1) : (l.exchangeRate || exchangeRate))
                                            : exchangeRate
                                        } : l));
                                        if (subLedgerId) {
                                          window.setTimeout(() => {
                                            const row = document.querySelector<HTMLElement>(`tr[data-rv-line="${line.id}"]`);
                                            const desc = row?.querySelector<HTMLElement>(`input[data-description-line="${line.id}"]`);
                                            desc?.focus({ preventScroll: true });
                                          }, 80);
                                        }
                                      }}
                                      compact
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                {currencyActive ? (
                                  <select
                                    data-currency-line={line.id}
                                    value={line.currency || currency}
                                    onChange={e => {
                                      const code = e.target.value;
                                      const found = currencyOptions.find(c => c.code === code);
                                      setLines(prev => prev.map(l => {
                                        if (l.id !== line.id) return l;
                                        const rate = found ? found.exchangeRate : (l.exchangeRate || 1);
                                        if (code === baseCurrencyCode) {
                                          // عملة أساسية: المبلغ المحلي هو المدخل الفعلي، والأجنبي = 0
                                          const local = Number(l.localAmount ?? l.amount) || 0;
                                          return { ...l, currency: code, exchangeRate: 1, amount: local, localAmount: local };
                                        }
                                        // عملة أجنبية: المبلغ الأجنبي هو المدخل الفعلي، والمحلي = أجنبي × سعر الصرف
                                        const foreign = Number(l.amount) > 0
                                          ? Number(l.amount)
                                          : (Number(l.localAmount) > 0 ? Math.round(Number(l.localAmount) / rate * 100) / 100 : 0);
                                        return { ...l, currency: code, exchangeRate: rate, amount: foreign, localAmount: Math.round(foreign * rate * 100) / 100 };
                                      }));
                                    }}
                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                                  >
                                    {currencyOptions.map(c => (
                                      <option key={c.code} value={c.code}>
                                        {c.code}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <select
                                    disabled
                                    aria-disabled="true"
                                    className="w-full bg-slate-900/40 border border-slate-800 rounded-xl px-2 py-1.5 text-sm text-slate-600 text-center disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    <option value="">—</option>
                                  </select>
                                )}
                              </td>
                              <td className="p-2.5">
                                {currencyActive ? (
                                  <ExchangeRateField
                                    value={line.exchangeRate ?? 1}
                                    onChange={val => {
                                      const next = handleCurrencyFieldChange('rate', val, {
                                        foreignAmount: Number(line.amount) || 0,
                                        exchangeRate: Number(line.exchangeRate) || 1,
                                        localAmount: Number(line.localAmount) || 0,
                                      });
                                      setLines(prev => prev.map(l => l.id === line.id ? { ...l, exchangeRate: next.exchangeRate, localAmount: next.localAmount } : l));
                                    }}
                                    disabled={baseLine}
                                    isBase={baseLine}
                                    min={lineBounds.min}
                                    max={lineBounds.max}
                                    currencyCode={line.currency || currency}
                                    compact
                                    inputClassName="w-full bg-slate-900 border rounded-xl px-2 py-1.5 text-sm text-white font-mono text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                ) : (
                                  <input
                                    disabled
                                    aria-disabled="true"

                                    className="w-full bg-slate-900/40 border border-slate-800 rounded-xl px-2 py-1.5 text-sm text-slate-600 text-center disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                )}
                              </td>
                              <td className="p-2.5">
                                <LineNarrationField
                                  value={line.description}
                                  onChange={val => {
                                    setLines(prev => prev.map(l => l.id === line.id ? { ...l, description: val } : l));
                                  }}
                                  mainNarration={narration.trim() || lines[0]?.description || ''}
                                  previousNarration={idx > 0 ? lines[idx - 1]?.description || '' : ''}
                                  hasPrevious={idx > 0}
                                  rowIndex={idx}

                                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                                  inputProps={{ 'data-description-line': line.id }}
                                />
                              </td>
                              <td className="p-2.5">
                                {baseLine ? (
                                  <AmountInput
                                    value={line.localAmount ?? ''}
                                    onChange={v => {
                                      const local = parseFloat(v) || 0;
                                      setLines(prev => prev.map(l => l.id === line.id ? { ...l, localAmount: local, amount: local } : l));
                                    }}
                                    disabled={!currencyActive}

                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                ) : (
                                  <AmountInput
                                    value={computed.localAmount || ''}
                                    onChange={v => {
                                      const val = parseFloat(v) || 0;
                                      const foreign = Number(line.amount) || 0;
                                      const next = handleCurrencyFieldChange('local', val, {
                                        foreignAmount: foreign,
                                        exchangeRate: Number(line.exchangeRate) || 1,
                                        localAmount: Number(computed.localAmount) || 0,
                                      });
                                      setLines(prev => prev.map(l => l.id === line.id ? { ...l, localAmount: next.localAmount, exchangeRate: next.exchangeRate } : l));
                                    }}
                                    disabled={!currencyActive}

                                    title="تحرير المبلغ المحلي يعيد حساب سعر الصرف تلقائياً = المحلي ÷ الأجنبي"
                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                )}
                              </td>
                              <td className="p-2.5">
                                {!baseLine ? (
                                  <AmountInput
                                    value={line.amount || ''}
                                    onChange={v => {
                                      const val = parseFloat(v) || 0;
                                      const next = handleCurrencyFieldChange('foreign', val, {
                                        foreignAmount: Number(line.amount) || 0,
                                        exchangeRate: Number(line.exchangeRate) || 1,
                                        localAmount: Number(computed.localAmount) || 0,
                                      });
                                      setLines(prev => prev.map(l => l.id === line.id ? { ...l, amount: next.foreignAmount, localAmount: next.localAmount } : l));
                                    }}
                                    disabled={!currencyActive}

                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                ) : (
                                  <div
                                    className="w-full bg-slate-900/40 border border-slate-800 rounded-xl px-2.5 py-1.5 text-sm font-mono text-slate-500 text-center select-none"
                                    title="العملة الأساسية — لا يوجد مبلغ أجنبي"
                                  >
                                    0.00
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <select
                                  value={line.costCenterId}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setLines(prev => prev.map(l => l.id === line.id ? { ...l, costCenterId: val } : l));
                                  }}
                                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                                >
                                  <option value="">بدون مركز</option>
                                  {costCenters.map(cc => (
                                    <option key={cc.id} value={cc.id}>
                                      {cc.code} - {cc.nameAr}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  value={line.referenceNumber}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setLines(prev => prev.map(l => l.id === line.id ? { ...l, referenceNumber: val } : l));
                                  }}

                                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                                />
                              </td>
                              <td className="p-2.5 text-center">
                                {lines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))}
                                    className="text-slate-500 dark:text-slate-400 hover:text-red-400 p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Summary Card — المطابقة ثنائية الجانب (مدين/دائن) */}
              <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-xs text-slate-400">إجمالي المقبوض (مدين): </span>
                    <div className="font-mono text-base font-black text-emerald-300 mt-0.5">{debitLocalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
                    {!isBaseCurrency && (
                      <div className="font-mono text-sm text-slate-400 mt-0.5">{debitForeignTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                    <span className="text-xs text-slate-400">إجمالي بنود القبض (دائن): </span>
                    <div className="font-mono text-base font-black text-sky-300 mt-0.5">{creditLocalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${Math.abs(balanceDifference) > 0.005 ? 'bg-red-500/15 border-red-500/50' : 'bg-emerald-500/15 border-emerald-500/30'}`}>
                    <span className="text-xs text-slate-400">الفارق (المدين − الدائن): </span>
                    <div className={`font-mono text-base font-black mt-0.5 ${Math.abs(balanceDifference) > 0.005 ? 'text-red-300' : 'text-emerald-300'}`}>{balanceDifference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
              <AttachmentPicker documents={attachments} onChange={setAttachments} uploadedBy={currentUserName} documentType="RECEIPT_SUPPORT" />
              <button
                type="button"
                onClick={() => closeCreateModal()}
                className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                إلغاء
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveReceiptAndPrint}
                  disabled={!canPost || rateBlocked}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  حفظ السند مع الطباعة
                </button>
                <button
                  type="button"
                  onClick={handleSaveReceipt}
                  disabled={rateBlocked}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-sky-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-sky-500 disabled:hover:to-blue-600"
                >
                  حفظ السند الحسابي
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {/* F9 — نافذة البحث في دليل الحسابات (المستوى الخامس) */}
      {f9Open && (
        <ModalShell
          id="receipt-voucher-f9"
          open={!!f9Open}
          onClose={() => setF9Open(false)}
          title={
            <span className="flex items-center gap-2">
              البحث في دليل الحسابات
              <span className="text-xs font-semibold text-slate-400">({f9List.length} حساب من المستوى الخامس)</span>
            </span>
          }
          icon={FileText}
          size="lg"
          footer={null}
          bodyClassName="p-0"
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={f9Query}
                  onChange={e => setF9Query(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setF9Open(false);
                    if (e.key === 'Enter' && f9List.length > 0) {
                      applyF9Account(f9List[0]);
                    }
                  }}

                  className="w-full px-9 py-2.5 text-sm glass-input rounded-xl"
                />
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
              {f9List.length === 0 ? (
                <div className="py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <Search className="w-10 h-10 text-slate-600" />
                    <p className="font-bold text-white">لا توجد حسابات مطابقة</p>
                    <p className="text-sm">جرّب كلمة أخرى أو أعد ضبط البحث.</p>
                  </div>
                </div>
              ) : (
                f9List.map(account => (
                  <button
                    key={account.id}
                    onClick={() => applyF9Account(account)}
                    className="w-full text-right flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 hover:bg-sky-500/10 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-400 text-sm">{account.code}</span>
                        <span className="font-bold text-white whitespace-nowrap">{account.nameAr}</span>
                        {!account.isActive && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full border border-slate-700 text-slate-500">موقوف</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 font-mono whitespace-nowrap truncate">{account.nameEn}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* PRINT / VIEW RECEIPT MODAL */}
      {isPrintOpen && selectedReceipt && (
        <ModalShell
          id="receipt-voucher-print"
          open={!!(isPrintOpen && selectedReceipt)}
          onClose={() => setIsPrintOpen(false)}
          title={`معاينة سند القبض الرسمي (${selectedReceipt.receiptNumber})`}
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
                طباعة السند
              </button>
              <button
                onClick={handleSavePdf}
                disabled={pdfBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-md disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {pdfBusy ? 'جاري الإنشاء...' : 'حفظ PDF'}
              </button>
              <button
                onClick={handleShareReceipt}
                disabled={pdfBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-md disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                مشاركة
              </button>
            </div>
          }
        >
          {/* Printable Receipt Paper Layout */}
          <div ref={printablePaperRef} id="printable-receipt-paper" className="paper print-area bg-white text-slate-900 text-right" dir="rtl">
            <div className="p-8">
              <VoucherPrintTemplate
                voucherTitleAr={
                  selectedReceipt.receiptMethod === 'CASH' ? 'سند قبض نقدي' :
                  selectedReceipt.receiptMethod === 'BANK_TRANSFER' ? 'سند قبض بنكي (تحويل)' :
                  'سند قبض بشيك'
                }
                voucherTitleEn="Receipt Voucher"
                documentNumber={selectedReceipt.receiptNumber}
                documentDate={selectedReceipt.date}
                currency={selectedReceipt.currency || 'YER'}
                currentUserName={selectedReceipt.createdBy}
                metadata={[
                  { label: 'المدفوع منه', value: selectedReceipt.payerName },
                  { label: 'طريقة الاستلام', value: selectedReceipt.receiptMethod === 'CASH' ? 'نقداً إلى الصندوق' : selectedReceipt.receiptMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك بنكي' },
                  { label: 'المودع فيه', value: selectedReceipt.sourceAccountNameAr },
                  ...(selectedReceipt.referenceNumber ? [{ label: 'رقم المرجع / الشيك', value: selectedReceipt.referenceNumber }] : []),
                  ...(selectedReceipt.chequeBankName ? [{ label: 'بنك الشيك', value: selectedReceipt.chequeBankName }] : []),
                  ...(selectedReceipt.chequeDueDate ? [{ label: 'تاريخ الاستحقاق', value: formatDate(selectedReceipt.chequeDueDate) }] : []),
                  { label: 'سعر الصرف', value: String(selectedReceipt.exchangeRate || 1) },
                  { label: 'البيان العام', value: selectedReceipt.narration },
                ]}
                tafqeetText={selectedReceipt.amountInWordsAr}
                totalAmountText={`${selectedReceipt.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selectedReceipt.currency || 'YER'}`}
                localEquivalentText={`${(selectedReceipt.totalAmount * (selectedReceipt.exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseCode}`}
                signatures={[
                  { roleLabelAr: 'أعده / المحاسب', name: selectedReceipt.createdBy },
                  { roleLabelAr: 'استلمت المبلغ (أمين الصندوق)' },
                  { roleLabelAr: 'المراجع المالي' },
                  { roleLabelAr: 'المدير المالي / الاعتماد' },
                ]}
              >
                <table>
                  <thead>
                    <tr>
                      <th className="text-center">#</th>
                      <th>رقم الحساب</th>
                      <th>اسم الحساب المحاسبي</th>
                      <th>البيان / الشرح</th>
                      <th>رقم المرجع</th>
                      <th className="text-left">المبلغ ({selectedReceipt.currency || 'YER'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.lines.map((l, idx) => (
                      <tr key={l.id}>
                        <td className="text-center font-mono">{idx + 1}</td>
                        <td className="font-mono">{l.accountCode}</td>
                        <td className="font-semibold">{l.accountNameAr}</td>
                        <td className="text-slate-600">{l.description}</td>
                        <td className="font-mono">{l.referenceNumber || '—'}</td>
                        <td className="font-bold text-left font-mono whitespace-nowrap">{l.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {l.currency || selectedReceipt.currency || 'YER'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="text-left font-bold">الإجمالي النهائي:</td>
                      <td className="font-bold text-left font-mono whitespace-nowrap">{selectedReceipt.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedReceipt.currency || 'YER'}</td>
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
