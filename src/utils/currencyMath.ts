import { multiplyMoney, roundTo } from './money';

export interface CurrencyRowState {
  foreignAmount: number;
  exchangeRate: number;
  localAmount: number;
}

export const handleCurrencyFieldChange = (
  field: 'foreign' | 'rate' | 'local',
  value: number,
  current: CurrencyRowState,
  ratePrecision: number = EXCHANGE_RATE_PRECISION,
  amountPrecision: number = 2,
  /** لا تعاير السعر أثناء الكتابة؛ تستخدم عند تثبيت القيمة (blur/save) فقط. */
  reconcileExistingForeign: boolean = false,
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
    const existingForeign = Number(current.foreignAmount) || 0;
    const currentRate = Number(current.exchangeRate) || 1;
    // عند إدخال المحلي أولاً لا نعيده إلى صفر في الحقل الخاضع للتحكم:
    // نشتق المقابل الأجنبي من السعر الحالي. أما عند وجود مبلغ أجنبي سابق
    // فنحافظ عليه ونعاير السعر كي يظل الطرفان متوافقين.
    if (existingForeign > 0 && reconcileExistingForeign) {
      const exchangeRate = roundTo(localAmount / existingForeign, ratePrecision);
      return { ...current, localAmount, exchangeRate };
    }
    // أثناء الكتابة يظل سعر الصرف ثابتاً ويُحدّث المقابل الأجنبي؛ لا يجوز أن
    // يقفز السعر بعد كل رقم بسبب مبلغ أجنبي مقرب من ضغطة سابقة.
    const foreignAmount = currentRate > 0
      ? roundTo(localAmount / currentRate, amountPrecision)
      : 0;
    return { ...current, foreignAmount, localAmount, exchangeRate: currentRate };
  }

  return current;
};
/** دقة سعر الصرف تحفظ الكسور اللازمة لتسوية فروقات التقريب المحلية. */
export const EXCHANGE_RATE_PRECISION = 8;


export interface ForeignRateLine {
  currency?: string;
  amount?: number;
  exchangeRate?: number;
  localAmount?: number;
}

/**
 * يضبط سعر صرف السطر الأجنبي الوحيد ليطابق إجماليًا محليًا مُدخلًا يدويًا.
 * لا يغيّر المبلغ الأجنبي ولا يتدخل عندما توجد عدة أسطر أجنبية، لأن توزيع
 * فرقها يحتاج قرار المستخدم. يعيد نفس العناصر عند عدم وجود تسوية آمنة.
 */
export function reconcileSingleForeignLineToLocalTotal<T extends ForeignRateLine>(
  lines: T[],
  targetLocalTotal: number,
  baseCurrency: string,
  localDecimals = 2,
  ratePrecision = EXCHANGE_RATE_PRECISION,
  acceptRate: (rate: number, currency: string) => boolean = () => true,
): { lines: T[]; adjusted: boolean; rate?: number } {
  const target = roundTo(Number(targetLocalTotal) || 0, localDecimals);
  if (target <= 0) return { lines, adjusted: false };

  const foreignIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !!line.currency && line.currency !== baseCurrency && (Number(line.amount) || 0) > 0);
  if (foreignIndexes.length !== 1) return { lines, adjusted: false };

  const fixedLocal = lines.reduce((sum, line, index) => {
    if (index === foreignIndexes[0].index) return sum;
    const amount = Number(line.amount) || 0;
    const local = line.currency && line.currency !== baseCurrency
      ? multiplyMoney(amount, Number(line.exchangeRate) || 1, localDecimals)
      : roundTo(Number(line.localAmount ?? amount) || 0, localDecimals);
    return sum + local;
  }, 0);
  const requiredLocal = roundTo(target - fixedLocal, localDecimals);
  const candidate = foreignIndexes[0];
  const foreignAmount = Number(candidate.line.amount) || 0;
  if (requiredLocal <= 0 || foreignAmount <= 0) return { lines, adjusted: false };

  const rate = roundTo(requiredLocal / foreignAmount, ratePrecision);
  if (!(rate > 0) || !acceptRate(rate, candidate.line.currency!)) return { lines, adjusted: false };
  const next = lines.map((line, index) => index === candidate.index
    ? { ...line, exchangeRate: rate, localAmount: requiredLocal }
    : line);
  return { lines: next, adjusted: true, rate };
}
