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

/** بناء قائمة الكيانات التحليلية المرتبطة بحسابات التحكم (المستوى 5 فقط) */
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

  // مصدر الحقيقة لحسابات التحكم هو أرصدة الحسابات التحليلية المرتبطة بها.
  // أعد بناء الرصيد المجمّع بعد تطبيق تفاصيل الكيانات حتى لا تبقى قيمة قديمة
  // في الحساب الرئيسي وتتجاهلها التقارير المالية.
  const reconciled = reconcileControlAccountOpenings({ accounts, cashBoxes, bankAccounts, customers, vendors, employees });
  const totalDebit = [...entries, ...subLedgers].reduce((s, e) => s + e.debitLocal, 0);
  const totalCredit = [...entries, ...subLedgers].reduce((s, e) => s + e.creditLocal, 0);

  return { accounts: reconciled.accounts, cashBoxes, bankAccounts, customers, vendors, employees, totalDebit, totalCredit };
}

export interface ReconciledControlOpenings {
  accounts: Account[];
  changed: boolean;
}

/**
 * يجمع أرصدة الكيانات التحليلية في حساب التحكم الرئيسي المرتبط بها.
 * لا تُعامل قيمة الحساب الرئيسي القديمة كمصدر مستقل حتى لا يُحتسب نفس الرصيد مرتين.
 */
export function reconcileControlAccountOpenings(current: BalanceCollections): ReconciledControlOpenings {
  const allEntities: SubLedgerLike[] = [
    ...current.cashBoxes,
    ...current.bankAccounts,
    ...current.customers,
    ...current.vendors,
    ...current.employees,
  ];
  const entitiesByAccount = new Map<string, SubLedgerLike[]>();
  allEntities.forEach(entity => {
    const linkedAccountId = (entity as SubLedgerLike & { linkedAccountId?: string }).linkedAccountId;
    if (!linkedAccountId) return;
    const list = entitiesByAccount.get(linkedAccountId) || [];
    list.push(entity);
    entitiesByAccount.set(linkedAccountId, list);
  });

  let changed = false;
  const accounts = current.accounts.map(account => {
    const entities = entitiesByAccount.get(account.id);
    if (!entities?.length) return account;
    // لا نمس رصيداً تاريخياً للحساب الرئيسي إن لم يبدأ إدخال أي رصيد تحليلي له بعد.
    const hasAnalyticalOpening = entities.some(entity =>
      Math.abs(entity.openingBalance || 0) > 0 ||
      Math.abs(entity.openingBalanceForeign || 0) > 0 ||
      (entity.openingBalances || []).some(record =>
        Math.abs(record.amount || 0) > 0 || Math.abs(record.foreignAmount || 0) > 0 ||
        Math.abs(record.debit || 0) > 0 || Math.abs(record.credit || 0) > 0 ||
        Math.abs(record.debitLocal || 0) > 0 || Math.abs(record.creditLocal || 0) > 0
      )
    );
    if (!hasAnalyticalOpening) return account;

    const byCurrency = new Map<string, OpeningBalanceRecord[]>();
    entities.forEach(entity => {
      const fallback: OpeningBalanceRecord = {
        id: `aggregate-${entity.id}`,
        accountId: account.id,
        currency: entity.openingCurrency || entity.defaultCurrency || account.defaultCurrency || 'YER',
        exchangeRate: entity.openingRate || 1,
        debit: Math.max(0, entity.openingBalanceForeign || 0),
        credit: Math.max(0, -(entity.openingBalanceForeign || 0)),
        debitLocal: Math.max(0, entity.openingBalance || 0),
        creditLocal: Math.max(0, -(entity.openingBalance || 0)),
        amount: round2(entity.openingBalance || 0),
        foreignAmount: round2(entity.openingBalanceForeign || 0),
        rate: entity.openingRate || 1,
      };
      const records = entity.openingBalances?.length ? entity.openingBalances : [fallback];
      records.forEach(record => {
        const currency = record.currency || account.defaultCurrency || 'YER';
        const list = byCurrency.get(currency) || [];
        list.push(record);
        byCurrency.set(currency, list);
      });
    });

    const openingBalances = Array.from(byCurrency.entries()).map(([currency, records]) => {
      const debit = round2(records.reduce((sum, record) => sum + (record.debit || 0), 0));
      const credit = round2(records.reduce((sum, record) => sum + (record.credit || 0), 0));
      const debitLocal = round2(records.reduce((sum, record) => sum + (record.debitLocal ?? Math.max(0, record.amount || 0)), 0));
      const creditLocal = round2(records.reduce((sum, record) => sum + (record.creditLocal ?? Math.max(0, -(record.amount || 0))), 0));
      const rate = records.find(record => (record.rate || record.exchangeRate || 1) > 0)?.rate || records[0]?.exchangeRate || 1;
      return {
        id: `control-opening-${account.id}-${currency}`,
        accountId: account.id,
        currency,
        exchangeRate: rate,
        debit,
        credit,
        debitLocal,
        creditLocal,
        amount: round2(debitLocal - creditLocal),
        foreignAmount: round2(debit - credit),
        rate,
      } satisfies OpeningBalanceRecord;
    });
    const openingBalance = round2(openingBalances.reduce((sum, record) => sum + (record.amount || 0), 0));
    const foreign = openingBalances.find(record => record.currency !== (account.defaultCurrency || 'YER'));
    const next: Account = {
      ...account,
      openingBalance,
      openingBalances,
      openingBalanceForeign: foreign ? foreign.foreignAmount : undefined,
      openingRate: foreign?.rate,
      openingCurrency: foreign?.currency,
    };
    if (account.openingBalance !== next.openingBalance || JSON.stringify(account.openingBalances || []) !== JSON.stringify(next.openingBalances) || account.openingBalanceForeign !== next.openingBalanceForeign || account.openingCurrency !== next.openingCurrency) changed = true;
    return next;
  });

  return { accounts, changed };
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
