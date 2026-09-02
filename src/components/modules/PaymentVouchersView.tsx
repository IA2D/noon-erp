import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileCheck2,
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
  CreditCard,
  Hash,
  Trash2,
  Download,
  Share2,
  Lock,
  Pencil,
  RotateCw,
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
  PaymentMethod,
  PaymentVoucher,
  PaymentVoucherLine,
  PaymentVoucherStatus,
  SubLedgerType,
  Vendor,
  VoucherSourceType
} from '../../types/erp';
import { isPostingAccount, nextPaymentVoucherNumber, level4GroupOf } from '../../utils/accountingEngine';
import { validateSubLedgerLines, SubLedgerDataset, subLedgerTypeOf, resolveSubLedgerName } from '../../utils/subLedger';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useExchangeRateGuard } from '../../hooks/useExchangeRateGuard';
import { tafqeet } from '../../utils/tafqeet';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import ModalShell from '../ui/ModalShell';
import { useModalStackStatus } from '../ui/ModalStack';
import { useMaximizableWindow, WindowControls, HiddenWindowBar } from '../ui/MaximizableWindow';
import AmountInput from '../AmountInput';
import SubLedgerF9Cell from '../ui/SubLedgerF9Cell';
import LineNarrationField from '../ui/LineNarrationField';
import ExchangeRateField from '../ui/ExchangeRateField';
import { useToast } from '../ui/Toast';
import { useTabDirty } from '../../tabs/TabsContext';
import VoucherPrintTemplate from '../ui/VoucherPrintTemplate';
import { handleCurrencyFieldChange } from '../../utils/currencyMath';
import SmartDateInput, { smartDateToIso, todayIso } from '../common/SmartDateInput';
import AttachmentPicker from '../ui/AttachmentPicker';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { openDesktopPrintPreview } from '../../utils/desktopPrintPreview';

interface Props {
  vouchers: PaymentVoucher[];
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  costCenters: CostCenter[];
  journals: JournalEntry[];
  currencies: Currency[];
  onAddVoucher: (voucher: PaymentVoucher, journalEntry?: JournalEntry) => void;
  onUpdateVoucher: (id: string, voucher: PaymentVoucher, journalEntry?: JournalEntry, oldJournalEntryId?: string) => void;
  onVoidVoucher: (id: string, journalEntryId?: string) => void;
  onRestoreVoucher: (id: string, journalEntryId?: string) => void;
  currentUserName: string;
  closedYears?: string[];
  closedMonths?: string[];
  /** صلاحية تجاوز الحدود المعتمدة لسعر التحويل (CAN_OVERRIDE_EXCHANGE_LIMITS) */
  canOverrideExchangeLimits?: boolean;
  /** تسجيل تحذيري في سجل التدقيق عند تجاوز حدود سعر الصرف بصلاحية خاصة */
  onAuditLog?: (details: string) => void;
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

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقداً من الصندوق',
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك بنكي'
};

export default function PaymentVouchersView({
  vouchers,
  accounts,
  cashBoxes,
  bankAccounts,
  employees,
  customers,
  vendors,
  costCenters,
  journals,
  currencies,
  onAddVoucher,
  onUpdateVoucher,
  onVoidVoucher,
  onRestoreVoucher,
  currentUserName,
  closedYears,
  closedMonths,
  canOverrideExchangeLimits,
  onAuditLog
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PaymentVoucherStatus>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');

  const { isMaximized, mode, toggleMaximize, hide, restore } = useMaximizableWindow();
  const modalStatus = useModalStackStatus('payment-voucher-create');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  // السند قيد التعديل (قبل الترحيل فقط) — عند تعيينه، تُعبَّأ النافذة ببياناته ويصبح الحفظ تحديثاً
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucher | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printablePaperRef = useRef<HTMLDivElement>(null);
  const handlePrintPreview = () => openDesktopPrintPreview(printablePaperRef.current, `سند صرف ${selectedVoucher?.voucherNumber || ''}`, 'portrait');

  // Form State for New Payment Voucher
  const { active: currencyOptions, baseCode } = useActiveCurrencies(currencies);
  // واقي حدود سعر التحويل: نطاق كل عملة (min/max) من دليل العملات
  const rateGuard = useExchangeRateGuard(currencies);
  const toast = useToast();
  const [voucherDate, setVoucherDate] = useState<string>(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [sourceType, setSourceType] = useState<VoucherSourceType>('CASH_BOX');
  const [selectedSourceEntityId, setSelectedSourceEntityId] = useState<string>('');
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>('');
  const [payeeName, setPayeeName] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [chequeDueDate, setChequeDueDate] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [currency, setCurrency] = useState<string>(baseCode);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  // المبلغ الأجنبي الإجمالي لجهة الدائن (رأس السند) — المدخل الفعلي في العملات الأجنبية
  const [foreignTotalAmount, setForeignTotalAmount] = useState<number>(0);
  // المبلغ المحلي الإجمالي لجهة الدائن — قابل للتحرير في العملة الأساسية فقط
  const [creditLocalAmount, setCreditLocalAmount] = useState<number>(0);
  const [attachments, setAttachments] = useState<SupportingDocument[]>([]);

  const baseCurrencyCode = baseCode;
  const isBaseCurrency = currency === baseCurrencyCode;

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

  /** جاهزية جهة الدائن لإدخال المبالغ: عملة محددة ومحمّلة من الصندوق/البنك المحدد
      (قفل حقلي المبلغ المحلي والأجنبي حتى يتم تحديد/تحميل عملة الصندوق أو البنك) */
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

  // الرقم التسلسلي التالي لسند الصرف — يُولّد تلقائياً ويظهر في شاشة الإضافة
  const nextVoucherNo = nextPaymentVoucherNumber(vouchers);

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

  // علامة "تعديلات غير محفوظة" على تبويب سندات الصرف
  const setDirty = useTabDirty('PAYMENT_VOUCHERS');
  useEffect(() => {
    const hasContent =
      payeeName.trim() !== '' ||
      referenceNumber.trim() !== '' ||
      narration.trim() !== '' ||
      selectedSourceEntityId !== '' ||
      Number(foreignTotalAmount) > 0 ||
      Number(creditLocalAmount) > 0 ||
      lines.some(l => l.accountId && Number(l.amount) > 0);
    setDirty(isCreateOpen && hasContent);
  }, [isCreateOpen, payeeName, referenceNumber, narration, selectedSourceEntityId, foreignTotalAmount, creditLocalAmount, lines, setDirty]);

  const subLedgerDataset: SubLedgerDataset = { accounts, employees, customers, vendors, cashBoxes, banks: bankAccounts, costCenters };

  const reportAccountName = (line: PaymentVoucherLine): string => {
    const linkedJournal = selectedVoucher?.journalEntryId
      ? journals.find(entry => entry.id === selectedVoucher.journalEntryId)
      : journals.find(entry => entry.type === 'PV' && entry.referenceCode === selectedVoucher?.voucherNumber);
    const linkedLine = linkedJournal?.lines.find(entryLine => entryLine.accountId === line.accountId && !!entryLine.subLedgerId);
    const type = line.subLedgerType
      || linkedLine?.subLedgerType
      || subLedgerTypeOf(accounts.find(account => account.id === line.accountId), subLedgerDataset);
    const subLedgerId = line.subLedgerId || linkedLine?.subLedgerId;
    return line.subLedgerName
      || linkedLine?.subLedgerName
      || (subLedgerId && type !== 'NONE' ? resolveSubLedgerName(subLedgerDataset, type, subLedgerId) : '')
      || line.accountNameAr;
  };

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
  const [f9ActiveIndex, setF9ActiveIndex] = useState(0);
  const f9SearchRef = useRef<HTMLInputElement>(null);

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
    setF9ActiveIndex(0);
    setF9Open(true);
    window.setTimeout(() => f9SearchRef.current?.focus({ preventScroll: true }), 60);
  };

  useEffect(() => {
    if (!f9Open) return;
    const timer = window.setTimeout(() => f9SearchRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [f9Open]);

  useEffect(() => {
    if (!f9Open) return;
    document.querySelector<HTMLElement>(`#payment-voucher-f9 [data-f9-account-index="${f9ActiveIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [f9ActiveIndex, f9Open]);

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
      const row = document.querySelector<HTMLElement>(`tr[data-pv-line="${targetLineId}"]`);
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
      return bankAccounts.filter(b => paymentMethod === 'CHEQUE' ? b.entityType === 'BANK' : b.entityType === 'EXCHANGE').map(b => ({
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
    setVoucherDate(todayIso());
    setPaymentMethod('CASH');
    setSourceType('CASH_BOX');
    setSelectedSourceEntityId('');
    setSelectedSourceAccountId('');
    setPayeeName('');
    setReferenceNumber('');
    setChequeDueDate('');
    setNarration('');
    setCurrency(baseCode);
    setExchangeRate(1.0);
    setForeignTotalAmount(0);
    setCreditLocalAmount(0);
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
    setEditingVoucher(null);
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
  const openEditModal = (voucher: PaymentVoucher) => {
    if (modalStatus.isRegistered && modalStatus.isMinimized) {
      modalStatus.restore();
      return;
    }
    if (modalStatus.isRegistered) {
      modalStatus.raise();
      return;
    }
    resetForm();
    setEditingVoucher(voucher);
    setAttachments(voucher.attachments || []);
    const isBase = !voucher.currency || voucher.currency === baseCode;
    setVoucherDate(voucher.date);
    setPaymentMethod(voucher.paymentMethod);
    setSourceType(voucher.sourceType);
    setSelectedSourceEntityId(voucher.sourceEntityId || '');
    setSelectedSourceAccountId(voucher.sourceAccountId);
    setPayeeName(voucher.payeeName);
    setReferenceNumber(voucher.referenceNumber || '');
    setChequeDueDate(voucher.chequeDueDate || '');
    setNarration(voucher.narration);
    setCurrency(voucher.currency || baseCode);
    setExchangeRate(voucher.exchangeRate || 1);
    setForeignTotalAmount(isBase ? 0 : (voucher.subtotalAmount || voucher.totalAmount || 0));
    setCreditLocalAmount(isBase ? (voucher.totalAmount || 0) : 0);
    setLines(
      (voucher.lines.length > 0 ? voucher.lines : []).map(l => ({
        id: l.id,
        controlId: '',
        accountId: l.accountId,
        description: l.description,
        amount: Number(l.totalAmount) || Number(l.amount) || 0,
        localAmount: l.localAmount,
        costCenterId: l.costCenterId || '',
        currency: l.currency || voucher.currency || baseCode,
        exchangeRate: l.exchangeRate || voucher.exchangeRate || 1,
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
    setEditingVoucher(null);
  };

  // Handle source type change
  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
    let newSourceType: VoucherSourceType = 'CASH_BOX';
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
  const computedLines: PaymentVoucherLine[] = lines.map(line => {
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
      description: line.description || narration || 'مصروف سند صرف',
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
  // إجمالي المدين (محلي) = مجموع المعادلات المحلية لأسطر الحسابات المستفيدة
  const debitLocalTotal = Math.round(computedLines.reduce((sum, l) => sum + (l.localAmount ?? l.amount), 0) * 100) / 100;
  // إجمالي الدائن (محلي) — جهة الصندوق/البنك المسدد منه:
  //  - عملة أساسية: المبلغ المحلي المُدخل مباشرة من المستخدم
  //  - عملة أجنبية: المبلغ الأجنبي × سعر الصرف (يُحسب تلقائياً وفورياً)
  const creditLocalTotal = isBaseCurrency
    ? Math.round((Number(creditLocalAmount) || 0) * 100) / 100
    : Math.round(((Number(foreignTotalAmount) || 0) * (Number(exchangeRate) || 1)) * 100) / 100;
  // إجمالي الدائن (أجنبي) — صفر في العملة الأساسية
  const creditForeignTotal = isBaseCurrency ? 0 : Number(foreignTotalAmount) || 0;
  // الفارق بين المدين والدائن (محلي) — يجب أن يساوي صفراً للحفظ
  const debitCreditDifference = Math.round((debitLocalTotal - creditLocalTotal) * 100) / 100;
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
  // اكتمال السند يتطلب: أسطر كاملة (حساب + عملة + مبلغ > 0)، مبلغ دائن > 0، وتوازناً تاماً بين المدين والدائن
  const canPost =
    lines.length > 0 &&
    lines.every(l => !!l.accountId && !!l.currency && Number(l.amount) > 0) &&
    creditLocalTotal > 0 &&
    Math.abs(debitCreditDifference) <= 0.005;
  const wordsTafqeet = tafqeet(isBaseCurrency ? creditLocalTotal : creditForeignTotal, currencyNameAr, currencyFractionAr);

  // إدخال المبلغ الأجنبي لجهة الدائن (عملة أجنبية فقط) — يُحسب المبلغ المحلي تلقائياً = الأجنبي × سعر الصرف
  const handleForeignAmountChange = (v: string) => {
    const val = parseFloat(v) || 0;
    setForeignTotalAmount(val);
  };

  // إدخال المبلغ المحلي لجهة الدائن:
  //  - عملة أساسية: يُؤخذ مباشرة من المستخدم.
  //  - عملة أجنبية: يُعاد حساب سعر الصرف الفعلي فورياً = المحلي ÷ الأجنبي (ربط مثلثي تلقائي).
  const handleCreditLocalAmountChange = (v: string) => {
    const val = parseFloat(v) || 0;
    if (isBaseCurrency) {
      setCreditLocalAmount(val);
      return;
    }
    const foreign = Number(foreignTotalAmount) || 0;
    if (foreign > 0) {
      const next = handleCurrencyFieldChange('local', val, {
        foreignAmount: foreign,
        exchangeRate: Number(exchangeRate) || 1,
        localAmount: creditLocalTotal,
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
  const validateAndBuildVoucher = (): PaymentVoucher | null => {
    if (!payeeName.trim()) {
      toast('error', 'يرجى إدخال اسم المستفيد / المدفوع له.');
      return null;
    }

    if (!selectedSourceAccountId) {
      toast('error', 'يرجى اختيار الحساب أو الصندوق/البنك المسدد منه.');
      return null;
    }

    if (paymentMethod === 'CHEQUE' && !referenceNumber.trim()) {
      toast('error', 'يرجى إدخال رقم الشيك.');
      return null;
    }

    if (paymentMethod === 'CHEQUE' && !chequeDueDate) {
      toast('error', 'يرجى تحديد تاريخ استحقاق الشيك.');
      return null;
    }

    if (paymentMethod === 'BANK_TRANSFER' && !referenceNumber.trim()) {
      toast('error', 'يرجى إدخال رقم الحوالة / الإشعار البنكي.');
      return null;
    }

    // بوابة حدود سعر التحويل: منع الحفظ عند خروج أي سعر عن النطاق المسموح
    if (!enforceRateBoundaries()) return null;

    const invalidLine = lines.find(l => !l.accountId || !l.currency || Number(l.amount) <= 0);
    if (invalidLine) {
      toast('error', 'يرجى التأكد من اختيار الحساب والعملة وإدخال مبلغ أكبر من صفر لكل سطر في جدول الصرف.');
      return null;
    }

    if (creditLocalTotal <= 0) {
      toast('error', 'يرجى إدخال المبلغ الإجمالي لجهة الدائن (الصندوق/البنك المسدد منه) — يجب أن يكون أكبر من صفر.');
      return null;
    }

    // التحقق الموحد من الحسابات المساعدة قبل الحفظ (بأرقام الأسطر)
    const slCheck = validateSubLedgerLines(computedLines, accounts, subLedgerDataset);
    if (!slCheck.valid) {
      toast('error', slCheck.message || 'يرجى تحديد الحساب المساعد للسطر المطلوب.');
      return null;
    }

    if (Math.abs(debitCreditDifference) > 0.005) {
      toast('error', 'لا يمكن حفظ السند — يجب أن يتساوى إجمالي المدين مع إجمالي الدائن.');
      return null;
    }

    const liveSourceAccountId = sourceType === 'CASH_BOX'
      ? cashBoxes.find(item => item.id === selectedSourceEntityId)?.linkedAccountId || selectedSourceAccountId
      : bankAccounts.find(item => item.id === selectedSourceEntityId)?.linkedAccountId || selectedSourceAccountId;
    const sourceAccount = accounts.find(a => a.id === liveSourceAccountId);
    const sourceAccountName = sourceAccount ? sourceAccount.nameAr : 'حساب الصناديق / البنوك';
    // وضع التعديل: يُحتفظ برقم السند ومعرفه وبيانات إنشائه الأصلية
    const voucherId = editingVoucher?.id ?? `pv-${Date.now()}`;
    const nextVoucherNo = editingVoucher?.voucherNumber ?? nextPaymentVoucherNumber(vouchers);

    const newVoucher: PaymentVoucher = {
      id: voucherId,
      voucherNumber: nextVoucherNo,
      date: voucherDate,
      paymentMethod,
      sourceType,
      sourceEntityId: selectedSourceEntityId,
      sourceAccountId: liveSourceAccountId,
      sourceAccountNameAr: sourceAccountName,
      payeeName,
      referenceNumber: referenceNumber || undefined,
      chequeBankName: paymentMethod === 'CHEQUE'
        ? bankAccounts.find(b => b.id === selectedSourceEntityId)?.bankNameAr
        : undefined,
      chequeDueDate: paymentMethod === 'CHEQUE' ? chequeDueDate || undefined : undefined,
      narration: narration || `سند صرف إلى ${payeeName}`,
      currency,
      exchangeRate,
      lines: computedLines,
      subtotalAmount: isBaseCurrency ? creditLocalTotal : creditForeignTotal,
      totalAmount: isBaseCurrency ? creditLocalTotal : creditForeignTotal,
      amountInWordsAr: wordsTafqeet,
      attachments,
      status: 'PENDING_POSTING', // يُحفظ بانتظار الترحيل من شاشة «الإقفالات والترحيل والرقابة»
      createdBy: editingVoucher?.createdBy ?? currentUserName,
      createdAt: editingVoucher?.createdAt ?? new Date().toISOString()
    };

    if (editingVoucher) {
      onUpdateVoucher(editingVoucher.id, newVoucher);
    } else {
      onAddVoucher(newVoucher);
    }
    return newVoucher;
  };

  const handleSaveVoucher = () => {
    const saved = validateAndBuildVoucher();
    if (saved) closeCreateModal();
  };

  /** حفظ السند ثم فتح معاينة الطباعة مباشرة */
  const handleSaveVoucherAndPrint = () => {
    const saved = validateAndBuildVoucher();
    if (saved) {
      closeCreateModal();
      setSelectedVoucher(saved);
      setAutoPrint(true);
      setIsPrintOpen(true);
    }
  };

  // الطباعة التلقائية بعد فتح معاينة السند (من زر «حفظ السند مع الطباعة»)
  useEffect(() => {
    if (isPrintOpen && selectedVoucher && autoPrint) {
      const t = setTimeout(() => {
        void handlePrintPreview();
        setAutoPrint(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isPrintOpen, selectedVoucher, autoPrint]);

  const handleSavePdf = async () => {
    if (!printablePaperRef.current || pdfBusy || !selectedVoucher) return;
    setPdfBusy(true);
    try {
      const { downloadVoucherPdf, voucherFileName } = await import('../../utils/voucherPdf');
      await downloadVoucherPdf(printablePaperRef.current, voucherFileName('payment-voucher', selectedVoucher.voucherNumber));
    } catch (err) {
      console.error('PDF generation failed', err);
      toast('error', 'تعذر إنشاء ملف PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleShareVoucher = async () => {
    if (!printablePaperRef.current || pdfBusy || !selectedVoucher) return;
    setPdfBusy(true);
    try {
      const { downloadVoucherPdf, shareVoucherPdf, voucherFileName } = await import('../../utils/voucherPdf');
      const fileName = voucherFileName('payment-voucher', selectedVoucher.voucherNumber);
      const shared = await shareVoucherPdf(printablePaperRef.current, fileName, `سند صرف رقم ${selectedVoucher.voucherNumber}`);
      if (!shared) {
        await downloadVoucherPdf(printablePaperRef.current, fileName);
      }
    } catch (err) {
      console.error('Share failed', err);
    } finally {
      setPdfBusy(false);
    }
  };

  // Filtered Vouchers
  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch =
      v.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.payeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.narration.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesMethod = methodFilter === 'ALL' || v.paymentMethod === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  // KPI Statistics
  const toLocal = (v: PaymentVoucher) => Math.round((v.totalAmount || 0) * (v.exchangeRate || 1) * 100) / 100;
  const totalSpent = vouchers.filter(v => v.status === 'POSTED').reduce((s, v) => s + toLocal(v), 0);
  const postedCount = vouchers.filter(v => v.status === 'POSTED').length;
  const cashSpent = vouchers.filter(v => v.status === 'POSTED' && v.paymentMethod === 'CASH').reduce((s, v) => s + toLocal(v), 0);
  const bankSpent = vouchers.filter(v => v.status === 'POSTED' && (v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'CHEQUE')).reduce((s, v) => s + toLocal(v), 0);

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><Wallet className="w-3.5 h-3.5" /> نقداً</span>;
      case 'BANK_TRANSFER':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30"><Landmark className="w-3.5 h-3.5" /> تحويل بنكي</span>;
      case 'CHEQUE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"><CreditCard className="w-3.5 h-3.5" /> شيك</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: PaymentVoucherStatus) => {
    switch (status) {
      case 'POSTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">مرحل</span>;
      case 'PENDING_POSTING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">بانتظار الترحيل</span>;
      case 'VOIDED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-300 border border-red-500/30">ملغى</span>;
      default:
        return null;
    }
  };

  if (mode === 'hidden') {
    return (
      <HiddenWindowBar
        icon={<FileCheck2 className="w-5 h-5" />}
        title="سندات الصرف (Payment Vouchers)"
        subtitle="إدارة سندات الصرف النقدية والبنكية — تُحفظ بانتظار الترحيل من شاشة الإقفالات مع قوالب الطباعة الرسمية"
        onRestore={restore}
      />
    );
  }

  return (
    <div data-enter-scope="" className={isMaximized ? 'fixed inset-0 z-[70] bg-slate-950 overflow-y-auto p-6 space-y-6' : 'space-y-6 animate-fade-in'}>
      <PageHeader
        icon={<FileCheck2 className="w-6 h-6 text-sky-400" />}
        title="سندات الصرف (Payment Vouchers)"
        subtitle="إدارة سندات الصرف النقدية والبنكية — تُحفظ بانتظار الترحيل من شاشة الإقفالات مع قوالب الطباعة الرسمية"
        actions={
          <>
            <WindowControls
              isMaximized={isMaximized}
              onToggleMaximize={toggleMaximize}
              onHide={hide}
            />
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              إنشاء سند صرف جديد
            </button>
          </>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">إجمالي مدفوعات السندات</p>
            <p className="text-xl font-black text-white mt-1">{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-sky-400 font-normal">{baseCode}</span></p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">السندات المرحلة</p>
            <p className="text-xl font-black text-white mt-1">{postedCount.toLocaleString('en-US')} <span className="text-xs text-slate-400 font-normal">سند</span></p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">مصروفات الصناديق (نقداً)</p>
            <p className="text-xl font-black text-white mt-1">{cashSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-normal">{baseCode}</span></p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">مصروفات البنوك وشيكات</p>
            <p className="text-xl font-black text-white mt-1">{bankSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-normal">{baseCode}</span></p>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="glass-card rounded-2xl p-4 border border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <F9SearchInput
            value={searchTerm}
            onChange={setSearchTerm}

            className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            items={filteredVouchers}
            columns={[
              { label: 'رقم السند', render: v => <span className="font-mono font-bold text-sky-300">{v.voucherNumber}</span> },
              { label: 'التاريخ', render: v => <span className="text-slate-300">{v.date}</span> },
              { label: 'المستفيد', render: v => <span className="font-semibold text-white">{v.payeeName}</span> },
              { label: 'الإجمالي', render: v => <span className="font-mono font-bold text-white">{v.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sky-400 text-sm">{v.currency || 'YER'}</span></span> }
            ]}
            searchText={v => [v.voucherNumber, v.date, v.payeeName, v.narration, v.referenceNumber || '', v.totalAmount, v.currency, v.status, v.paymentMethod, v.sourceAccountNameAr].join(' ')}
            onSelect={v => setSearchTerm(v.voucherNumber)}
            browseTitle="استعراض سندات الصرف"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">الحالة:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">الجميع</option>
              <option value="POSTED">مرحل</option>
              <option value="PENDING_POSTING">بانتظار الترحيل</option>
              <option value="VOIDED">ملغى</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">طريقة الصرف:</span>
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">كل الطرق</option>
              <option value="CASH">نقداً</option>
              <option value="BANK_TRANSFER">تحويل بنكي</option>
              <option value="CHEQUE">شيك</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="glass-card rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs font-bold">
                <th className="p-4">رقم السند</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المستفيد / المدفوع له</th>
                <th className="p-4">طريقة الصرف</th>
                <th className="p-4">حساب السداد (دائن)</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-sm">
                    لا توجد سندات صرف مطابقة للشروط الحالية.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map(voucher => (
                  <tr key={voucher.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-sky-300">
                      {voucher.voucherNumber}
                    </td>
                    <td className="p-4 text-slate-300 text-xs">
                      {voucher.date}
                    </td>
                    <td className="p-4 font-semibold text-white">
                      {voucher.payeeName}
                      {voucher.referenceNumber && (
                        <span className="block text-sm text-slate-400 font-mono">مرجع: {voucher.referenceNumber}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {getMethodBadge(voucher.paymentMethod)}
                    </td>
                    <td className="p-4 text-slate-300 text-xs">
                      {voucher.sourceAccountNameAr}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {voucher.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-sky-400 font-normal">{voucher.currency || 'YER'}</span>
                      <span className="block text-sm text-slate-400 font-mono">≈ {(voucher.totalAmount * (voucher.exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</span>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(voucher.status)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {voucher.status === 'PENDING_POSTING' && (
                          <button
                            onClick={() => openEditModal(voucher)}
                            title="تعديل السند (بانتظار الترحيل)"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedVoucher(voucher);
                            setIsPrintOpen(true);
                          }}
                          title="معاينة وطباعة السند الرسمية"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {voucher.status !== 'VOIDED' && (
                          <button
                            onClick={() => {
                              if (confirm(voucher.status === 'POSTED' ? `سيُنشأ قيد عكسي مرتبط لسند الصرف ${voucher.voucherNumber}. متابعة؟` : `هل تريد إلغاء بانتظار الترحيل سند الصرف ${voucher.voucherNumber}؟`)) {
                                onVoidVoucher(voucher.id, voucher.journalEntryId);
                              }
                            }}
                            title={voucher.status === 'POSTED' ? 'عكس وإلغاء السند' : 'إلغاء السند المنتظر'}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE PAYMENT VOUCHER MODAL */}
      {isCreateOpen && (
        <ModalShell
          id="payment-voucher-create"
          open={!!isCreateOpen}
          onClose={() => closeCreateModal()}
          title={editingVoucher ? `تعديل سند صرف رقم ${editingVoucher.voucherNumber}` : 'إصدار سند صرف جديد'}
          subtitle={editingVoucher
            ? 'تعديل بيانات التوزيع المحاسبي وحساب السداد — متاح للسندات المنتظرة للترحيل فقط'
            : 'تعبئة بيانات التوزيع المحاسبي وحساب السداد — يُحفظ السند بانتظار الترحيل من شاشة الإقفالات'}
          icon={FileCheck2}
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
              {editingVoucher?.voucherNumber ?? nextVoucherNo}
            </span>
          }
        >
          <div className="flex flex-col h-full">
            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-right">
              {/* Row 1: General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">رقم السند {editingVoucher ? '(تلقائي — ثابت)' : '(تلقائي)'}</label>
                  <div className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-sky-300 flex items-center gap-2" dir="ltr">
                    <Hash className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                    {editingVoucher?.voucherNumber ?? nextVoucherNo}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ السند</label>
                  <SmartDateInput value={voucherDate} onChange={d => setVoucherDate(smartDateToIso(d))} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">اسم المستفيد / المدفوع له *</label>
                  <input
                    type="text"
                    value={payeeName}
                    onChange={e => setPayeeName(e.target.value)}

                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">طريقة الصرف</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePaymentMethodChange('CASH')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        paymentMethod === 'CASH'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      نقداً
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentMethodChange('BANK_TRANSFER')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      تحويل
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentMethodChange('CHEQUE')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        paymentMethod === 'CHEQUE'
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
                    {paymentMethod === 'CASH' ? 'الصندوق النقدي المصدر منه (إلى)' : paymentMethod === 'BANK_TRANSFER' ? 'البنك / الحساب المصرفي المصدر منه' : 'البنك المسحوب عليه'}
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 leading-none">سعر الصرف</label>
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 leading-none">المبلغ المحلي</label>
                      {isBaseCurrency ? (
                        <AmountInput
                          value={creditLocalAmount || ''}
                          onChange={handleCreditLocalAmountChange}
                          disabled={!headerCurrencyReady}

                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      ) : (
                        <AmountInput
                          value={creditLocalTotal}
                          onChange={handleCreditLocalAmountChange}
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
                      onChange={handleForeignAmountChange}
                      disabled={!headerCurrencyReady}

                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}
                  <div className="min-h-[1.05rem] mt-1.5 leading-none"></div>
                </div>

                <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {paymentMethod === 'CASH' ? 'رقم الإيصال / المرجع (اختياري)' : paymentMethod === 'CHEQUE' ? 'رقم الشيك (Cheque Number) *' : 'رقم الحوالة / الإشعار البنكي (Transfer Ref No) *'}
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}

                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  {paymentMethod === 'CHEQUE' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ استحقاق الشيك (Cheque Due Date) *</label>
                      <SmartDateInput value={chequeDueDate} onChange={d => setChequeDueDate(smartDateToIso(d))} />
                    </div>
                  )}

                  <div className={paymentMethod === 'CHEQUE' ? '' : 'sm:col-span-2'}>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">البيان العام لسند الصرف</label>
                    <input
                      type="text"
                      value={narration}
                      onChange={e => setNarration(e.target.value)}

                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* فاصل بين بيانات الدائن وبيانات المدين */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">بيانات الدائن (المسدد منه)</span>
                <div className="h-px flex-1 bg-slate-700/80" />
                <span className="text-xs font-bold text-sky-400 whitespace-nowrap">بيانات المدين (المستفيدون)</span>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    جدول الحسابات والبنود المستفيدة (مدين)
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
                          <th className="p-3 min-w-[130px] whitespace-nowrap" title="المبلغ المحلي">المبلغ المحلي</th>
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
                            <tr key={line.id} data-pv-line={line.id} className="hover:bg-slate-900/40">
                              <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                              <td className="p-2.5">
                                <div className="relative">
                                  <input
                                    type="text"
                                    readOnly
                                    data-enter-nav-field="account-name"
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
                                            const row = document.querySelector<HTMLElement>(`tr[data-pv-line="${line.id}"]`);
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
                                      const rate = Number(line.exchangeRate) || 1;
                                       const foreign = rate > 0 ? Math.round((val / rate) * 100) / 100 : 0;
                                      setLines(prev => prev.map(l => l.id === line.id ? { ...l, localAmount: val, amount: foreign } : l));
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
                                    className="text-slate-500 hover:text-red-400 p-1"
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
                    <span className="text-xs text-slate-400">إجمالي الدائن (محلي): </span>
                    <div className="font-mono text-base font-black text-emerald-300 mt-0.5">{creditLocalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
                    {!isBaseCurrency && (
                      <div className="font-mono text-sm text-slate-400 mt-0.5">{creditForeignTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                    <span className="text-xs text-slate-400">إجمالي المدين (محلي): </span>
                    <div className="font-mono text-base font-black text-sky-300 mt-0.5">{debitLocalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${Math.abs(debitCreditDifference) > 0.005 ? 'bg-red-500/15 border-red-500/50' : 'bg-emerald-500/15 border-emerald-500/30'}`}>
                    <span className="text-xs text-slate-400">الفارق (المدين − الدائن): </span>
                    <div className={`font-mono text-base font-black mt-0.5 ${Math.abs(debitCreditDifference) > 0.005 ? 'text-red-300' : 'text-emerald-300'}`}>{debitCreditDifference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCode}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
              <AttachmentPicker documents={attachments} onChange={setAttachments} uploadedBy={currentUserName} documentType="PAYMENT_SUPPORT" />
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
                  onClick={handleSaveVoucherAndPrint}
                  disabled={!canPost || rateBlocked}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  حفظ السند مع الطباعة
                </button>
                <button
                  type="button"
                  onClick={handleSaveVoucher}
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
          id="payment-voucher-f9"
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
                  ref={f9SearchRef}
                  type="text"
                  autoFocus
                  value={f9Query}
                  onChange={e => { setF9Query(e.target.value); setF9ActiveIndex(0); }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { e.preventDefault(); setF9Open(false); return; }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setF9ActiveIndex(i => Math.min(i + 1, Math.max(0, f9List.length - 1)));
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setF9ActiveIndex(i => Math.max(i - 1, 0));
                      return;
                    }
                    if (e.key === 'Enter' && f9List.length > 0) {
                      e.preventDefault();
                      applyF9Account(f9List[f9ActiveIndex] || f9List[0]);
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
                f9List.map((account, accountIndex) => (
                  <button
                    key={account.id}
                    type="button"
                    data-f9-account-index={accountIndex}
                    onMouseEnter={() => setF9ActiveIndex(accountIndex)}
                    onMouseDown={e => { e.preventDefault(); applyF9Account(account); }}
                    className={`w-full text-right flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 transition-colors cursor-pointer ${accountIndex === f9ActiveIndex ? 'bg-sky-500/15 ring-1 ring-inset ring-sky-500/50' : 'hover:bg-sky-500/10'}`}
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

      {/* PRINT / VIEW VOUCHER MODAL */}
      {isPrintOpen && selectedVoucher && (
        <ModalShell
          id="payment-voucher-print"
          open={!!(isPrintOpen && selectedVoucher)}
          onClose={() => setIsPrintOpen(false)}
          title={`معاينة سند الصرف الرسمي (${selectedVoucher.voucherNumber})`}
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
                onClick={handleShareVoucher}
                disabled={pdfBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-md disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                مشاركة
              </button>
            </div>
          }
        >
          {/* Printable Voucher Paper Layout */}
          <div ref={printablePaperRef} id="printable-voucher-paper" className="paper print-area bg-white text-slate-900 text-right" dir="rtl">
            <div className="p-8">
              <VoucherPrintTemplate
                voucherTitleAr={
                  selectedVoucher.paymentMethod === 'CASH' ? 'سند صرف نقدي' :
                  selectedVoucher.paymentMethod === 'BANK_TRANSFER' ? 'سند صرف بنكي (تحويل)' :
                  'سند صرف بشيك'
                }
                voucherTitleEn="Payment Voucher"
                documentNumber={selectedVoucher.voucherNumber}
                documentDate={selectedVoucher.date}
                currency={selectedVoucher.currency || 'YER'}
                currentUserName={selectedVoucher.createdBy}
                metadata={[
                  { label: 'المستفيد', value: selectedVoucher.payeeName },
                  { label: 'طريقة الصرف', value: selectedVoucher.paymentMethod === 'CASH' ? 'نقداً من الصندوق' : selectedVoucher.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك بنكي' },
                  { label: 'المصدر منه', value: selectedVoucher.sourceAccountNameAr },
                  {
                    label: selectedVoucher.paymentMethod === 'CHEQUE'
                      ? 'رقم الشيك'
                      : selectedVoucher.paymentMethod === 'BANK_TRANSFER'
                        ? 'رقم الحوالة / الإشعار البنكي'
                        : 'رقم الإيصال / المرجع',
                    value: selectedVoucher.referenceNumber || '—',
                  },
                  ...(selectedVoucher.chequeBankName ? [{ label: 'بنك الشيك', value: selectedVoucher.chequeBankName }] : []),
                  ...(selectedVoucher.chequeDueDate ? [{ label: 'تاريخ الاستحقاق', value: formatDate(selectedVoucher.chequeDueDate) }] : []),
                  { label: 'سعر الصرف', value: String(selectedVoucher.exchangeRate || 1) },
                  { label: 'البيان العام', value: selectedVoucher.narration || '—' },
                ]}
                tafqeetText={selectedVoucher.amountInWordsAr}
                totalAmountText={`${selectedVoucher.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selectedVoucher.currency || 'YER'}`}
                localEquivalentText={`${(selectedVoucher.totalAmount * (selectedVoucher.exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseCode}`}
                signatures={[
                  { roleLabelAr: 'أعده / المحاسب', name: selectedVoucher.createdBy },
                  { roleLabelAr: 'استلمت أنا المستفيد' },
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
                      <th>رقم المرجع للطرف</th>
                      <th className="text-left">المبلغ ({selectedVoucher.currency || 'YER'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVoucher.lines.map((l, idx) => (
                      <tr key={l.id}>
                        <td className="text-center font-mono">{idx + 1}</td>
                        <td className="font-mono">{l.accountCode}</td>
                        <td className="font-semibold">{reportAccountName(l)}</td>
                        <td className="text-slate-600">{l.description}</td>
                        <td className="font-mono">{l.referenceNumber || '—'}</td>
                        <td className="font-bold text-left font-mono whitespace-nowrap">{l.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {l.currency || selectedVoucher.currency || 'YER'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="text-left font-bold">الإجمالي النهائي:</td>
                      <td className="font-bold text-left font-mono whitespace-nowrap">{selectedVoucher.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedVoucher.currency || 'YER'}</td>
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
