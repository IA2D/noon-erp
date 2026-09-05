import assert from 'node:assert/strict';
import type { Account } from '../src/types/erp';
import { amountsEqual, currencyDecimals, fromMinorUnits, multiplyMoney, roundTo, toMinorUnits } from '../src/utils/money';
import { buildRealizedExchangeDifferenceJournal, buildUnrealizedRevaluationJournal, calculateRealizedExchangeDifference, deriveForeignBalancePositions, revalueForeignPosition } from '../src/utils/currencyRevaluation';
import { accountsWithCurrencyOpenings, projectPostedJournalsToCurrency } from '../src/utils/currencyReporting';
import { validateJournalForPosting } from '../src/utils/postingValidation';
import { entityOpening, entityOpeningsByCurrency } from '../src/utils/reportData';

const currencies = [
  { id: 'yer', code: 'YER', nameAr: 'ريال', nameEn: 'Rial', symbol: 'ر.ي', decimals: 0, isBase: true, exchangeRate: 1, minExchangeRate: 1, maxExchangeRate: 1, isActive: true, createdAt: '' },
  { id: 'usd', code: 'USD', nameAr: 'دولار', nameEn: 'Dollar', symbol: '$', decimals: 2, isBase: false, exchangeRate: 530.25, minExchangeRate: 1, maxExchangeRate: 1000, isActive: true, createdAt: '' },
];
assert.equal(currencyDecimals('YER', currencies), 0);
assert.equal(currencyDecimals('USD', currencies), 2);
assert.equal(toMinorUnits(12.345, 2), 1235);
assert.equal(fromMinorUnits(1235, 2), 12.35);
assert.equal(multiplyMoney(10.25, 530.25, 0), 5435);
assert.equal(roundTo(1.005, 2), 1.01);
assert.equal(amountsEqual(1.004, 1, 2), true);

const position = revalueForeignPosition({ accountId: 'cash-usd', accountCode: '1101', accountNameAr: 'نقدية دولار', currency: 'USD', foreignBalance: 100, carryingLocalBalance: 50_000, historicalRate: 500 }, 530, 0);
assert.equal(position.revaluedLocalBalance, 53_000);
assert.equal(position.exchangeDifference, 3_000);
assert.equal(calculateRealizedExchangeDifference({ foreignAmount: 100, historicalRate: 500, settlementRate: 525, localDecimals: 0 }), 2_500);

const account = (id: string, code: string, nameAr: string, nature: 'DEBIT' | 'CREDIT'): Account => ({ id, code, nameAr, nameEn: id, level: 5, accountType: 2, reportType: 2, category: 'INCOME_STATEMENT', nature, subLedgerType: 'NONE', currencies: [], defaultCurrency: 'YER', openingBalance: 0, isActive: true });
const cashUsd = account('cash-usd', '1101', 'نقدية دولار', 'DEBIT');
const gain = account('gain', '7101', 'أرباح فروق عملة', 'CREDIT');
const loss = account('loss', '5101', 'خسائر فروق عملة', 'DEBIT');
const realized = buildRealizedExchangeDifferenceJournal({ id: 'fx-realized-1', entryNumber: 'JV-FXR-1', date: '2026-06-01', currency: 'USD', baseCurrency: 'YER', foreignAmount: 100, historicalRate: 500, settlementRate: 525, positionAccount: cashUsd, positionNature: 'ASSET', gainAccount: gain, lossAccount: loss, actor: 'tester', rateSource: 'BANK_RATE', localDecimals: 0 });
assert.ok(realized);
assert.equal(realized!.totalDebit, 2_500);
assert.equal(realized!.totalCredit, 2_500);
assert.equal(realized!.lines[1].accountId, gain.id);
assert.equal(validateJournalForPosting(realized!, [cashUsd, gain, loss], [], currencies).valid, true);
const derived = deriveForeignBalancePositions([cashUsd], [{ id: 'j-source', entryNumber: 'JV-1', date: '2026-01-01', reference: '', narration: '', lines: [{ id: 'l1', accountId: cashUsd.id, accountCode: cashUsd.code, accountNameAr: cashUsd.nameAr, debit: 50_000, credit: 0, debitForeign: 100, currency: 'USD', exchangeRate: 500, description: '' }], totalDebit: 50_000, totalCredit: 50_000, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: 'tester', createdAt: '' }], currencies, '2026-12-31', 0);
assert.equal(derived.length, 1);
assert.equal(derived[0].foreignBalance, 100);
assert.equal(derived[0].historicalRate, 500);
const projectedAtAnyCurrentRate = projectPostedJournalsToCurrency([{ id: 'j-history', entryNumber: 'JV-H', date: '2026-01-01', reference: '', narration: '', lines: [{ id: 'l-history', accountId: cashUsd.id, accountCode: cashUsd.code, accountNameAr: cashUsd.nameAr, debit: 50_000, credit: 0, debitForeign: 100, currency: 'USD', exchangeRate: 500, description: '' }], totalDebit: 50_000, totalCredit: 50_000, currency: 'YER', exchangeRate: 1, status: 'POSTED', createdBy: '', createdAt: '' }], 'USD', 'YER', 2);
assert.equal(projectedAtAnyCurrentRate[0].lines[0].debit, 100);
const openingUsd = accountsWithCurrencyOpenings([{ ...cashUsd, openingBalances: [{ id: 'op-usd', accountId: cashUsd.id, currency: 'USD', exchangeRate: 490, debit: 25.5, credit: 0, debitLocal: 12_495, creditLocal: 0 }] }], 'USD', 'YER', 2);
assert.equal(openingUsd[0].openingBalance, 25.5);
const cashBoxOpening = {
  id: 'cash-usd',
  openingBalance: 12_495,
  openingBalanceForeign: 25.5,
  openingCurrency: 'USD',
  openingBalances: [{ id: 'legacy-usd-opening', accountId: 'cash-usd', currency: 'USD', exchangeRate: 490, debit: 0, credit: 0, debitLocal: 0, creditLocal: 0, amount: 12_495, foreignAmount: 25.5 }],
};
assert.equal(entityOpening(cashBoxOpening, 'USD', 'YER'), 25.5);
assert.equal(entityOpening(cashBoxOpening, 'YER', 'YER'), 12_495);
assert.deepEqual(entityOpeningsByCurrency(cashBoxOpening, 'YER'), { USD: 25.5 });
const legacyCashBox = { id: 'legacy-cash-usd', openingBalance: 12_495, openingBalanceForeign: 25.5, openingCurrency: 'USD' };
assert.deepEqual(entityOpeningsByCurrency(legacyCashBox, 'YER'), { USD: 25.5 });
const journal = buildUnrealizedRevaluationJournal({ id: 'fx-1', entryNumber: 'JV-FX-1', date: '2026-12-31', baseCurrency: 'YER', positions: [position], gainAccount: gain, lossAccount: loss, actor: 'tester', localDecimals: 0 });
assert.ok(journal);
assert.equal(journal!.totalDebit, 3_000);
assert.equal(journal!.totalCredit, 3_000);
assert.equal(journal!.lines[0].rateType, 'CLOSING');
assert.equal(journal!.rateSource, 'PERIOD_REVALUATION');

console.log('CURRENCY_REGRESSION_OK currencyDecimals=true minorUnits=true deterministicRounding=true historicalRate=true historicalReportInvariant=true originalOpening=true cashBoxOpening=true derivedPositions=true realizedDifference=2500 realizedJournalBalanced=true unrealizedDifference=3000 balancedRevaluation=true rateEvidence=true');
