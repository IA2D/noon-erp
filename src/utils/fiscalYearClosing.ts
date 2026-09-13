import type { Account, BankAccount, CashBox, Customer, Employee, JournalEntry, JournalLine, OpeningBalanceRecord, Vendor } from '../types/erp';
import { accountFinancialType, isPostingAccount } from './accountingEngine';
import { dedupeOpeningBalanceRecords, reconcileControlAccountOpenings } from '../services/openingBalancesService';

type Entity = (CashBox | BankAccount | Customer | Vendor | Employee) & { linkedAccountId?: string };
type Input = {
  accounts: Account[];
  journals: JournalEntry[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  customers: Customer[];
  vendors: Vendor[];
  employees: Employee[];
  sourceYear: string;
  targetYear: string;
  baseCurrency: string;
};

type Bucket = {
  accountId: string;
  subLedgerId?: string;
  costCenterId?: string;
  currency: string;
  local: number;
  foreign: number;
  lastRate: number;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const keyOf = (accountId: string, subLedgerId: string | undefined, costCenterId: string | undefined, currency: string) =>
  [accountId, subLedgerId || '', costCenterId || '', currency].join('\u001f');

/** Every account below the income-statement roots is year-local and must not be rolled forward. */
export function incomeStatementAccountIds(accounts: Account[]): Set<string> {
  const excluded = new Set<string>();
  accounts.forEach(account => {
    const type = accountFinancialType(account, accounts);
    const rootDigit = String(account.code || '').replace(/\D/g, '').charAt(0);
    if (rootDigit === '3' || rootDigit === '4' || type === 'REVENUE' || type === 'EXPENSE') excluded.add(account.id);
  });
  // Defensive ancestry pass for imported charts whose financial type metadata is incomplete.
  let changed = true;
  while (changed) {
    changed = false;
    accounts.forEach(account => {
      if (!excluded.has(account.id) && account.parentId && excluded.has(account.parentId)) {
        excluded.add(account.id);
        changed = true;
      }
    });
  }
  return excluded;
}

function recordAmount(record: OpeningBalanceRecord, baseCurrency: string) {
  const local = Number(record.debitLocal || 0) - Number(record.creditLocal || 0);
  const foreignStored = Number(record.debit || 0) - Number(record.credit || 0);
  const fallback = Number(record.foreignAmount ?? 0);
  const foreign = record.currency === baseCurrency ? local : (foreignStored || fallback);
  return { local, foreign, rate: Number(record.rate || record.exchangeRate || 1) };
}

function lineAmount(line: JournalLine, journal: JournalEntry, baseCurrency: string) {
  const local = Number(line.debit || 0) - Number(line.credit || 0);
  const currency = line.currency || journal.currency || baseCurrency;
  const stored = Number(line.debitForeign || 0) - Number(line.creditForeign || 0);
  const rate = Number(line.exchangeRate || journal.exchangeRate || 1);
  const foreign = currency === baseCurrency ? local : (stored || (rate > 0 ? local / rate : 0));
  return { local, foreign, currency, rate };
}

/** Produces one independent opening snapshot by account, analytical entity, currency, and cost center. */
export function buildFiscalYearOpeningSnapshot(input: Input) {
  const { sourceYear, targetYear, baseCurrency } = input;
  const excludedAccountIds = incomeStatementAccountIds(input.accounts);
  const allEntities: Entity[] = [...input.cashBoxes, ...input.bankAccounts, ...input.customers, ...input.vendors, ...input.employees]
    .filter(entity => !entity.linkedAccountId || !excludedAccountIds.has(entity.linkedAccountId));
  const entitiesByAccount = new Map<string, Entity[]>();
  allEntities.forEach(entity => {
    if (!entity.linkedAccountId) return;
    const list = entitiesByAccount.get(entity.linkedAccountId) || [];
    list.push(entity);
    entitiesByAccount.set(entity.linkedAccountId, list);
  });
  const buckets = new Map<string, Bucket>();
  const add = (accountId: string, subLedgerId: string | undefined, costCenterId: string | undefined, currency: string, local: number, foreign: number, rate: number) => {
    const key = keyOf(accountId, subLedgerId, costCenterId, currency);
    const bucket = buckets.get(key) || { accountId, subLedgerId, costCenterId, currency, local: 0, foreign: 0, lastRate: rate || 1 };
    bucket.local += local;
    bucket.foreign += foreign;
    if (rate > 0) bucket.lastRate = rate;
    buckets.set(key, bucket);
  };

  input.accounts.filter(isPostingAccount).forEach(account => {
    const entities = entitiesByAccount.get(account.id) || [];
    const analyticalRows = entities.flatMap(entity => dedupeOpeningBalanceRecords((entity.openingBalances || []).filter(row => row.fiscalYear === sourceYear)));
    const accountRows = dedupeOpeningBalanceRecords((account.openingBalances || []).filter(row => row.fiscalYear === sourceYear || (!row.fiscalYear && sourceYear === input.sourceYear)));
    const rows = entities.length && analyticalRows.length ? [] : accountRows;
    rows.forEach(record => {
      const amount = recordAmount(record, baseCurrency);
      add(account.id, record.subAccountId, record.costCenterId, record.currency || baseCurrency, amount.local, amount.foreign, amount.rate);
    });
    if (!account.openingBalances && Math.abs(account.openingBalance || 0) >= 0.005) {
      const local = Number(account.openingBalance || 0);
      const currency = account.openingCurrency || account.defaultCurrency || baseCurrency;
      const rate = Number(account.openingRate || 1);
      const foreign = currency === baseCurrency ? local : Number(account.openingBalanceForeign || (rate > 0 ? local / rate : 0));
      add(account.id, undefined, undefined, currency, local, foreign, rate);
    }
  });
  allEntities.forEach(entity => {
    if (!entity.linkedAccountId) return;
    const rows = dedupeOpeningBalanceRecords((entity.openingBalances || []).filter(record => record.fiscalYear === sourceYear || (!record.fiscalYear && sourceYear === input.sourceYear)));
    rows.forEach(record => {
      const amount = recordAmount(record, baseCurrency);
      add(entity.linkedAccountId!, entity.id, record.costCenterId, record.currency || entity.defaultCurrency || baseCurrency, amount.local, amount.foreign, amount.rate);
    });
    if (!entity.openingBalances && Math.abs(entity.openingBalance || 0) >= 0.005) {
      const local = Number(entity.openingBalance || 0);
      const currency = entity.openingCurrency || entity.defaultCurrency || baseCurrency;
      const rate = Number(entity.openingRate || 1);
      const foreign = currency === baseCurrency ? local : Number(entity.openingBalanceForeign || (rate > 0 ? local / rate : 0));
      add(entity.linkedAccountId, entity.id, undefined, currency, local, foreign, rate);
    }
  });
  input.journals
    .filter(journal => journal.status === 'POSTED' && journal.affectsLedger !== false && journal.date.startsWith(`${sourceYear}-`))
    .forEach(journal => journal.lines.forEach(line => {
      const amount = lineAmount(line, journal, baseCurrency);
      add(line.accountId, line.subLedgerId, line.costCenterId, amount.currency, amount.local, amount.foreign, amount.rate);
    }));

  let records = [...buckets.values()].filter(bucket => Math.abs(bucket.local) >= 0.005 || Math.abs(bucket.foreign) >= 0.005);
  records = records.filter(record => !excludedAccountIds.has(record.accountId));
  const localNet = round(records.reduce((sum, record) => sum + record.local, 0));
  if (Math.abs(localNet) >= 0.005) {
    const retained = input.accounts.find(account => account.code === '2202010001' && isPostingAccount(account))
      || input.accounts.find(account => account.nameAr.includes('أرباح مبقاة') && isPostingAccount(account));
    if (!retained) throw new Error(`ROLLOVER_UNBALANCED_WITHOUT_RETAINED_ACCOUNT:${localNet}`);
    records.push({ accountId: retained.id, currency: baseCurrency, local: -localNet, foreign: -localNet, lastRate: 1 });
  }

  const openings: OpeningBalanceRecord[] = records.map((bucket, index) => {
    const local = round(bucket.local);
    const foreign = round(bucket.foreign);
    const exchangeRate = bucket.currency === baseCurrency ? 1 : Math.abs(foreign) >= 0.005 ? Math.abs(local / foreign) : bucket.lastRate;
    return {
      id: `rollover-opening-${targetYear}-${index + 1}`,
      fiscalYear: targetYear,
      accountId: bucket.accountId,
      subAccountId: bucket.subLedgerId,
      costCenterId: bucket.costCenterId,
      currency: bucket.currency,
      exchangeRate,
      debit: foreign > 0 ? foreign : 0,
      credit: foreign < 0 ? Math.abs(foreign) : 0,
      debitLocal: local > 0 ? local : 0,
      creditLocal: local < 0 ? Math.abs(local) : 0,
      amount: local,
      foreignAmount: foreign,
      rate: exchangeRate,
      documentRef: `CARRY-${sourceYear}-${targetYear}`,
    };
  });
  const byEntity = new Map<string, OpeningBalanceRecord[]>();
  openings.filter(record => record.subAccountId).forEach(record => {
    const list = byEntity.get(record.subAccountId!) || [];
    list.push(record);
    byEntity.set(record.subAccountId!, list);
  });
  const updateEntities = <T extends Entity>(items: T[]): T[] => items.map(item => {
    const entityOpenings = byEntity.get(item.id) || [];
    const openingBalance = round(entityOpenings.reduce((sum, record) => sum + Number(record.amount || 0), 0));
    const foreign = entityOpenings.find(record => record.currency !== baseCurrency);
    return { ...item, openingBalances: entityOpenings, openingBalance, openingBalanceForeign: foreign?.foreignAmount, openingCurrency: foreign?.currency, openingRate: foreign?.rate, fiscalYear: targetYear };
  });
  const cashBoxes = updateEntities(input.cashBoxes.filter(item => !item.linkedAccountId || !excludedAccountIds.has(item.linkedAccountId)));
  const bankAccounts = updateEntities(input.bankAccounts.filter(item => !item.linkedAccountId || !excludedAccountIds.has(item.linkedAccountId)));
  const customers = updateEntities(input.customers.filter(item => !item.linkedAccountId || !excludedAccountIds.has(item.linkedAccountId)));
  const vendors = updateEntities(input.vendors.filter(item => !item.linkedAccountId || !excludedAccountIds.has(item.linkedAccountId)));
  const employees = updateEntities(input.employees.filter(item => !item.linkedAccountId || !excludedAccountIds.has(item.linkedAccountId)));
  const ownByAccount = new Map<string, OpeningBalanceRecord[]>();
  openings.filter(record => !record.subAccountId).forEach(record => {
    const list = ownByAccount.get(record.accountId) || [];
    list.push(record);
    ownByAccount.set(record.accountId, list);
  });
  let accounts: Account[] = input.accounts.filter(account => !excludedAccountIds.has(account.id)).map(account => {
    const own = ownByAccount.get(account.id) || [];
    return { ...account, openingBalances: own, openingBalance: round(own.reduce((sum, record) => sum + Number(record.amount || 0), 0)), fiscalYear: targetYear };
  });
  accounts = reconcileControlAccountOpenings({ accounts, cashBoxes, bankAccounts, customers, vendors, employees }, targetYear).accounts;
  return { accounts, cashBoxes, bankAccounts, customers, vendors, employees, openings, excludedAccountIds };
}
