import type {
  Account,
  JournalEntry,
  Currency,
  CostCenter,
  Employee,
  Customer,
  Vendor,
  CashBox,
  BankAccount,
  PaymentVoucher,
  ReceiptVoucher,
  Trust,
  Custody,
  AuditLog,
  OpeningBalanceRecord,
} from './erp';

export interface SyncPayload {
  accounts?: Account[];
  currencies?: Currency[];
  costCenters?: CostCenter[];
  journals?: JournalEntry[];
  employees?: Employee[];
  customers?: Customer[];
  vendors?: Vendor[];
  cashBoxes?: CashBox[];
  bankAccounts?: BankAccount[];
  vouchers?: PaymentVoucher[];
  receiptVouchers?: ReceiptVoucher[];
  trusts?: Trust[];
  custodies?: Custody[];
  auditLogs?: AuditLog[];
  closedYears?: string[];
  openingBalances?: OpeningBalanceRecord[];
}

export interface SyncResult {
  ok: boolean;
  ledgerCount: number;
  openingCount: number;
  postedCount: number;
}

export interface LedgerLineRow {
  date: string;
  entryNumber: string;
  voucherNo: string;
  voucherType: string;
  reference: string;
  narration: string;
  description: string;
  debit: number;
  credit: number;
  running: number;
  journalId: string;
  lineId: string;
  accountCode: string;
  accountNameAr: string;
  subLedgerType: string | null;
  subLedgerId: string | null;
  subLedgerName: string | null;
  costCenterId: string | null;
  currencyId: string;
  exchangeRate: number;
  debitLoc: number;
  creditLoc: number;
}

export interface AccountLedger {
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  nature: 'DEBIT' | 'CREDIT';
  level: number;
  opening: number;
  openingDebit: number;
  openingCredit: number;
  totalDebit: number;
  totalCredit: number;
  closing: number;
  closingDebit: number;
  closingCredit: number;
  rows: LedgerLineRow[];
}

export interface LedgerFilters {
  fromDate: string;
  toDate: string;
  accountId?: string;
  branchId?: string;
  subLedgerType?: string;
  subLedgerId?: string;
  costCenterId?: string;
  currencyId?: string;
}

export interface LedgerReport {
  filters: LedgerFilters;
  ledgers: AccountLedger[];
}

export interface TBRow {
  accountId: string;
  code: string;
  name: string;
  nature: 'DEBIT' | 'CREDIT';
  debit: number;
  credit: number;
}

export interface TBGroup {
  key: string;
  labelAr: string;
  labelEn: string;
  rows: TBRow[];
  debit: number;
  credit: number;
}

export interface TrialBalanceResult {
  asOf: string;
  groups: TBGroup[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface JournalReportLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  debit: number;
  credit: number;
  description: string;
  costCenterId: string | null;
  subLedgerType: string | null;
  subLedgerId: string | null;
  subLedgerName: string | null;
}

export interface JournalReportEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  currency: string;
  exchangeRate: number;
  status: string;
  createdBy: string;
  createdAt: string;
  postedBy: string | null;
  postedAt: string | null;
  lines: JournalReportLine[];
}

export interface JournalReport {
  fromDate: string;
  toDate: string;
  entries: JournalReportEntry[];
}

export interface VoucherDetail {
  journalId: string;
  entryNumber: string;
  date: string;
  reference: string;
  narration: string;
  currency: string;
  exchangeRate: number;
  voucherNo: string;
  voucherType: string;
  postedAt: string | null;
  createdBy: string;
  lines: LedgerLineRow[];
  source?: {type: 'PV' | 'RV'; voucher: unknown};
}

export interface ReportMeta {
  accounts: Account[];
  branches: Array<{id: string; code: string; nameAr: string}>;
  subLedgerTypes: Array<{type: string; labelAr: string}>;
  subLedgers: Array<{id: string; subLedgerType: string; code: string; nameAr: string; nameEn: string; linkedAccountId: string | null}>;
  currencies: Currency[];
  costCenters: CostCenter[];
}

/**
 * نتيجة الـ Unified Lookup API للحسابات المساعدة:
 * GET /api/v1/sub-ledgers?type={type}&search={query} → [{ id, code, name, ... }]
 */
export interface SubLedgerLookupItem {
  id: string;
  code: string;
  name: string;              // الاسم الموحّد (عربي) المعروض
  nameAr: string;
  nameEn: string;
  meta?: string;
  linkedAccountId?: string | null;
}
