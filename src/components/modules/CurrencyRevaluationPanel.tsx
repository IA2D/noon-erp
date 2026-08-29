import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import type { Account, Currency, JournalEntry } from '../../types/erp';
import { buildRealizedExchangeDifferenceJournal, buildUnrealizedRevaluationJournal, deriveForeignBalancePositions, revalueForeignPosition } from '../../utils/currencyRevaluation';
import { currencyDecimals, formatMoney } from '../../utils/money';
import { isPostingAccount, nextJournalNumber } from '../../utils/accountingEngine';
import { useToast } from '../ui/Toast';

interface Props {
  year: string;
  accounts: Account[];
  journals: JournalEntry[];
  currencies: Currency[];
  currentUserName: string;
  onCreateJournal: (entry: JournalEntry) => boolean | void;
}

export default function CurrencyRevaluationPanel({ year, accounts, journals, currencies, currentUserName, onCreateJournal }: Props) {
  const toast = useToast();
  const base = currencies.find(item => item.isBase);
  const baseDecimals = currencyDecimals(base?.code, currencies);
  const throughDate = `${year}-12-31`;
  const positions = useMemo(() => deriveForeignBalancePositions(accounts, journals, currencies, throughDate, baseDecimals), [accounts, journals, currencies, throughDate, baseDecimals]);
  const currencyCodes = useMemo(() => [...new Set(positions.map(item => item.currency))], [positions]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const postingAccounts = useMemo(() => accounts.filter(isPostingAccount), [accounts]);
  const guessedGain = postingAccounts.find(item => item.nameAr.includes('فروق عملة') && (item.nature === 'CREDIT' || item.nameAr.includes('أرباح')))?.id || '';
  const guessedLoss = postingAccounts.find(item => item.nameAr.includes('فروق عملة') && (item.nature === 'DEBIT' || item.nameAr.includes('خسائر')))?.id || '';
  const [gainAccountId, setGainAccountId] = useState(guessedGain);
  const [lossAccountId, setLossAccountId] = useState(guessedLoss);
  const foreignCurrencies = currencies.filter(item => item.isActive && !item.isBase);
  const [settlementCurrency, setSettlementCurrency] = useState(foreignCurrencies[0]?.code || '');
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [positionNature, setPositionNature] = useState<'ASSET' | 'LIABILITY'>('ASSET');
  const [foreignAmount, setForeignAmount] = useState(0);
  const [historicalRate, setHistoricalRate] = useState(0);
  const [settlementRate, setSettlementRate] = useState(0);
  const [rateSource, setRateSource] = useState('BANK_RATE');
  const [overrideReason, setOverrideReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');

  useEffect(() => {
    setRates(current => Object.fromEntries(currencyCodes.map(code => [code, current[code] || currencies.find(item => item.code === code)?.exchangeRate || 0])));
  }, [currencyCodes, currencies]);

  const results = useMemo(() => positions.flatMap(position => rates[position.currency] > 0 ? [revalueForeignPosition(position, rates[position.currency], baseDecimals)] : []), [positions, rates, baseDecimals]);
  const totalDifference = results.reduce((sum, item) => sum + item.exchangeDifference, 0);
  const existing = journals.some(item => item.id === `fx-revaluation-${year}` || item.reference === `FX-REVALUE-${throughDate}`);
  const create = () => {
    const gainAccount = accounts.find(item => item.id === gainAccountId);
    const lossAccount = accounts.find(item => item.id === lossAccountId);
    if (!gainAccount || !lossAccount || results.length !== positions.length) {
      toast('error', 'حدد حسابي أرباح وخسائر فروق العملة وأدخل سعر إقفال موجباً لكل عملة.');
      return;
    }
    const entry = buildUnrealizedRevaluationJournal({ id: `fx-revaluation-${year}`, entryNumber: nextJournalNumber(journals), date: throughDate, baseCurrency: base?.code || 'YER', positions: results, gainAccount, lossAccount, actor: currentUserName, localDecimals: baseDecimals });
    if (!entry) {
      toast('info', 'لا توجد فروق إعادة تقييم تحتاج إلى قيد.');
      return;
    }
    const saved = onCreateJournal(entry);
    toast(saved === false ? 'error' : 'success', saved === false ? 'تعذر إنشاء قيد إعادة التقييم.' : `تم إنشاء بانتظار الترحيل قيد إعادة التقييم ${entry.entryNumber}. راجعها ثم رحّلها قبل الإقفال النهائي.`);
  };

  const createRealized = () => {
    const positionAccount = accounts.find(item => item.id === settlementAccountId);
    const gainAccount = accounts.find(item => item.id === gainAccountId);
    const lossAccount = accounts.find(item => item.id === lossAccountId);
    if (!positionAccount || !gainAccount || !lossAccount || !settlementCurrency || !(foreignAmount > 0) || !(historicalRate > 0) || !(settlementRate > 0) || !rateSource.trim()) {
      toast('error', 'أكمل بيانات التسوية وحساب المركز وحسابي فروق العملة ومصدر السعر.');
      return;
    }
    const id = `fx-realized-${Date.now()}`;
    const entry = buildRealizedExchangeDifferenceJournal({ id, entryNumber: nextJournalNumber(journals), date: throughDate, currency: settlementCurrency, baseCurrency: base?.code || 'YER', foreignAmount, historicalRate, settlementRate, positionAccount, positionNature, gainAccount, lossAccount, actor: currentUserName, rateSource: rateSource.trim(), rateOverrideReason: overrideReason.trim() || undefined, rateApprovedBy: approvedBy.trim() || undefined, localDecimals: baseDecimals });
    if (!entry) {
      toast('info', 'السعر التاريخي يساوي سعر التسوية، لذلك لا يوجد فرق محقق.');
      return;
    }
    const saved = onCreateJournal(entry);
    toast(saved === false ? 'error' : 'success', saved === false ? 'تعذر إنشاء قيد الفرق المحقق.' : `تم إنشاء بانتظار الترحيل ${entry.entryNumber} لفرق العملة المحقق.`);
  };

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-violet-500/20 bg-violet-500/10">
        <ArrowLeftRight className="w-5 h-5 text-violet-300" />
        <div className="flex-1">
          <div className="font-bold text-white text-sm">إعادة تقييم العملات الأجنبية قبل الإقفال</div>
          <p className="text-xs text-slate-400">الرصيد الأصلي × سعر الإقفال، مع قيد أرباح/خسائر غير محققة محفوظ السعر والمصدر</p>
        </div>
        {existing && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><CheckCircle2 className="w-4 h-4" />القيد موجود</span>}
      </div>
      {!positions.length ? <div className="p-4 text-xs text-slate-400">لا توجد أرصدة أجنبية موثقة بالعملة الأصلية حتى {throughDate}.</div> : (
        <div className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {currencyCodes.map(code => <label key={code} className="text-xs font-bold text-slate-300">سعر إقفال {code}<input type="number" min="0" step="any" value={rates[code] || ''} onChange={event => setRates(current => ({ ...current, [code]: Number(event.target.value) }))} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono" /></label>)}
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="text-slate-400"><tr><th className="p-2">الحساب</th><th className="p-2">العملة</th><th className="p-2 text-left">الرصيد الأصلي</th><th className="p-2 text-left">القيمة الدفترية</th><th className="p-2 text-left">بعد التقييم</th><th className="p-2 text-left">الفرق</th></tr></thead><tbody>{results.map(item => <tr key={`${item.accountId}-${item.currency}`} className="border-t border-slate-800"><td className="p-2 text-white">{item.accountCode} — {item.accountNameAr}</td><td className="p-2 font-mono text-violet-300">{item.currency}</td><td className="p-2 text-left font-mono">{formatMoney(item.foreignBalance, currencyDecimals(item.currency, currencies))}</td><td className="p-2 text-left font-mono">{formatMoney(item.carryingLocalBalance, baseDecimals)}</td><td className="p-2 text-left font-mono">{formatMoney(item.revaluedLocalBalance, baseDecimals)}</td><td className={`p-2 text-left font-mono font-bold ${item.exchangeDifference >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(item.exchangeDifference, baseDecimals)}</td></tr>)}</tbody></table></div>
          <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-slate-300">حساب أرباح فروق العملة<select value={gainAccountId} onChange={event => setGainAccountId(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"><option value="">اختر الحساب</option>{postingAccounts.map(item => <option key={item.id} value={item.id}>{item.code} — {item.nameAr}</option>)}</select></label><label className="text-xs font-bold text-slate-300">حساب خسائر فروق العملة<select value={lossAccountId} onChange={event => setLossAccountId(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"><option value="">اختر الحساب</option>{postingAccounts.map(item => <option key={item.id} value={item.id}>{item.code} — {item.nameAr}</option>)}</select></label></div>
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-300">صافي فرق التقييم: <b className="font-mono text-white">{formatMoney(totalDifference, baseDecimals)} {base?.code}</b></span><button type="button" onClick={create} disabled={existing || results.length !== positions.length} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold disabled:opacity-40">إنشاء بانتظار الترحيل قيد إعادة التقييم</button></div>
        </div>
      )}
      <div className="border-t border-violet-500/20 p-4 space-y-3 bg-slate-950/30">
        <div><div className="font-bold text-white text-sm">فرق عملة محقق عند التسوية</div><p className="text-xs text-slate-400">ينشئ قيد تعديل مستقل من السعر التاريخي إلى سعر التسوية مع حفظ المصدر والاعتماد.</p></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-slate-300">العملة<select value={settlementCurrency} onChange={event => setSettlementCurrency(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white">{foreignCurrencies.map(item => <option key={item.code} value={item.code}>{item.code} — {item.nameAr}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-300">حساب المركز<select value={settlementAccountId} onChange={event => setSettlementAccountId(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"><option value="">اختر الحساب</option>{postingAccounts.map(item => <option key={item.id} value={item.id}>{item.code} — {item.nameAr}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-300">طبيعة المركز<select value={positionNature} onChange={event => setPositionNature(event.target.value as 'ASSET' | 'LIABILITY')} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"><option value="ASSET">أصل / رصيد مدين</option><option value="LIABILITY">التزام / رصيد دائن</option></select></label>
          <label className="text-xs font-bold text-slate-300">المبلغ الأصلي<input type="number" min="0" step="any" value={foreignAmount || ''} onChange={event => setForeignAmount(Number(event.target.value))} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono" /></label>
          <label className="text-xs font-bold text-slate-300">السعر التاريخي<input type="number" min="0" step="any" value={historicalRate || ''} onChange={event => setHistoricalRate(Number(event.target.value))} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono" /></label>
          <label className="text-xs font-bold text-slate-300">سعر التسوية<input type="number" min="0" step="any" value={settlementRate || ''} onChange={event => setSettlementRate(Number(event.target.value))} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono" /></label>
          <label className="text-xs font-bold text-slate-300">مصدر السعر<input value={rateSource} onChange={event => setRateSource(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white" /></label>
          <label className="text-xs font-bold text-slate-300">المعتمد<input value={approvedBy} onChange={event => setApprovedBy(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white" /></label>
        </div>
        <div className="flex flex-wrap items-end gap-3"><label className="flex-1 min-w-[240px] text-xs font-bold text-slate-300">سبب تجاوز/تعديل السعر<input value={overrideReason} onChange={event => setOverrideReason(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white" /></label><button type="button" onClick={createRealized} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold">إنشاء بانتظار الترحيل فرق محقق</button></div>
      </div>
    </div>
  );
}
