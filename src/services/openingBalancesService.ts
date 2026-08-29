import type { Account, BankAccount, CashBox, Customer, Employee, Vendor, OpeningBalanceRecord } from '../types/erp';
import type { AccountSaveEntry, RowState, SavePayload, SubLedgerKind, SubLedgerSaveEntry } from '../components/modules/opening/types';
import { round2, localOf, zeroRow, compositeKey } from '../components/modules/opening/types';

export const generateId = (): string => crypto.randomUUID();

/** جلب الحسابات التشغيلية القابلة للترحيل: المستوى 5 النشط، مرتبة رقمياً */
export function selectPostingAccounts(accounts: Account[]): Account[] {
  return accounts
    .filter(a => a.level === 5 && a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

export interface LinkedEntity {
  kind: SubLedgerKind;
  id: string;
  code: string;
  nameAr: string;
  linkedAccountId: string;
  defaultCurrency: string;
  openingBalance?: number;
  openingBalanceForeign?: number;
  openingRate?: number;
  openingCurrency?: string;
  openingDocumentRef?: string;
  openingDueDate?: string;
  openingBalances?: OpeningBalanceRecord[];
}

interface EntitySource {
  id: string;
  code: string;
  defaultCurrency: string;
  linkedAccountId?: string;
  openingBalance?: number;
  openingBalanceForeign?: number;
  openingRate?: number;
  openingCurrency?: string;
  openingDocumentRef?: string;
  openingDueDate?: string;
  openingBalances?: OpeningBalanceRecord[];
}

export interface LinkedEntitiesInput {
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  customers: Customer[];
  vendors: Vendor[];
  employees: Employee[];
  baseCode: string;
}

/** بناء قائمة الكيانات المساعدة المرتبطة بحسابات التحكم (المستوى 5 فقط) */
export function buildLinkedEntities(input: LinkedEntitiesInput): LinkedEntity[] {
  const { accounts, cashBoxes, bankAccounts, customers, vendors, employees, baseCode } = input;
  const accById = new Map(accounts.map(a => [a.id, a]));
  const out: LinkedEntity[] = [];

  const push = (kind: SubLedgerKind, e: EntitySource, nameAr: string) => {
    if (!e.linkedAccountId) return;
    const acc = accById.get(e.linkedAccountId);
    if (!acc || acc.level !== 5) return;
    out.push({
      kind,
      id: e.id,
      code: e.code,
      nameAr,
      linkedAccountId: e.linkedAccountId,
      defaultCurrency: e.defaultCurrency || baseCode,
      openingBalance: e.openingBalance,
      openingBalanceForeign: e.openingBalanceForeign,
      openingRate: e.openingRate,
      openingCurrency: e.openingCurrency,
      openingDocumentRef: e.openingDocumentRef,
      openingDueDate: e.openingDueDate,
      openingBalances: e.openingBalances,
    });
  };

  cashBoxes.forEach(b => push('CASH_BOX', b, b.nameAr));
  bankAccounts.forEach(b => push('BANK', b, b.bankNameAr));
  customers.forEach(b => push('CUSTOMER', b, b.nameAr));
  vendors.forEach(b => push('VENDOR', b, b.nameAr));
  employees.forEach(b => push('EMPLOYEE', b, b.nameAr));
  return out;
}

export interface BuildPayloadInput {
  postingAccounts: Account[];
  subLedgerEntities: Array<{ kind: SubLedgerKind; id: string; linkedAccountId: string; row: RowState; rowId: string }>;
  baseCode: string;
  rateOf: (code: string) => number;
  rowOfAccount: (a: Account) => RowState;
  subLedgerTotals: Record<string, RowState>;
  isControl: (accountId: string) => boolean;
}

export function buildOpeningBalancesPayload(input: BuildPayloadInput): SavePayload {
  const { postingAccounts, subLedgerEntities, baseCode, rateOf, rowOfAccount, subLedgerTotals, isControl } = input;

  const accounts = postingAccounts.map(a => {
    const ctrl = isControl(a.id);
    const r = ctrl ? subLedgerTotals[a.id] || zeroRow(baseCode, 1) : rowOfAccount(a);
    const local = localOf(r, baseCode, rateOf);
    const rate = ctrl ? 1 : r.rate > 0 ? r.rate : rateOf(r.currency);
    const foreignDebit = ctrl ? 0 : (r.debitForeign || 0);
    const foreignCredit = ctrl ? 0 : (r.creditForeign || 0);
    return {
      id: a.id,
      rowId: generateId(),
      openingBalance: round2(local.debit - local.credit),
      openingBalanceForeign: round2(foreignDebit - foreignCredit),
      debit: ctrl ? 0 : foreignDebit,
      credit: ctrl ? 0 : foreignCredit,
      debitLocal: round2(local.debit),
      creditLocal: round2(local.credit),
      currency: ctrl ? baseCode : r.currency,
      rate,
      documentRef: r.documentRef,
      dueDate: r.dueDate,
    };
  });

  const subLedgers: SavePayload['subLedgers'] = subLedgerEntities.map(e => {
    const local = localOf(e.row, baseCode, rateOf);
    const rate = e.row.rate > 0 ? e.row.rate : rateOf(e.row.currency);
    return {
      kind: e.kind,
      id: e.id,
      rowId: e.rowId,
      linkedAccountId: e.linkedAccountId,
      openingBalance: round2(local.debit - local.credit),
      openingBalanceForeign: round2((e.row.debitForeign || 0) - (e.row.creditForeign || 0)),
      debit: e.row.debitForeign || 0,
      credit: e.row.creditForeign || 0,
      debitLocal: round2(local.debit),
      creditLocal: round2(local.credit),
      currency: e.row.currency,
      rate,
      documentRef: e.row.documentRef,
      dueDate: e.row.dueDate,
    };
  });

  return { accounts, subLedgers };
}

export interface BalanceCollections {
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  customers: Customer[];
  vendors: Vendor[];
  employees: Employee[];
}

export interface ApplyBalancesResult extends BalanceCollections {
  totalDebit: number;
  totalCredit: number;
}

type SubLedgerLike = {
  id: string;
  defaultCurrency?: string;
  openingBalance?: number;
  openingBalanceForeign?: number;
  openingRate?: number;
  openingCurrency?: string;
  openingDocumentRef?: string;
  openingDueDate?: string;
  openingBalances?: OpeningBalanceRecord[];
};

export function applyOpeningBalances(payload: SavePayload, current: BalanceCollections): ApplyBalancesResult {
  const { accounts: entries, subLedgers } = payload;

  const buildRec = (e: AccountSaveEntry, accountId: string, subAccountId?: string): OpeningBalanceRecord => ({
    id: e.rowId,
    accountId,
    subAccountId,
    currency: e.currency,
    exchangeRate: e.rate,
    debit: e.debit,
    credit: e.credit,
    debitLocal: e.debitLocal,
    creditLocal: e.creditLocal,
    amount: round2(e.openingBalance),
    foreignAmount: round2(e.openingBalanceForeign || 0),
    rate: e.rate,
    documentRef: e.documentRef,
    dueDate: e.dueDate,
  });

  const payloadByComposite = new Map<string, OpeningBalanceRecord[]>();
  entries.forEach(e => {
    const k = compositeKey(e.id, null, e.currency);
    const arr = payloadByComposite.get(k) || [];
    arr.push(buildRec(e, e.id));
    payloadByComposite.set(k, arr);
  });
  subLedgers.forEach(e => {
    const k = compositeKey(e.linkedAccountId, e.id, e.currency);
    const arr = payloadByComposite.get(k) || [];
    arr.push(buildRec(e, e.linkedAccountId, e.id));
    payloadByComposite.set(k, arr);
  });

  const accounts = current.accounts.map(a => {
    const allEntries = entries.filter(e => e.id === a.id);
    if (allEntries.length === 0) return a;

    const newRecords: OpeningBalanceRecord[] = allEntries.map(e => buildRec(e, e.id));
    const existing = a.openingBalances || [];
    const payloadKeys = new Set(allEntries.map(e => compositeKey(e.id, null, e.currency)));
    const preserved = existing.filter(r => !payloadKeys.has(compositeKey(r.accountId, null, r.currency)) && r.amount && r.amount !== 0);
    const merged = [...newRecords, ...preserved];

    const totalLocal = merged.reduce((s, r) => s + (r.amount || 0), 0);
    const foreign = merged.find(r => r.currency !== (a.defaultCurrency || 'YER'));

    return {
      ...a,
      openingBalance: round2(totalLocal),
      defaultCurrency: merged[0]?.currency || a.defaultCurrency,
      openingBalanceForeign: foreign ? round2(foreign.foreignAmount || 0) : undefined,
      openingRate: foreign?.rate,
      openingCurrency: foreign?.currency,
      openingDocumentRef: foreign?.documentRef || merged[0]?.documentRef,
      openingDueDate: foreign?.dueDate || merged[0]?.dueDate,
      openingBalances: merged,
    };
  });

  const applySub = <T extends SubLedgerLike>(list: T[]): T[] =>
    list.map(x => {
      const entries = subLedgers.filter(e => e.id === x.id);
      if (entries.length === 0) return x;

      const newRecords: OpeningBalanceRecord[] = entries.map(e => buildRec(e, e.linkedAccountId, e.id));
      const existing = x.openingBalances || [];
      const payloadKeys = new Set(entries.map(e => compositeKey(e.linkedAccountId, e.id, e.currency)));
      const preserved = existing.filter(r => !payloadKeys.has(compositeKey(r.accountId, r.subAccountId || null, r.currency)) && r.amount && r.amount !== 0);
      const merged = [...newRecords, ...preserved];

      const totalLocal = merged.reduce((s, r) => s + (r.amount || 0), 0);
      const foreign = merged.find(r => r.currency !== (x.defaultCurrency || 'YER'));

      return {
        ...x,
        openingBalance: round2(totalLocal),
        defaultCurrency: merged[0]?.currency || x.defaultCurrency,
        openingBalanceForeign: foreign ? round2(foreign.foreignAmount || 0) : undefined,
        openingRate: foreign?.rate,
        openingCurrency: foreign?.currency,
        openingDocumentRef: foreign?.documentRef || merged[0]?.documentRef,
        openingDueDate: foreign?.dueDate || merged[0]?.dueDate,
        openingBalances: merged,
      } as T;
    });

  const cashBoxes = applySub(current.cashBoxes);
  const bankAccounts = applySub(current.bankAccounts);
  const customers = applySub(current.customers);
  const vendors = applySub(current.vendors);
  const employees = applySub(current.employees);

  const totalDebit = [...entries, ...subLedgers].reduce((s, e) => s + e.debitLocal, 0);
  const totalCredit = [...entries, ...subLedgers].reduce((s, e) => s + e.creditLocal, 0);

  return { accounts, cashBoxes, bankAccounts, customers, vendors, employees, totalDebit, totalCredit };
}

/** إزالة الكيانات المكررة بنفس المعرّف فقط. تُحتفظ جميع أرصدة openingBalances كما هي. */
export function cleanupOpeningBalanceDuplicates(c: BalanceCollections): BalanceCollections {
  const uniqueById = <T extends { id: string }>(list: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of list) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
    }
    return out;
  };

  return {
    accounts: uniqueById(c.accounts),
    cashBoxes: uniqueById(c.cashBoxes),
    bankAccounts: uniqueById(c.bankAccounts),
    customers: uniqueById(c.customers),
    vendors: uniqueById(c.vendors),
    employees: uniqueById(c.employees),
  };
}
