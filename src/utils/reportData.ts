import type { JournalEntry, JournalLine, OpeningBalanceRecord, SubLedgerType } from '../types/erp';
import { dateToIso, inDateRange } from './dateInput';

export function reportDocuments<T extends { date: string; status: string }>(records: T[], from: string, to: string, includeVoided = false): T[] {
  return records.filter(record => (includeVoided || record.status !== 'VOIDED') && inDateRange(record.date, from, to));
}
export function lineCostCenterId(line: JournalLine): string | undefined {
  return line.costCenterId || (line.subLedgerType === 'COST_CENTER' ? line.subLedgerId : undefined);
}
export interface ReportEntity {
  id: string; linkedAccountId?: string; openingBalance?: number; openingBalances?: OpeningBalanceRecord[];
  openingCurrency?: string; openingBalanceForeign?: number;
}
export function entityOpening(entity: ReportEntity, currency: string, base: string): number {
  if (entity.openingBalances?.length) return entity.openingBalances.reduce((sum, row) => {
    if (currency !== base && row.currency !== currency) return sum;
    return sum + (currency === base
      ? (row.debitLocal == null && row.creditLocal == null && row.amount != null ? row.amount : (row.debitLocal ?? (row.debit || 0) * (row.exchangeRate || row.rate || 1)) - (row.creditLocal ?? (row.credit || 0) * (row.exchangeRate || row.rate || 1)))
      : (row.debit == null && row.credit == null ? row.foreignAmount || 0 : (row.debit || 0) - (row.credit || 0)));
  }, 0);
  return currency === base ? (entity.openingBalance || 0) : entity.openingCurrency === currency ? (entity.openingBalanceForeign || 0) : 0;
}
export function lineBelongsToEntity(line: JournalLine, journal: JournalEntry, entity: ReportEntity, peers: ReportEntity[], types: SubLedgerType[], sources: {journalEntryId?: string; sourceEntityId?: string; sourceAccountId?: string}[] = []): boolean {
  if (line.subLedgerId) return line.subLedgerId === entity.id && (!line.subLedgerType || types.includes(line.subLedgerType));
  if (!entity.linkedAccountId || line.accountId !== entity.linkedAccountId) return false;
  const source = sources.find(v => v.journalEntryId === journal.id && v.sourceAccountId === line.accountId && v.sourceEntityId);
  if (source) return source.sourceEntityId === entity.id;
  // Untagged legacy lines are attributable only when the control account has one entity.
  return peers.filter(e => e.linkedAccountId === line.accountId).length === 1;
}
export function isBeforeReport(date: string, start: string): boolean {
  const iso = dateToIso(date); return !!iso && iso < dateToIso(start);
}
export function voucherReportAmount(voucher: {currency: string; exchangeRate: number; totalAmount: number}, currency: string, base: string): number {
  return currency === base && voucher.currency !== base ? voucher.totalAmount * voucher.exchangeRate : voucher.totalAmount;
}
