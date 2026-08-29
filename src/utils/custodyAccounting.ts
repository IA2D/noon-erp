import type {Account, Custody, CustodySettlementItem, JournalEntry, JournalLine} from '../types/erp';
import {nowStamp, today} from './custodyEngine';

export interface JournalBuildContext {
  journalId: string;
  entryNumber: string;
  currency: string;
  exchangeRate: number;
  createdBy: string;
  reference: string;
}

const line = (account: Pick<Account, 'id' | 'code' | 'nameAr'>, debit: number, credit: number, description: string, subLedger?: {subLedgerType: 'EMPLOYEE'; subLedgerId: string; subLedgerName: string}): JournalLine => ({
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
  const totalDebit = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
  return {
    id: ctx.journalId,
    entryNumber: ctx.entryNumber,
    date: today(),
    reference: ctx.reference,
    narration,
    lines,
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
  const narration = `صرف عهدة ${custody.custodyNumber} — ${custody.title} (${custody.employeeName})`;
  return journal(ctx, narration, [
    line(advanceAccount, custody.amount, 0, `صرف عهدة ${custody.custodyNumber} — ${custody.title}`, subLedgerOf(custody)),
    line(sourceAccount, 0, custody.amount, `مقابل صرف عهدة ${custody.custodyNumber} لـ ${custody.employeeName}`),
  ]);
}

export function buildSettlementJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  items: CustodySettlementItem[],
  advanceAccount: Account,
  apAccount: Account | null,
  vatAccount: Account | null,
  sourceAccount?: Account
): JournalEntry {
  const remaining = Math.max(0, Math.round((custody.disbursedAmount - custody.settledAmount - custody.refundedAmount - custody.apTransferredAmount) * 100) / 100);
  const expenseTotal = Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100;
  const advanceCredit = Math.min(remaining, expenseTotal);
  const excess = Math.round((expenseTotal - advanceCredit) * 100) / 100;
  const cashRefunded = Math.max(0, remaining - expenseTotal);

  const lines: JournalLine[] = [];
  for (const it of items) {
    lines.push(
      line(
        {id: it.accountId, code: it.accountCode, nameAr: it.accountNameAr},
        vatAccount ? it.amount : it.total,
        0,
        `${it.description}${it.vendorName ? ` — ${it.vendorName}` : ''}${it.invoiceNumber ? ` (فاتورة ${it.invoiceNumber})` : ''}`
      )
    );
    if (vatAccount && it.taxAmount > 0) {
      lines.push(line(vatAccount, it.taxAmount, 0, `ضريبة القيمة المضافة — ${it.description}`));
    }
  }
  lines.push(line(advanceAccount, 0, advanceCredit, `تصفية عهدة ${custody.custodyNumber} بالمستندات`, subLedgerOf(custody)));
  if (cashRefunded > 0 && sourceAccount) {
    lines.push(line(sourceAccount, cashRefunded, 0, `رد فائض نقدي عهدة ${custody.custodyNumber} للصندوق/البنك`));
    lines.push(line(advanceAccount, 0, cashRefunded, `مقابل رد فائض عهدة ${custody.custodyNumber}`, subLedgerOf(custody)));
  }
  if (excess > 0) {
    lines.push(line(apAccount ?? advanceAccount, 0, excess, `تجاوز مستندات التصفية الرصيد القائم${apAccount ? ` — مستحق للموظف ${custody.employeeName}` : ''}`));
  }
  return journal(ctx, `تصفية عهدة ${custody.custodyNumber} — ${custody.title} (${custody.employeeName})`, lines);
}

export function buildRefundJournal(
  ctx: JournalBuildContext,
  custody: Custody,
  amount: number,
  advanceAccount: Account,
  sourceAccount: Account
): JournalEntry {
  const narration = `رد نقدية فائض عهدة ${custody.custodyNumber} (${custody.employeeName})`;
  return journal(ctx, narration, [
    line(sourceAccount, amount, 0, `استلام رد فائض عهدة ${custody.custodyNumber}`),
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
  sourceAccount: Account,
  vatAccount: Account | null
): JournalEntry {
  const lines: JournalLine[] = [];
  for (const it of items) {
    lines.push(
      line(
        {id: it.accountId, code: it.accountCode, nameAr: it.accountNameAr},
        vatAccount ? it.amount : it.total,
        0,
        `استعاضة عهدة ${custody.custodyNumber} — ${it.description}${it.vendorName ? ` (${it.vendorName})` : ''}`
      )
    );
    if (vatAccount && it.taxAmount > 0) {
      lines.push(line(vatAccount, it.taxAmount, 0, `ضريبة القيمة المضافة — ${it.description}`));
    }
  }
  const total = Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100;
  lines.push(line(sourceAccount, 0, total, `استعاضة عهدة ${custody.custodyNumber} — ${custody.employeeName}`));
  return journal(ctx, `استعاضة عهدة مستديمة ${custody.custodyNumber} — ${custody.title}`, lines);
}
