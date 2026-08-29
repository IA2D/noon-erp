export interface CurrencyRowState {
  foreignAmount: number;
  exchangeRate: number;
  localAmount: number;
}

export const handleCurrencyFieldChange = (
  field: 'foreign' | 'rate' | 'local',
  value: number,
  current: CurrencyRowState,
  ratePrecision: number = 6,
  amountPrecision: number = 2
): CurrencyRowState => {
  const val = Number(value) || 0;

  if (field === 'foreign') {
    const foreignAmount = val;
    const localAmount = multiplyMoney(foreignAmount, current.exchangeRate || 1, amountPrecision);
    return { ...current, foreignAmount, localAmount };
  }

  if (field === 'rate') {
    const exchangeRate = val;
    const localAmount = multiplyMoney(current.foreignAmount || 0, exchangeRate, amountPrecision);
    return { ...current, exchangeRate, localAmount };
  }

  if (field === 'local') {
    const localAmount = val;
    let exchangeRate = current.exchangeRate;
    if (current.foreignAmount && current.foreignAmount > 0) {
      exchangeRate = roundTo(localAmount / current.foreignAmount, ratePrecision);
    }
    return { ...current, localAmount, exchangeRate };
  }

  return current;
};
import { multiplyMoney, roundTo } from './money';
