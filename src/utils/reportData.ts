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

/**
 * Return an opening-balance record in the currency used by the report.
 * Older local data may only have `amount` / `foreignAmount`, while current
 * records carry debit/credit pairs. A default zero pair must not hide a
 * populated legacy balance.
 */
export function openingRecordAmount(record: OpeningBalanceRecord, currency: string, base: string): number {
  if (currency === base) {
    const rate = record.exchangeRate || record.rate || 1;
    const local = (record.debitLocal ?? (record.debit || 0) * rate) - (record.creditLocal ?? (record.credit || 0) * rate);
    return local !== 0 || record.amount == null ? local : record.amount;
  }
  const original = (record.debit || 0) - (record.credit || 0);
  return original !== 0 || record.foreignAmount == null ? original : record.foreignAmount;
}

/** Opening balances grouped by original currency for analytical statements. */
export function entityOpeningsByCurrency(entity: ReportEntity, base: string): Record<string, number> {
  const totals: Record<string, number> = {};
  const add = (code: string, amount: number) => { totals[code] = (totals[code] || 0) + amount; };
  if (entity.openingBalances?.length) {
    entity.openingBalances.forEach(record => {
      const code = record.currency || base;
      add(code, openingRecordAmount(record, code, base));
    });
    return totals;
  }
  const code = entity.openingCurrency || base;
  add(code, code === base ? (entity.openingBalance || 0) : (entity.openingBalanceForeign ?? entity.openingBalance ?? 0));
  return totals;
}

export function entityOpening(entity: ReportEntity, currency: string, base: string): number {
  if (entity.openingBalances?.length) return entity.openingBalances.reduce((sum, row) => {
    if (currency !== base && row.currency !== currency) return sum;
    return sum + openingRecordAmount(row, currency, base);
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
