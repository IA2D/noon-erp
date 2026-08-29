import { tafqeetAmount } from '../../utils/tafqeetHelper';

export interface StatementGroup {
  groupKey: string;
  subLedgerId: string;
  subLedgerCode: string;
  subLedgerName: string;
  accountNo: string;
  currency: string;
  openingDebit: number;
  openingCredit: number;
  transactions: Array<{
    id: string;
    date: string;
    docType: string;
    docNo: string;
    narration: string;
    refNo: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  closingDebit: number;
  closingCredit: number;
  netBalance: number;
  balanceType: '\u0639\u0644\u064a\u0643\u0645 (\u0645\u062f\u064a\u0646)' | '\u0644\u0643\u0645 (\u062f\u0627\u0626\u0646)';
  tafqeetText: string;
  count: number;
}

export const buildAnalyticalStatements = (
  rawTransactions: any[],
  rawOpeningBalances: any[],
  tafqeetFn?: (val: number, cur: string) => string
): StatementGroup[] => {
  const groupsMap = new Map<string, StatementGroup>();

  rawOpeningBalances.forEach((ob) => {
    const subId = ob.subLedgerId || 'main';
    const cur = ob.currency || 'YER';
    const key = `${ob.accountId || ob.accountNo || 'main'}_${subId}_${cur}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        groupKey: key,
        subLedgerId: subId,
        subLedgerCode: ob.subLedgerCode || ob.accountNo || '',
        subLedgerName: ob.subLedgerName || ob.accountName || '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u0627\u0645',
        accountNo: ob.accountNo || '',
        currency: cur,
        openingDebit: Number(ob.foreignDebit || ob.localDebit || 0),
        openingCredit: Number(ob.foreignCredit || ob.localCredit || 0),
        transactions: [],
        totalDebit: 0,
        totalCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        netBalance: 0,
        balanceType: '\u0639\u0644\u064a\u0643\u0645 (\u0645\u062f\u064a\u0646)',
        tafqeetText: '',
        count: 0,
      });
    }
  });

  rawTransactions.forEach((tx) => {
    const subId = tx.subLedgerId || 'main';
    const cur = tx.currency || 'YER';
    const key = `${tx.accountId || tx.accountNo || 'main'}_${subId}_${cur}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        groupKey: key,
        subLedgerId: subId,
        subLedgerCode: tx.subLedgerCode || tx.accountNo || '',
        subLedgerName: tx.subLedgerName || tx.accountName || '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u0627\u0645',
        accountNo: tx.accountNo || '',
        currency: cur,
        openingDebit: 0,
        openingCredit: 0,
        transactions: [],
        totalDebit: 0,
        totalCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        netBalance: 0,
        balanceType: '\u0639\u0644\u064a\u0643\u0645 (\u0645\u062f\u064a\u0646)',
        tafqeetText: '',
        count: 0,
      });
    }

    groupsMap.get(key)!.transactions.push({
      id: tx.id,
      date: tx.date,
      docType: tx.docType,
      docNo: tx.docNo,
      narration: tx.narration || tx.description || '',
      refNo: tx.refNo || '',
      debit: Number(tx.debit || 0),
      credit: Number(tx.credit || 0),
    });
  });

  return Array.from(groupsMap.values()).map((grp) => {
    const totalDebit = grp.transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = grp.transactions.reduce((sum, t) => sum + t.credit, 0);
    const closingDebit = grp.openingDebit + totalDebit;
    const closingCredit = grp.openingCredit + totalCredit;
    const net = closingDebit - closingCredit;

    return {
      ...grp,
      totalDebit,
      totalCredit,
      closingDebit,
      closingCredit,
      netBalance: Math.abs(net),
      balanceType: (net >= 0 ? '\u0639\u0644\u064a\u0643\u0645 (\u0645\u062f\u064a\u0646)' : '\u0644\u0643\u0645 (\u062f\u0627\u0626\u0646)') as StatementGroup['balanceType'],
      tafqeetText: tafqeetFn
        ? tafqeetFn(Math.abs(net), grp.currency)
        : tafqeetAmount(Math.abs(net), grp.currency),
      count: grp.transactions.length,
    };
  });
};
