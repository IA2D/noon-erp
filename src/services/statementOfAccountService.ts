import type {
  Account,
  BankAccount,
  CashBox,
  Currency,
  Customer,
  Employee,
  JournalEntry,
  JournalLine,
  SubLedgerType,
  Vendor
} from '../types/erp';

export type StatementEntityKind =
  | 'ACCOUNT'
  | 'EMPLOYEE'
  | 'CUSTOMER'
  | 'VENDOR'
  | 'CASH_BOX'
  | 'BANK';

export const STATEMENT_KIND_META: Record<
  StatementEntityKind,
  { labelAr: string; labelEn: string; subLedgerType?: SubLedgerType }
> = {
  ACCOUNT: { labelAr: 'حسب الحساب', labelEn: 'By Account' },
  EMPLOYEE: { labelAr: 'حسب الموظف', labelEn: 'By Employee', subLedgerType: 'EMPLOYEE' },
  CUSTOMER: { labelAr: 'حسب العميل', labelEn: 'By Customer', subLedgerType: 'CUSTOMER' },
  VENDOR: { labelAr: 'حسب المورد', labelEn: 'By Vendor', subLedgerType: 'SUPPLIER' },
  CASH_BOX: { labelAr: 'حسب الصندوق', labelEn: 'By Cash Box', subLedgerType: 'CASH_BOX' },
  BANK: { labelAr: 'حسب البنك/الصراف', labelEn: 'By Bank', subLedgerType: 'BANK' }
};

export interface StatementSubject {
  kind: StatementEntityKind;
  id: string;
  code: string;
  name: string;
  linkedAccountId: string;
  accountCode: string;
  accountName: string;
  openingBalance: number;
}

export interface StatementRow {
  seq: number;
  date: string;
  docType: string;
  docNumber: string;
  reference: string;
  narration: string;
  debit: number;
  credit: number;
  running: number;
}

export interface StatementResult {
  subject: StatementSubject;
  kindLabel: string;
  fromDate: string;
  toDate: string;
  baseCode: string;
  baseNameAr: string;
  baseSymbol: string;
  /** الرصيد الافتتاحي (موجب مدين / سالب دائن) */
  opening: number;
  openingDebit: number;
  openingCredit: number;
  rows: StatementRow[];
  totalDebit: number;
  totalCredit: number;
  /** الرصيد الختامي (موجب مدين / سالب دائن) */
  closing: number;
  isDebit: boolean;
  count: number;
}

export interface StatementInput {
  kind: StatementEntityKind;
  id: string;
  accounts: Account[];
  journals: JournalEntry[];
  employees?: Employee[];
  customers?: Customer[];
  vendors?: Vendor[];
  cashBoxes?: CashBox[];
  bankAccounts?: BankAccount[];
  currencies?: Currency[];
  fromDate: string;
  toDate: string;
  /** نوع المستند لكل قيد (سند صرف / سند قبض / قيد يومية...) */
  docTypeByJournal?: (journalId: string) => string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function buildStatementSubject(kind: StatementEntityKind, id: string, accounts: Account[], opts?: {
  employees?: Employee[];
  customers?: Customer[];
  vendors?: Vendor[];
  cashBoxes?: CashBox[];
  bankAccounts?: BankAccount[];
}): StatementSubject | null {
  const accountOf = (linkedId?: string): Account | undefined =>
    accounts.find(a => a.id === linkedId);

  if (kind === 'ACCOUNT') {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return null;
    return {
      kind,
      id: acc.id,
      code: acc.code,
      name: acc.nameAr,
      linkedAccountId: acc.id,
      accountCode: acc.code,
      accountName: acc.nameAr,
      openingBalance: acc.openingBalance || 0
    };
  }

  switch (kind) {
    case 'EMPLOYEE': {
      const e = opts?.employees?.find(x => x.id === id);
      if (!e) return null;
      const linked = accountOf(e.linkedAccountId);
      return {
        kind, id: e.id, code: e.code, name: e.nameAr,
        linkedAccountId: linked?.id || '', accountCode: linked?.code || '—', accountName: linked?.nameAr || '—',
        openingBalance: e.openingBalance ?? linked?.openingBalance ?? 0
      };
    }
    case 'CUSTOMER': {
      const c = opts?.customers?.find(x => x.id === id);
      if (!c) return null;
      const linked = accountOf(c.linkedAccountId);
      return {
        kind, id: c.id, code: c.code, name: c.nameAr,
        linkedAccountId: linked?.id || '', accountCode: linked?.code || '—', accountName: linked?.nameAr || '—',
        openingBalance: c.openingBalance ?? linked?.openingBalance ?? 0
      };
    }
    case 'VENDOR': {
      const v = opts?.vendors?.find(x => x.id === id);
      if (!v) return null;
      const linked = accountOf(v.linkedAccountId);
      return {
        kind, id: v.id, code: v.code, name: v.nameAr,
        linkedAccountId: linked?.id || '', accountCode: linked?.code || '—', accountName: linked?.nameAr || '—',
        openingBalance: v.openingBalance ?? linked?.openingBalance ?? 0
      };
    }
    case 'CASH_BOX': {
      const b = opts?.cashBoxes?.find(x => x.id === id);
      if (!b) return null;
      const linked = accountOf(b.linkedAccountId);
      return {
        kind, id: b.id, code: b.code, name: b.nameAr,
        linkedAccountId: linked?.id || '', accountCode: linked?.code || '—', accountName: linked?.nameAr || '—',
        openingBalance: b.openingBalance ?? linked?.openingBalance ?? 0
      };
    }
    case 'BANK': {
      const b = opts?.bankAccounts?.find(x => x.id === id);
      if (!b) return null;
      const linked = accountOf(b.linkedAccountId);
      return {
        kind, id: b.id, code: b.code, name: b.bankNameAr,
        linkedAccountId: linked?.id || '', accountCode: linked?.code || '—', accountName: linked?.nameAr || '—',
        openingBalance: b.openingBalance ?? linked?.openingBalance ?? 0
      };
    }
  }
}

export function lineMatches(line: JournalLine, subject: StatementSubject): boolean {
  if (subject.kind === 'ACCOUNT') {
    return line.accountId === subject.id;
  }
  if (!subject.linkedAccountId || line.accountId !== subject.linkedAccountId) return false;
  if (!subject.id) return false;
  const expected = STATEMENT_KIND_META[subject.kind].subLedgerType;
  if (line.subLedgerType && expected && line.subLedgerType !== expected) return false;
  // الصندوق/البنك مرتبطان 1:1 بحسابهما — المطابقة بمعرّف الحساب تكفي دون اشتراط وسم صريح
  if (subject.kind === 'CASH_BOX' || subject.kind === 'BANK') return true;
  // حسابات السيطرة (عميل/مورد/موظف) تجميعية — يجب أن يكون القيد موسوماً صراحةً بهذا الكيان
  return line.subLedgerId === subject.id;
}

export function queryStatement(input: StatementInput): StatementResult | null {
  const {
    kind, id, accounts, journals,
    employees, customers, vendors, cashBoxes, bankAccounts,
    currencies, fromDate, toDate, docTypeByJournal
  } = input;

  const subject = buildStatementSubject(kind, id, accounts, {
    employees, customers, vendors, cashBoxes, bankAccounts
  });
  if (!subject) return null;

  const posted = (journals || []).filter(j => j.status === 'POSTED');

  const inRange = (date: string) => {
    const d = date.slice(0, 10);
    return d >= fromDate.slice(0, 10) && d <= toDate.slice(0, 10);
  };

  const movements: Omit<StatementRow, 'running' | 'seq'>[] = [];
  let preOpening = 0;

  posted.forEach(j => {
    j.lines.forEach(line => {
      if (!lineMatches(line, subject)) return;
      const isInRange = inRange(j.date);
      const net = (line.debit || 0) - (line.credit || 0);
      if (isInRange) {
        movements.push({
          date: j.date,
          docType: docTypeByJournal ? docTypeByJournal(j.id) : 'قيد يومية',
          docNumber: j.entryNumber,
          reference: j.reference || '—',
          narration: line.description || j.narration || '—',
          debit: line.debit || 0,
          credit: line.credit || 0
        });
      } else if (j.date < fromDate) {
        preOpening += net;
      }
    });
  });

  movements.sort((a, b) => a.date.localeCompare(b.date) || a.docNumber.localeCompare(b.docNumber));

  const opening = round2(subject.openingBalance + preOpening);
  let running = opening;
  const rows: StatementRow[] = movements.map((m, i) => {
    running = round2(running + m.debit - m.credit);
    return { ...m, seq: i + 1, running };
  });

  const totalDebit = round2(movements.reduce((s, m) => s + m.debit, 0));
  const totalCredit = round2(movements.reduce((s, m) => s + m.credit, 0));
  const closing = round2(opening + totalDebit - totalCredit);

  const base = (currencies || []).find(c => c.isBase && c.isActive)
    || (currencies || []).find(c => c.isActive);

  return {
    subject,
    kindLabel: STATEMENT_KIND_META[kind].labelAr,
    fromDate,
    toDate,
    baseCode: base?.code || 'YER',
    baseNameAr: base?.nameAr || 'ريال يمني',
    baseSymbol: base?.symbol || 'ر.ي',
    opening,
    openingDebit: opening > 0 ? opening : 0,
    openingCredit: opening < 0 ? -opening : 0,
    rows,
    totalDebit,
    totalCredit,
    closing,
    isDebit: closing >= 0,
    count: rows.length
  };
}
