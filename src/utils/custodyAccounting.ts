import type {Account, Custody, CustodySettlementItem, JournalEntry, JournalLine} from '../types/erp';
import {nowStamp, today} from './custodyEngine';

export interface JournalBuildContext {
  journalId: string;
  entryNumber: string;
  currency: string;
  exchangeRate: number;
  /** True when amounts supplied by the custody workflow are in a non-base currency. */
  isForeignCurrency: boolean;
  /** رمز العملة المحلية للنظام. */
  baseCurrency?: string;
  createdBy: string;
  reference: string;
}

const line = (account: Pick<Account, 'id' | 'code' | 'nameAr'>, debit: number, credit: number, description: string, subLedger?: {subLedgerType: NonNullable<JournalLine['subLedgerType']>; subLedgerId: string; subLedgerName: string}): JournalLine => ({
  id: `jl-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  accountId: account.id,
  accountCode: account.code,
  accountNameAr: account.nameAr,
  debit: Math.round(debit * 100) / 100,
  credit: Math.round(credit * 100) / 100,
  description,
  ...(subLedger
    ? {subLedgerType: subLedger.subLedgerType, subLedgerId: subLedger.subLedgerId, subLedgerName: subLedger.subLedgerName}
    : {}),
});

function journal(ctx: JournalBuildContext, narration: string, lines: JournalLine[]): JournalEntry {
  // Custody forms store their amount in the custody currency. Journal lines, however,
  // are always stored in the base/local currency, with the original-currency evidence
  // retained on each line. Without this conversion generated foreign-currency custody
  // journals fail posting validation before the custody itself is updated.
  const rate = Number(ctx.exchangeRate) || 1;
  const normalizedLines = lines.map(item => {
    // Settlement lines can use a currency different from the custody itself.
    // Those lines already carry their local amount and currency evidence.
    if (item.currency) return item;
    const debitForeign = Number(item.debit) || 0;
    const creditForeign = Number(item.credit) || 0;
    if (!ctx.isForeignCurrency) {
      return { ...item, currency: ctx.currency, exchangeRate: rate };
    }
    return {
      ...item,
      currency: ctx.currency,
      exchangeRate: rate,
      debit: Math.round(debitForeign * rate * 100) / 100,
      credit: Math.round(creditForeign * rate * 100) / 100,
      debitForeign,
      creditForeign,
    };
  });
  const totalDebit = Math.round(normalizedLines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(normalizedLines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
  return {
    id: ctx.journalId,
    entryNumber: ctx.entryNumber,
    date: today(),
    reference: ctx.reference,
    narration,
    lines: normalizedLines,
    totalDebit,
    totalCredit,
    currency: ctx.currency,
    exchangeRate: ctx.exchangeRate,
    status: 'POSTED',
    createdBy: ctx.createdBy,
    createdAt: nowStamp(),
    postedBy: ctx.createdBy,
    postedAt: nowStamp(),
  };
}

type SourceSubLedger = { subLedgerType: 'CASH_BOX' | 'BANK' | 'EXCHANGER'; subLedgerId: string; subLedgerName: string };

const subLedgerOf = (c: Custody): {subLedgerType: 'EMPLOYEE'; subLedgerId: string; subLedgerName: string} => ({
  subLedgerType: 'EMPLOYEE',
  subLedgerId: c.employeeId,
  subLedgerName: c.employeeName,
});

export function buildDisbursementJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  advanceAccount: Account,
  sourceAccount: Account
): JournalEntry {
  const partySummary = custody.disbursementParties?.map(party => `${party.name} (${party.amount})`).join('، ');
  const narration = `صرف عهدة ${custody.custodyNumber} — ${custody.title} (${custody.employeeName})${partySummary ? ` — المستفيدون: ${partySummary}` : ''}`;
  return journal(ctx, narration, [
    {...line(advanceAccount, custody.amount, 0, `صرف عهدة ${custody.custodyNumber} — ${custody.title}${partySummary ? ` — ${partySummary}` : ''}`, subLedgerOf(custody)), costCenterId: custody.costCenterId},
    {...line(sourceAccount, 0, custody.amount, `مقابل صرف عهدة ${custody.custodyNumber} لـ ${custody.employeeName}`), ...(custody.disbursementSource ? {subLedgerId: custody.disbursementSource, subLedgerType: custody.disbursementMethod === 'CASH' ? 'CASH_BOX' as const : custody.disbursementMethod === 'EXCHANGE' ? 'EXCHANGER' as const : 'BANK' as const} : {})},
  ]);
}

export function buildSettlementJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  items: CustodySettlementItem[],
  advanceAccount: Account,
  apAccount: Account | null
): JournalEntry {
  const baseCurrency = ctx.baseCurrency || 'YER';
  const custodyRate = Number(ctx.exchangeRate) || 1;
  const remaining = Math.max(0, Math.round((custody.disbursedAmount - custody.settledAmount - custody.refundedAmount - custody.apTransferredAmount) * 100) / 100);
  const expenseTotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const localOf = (item: CustodySettlementItem) => {
    const itemCurrency = item.currency || custody.currency || baseCurrency;
    const itemRate = itemCurrency === baseCurrency ? 1 : (Number(item.exchangeRate) || custodyRate);
    return Number(item.localAmount) || Math.round((Number(item.amount) || 0) * itemRate * 100) / 100;
  };
  const localExpenseTotal = Math.round(items.reduce((sum, item) => sum + localOf(item), 0) * 100) / 100;
  const advanceCredit = Math.min(remaining, expenseTotal);
  const advanceCreditLocal = Math.min(localExpenseTotal, Math.round(advanceCredit * custodyRate * 100) / 100);
  const excess = Math.round((expenseTotal - advanceCredit) * 100) / 100;
  const excessLocal = Math.max(0, Math.round((localExpenseTotal - advanceCreditLocal) * 100) / 100);

  const localizedLine = (account: Pick<Account, 'id' | 'code' | 'nameAr'>, debit: number, credit: number, description: string, currency: string, exchangeRate: number, foreignDebit?: number, foreignCredit?: number, subLedger?: {subLedgerType: NonNullable<JournalLine['subLedgerType']>; subLedgerId: string; subLedgerName: string}) => ({
    ...line(account, debit, credit, description, subLedger),
    currency,
    exchangeRate,
    ...(currency !== baseCurrency ? { debitForeign: foreignDebit || 0, creditForeign: foreignCredit || 0 } : {}),
  });

  const lines: JournalLine[] = [];
  for (const item of items) {
    const itemCurrency = item.currency || custody.currency || baseCurrency;
    const itemRate = itemCurrency === baseCurrency ? 1 : (Number(item.exchangeRate) || 1);
    const itemLocal = localOf(item);
    lines.push(localizedLine(
      {id: item.accountId, code: item.accountCode, nameAr: item.accountNameAr},
      itemLocal,
      0,
      `${item.description}${item.invoiceNumber ? ` (فاتورة ${item.invoiceNumber})` : ''}`,
      itemCurrency,
      itemRate,
      Number(item.amount) || 0,
      0,
      item.subLedgerType && item.subLedgerType !== 'NONE' && item.subLedgerId
        ? { subLedgerType: item.subLedgerType, subLedgerId: item.subLedgerId, subLedgerName: item.subLedgerName || '' }
        : undefined
    ));
    lines[lines.length - 1].costCenterId = item.costCenterId || custody.costCenterId;
    lines[lines.length - 1].referenceNumber = item.referenceNumber;
  }
  lines.push(localizedLine(advanceAccount, 0, advanceCreditLocal, `تصفية عهدة ${custody.custodyNumber} بالمستندات`, custody.currency || baseCurrency, custodyRate, 0, advanceCredit, subLedgerOf(custody)));
  if (excessLocal > 0) {
    lines.push(localizedLine(apAccount ?? advanceAccount, 0, excessLocal, `تجاوز مستندات التصفية الرصيد القائم${apAccount ? ` — مستحق للموظف ${custody.employeeName}` : ''}`, baseCurrency, 1));
  }
  return journal(ctx, `تصفية عهدة ${custody.custodyNumber} — ${custody.title} (${custody.employeeName})`, lines);
}

export function buildRefundJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  amount: number,
  advanceAccount: Account,
  sourceAccount: Account,
  sourceSubLedger?: SourceSubLedger
): JournalEntry {
  const narration = `رد نقدية فائض عهدة ${custody.custodyNumber} (${custody.employeeName})`;
  return journal(ctx, narration, [
    line(sourceAccount, amount, 0, `استلام رد فائض عهدة ${custody.custodyNumber}`, sourceSubLedger),
    line(advanceAccount, 0, amount, `مقابل رد فائض عهدة ${custody.custodyNumber}`, subLedgerOf(custody)),
  ]);
}

export function buildShortageSettlementJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  amount: number,
  advanceAccount: Account,
  sourceAccount: Account
): JournalEntry {
  const narration = `سداد عجز عهدة ${custody.custodyNumber} — المبلغ المستحق من ${custody.employeeName}`;
  return journal(ctx, narration, [
    line(sourceAccount, amount, 0, `تحصيل عجز عهدة ${custody.custodyNumber} من ${custody.employeeName}`),
    line(advanceAccount, 0, amount, `مقابل سداد عجز عهدة ${custody.custodyNumber}`, subLedgerOf(custody)),
  ]);
}

export function buildReplenishmentJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  items: CustodySettlementItem[],
  sourceAccount: Account
): JournalEntry {
  const baseCurrency = ctx.baseCurrency || 'YER';
  const lines: JournalLine[] = [];
  for (const item of items) {
    const itemCurrency = item.currency || custody.currency || baseCurrency;
    const itemRate = itemCurrency === baseCurrency ? 1 : (Number(item.exchangeRate) || 1);
    const itemLocal = Number(item.localAmount) || Math.round((Number(item.amount) || 0) * itemRate * 100) / 100;
    lines.push({
      ...line({id: item.accountId, code: item.accountCode, nameAr: item.accountNameAr}, itemLocal, 0, `استعاضة عهدة ${custody.custodyNumber} — ${item.description}`),
      currency: itemCurrency,
      exchangeRate: itemRate,
      ...(itemCurrency !== baseCurrency ? { debitForeign: Number(item.amount) || 0, creditForeign: 0 } : {}),
      costCenterId: item.costCenterId || custody.costCenterId,
      referenceNumber: item.referenceNumber,
    });
  }
  const totalLocal = Math.round(items.reduce((sum, item) => {
    const itemCurrency = item.currency || custody.currency || baseCurrency;
    const itemRate = itemCurrency === baseCurrency ? 1 : (Number(item.exchangeRate) || Number(ctx.exchangeRate) || 1);
    return sum + (Number(item.localAmount) || Math.round((Number(item.amount) || 0) * itemRate * 100) / 100);
  }, 0) * 100) / 100;
  lines.push({...line(sourceAccount, 0, totalLocal, `استعاضة عهدة ${custody.custodyNumber} — ${custody.employeeName}`), currency: baseCurrency, exchangeRate: 1});
  return journal(ctx, `استعاضة عهدة مستديمة ${custody.custodyNumber} — ${custody.title}`, lines);
}
