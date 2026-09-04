import React, { useEffect, useState, useMemo } from 'react';
import LoginView from './components/LoginView';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import HomePageView from './components/modules/HomePageView';
import OperationsView from './components/modules/OperationsView';
import InputsView from './components/modules/InputsView';
import DashboardView from './components/modules/DashboardView';
import TrustsView from './components/modules/TrustsView';
import CustodyView from './components/modules/CustodyView';
import JournalEntriesView from './components/modules/JournalEntriesView';
import PaymentVouchersView from './components/modules/PaymentVouchersView';
import ReceiptVouchersWindow from './components/modules/ReceiptVouchersWindow';
import GlobalEnterNav from './components/ui/GlobalEnterNav';
import TableCollapseController from './components/ui/TableCollapseController';
import ChartOfAccountsView from './components/modules/ChartOfAccountsView';
import OpeningBalancesView from './components/modules/OpeningBalancesView';
import CashBoxesView from './components/modules/CashBoxesView';
import BankAccountsView from './components/modules/BankAccountsView';
import EmployeesView from './components/modules/EmployeesView';
import CustomersView from './components/modules/CustomersView';
import VendorsView from './components/modules/VendorsView';
import CostCentersView from './components/modules/CostCentersView';
import CurrenciesView from './components/modules/CurrenciesView';
import FinancialReportsView from './components/modules/FinancialReportsView';
import StatementOfAccountView from './components/modules/StatementOfAccountView';
import ClosingView from './components/modules/ClosingView';
import AuditAndSecurityView from './components/modules/AuditAndSecurityView';
import SettingsView from './components/modules/SettingsView';
import AboutUs from './components/modules/AboutUs';
import ContractsView from './components/modules/ContractsView';
import { ToastProvider } from './components/ui/Toast';
import RateViolationToastBridge from './components/ui/RateViolationToastBridge';
import StorageConflictToastBridge from './components/ui/StorageConflictToastBridge';
import { ModalStackProvider } from './components/ui/ModalStack';
import WorkspaceTabBar from './components/ui/WorkspaceTabBar';
import TabKeepAliveContainer from './components/ui/TabKeepAliveContainer';
import { TabsProvider, useTabs, tabIdFor } from './tabs/TabsContext';
import { LanguageProvider, useI18n } from './i18n';
import { useTheme } from './utils/useTheme';
import { commitAccountingCommand, getPersistentItem, persistentVersion } from './utils/desktopStorage';
import { accountingCommandError, type DailyPostingBatchResult, type DailyPostingRequest } from './utils/dailyPosting';

import {
  initialAccounts,
  initialCostCenters,
  initialJournalEntries,
  initialAuditLogs,
  initialTrusts,
  initialCustodies,
  initialCashBoxes,
  initialBankAccounts,
  initialPaymentVouchers,
  initialReceiptVouchers,
  initialEmployees,
  initialCustomers,
  initialVendors,
  initialCurrencies
} from './data/initialData';

import { Account, AccountCurrency, JournalEntry, JournalLine, AuditLog, CostCenter, Trust, Custody, CashBox, BankAccount, PaymentVoucher, ReceiptVoucher, Employee, Customer, Vendor, Currency, SubLedgerType } from './types/erp';
import type { ERPContract } from './types/contracts';
import type { SavePayload } from './components/modules/opening/types';
import { applyOpeningBalances, cleanupOpeningBalanceDuplicates, reconcileControlAccountOpenings } from './services/openingBalancesService';
import { fitAmountInput, isAmountInput } from './utils/amountInputFit';
import { useLocalStorageState } from './utils/useLocalStorageState';
import { isPeriodClosed } from './utils/periodGuard';
import { reindexAccountCodes, ensureEmployeeAdvanceGroup, employeeAdvanceGeneralAccount, nextJournalNumber, calculateAccountActivity, netAccountBalance, isPostingAccount, accountFinancialType } from './utils/accountingEngine';
import { CUSTODY_TYPE_LABEL, CUSTODY_STATUS_LABEL } from './utils/custodyEngine';
import { deriveLegacySubLedgerType } from './utils/subLedger';
import { validateGeneratedJournalForPosting, validateJournalForPosting, validateOpeningBalancesForPosting, validateVoucherForPosting } from './utils/postingValidation';
import type { AttachmentRequirement } from './utils/supportingDocuments';
import { currencyDecimals, multiplyMoney, roundTo } from './utils/money';
import { accountRemovalDecision, costCenterRemovalDecision, currencyRemovalDecision, entityRemovalDecision } from './utils/masterDataGuards';
import { buildLinkedReversal, linkOriginalToReversal } from './utils/accountingLifecycle';
import { nextCloseStatus, periodRecordFor, transitionFinancialPeriod, type FinancialPeriodRecord } from './utils/periodLifecycle';
import { buildControlAccountTransfer, hasPostedEntityMovement, type ControlEntityKind } from './utils/controlAccountTransfer';
import { AUTH_USERS, AuthUser, CAN_OVERRIDE_EXCHANGE_LIMITS, ERPModule, permissionsFor, ROLES, SESSION_KEY } from './constants/permissions';
import { migrateLegacyWorkflowStatuses } from './utils/statusMigration';
import { normalizeStandardLevelFiveAccountNames } from './utils/accountNaming';

const REPORTING_YEAR_SESSION_KEY = 'fullerp-reporting-year';
const MIN_REPORTING_YEAR = 2026;

function currentReportingYear(): string {
  return String(Math.max(MIN_REPORTING_YEAR, new Date().getFullYear()));
}

function reportingYearOptions(currentYear = new Date().getFullYear()): string[] {
  const effectiveCurrentYear = Math.max(MIN_REPORTING_YEAR, currentYear);
  const years: string[] = [];
  for (let year = MIN_REPORTING_YEAR; year <= effectiveCurrentYear + 1; year += 1) years.push(String(year));
  return years.sort((a, b) => Number(b) - Number(a));
}

const K = {
  accounts: 'elite-erp-accounts-v9',
  costCenters: 'elite-erp-costcenters-v6',
  journals: 'elite-erp-journals-v6',
  auditLogs: 'elite-erp-auditlogs-v6',
  settings: 'elite-erp-settings-v6',
  trusts: 'elite-erp-trusts-v1',
  custodies: 'elite-erp-custodies-v1',
  cashBoxes: 'elite-erp-cashboxes-v1',
  bankAccounts: 'elite-erp-bankaccounts-v1',
  vouchers: 'elite-erp-vouchers-v1',
  receipts: 'elite-erp-receiptvouchers-v1',
  employees: 'elite-erp-employees-v1',
  customers: 'elite-erp-customers-v1',
  vendors: 'elite-erp-vendors-v1',
  currencies: 'elite-erp-currencies-v1',
  contracts: 'elite-erp-contracts-v1',
  closedYears: 'elite-erp-closed-years-v1',
  closedMonths: 'elite-erp-closed-months-v1',
  openingBalancesStatus: 'elite-erp-opening-balances-status-v1',
  periodStates: 'elite-erp-period-states-v1'
};

const REMOVED_MODULE_KEYS = [
  'elite-erp-customers-v6', 'elite-erp-vendors-v6', 'elite-erp-employees-v6',
  'elite-erp-invoices-v6',
  'elite-erp-accounts-v8', 'elite-erp-accounts-v7', 'elite-erp-accounts-v6'
];

function configuredAttachmentRequirements(): AttachmentRequirement[] {
  try {
    const raw = JSON.parse(getPersistentItem(K.settings) || '{}');
    const parsed = JSON.parse(raw.attachmentRequirementsJson || '[]');
    return Array.isArray(parsed) ? parsed.filter((item: any) => item && typeof item.documentType === 'string' && typeof item.label === 'string' && item.required === true) : [];
  } catch { return []; }
}

function sanitizeMasterData<T extends { id: string; code: string; nameAr: string }>(list: T[]): T[] {
  const valid = list.filter(x => x && typeof x === 'object' && x.id && x.code && x.nameAr);
  return valid.length === list.length ? list : valid;
}

function initializeCleanState() {
  if (typeof window === 'undefined') return;
  try {
    REMOVED_MODULE_KEYS.forEach(key => window.localStorage.removeItem(key));
    const bootFlagKey = 'elite-erp-clean-boot-v5';
    if (window.localStorage.getItem(bootFlagKey) === '1') return;

    // ملاحظة أمان: يُمنع منعاً باتاً حذف مفاتيح الإصدار الحالي (K) هنا.
    // يُنظَّف فقط مفاتيح الإصدارات القديمة (v2–v5) — فقدان الـ flag لا يعني فقدان البيانات.
    const legacyKeys = [
      'elite-erp-accounts-v5', 'elite-erp-costcenters-v5', 'elite-erp-journals-v5',
      'elite-erp-customers-v5', 'elite-erp-vendors-v5', 'elite-erp-employees-v5',
      'elite-erp-auditlogs-v5', 'elite-erp-invoices-v5', 'elite-erp-settings-v5',
      'elite-erp-accounts-v4', 'elite-erp-costcenters-v4', 'elite-erp-journals-v4',
      'elite-erp-customers-v4', 'elite-erp-vendors-v4', 'elite-erp-employees-v4',
      'elite-erp-auditlogs-v4', 'elite-erp-invoices-v4', 'elite-erp-settings-v4',
      'elite-erp-accounts-v3', 'elite-erp-costcenters-v3', 'elite-erp-journals-v3',
      'elite-erp-customers-v3', 'elite-erp-vendors-v3', 'elite-erp-employees-v3',
      'elite-erp-auditlogs-v3', 'elite-erp-invoices-v3', 'elite-erp-settings-v3',
      'elite-erp-accounts-v2', 'elite-erp-costcenters-v2', 'elite-erp-journals-v2',
      'elite-erp-customers-v2', 'elite-erp-vendors-v2', 'elite-erp-employees-v2',
      'elite-erp-auditlogs-v2', 'elite-erp-invoices-v2', 'elite-erp-settings-v2'
    ];
    legacyKeys.forEach(key => window.localStorage.removeItem(key));
    window.localStorage.removeItem('theme');
    window.localStorage.setItem(bootFlagKey, '1');
  } catch {
  }
}

function loadSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.desktopStore) {
      const desktop = window.desktopStore.session('');
      if (desktop.ok && desktop.user && ROLES[desktop.user.roleId as keyof typeof ROLES]) {
        const user: AuthUser = { username: desktop.user.username, name: desktop.user.name, roleId: desktop.user.roleId as AuthUser['roleId'], permissions: permissionsFor(desktop.user.roleId as AuthUser['roleId']), mustChangePassword: desktop.user.mustChangePassword, expiresAt: desktop.user.expiresAt };
        return user;
      }
    }
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && parsed.username && parsed.roleId && ROLES[parsed.roleId]) {
      if (!parsed.permissions) {
        parsed.permissions = permissionsFor(parsed.roleId);
      }
      return parsed;
    }
  } catch {
  }
  return null;
}

function AppInner() {
  const [isBooted, setIsBooted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { dir, t } = useI18n();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => loadSession());
  const [reportingYear, setReportingYear] = useState<string>(currentReportingYear);
  const { activeModule, openModule, resetTabs, requestCloseTab } = useTabs();

  const [accounts, setAccounts] = useLocalStorageState<Account[]>(K.accounts, initialAccounts);
  const [costCenters, setCostCenters] = useLocalStorageState<CostCenter[]>(K.costCenters, initialCostCenters);
  const [journals, setJournals] = useLocalStorageState<JournalEntry[]>(K.journals, initialJournalEntries);
  const [auditLogs, setAuditLogs] = useLocalStorageState<AuditLog[]>(K.auditLogs, initialAuditLogs);
  const [trusts, setTrusts] = useLocalStorageState<Trust[]>(K.trusts, initialTrusts);
  const [custodies, setCustodies] = useLocalStorageState<Custody[]>(K.custodies, initialCustodies);
  const [cashBoxes, setCashBoxes] = useLocalStorageState<CashBox[]>(K.cashBoxes, initialCashBoxes);
  const [bankAccounts, setBankAccounts] = useLocalStorageState<BankAccount[]>(K.bankAccounts, initialBankAccounts);
  const [vouchers, setVouchers] = useLocalStorageState<PaymentVoucher[]>(K.vouchers, initialPaymentVouchers);
  const [receiptVouchers, setReceiptVouchers] = useLocalStorageState<ReceiptVoucher[]>(K.receipts, initialReceiptVouchers);
  const [employees, setEmployees] = useLocalStorageState<Employee[]>(K.employees, initialEmployees);
  const [customers, setCustomers] = useLocalStorageState<Customer[]>(K.customers, initialCustomers);
  const [vendors, setVendors] = useLocalStorageState<Vendor[]>(K.vendors, initialVendors);
  const [currencies, setCurrencies] = useLocalStorageState<Currency[]>(K.currencies, initialCurrencies);
  const [contracts, setContracts] = useLocalStorageState<ERPContract[]>(K.contracts, []);
  const [closedYears, setClosedYears] = useLocalStorageState<string[]>(K.closedYears, []);
  const [closedMonths, setClosedMonths] = useLocalStorageState<string[]>(K.closedMonths, []);
  const [periodStates, setPeriodStates] = useLocalStorageState<FinancialPeriodRecord[]>(K.periodStates, []);
  const availableReportingYears = useMemo(reportingYearOptions, []);

  useEffect(() => {
    setPeriodStates(previous => {
      const next = [...previous];
      let changed = false;
      const migrate = (key: string, scope: 'YEAR' | 'MONTH') => {
        if (next.some(item => item.key === key && item.scope === scope)) return;
        next.push({ key, scope, status: 'FINAL_CLOSED', version: 1, history: [{ id: `period-${key}-migration`, from: 'OPEN', to: 'FINAL_CLOSED', actor: 'SYSTEM', at: new Date().toISOString(), reason: 'ترحيل حالة الإقفال القديمة' }] });
        changed = true;
      };
      closedYears.forEach(key => migrate(key, 'YEAR'));
      closedMonths.forEach(key => migrate(key, 'MONTH'));
      return changed ? next : previous;
    });
  }, [closedYears, closedMonths, setPeriodStates]);
  const [openingBalancesStatus, setOpeningBalancesStatus] = useLocalStorageState<'NONE' | 'DRAFT' | 'POSTED'>(K.openingBalancesStatus, 'NONE');

  const [statementNavParams, setStatementNavParams] = useState<{ kind: string; id: string } | null>(null);

  useEffect(() => {
    const fit = (element: Element | null) => {
      if (element instanceof HTMLInputElement && isAmountInput(element)) fitAmountInput(element);
    };
    const onInput = (event: Event) => fit(event.target as Element);
    const onFocus = (event: FocusEvent) => fit(event.target as Element);
    const onResize = () => document.querySelectorAll<HTMLInputElement>('input[data-amount-input="true"], input[type="number"], input[inputmode="decimal"]').forEach(fitAmountInput);
    document.addEventListener('input', onInput, true);
    document.addEventListener('focusin', onFocus, true);
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('focusin', onFocus, true);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    initializeCleanState();
    const timer = window.setTimeout(() => setIsBooted(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const migrated = migrateLegacyWorkflowStatuses({ journals, payments: vouchers, receipts: receiptVouchers, custodies, contracts });
    if (migrated.journals !== journals) setJournals(migrated.journals);
    if (migrated.payments !== vouchers) setVouchers(migrated.payments);
    if (migrated.receipts !== receiptVouchers) setReceiptVouchers(migrated.receipts);
    if (migrated.custodies !== custodies) setCustodies(migrated.custodies);
    if (migrated.contracts !== contracts) setContracts(migrated.contracts);
    // Run once: persisted SQLite/local compatibility conversion is idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // إصلاح بيانات قديمة: مزامنة أرصدة حسابات التحكم من أرصدة الحسابات التحليلية المرتبطة بها.
    const reconciled = reconcileControlAccountOpenings({ accounts, cashBoxes, bankAccounts, customers, vendors, employees });
    if (reconciled.changed) setAccounts(reconciled.accounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cleaned = cleanupOpeningBalanceDuplicates({ accounts, cashBoxes, bankAccounts, customers, vendors, employees });
    if (
      cleaned.accounts.length !== accounts.length ||
      cleaned.cashBoxes.length !== cashBoxes.length ||
      cleaned.bankAccounts.length !== bankAccounts.length ||
      cleaned.customers.length !== customers.length ||
      cleaned.vendors.length !== vendors.length ||
      cleaned.employees.length !== employees.length
    ) {
      setAccounts(cleaned.accounts);
      setCashBoxes(cleaned.cashBoxes);
      setBankAccounts(cleaned.bankAccounts);
      setCustomers(cleaned.customers);
      setVendors(cleaned.vendors);
      setEmployees(cleaned.employees);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAccounts(prev => {
      const ds = { accounts: prev, employees, customers, vendors, cashBoxes, banks: bankAccounts, costCenters };
      const migrated = prev.map(a =>
        a.subLedgerType && a.subLedgerType !== 'NONE'
          ? a
          : { ...a, subLedgerType: deriveLegacySubLedgerType(a.id, ds) }
      );
      return migrated.some((a, i) => a.subLedgerType !== prev[i].subLedgerType) ? migrated : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAccounts(prev => {
      const subLedgerMigrated = prev.map(a =>
        (a.code === '1101020002' || a.nameAr.includes('صراف'))
          ? { ...a, subLedgerType: 'EXCHANGER' as SubLedgerType }
          : a
      );
      const migrated = normalizeStandardLevelFiveAccountNames(subLedgerMigrated);
      return migrated.some((a, i) => a.subLedgerType !== prev[i].subLedgerType || a.nameAr !== prev[i].nameAr || a.nameEn !== prev[i].nameEn) ? migrated : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const repaired = reindexAccountCodes(accounts, journals);
    if (repaired.accounts !== accounts) setAccounts(repaired.accounts);
    if (repaired.journals !== journals) setJournals(repaired.journals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEmployees(prev => sanitizeMasterData(prev));
    setCustomers(prev => sanitizeMasterData(prev));
    setVendors(prev => sanitizeMasterData(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ensureCurrencies = <T extends { currencies?: AccountCurrency[]; defaultCurrency?: string }>(list: T[]): T[] =>
      list.map(x => (x.currencies && x.currencies.length > 0)
        ? x
        : { ...x, currencies: [{ id: `cur-def-${x.defaultCurrency || 'YER'}`, code: x.defaultCurrency || 'YER', isDefault: true, isActive: true }] });
    setCustomers(prev => ensureCurrencies(prev));
    setVendors(prev => ensureCurrencies(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const SEED_MAIN_ENTITY_IDS = ['box-main', 'box-reception', 'bnk-ahli', 'bnk-rajhi'];
    setCashBoxes(prev =>
      prev
        .filter(b => !SEED_MAIN_ENTITY_IDS.includes(b.id))
        .map(b => b.currencies?.length
          ? b
          : { ...b, currencies: [{ id: `cur-def-${b.defaultCurrency || 'YER'}`, code: b.defaultCurrency || 'YER', isDefault: true, isActive: true }] })
    );
    setBankAccounts(prev =>
      prev
        .filter(b => !SEED_MAIN_ENTITY_IDS.includes(b.id))
        .map(b => b.currencies?.length
          ? b
          : { ...b, currencies: [{ id: `cur-def-${b.defaultCurrency || 'YER'}`, code: b.defaultCurrency || 'YER', isDefault: true, isActive: true }] })
    );
    setEmployees(prev =>
      prev.map(e => (e.currencies && e.currencies.length > 0)
        ? e
        : { ...e, currencies: [{ id: `cur-def-${e.defaultCurrency || 'YER'}`, code: e.defaultCurrency || 'YER', isDefault: true, isActive: true }], defaultCurrency: e.defaultCurrency || 'YER' })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const MIG_KEY = 'elite-erp-simple-numbering-v2';
    if (window.localStorage.getItem(MIG_KEY) === '1') return;

    const simplify = (value?: string): string => {
      if (!value) return '';
      const m = value.trim().match(/^([A-Z]{2})-(\d{4})-(\d+)$/);
      if (!m) return value;
      return `${m[1]}-${parseInt(m[3], 10)}`;
    };

    const replaced: Record<string, string> = {};

    const migrateVouchers = vouchers.map(v => {
      const next = simplify(v.voucherNumber);
      if (next !== v.voucherNumber) replaced[v.voucherNumber] = next;
      return next === v.voucherNumber ? v : { ...v, voucherNumber: next };
    });
    const migrateReceipts = receiptVouchers.map(r => {
      const next = simplify(r.receiptNumber);
      if (next !== r.receiptNumber) replaced[r.receiptNumber] = next;
      return next === r.receiptNumber ? r : { ...r, receiptNumber: next };
    });
    const migrateTrusts = trusts.map(t => {
      const next = simplify(t.trustNumber);
      if (next !== t.trustNumber) replaced[t.trustNumber] = next;
      return next === t.trustNumber ? t : { ...t, trustNumber: next };
    });

    const rewrite = (text: string): string => {
      let out = text;
      for (const [oldNo, newNo] of Object.entries(replaced)) {
        if (out.includes(oldNo)) out = out.split(oldNo).join(newNo);
      }
      return out;
    };

    const migrateJournals = journals.map(j => {
      let updated = j;
      const refSimple = simplify(j.reference);
      const refNext = refSimple !== j.reference ? refSimple : rewrite(j.reference);
      if (refNext !== j.reference) updated = { ...updated, reference: refNext };
      const narrationNext = rewrite(j.narration);
      if (narrationNext !== j.narration) updated = { ...updated, narration: narrationNext };
      const entryNext = simplify(j.entryNumber);
      if (entryNext !== j.entryNumber) updated = { ...updated, entryNumber: entryNext };
      return updated;
    });

    if (migrateVouchers !== vouchers) setVouchers(migrateVouchers);
    if (migrateReceipts !== receiptVouchers) setReceiptVouchers(migrateReceipts);
    if (migrateTrusts !== trusts) setTrusts(migrateTrusts);
    if (migrateJournals !== journals) setJournals(migrateJournals);
    window.localStorage.setItem(MIG_KEY, '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const MIG_KEY = 'noon-erp-remove-shipped-party-records-v1';
    if (window.localStorage.getItem(MIG_KEY) === '1') return;

    // Remove only the exact demonstration rows shipped by older releases.
    // Matching the complete identity signature prevents deletion of user-created
    // or user-edited master data that happens to reuse a similar sequence code.
    const shippedEmployees = new Set([
      'emp-001|EMP-001|عبدالله محمد الأحمدي|2020-01-15',
      'emp-002|EMP-002|سارة خالد العتيبي|2021-03-01',
      'emp-003|EMP-003|ياسر عبدالله الشهري|2022-06-20'
    ]);
    const shippedCustomers = new Set([
      'cus-001|CUST-001|شركة النخبة للتجارة|2023-01-10',
      'cus-002|CUST-002|مؤسسة الأفق للمقاولات|2023-03-22',
      'cus-003|CUST-003|فهد سعد القحطاني|2024-05-11'
    ]);
    const shippedVendors = new Set([
      'sup-001|SUP-001|مصنع الرائدة للمواد الغذائية|2023-02-01',
      'sup-002|SUP-002|شركة الخليج للتقنية|2023-04-18',
      'sup-003|SUP-003|مؤسسة التميز للقرطاسية|2024-01-08'
    ]);
    const signature = (entity: { id: string; code: string; nameAr: string; createdAt: string }) =>
      `${entity.id}|${entity.code}|${entity.nameAr}|${entity.createdAt}`;

    setEmployees(prev => prev.filter(entity => !shippedEmployees.has(signature(entity))));
    setCustomers(prev => prev.filter(entity => !shippedCustomers.has(signature(entity))));
    setVendors(prev => prev.filter(entity => !shippedVendors.has(signature(entity))));
    window.localStorage.setItem(MIG_KEY, '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrencies(prev => prev.map(c => {
      const { notes: _legacyNotes, ...currency } = c as Currency & { notes?: string };
      return {
        ...currency,
        minExchangeRate: typeof c.minExchangeRate === 'number' ? c.minExchangeRate : (c.isBase ? 1 : Number((c.exchangeRate * 0.98).toFixed(4))),
        maxExchangeRate: typeof c.maxExchangeRate === 'number' ? c.maxExchangeRate : (c.isBase ? 1 : Number((c.exchangeRate * 1.02).toFixed(4)))
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const MIG_KEY = 'elite-erp-remove-unused-currencies-v3';
    if (window.localStorage.getItem(MIG_KEY) === '1') return;

    const baseCode = currencies.find(c => c.isBase)?.code ?? 'YER';
    const removedCodes = new Set(['AED', 'EUR', 'GBP']);

    const stripRemovedCurrencies = <T extends { currencies?: AccountCurrency[]; defaultCurrency?: string }>(list: T[]): T[] => {
      let changed = false;
      const next = list.map(x => {
        if (!x.currencies || (!x.currencies.some(c => removedCodes.has(c.code)) && !removedCodes.has(x.defaultCurrency ?? ''))) return x;
        changed = true;
        const kept = x.currencies.filter(c => !removedCodes.has(c.code));
        if (!removedCodes.has(x.defaultCurrency ?? '') && kept.length > 0) return { ...x, currencies: kept };
        const withBase = kept.some(c => c.code === baseCode)
          ? kept.map(c => (c.code === baseCode ? { ...c, isDefault: true } : c))
          : [{ id: `cur-mig-${baseCode}`, code: baseCode, isDefault: true, isActive: true }, ...kept];
        return { ...x, currencies: withBase, defaultCurrency: baseCode };
      });
      return changed ? next : list;
    };

    const accountsNext = stripRemovedCurrencies(accounts);
    const banksNext = stripRemovedCurrencies(bankAccounts);
    const boxesNext = stripRemovedCurrencies(cashBoxes);
    const employeesNext = stripRemovedCurrencies(employees);
    const customersNext = stripRemovedCurrencies(customers);
    const vendorsNext = stripRemovedCurrencies(vendors);
    const currenciesNext = currencies.filter(c => !removedCodes.has(c.code));

    if (accountsNext !== accounts) setAccounts(accountsNext);
    if (banksNext !== bankAccounts) setBankAccounts(banksNext);
    if (boxesNext !== cashBoxes) setCashBoxes(boxesNext);
    if (employeesNext !== employees) setEmployees(employeesNext);
    if (customersNext !== customers) setCustomers(customersNext);
    if (vendorsNext !== vendors) setVendors(vendorsNext);
    if (currenciesNext.length !== currencies.length) setCurrencies(currenciesNext);

    window.localStorage.setItem(MIG_KEY, '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const MIG_KEY = 'elite-erp-purge-orphan-currencies-v1';
    if (window.localStorage.getItem(MIG_KEY) === '1') return;

    const directoryCodes = new Set(currencies.map(c => c.code));
    const baseCode = currencies.find(c => c.isBase)?.code ?? 'YER';

    const purge = <T extends { currencies?: AccountCurrency[]; defaultCurrency?: string }>(list: T[]): T[] => {
      let changed = false;
      const next = list.map(x => {
        const kept = (x.currencies ?? []).filter(c => directoryCodes.has(c.code));
        const needsDefaultFix = x.defaultCurrency && !directoryCodes.has(x.defaultCurrency);
        if (kept.length === (x.currencies ?? []).length && !needsDefaultFix) return x;
        changed = true;
        const defaultCurrency = needsDefaultFix ? baseCode : x.defaultCurrency;
        const withDefault = kept.some(c => c.code === baseCode)
          ? kept.map(c => (c.code === baseCode ? { ...c, isDefault: true } : c))
          : [{ id: `cur-mig-${baseCode}`, code: baseCode, isDefault: true, isActive: true }, ...kept];
        return { ...x, currencies: withDefault, defaultCurrency };
      });
      return changed ? next : list;
    };

    const accountsNext = purge(accounts);
    const banksNext = purge(bankAccounts);
    const boxesNext = purge(cashBoxes);
    const employeesNext = purge(employees);
    const customersNext = purge(customers);
    const vendorsNext = purge(vendors);

    if (accountsNext !== accounts) setAccounts(accountsNext);
    if (banksNext !== bankAccounts) setBankAccounts(banksNext);
    if (boxesNext !== cashBoxes) setCashBoxes(boxesNext);
    if (employeesNext !== employees) setEmployees(employeesNext);
    if (customersNext !== customers) setCustomers(customersNext);
    if (vendorsNext !== vendors) setVendors(vendorsNext);

    window.localStorage.setItem(MIG_KEY, '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAccounts(prev => {
      const reindexed = reindexAccountCodes(prev, journals).accounts;
      const { accounts: ensured, group } = ensureEmployeeAdvanceGroup(reindexed);
      let accs = ensured;

      if (!accs.some(a => a.parentId === group.id)) {
        const defaultAccount = employeeAdvanceGeneralAccount();
        if (!accs.some(a => a.id === defaultAccount.id)) {
          accs = [...accs, defaultAccount];
        }
      }
      return accs;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allowedModules = useMemo(() => (currentUser ? ROLES[currentUser.roleId].modules : []), [currentUser]);

  useEffect(() => {
    if (currentUser && !allowedModules.includes(activeModule)) {
      resetTabs();
    }
  }, [currentUser, activeModule, allowedModules, resetTabs]);

  const currentUserName = currentUser ? currentUser.name : 'مستخدم';
  const canOverrideExchangeLimits = !!currentUser && (currentUser.permissions || []).includes(CAN_OVERRIDE_EXCHANGE_LIMITS);

  const handleLogin = (username: string, password: string, fiscalYear: string): boolean => {
    if (!username || !password || !availableReportingYears.includes(fiscalYear)) return false;
    if (window.desktopStore) {
      const result = window.desktopStore.login(username, password);
      if (!result.ok || !result.user) return false;
      const user: AuthUser = { username: result.user.username, name: result.user.name, roleId: result.user.roleId as AuthUser['roleId'], permissions: permissionsFor(result.user.roleId as AuthUser['roleId']), mustChangePassword: result.user.mustChangePassword, expiresAt: result.user.expiresAt };
      setReportingYear(fiscalYear);
      window.sessionStorage.setItem(REPORTING_YEAR_SESSION_KEY, fiscalYear);
      setCurrentUser(user);
      addAuditLog('SETTINGS', 'LOGIN', `تسجيل دخول ناجح للمستخدم: ${result.user.name} (${username}) — عام التقارير ${fiscalYear}`, result.user.name);
      resetTabs();
      return true;
    }
    const account = AUTH_USERS[username];
    if (account && account.password === password) {
      const user: AuthUser = { username, name: account.name, roleId: account.roleId, permissions: permissionsFor(account.roleId) };
      setReportingYear(fiscalYear);
      window.sessionStorage.setItem(REPORTING_YEAR_SESSION_KEY, fiscalYear);
      setCurrentUser(user);
      try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } catch {}
      addAuditLog('SETTINGS', 'LOGIN', `تسجيل دخول ناجح للمستخدم: ${account.name} (${username})`, account.name);
      resetTabs();
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    addAuditLog('SETTINGS', 'LOGOUT', `تسجيل خروج المستخدم: ${currentUserName}`);
    setCurrentUser(null);
    setReportingYear(currentReportingYear());
    if (window.desktopStore) window.desktopStore.logout('');
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(REPORTING_YEAR_SESSION_KEY);
    } catch {}
    resetTabs();
  };

  const navigate = (module: ERPModule) => {
    if (!currentUser || allowedModules.includes(module)) {
      openModule(module);
    }
  };

  const auditRateOverride = (module: AuditLog['module'], details: string) => {
    addAuditLog(module, 'CREATE', details);
  };

  const createAuditLog = (module: AuditLog['module'], action: AuditLog['action'], details: string, actorName?: string, before?: unknown, after?: unknown): AuditLog => ({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: currentUser ? currentUser.username : (actorName || 'guest'),
      userName: currentUser ? currentUserName : (actorName || 'مستخدم'),
      userRole: currentUser ? ROLES[currentUser.roleId].label : 'ضيف',
      module,
      action,
      details,
      ipAddress: typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'غير محدد',
      beforeJson: before === undefined ? undefined : JSON.stringify(before),
      afterJson: after === undefined ? undefined : JSON.stringify(after)
  });

  const addAuditLog = (module: AuditLog['module'], action: AuditLog['action'], details: string, actorName?: string) => {
    try {
      const securitySettings = JSON.parse(getPersistentItem(K.settings) || '{}');
      if (securitySettings.activityLogging === false) return;
    } catch {}
    const newLog = createAuditLog(module, action, details, actorName);
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleContractsChange = (nextContracts: ERPContract[], details: string) => {
    setContracts(nextContracts);
    addAuditLog('GENERAL_LEDGER', 'UPDATE', `العقود والالتزامات: ${details}`);
  };

  const commitAccountingState = (
    identity: { idempotencyKey: string; commandType: string; documentType: string; documentNumber: string },
    stateChanges: Array<{ key: string; value: unknown }>,
    audit: AuditLog
  ): boolean => {
    if (typeof window === 'undefined' || !window.desktopStore) return true;
    const changes = [...stateChanges, { key: K.auditLogs, value: [audit, ...auditLogs] }].map(change => ({ key: change.key, value: JSON.stringify(change.value) }));
    const expectedVersions = Object.fromEntries(changes.map(change => [change.key, persistentVersion(change.key)]));
    return commitAccountingCommand({ ...identity, changes, expectedVersions }).ok;
  };

  const handleAddAccount = (newAcc: Omit<Account, 'id'>) => {
    const created: Account = { ...newAcc, id: `acc-${Date.now()}` };
    setAccounts(prev => [...prev, created]);
    addAuditLog('GENERAL_LEDGER', 'CREATE', `إضافة حساب جديد بالدليل: ${created.code} - ${created.nameAr}`);
  };

  const handleUpdateAccount = (id: string, updated: Partial<Account>) => {
    const before = accounts.find(a => a.id === id);
    const after = before ? { ...before, ...updated } : undefined;
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
    const audit = before ? createAuditLog('GENERAL_LEDGER', 'UPDATE', `تعديل الحساب المحاسبي رقم ${id}`, undefined, before, after) : createAuditLog('GENERAL_LEDGER', 'UPDATE', `تعديل الحساب المحاسبي رقم ${id}`);
    setAuditLogs(prev => [audit, ...prev]);
  };

  const handleDeleteAccount = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    const decision = accountRemovalDecision(id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    if (decision.action === 'ARCHIVE') {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, isActive: false } : a));
      addAuditLog('GENERAL_LEDGER', 'UPDATE', `أرشفة الحساب ${acc.code} بدلاً من حذفه: ${decision.reasons.join('، ')}`);
      return;
    }
    setAccounts(prev => prev.filter(a => a.id !== id));
    addAuditLog('GENERAL_LEDGER', 'DELETE', `حذف الحساب غير المستخدم: ${acc.code} - ${acc.nameAr}`);
  };

  const handleSaveDraftOpeningBalances = (payload: SavePayload) => {
    const next = applyOpeningBalances(payload, { accounts, cashBoxes, bankAccounts, customers, vendors, employees });
    setAccounts(next.accounts);
    setCashBoxes(next.cashBoxes);
    setBankAccounts(next.bankAccounts);
    setCustomers(next.customers);
    setVendors(next.vendors);
    setEmployees(next.employees);
    setOpeningBalancesStatus('DRAFT');
    addAuditLog(
      'OPENING_BALANCES',
      'UPDATE',
      `حفظ مسودة الأرصدة الافتتاحية لـ ${payload.accounts.length} حساب و ${payload.subLedgers.length} كيان تحليلي`
    );
  };

  const handlePostOpeningBalances = (payload: SavePayload) => {
    if (openingBalancesStatus === 'POSTED') {
      addAuditLog('OPENING_BALANCES', 'POST', 'رُفض تكرار ترحيل الأرصدة الافتتاحية');
      return false;
    }
    const validation = validateOpeningBalancesForPosting(
      payload,
      accounts,
      { cashBoxes, bankAccounts, customers, vendors, employees },
      currencies, configuredAttachmentRequirements()
    );
    if (!validation.valid) {
      addAuditLog('OPENING_BALANCES', 'POST', `رُفض ترحيل الأرصدة الافتتاحية: ${validation.errors.join(' | ')}`);
      return false;
    }
    const next = applyOpeningBalances(payload, { accounts, cashBoxes, bankAccounts, customers, vendors, employees });
    const details = `ترحيل الأرصدة الافتتاحية لـ ${payload.accounts.length} حساب و ${payload.subLedgers.length} كيان تحليلي`;
    const audit = createAuditLog('OPENING_BALANCES', 'POST', details);
    const openingChanges = [
      { key: K.accounts, value: next.accounts }, { key: K.cashBoxes, value: next.cashBoxes }, { key: K.bankAccounts, value: next.bankAccounts },
      { key: K.customers, value: next.customers }, { key: K.vendors, value: next.vendors }, { key: K.employees, value: next.employees },
      { key: K.openingBalancesStatus, value: 'POSTED' },
    ];
    if (!commitAccountingState({ idempotencyKey: 'POST:OPENING_BALANCES:INITIAL', commandType: 'POST', documentType: 'OPENING_BALANCES', documentNumber: 'INITIAL' }, openingChanges, audit)) return false;
    setAccounts(next.accounts);
    setCashBoxes(next.cashBoxes);
    setBankAccounts(next.bankAccounts);
    setCustomers(next.customers);
    setVendors(next.vendors);
    setEmployees(next.employees);
    setOpeningBalancesStatus('POSTED');
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleAddJournal = (newEntry: JournalEntry) => {
    const validation = newEntry.status === 'PENDING_POSTING'
      ? validateJournalForPosting(newEntry, accounts, journals, currencies)
      : validateGeneratedJournalForPosting(newEntry, accounts, journals, currencies);
    if (!validation.valid) {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض القيد الآلي ${newEntry.entryNumber}: ${validation.errors.join(' | ')}`);
      return false;
    }
    const nextJournals = [newEntry, ...journals];
    const action = newEntry.status === 'POSTED' ? 'POST' as const : 'CREATE' as const;
    const details = `${newEntry.status === 'POSTED' ? 'إنشاء وترحيل' : 'حفظ قيد بانتظار الترحيل'} رقم ${newEntry.entryNumber}`;
    const audit = createAuditLog('GENERAL_LEDGER', action, details);
    if (!commitAccountingState({ idempotencyKey: `${action}:JOURNAL:${newEntry.id}`, commandType: action, documentType: 'JOURNAL', documentNumber: newEntry.entryNumber }, [{ key: K.journals, value: nextJournals }], audit)) return false;
    setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleCloseYear = (year: string, closingEntry: JournalEntry | null) => {
    const pendingDocuments = [
      ...journals.filter(item => item.status === 'PENDING_POSTING' && item.date.startsWith(`${year}-`)).map(item => `قيد ${item.entryNumber}`),
      ...vouchers.filter(item => item.status === 'PENDING_POSTING' && item.date.startsWith(`${year}-`)).map(item => `سند صرف ${item.voucherNumber}`),
      ...receiptVouchers.filter(item => item.status === 'PENDING_POSTING' && item.date.startsWith(`${year}-`)).map(item => `سند قبض ${item.receiptNumber}`)
    ];
    if (pendingDocuments.length > 0) {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض إقفال السنة ${year}: توجد مستندات غير مرحّلة — ${pendingDocuments.join('، ')}`);
      return false;
    }
    const current = periodRecordFor(periodStates, year, 'YEAR');
    const target = nextCloseStatus(current.status);
    if (!target) return false;
    const finalEntry = target === 'FINAL_CLOSED' ? closingEntry : null;
    const existingClosing = journals.some(j => j.reference === `CLOSE-${year}` && j.status === 'POSTED');
    if (finalEntry && !existingClosing) {
      const validation = validateGeneratedJournalForPosting(finalEntry, accounts, journals, currencies);
      if (!validation.valid) {
        addAuditLog('GENERAL_LEDGER', 'POST', `رُفض إقفال السنة ${year}: ${validation.errors.join(' | ')}`);
        return false;
      }
    }
    const transition = transitionFinancialPeriod(current, { target, actor: currentUserName, reason: `نقل السنة ${year} إلى ${target}`, closingEntryId: finalEntry?.id ?? current.closingEntryId });
    if (!transition.valid) return false;
    const nextPeriods = [...periodStates.filter(item => !(item.key === year && item.scope === 'YEAR')), transition.record];
    const nextClosedYears = closedYears.includes(year) ? closedYears : [...closedYears, year];
    const nextJournals = finalEntry && !existingClosing ? [finalEntry, ...journals] : journals;
    const audit = createAuditLog('GENERAL_LEDGER', 'POST', `تغيير حالة السنة ${year}: ${current.status} ← ${target}`);
    const changes: Array<{ key: string; value: unknown }> = [{ key: K.periodStates, value: nextPeriods }, { key: K.closedYears, value: nextClosedYears }];
    if (nextJournals !== journals) changes.push({ key: K.journals, value: nextJournals });
    if (!commitAccountingState({ idempotencyKey: `PERIOD:YEAR:${year}:${target}:${transition.record.version}`, commandType: `PERIOD_${target}`, documentType: 'YEAR', documentNumber: year }, changes, audit)) return false;
    setPeriodStates(nextPeriods);
    setClosedYears(nextClosedYears);
    if (nextJournals !== journals) setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleReopenYear = (year: string, request?: { reason?: string; approvedBy?: string }) => {
    const current = periodRecordFor(periodStates, year, 'YEAR');
    const transition = transitionFinancialPeriod(current, { target: 'OPEN', actor: currentUserName, reason: request?.reason || `إعادة فتح السنة ${year}`, approvedBy: request?.approvedBy });
    if (!transition.valid) {
      addAuditLog('GENERAL_LEDGER', 'UPDATE', `رُفضت إعادة فتح السنة ${year}: ${transition.errors.join(' | ')}`);
      return false;
    }
    const nextPeriods = [...periodStates.filter(item => !(item.key === year && item.scope === 'YEAR')), transition.record];
    const nextClosedYears = closedYears.filter(y => y !== year);
    const closing = journals.find(j => j.reference === `CLOSE-${year}` && j.status === 'POSTED');
    if (closing && !closing.reversedByEntryId && !reversePostedJournal(closing, `إعادة فتح السنة المالية ${year}: ${request?.reason || ''}`, 'GENERAL_LEDGER', [{ key: K.periodStates, value: nextPeriods }, { key: K.closedYears, value: nextClosedYears }])) return false;
    if (!closing || closing.reversedByEntryId) {
      const audit = createAuditLog('GENERAL_LEDGER', 'UPDATE', `إعادة فتح السنة المالية ${year}: ${request?.reason || ''}`);
      if (!commitAccountingState({ idempotencyKey: `PERIOD:YEAR:${year}:OPEN:${transition.record.version}`, commandType: 'PERIOD_OPEN', documentType: 'YEAR', documentNumber: year }, [{ key: K.periodStates, value: nextPeriods }, { key: K.closedYears, value: nextClosedYears }], audit)) return false;
      setAuditLogs(prev => [audit, ...prev]);
    }
    setPeriodStates(nextPeriods);
    setClosedYears(nextClosedYears);
    return true;
  };

  const handleCloseMonth = (month: string) => {
    const pendingDocuments = [
      ...journals.filter(item => item.status === 'PENDING_POSTING' && item.date.startsWith(`${month}-`)).map(item => `قيد ${item.entryNumber}`),
      ...vouchers.filter(item => item.status === 'PENDING_POSTING' && item.date.startsWith(`${month}-`)).map(item => `سند صرف ${item.voucherNumber}`),
      ...receiptVouchers.filter(item => item.status === 'PENDING_POSTING' && item.date.startsWith(`${month}-`)).map(item => `سند قبض ${item.receiptNumber}`)
    ];
    if (pendingDocuments.length > 0) {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض إقفال الشهر ${month}: توجد مستندات غير مرحّلة — ${pendingDocuments.join('، ')}`);
      return false;
    }
    const current = periodRecordFor(periodStates, month, 'MONTH');
    const target = nextCloseStatus(current.status);
    if (!target) return false;
    const transition = transitionFinancialPeriod(current, { target, actor: currentUserName, reason: `نقل الشهر ${month} إلى ${target}` });
    const nextPeriods = [...periodStates.filter(item => !(item.key === month && item.scope === 'MONTH')), transition.record];
    const nextClosedMonths = closedMonths.includes(month) ? closedMonths : [...closedMonths, month];
    const audit = createAuditLog('GENERAL_LEDGER', 'UPDATE', `تغيير حالة الشهر ${month}: ${current.status} ← ${target}`);
    if (!commitAccountingState({ idempotencyKey: `PERIOD:MONTH:${month}:${target}:${transition.record.version}`, commandType: `PERIOD_${target}`, documentType: 'MONTH', documentNumber: month }, [{ key: K.periodStates, value: nextPeriods }, { key: K.closedMonths, value: nextClosedMonths }], audit)) return false;
    setPeriodStates(nextPeriods);
    setClosedMonths(nextClosedMonths);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleReopenMonth = (month: string, request?: { reason?: string; approvedBy?: string }) => {
    const current = periodRecordFor(periodStates, month, 'MONTH');
    const transition = transitionFinancialPeriod(current, { target: 'OPEN', actor: currentUserName, reason: request?.reason || `إعادة فتح الشهر ${month}`, approvedBy: request?.approvedBy });
    if (!transition.valid) return false;
    const nextPeriods = [...periodStates.filter(item => !(item.key === month && item.scope === 'MONTH')), transition.record];
    const nextClosedMonths = closedMonths.filter(m => m !== month);
    const audit = createAuditLog('GENERAL_LEDGER', 'UPDATE', `إعادة فتح الشهر المالي ${month}: ${request?.reason || ''}`);
    if (!commitAccountingState({ idempotencyKey: `PERIOD:MONTH:${month}:OPEN:${transition.record.version}`, commandType: 'PERIOD_OPEN', documentType: 'MONTH', documentNumber: month }, [{ key: K.periodStates, value: nextPeriods }, { key: K.closedMonths, value: nextClosedMonths }], audit)) return false;
    setPeriodStates(nextPeriods);
    setClosedMonths(nextClosedMonths);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handlePostJournal = (id: string) => {
    const found = journals.find(j => j.id === id);
    if (!found) return;
    if (isPeriodClosed(found.date, closedYears, closedMonths)) {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض ترحيل القيد ${found.entryNumber} — بتاريخ داخل فترة مغلقة`);
      return;
    }
    const validation = validateJournalForPosting(found, accounts, journals, currencies, configuredAttachmentRequirements());
    if (!validation.valid) {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض ترحيل القيد ${found.entryNumber} — ${validation.errors.join(' | ')}`);
      return;
    }
    const nextJournals = journals.map(j => j.id === id ? { ...j, status: 'POSTED' as const, postedBy: currentUserName, postedAt: new Date().toISOString() } : j);
    const audit = createAuditLog('GENERAL_LEDGER', 'POST', `ترحيل قيد اليومية المنتظر رقم ${found.entryNumber}`);
    if (!commitAccountingState({ idempotencyKey: `POST:JOURNAL:${found.id}`, commandType: 'POST', documentType: 'JOURNAL', documentNumber: found.entryNumber }, [{ key: K.journals, value: nextJournals }], audit)) return false;
    setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };


  const buildVoucherJournal = (kind: 'PAYMENT' | 'RECEIPT', voucher: PaymentVoucher | ReceiptVoucher): JournalEntry => {
    const isPayment = kind === 'PAYMENT';
    const ts = Date.now();
    const docNo = isPayment ? (voucher as PaymentVoucher).voucherNumber : (voucher as ReceiptVoucher).receiptNumber;
    const party = isPayment ? (voucher as PaymentVoucher).payeeName : (voucher as ReceiptVoucher).payerName;
    const srcAcc = accounts.find(a => a.id === voucher.sourceAccountId);
    const baseCode = currencies.find(c => c.isBase)?.code ?? 'YER';
    const baseDecimals = currencyDecimals(baseCode, currencies);
    // المعادل المحلي الموثوق: localAmount إن وُجد، وإلا يُحسب من سعر صرف السطر/السند —
    // ولا يُعامل المبلغ الأجنبي أبداً كمحلي بصمت.
    const lineLocalOf = (l: { amount: number; currency?: string; exchangeRate?: number; localAmount?: number }): number => {
      if (typeof l.localAmount === 'number' && l.localAmount > 0) return roundTo(l.localAmount, baseDecimals);
      const cur = l.currency || voucher.currency;
      if (cur === baseCode) return roundTo(l.amount, baseDecimals);
      const rate = (l.exchangeRate && l.exchangeRate > 0) ? l.exchangeRate : (voucher.exchangeRate || 1);
      return multiplyMoney(l.amount, rate, baseDecimals);
    };
    const totalLocal = roundTo(voucher.lines.reduce((s, l) => s + lineLocalOf(l), 0), baseDecimals);
    const label = isPayment ? 'سند صرف' : 'سند قبض';
    const lines: JournalLine[] = [
      {
        id: `jline-${ts}-src`,
        accountId: voucher.sourceAccountId,
        accountCode: srcAcc?.code ?? '',
        accountNameAr: voucher.sourceAccountNameAr,
        debit: isPayment ? 0 : totalLocal,
        credit: isPayment ? totalLocal : 0,
        currency: baseCode,
        exchangeRate: 1,
        rateType: 'TRANSACTION' as const,
        rateEffectiveDate: voucher.date,
        rateSource: 'VOUCHER_SOURCE',
        subLedgerType: voucher.sourceType === 'CASH_BOX' ? 'CASH_BOX' : voucher.sourceType === 'BANK_ACCOUNT' ? 'BANK' : 'NONE',
        subLedgerId: voucher.sourceEntityId,
        subLedgerName: voucher.sourceAccountNameAr,
        description: `${label} رقم ${docNo} - ${party}`
      },
      ...voucher.lines.map((l, idx) => ({
        id: `jline-${ts}-d-${idx}`,
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountNameAr: l.accountNameAr,
        debit: isPayment ? lineLocalOf(l) : 0,
        credit: isPayment ? 0 : lineLocalOf(l),
        currency: l.currency || voucher.currency,
        exchangeRate: l.currency === baseCode ? 1 : (l.exchangeRate || voucher.exchangeRate || 1),
        debitForeign: isPayment && (l.currency || voucher.currency) !== baseCode ? roundTo(l.amount, currencyDecimals(l.currency || voucher.currency, currencies)) : undefined,
        creditForeign: !isPayment && (l.currency || voucher.currency) !== baseCode ? roundTo(l.amount, currencyDecimals(l.currency || voucher.currency, currencies)) : undefined,
        rateType: l.rateType || voucher.rateType || 'TRANSACTION' as const,
        rateEffectiveDate: l.rateEffectiveDate || voucher.rateEffectiveDate || voucher.date,
        rateSource: l.rateSource || voucher.rateSource || 'DOCUMENT_RATE',
        rateOverrideReason: l.rateOverrideReason || voucher.rateOverrideReason,
        rateApprovedBy: l.rateApprovedBy || voucher.rateApprovedBy,
        description: l.description || `${label} ${docNo} - ${party}`,
        costCenterId: l.costCenterId,
        subLedgerType: l.subLedgerType,
        subLedgerId: l.subLedgerId,
        subLedgerName: l.subLedgerName
      }))
    ];
    const now = new Date().toISOString();
    return {
      id: `jv-${ts}`,
      entryNumber: nextJournalNumber(journals),
      date: voucher.date,
      reference: docNo,
      narration: voucher.narration || `${label} رقم ${docNo} - ${party}`,
      lines,
      totalDebit: totalLocal,
      totalCredit: totalLocal,
      currency: voucher.currency,
      exchangeRate: voucher.exchangeRate || 1,
      rateType: voucher.rateType || 'TRANSACTION',
      rateEffectiveDate: voucher.rateEffectiveDate || voucher.date,
      rateSource: voucher.rateSource || 'DOCUMENT_RATE',
      status: 'POSTED',
      type: isPayment ? 'PV' as const : 'RV' as const,
      sourceType: isPayment ? 'PAYMENT_VOUCHER' as const : 'RECEIPT_VOUCHER' as const,
      referenceCode: docNo,
      createdBy: currentUserName,
      createdAt: now,
      postedBy: currentUserName,
      postedAt: now
    };
  };

  const handlePostPaymentVoucher = (voucher: PaymentVoucher) => {
    if (isPeriodClosed(voucher.date, closedYears, closedMonths)) {
      addAuditLog('PAYMENT_VOUCHERS', 'POST', `رُفض ترحيل سند الصرف رقم ${voucher.voucherNumber} — بتاريخ داخل فترة مغلقة`);
      return;
    }
    const stored = vouchers.find(item => item.id === voucher.id) || voucher;
    const currentSourceAccountId = stored.sourceType === 'CASH_BOX'
      ? cashBoxes.find(item => item.id === stored.sourceEntityId)?.linkedAccountId
      : bankAccounts.find(item => item.id === stored.sourceEntityId)?.linkedAccountId;
    const canonical = currentSourceAccountId && currentSourceAccountId !== stored.sourceAccountId
      ? { ...stored, sourceAccountId: currentSourceAccountId, sourceAccountNameAr: accounts.find(item => item.id === currentSourceAccountId)?.nameAr || stored.sourceAccountNameAr }
      : stored;
    const validation = validateVoucherForPosting('PAYMENT', canonical, accounts, vouchers, journals, currencies, configuredAttachmentRequirements());
    if (!validation.valid) {
      addAuditLog('PAYMENT_VOUCHERS', 'POST', `رُفض ترحيل سند الصرف رقم ${voucher.voucherNumber} — ${validation.errors.join(' | ')}`);
      return;
    }
    const journalEntry = buildVoucherJournal('PAYMENT', canonical);
    const nextVouchers = vouchers.map(v => v.id === voucher.id ? {
      ...v,
      sourceAccountId: canonical.sourceAccountId,
      sourceAccountNameAr: canonical.sourceAccountNameAr,
      rateType: v.rateType || 'TRANSACTION' as const,
      rateEffectiveDate: v.rateEffectiveDate || v.date,
      rateSource: v.rateSource || 'DOCUMENT_RATE',
      lines: v.lines.map(line => ({ ...line, rateType: line.rateType || v.rateType || 'TRANSACTION' as const, rateEffectiveDate: line.rateEffectiveDate || v.rateEffectiveDate || v.date, rateSource: line.rateSource || v.rateSource || 'DOCUMENT_RATE' })),
      status: 'POSTED' as const, journalEntryId: journalEntry.id, postedBy: currentUserName, postedAt: new Date().toISOString()
    } : v);
    const nextJournals = [journalEntry, ...journals];
    const audit = createAuditLog('PAYMENT_VOUCHERS', 'POST', `ترحيل سند الصرف المنتظر رقم ${voucher.voucherNumber}`);
    if (!commitAccountingState({ idempotencyKey: `POST:PAYMENT:${canonical.id}`, commandType: 'POST', documentType: 'PAYMENT', documentNumber: canonical.voucherNumber }, [{ key: K.vouchers, value: nextVouchers }, { key: K.journals, value: nextJournals }], audit)) return false;
    setVouchers(nextVouchers);
    setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handlePostReceiptVoucher = (receipt: ReceiptVoucher) => {
    if (isPeriodClosed(receipt.date, closedYears, closedMonths)) {
      addAuditLog('RECEIPT_VOUCHERS', 'POST', `رُفض ترحيل سند القبض رقم ${receipt.receiptNumber} — بتاريخ داخل فترة مغلقة`);
      return;
    }
    const stored = receiptVouchers.find(item => item.id === receipt.id) || receipt;
    const currentSourceAccountId = stored.sourceType === 'CASH_BOX'
      ? cashBoxes.find(item => item.id === stored.sourceEntityId)?.linkedAccountId
      : bankAccounts.find(item => item.id === stored.sourceEntityId)?.linkedAccountId;
    const canonical = currentSourceAccountId && currentSourceAccountId !== stored.sourceAccountId
      ? { ...stored, sourceAccountId: currentSourceAccountId, sourceAccountNameAr: accounts.find(item => item.id === currentSourceAccountId)?.nameAr || stored.sourceAccountNameAr }
      : stored;
    const validation = validateVoucherForPosting('RECEIPT', canonical, accounts, receiptVouchers, journals, currencies, configuredAttachmentRequirements());
    if (!validation.valid) {
      addAuditLog('RECEIPT_VOUCHERS', 'POST', `رُفض ترحيل سند القبض رقم ${receipt.receiptNumber} — ${validation.errors.join(' | ')}`);
      return;
    }
    const journalEntry = buildVoucherJournal('RECEIPT', canonical);
    const nextReceipts = receiptVouchers.map(r => r.id === receipt.id ? {
      ...r,
      sourceAccountId: canonical.sourceAccountId,
      sourceAccountNameAr: canonical.sourceAccountNameAr,
      rateType: r.rateType || 'TRANSACTION' as const,
      rateEffectiveDate: r.rateEffectiveDate || r.date,
      rateSource: r.rateSource || 'DOCUMENT_RATE',
      lines: r.lines.map(line => ({ ...line, rateType: line.rateType || r.rateType || 'TRANSACTION' as const, rateEffectiveDate: line.rateEffectiveDate || r.rateEffectiveDate || r.date, rateSource: line.rateSource || r.rateSource || 'DOCUMENT_RATE' })),
      status: 'POSTED' as const, journalEntryId: journalEntry.id, postedBy: currentUserName, postedAt: new Date().toISOString()
    } : r);
    const nextJournals = [journalEntry, ...journals];
    const audit = createAuditLog('RECEIPT_VOUCHERS', 'POST', `ترحيل سند القبض المنتظر رقم ${receipt.receiptNumber}`);
    if (!commitAccountingState({ idempotencyKey: `POST:RECEIPT:${canonical.id}`, commandType: 'POST', documentType: 'RECEIPT', documentNumber: canonical.receiptNumber }, [{ key: K.receipts, value: nextReceipts }, { key: K.journals, value: nextJournals }], audit)) return false;
    setReceiptVouchers(nextReceipts);
    setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleDailyBatchPost = (items: DailyPostingRequest[]): DailyPostingBatchResult => {
    let nextJournals = [...journals];
    let nextVouchers = [...vouchers];
    let nextReceipts = [...receiptVouchers];
    const results: DailyPostingBatchResult['results'] = [];

    items.forEach((item, index) => {
      if (item.kind === 'JOURNAL') {
        const found = nextJournals.find(j => j.id === item.id && j.status === 'PENDING_POSTING');
        if (!found) { results.push({ ...item, ok: false, error: 'القيد غير موجود ضمن المستندات المنتظرة أو تم ترحيله مسبقًا' }); return; }
        if (isPeriodClosed(found.date, closedYears, closedMonths)) { results.push({ ...item, ok: false, error: 'تاريخ القيد داخل فترة مغلقة' }); return; }
        const validation = validateJournalForPosting(found, accounts, nextJournals, currencies, configuredAttachmentRequirements());
        if (!validation.valid) { results.push({ ...item, ok: false, error: validation.errors.join(' | ') }); return; }
        nextJournals = nextJournals.map(j => j.id === found.id ? { ...j, status: 'POSTED' as const, postedBy: currentUserName, postedAt: new Date().toISOString() } : j);
        results.push({ ...item, ok: true });
        return;
      }

      if (item.kind === 'PAYMENT') {
        const found = nextVouchers.find(v => v.id === item.id && v.status === 'PENDING_POSTING');
        if (!found) { results.push({ ...item, ok: false, error: 'سند الصرف غير موجود ضمن المستندات المنتظرة أو تم ترحيله مسبقًا' }); return; }
        if (isPeriodClosed(found.date, closedYears, closedMonths)) { results.push({ ...item, ok: false, error: 'تاريخ سند الصرف داخل فترة مغلقة' }); return; }
        const currentSourceAccountId = found.sourceType === 'CASH_BOX'
          ? cashBoxes.find(entity => entity.id === found.sourceEntityId)?.linkedAccountId
          : bankAccounts.find(entity => entity.id === found.sourceEntityId)?.linkedAccountId;
        const canonical = currentSourceAccountId && currentSourceAccountId !== found.sourceAccountId
          ? { ...found, sourceAccountId: currentSourceAccountId, sourceAccountNameAr: accounts.find(account => account.id === currentSourceAccountId)?.nameAr || found.sourceAccountNameAr }
          : found;
        const validation = validateVoucherForPosting('PAYMENT', canonical, accounts, nextVouchers, nextJournals, currencies, configuredAttachmentRequirements());
        if (!validation.valid) { results.push({ ...item, ok: false, error: validation.errors.join(' | ') }); return; }
        const generated = buildVoucherJournal('PAYMENT', canonical);
        generated.id = `jv-${Date.now()}-${index}`;
        generated.entryNumber = nextJournalNumber(nextJournals);
        nextJournals = [generated, ...nextJournals];
        nextVouchers = nextVouchers.map(v => v.id === found.id ? { ...v, sourceAccountId: canonical.sourceAccountId, sourceAccountNameAr: canonical.sourceAccountNameAr, status: 'POSTED' as const, journalEntryId: generated.id, postedBy: currentUserName, postedAt: new Date().toISOString() } : v);
        results.push({ ...item, ok: true });
        return;
      }

      const found = nextReceipts.find(r => r.id === item.id && r.status === 'PENDING_POSTING');
      if (!found) { results.push({ ...item, ok: false, error: 'سند القبض غير موجود ضمن المستندات المنتظرة أو تم ترحيله مسبقًا' }); return; }
      if (isPeriodClosed(found.date, closedYears, closedMonths)) { results.push({ ...item, ok: false, error: 'تاريخ سند القبض داخل فترة مغلقة' }); return; }
      const currentSourceAccountId = found.sourceType === 'CASH_BOX'
        ? cashBoxes.find(entity => entity.id === found.sourceEntityId)?.linkedAccountId
        : bankAccounts.find(entity => entity.id === found.sourceEntityId)?.linkedAccountId;
      const canonical = currentSourceAccountId && currentSourceAccountId !== found.sourceAccountId
        ? { ...found, sourceAccountId: currentSourceAccountId, sourceAccountNameAr: accounts.find(account => account.id === currentSourceAccountId)?.nameAr || found.sourceAccountNameAr }
        : found;
      const validation = validateVoucherForPosting('RECEIPT', canonical, accounts, nextReceipts, nextJournals, currencies, configuredAttachmentRequirements());
      if (!validation.valid) { results.push({ ...item, ok: false, error: validation.errors.join(' | ') }); return; }
      const generated = buildVoucherJournal('RECEIPT', canonical);
      generated.id = `jv-${Date.now()}-${index}`;
      generated.entryNumber = nextJournalNumber(nextJournals);
      nextJournals = [generated, ...nextJournals];
      nextReceipts = nextReceipts.map(r => r.id === found.id ? { ...r, sourceAccountId: canonical.sourceAccountId, sourceAccountNameAr: canonical.sourceAccountNameAr, status: 'POSTED' as const, journalEntryId: generated.id, postedBy: currentUserName, postedAt: new Date().toISOString() } : r);
      results.push({ ...item, ok: true });
    });

    const candidates = results.filter(item => item.ok);
    if (candidates.length === 0) return { ok: false, posted: 0, failed: results.length, results };
    const audit = createAuditLog('GENERAL_LEDGER', 'POST', `ترحيل يومي مجمع: ${candidates.map(item => item.docNo).join('، ')}`);
    const command = commitAccountingCommand({
      idempotencyKey: `POST:DAILY_BATCH:${Date.now()}:${candidates.map(item => item.id).sort().join(':')}`,
      commandType: 'POST_BATCH', documentType: 'DAILY_POSTING', documentNumber: candidates.map(item => item.docNo).join(','),
      changes: [
        { key: K.journals, value: JSON.stringify(nextJournals) },
        { key: K.vouchers, value: JSON.stringify(nextVouchers) },
        { key: K.receipts, value: JSON.stringify(nextReceipts) },
        { key: K.auditLogs, value: JSON.stringify([audit, ...auditLogs]) }
      ],
      expectedVersions: Object.fromEntries([K.journals, K.vouchers, K.receipts, K.auditLogs].map(key => [key, persistentVersion(key)]))
    });
    if (!command.ok) {
      const error = accountingCommandError(command.error);
      const failedResults = results.map(item => item.ok ? { ...item, ok: false, error } : item);
      return { ok: false, posted: 0, failed: failedResults.length, results: failedResults };
    }
    setJournals(nextJournals);
    setVouchers(nextVouchers);
    setReceiptVouchers(nextReceipts);
    setAuditLogs(previous => [audit, ...previous]);
    return { ok: results.every(item => item.ok), posted: candidates.length, failed: results.length - candidates.length, results };
  };

  function reversePostedJournal(original: JournalEntry, reason: string, module: AuditLog['module'], extraStateChanges: Array<{ key: string; value: unknown }> = []): JournalEntry | null {
    const reversalDate = new Date().toISOString().slice(0, 10);
    if (isPeriodClosed(reversalDate, closedYears, closedMonths)) {
      addAuditLog(module, 'VOID', `رُفض عكس القيد ${original.entryNumber}: فترة القيد العكسي مغلقة`);
      return null;
    }
    const built = buildLinkedReversal(original, journals, currentUserName, reason, reversalDate);
    if (!built.valid || !built.reversal) {
      addAuditLog(module, 'VOID', `رُفض عكس القيد ${original.entryNumber}: ${built.errors.join(' | ')}`);
      return null;
    }
    const validation = validateGeneratedJournalForPosting(built.reversal, accounts, journals, currencies);
    if (!validation.valid) {
      addAuditLog(module, 'VOID', `رُفض القيد العكسي ${built.reversal.entryNumber}: ${validation.errors.join(' | ')}`);
      return null;
    }
    const reversal = built.reversal;
    const nextJournals = [reversal, ...journals.map(j => j.id === original.id ? linkOriginalToReversal(j, reversal) : j)];
    const audit = createAuditLog(module, 'VOID', `عكس القيد ${original.entryNumber} بالقيد المرتبط ${reversal.entryNumber}: ${reason}`);
    if (!commitAccountingState({ idempotencyKey: `REVERSE:JOURNAL:${original.id}`, commandType: 'REVERSE', documentType: 'JOURNAL', documentNumber: original.entryNumber }, [{ key: K.journals, value: nextJournals }, ...extraStateChanges], audit)) return null;
    setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return reversal;
  }

  const handleUnpostJournal = (id: string) => {
    const found = journals.find(j => j.id === id);
    if (!found) return;
    return Boolean(reversePostedJournal(found, 'عكس من شاشة الإقفالات والرقابة', 'GENERAL_LEDGER'));
  };

  const handleUnpostVoucher = (kind: 'PAYMENT' | 'RECEIPT', id: string) => {
    const isPayment = kind === 'PAYMENT';
    const found = isPayment ? vouchers.find(v => v.id === id) : receiptVouchers.find(r => r.id === id);
    const docNo = isPayment ? (found as PaymentVoucher | undefined)?.voucherNumber : (found as ReceiptVoucher | undefined)?.receiptNumber;
    if (!found || found.status !== 'POSTED') return false;
    const original = journals.find(j => j.id === found.journalEntryId) ?? journals.find(j => docNo && j.referenceCode === docNo && j.sourceType === (isPayment ? 'PAYMENT_VOUCHER' : 'RECEIPT_VOUCHER'));
    if (!original) {
      addAuditLog(isPayment ? 'PAYMENT_VOUCHERS' : 'RECEIPT_VOUCHERS', 'VOID', `رُفض عكس السند ${docNo ?? id}: القيد الأصلي غير موجود`);
      return false;
    }
    const reversalId = `rev-${original.id}`;
    const nextVouchers = isPayment ? vouchers.map(v => v.id === id ? { ...v, status: 'VOIDED' as const, reversalJournalEntryId: reversalId } : v) : null;
    const nextReceipts = !isPayment ? receiptVouchers.map(r => r.id === id ? { ...r, status: 'VOIDED' as const, reversalJournalEntryId: reversalId } : r) : null;
    const reversal = reversePostedJournal(
      original,
      `عكس السند ${docNo}`,
      isPayment ? 'PAYMENT_VOUCHERS' : 'RECEIPT_VOUCHERS',
      isPayment ? [{ key: K.vouchers, value: nextVouchers }] : [{ key: K.receipts, value: nextReceipts }]
    );
    if (!reversal) return false;
    if (nextVouchers) setVouchers(nextVouchers);
    if (nextReceipts) setReceiptVouchers(nextReceipts);
    return true;
  };

  const handleCreateOpeningEntry = (year: string) => {
    const nextYear = String(Number(year) + 1);
    const sourcePeriod = periodRecordFor(periodStates, year, 'YEAR');
    if (sourcePeriod.status !== 'FINAL_CLOSED') {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض تدوير أرصدة ${year}: الإقفال النهائي مطلوب`);
      return false;
    }
    if (journals.some(j => j.reference === `OPEN-${nextYear}` && j.status === 'POSTED') || sourcePeriod.openingEntryId) return false;
    const retained = accounts.find(a => a.code === '2202010001' && a.level === 5) ?? accounts.find(a => a.nameAr.includes('أرباح مبقاة') && a.level === 5);
    const upToYear = journals.filter(j => j.status === 'POSTED' && yearOf(j.date) <= year);
    const activity = calculateAccountActivity(accounts, upToYear);
    const lines: JournalLine[] = [];
    let totalDebit = 0;
    let totalCredit = 0;
    accounts.filter(isPostingAccount).forEach(acc => {
      const type = accountFinancialType(acc, accounts);
      if (type === 'REVENUE' || type === 'EXPENSE') return;
      const net = round2(netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 }));
      if (Math.abs(net) < 0.005) return;
      if (net > 0) {
        lines.push({ id: `op-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: net, credit: 0, description: `رصيد افتتاحي ${acc.nameAr}` });
        totalDebit += net;
      } else {
        lines.push({ id: `op-${acc.id}`, accountId: acc.id, accountCode: acc.code, accountNameAr: acc.nameAr, debit: 0, credit: Math.abs(net), description: `رصيد افتتاحي ${acc.nameAr}` });
        totalCredit += Math.abs(net);
      }
    });
    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);
    const diff = round2(totalDebit - totalCredit);
    if (Math.abs(diff) > 0.005 && retained) {
      if (diff > 0) {
        lines.push({ id: 'op-retained', accountId: retained.id, accountCode: retained.code, accountNameAr: retained.nameAr, debit: 0, credit: diff, description: `تسوية رصيد افتتاحي` });
        totalCredit += diff;
      } else {
        lines.push({ id: 'op-retained', accountId: retained.id, accountCode: retained.code, accountNameAr: retained.nameAr, debit: Math.abs(diff), credit: 0, description: `تسوية رصيد افتتاحي` });
        totalDebit += Math.abs(diff);
      }
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const entry: JournalEntry = {
      id: `open-${nextYear}-from-${year}`,
      entryNumber: `OPEN-${nextYear}`,
      date: `${nextYear}-01-01`,
      reference: `OPEN-${nextYear}`,
      narration: `القيد الافتتاحي للسنة المالية ${nextYear}`,
      lines,
      totalDebit: round2(totalDebit),
      totalCredit: round2(totalCredit),
      currency: currencies.find(c => c.isBase)?.code ?? 'YER',
      exchangeRate: 1,
      status: 'POSTED',
      createdBy: currentUserName,
      createdAt: now,
      postedBy: currentUserName,
      postedAt: now
    };
    const validation = validateGeneratedJournalForPosting(entry, accounts, journals, currencies);
    if (!validation.valid) {
      addAuditLog('GENERAL_LEDGER', 'POST', `رُفض القيد الافتتاحي ${nextYear}: ${validation.errors.join(' | ')}`);
      return false;
    }
    const linkedPeriod = { ...sourcePeriod, openingEntryId: entry.id };
    const nextPeriods = [...periodStates.filter(item => !(item.key === year && item.scope === 'YEAR')), linkedPeriod];
    const nextJournals = [entry, ...journals];
    const audit = createAuditLog('GENERAL_LEDGER', 'POST', `توليد القيد الافتتاحي للسنة ${nextYear} من إقفال ${year}`);
    if (!commitAccountingState({ idempotencyKey: `CARRY_FORWARD:${year}:${nextYear}`, commandType: 'CARRY_FORWARD', documentType: 'YEAR', documentNumber: nextYear }, [{ key: K.journals, value: nextJournals }, { key: K.periodStates, value: nextPeriods }], audit)) return false;
    setJournals(nextJournals);
    setPeriodStates(nextPeriods);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleVoidJournal = (id: string) => {
    const found = journals.find(j => j.id === id);
    if (!found) return false;
    if (found.status === 'POSTED') return Boolean(reversePostedJournal(found, 'عكس من شاشة قيود اليومية', 'GENERAL_LEDGER'));
    if (found.status === 'PENDING_POSTING') {
      setJournals(prev => prev.map(j => j.id === id ? { ...j, status: 'VOIDED' as const } : j));
      addAuditLog('GENERAL_LEDGER', 'VOID', `إلغاء القيد المنتظر للترحيل ${found.entryNumber}`);
      return true;
    }
    return false;
  };

  const handleRestoreJournal = (id: string) => {
    const found = journals.find(j => j.id === id);
    addAuditLog('GENERAL_LEDGER', 'UPDATE', `رُفضت استعادة القيد ${found?.entryNumber ?? id}: القيود الملغاة لا تُعاد؛ أنشئ قيداً جديداً`);
    return false;
  };

  const handleUpdateJournal = (id: string, updated: JournalEntry, opts?: { skipClosedCheck?: boolean }) => {
    const current = journals.find(j => j.id === id);
    if (current?.status === 'POSTED') {
      addAuditLog('GENERAL_LEDGER', 'UPDATE', `رُفض تعديل القيد المُرحّل ${current.entryNumber} — استخدم الإلغاء أو القيد العكسي`);
      return;
    }
    if (!opts?.skipClosedCheck && isPeriodClosed(updated.date, closedYears, closedMonths)) {
      addAuditLog('GENERAL_LEDGER', 'UPDATE', `رُفض حفظ القيد ${updated.entryNumber} — بتاريخ داخل فترة مغلقة`);
      return;
    }
    setJournals(prev => prev.map(j => (j.id === id ? updated : j)));
    addAuditLog('GENERAL_LEDGER', 'UPDATE', `تعديل قيد اليومية رقم ${updated.entryNumber}`);
  };

  const handleAddTrust = (trust: Trust) => {
    setTrusts(prev => [trust, ...prev]);
    addAuditLog('TRUSTS', 'CREATE', `إصدار عهدة جديدة ${trust.trustNumber}`);
  };

  const handleUpdateTrust = (id: string, updates: Partial<Trust>) => {
    setTrusts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    addAuditLog('TRUSTS', 'UPDATE', `تعديل بيانات العهدة رقم ${id}`);
  };

  const handleAddCustody = (custody: Custody) => {
    setCustodies(prev => [custody, ...prev]);
    addAuditLog('CUSTODY', 'CREATE', `إنشاء عهدة ${custody.custodyNumber}`);
  };

  const handleUpdateCustody = (id: string, updates: Partial<Custody>) => {
    setCustodies(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16) } : c));
    addAuditLog('CUSTODY', 'UPDATE', `تحديث بيانات عهدة ${id}`);
  };

  type RelinkableEntity = CashBox | BankAccount | Employee | Customer | Vendor;
  const performControlAccountRelink = <T extends RelinkableEntity>(
    kind: ControlEntityKind,
    current: T,
    updates: Partial<T>,
    list: T[],
    storageKey: string,
    setList: (value: T[]) => void,
    module: AuditLog['module']
  ): boolean => {
    const fromAccountId = current.linkedAccountId || '';
    const toAccountId = updates.linkedAccountId || '';
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return false;
    const sourceMovement = [...vouchers, ...receiptVouchers].some(item => item.status === 'POSTED' && item.sourceEntityId === current.id && item.sourceAccountId === fromAccountId);
    if (!sourceMovement && !hasPostedEntityMovement(journals, current.id, fromAccountId)) return false;

    const effectiveDate = window.prompt('تاريخ سريان تحويل حساب الربط (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (effectiveDate === null) return true;
    const reason = window.prompt('سبب تحويل حساب الربط:', 'إعادة تنظيم حسابات الرقابة');
    if (reason === null) return true;
    const approvedBy = window.prompt('اسم المعتمد المستقل عن منفذ العملية:', '');
    if (approvedBy === null) return true;
    if (isPeriodClosed(effectiveDate, closedYears, closedMonths)) {
      addAuditLog(module, 'UPDATE', `رُفض تحويل حساب الربط للكيان ${current.code}: التاريخ داخل فترة مغلقة`);
      return true;
    }
    const entityName = 'bankNameAr' in current ? current.bankNameAr : current.nameAr;
    const baseCurrency = currencies.find(item => item.isBase)?.code || 'YER';
    const transfer = buildControlAccountTransfer({ kind, entityId: current.id, entityCode: current.code, entityName, fromAccountId, toAccountId, effectiveDate, reason, requestedBy: currentUserName, approvedBy, baseCurrency }, accounts, journals, currencyDecimals(baseCurrency, currencies));
    if (!transfer.valid || !transfer.record) {
      addAuditLog(module, 'UPDATE', `رُفض تحويل حساب الربط للكيان ${current.code}: ${transfer.errors.join(' | ')}`);
      return true;
    }
    if (transfer.journal) {
      const validation = validateGeneratedJournalForPosting(transfer.journal, accounts, journals, currencies);
      if (!validation.valid) {
        addAuditLog(module, 'UPDATE', `رُفض قيد تحويل حساب الربط للكيان ${current.code}: ${validation.errors.join(' | ')}`);
        return true;
      }
    }
    const updated = { ...current, ...updates, linkedAccountId: toAccountId, controlAccountTransfers: [...(current.controlAccountTransfers || []), transfer.record] } as T;
    const nextList = list.map(item => item.id === current.id ? updated : item);
    const nextJournals = transfer.journal ? [transfer.journal, ...journals] : journals;
    const audit = createAuditLog(module, 'UPDATE', `تحويل حساب ربط ${current.code} من ${fromAccountId} إلى ${toAccountId} بتاريخ ${effectiveDate} واعتماد ${approvedBy}${transfer.journal ? ` بالقيد ${transfer.journal.entryNumber}` : ' دون رصيد منقول'}`);
    const changes: Array<{ key: string; value: unknown }> = [{ key: storageKey, value: nextList }];
    if (transfer.journal) changes.push({ key: K.journals, value: nextJournals });
    if (!commitAccountingState({ idempotencyKey: `CONTROL_TRANSFER:${kind}:${current.id}:${transfer.record.id}`, commandType: 'CONTROL_ACCOUNT_TRANSFER', documentType: kind, documentNumber: current.code }, changes, audit)) return true;
    setList(nextList);
    if (transfer.journal) setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleAddCashBox = (box: Omit<CashBox, 'id'>) => {
    const created: CashBox = { ...box, id: `bx-${Date.now()}` };
    setCashBoxes(prev => [...prev, created]);
    addAuditLog('GENERAL_LEDGER', 'CREATE', `إنشاء صندوق نقدي جديد: ${created.code}`);
  };

  const handleUpdateCashBox = (id: string, updates: Partial<CashBox>) => {
    const current = cashBoxes.find(item => item.id === id);
    if (current && performControlAccountRelink('CASH_BOX', current, updates, cashBoxes, K.cashBoxes, setCashBoxes, 'GENERAL_LEDGER')) return;
    const before = current;
    setCashBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    const audit = createAuditLog('GENERAL_LEDGER', 'UPDATE', `تعديل بيانات الصندوق النقدي رقم ${id}`, undefined, before, before ? { ...before, ...updates } : undefined);
    setAuditLogs(prev => [audit, ...prev]);
  };

  const handleDeleteCashBox = (id: string) => {
    const box = cashBoxes.find(b => b.id === id);
    if (!box) return;
    const decision = entityRemovalDecision('CASH_BOX', id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    setCashBoxes(prev => decision.action === 'ARCHIVE' ? prev.map(b => b.id === id ? { ...b, isActive: false } : b) : prev.filter(b => b.id !== id));
    addAuditLog('GENERAL_LEDGER', decision.action === 'ARCHIVE' ? 'UPDATE' : 'DELETE', `${decision.action === 'ARCHIVE' ? 'أرشفة' : 'حذف'} الصندوق ${box.code}${decision.reasons.length ? `: ${decision.reasons.join('، ')}` : ''}`);
  };

  const handleAddBank = (bank: Omit<BankAccount, 'id'>) => {
    const created: BankAccount = { ...bank, id: `bnk-${Date.now()}` };
    setBankAccounts(prev => [...prev, created]);
    addAuditLog('GENERAL_LEDGER', 'CREATE', `إنشاء بنك / صراف: ${created.code}`);
  };

  const handleUpdateBank = (id: string, updates: Partial<BankAccount>) => {
    const current = bankAccounts.find(item => item.id === id);
    if (current && performControlAccountRelink('BANK', current, updates, bankAccounts, K.bankAccounts, setBankAccounts, 'GENERAL_LEDGER')) return;
    const before = current;
    setBankAccounts(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    const audit = createAuditLog('GENERAL_LEDGER', 'UPDATE', `تعديل بيانات البنك رقم ${id}`, undefined, before, before ? { ...before, ...updates } : undefined);
    setAuditLogs(prev => [audit, ...prev]);
  };

  const handleDeleteBank = (id: string) => {
    const bank = bankAccounts.find(b => b.id === id);
    if (!bank) return;
    const decision = entityRemovalDecision('BANK', id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    setBankAccounts(prev => decision.action === 'ARCHIVE' ? prev.map(b => b.id === id ? { ...b, isActive: false } : b) : prev.filter(b => b.id !== id));
    addAuditLog('GENERAL_LEDGER', decision.action === 'ARCHIVE' ? 'UPDATE' : 'DELETE', `${decision.action === 'ARCHIVE' ? 'أرشفة' : 'حذف'} البنك ${bank.code}${decision.reasons.length ? `: ${decision.reasons.join('، ')}` : ''}`);
  };

  const handleAddVoucher = (voucher: PaymentVoucher, journalEntry?: JournalEntry) => {
    setVouchers(prev => [voucher, ...prev]);
    if (journalEntry) setJournals(prev => [journalEntry, ...prev]);
    addAuditLog('PAYMENT_VOUCHERS', voucher.status === 'POSTED' ? 'POST' : 'CREATE', `إصدار سند صرف رقم ${voucher.voucherNumber}`);
  };

  const handleVoidVoucher = (id: string, journalEntryId?: string) => {
    const target = vouchers.find(v => v.id === id);
    if (!target) return false;
    if (target.status === 'POSTED') return handleUnpostVoucher('PAYMENT', id);
    if (target.status === 'PENDING_POSTING') {
      setVouchers(prev => prev.map(v => v.id === id ? { ...v, status: 'VOIDED' as const } : v));
      addAuditLog('PAYMENT_VOUCHERS', 'VOID', `إلغاء سند الصرف المنتظر للترحيل ${target.voucherNumber}`);
      return true;
    }
    return false;
  };

  const handleRestoreVoucher = (id: string, journalEntryId?: string) => {
    const target = vouchers.find(v => v.id === id);
    addAuditLog('PAYMENT_VOUCHERS', 'UPDATE', `رُفضت استعادة سند الصرف ${target?.voucherNumber ?? id}: أنشئ سند استبدال جديداً`);
    return false;
  };

  const handleUpdateVoucher = (id: string, updated: PaymentVoucher, journalEntry?: JournalEntry, oldJournalEntryId?: string) => {
    const current = vouchers.find(v => v.id === id);
    if (current && current.status !== 'PENDING_POSTING') {
      addAuditLog('PAYMENT_VOUCHERS', 'UPDATE', `رُفض تعديل سند الصرف غير المنتظر للترحيل ${current.voucherNumber} — استخدم سند استبدال`);
      return;
    }
    setVouchers(prev => prev.map(v => (v.id === id ? updated : v)));
    if (oldJournalEntryId && journalEntry && oldJournalEntryId !== journalEntry.id) {
      setJournals(prev => prev.map(j => (j.id === oldJournalEntryId ? { ...j, status: 'VOIDED' as const } : j)));
    }
    if (journalEntry) setJournals(prev => [journalEntry, ...prev]);
    addAuditLog('PAYMENT_VOUCHERS', updated.status === 'POSTED' ? 'POST' : 'UPDATE', `تعديل سند صرف رقم ${updated.voucherNumber}`);
  };

  const handleAddReceiptVoucher = (receipt: ReceiptVoucher, journalEntry?: JournalEntry) => {
    setReceiptVouchers(prev => [receipt, ...prev]);
    if (journalEntry) setJournals(prev => [journalEntry, ...prev]);
    addAuditLog('RECEIPT_VOUCHERS', receipt.status === 'POSTED' ? 'POST' : 'CREATE', `إصدار سند قبض رقم ${receipt.receiptNumber}`);
  };

  const handleVoidReceiptVoucher = (id: string, journalEntryId?: string) => {
    const target = receiptVouchers.find(r => r.id === id);
    if (!target) return false;
    if (target.status === 'POSTED') return handleUnpostVoucher('RECEIPT', id);
    if (target.status === 'PENDING_POSTING') {
      setReceiptVouchers(prev => prev.map(r => r.id === id ? { ...r, status: 'VOIDED' as const } : r));
      addAuditLog('RECEIPT_VOUCHERS', 'VOID', `إلغاء سند القبض المنتظر للترحيل ${target.receiptNumber}`);
      return true;
    }
    return false;
  };

  const handleRestoreReceiptVoucher = (id: string, journalEntryId?: string) => {
    const target = receiptVouchers.find(r => r.id === id);
    addAuditLog('RECEIPT_VOUCHERS', 'UPDATE', `رُفضت استعادة سند القبض ${target?.receiptNumber ?? id}: أنشئ سند استبدال جديداً`);
    return false;
  };

  const handleUpdateReceiptVoucher = (id: string, updated: ReceiptVoucher, journalEntry?: JournalEntry, oldJournalEntryId?: string) => {
    const current = receiptVouchers.find(r => r.id === id);
    if (current && current.status !== 'PENDING_POSTING') {
      addAuditLog('RECEIPT_VOUCHERS', 'UPDATE', `رُفض تعديل سند القبض غير المنتظر للترحيل ${current.receiptNumber} — استخدم سند استبدال`);
      return;
    }
    setReceiptVouchers(prev => prev.map(r => (r.id === id ? updated : r)));
    if (oldJournalEntryId && journalEntry && oldJournalEntryId !== journalEntry.id) {
      setJournals(prev => prev.map(j => (j.id === oldJournalEntryId ? { ...j, status: 'VOIDED' as const } : j)));
    }
    if (journalEntry) setJournals(prev => [journalEntry, ...prev]);
    addAuditLog('RECEIPT_VOUCHERS', updated.status === 'POSTED' ? 'POST' : 'UPDATE', `تعديل سند قبض رقم ${updated.receiptNumber}`);
  };

  const handlePostPendingReceipt = (receipt: ReceiptVoucher, journalEntry: JournalEntry) => {
    const current = receiptVouchers.find(r => r.id === receipt.id);
    const receiptToValidate = { ...receipt, status: 'PENDING_POSTING' as const };
    const receiptValidation = validateVoucherForPosting('RECEIPT', receiptToValidate, accounts, receiptVouchers, journals, currencies);
    const journalValidation = validateGeneratedJournalForPosting(journalEntry, accounts, journals, currencies);
    if (!current || current.status !== 'PENDING_POSTING' || !receiptValidation.valid || !journalValidation.valid) {
      const reasons = [
        ...(!current || current.status !== 'PENDING_POSTING' ? ['السند ليس ضمن المستندات المنتظرة للترحيل.'] : []),
        ...receiptValidation.errors,
        ...journalValidation.errors,
      ];
      addAuditLog('RECEIPT_VOUCHERS', 'POST', `رُفض ترحيل سند القبض ${receipt.receiptNumber}: ${reasons.join(' | ')}`);
      return false;
    }
    const nextReceipts = receiptVouchers.map(r => r.id === receipt.id ? {
      ...r,
      rateType: r.rateType || 'TRANSACTION' as const,
      rateEffectiveDate: r.rateEffectiveDate || r.date,
      rateSource: r.rateSource || 'DOCUMENT_RATE',
      lines: r.lines.map(line => ({ ...line, rateType: line.rateType || r.rateType || 'TRANSACTION' as const, rateEffectiveDate: line.rateEffectiveDate || r.rateEffectiveDate || r.date, rateSource: line.rateSource || r.rateSource || 'DOCUMENT_RATE' })),
      status: 'POSTED' as const, journalEntryId: journalEntry.id, postedBy: currentUserName, postedAt: new Date().toISOString()
    } : r);
    const nextJournals = [journalEntry, ...journals];
    const audit = createAuditLog('RECEIPT_VOUCHERS', 'POST', `ترحيل سند القبض المنتظر رقم ${receipt.receiptNumber}`);
    if (!commitAccountingState({ idempotencyKey: `POST:RECEIPT:${receipt.id}`, commandType: 'POST', documentType: 'RECEIPT', documentNumber: receipt.receiptNumber }, [{ key: K.receipts, value: nextReceipts }, { key: K.journals, value: nextJournals }], audit)) return false;
    setReceiptVouchers(nextReceipts);
    setJournals(nextJournals);
    setAuditLogs(prev => [audit, ...prev]);
    return true;
  };

  const handleAddEmployee = (emp: Omit<Employee, 'id'>) => {
    const created: Employee = { ...emp, id: `emp-${Date.now()}` };
    setEmployees(prev => [...prev, created]);
    addAuditLog('EMPLOYEES', 'CREATE', `إضافة موظف جديد: ${created.code}`);
  };

  const handleUpdateEmployee = (id: string, updates: Partial<Employee>) => {
    const current = employees.find(item => item.id === id);
    if (current && performControlAccountRelink('EMPLOYEE', current, updates, employees, K.employees, setEmployees, 'EMPLOYEES')) return;
    const before = current;
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const audit = createAuditLog('EMPLOYEES', 'UPDATE', `تعديل بيانات الموظف رقم ${id}`, undefined, before, before ? { ...before, ...updates } : undefined);
    setAuditLogs(prev => [audit, ...prev]);
  };

  const handleDeleteEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    const decision = entityRemovalDecision('EMPLOYEE', id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    setEmployees(prev => decision.action === 'ARCHIVE' ? prev.map(e => e.id === id ? { ...e, isActive: false } : e) : prev.filter(e => e.id !== id));
    addAuditLog('EMPLOYEES', decision.action === 'ARCHIVE' ? 'UPDATE' : 'DELETE', `${decision.action === 'ARCHIVE' ? 'أرشفة' : 'حذف'} الموظف ${emp.code}${decision.reasons.length ? `: ${decision.reasons.join('، ')}` : ''}`);
  };

  const handleAddCustomer = (cus: Omit<Customer, 'id'>) => {
    const created: Customer = { ...cus, id: `cus-${Date.now()}` };
    setCustomers(prev => [...prev, created]);
    addAuditLog('CUSTOMERS', 'CREATE', `إضافة عميل جديد: ${created.code}`);
  };

  const handleUpdateCustomer = (id: string, updates: Partial<Customer>) => {
    const current = customers.find(item => item.id === id);
    if (current && performControlAccountRelink('CUSTOMER', current, updates, customers, K.customers, setCustomers, 'CUSTOMERS')) return;
    const before = current;
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const audit = createAuditLog('CUSTOMERS', 'UPDATE', `تعديل بيانات العميل رقم ${id}`, undefined, before, before ? { ...before, ...updates } : undefined);
    setAuditLogs(prev => [audit, ...prev]);
  };

  const handleDeleteCustomer = (id: string) => {
    const cus = customers.find(c => c.id === id);
    if (!cus) return;
    const decision = entityRemovalDecision('CUSTOMER', id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    setCustomers(prev => decision.action === 'ARCHIVE' ? prev.map(c => c.id === id ? { ...c, isActive: false } : c) : prev.filter(c => c.id !== id));
    addAuditLog('CUSTOMERS', decision.action === 'ARCHIVE' ? 'UPDATE' : 'DELETE', `${decision.action === 'ARCHIVE' ? 'أرشفة' : 'حذف'} العميل ${cus.code}${decision.reasons.length ? `: ${decision.reasons.join('، ')}` : ''}`);
  };

  const handleAddVendor = (ven: Omit<Vendor, 'id'>) => {
    const created: Vendor = { ...ven, id: `sup-${Date.now()}` };
    setVendors(prev => [...prev, created]);
    addAuditLog('VENDORS', 'CREATE', `إضافة مورد جديد: ${created.code}`);
  };

  const handleUpdateVendor = (id: string, updates: Partial<Vendor>) => {
    const current = vendors.find(item => item.id === id);
    if (current && performControlAccountRelink('VENDOR', current, updates, vendors, K.vendors, setVendors, 'VENDORS')) return;
    const before = current;
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    const audit = createAuditLog('VENDORS', 'UPDATE', `تعديل بيانات المورد رقم ${id}`, undefined, before, before ? { ...before, ...updates } : undefined);
    setAuditLogs(prev => [audit, ...prev]);
  };

  const handleDeleteVendor = (id: string) => {
    const ven = vendors.find(v => v.id === id);
    if (!ven) return;
    const decision = entityRemovalDecision('VENDOR', id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    setVendors(prev => decision.action === 'ARCHIVE' ? prev.map(v => v.id === id ? { ...v, isActive: false } : v) : prev.filter(v => v.id !== id));
    addAuditLog('VENDORS', decision.action === 'ARCHIVE' ? 'UPDATE' : 'DELETE', `${decision.action === 'ARCHIVE' ? 'أرشفة' : 'حذف'} المورد ${ven.code}${decision.reasons.length ? `: ${decision.reasons.join('، ')}` : ''}`);
  };

  const handleAddCostCenter = (cc: Omit<CostCenter, 'id'>) => {
    const created: CostCenter = { ...cc, id: `cc-${Date.now()}` };
    setCostCenters(prev => [...prev, created]);
    addAuditLog('COST_CENTERS', 'CREATE', `إضافة مركز تكلفة جديد: ${created.code}`);
  };

  const handleUpdateCostCenter = (id: string, updates: Partial<CostCenter>) => {
    setCostCenters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    addAuditLog('COST_CENTERS', 'UPDATE', `تعديل بيانات مركز التكلفة رقم ${id}`);
  };

  const handleDeleteCostCenter = (id: string) => {
    const cc = costCenters.find(c => c.id === id);
    if (!cc) return;
    const decision = costCenterRemovalDecision(id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    if (decision.action === 'BLOCK') {
      addAuditLog('COST_CENTERS', 'DELETE', `رُفض حذف مركز التكلفة ${cc.code}: ${decision.reasons.join('، ')}`);
      return;
    }
    setCostCenters(prev => prev.filter(c => c.id !== id));
    addAuditLog('COST_CENTERS', 'DELETE', `حذف مركز التكلفة غير المستخدم: ${cc.code}`);
  };

  const handleAddCurrency = (currency: Omit<Currency, 'id' | 'createdAt'>) => {
    const created: Currency = { ...currency, id: `cur-${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] };
    setCurrencies(prev => (created.isBase ? [...prev.map(c => ({ ...c, isBase: false })), created] : [...prev, created]));
    addAuditLog('CURRENCIES', 'CREATE', `إضافة عملة جديدة: ${created.code}`);
  };

  const handleUpdateCurrency = (id: string, updates: Partial<Currency>) => {
    setCurrencies(prev => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      if (target.isBase && updates.isBase === false) return prev.map(c => c.id === id ? { ...c, ...updates, isBase: true } : c);
      if (updates.isBase === true) return prev.map(c => c.id === id ? { ...c, ...updates, exchangeRate: 1 } : { ...c, isBase: false });
      return prev.map(c => c.id === id ? { ...c, ...updates } : c);
    });
    addAuditLog('CURRENCIES', 'UPDATE', `تعديل بيانات العملة رقم ${id}`);
  };

  const handleDeleteCurrency = (id: string) => {
    const cur = currencies.find(c => c.id === id);
    if (!cur) return;
    const decision = currencyRemovalDecision(id, { accounts, costCenters, journals, trusts, custodies, cashBoxes, bankAccounts, vouchers, receipts: receiptVouchers, employees, customers, vendors, currencies });
    if (decision.action === 'BLOCK') {
      addAuditLog('CURRENCIES', 'DELETE', `رُفض حذف العملة ${cur.code}: ${decision.reasons.join('، ')}`);
      return;
    }
    setCurrencies(prev => decision.action === 'ARCHIVE' ? prev.map(c => c.id === id ? { ...c, isActive: false } : c) : prev.filter(c => c.id !== id));
    addAuditLog('CURRENCIES', decision.action === 'ARCHIVE' ? 'UPDATE' : 'DELETE', `${decision.action === 'ARCHIVE' ? 'أرشفة' : 'حذف'} العملة ${cur.code}${decision.reasons.length ? `: ${decision.reasons.join('، ')}` : ''}`);
  };

  if (!isBooted) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center relative overflow-hidden">
        <div className="relative flex flex-col items-center gap-5 animate-scale-in">
          <div className="relative">
            <div className="relative w-20 h-20 bg-gradient-to-br from-sky-500/20 to-blue-500/20 text-sky-600 rounded-3xl flex items-center justify-center border border-white/20">
              <span className="text-4xl font-black text-white">ن</span>
            </div>
          </div>
          <div className="w-10 h-10 border-2 border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-semibold">جاري تهيئة النظام...</p>
          <p className="text-slate-600 text-xs">نظام المحاسبة الإلكتروني</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} fiscalYears={availableReportingYears} defaultFiscalYear={reportingYear} />;
  }

  const openTrustCount = trusts.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').length;

  const renderModule = (module: ERPModule): React.ReactNode => {
    if (!allowedModules.includes(module)) return null;
    switch (module) {
      case 'HOME':
        return <HomePageView onNavigate={navigate} />;
      case 'OPERATIONS':
        return (
          <OperationsView
            journals={journals}
            vouchers={vouchers}
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            costCenters={costCenters}
            currencies={currencies}
            currentUserName={currentUserName}
            onNavigate={navigate}
          />
        );
      case 'PAYMENT_VOUCHERS':
        return (
          <PaymentVouchersView
            vouchers={vouchers}
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            employees={employees}
            customers={customers}
            vendors={vendors}
            costCenters={costCenters}
            journals={journals}
            currencies={currencies}
            onAddVoucher={handleAddVoucher}
            onUpdateVoucher={handleUpdateVoucher}
            onVoidVoucher={handleVoidVoucher}
            onRestoreVoucher={handleRestoreVoucher}
            currentUserName={currentUserName}
            closedYears={closedYears}
            closedMonths={closedMonths}
            canOverrideExchangeLimits={canOverrideExchangeLimits}
            onAuditLog={details => auditRateOverride('PAYMENT_VOUCHERS', details)}
          />
        );
      case 'RECEIPT_VOUCHERS':
        return (
          <ReceiptVouchersWindow
            receipts={receiptVouchers}
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            costCenters={costCenters}
            journals={journals}
            currencies={currencies}
            employees={employees}
            customers={customers}
            vendors={vendors}
            onAddReceipt={handleAddReceiptVoucher}
            onUpdateReceipt={handleUpdateReceiptVoucher}
            onVoidReceipt={handleVoidReceiptVoucher}
            onRestoreReceipt={handleRestoreReceiptVoucher}
            onPostPending={handlePostPendingReceipt}
            currentUserName={currentUserName}
            closedYears={closedYears}
            closedMonths={closedMonths}
            canOverrideExchangeLimits={canOverrideExchangeLimits}
            onAuditLog={details => auditRateOverride('RECEIPT_VOUCHERS', details)}
            onClose={() => requestCloseTab(tabIdFor('RECEIPT_VOUCHERS'))}
          />
        );
      case 'INPUTS':
        return (
          <InputsView
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            employees={employees}
            customers={customers}
            vendors={vendors}
            costCenters={costCenters}
            currencies={currencies}
            onNavigate={navigate}
          />
        );
      case 'DASHBOARD':
        return (
          <DashboardView
            accounts={accounts}
            journals={journals}
            currencies={currencies}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            paymentVouchers={vouchers}
            receiptVouchers={receiptVouchers}
            onNavigate={(mod) => navigate(mod as ERPModule)}
            theme={theme}
          />
        );
      case 'JOURNAL_ENTRIES':
        return (
          <JournalEntriesView
            journals={journals}
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            employees={employees}
            customers={customers}
            vendors={vendors}
            costCenters={costCenters}
            currencies={currencies}
            onAddJournal={handleAddJournal}
            onUpdateJournal={handleUpdateJournal}
            onVoidJournal={handleVoidJournal}
            onRestoreJournal={handleRestoreJournal}
            currentUserName={currentUserName}
            closedYears={closedYears}
            closedMonths={closedMonths}
            canOverrideExchangeLimits={canOverrideExchangeLimits}
            onAuditLog={details => auditRateOverride('GENERAL_LEDGER', details)}
          />
        );
      case 'CHART_OF_ACCOUNTS':
        return (
          <ChartOfAccountsView
            accounts={accounts}
            journals={journals}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            employees={employees}
            customers={customers}
            vendors={vendors}
            currencies={currencies}
            onAddAccount={handleAddAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        );
      case 'OPENING_BALANCES':
        return (
          <OpeningBalancesView
            currentUserName={currentUserName}
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            employees={employees}
            customers={customers}
            vendors={vendors}
            currencies={currencies}
            status={openingBalancesStatus}
            onSaveDraft={handleSaveDraftOpeningBalances}
            onPost={handlePostOpeningBalances}
          />
        );
      case 'CASH_BOXES':
        return (
          <CashBoxesView
            cashBoxes={cashBoxes}
            accounts={accounts}
            journals={journals}
            currencies={currencies}
            onAddCashBox={handleAddCashBox}
            onUpdateCashBox={handleUpdateCashBox}
            onDeleteCashBox={handleDeleteCashBox}
          />
        );
      case 'BANK_ACCOUNTS':
        return (
          <BankAccountsView
            bankAccounts={bankAccounts}
            accounts={accounts}
            journals={journals}
            currencies={currencies}
            onAddBank={handleAddBank}
            onUpdateBank={handleUpdateBank}
            onDeleteBank={handleDeleteBank}
          />
        );
      case 'TRUSTS':
        return (
          <TrustsView
            trusts={trusts}
            accounts={accounts}
            journals={journals}
            employees={employees}
            onAddTrust={handleAddTrust}
            onUpdateTrust={handleUpdateTrust}
            onAddJournal={handleAddJournal}
            currentUserName={currentUserName}
            closedYears={closedYears}
          />
        );
      case 'CUSTODY':
        return (
          <CustodyView
            custodies={custodies}
            accounts={accounts}
            journals={journals}
            employees={employees}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            vendors={vendors}
            costCenters={costCenters}
            currencies={currencies}
            onAddCustody={handleAddCustody}
            onUpdateCustody={handleUpdateCustody}
            onAddJournal={handleAddJournal}
            currentUserName={currentUserName}
            closedYears={closedYears}
          />
        );
      case 'EMPLOYEES':
        return (
          <EmployeesView
            employees={employees}
            trusts={trusts}
            accounts={accounts}
            journals={journals}
            currencies={currencies}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
          />
        );
      case 'CUSTOMERS':
        return (
          <CustomersView
            customers={customers}
            accounts={accounts}
            journals={journals}
            currencies={currencies}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        );
      case 'VENDORS':
        return (
          <VendorsView
            vendors={vendors}
            accounts={accounts}
            journals={journals}
            currencies={currencies}
            onAddVendor={handleAddVendor}
            onUpdateVendor={handleUpdateVendor}
            onDeleteVendor={handleDeleteVendor}
          />
        );
      case 'COST_CENTERS':
        return (
          <CostCentersView
            costCenters={costCenters}
            journals={journals}
            onAddCostCenter={handleAddCostCenter}
            onUpdateCostCenter={handleUpdateCostCenter}
            onDeleteCostCenter={handleDeleteCostCenter}
          />
        );
      case 'CURRENCIES':
        return (
          <CurrenciesView
            currencies={currencies}
            accounts={accounts}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            journals={journals}
            onAddCurrency={handleAddCurrency}
            onUpdateCurrency={handleUpdateCurrency}
            onDeleteCurrency={handleDeleteCurrency}
          />
        );
      case 'REPORTS':
        return (
          <FinancialReportsView
            accounts={accounts}
            journals={journals}
            costCenters={costCenters}
            currentUserName={currentUserName}
            currencies={currencies}
            employees={employees}
            customers={customers}
            vendors={vendors}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            trusts={trusts}
            custodies={custodies}
            vouchers={vouchers}
            receiptVouchers={receiptVouchers}
            fiscalYear={reportingYear}
          />
        );
      case 'STATEMENT_ACCOUNT':
        return (
          <StatementOfAccountView
            accounts={accounts}
            journals={journals}
            vouchers={vouchers}
            receiptVouchers={receiptVouchers}
            employees={employees}
            customers={customers}
            vendors={vendors}
            cashBoxes={cashBoxes}
            bankAccounts={bankAccounts}
            currencies={currencies}
            currentUserName={currentUserName}
            fiscalYear={reportingYear}
            initialKind={statementNavParams?.kind}
            initialId={statementNavParams?.id}
            onParamsConsumed={() => setStatementNavParams(null)}
          />
        );
      case 'CLOSING':
        return (
          <ClosingView
            accounts={accounts}
            journals={journals}
            auditLogs={auditLogs}
            vouchers={vouchers}
            receipts={receiptVouchers}
            closedYears={closedYears}
            closedMonths={closedMonths}
            periodStates={periodStates}
            currencies={currencies}
            onCloseYear={handleCloseYear}
            onReopenYear={handleReopenYear}
            onCloseMonth={handleCloseMonth}
            onReopenMonth={handleReopenMonth}
            onBatchPost={handleDailyBatchPost}
            onUnpostJournal={handleUnpostJournal}
            onUnpostVoucher={handleUnpostVoucher}
            onCreateOpeningEntry={handleCreateOpeningEntry}
            onCreateRevaluationJournal={handleAddJournal}
            currentUserName={currentUserName}
          />
        );
      case 'CONTRACTS':
        return (
          <ContractsView
            contracts={contracts}
            customers={customers}
            vendors={vendors}
            accounts={accounts}
            costCenters={costCenters}
            currencies={currencies}
            paymentVouchers={vouchers}
            receiptVouchers={receiptVouchers}
            currentUserName={currentUserName}
            onChange={handleContractsChange}
          />
        );
      case 'AUDIT_SECURITY':
        return <AuditAndSecurityView auditLogs={auditLogs} />;
      case 'SETTINGS':
        return <SettingsView currentUserName={currentUserName} currencies={currencies} onPasswordChanged={() => addAuditLog('SETTINGS', 'UPDATE', `تم تغيير كلمة مرور المستخدم: ${currentUserName}`)} />;
      case 'ABOUT':
        return <AboutUs />;
      default:
        return null;
    }
  };

  return (
    <div dir={dir} className={`min-h-screen bg-transparent ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'} font-sans antialiased ${dir === 'rtl' ? 'dir-rtl' : ''} selection:bg-sky-500/15 selection:text-white`}>
      <GlobalEnterNav />
      <TableCollapseController />
      <div className="relative z-10 h-screen flex flex-col overflow-hidden">
        <Navbar
          user={currentUser}
          onLogout={handleLogout}
          onNavigate={navigate}
          notificationCount={openTrustCount}
          theme={theme}
          toggleTheme={toggleTheme}
          showRefreshButton={(() => { try { const s = JSON.parse(getPersistentItem('elite-erp-settings-v6') || '{}'); return s.showRefreshButton !== false; } catch { return true; } })()}
          allowedModules={allowedModules}
          searchData={{
            accounts,
            journals,
            vouchers,
            receipts: receiptVouchers,
            customers,
            vendors,
            employees,
            trusts,
            cashBoxes,
            bankAccounts,
            currencies,
            costCenters
          }}
        />

        <div className="flex flex-1 min-h-0">
          <Sidebar
            activeModule={activeModule}
            setActiveModule={navigate}
            allowedModules={allowedModules}
          />

          <main data-enter-scope="" className="flex-1 min-w-0 flex flex-col min-h-0">
            <WorkspaceTabBar />
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <TabKeepAliveContainer renderModule={renderModule} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const yearOf = (date: string): string => date.slice(0, 4);

export default function App() {
  return (
    <ToastProvider>
      <RateViolationToastBridge />
      <StorageConflictToastBridge />
      <LanguageProvider>
        <ModalStackProvider>
          <TabsProvider>
            <AppInner />
          </TabsProvider>
        </ModalStackProvider>
      </LanguageProvider>
    </ToastProvider>
  );
}
