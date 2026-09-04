import {openDesktopPrintPreview} from '../../utils/desktopPrintPreview';
import { dateToIso, dateToDisplay, inDateRange } from '../../utils/dateInput';
import { reportDocuments, lineCostCenterId, entityOpening, lineBelongsToEntity, isBeforeReport, voucherReportAmount } from '../../utils/reportData';
import React, { useState, useMemo, useRef, Fragment, useEffect } from 'react';
import { Account, JournalEntry, CostCenter, Currency, Employee, Customer, Vendor, CashBox, BankAccount, Trust, Custody, SubLedgerType, PaymentVoucher, ReceiptVoucher } from '../../types/erp';
import {
  calculateIncomeStatement,
  calculateBalanceSheet,
  calculateCashFlowStatement,
  calculateEquityChangesStatement,
  calculateAccountActivity,
  netAccountBalance,
  isPostingAccount,
  childrenOf,
  ancestorChain,
  rootOf,
  cashBoxPostingAccounts,
  bankPostingAccounts,
} from '../../utils/accountingEngine';
import {
  FileBarChart2,
  Printer,
  Search,
  ChevronDown,
  ChevronLeft,
  BookOpen,
  TrendingUp,
  PieChart,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  FolderTree,
  Globe,
  Wallet,
  Network,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  ListChecks,
  FileSpreadsheet,
  ChevronUp,
  CalendarDays,
  Settings2,
  FileText,
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import SmartDateInput from '../ui/SmartDateInput';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import ModalShell from '../ui/ModalShell';
import { downloadVoucherPdf } from '../../utils/voucherPdf';
import { buildXlsx, downloadBlob, type XlsxSheet } from '../../utils/xlsxWriter';
import PrintableAccountStatement, { type PrintableStatementRow } from './reports/PrintableAccountStatement';
import { loadBranchesLocal, DEFAULT_COMPANY_BRANCH } from '../../utils/companyStore';
import { tafqeet } from '../../utils/tafqeet';
import FinancialReportPrintLayout from '../reports/FinancialReportPrintLayout';
import { buildPeriodAccounts, calculatePeriodMovement, validateReportPeriod } from '../../utils/reportingPeriod';
import { currencyDecimals, roundTo } from '../../utils/money';
import { accountsWithCurrencyOpenings, projectJournalsToCurrency } from '../../utils/currencyReporting';
import { defaultReportToDate, toLocalIsoDate } from '../../utils/dateDefaults';
import { reconcileControlAccountOpenings } from '../../services/openingBalancesService';

interface Props {
  accounts: Account[];
  journals: JournalEntry[];
  costCenters: CostCenter[];
  currentUserName?: string;
  currencies?: Currency[];
  employees?: Employee[];
  customers?: Customer[];
  vendors?: Vendor[];
  cashBoxes?: CashBox[];
  bankAccounts?: BankAccount[];
  trusts?: Trust[];
  custodies?: Custody[];
  vouchers?: PaymentVoucher[];
  receiptVouchers?: ReceiptVoucher[];
  enableEnhancedView?: boolean;
  fiscalYear: string;
}

type ReportType = 'TRIAL_BALANCE' | 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'EQUITY_CHANGES' | 'LEDGER' | 'COST_CENTERS' | 'EMPLOYEES_REPORT' | 'CUSTOMERS_REPORT' | 'VENDORS_REPORT' | 'CASHBOX_REPORT' | 'BANK_REPORT' | 'TRUSTS_REPORT' | 'PAYMENT_VOUCHERS_REPORT' | 'RECEIPT_VOUCHERS_REPORT' | 'JOURNAL_ENTRIES_REPORT';

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = (n: number) => n < 0 ? `(${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : fmt(n);

const PrintSignatures = () => (
  <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', gap: '24px', fontSize: '9.6px', color: '#000', pageBreakInside: 'avoid' }}>
    {['إعداد المحاسب', 'مراجعة المدير المالي', 'اعتماد المدير العام'].map((role) => (
      <div key={role} style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ borderTop: '2px solid #000', paddingTop: '4px', fontWeight: 'bold' }}>{role}</div>
        <div style={{ marginTop: '4px' }}>الاسم: ........................</div>
        <div style={{ marginTop: '14px' }}>التوقيع: ........................</div>
      </div>
    ))}
  </div>
);

const PrintTafqeet = ({ label, amount, currencyName, currencyCode }: { label: string; amount: number; currencyName: string; currencyCode: string }) => (
  <div style={{ marginTop: '8px', border: '2px solid #000', padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f8fc', pageBreakInside: 'avoid' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '10.4px', fontWeight: 900, color: '#000' }}>{label} =</span>
      <span style={{ fontSize: '9.6px', fontWeight: 'bold', color: '#000' }}>{tafqeet(Math.abs(amount), currencyName, currencyCode)}</span>
    </div>
    <div style={{ fontSize: '12.8px', fontWeight: 900, color: '#1d4ed8', direction: 'ltr', fontFamily: "'Consolas', monospace" }}>
      {fmt(Math.abs(amount))}
    </div>
  </div>
);

const configuredFiscalPeriod = (year: string) => {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
};

const REPORT_META: Record<ReportType, { ar: string; en: string }> = {
  TRIAL_BALANCE: { ar: 'ميزان المراجعة', en: 'Trial Balance' },
  INCOME_STATEMENT: { ar: 'قائمة الدخل', en: 'Income Statement' },
  BALANCE_SHEET: { ar: 'الميزانية العمومية', en: 'Balance Sheet' },
  CASH_FLOW: { ar: 'قائمة التدفقات النقدية', en: 'Cash Flow Statement' },
  EQUITY_CHANGES: { ar: 'التغيرات في حقوق الملكية', en: 'Changes in Equity' },
  LEDGER: { ar: 'كشف حساب', en: 'Account Statement' },
  COST_CENTERS: { ar: 'مراكز التكلفة', en: 'Cost Centers' },
  EMPLOYEES_REPORT: { ar: 'كشف حساب موظف', en: 'Employee Statement' },
  CUSTOMERS_REPORT: { ar: 'كشف حساب عميل', en: 'Customer Statement' },
  VENDORS_REPORT: { ar: 'كشف حساب مورد', en: 'Vendor Statement' },
  CASHBOX_REPORT: { ar: 'حركة الصندوق', en: 'Cash Box Statement' },
  BANK_REPORT: { ar: 'حركة البنك / الصراف', en: 'Bank & Exchange Statement' },
  TRUSTS_REPORT: { ar: 'كشف العُهد المالية', en: 'Custody Statement' },
  PAYMENT_VOUCHERS_REPORT: { ar: 'سندات الصرف', en: 'Payment Vouchers' },
  RECEIPT_VOUCHERS_REPORT: { ar: 'سندات القبض', en: 'Receipt Vouchers' },
  JOURNAL_ENTRIES_REPORT: { ar: 'القيود اليومية', en: 'Journal Entries' },
};

const REPORT_ICONS: Record<ReportType, React.ReactNode> = {
  TRIAL_BALANCE: <Layers className="w-4 h-4" />,
  INCOME_STATEMENT: <TrendingUp className="w-4 h-4" />,
  BALANCE_SHEET: <PieChart className="w-4 h-4" />,
  CASH_FLOW: <ArrowDownToLine className="w-4 h-4" />,
  EQUITY_CHANGES: <TrendingUp className="w-4 h-4" />,
  LEDGER: <BookOpen className="w-4 h-4" />,
  COST_CENTERS: <Network className="w-4 h-4" />,
  EMPLOYEES_REPORT: <Users className="w-4 h-4" />,
  CUSTOMERS_REPORT: <Users className="w-4 h-4" />,
  VENDORS_REPORT: <Users className="w-4 h-4" />,
  CASHBOX_REPORT: <Wallet className="w-4 h-4" />,
  BANK_REPORT: <Wallet className="w-4 h-4" />,
  TRUSTS_REPORT: <FileText className="w-4 h-4" />,
  PAYMENT_VOUCHERS_REPORT: <Wallet className="w-4 h-4" />,
  RECEIPT_VOUCHERS_REPORT: <Wallet className="w-4 h-4" />,
  JOURNAL_ENTRIES_REPORT: <FileText className="w-4 h-4" />,
};

interface LedgerRow {
  date: string;
  entryNumber: string;
  reference: string;
  narration: string;
  description: string;
  debit: number;
  credit: number;
  running: number;
}

function buildLedger(account: Account, journalsList: JournalEntry[]): {
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  openingDebit: number;
  openingCredit: number;
  opening: number;
  closing: number;
} {
  const movements: Omit<LedgerRow, 'running'>[] = [];
  journalsList.forEach(j => {
    j.lines.forEach(line => {
      if (line.accountId === account.id) {
        movements.push({
          date: j.date,
          entryNumber: j.entryNumber,
          reference: j.reference || '—',
          narration: j.narration || '',
          description: line.description || '',
          debit: line.debit || 0,
          credit: line.credit || 0,
        });
      }
    });
  });
  movements.sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));

  const opening = account.openingBalance || 0;
  let running = opening;
  const rows = movements.map(m => {
    running = round2(running + m.debit - m.credit);
    return { ...m, running };
  });
  const totalDebit = round2(movements.reduce((s, m) => s + m.debit, 0));
  const totalCredit = round2(movements.reduce((s, m) => s + m.credit, 0));
  return {
    rows,
    totalDebit,
    totalCredit,
    opening,
    openingDebit: opening > 0 ? opening : 0,
    openingCredit: opening < 0 ? -opening : 0,
    closing: round2(opening + totalDebit - totalCredit),
  };
}

interface TB6Row {
  key: string;
  accountId: string;
  code: string;
  name: string;
  currency: string;
  nature: 'DEBIT' | 'CREDIT';
  /** صف تفصيلي تابع للحساب الرئيسي؛ لا يدخل في الإجماليات مرتين. */
  isAnalytical?: boolean;
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  endingDebit: number;
  endingCredit: number;
}

interface TB6Group {
  key: string;
  labelAr: string;
  labelEn: string;
  rows: TB6Row[];
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  endingDebit: number;
  endingCredit: number;
}

function build6ColumnGroupedTrialBalance(
  reportAccounts: Account[],
  journalsInRange: JournalEntry[],
  allAccounts: Account[],
  showZeroAccounts = false,
  includeAllStatuses = false
) {
  const activity = calculateAccountActivity(reportAccounts, journalsInRange, includeAllStatuses);

  const groups: TB6Group[] = [
    { key: '1', labelAr: 'الأصول', labelEn: 'Assets', rows: [], openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 },
    { key: '2', labelAr: 'الخصوم وحقوق الملكية', labelEn: 'Liabilities & Equity', rows: [], openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 },
    { key: '3', labelAr: 'الإيرادات', labelEn: 'Revenues', rows: [], openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 },
    { key: '4', labelAr: 'المصروفات', labelEn: 'Expenses', rows: [], openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 },
  ];

  reportAccounts.filter(isPostingAccount).forEach(acc => {
    const opening = acc.openingBalance || 0;
    const openingDebit = opening > 0 ? opening : 0;
    const openingCredit = opening < 0 ? Math.abs(opening) : 0;

    const mov = activity[acc.id] || { debit: 0, credit: 0 };
    const movementDebit = Math.max(0, mov.debit - openingDebit);
    const movementCredit = Math.max(0, mov.credit - openingCredit);

    const openingNet = openingDebit - openingCredit;
    const movementNet = movementDebit - movementCredit;
    const endingNet = openingNet + movementNet;
    let endingDebit = 0;
    let endingCredit = 0;
    if (endingNet >= 0) endingDebit = endingNet;
    else endingCredit = Math.abs(endingNet);

    const hasData = openingDebit > 0 || openingCredit > 0 || movementDebit > 0 || movementCredit > 0;
    if (!hasData && !showZeroAccounts) return;

    const root = rootOf(acc, allAccounts);
    const g = groups.find(x => x.key === root?.code);
    if (!g) return;

    g.rows.push({
      key: `account-${acc.id}`,
      accountId: acc.id,
      code: acc.code,
      name: acc.nameAr,
      currency: acc.defaultCurrency || 'YER',
      nature: acc.nature,
      openingDebit,
      openingCredit,
      movementDebit,
      movementCredit,
      endingDebit,
      endingCredit,
    });
    g.openingDebit = round2(g.openingDebit + openingDebit);
    g.openingCredit = round2(g.openingCredit + openingCredit);
    g.movementDebit = round2(g.movementDebit + movementDebit);
    g.movementCredit = round2(g.movementCredit + movementCredit);
    g.endingDebit = round2(g.endingDebit + endingDebit);
    g.endingCredit = round2(g.endingCredit + endingCredit);

  });

  const totals = groups.reduce(
    (s, g) => ({
      openingDebit: round2(s.openingDebit + g.openingDebit),
      openingCredit: round2(s.openingCredit + g.openingCredit),
      movementDebit: round2(s.movementDebit + g.movementDebit),
      movementCredit: round2(s.movementCredit + g.movementCredit),
      endingDebit: round2(s.endingDebit + g.endingDebit),
      endingCredit: round2(s.endingCredit + g.endingCredit),
    }),
    { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 }
  );

  return {
    groups,
    totals,
    isBalanced: Math.abs(totals.endingDebit - totals.endingCredit) < 0.01,
    rowCount: groups.reduce((s, g) => s + g.rows.length, 0),
  };
}

function accountBalancesDC(
  acc: Account,
  openingBalance: number,
  act: { debit: number; credit: number }
) {
  const opening = openingBalance || 0;
  const openingDebit = opening > 0 ? opening : 0;
  const openingCredit = opening < 0 ? Math.abs(opening) : 0;
  const movementDebit = Math.max(0, (act.debit || 0) - openingDebit);
  const movementCredit = Math.max(0, (act.credit || 0) - openingCredit);
  const endingNet = (openingDebit - openingCredit) + (movementDebit - movementCredit);
  let endingDebit = 0;
  let endingCredit = 0;
  if (endingNet >= 0) endingDebit = endingNet;
  else endingCredit = Math.abs(endingNet);
  return { openingDebit, openingCredit, movementDebit, movementCredit, endingDebit, endingCredit };
}

function balanceLabel(n: number): { text: string; cls: string; tag?: string } {
  if (Math.abs(n) < 0.005) return { text: fmt(0), cls: 'text-slate-400' };
  if (n > 0) return { text: fmt(n), cls: 'text-emerald-400', tag: 'مدين' };
  return { text: fmt(-n), cls: 'text-sky-400', tag: 'دائن' };
}

function TreeBranch({
  acc,
  accounts,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  depth,
}: {
  acc: Account;
  accounts: Account[];
  selectedId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const kids = childrenOf(accounts, acc.id);
  const isOpen = expanded.has(acc.id);
  const isSelected = selectedId === acc.id;
  const isGroup = acc.level < 5;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onToggle(acc.id);
          onSelect(acc.id);
        }}
        style={{ paddingRight: 8 + depth * 16 }}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-right transition-colors cursor-pointer border ${isSelected
          ? 'bg-sky-500/15 border-sky-500/60 text-sky-300'
          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-200'
          }`}
      >
        {kids.length > 0 ? (
          isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          )
        ) : (
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
            <span className={`w-1.5 h-1.5 rounded-full ${isGroup ? 'bg-slate-950' : 'bg-emerald-400'}`} />
          </span>
        )}
        <span className={`font-mono text-sm ${isGroup ? 'text-slate-400' : 'text-sky-400'} shrink-0`}>{acc.code}</span>
        <span className={`text-xs truncate ${isGroup ? 'font-semibold text-slate-500 dark:text-slate-300' : 'text-slate-700 dark:text-slate-200'}`}>{acc.nameAr}</span>
      </button>
      {isOpen && kids.map(k => (
        <Fragment key={k.id}>
          <TreeBranch
            acc={k}
            accounts={accounts}
            selectedId={selectedId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </Fragment>
      ))}
    </div>
  );
}

export default function FinancialReportsView({
  accounts,
  journals,
  costCenters,
  currentUserName = 'مستخدم',
  currencies = [],
  employees = [],
  customers = [],
  vendors = [],
  cashBoxes = [],
  bankAccounts = [],
  trusts = [],
  custodies = [],
  vouchers = [],
  receiptVouchers = [],
  enableEnhancedView = false,
  fiscalYear,
}: Props) {
  const { active: activeCurrencies, baseCode, symbolOf } = useActiveCurrencies(currencies);
  const [reportType, setReportType] = useState<ReportType>('TRIAL_BALANCE');
  const [fromDate, setFromDate] = useState(() => configuredFiscalPeriod(fiscalYear).start);
  const [toDate, setToDate] = useState(defaultReportToDate);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  const [includeOpening, setIncludeOpening] = useState(true);
  const [reportLevel, setReportLevel] = useState<'ANALYTICAL' | 'SUMMARY'>('ANALYTICAL');
  const isSummary = reportLevel === 'SUMMARY';
  const [showZeroAccounts, setShowZeroAccounts] = useState(false);
  const [showPriorComparison, setShowPriorComparison] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerAccountId, setExplorerAccountId] = useState('');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerExpanded, setExplorerExpanded] = useState<Set<string>>(
    () => new Set(accounts.filter(a => a.level === 1).map(a => a.id))
  );

  const currency = selectedCurrency === 'ALL' ? baseCode : selectedCurrency;

  useEffect(() => {
    const period = configuredFiscalPeriod(fiscalYear);
    setFromDate(period.start);
    setToDate(defaultReportToDate());
    setShowReport(false);
  }, [fiscalYear]);

  const [fromEntityId, setFromEntityId] = useState<string>('');
  const [fromEntityCode, setFromEntityCode] = useState<string>('');
  const [toEntityId, setToEntityId] = useState<string>('');
  const [toEntityCode, setToEntityCode] = useState<string>('');
  // التقارير التحليلية تبدأ بالحساب الرئيسي؛ لا يُتاح التحليلي قبل اختياره.
  const [fromMainAccountId, setFromMainAccountId] = useState<string>('');
  const [toMainAccountId, setToMainAccountId] = useState<string>('');

  const isEntityOrCostCenterReport =
    ['EMPLOYEES_REPORT', 'CUSTOMERS_REPORT', 'VENDORS_REPORT', 'CASHBOX_REPORT', 'BANK_REPORT', 'TRUSTS_REPORT', 'COST_CENTERS'].includes(reportType);

  useEffect(() => {
    setFromEntityId('');
    setFromEntityCode('');
    setToEntityId('');
    setToEntityCode('');
    setFromMainAccountId('');
    setToMainAccountId('');
  }, [reportType]);

  const currencyOptions = useMemo(
    () =>
      activeCurrencies.map(c => ({
        code: c.code,
        label: c.nameAr ? `${c.nameAr} (${c.code})` : c.code,
        symbol: c.symbol,
        rate: c.exchangeRate
      })),
    [activeCurrencies]
  );

  const curMeta = {
    label: selectedCurrency === 'ALL' ? 'كافة العملات (شامل)' : currencyOptions.find(c => c.code === currency)?.label || currency,
    symbol: symbolOf(currency),
  };
  const sym = curMeta.symbol;
  const selectedDecimals = currencyDecimals(currency, currencies);
  const isOriginalCurrencyReport = selectedCurrency !== 'ALL' && currency !== baseCode;
  const toReportCurrency = (n: number) => roundTo(n || 0, selectedDecimals);

  const baseJournals = useMemo(
    () => projectJournalsToCurrency(journals.map(j => ({...j, date: dateToIso(j.date)})), isOriginalCurrencyReport ? currency : baseCode, baseCode, selectedDecimals, true, true),
    [journals, baseCode, currency, isOriginalCurrencyReport, selectedDecimals]
  );

  const reportJournals = useMemo(() => baseJournals, [baseJournals]);

  const journalsInRange = useMemo(() => reportDocuments(reportJournals, fromDate, toDate, true), [reportJournals, fromDate, toDate]);
  // Operational document reports include pending records, visibly labelled; financial statements remain POSTED-only.
  const documentJournals = useMemo(() => reportDocuments(
    projectJournalsToCurrency(journals, isOriginalCurrencyReport ? currency : baseCode, baseCode, selectedDecimals, true, true), fromDate, toDate, true
  ), [journals, fromDate, toDate, currency, baseCode, selectedDecimals, isOriginalCurrencyReport]);

  const allJournals = useMemo(() => reportJournals, [reportJournals]);

  const reconciledAccounts = useMemo(
    () => reconcileControlAccountOpenings({ accounts, cashBoxes, bankAccounts, customers, vendors, employees }).accounts,
    [accounts, cashBoxes, bankAccounts, customers, vendors, employees]
  );
  const currencyAccounts = useMemo(() => accountsWithCurrencyOpenings(reconciledAccounts, isOriginalCurrencyReport ? currency : baseCode, baseCode, selectedDecimals), [reconciledAccounts, baseCode, currency, isOriginalCurrencyReport, selectedDecimals]);
  const reportAccounts = useMemo(
    () => buildPeriodAccounts(currencyAccounts, reportJournals, fromDate, includeOpening, 1, true),
    [currencyAccounts, includeOpening, reportJournals, fromDate]
  );

  const incomeStmt = useMemo(() => calculateIncomeStatement(reportAccounts, journalsInRange, true), [reportAccounts, journalsInRange]);
  const cashFlow = useMemo(() => calculateCashFlowStatement(reportAccounts, journalsInRange, true), [reportAccounts, journalsInRange]);
  const equityChanges = useMemo(() => calculateEquityChangesStatement(reportAccounts, journalsInRange, true), [reportAccounts, journalsInRange]);
  const balanceSheet = useMemo(() => {
    const asOfAccounts = currencyAccounts;
    const throughToDate = reportJournals.filter(journal => journal.date <= toDate);
    return calculateBalanceSheet(asOfAccounts, throughToDate, true);
  }, [currencyAccounts, reportJournals, toDate]);

  const priorPeriod = useMemo(() => {
    const shift = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
    const previousFrom = shift(fromDate); const previousTo = shift(toDate);
    const inRange = reportJournals.filter(journal => journal.date >= previousFrom && journal.date <= previousTo);
    const throughEnd = reportJournals.filter(journal => journal.date <= previousTo);
    return {
      fromDate: previousFrom, toDate: previousTo,
      income: calculateIncomeStatement(reportAccounts, inRange, true),
      balance: calculateBalanceSheet(currencyAccounts, throughEnd, true),
      cashFlow: calculateCashFlowStatement(reportAccounts, inRange, true),
      equity: calculateEquityChangesStatement(reportAccounts, inRange, true)
    };
  }, [fromDate, toDate, reportAccounts, currencyAccounts, reportJournals]);

  const comparisonMetric = useMemo(() => {
    if (reportType === 'INCOME_STATEMENT') return { label: 'صافي الدخل', current: incomeStmt.netIncome, previous: priorPeriod.income.netIncome };
    if (reportType === 'BALANCE_SHEET') return { label: 'إجمالي الأصول', current: balanceSheet.totalAssets, previous: priorPeriod.balance.totalAssets };
    if (reportType === 'CASH_FLOW') return { label: 'صافي التغير في النقدية', current: cashFlow.netChange, previous: priorPeriod.cashFlow.netChange };
    if (reportType === 'EQUITY_CHANGES') return { label: 'حقوق الملكية آخر الفترة', current: equityChanges.closingEquity, previous: priorPeriod.equity.closingEquity };
    return null;
  }, [reportType, incomeStmt, balanceSheet, cashFlow, equityChanges, priorPeriod]);

  const filteredIncomeStmt = useMemo(() => {
    if (!isSummary) return incomeStmt;
    const aggregateLines = (lines: typeof incomeStmt.revenueLines) => {
      const groups = new Map<string, { labelAr: string; labelEn: string; amount: number; key: string }>();
      lines.forEach(l => {
        const g = groups.get(l.key);
        if (g) {
          g.amount += l.amount;
        } else {
          groups.set(l.key, { labelAr: l.labelAr, labelEn: l.labelEn, amount: l.amount, key: l.key });
        }
      });
      return Array.from(groups.values());
    };
    return {
      ...incomeStmt,
      revenueLines: aggregateLines(incomeStmt.revenueLines) as typeof incomeStmt.revenueLines,
      expenseLines: aggregateLines(incomeStmt.expenseLines) as typeof incomeStmt.expenseLines,
    };
  }, [incomeStmt, isSummary]);

  const accountRangeSet = !!(fromAccount && toAccount && fromAccount.localeCompare(toAccount) <= 0);

  const tbAccounts = useMemo(() => {
    if (!accountRangeSet) return reportAccounts;
    return reportAccounts.filter(a => a.code.localeCompare(fromAccount) >= 0 && a.code.localeCompare(toAccount) <= 0);
  }, [reportAccounts, fromAccount, toAccount, accountRangeSet]);

  const groupedTB = useMemo(() => build6ColumnGroupedTrialBalance(tbAccounts, journalsInRange, reportAccounts, showZeroAccounts, true), [tbAccounts, journalsInRange, reportAccounts, showZeroAccounts]);

  const activity = useMemo(() => calculateAccountActivity(reportAccounts, journalsInRange, true), [reportAccounts, journalsInRange]);
  const periodMovement = useMemo(() => calculatePeriodMovement(reportAccounts, journalsInRange, true), [reportAccounts, journalsInRange]);

  const bsByAccount = useMemo(() => {
    const rows: {
      accountId: string;
      code: string;
      name: string;
      currency: string;
      currentDebit: number;
      currentCredit: number;
      cumulativeDebit: number;
      cumulativeCredit: number;
      localCurrentDebit: number;
      localCurrentCredit: number;
      localCumulativeDebit: number;
      localCumulativeCredit: number;
    }[] = [];
    reportAccounts.filter(isPostingAccount).forEach(acc => {
      const act = activity[acc.id] || { debit: 0, credit: 0 };
      const periodAct = periodMovement[acc.id] || { debit: 0, credit: 0 };
      const currentDebit = round2(periodAct.debit);
      const currentCredit = round2(periodAct.credit);
      const b = accountBalancesDC(acc, acc.openingBalance, act);
      const cumulativeDebit = round2(b.endingDebit);
      const cumulativeCredit = round2(b.endingCredit);
      let localCurrentDebit = currentDebit;
      let localCurrentCredit = currentCredit;
      let localCumulativeDebit = cumulativeDebit;
      let localCumulativeCredit = cumulativeCredit;
      if (isOriginalCurrencyReport) {
        const matching = journals.filter(entry => entry.date <= toDate).flatMap(entry => entry.lines.filter(line => line.accountId === acc.id && (line.currency || entry.currency) === currency).map(line => ({ entry, line })));
        localCurrentDebit = round2(matching.filter(item => item.entry.date >= fromDate).reduce((sum, item) => sum + (item.line.debit || 0), 0));
        localCurrentCredit = round2(matching.filter(item => item.entry.date >= fromDate).reduce((sum, item) => sum + (item.line.credit || 0), 0));
        const openingLocal = (acc.openingBalances || []).filter(row => row.currency === currency).reduce((sum, row) => sum + (row.debitLocal || 0) - (row.creditLocal || 0), 0);
        const signedLocal = round2(openingLocal + matching.reduce((sum, item) => sum + (item.line.debit || 0) - (item.line.credit || 0), 0));
        localCumulativeDebit = signedLocal > 0 ? signedLocal : 0;
        localCumulativeCredit = signedLocal < 0 ? Math.abs(signedLocal) : 0;
      }
      if (currentDebit <= 0 && currentCredit <= 0 && cumulativeDebit <= 0 && cumulativeCredit <= 0) return;
      rows.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.nameAr,
        currency,
        currentDebit,
        currentCredit,
        cumulativeDebit,
        cumulativeCredit,
        localCurrentDebit,
        localCurrentCredit,
        localCumulativeDebit,
        localCumulativeCredit,
      });
    });
    rows.sort((a, b) => a.code.localeCompare(b.code));
    const totals = rows.reduce(
      (s, r) => ({
        currentDebit: round2(s.currentDebit + r.currentDebit),
        currentCredit: round2(s.currentCredit + r.currentCredit),
        cumulativeDebit: round2(s.cumulativeDebit + r.cumulativeDebit),
        cumulativeCredit: round2(s.cumulativeCredit + r.cumulativeCredit),
        currentDebitYER: round2(s.currentDebitYER + r.localCurrentDebit),
        currentCreditYER: round2(s.currentCreditYER + r.localCurrentCredit),
        cumulativeDebitYER: round2(s.cumulativeDebitYER + r.localCumulativeDebit),
        cumulativeCreditYER: round2(s.cumulativeCreditYER + r.localCumulativeCredit),
      }),
      { currentDebit: 0, currentCredit: 0, cumulativeDebit: 0, cumulativeCredit: 0, currentDebitYER: 0, currentCreditYER: 0, cumulativeDebitYER: 0, cumulativeCreditYER: 0 }
    );
    return { rows, totals, count: rows.length };
  }, [reportAccounts, activity, periodMovement, currency, fromDate, toDate, isOriginalCurrencyReport, journals]);

  const bsCurrentDiff = round2(bsByAccount.totals.currentDebit - bsByAccount.totals.currentCredit);
  const bsCumulativeDiff = round2(bsByAccount.totals.cumulativeDebit - bsByAccount.totals.cumulativeCredit);
  const baseCurrencyName = currencyOptions.find(c => c.code === baseCode)?.label.split(' (')[0] || baseCode;

  const postedCount = journalsInRange.length;

  const selectedAccount = useMemo(
    () =>
      accounts.find(a => a.id === selectedAccountId) ||
      accounts.find(a => a.code === fromAccount) ||
      accounts.find(a => a.code === toAccount) ||
      null,
    [accounts, selectedAccountId, fromAccount, toAccount]
  );

  const selectedScaled = useMemo(
    () => (selectedAccount ? reportAccounts.find(a => a.id === selectedAccount.id) || null : null),
    [selectedAccount, reportAccounts]
  );

  const ledger = useMemo(
    () => (selectedScaled ? buildLedger(selectedScaled, journalsInRange) : null),
    [selectedScaled, journalsInRange]
  );

  const costCenterActivity = useMemo(() => {
    const map: Record<string, { debit: number; credit: number; count: number }> = {};
    documentJournals.forEach(j =>
      j.lines.forEach(l => {
        const costCenterId = lineCostCenterId(l);
        if (!costCenterId) return;
        const cur = map[costCenterId] || { debit: 0, credit: 0, count: 0 };
        cur.debit = round2(cur.debit + (l.debit || 0));
        cur.credit = round2(cur.credit + (l.credit || 0));
        cur.count += 1;
        map[costCenterId] = cur;
      })
    );
    return map;
  }, [documentJournals]);

  const openLedger = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setSelectedAccountId(acc.id);
    setFromAccount(acc.code);
    setToAccount(acc.code);
    setReportType('LEDGER');
    setShowReport(true);
  };

  const openExplorerFor = (accountId: string) => {
    setExplorerAccountId(accountId);
    const acc = accounts.find(a => a.id === accountId);
    if (acc) {
      const chain = ancestorChain(acc, accounts);
      setExplorerExpanded(prev => {
        const next = new Set(prev);
        chain.forEach(c => next.add(c.id));
        return next;
      });
    }
    setIsExplorerOpen(true);
  };

  const entityLines = (accId: string, subLedgerId?: string) => {
    const lines: { date: string; docNumber: string; reference: string; description: string; debit: number; credit: number }[] = [];
    journalsInRange.forEach(j =>
      j.lines.forEach(l => {
        if (l.accountId !== accId) return;
        if (subLedgerId && l.subLedgerId && l.subLedgerId !== subLedgerId) return;
        lines.push({
          date: j.date,
          docNumber: j.entryNumber,
          reference: j.reference || '—',
          description: l.description || j.narration || '—',
          debit: l.debit || 0,
          credit: l.credit || 0,
        });
      })
    );
    lines.sort((a, b) => a.date.localeCompare(b.date) || a.docNumber.localeCompare(b.docNumber));
    return lines;
  };

  const LANDSCAPE_REPORTS: ReportType[] = []; // All financial reports use A4 portrait for consistent Windows preview/output.
  const printReport = async (_landscape = false) => {
    await openDesktopPrintPreview(printAreaRef.current, REPORT_META[reportType].ar, 'portrait');
  };

  const applyQuickPeriod = (from: string, to: string) => { setFromDate(from); setToDate(to); };
  const quickToday = () => { const n = new Date(); applyQuickPeriod(toLocalIsoDate(n), toLocalIsoDate(n)); };
  const quickThisMonth = () => { const n = new Date(); applyQuickPeriod(toLocalIsoDate(new Date(n.getFullYear(), n.getMonth(), 1)), toLocalIsoDate(n)); };
  const quickFiscalYear = () => { const period = configuredFiscalPeriod(fiscalYear); applyQuickPeriod(period.start, period.end); };

  const quickPeriodRanges = {
    today: () => { const n = new Date(); return [toLocalIsoDate(n), toLocalIsoDate(n)]; },
    month: () => { const n = new Date(); return [toLocalIsoDate(new Date(n.getFullYear(), n.getMonth(), 1)), toLocalIsoDate(n)]; },
    year: () => { const period = configuredFiscalPeriod(fiscalYear); return [period.start, period.end]; },
  } as const;
  const isQuickActive = (key: keyof typeof quickPeriodRanges) => {
    const [f, t] = quickPeriodRanges[key]();
    return fromDate === f && toDate === t;
  };

  const resetFilters = () => {
    setReportType('TRIAL_BALANCE');
    const fiscal = configuredFiscalPeriod(fiscalYear);
    setFromDate(fiscal.start);
    setToDate(defaultReportToDate());
    setSelectedCurrency('ALL');
    setFromEntityId('');
    setFromEntityCode('');
    setToEntityId('');
    setToEntityCode('');
    setFromMainAccountId('');
    setToMainAccountId('');
    setFromAccount('');
    setToAccount('');
    setSelectedAccountId('');
    setShowDetails(true);
    setIncludeOpening(true);
    setReportLevel('ANALYTICAL');
    setShowZeroAccounts(false);
    setShowReport(false);
  };

  const handleShowReport = () => {
    if (!validateReportPeriod(fromDate, toDate).valid) return;
    setShowReport(true);
    setFiltersCollapsed(true);
  };

  const reportPeriodValidation = useMemo(
    () => validateReportPeriod(fromDate, toDate),
    [fromDate, toDate]
  );

  const explorerAccounts = useMemo(() => {
    const q = explorerSearch.trim().toLowerCase();
    if (!q) return [];
    return accounts
      .filter(a => a.code.includes(q) || a.nameAr.toLowerCase().includes(q) || a.nameEn.toLowerCase().includes(q))
      .slice(0, 50);
  }, [accounts, explorerSearch]);

  const explorerAccount = accounts.find(a => a.id === explorerAccountId) || null;
  const explorerScaled = explorerAccount ? reportAccounts.find(a => a.id === explorerAccount.id) || null : null;
  const explorerLedger = explorerScaled ? buildLedger(explorerScaled, journalsInRange) : null;
  const explorerActivityAll = calculateAccountActivity(reportAccounts, allJournals, true);
  const explorerNetAll = explorerScaled
    ? netAccountBalance(explorerScaled, explorerActivityAll[explorerScaled.id] || { debit: 0, credit: 0 })
    : 0;

  type ReportEntityOption = { id: string; code: string; name: string; linkedAccountId?: string };
  const currentEntitiesList: ReportEntityOption[] = useMemo(() => {
    switch (reportType) {
      case 'EMPLOYEES_REPORT':
      case 'TRUSTS_REPORT': return employees.map(e => ({ id: e.id, code: e.code, name: e.nameAr, linkedAccountId: e.linkedAccountId }));
      case 'CUSTOMERS_REPORT': return customers.map(c => ({ id: c.id, code: c.code, name: c.nameAr, linkedAccountId: c.linkedAccountId }));
      case 'VENDORS_REPORT': return vendors.map(v => ({ id: v.id, code: v.code, name: v.nameAr, linkedAccountId: v.linkedAccountId }));
      case 'CASHBOX_REPORT': return cashBoxes.map(a => ({ id: a.id, code: a.code, name: a.nameAr, linkedAccountId: a.linkedAccountId }));
      case 'BANK_REPORT': return bankAccounts.map(a => ({ id: a.id, code: a.code, name: a.bankNameAr, linkedAccountId: a.linkedAccountId }));
      case 'COST_CENTERS': return costCenters.map(cc => ({ id: cc.id, code: cc.code, name: cc.nameAr }));
      default: return [];
    }
  }, [reportType, employees, customers, vendors, cashBoxes, bankAccounts, costCenters]);

  const reportMainAccounts = useMemo(() => {
    const linkedIds = new Set(currentEntitiesList.map(entity => entity.linkedAccountId).filter(Boolean));
    // مركز التكلفة لا يملك حساباً تحليلياً مباشراً؛ يظل الحساب الرئيسي فلتر حركة التقرير.
    return accounts.filter(account => isPostingAccount(account) && (reportType === 'COST_CENTERS' || linkedIds.has(account.id)));
  }, [accounts, currentEntitiesList, reportType]);

  const entitiesForMainAccount = (mainAccountId: string) =>
    currentEntitiesList.filter(entity => reportType === 'COST_CENTERS' || entity.linkedAccountId === mainAccountId);

  const scopedEntityList = useMemo(() => {
    const selectedMainIds = [fromMainAccountId, toMainAccountId].filter(Boolean);
    if (!selectedMainIds.length) return currentEntitiesList;
    if (reportType === 'COST_CENTERS') return currentEntitiesList;
    return currentEntitiesList.filter(entity => selectedMainIds.includes(entity.linkedAccountId || ''));
  }, [currentEntitiesList, fromMainAccountId, toMainAccountId, reportType]);

  const { rangeLo, rangeHi } = useMemo(() => {
    const list = scopedEntityList;
    if (!list.length) return { rangeLo: 0, rangeHi: -1 };
    const f = list.findIndex(x => String(x.id) === String(fromEntityId));
    const t = list.findIndex(x => String(x.id) === String(toEntityId));
    // Entity filter semantics: no filters = all; to-only = selected account; from-only = from through end; both = inclusive range.
    const lo = f === -1 && t !== -1 ? t : (f === -1 ? 0 : f);
    const hi = t === -1 ? list.length - 1 : t;
    return { rangeLo: Math.min(lo, hi), rangeHi: Math.max(lo, hi) };
  }, [scopedEntityList, fromEntityId, toEntityId]);

  const scopedEntities = useMemo(
    () => (rangeHi >= rangeLo ? scopedEntityList.slice(rangeLo, rangeHi + 1) : []),
    [scopedEntityList, rangeLo, rangeHi]
  );

  const handleFromEntityChange = (id: string) => {
    setFromEntityId(id);
    const found = currentEntitiesList.find(item => String(item.id) === String(id));
    if (found) setFromEntityCode(found.code || '');
  };
  const handleFromCodeChange = (code: string) => {
    setFromEntityCode(code);
    const found = currentEntitiesList.find(item => item.code?.toLowerCase() === code.toLowerCase());
    if (found) setFromEntityId(found.id);
  };
  const handleToEntityChange = (id: string) => {
    setToEntityId(id);
    const found = currentEntitiesList.find(item => String(item.id) === String(id));
    if (found) setToEntityCode(found.code || '');
  };
  const handleToCodeChange = (code: string) => {
    setToEntityCode(code);
    const found = currentEntitiesList.find(item => item.code?.toLowerCase() === code.toLowerCase());
    if (found) setToEntityId(found.id);
  };

  const linkedAccountIdOf = (enId: string): string | undefined => {
    switch (reportType) {
      case 'EMPLOYEES_REPORT': return employees.find(e => e.id === enId)?.linkedAccountId;
      case 'CUSTOMERS_REPORT': return customers.find(c => c.id === enId)?.linkedAccountId;
      case 'VENDORS_REPORT': return vendors.find(v => v.id === enId)?.linkedAccountId;
      case 'CASHBOX_REPORT': return cashBoxes.find(e => e.id === enId)?.linkedAccountId;
      case 'BANK_REPORT': return bankAccounts.find(e => e.id === enId)?.linkedAccountId;
      case 'TRUSTS_REPORT': return employees.find(e => e.id === enId)?.linkedAccountId;
      default: return undefined;
    }
  };

  const getEntityName = (reportType: ReportType): string => {
    const list = currentEntitiesList;
    if (scopedEntities.length === 1) return `${scopedEntities[0].code} — ${scopedEntities[0].name}`;
    if (scopedEntities.length > 1) return `نطاق الحسابات: ${scopedEntities[0].code} ← ${scopedEntities[scopedEntities.length - 1].code} (${scopedEntities.length} حسابات)`;
    if (list.length) return `نطاق الحسابات: ${list[0].code} ← ${list[list.length - 1].code} (كافة الحسابات)`;
    return REPORT_META[reportType]?.ar || '';
  };

  const company = useMemo(() => loadBranchesLocal()[0] || DEFAULT_COMPANY_BRANCH, []);

  const docTypeByJournal = useMemo(() => {
    const map: Record<string, string> = {};
    vouchers.forEach(v => {
      if (v.journalEntryId) {
        map[v.journalEntryId] = v.status === 'VOIDED' ? 'سند صرف (ملغي)' : 'سند صرف نقدي';
      }
    });
    receiptVouchers.forEach(r => {
      if (r.journalEntryId) {
        map[r.journalEntryId] = r.status === 'VOIDED' ? 'سند قبض (ملغي)' : 'سند قبض نقدي';
      }
    });
    return map;
  }, [vouchers, receiptVouchers]);

  interface StatementSpec {
    key: string;
    titleAr: string;
    titleEn: string;
    subjectCode: string;
    subjectName: string;
    subjectExtra?: string;
    opening: number;
    /** Opening balance split by original currency for independent print sections. */
    openingByCurrency?: Record<string, number>;
    showOpening: boolean;
    rows: PrintableStatementRow[];
    currencyCode?: string;
  }

  const statementSpecs = useMemo<StatementSpec[]>(() => {
    const docType = (id: string) => docTypeByJournal[id] || 'قيد يومية';
    const toRow = (j: JournalEntry, l: { debit?: number; credit?: number; debitForeign?: number; creditForeign?: number; description?: string; currency?: string }): PrintableStatementRow => {
      const lineCurrency = l.currency || j.currency || baseCode;
      const useOriginalAmount = !isOriginalCurrencyReport && lineCurrency !== baseCode;
      return ({
      date: dateToIso(j.date),
      docType: docType(j.id) + (j.status === 'VOIDED' ? ' (ملغي)' : j.status === 'PENDING_POSTING' ? ' (بانتظار الترحيل)' : ''),
      docNumber: j.entryNumber,
      reference: j.reference || '—',
      description: l.description || j.narration || '—',
      debit: useOriginalAmount ? (l.debitForeign ?? l.debit ?? 0) : (l.debit || 0),
      credit: useOriginalAmount ? (l.creditForeign ?? l.credit ?? 0) : (l.credit || 0),
      currency: lineCurrency,
    });
    };
    const sortRows = (a: PrintableStatementRow, b: PrintableStatementRow) =>
      a.date.localeCompare(b.date) || a.docNumber.localeCompare(b.docNumber);

    if (reportType === 'TRUSTS_REPORT') {
      const empIds = new Set(scopedEntities.map(e => e.id));
      const all = empIds.size === 0 || empIds.size >= employees.length;
      const reportTrusts = [
        ...trusts.filter(t => !custodies.some(c => c.id === t.id)).map(t => ({ ...t, currency: baseCode, exchangeRate: 1 })),
        ...custodies.map(c => ({ ...c, date: c.requestedDate, trustNumber: c.custodyNumber, returnedAmount: c.refundedAmount + c.apTransferredAmount })),
      ].filter(t => (all || (t.employeeId && empIds.has(t.employeeId))) && inDateRange(t.date, fromDate, toDate) && (!isOriginalCurrencyReport || t.currency === currency));
      const emp = employees.find(e => e.id === (fromEntityId || toEntityId));
      const first = scopedEntities[0];
      const last = scopedEntities[scopedEntities.length - 1];
      const subjectName = emp?.nameAr || (first && last
        ? (first.id === last.id ? first.name : `${first.code} ← ${last.code} (${scopedEntities.length})`)
        : 'كافة العهد');
      return [{
        key: 'TRUSTS_REPORT',
        titleAr: 'كشف العُهد المالية تحليلي',
        titleEn: 'Custody Financial Statement',
        subjectCode: emp?.code || first?.code || '—',
        subjectName,
        subjectExtra: reportTrusts.length ? `عدد العهد: ${reportTrusts.length}` : undefined,
        opening: 0,
        showOpening: false,
        rows: reportTrusts.map(t => ({
          date: t.date,
          docType: 'عهدة مالية',
          docNumber: t.trustNumber,
          reference: t.referenceNumber || '—',
          description: t.title,
          debit: round2((t.amount || 0) * (isOriginalCurrencyReport || t.currency === baseCode ? 1 : t.exchangeRate || 1)),
          credit: round2(((t.settledAmount || 0) + (t.returnedAmount || 0)) * (isOriginalCurrencyReport || t.currency === baseCode ? 1 : t.exchangeRate || 1)),
          currency: t.currency || baseCode,
        })),
      }];
    }

    if (reportType === 'COST_CENTERS') {
      const scopedIds = new Set(scopedEntities.map(e => e.id));
      const scopedCC = costCenters.filter(cc => scopedIds.has(cc.id));
      const mainAccountIds = new Set([fromMainAccountId, toMainAccountId].filter(Boolean));
      const allRows: PrintableStatementRow[] = [];

      scopedCC.forEach(cc => {
        documentJournals.forEach(j =>
          j.lines.forEach(l => {
            if (lineCostCenterId(l) !== cc.id) return;
            if (mainAccountIds.size && !mainAccountIds.has(l.accountId)) return;
            allRows.push(toRow(j, l));
          })
        );
      });

      allRows.sort(sortRows);

      const first = scopedEntities[0];
      const last = scopedEntities[scopedEntities.length - 1];
      const subjectName = scopedEntities.length === 1
        ? (first?.name || '—')
        : (first && last
          ? (first.id === last.id ? first.name : `${first.name} ← ${last.name} (${scopedEntities.length} مركز)`)
          : 'كافة مراكز التكلفة');

      return [{
        key: 'COST_CENTERS',
        titleAr: 'كشف مراكز التكلفة التحليلي',
        titleEn: 'Cost Centers Analytical Statement',
        subjectExtra: 'يشمل الحركات المرحلة والمعلقة؛ الحركات المعلقة موضحة ولا تدخل القوائم المالية',
        subjectCode: first?.code || '—',
        subjectName,
        opening: 0,
        showOpening: false,
        rows: allRows,
      }];
    }

    if (['EMPLOYEES_REPORT', 'CUSTOMERS_REPORT', 'VENDORS_REPORT', 'CASHBOX_REPORT', 'BANK_REPORT'].includes(reportType)) {
      const meta: Record<string, { titleAr: string; titleEn: string }> = {
        EMPLOYEES_REPORT: { titleAr: 'كشف حساب الموظفين التحليلي', titleEn: 'Employees Analytical Statement' },
        CUSTOMERS_REPORT: { titleAr: 'كشف حساب العملاء التحليلي', titleEn: 'Customers Analytical Statement' },
        VENDORS_REPORT: { titleAr: 'كشف حساب الموردين التحليلي', titleEn: 'Vendors Analytical Statement' },
        CASHBOX_REPORT: { titleAr: 'كشف حركة الصندوق التحليلي', titleEn: 'Cash Box Analytical Statement' },
        BANK_REPORT: { titleAr: 'كشف حركة البنك / الصراف التحليلي', titleEn: 'Bank & Exchange Analytical Statement' },
      };
      const m = meta[reportType];
      const allRows: PrintableStatementRow[] = [];
      let openingBalance = 0;
      const openingByCurrency: Record<string, number> = {};
      const entities = reportType === 'CASHBOX_REPORT' ? cashBoxes : reportType === 'BANK_REPORT' ? bankAccounts : reportType === 'EMPLOYEES_REPORT' ? employees : reportType === 'CUSTOMERS_REPORT' ? customers : vendors;
      const types: SubLedgerType[] = reportType === 'CASHBOX_REPORT' ? ['CASH_BOX'] : reportType === 'BANK_REPORT' ? ['BANK','EXCHANGER'] : reportType === 'EMPLOYEES_REPORT' ? ['EMPLOYEE'] : reportType === 'CUSTOMERS_REPORT' ? ['CUSTOMER'] : ['SUPPLIER'];
      scopedEntities.forEach(en => {
        const entity = entities.find(e => e.id === en.id);
        if (!entity) return;
        if (includeOpening) {
          if (isOriginalCurrencyReport) {
            const amount = entityOpening(entity, currency, baseCode);
            openingBalance += amount;
            openingByCurrency[currency] = round2((openingByCurrency[currency] || 0) + amount);
          } else {
            const balances = entity.openingBalances?.length
              ? entity.openingBalances.map(row => ({ code: row.currency || baseCode, amount: (row.debit ?? row.debitLocal ?? 0) - (row.credit ?? row.creditLocal ?? 0) }))
              : [{ code: entity.openingCurrency || entity.defaultCurrency || baseCode, amount: entity.openingBalance || 0 }];
            balances.forEach(({ code, amount }) => {
              openingByCurrency[code] = round2((openingByCurrency[code] || 0) + amount);
              openingBalance += amount;
            });
          }
        }
        reportJournals.forEach(j => j.lines.forEach(l => {
          if (!lineBelongsToEntity(l, j, entity, entities, types, [...vouchers, ...receiptVouchers])) return;
          if (includeOpening && isBeforeReport(j.date, fromDate)) {
            const lineCurrency = l.currency || j.currency || baseCode;
            const useOriginalAmount = !isOriginalCurrencyReport && lineCurrency !== baseCode;
            const amount = (useOriginalAmount ? (l.debitForeign ?? l.debit ?? 0) - (l.creditForeign ?? l.credit ?? 0) : (l.debit || 0) - (l.credit || 0));
            openingBalance += amount;
            openingByCurrency[lineCurrency] = round2((openingByCurrency[lineCurrency] || 0) + amount);
          }
          else if (inDateRange(j.date, fromDate, toDate)) allRows.push(toRow(j, l));
        }));
      });

      allRows.sort(sortRows);

      const first = scopedEntities[0];
      const last = scopedEntities[scopedEntities.length - 1];
      const subjectName = scopedEntities.length === 1
        ? (first?.name || '—')
        : (first && last
          ? (first.id === last.id ? first.name : `${first.name} ← ${last.name} (${scopedEntities.length} كيان)`)
          : 'كافة الكيانات');

      return [{
        key: reportType,
        titleAr: m.titleAr,
        titleEn: m.titleEn,
        subjectCode: first?.code || '—',
        subjectName,
        opening: openingBalance,
        openingByCurrency,
        showOpening: true,
        rows: allRows,
      }];
    }

    return [];
  }, [reportType, journalsInRange, documentJournals, reportJournals, scopedEntities, reportAccounts, employees, customers, vendors, cashBoxes, bankAccounts, trusts, custodies, costCenters, docTypeByJournal, fromEntityId, toEntityId, fromDate, toDate, includeOpening, isOriginalCurrencyReport, currency, baseCode, vouchers, receiptVouchers, fromMainAccountId, toMainAccountId]);

  // Each original currency is an independent statement in the same print job.
  // This preserves a complete pagination run for one currency before the next starts.
  const printableStatementSpecs = useMemo(() => {
    const expanded: StatementSpec[] = [];
    statementSpecs.forEach(spec => {
      const groups = new Map<string, PrintableStatementRow[]>();
      spec.rows.forEach(row => {
        const code = row.currency || baseCode;
        const bucket = groups.get(code) || [];
        bucket.push(row);
        groups.set(code, bucket);
      });
      Object.keys(spec.openingByCurrency || {}).forEach(code => {
        if (!groups.has(code)) groups.set(code, []);
      });
      if (!groups.size) groups.set(spec.currencyCode || currency || baseCode, []);
      groups.forEach((rows, code) => {
        const opening = spec.openingByCurrency?.[code] ?? (groups.size === 1 ? spec.opening : 0);
        expanded.push({
          ...spec,
          key: `${spec.key}-${code}`,
          titleAr: groups.size > 1 ? `${spec.titleAr} — ${code}` : spec.titleAr,
          subjectExtra: `${spec.subjectExtra ? `${spec.subjectExtra} — ` : ''}عملة ${code}`,
          opening,
          rows,
          currencyCode: code,
        });
      });
    });
    return expanded;
  }, [statementSpecs, baseCode, currency]);

  const filteredPaymentVouchers = useMemo(() =>
    reportDocuments(vouchers || [], fromDate, toDate, true).filter(v => !isOriginalCurrencyReport || v.currency === currency).map(v => ({...v, totalAmount: roundTo(voucherReportAmount(v,isOriginalCurrencyReport ? currency : baseCode,baseCode),selectedDecimals)})),
    [vouchers, fromDate, toDate, isOriginalCurrencyReport, currency, baseCode, selectedDecimals]
  );
  const filteredReceiptVouchers = useMemo(() =>
    reportDocuments(receiptVouchers || [], fromDate, toDate, true).filter(v => !isOriginalCurrencyReport || v.currency === currency).map(v => ({...v, totalAmount: roundTo(voucherReportAmount(v,isOriginalCurrencyReport ? currency : baseCode,baseCode),selectedDecimals)})),
    [receiptVouchers, fromDate, toDate, isOriginalCurrencyReport, currency, baseCode, selectedDecimals]
  );
  const filteredJournalEntries = useMemo(() =>
    documentJournals,
    [documentJournals]
  );

  const currencyNameAr = currencyOptions.find(c => c.code === currency)?.label.split(' (')[0] || currency;

  /* دالة بناء بيانات التقارير واستدعاؤها مع تحديد الأنواع بشكل صريح لتجنب أخطاء TypeScript */
  const buildReportData = (): { columns: string[]; rows: (string | number)[][] } => {
    switch (reportType) {
      case 'TRIAL_BALANCE': {
        const columns = ['رمز الحساب', 'اسم الحساب', 'العملة', 'ص. افتتاحي مدين', 'ص. افتتاحي دائن', 'حركة مدين', 'حركة دائن', 'ص. ختامي مدين', 'ص. ختامي دائن'];
        const rows: (string | number)[][] = [];
        groupedTB.groups.forEach(g => {
          if (g.rows.length) rows.push([g.labelAr, '', '', '', '', '', '', '', '']);
          if (!isSummary) g.rows.forEach(r => rows.push([r.code, r.name, r.currency, r.openingDebit || '', r.openingCredit || '', r.movementDebit || '', r.movementCredit || '', r.endingDebit || '', r.endingCredit || '']));
          if (g.rows.length) rows.push([`إجمالي ${g.labelAr}`, '', '', g.openingDebit || '', g.openingCredit || '', g.movementDebit || '', g.movementCredit || '', g.endingDebit || '', g.endingCredit || '']);
        });
        const t = groupedTB.totals;
        rows.push(['الإجمالي', '', '', t.openingDebit || '', t.openingCredit || '', t.movementDebit || '', t.movementCredit || '', t.endingDebit || '', t.endingCredit || '']);
        return { columns, rows };
      }
      case 'LEDGER': {
        const rows: (string | number)[][] = [];
        if (selectedAccount && ledger) {
          if (includeOpening) rows.push(['رصيد افتتاحي', '—', '—', ledger.openingDebit || '', ledger.openingCredit || '', ledger.opening]);
          if (!isSummary) ledger.rows.forEach(r => rows.push([dateToDisplay(r.date), r.entryNumber, r.description || r.narration, r.debit || '', r.credit || '', r.running]));
          rows.push(['الإجمالي', '—', '—', ledger.totalDebit || '', ledger.totalCredit || '', '']);
          rows.push(['الرصيد الختامي', '—', '—', '—', '—', ledger.closing || '']);
        }
        return { columns: ['التاريخ', 'رقم المستند', 'البيان', 'مدين', 'دائن', 'الرصيد'], rows };
      }
      case 'INCOME_STATEMENT': {
        const rows: (string | number)[][] = [];
        rows.push(['١. الإيرادات', '']);
        incomeStmt.revenueLines.forEach(l => rows.push([`   ${l.labelAr} (${l.labelEn})`, fmtP(l.amount)]));
        if (incomeStmt.revenueResidual !== 0) rows.push(['   إيرادات أخرى', fmtP(incomeStmt.revenueResidual)]);
        rows.push(['إجمالي الإيرادات', fmtP(incomeStmt.totalRevenues)]);
        rows.push(['٢. المصاريف التشغيلية', '']);
        incomeStmt.expenseLines.forEach(l => rows.push([`   ${l.labelAr} (${l.labelEn})`, fmtP(-l.amount)]));
        if (incomeStmt.operatingResidual !== 0) rows.push(['   مصاريف تشغيلية أخرى', fmtP(-incomeStmt.operatingResidual)]);
        rows.push(['إجمالي المصاريف التشغيلية', fmtP(-incomeStmt.totalOperatingExpenses)]);
        if (incomeStmt.nonOperatingLines.length > 0 || incomeStmt.totalNonOperatingExpenses !== 0) {
          rows.push(['٣. المصاريف غير التشغيلية', '']);
          incomeStmt.nonOperatingLines.forEach(l => rows.push([`   ${l.labelAr} (${l.labelEn})`, fmtP(-l.amount)]));
          rows.push(['إجمالي المصاريف غير التشغيلية', fmtP(-incomeStmt.totalNonOperatingExpenses)]);
        }
        rows.push(['الربح التشغيلي (EBIT)', fmtP(incomeStmt.operatingProfit)]);
        rows.push(['صافي الدخل النهائي', fmtP(incomeStmt.netIncome)]);
        return { columns: ['البند', 'القيمة'], rows };
      }
      case 'BALANCE_SHEET': {
        const columns = ['رقم الحساب', 'اسم الحساب', 'العملة', 'مدين الفترة الحالية', 'دائن الفترة الحالية', 'مدين التراكمي', 'دائن التراكمي'];
        const rows: (string | number)[][] = bsByAccount.rows.map(r => [
          r.code, r.name, currency,
          toReportCurrency(r.currentDebit) || '', toReportCurrency(r.currentCredit) || '',
          toReportCurrency(r.cumulativeDebit) || '', toReportCurrency(r.cumulativeCredit) || '',
        ]);
        const t = bsByAccount.totals;
        rows.push(['الإجمالي الكلي', '', currency, toReportCurrency(t.currentDebit) || '', toReportCurrency(t.currentCredit) || '', toReportCurrency(t.cumulativeDebit) || '', toReportCurrency(t.cumulativeCredit) || '']);
        return { columns, rows };
      }
      case 'CASH_FLOW':
        return { columns: ['البند', 'القيمة'], rows: [
          ['صافي التدفقات من الأنشطة التشغيلية', cashFlow.operating], ['صافي التدفقات من الأنشطة الاستثمارية', cashFlow.investing],
          ['صافي التدفقات من الأنشطة التمويلية', cashFlow.financing], ['صافي التغير في النقدية', cashFlow.netChange],
          ['النقدية أول الفترة', cashFlow.openingCash], ['النقدية آخر الفترة', cashFlow.closingCash], ['فرق المطابقة مع الأستاذ العام', cashFlow.reconciliationDifference],
        ] };
      case 'EQUITY_CHANGES':
        return { columns: ['البند', 'القيمة'], rows: [
          ['حقوق الملكية أول الفترة', equityChanges.openingEquity], ['مساهمات/مسحوبات الملاك', equityChanges.ownerMovements],
          ['صافي دخل الفترة', equityChanges.netIncome], ['حقوق الملكية آخر الفترة', equityChanges.closingEquity],
          ['حقوق الملكية حسب الميزانية', equityChanges.balanceSheetEquity], ['فرق المطابقة', equityChanges.reconciliationDifference],
        ] };
      case 'PAYMENT_VOUCHERS_REPORT':
        return { columns: ['التاريخ', 'رقم السند', 'المستفيد', 'البيان', 'طريقة الدفع', 'المبلغ', 'الحالة'], rows: filteredPaymentVouchers.map(v => [v.date, v.voucherNumber, v.payeeName, v.narration, v.paymentMethod === 'CASH' ? 'نقداً' : v.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك', v.totalAmount, v.status === 'POSTED' ? 'مرحّل' : v.status === 'VOIDED' ? 'ملغى' : 'بانتظار الترحيل']) };
      case 'RECEIPT_VOUCHERS_REPORT':
        return { columns: ['التاريخ', 'رقم السند', 'المدفوع منه', 'البيان', 'طريقة القبض', 'المبلغ', 'الحالة'], rows: filteredReceiptVouchers.map(v => [v.date, v.receiptNumber, v.payerName, v.narration, v.receiptMethod === 'CASH' ? 'نقداً' : v.receiptMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك', v.totalAmount, v.status === 'POSTED' ? 'مرحّل' : v.status === 'VOIDED' ? 'ملغى' : 'بانتظار الترحيل']) };
      case 'JOURNAL_ENTRIES_REPORT':
        return { columns: ['التاريخ', 'رقم المستند', 'النوع', 'البيان', 'العملة', 'مدين', 'دائن', 'الحالة'], rows: filteredJournalEntries.map(j => [j.date, j.entryNumber, j.type === 'PV' ? 'سند صرف' : j.type === 'RV' ? 'سند قبض' : 'قيد يدوي', j.narration, j.currency || baseCode, j.totalDebit, j.totalCredit, j.status === 'POSTED' ? 'مرحّل' : j.status === 'VOIDED' ? 'ملغى' : 'بانتظار الترحيل']) };
      default:
        return { columns: ['البند', 'البيان'], rows: [] };
    }
  };

  const renderStatements = () => (
    printableStatementSpecs.map(spec => (
      <PrintableAccountStatement
        key={spec.key}
        titleAr={spec.titleAr}
        titleEn={spec.titleEn}
        subjectCode={spec.subjectCode}
        subjectName={spec.subjectName}
        subjectExtra={spec.subjectExtra}
        fromDate={fromDate}
        toDate={toDate}
        currencyCode={spec.currencyCode || currency}
        currencyNameAr={currencyOptions.find(option => option.code === (spec.currencyCode || currency))?.label.split(' (')[0] || spec.currencyCode || currency}
        currencySymbol={symbolOf(spec.currencyCode || currency)}
        opening={spec.opening}
        rows={spec.rows}
        showOpening={spec.showOpening}
        isSummary={isSummary}
        currentUserName={currentUserName}
        company={company}
      />
    ))
  );

  const reportFooter = (
    <div className="flex flex-col items-center justify-center gap-2 pt-5 mt-8 border-t border-slate-100">
      <div className="flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
        <span className="font-bold">نهاية التقرير</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="font-mono text-xs">{REPORT_META[reportType].en}</span>
        <span className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
        <span className="font-mono">{dateToDisplay(fromDate)} ← {dateToDisplay(toDate)}</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span>{currentUserName}</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="font-mono">{new Date().toLocaleDateString('en-GB')}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<FileBarChart2 className="w-6 h-6" />}
        title="التقارير المالية"
        titleBadge="IFRS"
        subtitle="Financial Reports — عرض واستخراج القوائم المالية العامة، ميزان المراجعة، كشوف الحسابات، وتقارير الكيانات التفصيلية"
        actions={
          <button
            onClick={() => openExplorerFor(selectedAccount?.id || accounts.find(a => a.level === 1)?.id || '')}
            className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-5 py-2.5 text-sm font-bold text-[#ffffff] shadow-sm backdrop-blur-sm transition-all cursor-pointer"
          >
            <FolderTree className="w-4 h-4" />
            مستكشف الحسابات
          </button>
        }
      />

      <div className="space-y-6">
        <section className="p-0 bg-transparent border-none">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-1.5 h-5 rounded-full bg-[#006fba]" />
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">التقارير المالية العامة</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(['TRIAL_BALANCE', 'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'EQUITY_CHANGES', 'LEDGER', 'COST_CENTERS', 'PAYMENT_VOUCHERS_REPORT', 'RECEIPT_VOUCHERS_REPORT', 'JOURNAL_ENTRIES_REPORT'] as ReportType[]).map(rt => (
              <button
                key={rt}
                type="button"
                onClick={() => { setReportType(rt); setShowReport(false); setFiltersCollapsed(false); }}
                className={`group flex flex-col items-center gap-2.5 glass rounded-2xl px-3 py-5 transition-all duration-300 cursor-pointer overflow-hidden ${reportType === rt
                  ? 'border border-sky-500/50 bg-sky-50/80 shadow-lg shadow-sky-500/10 -translate-y-0.5 dark:bg-sky-950/40 dark:border-sky-500/50'
                  : 'border border-slate-200/60 hover:border-sky-400/50 hover:shadow-xl hover:shadow-sky-500/5 hover:-translate-y-0.5 dark:border-slate-700/50'}`}
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 transition-all duration-300 group-hover:scale-110 dark:text-sky-400">
                  {REPORT_ICONS[rt]}
                </span>
                <span className={`font-bold text-[13px] text-center leading-snug transition-colors ${reportType === rt ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'}`}>{REPORT_META[rt].ar}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="p-0 bg-transparent border-none">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-1.5 h-5 rounded-full bg-emerald-500" />
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">تقارير الكيانات التفصيلية</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(['CASHBOX_REPORT', 'BANK_REPORT', 'EMPLOYEES_REPORT', 'CUSTOMERS_REPORT', 'VENDORS_REPORT', 'TRUSTS_REPORT'] as ReportType[]).map(rt => (
              <button
                key={rt}
                type="button"
                onClick={() => { setReportType(rt); setShowReport(false); setFiltersCollapsed(false); }}
                className={`group flex flex-col items-center gap-2.5 glass rounded-2xl px-3 py-5 transition-all duration-300 cursor-pointer overflow-hidden ${reportType === rt
                  ? 'border border-emerald-500/50 bg-emerald-50/80 shadow-lg shadow-emerald-500/10 -translate-y-0.5 dark:bg-emerald-950/40 dark:border-emerald-500/50'
                  : 'border border-slate-200/60 hover:border-emerald-400/50 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-0.5 dark:border-slate-700/50'}`}
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 transition-all duration-300 group-hover:scale-110 dark:text-emerald-400">
                  {REPORT_ICONS[rt]}
                </span>
                <span className={`font-bold text-[13px] text-center leading-snug transition-colors ${reportType === rt ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>{REPORT_META[rt].ar}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="bg-white dark:bg-white overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersCollapsed(v => !v)}
          className="w-full px-5 py-3.5 bg-white dark:bg-white border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all"
        >
          <span className="text-[15px] font-extrabold text-slate-900 flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600">
              <Settings2 className="w-4 h-4" />
            </span>
            خيارات التقرير
            <span className="text-xs font-mono text-slate-400 font-normal">/ {REPORT_META[reportType].en}</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <Globe className="w-3 h-3" />
              IFRS
            </span>
            {filtersCollapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-300" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400 transition-transform duration-300" />
            )}
          </span>
        </button>

        {!filtersCollapsed && (
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-slate-200">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-[#006fba]" />
                فترات سريعة
              </span>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button
                type="button"
                onClick={quickToday}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${isQuickActive('today')
                  ? 'bg-[#006fba] text-white border-[#006fba] shadow-md shadow-sky-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={quickThisMonth}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${isQuickActive('month')
                  ? 'bg-[#006fba] text-white border-[#006fba] shadow-md shadow-sky-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={quickFiscalYear}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${isQuickActive('year')
                  ? 'bg-[#006fba] text-white border-[#006fba] shadow-md shadow-sky-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
              >
                السنة المالية
              </button>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-40">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">من تاريخ (From)</label>
                <SmartDateInput
                  value={fromDate}
                  onChange={setFromDate}

                  className="rounded-lg"
                />
              </div>

              <div className="w-40">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">إلى تاريخ (To)</label>
                <SmartDateInput
                  value={toDate}
                  onChange={setToDate}

                  className="rounded-lg"
                />
              </div>

              <div className="w-44">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">نوع التقرير (Report Level)</label>
                <div className="relative">
                  <select
                    value={reportLevel}
                    onChange={e => setReportLevel(e.target.value as typeof reportLevel)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white text-slate-800 appearance-none cursor-pointer border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ANALYTICAL">تحليلي (Detailed)</option>
                    <option value="SUMMARY">إجمالي (Summary)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1 min-w-[170px]">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">العملة (Currency)</label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none shadow-2xs"
                >
                  <option value="ALL">-- كافة العملات (شامل) --</option>
                  {activeCurrencies.map(c => (
                    <option key={c.code} value={c.code}>{c.nameAr} ({c.code})</option>
                  ))}
                </select>
              </div>

              {isEntityOrCostCenterReport && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
                  {([
                    { side: 'from' as const, label: 'من', mainId: fromMainAccountId, entityId: fromEntityId, entityCode: fromEntityCode },
                    { side: 'to' as const, label: 'إلى', mainId: toMainAccountId, entityId: toEntityId, entityCode: toEntityCode },
                  ]).map(({ side, label, mainId, entityId, entityCode }) => {
                    const selectedMain = reportMainAccounts.find(account => account.id === mainId);
                    const selectableEntities = entitiesForMainAccount(mainId);
                    const setMain = (account?: Account) => {
                      if (side === 'from') {
                        setFromMainAccountId(account?.id || ''); setFromEntityId(''); setFromEntityCode('');
                      } else {
                        setToMainAccountId(account?.id || ''); setToEntityId(''); setToEntityCode('');
                      }
                    };
                    const setEntity = (entity?: ReportEntityOption) => {
                      if (side === 'from') {
                        setFromEntityId(entity?.id || ''); setFromEntityCode(entity?.code || '');
                      } else {
                        setToEntityId(entity?.id || ''); setToEntityCode(entity?.code || '');
                      }
                    };
                    return (
                      <div key={side} className="grid grid-cols-1 gap-2">
                        <F9SearchInput<Account>
                          value={selectedMain?.code || ''}
                          onChange={(value) => setMain(reportMainAccounts.find(account => account.code.toLowerCase() === value.toLowerCase()))}
                          onSelect={setMain}
                          items={reportMainAccounts}
                          columns={[
                            { label: 'الكود', render: account => account.code, className: 'w-24 font-mono text-sky-600' },
                            { label: 'الحساب الرئيسي', render: account => account.nameAr },
                          ]}
                          searchText={account => `${account.code} ${account.nameAr} ${account.nameEn}`}
                          browseTitle={`اختيار ${label} الحساب الرئيسي`}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
                        />
                        <F9SearchInput<ReportEntityOption>
                          value={entityCode}
                          onChange={(value) => setEntity(selectableEntities.find(entity => entity.code.toLowerCase() === value.toLowerCase()))}
                          onSelect={setEntity}
                          items={selectableEntities}
                          columns={[
                            { label: 'الكود', render: entity => entity.code, className: 'w-24 font-mono text-sky-600' },
                            { label: reportType === 'COST_CENTERS' ? 'مركز التكلفة' : 'الحساب التحليلي', render: entity => entity.name },
                          ]}
                          searchText={entity => `${entity.code} ${entity.name}`}
                          browseTitle={`اختيار ${label} ${reportType === 'COST_CENTERS' ? 'مركز التكلفة' : 'الحساب التحليلي'}`}
                          inputProps={{ disabled: !mainId || !selectableEntities.length, 'aria-label': `${label} الحساب التحليلي` }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {(reportType === 'TRIAL_BALANCE' || reportType === 'LEDGER') && (
                <>
                  <div className="w-44">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">من حساب (From Account)</label>
                    <F9SearchInput<Account>
                      value={fromAccount}
                      onChange={setFromAccount}
                      onSelect={(a) => setFromAccount(a.code)}

                      className="w-full px-3 py-2 text-sm rounded-lg bg-white text-slate-800 border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      items={accounts.filter(a => a.level === 5 && a.isActive)}
                      columns={[
                        { label: 'الكود', render: a => a.code, className: 'w-24 font-mono text-sky-400' },
                        { label: 'الاسم (عربي)', render: a => a.nameAr },
                        { label: 'الاسم (إنجليزي)', render: a => a.nameEn, className: 'text-slate-400' }
                      ]}
                      searchText={a => `${a.code} ${a.nameAr} ${a.nameEn}`}
                      browseTitle="اختيار حساب البداية"
                    />
                  </div>
                  <div className="w-44">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">إلى حساب (To Account)</label>
                    <F9SearchInput<Account>
                      value={toAccount}
                      onChange={setToAccount}
                      onSelect={(a) => setToAccount(a.code)}

                      className="w-full px-3 py-2 text-sm rounded-lg bg-white text-slate-800 border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      items={accounts.filter(a => a.level === 5 && a.isActive)}
                      columns={[
                        { label: 'الكود', render: a => a.code, className: 'w-24 font-mono text-sky-400' },
                        { label: 'الاسم (عربي)', render: a => a.nameAr },
                        { label: 'الاسم (إنجليزي)', render: a => a.nameEn, className: 'text-slate-400' }
                      ]}
                      searchText={a => `${a.code} ${a.nameAr} ${a.nameEn}`}
                      browseTitle="اختيار حساب النهاية"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showDetails}
                    onChange={e => setShowDetails(e.target.checked)}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                  إظهار الأرصدة التفصيلية
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeOpening}
                    onChange={e => setIncludeOpening(e.target.checked)}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                  إدخال الرصيد الافتتاحي
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showZeroAccounts}
                    onChange={e => setShowZeroAccounts(e.target.checked)}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                  إظهار الحسابات ذات الرصيد الصفري
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={showPriorComparison} onChange={event => setShowPriorComparison(event.target.checked)} />
                مقارنة بالفترة السابقة
              </label>
            </div>

            {!reportPeriodValidation.valid && (
              <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {reportPeriodValidation.error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-200">
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer shadow-xs"
              >
                <X className="w-3.5 h-3.5" />
                مسح الفلاتر
              </button>
              <button
                type="button"
                onClick={handleShowReport}
                disabled={!reportPeriodValidation.valid}
                className="financial-reports-show-button flex items-center gap-2 px-7 py-2.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-[#006fba] to-blue-600 hover:from-[#0060aa] hover:to-blue-500 text-white border border-[#006fba] shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                عرض التقرير
              </button>
            </div>
          </div>
        )}
      </div>

      {showReport && (
        <div className={`rounded-2xl bg-white animate-fade-in dark:bg-white report-screen-container ${enableEnhancedView ? 'enhanced-sticky-header overflow-x-clip' : 'overflow-hidden'}`}>
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#006fba]/10 text-[#006fba] dark:text-sky-400">{REPORT_ICONS[reportType]}</span>
              <div>
                <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{REPORT_META[reportType].ar}</span>
                <span className="text-xs text-slate-400 font-mono mr-2">({REPORT_META[reportType].en})</span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">من {fromDate} إلى {toDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => printReport(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#006fba] hover:bg-[#005f9f] text-white transition-all cursor-pointer"
                title="المعاينة متاحة حتى عندما لا توجد حركات في الفترة"
              >
                <Printer className="w-3.5 h-3.5" />
                معاينة الطباعة / PDF
              </button>
              <button
                type="button"
                onClick={() => setFiltersCollapsed(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/80 transition-all cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                تعديل الفلاتر
              </button>
              <span className="text-[11px] text-slate-400 font-mono">{postedCount} قيد مرحلة</span>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="p-5">
            {showPriorComparison && comparisonMetric && (
              <div className="mb-5 grid md:grid-cols-3 gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-slate-800" aria-label="مقارنة الفترة السابقة">
                <div><div className="text-xs text-slate-500">{comparisonMetric.label} — الفترة الحالية</div><div className="mt-1 text-lg font-black font-mono">{fmt(comparisonMetric.current)}</div><div className="text-[11px] text-slate-400">{fromDate} — {toDate}</div></div>
                <div><div className="text-xs text-slate-500">{comparisonMetric.label} — الفترة السابقة</div><div className="mt-1 text-lg font-black font-mono">{fmt(comparisonMetric.previous)}</div><div className="text-[11px] text-slate-400">{priorPeriod.fromDate} — {priorPeriod.toDate}</div></div>
                <div><div className="text-xs text-slate-500">التغير</div><div className={`mt-1 text-lg font-black font-mono ${comparisonMetric.current - comparisonMetric.previous >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(comparisonMetric.current - comparisonMetric.previous)}</div><div className="text-[11px] text-slate-400">{comparisonMetric.previous ? `${((comparisonMetric.current - comparisonMetric.previous) / Math.abs(comparisonMetric.previous) * 100).toFixed(1)}%` : 'لا توجد قاعدة مقارنة'}</div></div>
              </div>
            )}
            {reportType === 'TRIAL_BALANCE' && (
              <div id="trial-balance-print-document" className="mx-auto" style={{ maxWidth: '1122px' }}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4 no-print">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${groupedTB.isBalanced ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-red-500/15 border-red-500/40 text-red-500'}`}>
                    {groupedTB.isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="text-sm font-bold">{groupedTB.isBalanced ? 'ميزان المراجعة متوازن' : 'تنبيه: ميزان المراجعة غير متوازن!'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => printReport(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة / PDF
                  </button>
                </div>

                <FinancialReportPrintLayout
                  title="ميزان المراجعة حسب الحساب"
                  fromDate={fromDate}
                  toDate={toDate}
                  printedBy={currentUserName}
                  orientation="portrait"
                  companyInfo={{
                    name: company.companyNameAr || '—',
                    branch: company.branchNameAr || company.branchCode || '—',
                    address: company.addressAr || '',
                    phone: company.phone || '',
                    logoUrl: company.logoUrl || undefined,
                  }}
                >
                  <style>{`
                    @media print {
                      body * {
                        visibility: hidden !important;
                      }
                      #trial-balance-print-document,
                      #trial-balance-print-document * {
                        visibility: visible !important;
                      }
                      #trial-balance-print-document {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                      }
                      @page {
                        size: A4 portrait;
                        margin: 8mm;
                      }
                    }
                    .tb-official-table {
                      width: 96%;
                      max-width: 96%;
                      margin-left: auto;
                      margin-right: auto;
                      border-collapse: collapse;
                      font-size: 7.2px;
                      border: 1px solid #000;
                      color: #000;
                    }
                    .tb-official-table th, .tb-official-table td {
                      border: 1px solid #000;
                      padding: 4px 6px;
                      text-align: center;
                    }
                    .tb-official-table thead th {
                      background-color: #b4a7d6 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      font-weight: bold;
                    }
                    .tb-official-table thead tr:nth-child(2) th {
                      background-color: #d9d2e9 !important;
                    }
                    .tb-official-table .text-right { text-align: right; }
                    .tb-official-table .print-color-exact {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                  `}</style>

                  <table className="tb-official-table">
                    <colgroup>
                      <col style={{ width: '3%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2}>#</th>
                        <th rowSpan={2}>رقم الحساب</th>
                        <th rowSpan={2}>اسم الحساب</th>
                        <th rowSpan={2}>العملة</th>
                        <th colSpan={2}>الأرصدة الافتتاحية</th>
                        <th colSpan={2}>الحركة</th>
                        <th colSpan={2}>الرصيد الحالي</th>
                      </tr>
                      <tr>
                        <th>مدين</th>
                        <th>دائن</th>
                        <th>مدين</th>
                        <th>دائن</th>
                        <th>مدين</th>
                        <th>دائن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let flatIndex = 1;
                        return groupedTB.groups.map(g => (
                          <React.Fragment key={g.key}>
                            {g.rows.map(row => (
                              <tr key={row.key} className={`cursor-pointer hover:bg-slate-50 transition-colors ${row.isAnalytical ? 'bg-sky-50/40' : ''}`} onClick={() => openLedger(row.accountId)}>
                                <td>{row.isAnalytical ? '' : flatIndex++}</td>
                                <td className={`font-mono ${row.isAnalytical ? 'pr-5 text-sky-700' : ''}`}>{row.code}</td>
                                <td className={`text-right ${row.isAnalytical ? 'pr-5 text-sky-700 font-semibold' : ''}`}>{row.name}</td>
                                <td className="font-mono">{row.currency}</td>
                                <td className="font-mono">{row.openingDebit > 0 ? fmt(row.openingDebit) : ''}</td>
                                <td className="font-mono">{row.openingCredit > 0 ? fmt(row.openingCredit) : ''}</td>
                                <td className="font-mono">{row.movementDebit > 0 ? fmt(row.movementDebit) : ''}</td>
                                <td className="font-mono">{row.movementCredit > 0 ? fmt(row.movementCredit) : ''}</td>
                                <td className="font-mono">{row.endingDebit > 0 ? fmt(row.endingDebit) : ''}</td>
                                <td className="font-mono">{row.endingCredit > 0 ? fmt(row.endingCredit) : ''}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ));
                      })()}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#fce4ec' }} className="print-color-exact">
                        <td colSpan={2} className="font-bold text-slate-800">عدد السجلات: {groupedTB.rowCount}</td>
                        <td className="font-bold text-left text-slate-800">إجمالي حسب العملة :</td>
                        <td className="font-bold text-slate-800">{currency === 'ALL' ? 'YR' : currency}</td>
                        <td className="font-mono font-bold text-rose-600">{groupedTB.totals.openingDebit > 0 ? fmt(groupedTB.totals.openingDebit) : '0.00'}</td>
                        <td className="font-mono font-bold text-rose-600">{groupedTB.totals.openingCredit > 0 ? fmt(groupedTB.totals.openingCredit) : '0.00'}</td>
                        <td className="font-mono font-bold text-rose-600">{groupedTB.totals.movementDebit > 0 ? fmt(groupedTB.totals.movementDebit) : '0.00'}</td>
                        <td className="font-mono font-bold text-rose-600">{groupedTB.totals.movementCredit > 0 ? fmt(groupedTB.totals.movementCredit) : '0.00'}</td>
                        <td className="font-mono font-bold text-rose-600">{groupedTB.totals.endingDebit > 0 ? fmt(groupedTB.totals.endingDebit) : '0.00'}</td>
                        <td className="font-mono font-bold text-rose-600">{groupedTB.totals.endingCredit > 0 ? fmt(groupedTB.totals.endingCredit) : '0.00'}</td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="font-bold border-b-0 text-center text-slate-800">العدد الكلي: {groupedTB.rowCount}</td>
                        <td className="font-bold text-left border-b-0 text-slate-800">الاجمالي الكلي بالعملة المحلية :</td>
                        <td className="font-bold text-center border-b-0 text-slate-800">
                          <div className="flex justify-between items-center px-1">
                            <span>{currency === 'ALL' ? 'YR' : currency}</span>
                            <span>مدين</span>
                          </div>
                        </td>
                        <td colSpan={2} className="font-mono font-bold text-center text-slate-900">{groupedTB.totals.openingDebit > 0 ? fmt(groupedTB.totals.openingDebit) : '0.00'}</td>
                        <td colSpan={2} className="font-mono font-bold text-center text-slate-900">{groupedTB.totals.movementDebit > 0 ? fmt(groupedTB.totals.movementDebit) : '0.00'}</td>
                        <td colSpan={2} className="font-mono font-bold text-center text-slate-900">{groupedTB.totals.endingDebit > 0 ? fmt(groupedTB.totals.endingDebit) : '0.00'}</td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="border-t-0"></td>
                        <td className="border-t-0"></td>
                        <td className="font-bold text-left text-slate-800">دائن</td>
                        <td colSpan={2} className="font-mono font-bold text-center text-slate-900">{groupedTB.totals.openingCredit > 0 ? fmt(groupedTB.totals.openingCredit) : '0.00'}</td>
                        <td colSpan={2} className="font-mono font-bold text-center text-slate-900">{groupedTB.totals.movementCredit > 0 ? fmt(groupedTB.totals.movementCredit) : '0.00'}</td>
                        <td colSpan={2} className="font-mono font-bold text-center text-slate-900">{groupedTB.totals.endingCredit > 0 ? fmt(groupedTB.totals.endingCredit) : '0.00'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </FinancialReportPrintLayout>
              </div>
            )}

            {reportType === 'INCOME_STATEMENT' && (
              <div className="max-w-[820px] mx-auto print-is-container">
                <div className="mb-6 no-print">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h2 className="text-xl font-black text-slate-100">قائمة الدخل — Income Statement</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => printReport(false)}
                      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة / PDF
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pr-5">
                    <span>الفترة: <span className="font-mono text-slate-300">{dateToDisplay(fromDate)} ← {dateToDisplay(toDate)}</span></span>
                    <span>العملة: <span className="text-slate-300">{curMeta.label}</span></span>
                    <span>أُعدّ بواسطة: <span className="font-semibold text-slate-300">{currentUserName}</span></span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                  <div className="space-y-0 text-sm">
                    <div className="border-b border-slate-200 dark:border-slate-800/30">
                      <div className="px-5 py-2.5 bg-gradient-to-l from-emerald-500/8 to-transparent border-b border-slate-200 dark:border-slate-800/30">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-[15px]">١. الإيرادات — Revenues</span>
                      </div>
                      {filteredIncomeStmt.revenueLines.map(l => (
                        <div key={l.key} className="flex justify-between px-5 py-[7px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/30 last:border-b-0">
                          <span className="pr-8">{l.labelAr} <span className="text-[11px] text-slate-400 dark:text-slate-500">{l.labelEn}</span></span>
                          <span className="font-mono text-[13px] text-slate-800 dark:text-slate-200 tabular-nums">{fmt(l.amount)} {sym}</span>
                        </div>
                      ))}
                      {filteredIncomeStmt.revenueResidual !== 0 && (
                        <div className="flex justify-between px-5 py-[7px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/30">
                          <span className="pr-8">إيرادات أخرى — Other Revenues</span>
                          <span className="font-mono text-[13px] tabular-nums">{fmt(filteredIncomeStmt.revenueResidual)} {sym}</span>
                        </div>
                      )}
                      <div className="flex justify-between px-5 py-2.5 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-t-2 border-double border-emerald-300 dark:border-emerald-700/50">
                        <span>إجمالي الإيرادات — Total Revenues</span>
                        <span className="font-mono tabular-nums">{fmt(filteredIncomeStmt.totalRevenues)} {sym}</span>
                      </div>
                    </div>

                    <div className="border-b border-slate-200 dark:border-slate-800/30">
                      <div className="px-5 py-2.5 bg-gradient-to-l from-rose-500/8 to-transparent border-b border-slate-200 dark:border-slate-800/30">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-[15px]">٢. المصاريف التشغيلية — Operating Expenses</span>
                      </div>
                      {filteredIncomeStmt.expenseLines.map(l => (
                        <div key={l.key} className="flex justify-between px-5 py-[7px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/30 last:border-b-0">
                          <span className="pr-8">{l.labelAr} <span className="text-[11px] text-slate-400 dark:text-slate-500">{l.labelEn}</span></span>
                          <span className="font-mono text-[13px] text-rose-600 dark:text-rose-400 tabular-nums">{fmtP(-l.amount)} {sym}</span>
                        </div>
                      ))}
                      {filteredIncomeStmt.operatingResidual !== 0 && (
                        <div className="flex justify-between px-5 py-[7px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/30">
                          <span className="pr-8">مصاريف تشغيلية أخرى — Other Operating</span>
                          <span className="font-mono text-[13px] text-rose-600 dark:text-rose-400 tabular-nums">{fmtP(-filteredIncomeStmt.operatingResidual)} {sym}</span>
                        </div>
                      )}
                      <div className="flex justify-between px-5 py-2.5 font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-t-2 border-double border-rose-300 dark:border-rose-700">
                        <span>إجمالي المصاريف التشغيلية — Total Operating Expenses</span>
                        <span className="font-mono tabular-nums">{fmtP(-filteredIncomeStmt.totalOperatingExpenses)} {sym}</span>
                      </div>
                    </div>

                    {(filteredIncomeStmt.nonOperatingLines.length > 0 || filteredIncomeStmt.totalNonOperatingExpenses !== 0) && (
                      <div className="border-b border-slate-200 dark:border-slate-800/30">
                        <div className="px-5 py-2.5 bg-gradient-to-l from-amber-500/8 to-transparent border-b border-slate-200 dark:border-slate-800/30">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-[15px]">٣. المصاريف غير التشغيلية — Non-Operating Expenses</span>
                        </div>
                        {filteredIncomeStmt.nonOperatingLines.map(l => (
                          <div key={l.key} className="flex justify-between px-5 py-[7px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/30 last:border-b-0">
                            <span className="pr-8">{l.labelAr} <span className="text-[11px] text-slate-400 dark:text-slate-500">{l.labelEn}</span></span>
                            <span className="font-mono text-[13px] text-rose-600 dark:text-rose-400 tabular-nums">{fmtP(-l.amount)} {sym}</span>
                          </div>
                        ))}
                        <div className="flex justify-between px-5 py-2.5 font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-t-2 border-double border-amber-300 dark:border-amber-700">
                          <span>إجمالي المصاريف غير التشغيلية — Total Non-Operating</span>
                          <span className="font-mono tabular-nums">{fmtP(-filteredIncomeStmt.totalNonOperatingExpenses)} {sym}</span>
                        </div>
                      </div>
                    )}

                    <div className="border-b border-slate-200 dark:border-slate-800/30">
                      <div className="flex justify-between px-5 py-2.5 font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-t-2 border-double border-blue-300 dark:border-blue-700">
                        <span>الربح التشغيلي — Operating Profit (EBIT)</span>
                        <span className="font-mono tabular-nums">{fmtP(filteredIncomeStmt.operatingProfit)} {sym}</span>
                      </div>
                    </div>

                    <div>
                      <div className={`flex justify-between px-5 py-3 font-black text-[15px] border-t-2 border-double ${filteredIncomeStmt.netIncome >= 0
                        ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600'
                        : 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600'
                        }`}>
                        <span>صافي الدخل — Net Income (Net Profit)</span>
                        <span className="font-mono tabular-nums">{fmtP(filteredIncomeStmt.netIncome)} {sym}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700/40 pt-2 font-bold text-slate-700 dark:text-slate-300">إعداد المحاسب</div>
                    <div className="mt-1">الاسم: ......................</div>
                    <div className="mt-5">التوقيع: ......................</div>
                  </div>
                  <div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700/40 pt-2 font-bold text-slate-700 dark:text-slate-300">مراجعة المدير المالي</div>
                    <div className="mt-1">الاسم: ......................</div>
                    <div className="mt-5">التوقيع: ......................</div>
                  </div>
                  <div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700/40 pt-2 font-bold text-slate-700 dark:text-slate-300">اعتماد المدير العام</div>
                    <div className="mt-1">الاسم: ......................</div>
                    <div className="mt-5">التوقيع: ......................</div>
                  </div>
                </div>
              </div>
            )}

            {reportType === 'BALANCE_SHEET' && (
              <div className="max-w-[920px] mx-auto print-bs-container">
                <div className="mb-6 no-print">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      <h2 className="text-xl font-black text-slate-100">الميزانية العمومية حسب الحساب — Balance Sheet by Account</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => printReport(false)}
                      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة / PDF
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pr-5">
                    <span>من تاريخ: <span className="font-mono text-slate-300">{fromDate}</span></span>
                    <span>إلى تاريخ: <span className="font-mono text-slate-300">{toDate}</span></span>
                    <span>العملة: <span className="text-slate-300">{curMeta.label}</span></span>
                    <span>أُعدّ بواسطة: <span className="font-semibold text-slate-300">{currentUserName}</span></span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[920px]">
                      <thead>
                        <tr className="bg-[#b4a7d6] text-slate-900">
                          <th className="px-2 py-2 border border-slate-300">#</th>
                          <th className="px-2 py-2 border border-slate-300 text-right">رقم الحساب</th>
                          <th className="px-2 py-2 border border-slate-300 text-right">اسم الحساب</th>
                          <th className="px-2 py-2 border border-slate-300">العملة</th>
                          <th className="px-2 py-2 border border-slate-300" colSpan={2}>أرصدة الفترة الحالية</th>
                          <th className="px-2 py-2 border border-slate-300" colSpan={2}>أرصدة تراكمية</th>
                        </tr>
                        <tr className="bg-[#d9d2e9] text-slate-900">
                          <th className="border border-slate-300"></th>
                          <th className="border border-slate-300"></th>
                          <th className="border border-slate-300"></th>
                          <th className="border border-slate-300"></th>
                          <th className="px-2 py-1 border border-slate-300 font-semibold">مدين</th>
                          <th className="px-2 py-1 border border-slate-300 font-semibold">دائن</th>
                          <th className="px-2 py-1 border border-slate-300 font-semibold">مدين</th>
                          <th className="px-2 py-1 border border-slate-300 font-semibold">دائن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bsByAccount.rows.map((r, i) => (
                          <tr key={r.accountId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-2 py-1 border border-slate-200 text-center font-mono text-xs">{i + 1}</td>
                            <td className="px-2 py-1 border border-slate-200 font-mono text-xs">{r.code}</td>
                            <td className="px-2 py-1 border border-slate-200 text-right">{r.name}</td>
                            <td className="px-2 py-1 border border-slate-200 text-center font-mono text-xs">{r.currency}</td>
                            <td className="px-2 py-1 border border-slate-200 text-center font-mono text-xs">{r.currentDebit > 0 ? fmt(r.currentDebit) : ''}</td>
                            <td className="px-2 py-1 border border-slate-200 text-center font-mono text-xs">{r.currentCredit > 0 ? fmt(r.currentCredit) : ''}</td>
                            <td className="px-2 py-1 border border-slate-200 text-center font-mono text-xs">{r.cumulativeDebit > 0 ? fmt(r.cumulativeDebit) : ''}</td>
                            <td className="px-2 py-1 border border-slate-200 text-center font-mono text-xs">{r.cumulativeCredit > 0 ? fmt(r.cumulativeCredit) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {(Math.abs(bsCurrentDiff) > 0.005 || Math.abs(bsCumulativeDiff) > 0.005) && (
                          <tr className="bg-[#fce4ec]">
                            <td colSpan={4} className="px-2 py-1 border border-slate-300 font-bold text-right">الفارق بين المدين والدائن</td>
                            <td className="px-2 py-1 border border-slate-300 text-center font-mono font-bold">{bsCurrentDiff > 0 ? fmt(bsCurrentDiff) : ''}</td>
                            <td className="px-2 py-1 border border-slate-300 text-center font-mono font-bold">{bsCurrentDiff < 0 ? fmt(-bsCurrentDiff) : ''}</td>
                            <td className="px-2 py-1 border border-slate-300 text-center font-mono font-bold">{bsCumulativeDiff > 0 ? fmt(bsCumulativeDiff) : ''}</td>
                            <td className="px-2 py-1 border border-slate-300 text-center font-mono font-bold">{bsCumulativeDiff < 0 ? fmt(-bsCumulativeDiff) : ''}</td>
                          </tr>
                        )}
                        <tr className="bg-[#c5c7f1] font-black text-slate-900">
                          <td colSpan={2} className="px-2 py-2 border border-slate-300 font-bold">العدد الكلي: {bsByAccount.count}</td>
                          <td className="px-2 py-2 border border-slate-300 font-bold text-right">الإجمالي الكلي بالعملة المحلية ({baseCode})</td>
                          <td className="px-2 py-2 border border-slate-300 text-center font-bold">{baseCode}</td>
                          <td className="px-2 py-2 border border-slate-300 text-center font-mono">{fmt(bsByAccount.totals.currentDebitYER)}</td>
                          <td className="px-2 py-2 border border-slate-300 text-center font-mono">{fmt(bsByAccount.totals.currentCreditYER)}</td>
                          <td className="px-2 py-2 border border-slate-300 text-center font-mono">{fmt(bsByAccount.totals.cumulativeDebitYER)}</td>
                          <td className="px-2 py-2 border border-slate-300 text-center font-mono">{fmt(bsByAccount.totals.cumulativeCreditYER)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="mt-5 text-center">
                  <div className={`inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl px-6 py-3 border ${balanceSheet.isBalanced
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                    }`}>
                    <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
                      الأصول: {fmt(balanceSheet.totalAssets)} {sym}
                    </span>
                    <span className={`font-bold ${balanceSheet.isBalanced ? 'text-emerald-500' : 'text-rose-500'}`}>=</span>
                    <span className="text-[13px] font-bold text-sky-700 dark:text-sky-400">
                      الخصوم + الملكية: {fmt(balanceSheet.totalLiabilitiesAndEquity)} {sym}
                    </span>
                    {balanceSheet.isBalanced
                      ? <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900">متوازنة</span>
                      : <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900">غير متوازنة</span>
                    }
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700/40 pt-2 font-bold text-slate-700 dark:text-slate-300">إعداد المحاسب</div>
                    <div className="mt-1">الاسم: ......................</div>
                    <div className="mt-5">التوقيع: ......................</div>
                  </div>
                  <div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700/40 pt-2 font-bold text-slate-700 dark:text-slate-300">مراجعة المدير المالي</div>
                    <div className="mt-1">الاسم: ......................</div>
                    <div className="mt-5">التوقيع: ......................</div>
                  </div>
                  <div>
                    <div className="border-t-2 border-slate-300 dark:border-slate-700/40 pt-2 font-bold text-slate-700 dark:text-slate-300">اعتماد المدير العام</div>
                    <div className="mt-1">الاسم: ......................</div>
                    <div className="mt-5">التوقيع: ......................</div>
                  </div>
                </div>
              </div>
            )}

            {(reportType === 'CASH_FLOW' || reportType === 'EQUITY_CHANGES') && (() => {
              const statement = buildReportData();
              const reconciled = reportType === 'CASH_FLOW' ? cashFlow.isReconciled : equityChanges.isReconciled;
              return (
                <div className="max-w-[820px] mx-auto">
                  <div className="mb-6 no-print flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-slate-100">{REPORT_META[reportType].ar}</h2>
                      <div className="text-xs text-slate-400">{dateToDisplay(fromDate)} ← {dateToDisplay(toDate)} · {curMeta.label}</div>
                    </div>
                    <button type="button" onClick={() => printReport(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-700 text-slate-200 cursor-pointer"><Printer className="w-3.5 h-3.5" />طباعة / PDF</button>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-700 bg-white dark:bg-slate-900">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-[#b4a7d6] text-slate-900">{statement.columns.map(column => <th key={column} className="p-3 border border-slate-300">{column}</th>)}</tr></thead>
                      <tbody>{statement.rows.map((row, index) => <tr key={index} className="border-b border-slate-200 dark:border-slate-800"><td className="p-3 font-bold">{row[0]}</td><td className="p-3 font-mono text-left">{typeof row[1] === 'number' ? `${fmtP(row[1])} ${sym}` : row[1]}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className={`mt-4 rounded-xl border p-3 text-center text-sm font-bold ${reconciled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                    {reconciled ? 'تمت المطابقة مع الأستاذ العام والميزانية' : 'يوجد فرق مطابقة يجب مراجعته قبل الاعتماد'}
                  </div>
                </div>
              );
            })()}

            {reportType === 'LEDGER' && (
              selectedAccount && ledger ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-black text-sky-400">{selectedAccount.code}</span>
                          <span className="text-lg font-black text-slate-100">{selectedAccount.nameAr}</span>
                          <span className="text-xs text-slate-400 font-mono">{selectedAccount.nameEn}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">Level {selectedAccount.level}</span>
                          <span className={`px-2 py-0.5 rounded-full font-mono border ${selectedAccount.nature === 'DEBIT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-sky-500/15 text-sky-300 border-sky-500/30'}`}>
                            {selectedAccount.nature === 'DEBIT' ? 'مدين (Debit)' : 'دائن (Credit)'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-slate-400 border border-slate-800/30">{selectedAccount.category.replace(/_/g, ' ')}</span>
                          <span className={`px-2 py-0.5 rounded-full ${selectedAccount.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-800'} border border-slate-800/30`}>
                            {selectedAccount.isActive ? 'نشط (Active)' : 'موقوف (Inactive)'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openExplorerFor(selectedAccount.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          <FolderTree className="w-3.5 h-3.5" />
                          في المستكشف
                        </button>
                        <button
                          onClick={() => { setFromAccount(''); setToAccount(''); setSelectedAccountId(''); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/40 text-xs font-bold transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          حساب آخر
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900">
                      <div className="text-xs text-slate-400">رصيد افتتاحي (Opening)</div>
                      <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">{fmt(ledger.opening)} {sym}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30">
                      <div className="text-xs text-emerald-500 flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" /> مدين (Debit)</div>
                      <div className="text-lg font-black text-emerald-500 mt-0.5">{fmt(ledger.totalDebit)} {sym}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-500/30">
                      <div className="text-xs text-sky-500 flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3" /> دائن (Credit)</div>
                      <div className="text-lg font-black text-sky-500 mt-0.5">{fmt(ledger.totalCredit)} {sym}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-500/20 bg-gradient-to-br from-sky-500/5 to-transparent">
                      <div className="text-xs text-sky-500">رصيد ختامي (Closing)</div>
                      <div className="text-lg font-black text-slate-100 mt-0.5">
                        {(() => { const b = balanceLabel(ledger.closing); return <span className={b.cls}>{b.text} {sym}</span>; })()}
                      </div>
                    </div>
                  </div>

                  {!isSummary && (
                    <div className={`${enableEnhancedView ? 'rounded-2xl' : 'overflow-x-auto custom-scrollbar rounded-2xl'}`}>
                      <table className="w-full text-right text-[14px]">
                        <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-xs">
                          <tr>
                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40">التاريخ</th>
                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40">رقم المستند</th>

                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40">البيان (Narration)</th>
                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40 text-left">مدين</th>
                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40 text-left">دائن</th>
                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40 text-left">الرصيد (Balance)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {includeOpening && (
                            <tr className="bg-slate-100 dark:bg-slate-800/50">
                              <td className="py-2 px-3 text-slate-400" colSpan={3}>
                                <span className="font-bold text-slate-200">رصيد افتتاحي — Opening Balance</span>
                              </td>
                              <td className="py-2 px-3 font-mono text-emerald-400 text-left">{ledger.openingDebit > 0 ? fmt(ledger.openingDebit) : '-'}</td>
                              <td className="py-2 px-3 font-mono text-sky-400 text-left">{ledger.openingCredit > 0 ? fmt(ledger.openingCredit) : '-'}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-100 text-left">{fmt(ledger.opening)}</td>
                            </tr>
                          )}
                          {ledger.rows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                                لا توجد حركات على هذا الحساب ضمن الفترة المحددة.
                              </td>
                            </tr>
                          ) : (
                            ledger.rows.map((row, idx) => {
                              const b = balanceLabel(row.running);
                              return (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                                  <td className="py-2 px-3 text-slate-300">{dateToDisplay(row.date)}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-sky-400">{row.entryNumber}</td>

                                  <td className="py-2 px-3 text-slate-300">{row.description || row.narration}</td>
                                  <td className="py-2 px-3 font-mono text-emerald-400 text-left">{row.debit > 0 ? fmt(row.debit) : '-'}</td>
                                  <td className="py-2 px-3 font-mono text-sky-400 text-left">{row.credit > 0 ? fmt(row.credit) : '-'}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-left">
                                    <span className={b.cls}>
                                      {b.text}
                                      {b.tag && <span className={`text-[9px] mr-1 px-1 py-0.5 rounded ${b.tag === 'مدين' ? 'bg-emerald-100' : 'bg-sky-100'}`}>{b.tag}</span>}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot className="bg-slate-100 dark:bg-slate-800/50 font-bold text-[14px] text-slate-800 dark:text-slate-200 border-t border-slate-200 dark:border-slate-700/40">
                          <tr>
                            <td colSpan={3} className="py-2.5 px-3 text-left">الإجمالي (Totals):</td>
                            <td className="py-2.5 px-3 font-mono text-emerald-400 text-left">{fmt(ledger.totalDebit)} {sym}</td>
                            <td className="py-2.5 px-3 font-mono text-sky-400 text-left">{fmt(ledger.totalCredit)} {sym}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-100 text-left">
                              {(() => { const b = balanceLabel(ledger.closing); return <span className={b.cls}>{b.text} {sym}</span>; })()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-600 dark:text-slate-300">كشف الحساب — Account Statement</h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 mb-6 max-w-lg mx-auto leading-relaxed">
                    اختر حساباً من الفلاتر أعلاه، أو استخدم «مستكشف الحسابات» لاستعراض أي حساب في النظام بعمق.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => openExplorerFor('')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006fba]/10 hover:bg-[#006fba]/15 text-[#006fba] dark:text-sky-400 border border-[#006fba]/20 dark:border-sky-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      <FolderTree className="w-4 h-4" />
                      فتح مستكشف الحسابات
                    </button>
                    <button
                      onClick={() => { setIsExplorerOpen(false); setReportType('TRIAL_BALANCE'); setShowReport(true); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700/40 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      عرض ميزان المراجعة
                    </button>
                  </div>
                </div>
              )
            )}

            {['EMPLOYEES_REPORT', 'CUSTOMERS_REPORT', 'VENDORS_REPORT', 'CASHBOX_REPORT', 'BANK_REPORT', 'TRUSTS_REPORT', 'COST_CENTERS'].includes(reportType) && (
              statementSpecs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/10 mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-amber-400 dark:text-amber-500" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-600 dark:text-slate-300">لم يتم العثور على حساب مرتبط</h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 mb-5 max-w-lg mx-auto leading-relaxed">
                    {getEntityName(reportType)} لا يملك حساباً محاسبياً مرتبطاً بدليل الحسابات (شجرة الحسابات). يرجى ربطه أولاً من شاشته المخصصة. أو الرجاء تحديد كيان من القائمة.
                  </p>
                </div>
              ) : (
                <div className="screen-only overflow-x-auto custom-scrollbar py-2">
                  {renderStatements()}
                </div>
              )
            )}

            {reportType === 'PAYMENT_VOUCHERS_REPORT' && (
              <div className="max-w-[920px] mx-auto">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <h2 className="text-xl font-black text-slate-100">سندات الصرف — Payment Vouchers</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pr-5">
                    <span>الفترة: <span className="font-mono text-slate-300">{dateToDisplay(fromDate)} ← {dateToDisplay(toDate)}</span></span>
                    <span>عدد السندات: <span className="text-slate-300">{filteredPaymentVouchers.length}</span></span>
                    <span>العملة: <span className="text-slate-300">{curMeta.label}</span></span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-[13px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-xs">
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">التاريخ</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">رقم السند</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">المستفيد</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">البيان</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">طريقة الدفع</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-left">المبلغ</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredPaymentVouchers.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-400">لا توجد سندات صرف في هذه الفترة</td></tr>
                      ) : filteredPaymentVouchers.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{dateToDisplay(v.date)}</td>
                          <td className="px-4 py-2 font-mono font-bold text-rose-600 dark:text-rose-400">{v.voucherNumber}</td>
                          <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{v.payeeName}</td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{v.narration}</td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-[11px]">
                              {v.paymentMethod === 'CASH' ? 'نقداً' : v.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك'}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono font-bold text-rose-600 dark:text-rose-400 text-left tabular-nums">{fmt(v.totalAmount)} {sym}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${v.status === 'POSTED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                              : v.status === 'VOIDED' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                              }`}>
                              {v.status === 'POSTED' ? 'مرحّل' : v.status === 'VOIDED' ? 'ملغى' : 'بانتظار الترحيل'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {filteredPaymentVouchers.length > 0 && (
                      <tfoot>
                        <tr className="font-bold bg-slate-50 dark:bg-slate-800/50 border-t-2 border-double border-slate-300 dark:border-slate-700/40">
                          <td colSpan={5} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">الإجمالي</td>
                          <td className="px-4 py-2.5 font-mono text-rose-600 dark:text-rose-400 text-left tabular-nums">{fmt(filteredPaymentVouchers.reduce((s, v) => s + v.totalAmount, 0))} {sym}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-slate-400">{filteredPaymentVouchers.length} سند</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {reportType === 'RECEIPT_VOUCHERS_REPORT' && (
              <div className="max-w-[920px] mx-auto">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h2 className="text-xl font-black text-slate-100">سندات القبض — Receipt Vouchers</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pr-5">
                    <span>الفترة: <span className="font-mono text-slate-300">{dateToDisplay(fromDate)} ← {dateToDisplay(toDate)}</span></span>
                    <span>عدد السندات: <span className="text-slate-300">{filteredReceiptVouchers.length}</span></span>
                    <span>العملة: <span className="text-slate-300">{curMeta.label}</span></span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-[13px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-xs">
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">التاريخ</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">رقم السند</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">المدفوع منه</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">البيان</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">طريقة القبض</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-left">المبلغ</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredReceiptVouchers.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-400">لا توجد سندات قبض في هذه الفترة</td></tr>
                      ) : filteredReceiptVouchers.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{dateToDisplay(v.date)}</td>
                          <td className="px-4 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{v.receiptNumber}</td>
                          <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{v.payerName}</td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{v.narration}</td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-[11px]">
                              {v.receiptMethod === 'CASH' ? 'نقداً' : v.receiptMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك'}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-left tabular-nums">{fmt(v.totalAmount)} {sym}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${v.status === 'POSTED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                              : v.status === 'VOIDED' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                              }`}>
                              {v.status === 'POSTED' ? 'مرحّل' : v.status === 'VOIDED' ? 'ملغى' : 'بانتظار الترحيل'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {filteredReceiptVouchers.length > 0 && (
                      <tfoot>
                        <tr className="font-bold bg-slate-50 dark:bg-slate-800/50 border-t-2 border-double border-slate-300 dark:border-slate-700/40">
                          <td colSpan={5} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">الإجمالي</td>
                          <td className="px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400 text-left tabular-nums">{fmt(filteredReceiptVouchers.reduce((s, v) => s + v.totalAmount, 0))} {sym}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-slate-400">{filteredReceiptVouchers.length} سند</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {reportType === 'JOURNAL_ENTRIES_REPORT' && (
              <div className="max-w-[960px] mx-auto">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <h2 className="text-xl font-black text-slate-100">القيود اليومية — Journal Entries</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pr-5">
                    <span>الفترة: <span className="font-mono text-slate-300">{dateToDisplay(fromDate)} ← {dateToDisplay(toDate)}</span></span>
                    <span>عدد القيود: <span className="text-slate-300">{filteredJournalEntries.length}</span></span>
                    <span>تُعرض العملة لكل قيد داخل الجدول.</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-[13px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-xs">
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">التاريخ</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">رقم المستند</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">النوع</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40">البيان</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-center">العملة</th>

                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-left">مدين</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-left">دائن</th>
                        <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/40 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredJournalEntries.length === 0 ? (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-400">لا توجد قيود يومية في هذه الفترة</td></tr>
                      ) : filteredJournalEntries.map(j => (
                        <tr key={j.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{dateToDisplay(j.date)}</td>
                          <td className="px-4 py-2 font-mono font-bold text-sky-600 dark:text-sky-400">{j.entryNumber}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${j.type === 'PV' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                              : j.type === 'RV' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'
                              }`}>
                              {j.type === 'PV' ? 'سند صرف' : j.type === 'RV' ? 'سند قبض' : 'قيد يدوي'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400 max-w-[220px] truncate">{j.narration}</td>
                          <td className="px-4 py-2 text-center font-mono text-slate-600 dark:text-slate-300">{j.currency || baseCode}</td>

                          <td className="px-4 py-2 font-mono text-emerald-600 dark:text-emerald-400 text-left tabular-nums">{j.totalDebit > 0 ? fmt(j.totalDebit) : '—'}</td>
                          <td className="px-4 py-2 font-mono text-sky-600 dark:text-sky-400 text-left tabular-nums">{j.totalCredit > 0 ? fmt(j.totalCredit) : '—'}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${j.status === 'POSTED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                              : j.status === 'VOIDED' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                              }`}>
                              {j.status === 'POSTED' ? 'مرحّل' : j.status === 'VOIDED' ? 'ملغى' : 'بانتظار الترحيل'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {filteredJournalEntries.length > 0 && (
                      <tfoot>
                        {Object.entries(filteredJournalEntries.reduce<Record<string, { debit: number; credit: number }>>((totals, entry) => {
                          const code = entry.currency || baseCode;
                          const current = totals[code] || { debit: 0, credit: 0 };
                          current.debit += entry.totalDebit || 0;
                          current.credit += entry.totalCredit || 0;
                          totals[code] = current;
                          return totals;
                        }, {})).map(([code, totals]) => (
                          <tr key={code} className="font-bold bg-slate-50 dark:bg-slate-800/50 border-t-2 border-double border-slate-300 dark:border-slate-700/40">
                            <td colSpan={4} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">إجمالي العملة {code}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-600 dark:text-slate-300">{code}</td>
                            <td className="px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400 text-left tabular-nums">{fmt(totals.debit)}</td>
                            <td className="px-4 py-2.5 font-mono text-sky-600 dark:text-sky-400 text-left tabular-nums">{fmt(totals.credit)}</td>
                            <td className="px-4 py-2.5"></td>
                          </tr>
                        ))}
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
            {reportFooter}
          </div>
        </div>
      )}

      {!showReport && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center dark:bg-slate-50 dark:border-slate-200">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#006fba]/10 mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8 text-[#006fba]" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-800 mb-2">اختر الفلاتر واضغط «عرض التقرير»</h3>
          <p className="text-[13px] text-slate-600 mt-1 max-w-lg mx-auto leading-relaxed">
            استخدم الفلاتر لتحديد الفترة والعملة ونطاق الحسابات، ثم اضغط «عرض التقرير» — أو استخدم «مستكشف الحسابات» لاستعراض أي حساب في النظام.
          </p>
        </div>
      )}

      {isExplorerOpen && (
        <ModalShell
          id="reports-account-explorer"
          open={!!isExplorerOpen}
          onClose={() => setIsExplorerOpen(false)}
          title="مستكشف الحسابات — Account Explorer"
          subtitle="استعرض شجرة الحسابات الكاملة وافتح كشف الحساب التفصيلي لأي حساب في النظام."
          icon={FolderTree}
          size="xl"
          maxWidth="max-w-6xl"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
          topRight={
            <button
              onClick={() => {
                if (explorerAccount) {
                  openLedger(explorerAccount.id);
                  setIsExplorerOpen(false);
                }
              }}
              disabled={!explorerAccount}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#006fba] to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:from-[#0060aa] hover:to-blue-500 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Eye className="w-4 h-4" />
              عرض كشف الحساب في التقارير
            </button>
          }
        >
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[340px_1fr] overflow-hidden min-h-0">
            <aside className="border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-800/30 flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800/30">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <F9SearchInput
                    value={explorerSearch}
                    onChange={setExplorerSearch}

                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 rounded-lg pr-9 pl-9 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    items={explorerSearch.trim() ? explorerAccounts : accounts}
                    columns={[
                      { label: 'الكود', render: (a: Account) => <span className={`font-mono text-sm ${a.level === 5 ? 'text-emerald-400' : 'text-sky-400'}`}>{a.code}</span> },
                      { label: 'الاسم', render: (a: Account) => <span className="font-semibold text-slate-100 whitespace-nowrap">{a.nameAr}</span> },
                      { label: 'المستوى', render: (a: Account) => `L${a.level}`, className: 'text-center' },
                    ]}
                    searchText={a => `${a.code} ${a.nameAr} ${a.nameEn}`}
                    browseTitle="استعراض حسابات دليل الحسابات"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5 min-h-0">
                {explorerSearch.trim() ? (
                  explorerAccounts.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">لا توجد نتائج مطابقة.</div>
                  ) : (
                    explorerAccounts.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setExplorerAccountId(a.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-right border transition-colors cursor-pointer ${explorerAccountId === a.id
                          ? 'bg-sky-500/15 border-sky-500/60 text-sky-300'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-200'
                          }`}
                      >
                        <span className={`font-mono text-sm ${a.level === 5 ? 'text-emerald-400' : 'text-sky-400'} shrink-0`}>{a.code}</span>
                        <span className="text-xs truncate">{a.nameAr}</span>
                        {a.level === 5 && (
                          <span className="mr-auto text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/50 text-slate-400 font-mono shrink-0">L{a.level}</span>
                        )}
                      </button>
                    ))
                  )
                ) : (
                  accounts
                    .filter(a => !a.parentId)
                    .map(root => (
                      <Fragment key={root.id}>
                        <TreeBranch
                          acc={root}
                          accounts={accounts}
                          selectedId={explorerAccountId}
                          expanded={explorerExpanded}
                          onToggle={id =>
                            setExplorerExpanded(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                          onSelect={setExplorerAccountId}
                          depth={0}
                        />
                      </Fragment>
                    ))
                )}
              </div>
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/40 text-sm text-slate-500 dark:text-slate-400 text-center font-semibold shrink-0">
                {accounts.length} حساب في الدليل • المستويات 1-5
              </div>
            </aside>

            <section className="flex-1 overflow-y-auto custom-scrollbar p-5 min-h-0">
              {!explorerAccount ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 mb-4">
                    <Network className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-600 dark:text-slate-300">اختر حساباً من الشجرة</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 max-w-sm leading-relaxed">اختر أي حساب لعرض بياناته الكاملة وكشف الحركات والأرصدة.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xl font-black text-sky-400">{explorerAccount.code}</span>
                          <span className="text-xl font-black text-slate-100">{explorerAccount.nameAr}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{explorerAccount.nameEn}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">Level {explorerAccount.level}</span>
                          <span className={`px-2 py-0.5 rounded-full font-mono border ${explorerAccount.nature === 'DEBIT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-sky-500/15 text-sky-300 border-sky-500/30'}`}>
                            {explorerAccount.nature === 'DEBIT' ? 'مدين (Debit)' : 'دائن (Credit)'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-slate-400 border border-slate-800/30">{explorerAccount.category.replace(/_/g, ' ')}</span>
                          <span className={`px-2 py-0.5 rounded-full ${explorerAccount.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-800'} border border-slate-800/30`}>
                            {explorerAccount.isActive ? 'نشط (Active)' : 'موقوف (Inactive)'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-mono ${explorerAccount.accountType === 2 ? 'bg-sky-100 text-sky-400' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400'} border border-slate-800/30`}>
                            {explorerAccount.accountType === 2 ? 'تشغيلي (Posting)' : 'تجميعي (Group)'}
                          </span>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-xs text-slate-400">الرصيد الحالي (كل الفترات)</div>
                        <div className="text-lg font-black text-slate-100 mt-0.5">
                          {(() => { const b = balanceLabel(explorerNetAll); return <span className={b.cls}>{b.text} {sym}</span>; })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 font-mono">الإجمالي {fmt(explorerActivityAll[explorerAccount.id]?.debit || 0)} / {fmt(explorerActivityAll[explorerAccount.id]?.credit || 0)}</div>
                      </div>
                    </div>

                    {(() => {
                      const chain = ancestorChain(explorerAccount, accounts);
                      if (!chain.length) return null;
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                          <ListChecks className="w-3.5 h-3.5 text-sky-400" />
                          {chain.map((c, i) => (
                            <React.Fragment key={c.id}>
                              {i > 0 && <span className="text-slate-200">←</span>}
                              <button
                                type="button"
                                onClick={() => setExplorerAccountId(c.id)}
                                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-sky-500/20 hover:text-sky-400 text-slate-400 border border-slate-800/30 transition-colors cursor-pointer font-mono"
                              >
                                {c.code} - {c.nameAr}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {explorerLedger && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900">
                        <div className="text-xs text-slate-400">افتتاحي (Opening)</div>
                        <div className="text-lg font-black text-slate-100 mt-0.5">{fmt(explorerLedger.opening)} {sym}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40">
                        <div className="text-xs text-emerald-400 flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" /> مدين الفترة</div>
                        <div className="text-lg font-black text-emerald-400 mt-0.5">{fmt(explorerLedger.totalDebit)} {sym}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200">
                        <div className="text-xs text-sky-400 flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3" /> دائن الفترة</div>
                        <div className="text-lg font-black text-sky-400 mt-0.5">{fmt(explorerLedger.totalCredit)} {sym}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent">
                        <div className="text-xs text-sky-400">ختامي (Closing)</div>
                        <div className="text-lg font-black text-slate-100 mt-0.5">
                          {(() => { const b = balanceLabel(explorerLedger.closing); return <span className={b.cls}>{b.text} {sym}</span>; })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {explorerLedger && (
                    <div className={`${enableEnhancedView ? 'rounded-2xl' : 'overflow-x-auto custom-scrollbar rounded-2xl'}`}>
                      <table className="w-full text-right text-[14px]">
                        <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-xs">
                          <tr>
                            <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700/40">التاريخ</th>
                            <th className="py-2.5 px-3 border-b border-slate-800/30">القيد</th>

                            <th className="py-2.5 px-3 border-b border-slate-800/30">البيان</th>
                            <th className="py-2.5 px-3 border-b border-slate-800/30 text-left">مدين</th>
                            <th className="py-2.5 px-3 border-b border-slate-800/30 text-left">دائن</th>
                            <th className="py-2.5 px-3 border-b border-slate-800/30 text-left">الرصيد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {explorerLedger.rows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                                لا توجد حركات على هذا الحساب ضمن الفترة ({fromDate} → {toDate}).
                              </td>
                            </tr>
                          ) : (
                            explorerLedger.rows.map((row, idx) => {
                              const b = balanceLabel(row.running);
                              return (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                                  <td className="py-2 px-3 text-slate-300">{dateToDisplay(row.date)}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-sky-400">{row.entryNumber}</td>

                                  <td className="py-2 px-3 text-slate-300">{row.description || row.narration}</td>
                                  <td className="py-2 px-3 font-mono text-emerald-400 text-left">{row.debit > 0 ? fmt(row.debit) : '-'}</td>
                                  <td className="py-2 px-3 font-mono text-sky-400 text-left">{row.credit > 0 ? fmt(row.credit) : '-'}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-left">
                                    <span className={b.cls}>{b.text}{b.tag && <span className={`text-[9px] mr-1 px-1 py-0.5 rounded ${b.tag === 'مدين' ? 'bg-emerald-100' : 'bg-sky-100'}`}>{b.tag}</span>}</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(() => {
                    const kids = childrenOf(accounts, explorerAccount.id);
                    if (!kids.length) return null;
                    return (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 p-3">
                        <div className="text-xs font-bold text-slate-100 mb-2 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                          الحسابات الفرعية المباشرة ({kids.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {kids.map(k => (
                            <button
                              key={k.id}
                              type="button"
                              onClick={() => setExplorerAccountId(k.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-sky-500/20 hover:text-sky-400 text-slate-200 border border-slate-800/30 text-xs transition-colors cursor-pointer"
                            >
                              <span className="font-mono text-sky-400">{k.code}</span> - {k.nameAr}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>
          </div>
        </ModalShell>
      )}

      <div
        ref={printAreaRef}
        className="print-area paper"
        style={{ position: 'fixed', top: 0, left: -9999, width: LANDSCAPE_REPORTS.includes(reportType) ? 1122 : 794, background: '#ffffff', color: '#0f172a', direction: 'rtl', zIndex: -50 }}
        aria-hidden="true"
      >
        {statementSpecs.length > 0 ? (
          <div className="bg-white">
            {printableStatementSpecs.map(spec => {
              const specCode = spec.currencyCode || currency;
              const specCurrencyName = currencyOptions.find(c => c.code === specCode)?.label.split(' (')[0] || specCode;
              const totalDebit = spec.rows.reduce((s, r) => s + r.debit, 0);
              const totalCredit = spec.rows.reduce((s, r) => s + r.credit, 0);
              const closing = spec.opening + totalDebit - totalCredit;
              const closingAbs = Math.abs(closing);
              const closingTag = closing >= 0 ? 'عليكم (مدين)' : 'لكم (دائن)';
              const tafqeetText = tafqeet(closingAbs, currencyNameAr || currency, currency);
              const openingDebit = spec.opening > 0 ? spec.opening : 0;
              const openingCredit = spec.opening < 0 ? Math.abs(spec.opening) : 0;
              return (
                <FinancialReportPrintLayout
                  key={spec.key}
                  title={spec.titleAr}
                  fromDate={fromDate}
                  toDate={toDate}
                  orientation="portrait"
                  printedBy={currentUserName}
                  companyInfo={{
                    name: company.companyNameAr || '—',
                    branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—',
                    address: company.addressAr || '',
                    phone: company.phone || '',
                    logoUrl: company.logoUrl || undefined,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {[
                      { label: 'رقم الحساب', value: spec.subjectCode },
                      { label: 'اسم الحساب', value: spec.subjectName },
                      { label: 'العملة', value: `${specCurrencyName} (${specCode})` },
                      ...(spec.subjectExtra ? [{ label: 'ملاحظات', value: spec.subjectExtra }] : []),
                    ].map((info, i) => (
                      <div key={i} style={{ flex: '1 1 140px', display: 'flex', justifyContent: 'space-between', gap: '6px', border: '1px solid #000', background: '#f9f8fc', padding: '3px 8px', fontSize: '7.6px', color: '#444' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>{info.label}:</span>
                        <b style={{ color: '#000', fontWeight: 800 }}>{info.value}</b>
                      </div>
                    ))}
                  </div>

                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>التاريخ</th>
                        <th>نوع المستند</th>
                        <th>رقم المستند</th>

                        <th>البيان</th>
                        <th>مدين</th>
                        <th>دائن</th>
                        <th>الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.showOpening && (
                        <tr style={{ fontWeight: 'bold', background: '#e8e7fc' }}>
                          <td></td>
                          <td>—</td>
                          <td>رصيد افتتاحي</td>
                          <td>—</td>

                          <td>رصيد افتتاحي {spec.subjectName}</td>
                          <td className="report-num">{openingDebit > 0 ? fmt(openingDebit) : ''}</td>
                          <td className="report-num">{openingCredit > 0 ? fmt(openingCredit) : ''}</td>
                          <td className="report-num">{fmt(spec.opening)}</td>
                        </tr>
                      )}
                      {spec.rows.map((row, i) => {
                        const run = spec.opening + spec.rows.slice(0, i + 1).reduce((s, r) => s + r.debit - r.credit, 0);
                        return (
                          <tr key={i}>
                            <td style={{ textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ textAlign: 'center' }}>{dateToDisplay(row.date)}</td>
                            <td>{row.docType}</td>
                            <td style={{ textAlign: 'center' }}>{row.docNumber}</td>

                            <td>{row.description}</td>
                            <td className="report-num">{row.debit > 0 ? fmt(row.debit) : ''}</td>
                            <td className="report-num">{row.credit > 0 ? fmt(row.credit) : ''}</td>
                            <td className="report-num" style={{ fontWeight: 700 }}>{fmt(run)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#c5c7f1', fontWeight: 900 }}>
                        <td colSpan={5} style={{ textAlign: 'right', padding: '4px 8px' }}>إجمالي العمليات ({spec.rows.length} مستند)</td>
                        <td className="report-num" style={{ fontWeight: 900 }}>{fmt(totalDebit)}</td>
                        <td className="report-num" style={{ fontWeight: 900 }}>{fmt(totalCredit)}</td>
                        <td></td>
                      </tr>
                      <tr style={{ background: '#e8e7fc', fontWeight: 900 }}>
                        <td colSpan={5} style={{ textAlign: 'right', padding: '4px 8px' }}>الرصيد الختامي {closingTag}</td>
                        <td className="report-num">{closing > 0 ? fmt(closing) : ''}</td>
                        <td className="report-num">{closing < 0 ? fmt(closingAbs) : ''}</td>
                        <td className="report-num" style={{ fontWeight: 900 }}>{fmt(closing)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div style={{ marginTop: '6px', border: '2px solid #000', padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f8fc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10.4px', fontWeight: 900, color: '#000' }}>{closingTag} :</span>
                      <span style={{ fontSize: '9.6px', fontWeight: 'bold', color: '#000' }}>{tafqeetText}</span>
                    </div>
                    <div style={{ fontSize: '12.8px', fontWeight: 900, color: '#1d4ed8', direction: 'ltr', fontFamily: "'Consolas', monospace" }}>
                      {fmt(closingAbs)}
                    </div>
                  </div>
                </FinancialReportPrintLayout>
              );
            })}
          </div>
        ) : reportType === 'CASH_FLOW' || reportType === 'EQUITY_CHANGES' ? (() => {
          const statement = buildReportData();
          const reconciled = reportType === 'CASH_FLOW' ? cashFlow.isReconciled : equityChanges.isReconciled;
          return (
            <FinancialReportPrintLayout
              title={REPORT_META[reportType].ar}
              fromDate={fromDate}
              toDate={toDate}
              orientation="portrait"
              printedBy={currentUserName}
              companyInfo={{ name: company.companyNameAr || '—', branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—', address: company.addressAr || '', phone: company.phone || '' }}
            >
              <table className="report-table"><thead><tr>{statement.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>
                {statement.rows.map((row, index) => <tr key={index}><td>{row[0]}</td><td className="report-num">{typeof row[1] === 'number' ? fmtP(row[1]) : row[1]}</td></tr>)}
              </tbody></table>
              <div style={{ marginTop: 12, padding: 8, border: '2px solid #000', fontWeight: 900, textAlign: 'center', color: reconciled ? '#166534' : '#b91c1c' }}>{reconciled ? 'مطابق للأستاذ العام والميزانية' : 'يوجد فرق مطابقة يتطلب المراجعة'}</div>
              <PrintSignatures />
            </FinancialReportPrintLayout>
          );
        })() : reportType === 'BALANCE_SHEET' ? (
          <FinancialReportPrintLayout
            title="الميزانية العمومية حسب الحساب"
            fromDate={fromDate}
            toDate={toDate}
            orientation="portrait"
            printedBy={currentUserName}
            companyInfo={{
              name: company.companyNameAr || '—',
              branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—',
              address: company.addressAr || '',
              phone: company.phone || '',
              logoUrl: company.logoUrl || undefined,
            }}
          >
            <style>{`
              .bs-table { width: 96%; max-width: 96%; margin-left: auto; margin-right: auto; border-collapse: collapse; font-size: 7.2px; color: #000; }
              .bs-table th, .bs-table td { border: 1px solid #000; padding: 4px 6px; }
              .bs-table thead th { background-color: #b4a7d6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
              .bs-table thead tr:nth-child(2) th { background-color: #d9d2e9 !important; }
              .bs-table .num { text-align: center; font-family: 'Consolas','Courier New',monospace; }
              .bs-table .text-right { text-align: right; }
              .bs-table tfoot tr.bs-diff td { background-color: #fce4ec !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
              .bs-table tfoot tr.bs-total td { background-color: #c5c7f1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 900; }
            `}</style>
            <table className="bs-table">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '27%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>رقم الحساب</th>
                  <th rowSpan={2}>اسم الحساب</th>
                  <th rowSpan={2}>العملة</th>
                  <th colSpan={2}>أرصدة الفترة الحالية</th>
                  <th colSpan={2}>أرصدة تراكمية</th>
                </tr>
                <tr>
                  <th>مدين</th>
                  <th>دائن</th>
                  <th>مدين</th>
                  <th>دائن</th>
                </tr>
              </thead>
              <tbody>
                {bsByAccount.rows.map((r, i) => (
                  <tr key={r.accountId}>
                    <td className="num">{i + 1}</td>
                    <td className="num">{r.code}</td>
                    <td className="text-right">{r.name}</td>
                    <td className="num">{r.currency}</td>
                    <td className="num">{r.currentDebit > 0 ? fmt(r.currentDebit) : ''}</td>
                    <td className="num">{r.currentCredit > 0 ? fmt(r.currentCredit) : ''}</td>
                    <td className="num">{r.cumulativeDebit > 0 ? fmt(r.cumulativeDebit) : ''}</td>
                    <td className="num">{r.cumulativeCredit > 0 ? fmt(r.cumulativeCredit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(Math.abs(bsCurrentDiff) > 0.005 || Math.abs(bsCumulativeDiff) > 0.005) && (
                  <tr className="bs-diff">
                    <td colSpan={4} className="text-right">الفارق بين المدين والدائن</td>
                    <td className="num">{bsCurrentDiff > 0 ? fmt(bsCurrentDiff) : ''}</td>
                    <td className="num">{bsCurrentDiff < 0 ? fmt(-bsCurrentDiff) : ''}</td>
                    <td className="num">{bsCumulativeDiff > 0 ? fmt(bsCumulativeDiff) : ''}</td>
                    <td className="num">{bsCumulativeDiff < 0 ? fmt(-bsCumulativeDiff) : ''}</td>
                  </tr>
                )}
                <tr className="bs-total">
                  <td colSpan={2} className="num">العدد الكلي: {bsByAccount.count}</td>
                  <td className="text-right">الإجمالي الكلي بالعملة المحلية ({baseCode})</td>
                  <td className="num">{baseCode}</td>
                  <td className="num">{fmt(bsByAccount.totals.currentDebitYER)}</td>
                  <td className="num">{fmt(bsByAccount.totals.currentCreditYER)}</td>
                  <td className="num">{fmt(bsByAccount.totals.cumulativeDebitYER)}</td>
                  <td className="num">{fmt(bsByAccount.totals.cumulativeCreditYER)}</td>
                </tr>
              </tfoot>
            </table>

            <PrintTafqeet label="الفارق بين المدين والدائن" amount={bsByAccount.totals.cumulativeDebitYER - bsByAccount.totals.cumulativeCreditYER} currencyName={baseCurrencyName} currencyCode={baseCode} />
            <PrintSignatures />
          </FinancialReportPrintLayout>
        ) : reportType === 'INCOME_STATEMENT' ? (
          <FinancialReportPrintLayout
            title="قائمة الدخل"
            fromDate={fromDate}
            toDate={toDate}
            orientation="portrait"
            printedBy={currentUserName}
            companyInfo={{
              name: company.companyNameAr || '—',
              branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—',
              address: company.addressAr || '',
              phone: company.phone || '',
              logoUrl: company.logoUrl || undefined,
            }}
          >
            <style>{`
              .is-table { width: 96%; max-width: 96%; margin-left: auto; margin-right: auto; border-collapse: collapse; font-size: 7.2px; color: #000; }
              .is-table th, .is-table td { border: 1px solid #000; padding: 4px 8px; }
              .is-table thead th { background-color: #b4a7d6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
              .is-table .num { text-align: left; font-family: 'Consolas','Courier New',monospace; }
              .is-table .text-right { text-align: right; }
              .is-table tr.is-section td { background-color: #e8e7fc !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .is-table tr.is-subtotal td { background-color: #c5c7f1 !important; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .is-table tr.is-net td { background-color: #b4a7d6 !important; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            `}</style>
            <table className="is-table">
              <colgroup>
                <col />
                <col style={{ width: '24%' }} />
              </colgroup>
              <thead>
                <tr><th className="text-right">البند</th><th>المبلغ</th></tr>
              </thead>
              <tbody>
                <tr className="is-section"><td>١. الإيرادات — Revenues</td><td></td></tr>
                {filteredIncomeStmt.revenueLines.map(l => (
                  <tr key={l.key}><td className="text-right">{l.labelAr} ({l.labelEn})</td><td className="num">{fmt(l.amount)}</td></tr>
                ))}
                {filteredIncomeStmt.revenueResidual !== 0 && (
                  <tr><td className="text-right">إيرادات أخرى — Other Revenues</td><td className="num">{fmt(filteredIncomeStmt.revenueResidual)}</td></tr>
                )}
                <tr className="is-subtotal"><td className="text-right">إجمالي الإيرادات — Total Revenues</td><td className="num">{fmt(filteredIncomeStmt.totalRevenues)}</td></tr>

                <tr className="is-section"><td>٢. المصاريف التشغيلية — Operating Expenses</td><td></td></tr>
                {filteredIncomeStmt.expenseLines.map(l => (
                  <tr key={l.key}><td className="text-right">{l.labelAr} ({l.labelEn})</td><td className="num">{fmtP(-l.amount)}</td></tr>
                ))}
                {filteredIncomeStmt.operatingResidual !== 0 && (
                  <tr><td className="text-right">مصاريف تشغيلية أخرى — Other Operating Expenses</td><td className="num">{fmtP(-filteredIncomeStmt.operatingResidual)}</td></tr>
                )}
                <tr className="is-subtotal"><td className="text-right">إجمالي المصاريف التشغيلية</td><td className="num">{fmtP(-filteredIncomeStmt.totalOperatingExpenses)}</td></tr>
                <tr className="is-subtotal"><td className="text-right">مجمل الربح — Gross Profit</td><td className="num">{fmtP(filteredIncomeStmt.totalRevenues - filteredIncomeStmt.totalOperatingExpenses)}</td></tr>

                {filteredIncomeStmt.nonOperatingLines.length > 0 && (
                  <tr className="is-section"><td>٣. المصاريف غير التشغيلية — Non-Operating Expenses</td><td></td></tr>
                )}
                {filteredIncomeStmt.nonOperatingLines.map(l => (
                  <tr key={l.key}><td className="text-right">{l.labelAr} ({l.labelEn})</td><td className="num">{fmtP(-l.amount)}</td></tr>
                ))}
                {filteredIncomeStmt.totalNonOperatingExpenses !== 0 && (
                  <tr className="is-subtotal"><td className="text-right">إجمالي المصاريف غير التشغيلية</td><td className="num">{fmtP(-filteredIncomeStmt.totalNonOperatingExpenses)}</td></tr>
                )}

                <tr className="is-subtotal"><td className="text-right">الربح التشغيلي (EBIT)</td><td className="num">{fmtP(filteredIncomeStmt.operatingProfit)}</td></tr>
                <tr className="is-net"><td className="text-right">صافي الدخل النهائي — Net Income</td><td className="num">{fmtP(filteredIncomeStmt.netIncome)}</td></tr>
              </tbody>
            </table>

            <PrintTafqeet label="صافي الدخل" amount={filteredIncomeStmt.netIncome} currencyName={baseCurrencyName} currencyCode={baseCode} />
            <PrintSignatures />
          </FinancialReportPrintLayout>
        ) : reportType === 'TRIAL_BALANCE' ? (
          <FinancialReportPrintLayout
            title="ميزان المراجعة حسب الحساب"
            fromDate={fromDate}
            toDate={toDate}
            orientation="portrait"
            printedBy={currentUserName}
            companyInfo={{ name: company.companyNameAr || '—', branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—', address: company.addressAr || '', phone: company.phone || '', logoUrl: company.logoUrl || undefined }}
          >
            <style>{`
              .tb-p { width:96%; max-width:96%; margin-left:auto; margin-right:auto; border-collapse:collapse; font-size:7.2px; color:#000; }
              .tb-p th, .tb-p td { border:1px solid #000; padding:4px 6px; text-align:center; }
              .tb-p thead th { background-color:#b4a7d6 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-weight:bold; }
              .tb-p thead tr:nth-child(2) th { background-color:#d9d2e9 !important; }
              .tb-p .text-right { text-align:right; }
              .tb-p .tr-total td { background-color:#c5c7f1 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-weight:900; }
              .tb-p .num { font-family:'Consolas','Courier New',monospace; }
            `}</style>
            <table className="tb-p">
              <colgroup>
                <col style={{ width: '3%' }} /><col style={{ width: '12%' }} /><col style={{ width: '25%' }} /><col style={{ width: '5%' }} />
                <col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>#</th><th rowSpan={2}>رقم الحساب</th><th rowSpan={2}>اسم الحساب</th><th rowSpan={2}>العملة</th>
                  <th colSpan={2}>الأرصدة الافتتاحية</th><th colSpan={2}>الحركة</th><th colSpan={2}>الرصيد الحالي</th>
                </tr>
                <tr><th>مدين</th><th>دائن</th><th>مدين</th><th>دائن</th><th>مدين</th><th>دائن</th></tr>
              </thead>
              <tbody>
                {groupedTB.groups.flatMap(g => g.rows).map((row, i) => (
                  <tr key={row.accountId}>
                    <td>{i + 1}</td>
                    <td className="num">{row.code}</td>
                    <td className="text-right">{row.name}</td>
                    <td className="num">{row.currency}</td>
                    <td className="num">{row.openingDebit > 0 ? fmt(row.openingDebit) : ''}</td>
                    <td className="num">{row.openingCredit > 0 ? fmt(row.openingCredit) : ''}</td>
                    <td className="num">{row.movementDebit > 0 ? fmt(row.movementDebit) : ''}</td>
                    <td className="num">{row.movementCredit > 0 ? fmt(row.movementCredit) : ''}</td>
                    <td className="num">{row.endingDebit > 0 ? fmt(row.endingDebit) : ''}</td>
                    <td className="num">{row.endingCredit > 0 ? fmt(row.endingCredit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tr-total">
                  <td colSpan={4}>العدد الكلي: {groupedTB.rowCount}</td>
                  <td className="num">{fmt(groupedTB.totals.openingDebit)}</td>
                  <td className="num">{fmt(groupedTB.totals.openingCredit)}</td>
                  <td className="num">{fmt(groupedTB.totals.movementDebit)}</td>
                  <td className="num">{fmt(groupedTB.totals.movementCredit)}</td>
                  <td className="num">{fmt(groupedTB.totals.endingDebit)}</td>
                  <td className="num">{fmt(groupedTB.totals.endingCredit)}</td>
                </tr>
              </tfoot>
            </table>
            <PrintTafqeet label="الفرق بين المدين والدائن" amount={groupedTB.totals.endingDebit - groupedTB.totals.endingCredit} currencyName={baseCurrencyName} currencyCode={baseCode} />
            <PrintSignatures />
          </FinancialReportPrintLayout>
        ) : reportType === 'LEDGER' ? (
          (selectedAccount && ledger) ? (
            <FinancialReportPrintLayout
              title={`كشف حساب — ${selectedAccount.nameAr}`}
              fromDate={fromDate}
              toDate={toDate}
              orientation="portrait"
              printedBy={currentUserName}
              companyInfo={{ name: company.companyNameAr || '—', branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—', address: company.addressAr || '', phone: company.phone || '', logoUrl: company.logoUrl || undefined }}
            >
              <style>{`
                .lg-p { width:96%; max-width:96%; margin-left:auto; margin-right:auto; border-collapse:collapse; font-size:7.2px; color:#000; }
                .lg-p th, .lg-p td { border:1px solid #000; padding:4px 6px; }
                .lg-p thead th { background-color:#b4a7d6 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-weight:bold; }
                .lg-p .text-right { text-align:right; }
                .lg-p .num { text-align:left; font-family:'Consolas','Courier New',monospace; }
                .lg-p .tr-total td { background-color:#c5c7f1 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-weight:900; }
                .lg-info { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; }
                .lg-info > div { flex:1 1 140px; display:flex; justify-content:space-between; gap:6px; border:1px solid #000; background:#f9f8fc; padding:3px 8px; font-size:7.6px; color:#444; }
              `}</style>
              <div className="lg-info">
                {[
                  { l: 'رقم الحساب', v: selectedAccount.code },
                  { l: 'اسم الحساب', v: selectedAccount.nameAr },
                  { l: 'العملة', v: `${currencyNameAr || currency} (${sym})` },
                  { l: 'الطبيعة', v: selectedAccount.nature === 'DEBIT' ? 'مدين' : 'دائن' },
                ].map((x, i) => (
                  <div key={i}><span>{x.l}:</span><b style={{ color: '#000', fontWeight: 800 }}>{x.v}</b></div>
                ))}
              </div>
              <table className="lg-p">
                <thead>
                  <tr>
                    <th>التاريخ</th><th>رقم المستند</th><th>البيان</th>
                    <th>مدين</th><th>دائن</th><th>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {includeOpening && (
                    <tr style={{ fontWeight: 'bold', background: '#e8e7fc' }}>
                      <td>—</td><td>—</td><td>رصيد افتتاحي</td>
                      <td className="num">{ledger.openingDebit > 0 ? fmt(ledger.openingDebit) : ''}</td>
                      <td className="num">{ledger.openingCredit > 0 ? fmt(ledger.openingCredit) : ''}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmt(ledger.opening)}</td>
                    </tr>
                  )}
                  {ledger.rows.map((row, idx) => {
                    const b = balanceLabel(row.running);
                    return (
                      <tr key={idx}>
                        <td>{dateToDisplay(row.date)}</td><td>{row.entryNumber}</td>
                        <td className="text-right">{row.description || row.narration}</td>
                        <td className="num">{row.debit > 0 ? fmt(row.debit) : ''}</td>
                        <td className="num">{row.credit > 0 ? fmt(row.credit) : ''}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{b.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tr-total">
                    <td colSpan={3}>الإجمالي ({ledger.rows.length} حركة)</td>
                    <td className="num">{fmt(ledger.totalDebit)}</td>
                    <td className="num">{fmt(ledger.totalCredit)}</td>
                    <td className="num">{fmt(ledger.closing)}</td>
                  </tr>
                </tfoot>
              </table>
              <PrintTafqeet label="الرصيد الختامي" amount={ledger.closing} currencyName={baseCurrencyName} currencyCode={baseCode} />
              <PrintSignatures />
            </FinancialReportPrintLayout>
          ) : (
            <p style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '10.4px' }}>الرجاء اختيار حساب لعرض كشفه.</p>
          )
        ) : (
          <FinancialReportPrintLayout
            title={REPORT_META[reportType].ar}
            fromDate={fromDate}
            toDate={toDate}
            orientation={LANDSCAPE_REPORTS.includes(reportType) ? 'landscape' : 'portrait'}
            printedBy={currentUserName}
            companyInfo={{
              name: company.companyNameAr || '—',
              branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—',
              address: company.addressAr || '',
              phone: company.phone || '',
              logoUrl: company.logoUrl || undefined,
            }}
          >
            {(() => {
              const { columns, rows } = buildReportData();
              return (
                <table className="report-table">
                  <thead>
                    <tr>
                      {columns.map((c: string, i: number) => (
                        <th key={i}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!rows.length && <tr><td colSpan={Math.max(1, columns.length)} style={{textAlign:"center",padding:16}}>لا توجد بيانات لعرضها في هذه الفترة.</td></tr>}
                    {rows.map((r: (string | number)[], i: number) => (
                      <tr key={i}>
                        {columns.map((_: string, ci: number) => (
                          <td key={ci}>{r[ci] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </FinancialReportPrintLayout>
        )}
      </div>
    </div>
  );
}
