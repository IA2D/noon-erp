import type { Account, Currency, ExchangeRateType, JournalEntry, JournalLine } from '../types/erp';
import { multiplyMoney, roundTo } from './money';

export interface ForeignBalancePosition {
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  currency: string;
  foreignBalance: number;
  carryingLocalBalance: number;
  historicalRate: number;
}

export interface RevaluationResult extends ForeignBalancePosition {
  closingRate: number;
  revaluedLocalBalance: number;
  exchangeDifference: number;
}

export interface RealizedExchangeDifferenceInput {
  foreignAmount: number;
  historicalRate: number;
  settlementRate: number;
  localDecimals?: number;
}

export function deriveForeignBalancePositions(
  accounts: Account[],
  journals: JournalEntry[],
  currencies: Currency[],
  throughDate: string,
  localDecimals = 2
): ForeignBalancePosition[] {
  const baseCode = currencies.find(item => item.isBase)?.code;
  const activeForeign = new Set(currencies.filter(item => item.isActive && !item.isBase).map(item => item.code));
  const accountById = new Map(accounts.map(account => [account.id, account]));
  const aggregate = new Map<string, { foreign: number; local: number }>();
  journals.filter(entry => entry.status === 'POSTED' && entry.date <= throughDate && !entry.reference.startsWith('FX-REVALUE-')).forEach(entry => {
    entry.lines.forEach(line => {
      const code = line.currency || entry.currency;
      if (!code || code === baseCode || !activeForeign.has(code)) return;
      const foreign = (Number(line.debitForeign) || 0) - (Number(line.creditForeign) || 0);
      if (!foreign) return;
      const key = `${line.accountId}::${code}`;
      const current = aggregate.get(key) || { foreign: 0, local: 0 };
      current.foreign += foreign;
      current.local += (Number(line.debit) || 0) - (Number(line.credit) || 0);
      aggregate.set(key, current);
    });
  });
  return Array.from(aggregate.entries()).flatMap(([key, value]) => {
    const [accountId, currency] = key.split('::');
    const account = accountById.get(accountId);
    const foreignBalance = roundTo(value.foreign, currencies.find(item => item.code === currency)?.decimals ?? 2);
    if (!account || foreignBalance === 0) return [];
    const carryingLocalBalance = roundTo(value.local, localDecimals);
    return [{
      accountId,
      accountCode: account.code,
      accountNameAr: account.nameAr,
      currency,
      foreignBalance,
      carryingLocalBalance,
      historicalRate: roundTo(Math.abs(carryingLocalBalance / foreignBalance), 8),
    }];
  }).sort((a, b) => a.currency.localeCompare(b.currency) || a.accountCode.localeCompare(b.accountCode));
}

export function calculateRealizedExchangeDifference(input: RealizedExchangeDifferenceInput): number {
  const decimals = input.localDecimals ?? 2;
  const historical = multiplyMoney(input.foreignAmount, input.historicalRate, decimals);
  const settled = multiplyMoney(input.foreignAmount, input.settlementRate, decimals);
  return roundTo(settled - historical, decimals);
}

export interface RealizedExchangeJournalOptions extends RealizedExchangeDifferenceInput {
  id: string;
  entryNumber: string;
  date: string;
  currency: string;
  baseCurrency: string;
  positionAccount: Account;
  positionNature: 'ASSET' | 'LIABILITY';
  gainAccount: Account;
  lossAccount: Account;
  actor: string;
  rateSource: string;
  rateOverrideReason?: string;
  rateApprovedBy?: string;
}

export function buildRealizedExchangeDifferenceJournal(options: RealizedExchangeJournalOptions): JournalEntry | null {
  if (!(options.foreignAmount > 0) || !(options.historicalRate > 0) || !(options.settlementRate > 0)) throw new RangeError('Foreign amount and both rates must be positive.');
  const decimals = options.localDecimals ?? 2;
  const delta = calculateRealizedExchangeDifference(options);
  if (!delta) return null;
  const isGain = options.positionNature === 'ASSET' ? delta > 0 : delta < 0;
  const difference = Math.abs(delta);
  const positionDebit = options.positionNature === 'ASSET' ? delta > 0 : delta < 0;
  const counterAccount = isGain ? options.gainAccount : options.lossAccount;
  const lines: JournalLine[] = [
    {
      id: `${options.id}-position`, accountId: options.positionAccount.id, accountCode: options.positionAccount.code, accountNameAr: options.positionAccount.nameAr,
      debit: positionDebit ? difference : 0, credit: positionDebit ? 0 : difference,
      currency: options.currency, exchangeRate: options.settlementRate, debitForeign: 0, creditForeign: 0, isExchangeDifferenceAdjustment: true,
      rateType: 'TRANSACTION', rateEffectiveDate: options.date, rateSource: options.rateSource,
      rateOverrideReason: options.rateOverrideReason, rateApprovedBy: options.rateApprovedBy,
      description: `تسوية فرق عملة محقق (${options.foreignAmount} ${options.currency}: ${options.historicalRate} ← ${options.settlementRate})`,
    },
    {
      id: `${options.id}-difference`, accountId: counterAccount.id, accountCode: counterAccount.code, accountNameAr: counterAccount.nameAr,
      debit: positionDebit ? 0 : difference, credit: positionDebit ? difference : 0,
      currency: options.baseCurrency, exchangeRate: 1,
      rateType: 'TRANSACTION', rateEffectiveDate: options.date, rateSource: options.rateSource,
      description: isGain ? 'أرباح فروق عملة محققة' : 'خسائر فروق عملة محققة',
    },
  ];
  const now = new Date().toISOString();
  return {
    id: options.id, entryNumber: options.entryNumber, date: options.date, reference: `FX-REALIZED-${options.id}`,
    narration: `فرق عملة محقق عند تسوية ${options.foreignAmount} ${options.currency}`,
    lines, totalDebit: difference, totalCredit: difference, currency: options.baseCurrency, exchangeRate: 1,
    rateType: 'TRANSACTION', rateEffectiveDate: options.date, rateSource: options.rateSource,
    rateOverrideReason: options.rateOverrideReason, rateApprovedBy: options.rateApprovedBy,
    status: 'PENDING_POSTING', type: 'JV', sourceType: 'MANUAL', createdBy: options.actor, createdAt: now,
  };
}

export function revalueForeignPosition(position: ForeignBalancePosition, closingRate: number, localDecimals = 2): RevaluationResult {
  if (!(closingRate > 0)) throw new RangeError('Closing rate must be positive.');
  const revaluedLocalBalance = multiplyMoney(position.foreignBalance, closingRate, localDecimals);
  return {
    ...position,
    closingRate,
    revaluedLocalBalance,
    exchangeDifference: roundTo(revaluedLocalBalance - position.carryingLocalBalance, localDecimals),
  };
}

export interface RevaluationJournalOptions {
  id: string;
  entryNumber: string;
  date: string;
  baseCurrency: string;
  positions: RevaluationResult[];
  gainAccount: Account;
  lossAccount: Account;
  actor: string;
  localDecimals?: number;
}

export function buildUnrealizedRevaluationJournal(options: RevaluationJournalOptions): JournalEntry | null {
  const decimals = options.localDecimals ?? 2;
  const nonZero = options.positions.filter(item => roundTo(item.exchangeDifference, decimals) !== 0);
  if (!nonZero.length) return null;
  const lines: JournalLine[] = nonZero.map((item, index) => {
    const diff = roundTo(item.exchangeDifference, decimals);
    return {
      id: `${options.id}-position-${index + 1}`,
      accountId: item.accountId,
      accountCode: item.accountCode,
      accountNameAr: item.accountNameAr,
      debit: diff > 0 ? diff : 0,
      credit: diff < 0 ? Math.abs(diff) : 0,
      debitForeign: 0,
      creditForeign: 0,
      isExchangeDifferenceAdjustment: true,
      currency: item.currency,
      exchangeRate: item.closingRate,
      rateType: 'CLOSING',
      rateEffectiveDate: options.date,
      rateSource: 'PERIOD_REVALUATION',
      description: `إعادة تقييم رصيد ${item.currency} بسعر الإقفال ${item.closingRate}`,
    };
  });
  const positionDebit = roundTo(lines.reduce((sum, line) => sum + line.debit, 0), decimals);
  const positionCredit = roundTo(lines.reduce((sum, line) => sum + line.credit, 0), decimals);
  const net = roundTo(positionDebit - positionCredit, decimals);
  const offset = net > 0 ? options.gainAccount : options.lossAccount;
  lines.push({
    id: `${options.id}-offset`,
    accountId: offset.id,
    accountCode: offset.code,
    accountNameAr: offset.nameAr,
    debit: net < 0 ? Math.abs(net) : 0,
    credit: net > 0 ? net : 0,
    currency: options.baseCurrency,
    exchangeRate: 1,
    rateType: 'CLOSING',
    rateEffectiveDate: options.date,
    rateSource: 'PERIOD_REVALUATION',
    description: net > 0 ? 'أرباح فروق عملة غير محققة' : 'خسائر فروق عملة غير محققة',
  });
  const totalDebit = roundTo(lines.reduce((sum, line) => sum + line.debit, 0), decimals);
  const totalCredit = roundTo(lines.reduce((sum, line) => sum + line.credit, 0), decimals);
  const now = new Date().toISOString();
  return {
    id: options.id,
    entryNumber: options.entryNumber,
    date: options.date,
    reference: `FX-REVALUE-${options.date}`,
    narration: `إعادة تقييم العملات الأجنبية بتاريخ ${options.date}`,
    lines,
    totalDebit,
    totalCredit,
    currency: options.baseCurrency,
    exchangeRate: 1,
    rateType: 'CLOSING' as ExchangeRateType,
    rateEffectiveDate: options.date,
    rateSource: 'PERIOD_REVALUATION',
    status: 'PENDING_POSTING',
    type: 'JV',
    sourceType: 'MANUAL',
    createdBy: options.actor,
    createdAt: now,
  };
}
