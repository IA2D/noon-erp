import { dateToIso, inDateRange, isValidDateIso } from './dateInput';
import type { Account, JournalEntry } from '../types/erp';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface ReportPeriodValidation {
  valid: boolean;
  error?: string;
}

/** ISO dates are compared lexically so reporting is timezone-independent. */
export function validateReportPeriod(fromDate: string, toDate: string): ReportPeriodValidation {
  if (!isValidDateIso(fromDate) || !isValidDateIso(toDate)) {
    return { valid: false, error: 'يرجى إدخال تاريخ بداية ونهاية صحيحين.' };
  }
  if (fromDate > toDate) {
    return { valid: false, error: 'تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.' };
  }
  return { valid: true };
}

export function postedJournalsInRange(journals: JournalEntry[], fromDate: string, toDate: string): JournalEntry[] {
  return journals.filter(journal =>
    journal.status === 'POSTED' && inDateRange(journal.date, fromDate, toDate)
  );
}

/**
 * Produces the signed debit-minus-credit opening at the start of a report period.
 * Credit openings stay negative regardless of the account's normal nature.
 */
export function buildPeriodAccounts(
  accounts: Account[],
  journals: JournalEntry[],
  fromDate: string,
  includeOpening = true,
  scale = 1
): Account[] {
  if (!includeOpening) {
    return accounts.map(account => ({ ...account, openingBalance: 0 }));
  }

  const signedBefore = new Map<string, number>();
  journals.forEach(journal => {
    if (journal.status !== 'POSTED' || !dateToIso(journal.date) || dateToIso(journal.date) >= dateToIso(fromDate)) return;
    journal.lines.forEach(line => {
      signedBefore.set(
        line.accountId,
        round2((signedBefore.get(line.accountId) || 0) + (line.debit || 0) - (line.credit || 0))
      );
    });
  });

  return accounts.map(account => ({
    ...account,
    openingBalance: round2(((account.openingBalance || 0) + (signedBefore.get(account.id) || 0)) * scale),
  }));
}

/** Period-only debit/credit movement; opening balances are deliberately excluded. */
export function calculatePeriodMovement(
  accounts: Account[],
  journals: JournalEntry[]
): Record<string, { debit: number; credit: number }> {
  const activity: Record<string, { debit: number; credit: number }> = {};
  accounts.forEach(account => { activity[account.id] = { debit: 0, credit: 0 }; });
  journals.filter(journal => journal.status === 'POSTED').forEach(journal => {
    journal.lines.forEach(line => {
      const current = activity[line.accountId] || { debit: 0, credit: 0 };
      current.debit = round2(current.debit + (line.debit || 0));
      current.credit = round2(current.credit + (line.credit || 0));
      activity[line.accountId] = current;
    });
  });
  return activity;
}
