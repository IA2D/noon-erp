import type {
  Account,
  BankAccount,
  CashBox,
  CostCenter,
  Currency,
  Custody,
  Customer,
  Employee,
  JournalEntry,
  PaymentVoucher,
  ReceiptVoucher,
  Trust,
  Vendor,
} from '../types/erp';

export type MasterDataRemovalAction = 'DELETE' | 'ARCHIVE' | 'BLOCK';
export interface MasterDataRemovalDecision { action: MasterDataRemovalAction; reasons: string[] }
export interface MasterDataReferenceContext {
  accounts: Account[];
  costCenters: CostCenter[];
  journals: JournalEntry[];
  trusts: Trust[];
  custodies: Custody[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  vouchers: PaymentVoucher[];
  receipts: ReceiptVoucher[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  currencies: Currency[];
}

const anyOpening = (item: { openingBalance?: number; openingBalanceForeign?: number; openingBalances?: unknown[] }) =>
  Math.abs(Number(item.openingBalance) || 0) > 0 || Math.abs(Number(item.openingBalanceForeign) || 0) > 0 || Boolean(item.openingBalances?.length);
const unique = (values: string[]) => [...new Set(values)];

export function accountRemovalDecision(id: string, ctx: MasterDataReferenceContext): MasterDataRemovalDecision {
  const reasons: string[] = [];
  if (ctx.accounts.some(item => item.parentId === id)) reasons.push('له حسابات فرعية');
  if (ctx.journals.some(entry => entry.lines.some(line => line.accountId === id))) reasons.push('مستخدم في قيود اليومية');
  if ([...ctx.cashBoxes, ...ctx.bankAccounts, ...ctx.employees, ...ctx.customers, ...ctx.vendors].some(item => item.linkedAccountId === id)) reasons.push('مرتبط ببطاقة حساب تحليلي');
  if ([...ctx.vouchers, ...ctx.receipts].some(v => v.sourceAccountId === id || v.lines.some(line => line.accountId === id))) reasons.push('مستخدم في سند مالي');
  const account = ctx.accounts.find(item => item.id === id);
  if (account && anyOpening(account)) reasons.push('له رصيد افتتاحي');
  return { action: reasons.length ? 'ARCHIVE' : 'DELETE', reasons: unique(reasons) };
}

export function entityRemovalDecision(
  kind: 'CASH_BOX' | 'BANK' | 'EMPLOYEE' | 'CUSTOMER' | 'VENDOR',
  id: string,
  ctx: MasterDataReferenceContext
): MasterDataRemovalDecision {
  const lists = { CASH_BOX: ctx.cashBoxes, BANK: ctx.bankAccounts, EMPLOYEE: ctx.employees, CUSTOMER: ctx.customers, VENDOR: ctx.vendors };
  const item = lists[kind].find(entity => entity.id === id) as { openingBalance?: number; openingBalanceForeign?: number; openingBalances?: unknown[]; linkedAccountId?: string } | undefined;
  const reasons: string[] = [];
  if (item && anyOpening(item)) reasons.push('له رصيد افتتاحي');
  const subType = kind === 'VENDOR' ? 'SUPPLIER' : kind;
  if (ctx.journals.some(entry => entry.lines.some(line => line.subLedgerType === subType && line.subLedgerId === id))) reasons.push('مستخدم كحساب تحليلي في قيد');
  if (kind === 'EMPLOYEE' && (ctx.trusts.some(item => item.employeeId === id) || ctx.custodies.some(item => item.employeeId === id))) reasons.push('مرتبط بعهدة');
  if (kind === 'VENDOR' && ctx.custodies.some(c => c.settlements.some(s => s.items.some(item => item.vendorId === id)))) reasons.push('مرتبط بتصفية عهدة');
  if ((kind === 'CASH_BOX' || kind === 'BANK') && ctx.custodies.some(c => c.disbursementSource === id)) reasons.push('مستخدم كمصدر صرف عهدة');
  if ((kind === 'CASH_BOX' || kind === 'BANK') && [...ctx.vouchers, ...ctx.receipts].some(v => v.sourceEntityId === id)) reasons.push('مستخدم كمصدر سند مالي');
  if (ctx.vouchers.some(v => v.lines.some(line => line.subLedgerType === subType && line.subLedgerId === id)) || ctx.receipts.some(v => v.lines.some(line => line.subLedgerType === subType && line.subLedgerId === id))) reasons.push('مستخدم في تفاصيل سند مالي');
  if (item?.linkedAccountId && ctx.journals.some(entry => entry.lines.some(line => line.accountId === item.linkedAccountId))) reasons.push('حسابه المرتبط له حركة مالية');
  return { action: reasons.length ? 'ARCHIVE' : 'DELETE', reasons: unique(reasons) };
}

export function costCenterRemovalDecision(id: string, ctx: MasterDataReferenceContext): MasterDataRemovalDecision {
  const reasons: string[] = [];
  if (ctx.costCenters.some(item => item.parentId === id)) reasons.push('له مراكز تكلفة فرعية');
  if (ctx.journals.some(entry => entry.lines.some(line => line.costCenterId === id))) reasons.push('مستخدم في قيود اليومية');
  if ([...ctx.vouchers, ...ctx.receipts].some(v => v.lines.some(line => line.costCenterId === id))) reasons.push('مستخدم في سند مالي');
  if (ctx.custodies.some(c => c.costCenterId === id || c.settlements.some(s => s.items.some(item => item.costCenterId === id)))) reasons.push('مستخدم في عهدة');
  return { action: reasons.length ? 'BLOCK' : 'DELETE', reasons: unique(reasons) };
}

export function currencyRemovalDecision(id: string, ctx: MasterDataReferenceContext): MasterDataRemovalDecision {
  const currency = ctx.currencies.find(item => item.id === id);
  if (!currency) return { action: 'BLOCK', reasons: ['العملة غير موجودة'] };
  if (currency.isBase) return { action: 'BLOCK', reasons: ['العملة الأساسية لا يمكن حذفها أو إيقافها'] };
  const code = currency.code;
  const reasons: string[] = [];
  if (ctx.accounts.some(a => a.defaultCurrency === code || a.currencies.some(c => c.code === code) || a.openingBalances?.some(o => o.currency === code))) reasons.push('مرتبطة بدليل الحسابات');
  if ([...ctx.cashBoxes, ...ctx.bankAccounts, ...ctx.employees, ...ctx.customers, ...ctx.vendors].some(item => item.defaultCurrency === code || item.currencies.some(c => c.code === code) || item.openingBalances?.some(o => o.currency === code))) reasons.push('مرتبطة ببطاقة حساب تحليلي');
  if (ctx.journals.some(j => j.currency === code || j.lines.some(line => line.currency === code))) reasons.push('مستخدمة في قيد');
  if ([...ctx.vouchers, ...ctx.receipts].some(v => v.currency === code || v.lines.some(line => line.currency === code))) reasons.push('مستخدمة في سند مالي');
  if (ctx.custodies.some(c => c.currency === code)) reasons.push('مستخدمة في عهدة');
  return { action: reasons.length ? 'ARCHIVE' : 'DELETE', reasons: unique(reasons) };
}
