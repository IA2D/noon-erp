import type {
  Account,
  BankAccount,
  CashBox,
  Currency,
  Customer,
  Employee,
  JournalEntry,
  PaymentVoucher,
  ReceiptVoucher,
  Vendor,
} from '../types/erp';
import type { SavePayload, SubLedgerKind } from '../components/modules/opening/types';
import { isPostingAccount, validateJournalEntryLines } from './accountingEngine';
import { amountsEqual, currencyDecimals, hasExcessPrecision, multiplyMoney, roundTo } from './money';
import { validateSupportingDocuments, type AttachmentRequirement } from './supportingDocuments';

export interface PostingValidationResult {
  valid: boolean;
  errors: string[];
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const unique = (values: string[]) => [...new Set(values)];

function validatePostingAccount(accountId: string, accounts: Account[], label: string, errors: string[]) {
  const account = accounts.find(item => item.id === accountId);
  if (!account) errors.push(`${label}: الحساب غير موجود في دليل الحسابات.`);
  else if (!isPostingAccount(account)) errors.push(`${label}: يجب اختيار حساب تشغيلي نشط من المستوى الخامس.`);
  return account;
}

function validateJournal(
  entry: JournalEntry,
  accounts: Account[],
  journals: JournalEntry[],
  allowedStatus: 'PENDING_POSTING' | 'POSTED',
  currencies: Currency[] = []
): PostingValidationResult {
  const errors: string[] = [];
  if (entry.status !== allowedStatus) errors.push(allowedStatus === 'PENDING_POSTING' ? 'يمكن ترحيل القيد المنتظر فقط.' : 'القيد الآلي يجب أن يكون مُرحّلاً.');
  if (!isIsoDate(entry.date)) errors.push('تاريخ القيد غير صالح.');
  if (!entry.entryNumber.trim()) errors.push('رقم القيد مطلوب.');
  if (journals.some(item => item.id !== entry.id && item.status !== 'VOIDED' && item.entryNumber === entry.entryNumber)) {
    errors.push(`رقم القيد ${entry.entryNumber} مستخدم مسبقاً.`);
  }

  const lineValidation = validateJournalEntryLines(entry.lines, accounts);
  if (!lineValidation.isValid && lineValidation.errorMessage) errors.push(lineValidation.errorMessage);
  entry.lines.forEach((line, index) => {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit < 0 || credit < 0) errors.push(`السطر ${index + 1}: المبالغ السالبة غير مسموحة.`);
    if (debit > 0 && credit > 0) errors.push(`السطر ${index + 1}: لا يمكن أن يكون مديناً ودائناً معاً.`);
    const account = accounts.find(item => item.id === line.accountId);
    if (account && account.subLedgerType !== 'NONE' && (!line.subLedgerId || line.subLedgerType !== account.subLedgerType)) {
      errors.push(`السطر ${index + 1}: الحساب المساعد ${account.subLedgerType} مطلوب.`);
    }
    const code = line.currency || entry.currency;
    const currency = currencies.find(item => item.code === code && item.isActive);
    if (currencies.length && !currency) errors.push(`السطر ${index + 1}: العملة ${code || '-'} غير موجودة أو موقوفة.`);
    const base = currencies.find(item => item.isBase);
    const localDecimals = currencyDecimals(base?.code, currencies);
    if (hasExcessPrecision(debit, localDecimals) || hasExcessPrecision(credit, localDecimals)) errors.push(`السطر ${index + 1}: المبلغ المحلي يتجاوز دقة العملة الأساسية (${localDecimals}).`);
    const isBase = currency ? currency.isBase : code === base?.code;
    const rate = isBase ? 1 : Number(line.exchangeRate || entry.exchangeRate);
    if (!(rate > 0)) errors.push(`السطر ${index + 1}: سعر الصرف يجب أن يكون موجباً.`);
    if (currency && !isBase && !line.isExchangeDifferenceAdjustment) {
      const foreignDecimals = currencyDecimals(code, currencies);
      const foreignDebit = Number(line.debitForeign) || 0;
      const foreignCredit = Number(line.creditForeign) || 0;
      if (hasExcessPrecision(foreignDebit, foreignDecimals) || hasExcessPrecision(foreignCredit, foreignDecimals)) errors.push(`السطر ${index + 1}: المبلغ الأصلي يتجاوز دقة ${code} (${foreignDecimals}).`);
      if (foreignDebit < 0 || foreignCredit < 0 || (foreignDebit > 0 && foreignCredit > 0)) errors.push(`السطر ${index + 1}: طرف العملة الأصلية غير صالح.`);
      if ((debit > 0 && !(foreignDebit > 0)) || (credit > 0 && !(foreignCredit > 0))) errors.push(`السطر ${index + 1}: المبلغ الأصلي مطلوب للسطر ذي العملة الأجنبية.`);
      if (foreignDebit > 0 && !amountsEqual(debit, multiplyMoney(roundTo(foreignDebit, foreignDecimals), rate, localDecimals), localDecimals)) errors.push(`السطر ${index + 1}: المدين المحلي لا يطابق المدين الأصلي × السعر المخزن.`);
      if (foreignCredit > 0 && !amountsEqual(credit, multiplyMoney(roundTo(foreignCredit, foreignDecimals), rate, localDecimals), localDecimals)) errors.push(`السطر ${index + 1}: الدائن المحلي لا يطابق الدائن الأصلي × السعر المخزن.`);
    }
  });
  if (round2(entry.totalDebit) !== lineValidation.totalDebit || round2(entry.totalCredit) !== lineValidation.totalCredit) {
    errors.push('إجماليات القيد المحفوظة لا تطابق إجماليات السطور.');
  }
  if (!entry.currency.trim() || !(entry.exchangeRate > 0)) errors.push('عملة القيد وسعر صرف موجب مطلوبان.');
  return { valid: errors.length === 0, errors: unique(errors) };
}

export function validateJournalForPosting(entry: JournalEntry, accounts: Account[], journals: JournalEntry[], currencies: Currency[] = [], requirements: AttachmentRequirement[] = [], finalPosting = true): PostingValidationResult {
  const result = validateJournal(entry, accounts, journals, 'PENDING_POSTING', currencies);
  const errors = [...result.errors, ...validateSupportingDocuments(entry.attachments, requirements, finalPosting)];
  return { valid: errors.length === 0, errors: unique(errors) };
}

/** Validates journals already assembled as POSTED by custody/trust/voucher domain commands. */
export function validateGeneratedJournalForPosting(
  entry: JournalEntry,
  accounts: Account[],
  journals: JournalEntry[],
  currencies: Currency[] = [],
  requirements: AttachmentRequirement[] = []
): PostingValidationResult {
  const result = validateJournal(entry, accounts, journals, 'POSTED', currencies);
  const errors = [...result.errors];
  if (entry.referenceCode && entry.sourceType && journals.some(item =>
    item.id !== entry.id && item.status === 'POSTED' && item.sourceType === entry.sourceType && item.referenceCode === entry.referenceCode
  )) errors.push(`المستند ${entry.referenceCode} رُحّل مسبقاً إلى الأستاذ العام.`);
  errors.push(...validateSupportingDocuments(entry.attachments, requirements, true));
  return { valid: errors.length === 0, errors: unique(errors) };
}

export interface OpeningBalanceEntities {
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  customers: Customer[];
  vendors: Vendor[];
  employees: Employee[];
}

const openingSubLedgerType: Record<SubLedgerKind, Account['subLedgerType']> = {
  CASH_BOX: 'CASH_BOX',
  BANK: 'BANK',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'SUPPLIER',
  EMPLOYEE: 'EMPLOYEE',
};

export function validateOpeningBalancesForPosting(
  payload: SavePayload,
  accounts: Account[],
  entities: OpeningBalanceEntities,
  currencies: Currency[],
  requirements: AttachmentRequirement[] = []
): PostingValidationResult {
  const errors: string[] = [];
  const rows = [...payload.accounts, ...payload.subLedgers];
  if (!rows.length) errors.push('لا توجد أرصدة افتتاحية للترحيل.');
  const rowIds = rows.map(row => row.rowId).filter(Boolean);
  if (rowIds.length !== rows.length || new Set(rowIds).size !== rowIds.length) errors.push('معرفات سطور الأرصدة الافتتاحية مفقودة أو مكررة.');

  let debitTotal = 0;
  let creditTotal = 0;
  const validateAmounts = (row: typeof rows[number], label: string) => {
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    const debitLocal = Number(row.debitLocal) || 0;
    const creditLocal = Number(row.creditLocal) || 0;
    if (debit < 0 || credit < 0 || debitLocal < 0 || creditLocal < 0) errors.push(`${label}: المبالغ السالبة غير مسموحة.`);
    if ((debit > 0 && credit > 0) || (debitLocal > 0 && creditLocal > 0)) errors.push(`${label}: لا يمكن أن يكون السطر مديناً ودائناً معاً.`);
    const currency = currencies.find(item => item.code === row.currency && item.isActive);
    if (!currency) errors.push(`${label}: العملة غير موجودة أو موقوفة.`);
    const rate = currency?.isBase ? 1 : Number(row.rate);
    const foreignDecimals = currencyDecimals(row.currency, currencies);
    const localDecimals = currencyDecimals(currencies.find(item => item.isBase)?.code, currencies);
    if (hasExcessPrecision(debit, foreignDecimals) || hasExcessPrecision(credit, foreignDecimals)) errors.push(`${label}: المبلغ الأصلي يتجاوز دقة ${row.currency} (${foreignDecimals}).`);
    if (hasExcessPrecision(debitLocal, localDecimals) || hasExcessPrecision(creditLocal, localDecimals)) errors.push(`${label}: المعادل المحلي يتجاوز دقة العملة الأساسية (${localDecimals}).`);
    if (!(rate > 0)) errors.push(`${label}: سعر الصرف يجب أن يكون موجباً.`);
    if (!amountsEqual(multiplyMoney(roundTo(debit, foreignDecimals), rate || 0, localDecimals), debitLocal, localDecimals) || !amountsEqual(multiplyMoney(roundTo(credit, foreignDecimals), rate || 0, localDecimals), creditLocal, localDecimals)) {
      errors.push(`${label}: المعادل المحلي لا يطابق المبلغ الأصلي × سعر الصرف.`);
    }
    if (Math.abs(round2(row.openingBalance) - round2(debitLocal - creditLocal)) > 0.01) errors.push(`${label}: صافي الرصيد لا يطابق المدين ناقص الدائن المحلي.`);
    debitTotal = round2(debitTotal + debitLocal);
    creditTotal = round2(creditTotal + creditLocal);
  };

  payload.accounts.forEach((row, index) => {
    validatePostingAccount(row.id, accounts, `الحساب ${index + 1}`, errors);
    validateAmounts(row, `الحساب ${index + 1}`);
  });
  payload.subLedgers.forEach((row, index) => {
    const label = `الحساب المساعد ${index + 1}`;
    const account = validatePostingAccount(row.linkedAccountId, accounts, label, errors);
    if (account && account.subLedgerType !== openingSubLedgerType[row.kind]) errors.push(`${label}: نوع الحساب المساعد لا يطابق الحساب المرتبط.`);
    const entityLists: Record<SubLedgerKind, Array<{ id: string; linkedAccountId?: string; isActive: boolean }>> = {
      CASH_BOX: entities.cashBoxes,
      BANK: entities.bankAccounts,
      CUSTOMER: entities.customers,
      VENDOR: entities.vendors,
      EMPLOYEE: entities.employees,
    };
    const entity = entityLists[row.kind].find(item => item.id === row.id);
    if (!entity || !entity.isActive) errors.push(`${label}: الكيان غير موجود أو موقوف.`);
    else if (entity.linkedAccountId && entity.linkedAccountId !== row.linkedAccountId) errors.push(`${label}: الحساب المرتبط لا يطابق بطاقة الكيان.`);
    validateAmounts(row, label);
  });
  if (!(debitTotal > 0 || creditTotal > 0)) errors.push('إجمالي الأرصدة الافتتاحية يجب أن يكون أكبر من صفر.');
  if (Math.abs(debitTotal - creditTotal) > 0.01) errors.push(`الأرصدة الافتتاحية غير متوازنة: الفرق ${round2(debitTotal - creditTotal)}.`);
  errors.push(...validateSupportingDocuments(payload.attachments, requirements, true));
  return { valid: errors.length === 0, errors: unique(errors) };
}

type AnyVoucher = PaymentVoucher | ReceiptVoucher;

export function validateVoucherForPosting(
  kind: 'PAYMENT' | 'RECEIPT',
  voucher: AnyVoucher,
  accounts: Account[],
  sameKindVouchers: AnyVoucher[],
  journals: JournalEntry[],
  currencies: Currency[] = [],
  requirements: AttachmentRequirement[] = []
): PostingValidationResult {
  const errors: string[] = [];
  const number = kind === 'PAYMENT' ? (voucher as PaymentVoucher).voucherNumber : (voucher as ReceiptVoucher).receiptNumber;
  const party = kind === 'PAYMENT' ? (voucher as PaymentVoucher).payeeName : (voucher as ReceiptVoucher).payerName;
  const sourceType = kind === 'PAYMENT' ? 'PAYMENT_VOUCHER' : 'RECEIPT_VOUCHER';
  const localDecimals = currencyDecimals(currencies.find(item => item.isBase)?.code, currencies);
  if (voucher.status !== 'PENDING_POSTING') errors.push('يمكن ترحيل السند المنتظر فقط.');
  if (!number.trim()) errors.push('رقم السند مطلوب.');
  if (!isIsoDate(voucher.date)) errors.push('تاريخ السند غير صالح.');
  if (!party.trim()) errors.push('اسم الطرف مطلوب.');
  if (!voucher.currency.trim() || !(voucher.exchangeRate > 0)) errors.push('عملة السند وسعر صرف موجب مطلوبان.');
  if (sameKindVouchers.some(item => {
    const itemNumber = kind === 'PAYMENT' ? (item as PaymentVoucher).voucherNumber : (item as ReceiptVoucher).receiptNumber;
    return item.id !== voucher.id && item.status !== 'VOIDED' && itemNumber === number;
  })) errors.push(`رقم السند ${number} مستخدم مسبقاً.`);
  if (journals.some(item => item.status === 'POSTED' && item.sourceType === sourceType && item.referenceCode === number)) {
    errors.push(`السند ${number} رُحّل مسبقاً إلى الأستاذ العام.`);
  }

  validatePostingAccount(voucher.sourceAccountId, accounts, 'حساب المصدر', errors);
  if (!voucher.lines.length) errors.push('يجب إدخال سطر توزيع واحد على الأقل.');
  let totalLocal = 0;
  let totalDocument = 0;
  voucher.lines.forEach((line, index) => {
    const account = validatePostingAccount(line.accountId, accounts, `السطر ${index + 1}`, errors);
    if (line.accountId === voucher.sourceAccountId) errors.push(`السطر ${index + 1}: حساب المصدر لا يجوز أن يكون حساب التوزيع نفسه.`);
    if (!(line.amount > 0)) errors.push(`السطر ${index + 1}: يجب أن يكون المبلغ أكبر من صفر.`);
    const rate = line.currency && line.currency !== voucher.currency ? line.exchangeRate : (line.exchangeRate || voucher.exchangeRate);
    if (!(rate && rate > 0)) errors.push(`السطر ${index + 1}: سعر الصرف غير صالح.`);
    const code = line.currency || voucher.currency;
    const currency = currencies.find(item => item.code === code && item.isActive);
    if (currencies.length && !currency) errors.push(`السطر ${index + 1}: العملة ${code || '-'} غير موجودة أو موقوفة.`);
    const foreignDecimals = currencyDecimals(code, currencies);
    if (hasExcessPrecision(line.amount, foreignDecimals) || hasExcessPrecision(line.totalAmount, foreignDecimals)) errors.push(`السطر ${index + 1}: المبلغ يتجاوز دقة ${code} (${foreignDecimals}).`);
    if (typeof line.localAmount === 'number' && hasExcessPrecision(line.localAmount, localDecimals)) errors.push(`السطر ${index + 1}: المعادل المحلي يتجاوز دقة العملة الأساسية (${localDecimals}).`);
    const expectedLocal = multiplyMoney(roundTo(line.amount || 0, foreignDecimals), rate || 0, localDecimals);
    if (typeof line.localAmount === 'number' && line.localAmount > 0 && !amountsEqual(line.localAmount, expectedLocal, localDecimals)) {
      errors.push(`السطر ${index + 1}: المعادل المحلي لا يطابق المبلغ × سعر الصرف.`);
    }
    const local = typeof line.localAmount === 'number' && line.localAmount > 0 ? roundTo(line.localAmount, localDecimals) : expectedLocal;
    totalLocal = roundTo(totalLocal + local, localDecimals);
    totalDocument = roundTo(totalDocument + (line.totalAmount || line.amount || 0), currencyDecimals(voucher.currency, currencies));
    if (account && account.subLedgerType !== 'NONE' && (!line.subLedgerId || line.subLedgerType !== account.subLedgerType)) {
      errors.push(`السطر ${index + 1}: الحساب المساعد ${account.subLedgerType} مطلوب.`);
    }
  });
  if (!(voucher.totalAmount > 0)) errors.push('إجمالي السند يجب أن يكون أكبر من صفر.');
  const documentDecimals = currencyDecimals(voucher.currency, currencies);
  if (hasExcessPrecision(voucher.subtotalAmount, documentDecimals) || hasExcessPrecision(voucher.totalAmount, documentDecimals)) errors.push(`إجمالي السند يتجاوز دقة ${voucher.currency} (${documentDecimals}).`);
  if (!amountsEqual(voucher.subtotalAmount, totalDocument, documentDecimals) || !amountsEqual(voucher.totalAmount, totalDocument, documentDecimals)) {
    errors.push('إجمالي السند لا يطابق مجموع سطور التوزيع.');
  }
  if (!(totalLocal > 0)) errors.push('إجمالي المعادل المحلي يجب أن يكون أكبر من صفر.');
  errors.push(...validateSupportingDocuments(voucher.attachments, requirements, true));
  return { valid: errors.length === 0, errors: unique(errors) };
}
