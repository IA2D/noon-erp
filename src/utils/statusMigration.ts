import type { Custody, JournalEntry, PaymentVoucher, ReceiptVoucher } from '../types/erp';

type LegacyStatusRecord = { status: string };
export const LEGACY_PRE_POSTING_STATUS = ['DRA', 'FT'].join('');

function migrateStatus<T extends LegacyStatusRecord>(records: T[], replacement: string): T[] {
  let changed = false;
  const migrated = records.map(record => {
    if (record.status !== LEGACY_PRE_POSTING_STATUS) return record;
    changed = true;
    return { ...record, status: replacement } as T;
  });
  return changed ? migrated : records;
}

/** One-time, idempotent compatibility migration for data created by older releases. */
export function migrateLegacyWorkflowStatuses(data: {
  journals: JournalEntry[];
  payments: PaymentVoucher[];
  receipts: ReceiptVoucher[];
  custodies: Custody[];
}) {
  return {
    journals: migrateStatus(data.journals as Array<JournalEntry & LegacyStatusRecord>, 'PENDING_POSTING') as JournalEntry[],
    payments: migrateStatus(data.payments as Array<PaymentVoucher & LegacyStatusRecord>, 'PENDING_POSTING') as PaymentVoucher[],
    receipts: migrateStatus(data.receipts as Array<ReceiptVoucher & LegacyStatusRecord>, 'PENDING_POSTING') as ReceiptVoucher[],
    custodies: migrateStatus(data.custodies as Array<Custody & LegacyStatusRecord>, 'CREATED') as Custody[],
  };
}
