import {useMemo} from 'react';
import {Users, Info} from 'lucide-react';
import type {Account} from '../../../types/erp';
import type {SubLedgerKind, SubLedgerRow} from './types';
import {SUB_LEDGER_KIND_LABEL, zeroRow, localOf, round2} from './types';
import {fmtAmountCur} from '../../../utils/format';
import type {ExchangeRateBounds} from '../../../utils/exchangeRate';
import AmountInput from '../../AmountInput';
import ExchangeRateField from '../../ui/ExchangeRateField';
import {useModalStackEntry} from '../../ui/ModalStack';
import ModalHeader from '../../ui/ModalHeader';

interface Props {
  open: boolean;
  account: Account | null;
  entities: SubLedgerRow[];
  currencyOptionsFor: (entity: SubLedgerRow) => string[];
  baseCode: string;
  rateOf: (code: string) => number;
  /** النطاق المسموح لسعر تحويل العملة (min/max) من دليل العملات */
  boundsOf: (code: string) => ExchangeRateBounds;
  onChange: (entityId: string, field: 'debit' | 'credit' | 'debitForeign' | 'creditForeign' | 'rate', raw: string) => void;
  onCurrencyChange: (entityId: string, code: string) => void;
  onClose: () => void;
}

const KIND_BADGE: Record<SubLedgerKind, string> = {
  CASH_BOX: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  BANK: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  CUSTOMER: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  VENDOR: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  EMPLOYEE: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export default function SubLedgerDetailModal({open, account, entities, currencyOptionsFor, baseCode, rateOf, boundsOf, onChange, onCurrencyChange, onClose}: Props) {
  const {zIndex} = useModalStackEntry('subledger-detail', {open, onClose});
  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    entities.forEach(e => {
      const local = localOf(e.row, baseCode, rateOf);
      debit += local.debit;
      credit += local.credit;
    });
    return {debit: round2(debit), credit: round2(credit)};
  }, [entities, baseCode, rateOf]);

  if (!open || !account) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      style={{zIndex}}
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl border border-slate-700/80 w-full max-w-4xl overflow-hidden bg-slate-900/90 text-white flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader
          icon={Users}
          title={`تفكيك الأرصدة الافتتاحية — ${account.code} ${account.nameAr}`}
          subtitle="أدخل رصيد كل كيان مساعد على حدة — يُجمَع الإجمالي آلياً في السطر الرئيسي للحساب (غير قابل للتعديل المباشر)"
          onClose={onClose}
        />

        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {entities.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              لا توجد كيانات مساعدة مرتبطة بهذا الحساب. أضف كيانات (صناديق/بنوك/عملاء/موردين/موظفين) واربطها بالحساب من شاشاتها.
            </div>
          ) : (
            <div className="p-4">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-right text-[12.5px]">
                  <thead className="sticky top-0 z-10 bg-slate-800/80 text-slate-200 font-bold text-sm border-b border-slate-800">
                    <tr className="border-b border-slate-800">
                      <th className="py-2.5 px-3">الكيان</th>
                      <th className="py-2.5 px-3">النوع</th>
                      <th className="py-2.5 px-3 w-24">العملة</th>
                      <th className="py-2.5 px-3 w-28">سعر التحويل</th>
                      <th className="py-2.5 px-3 w-40 text-left">مدين</th>
                      <th className="py-2.5 px-3 w-40 text-left">دائن</th>
                      <th className="py-2.5 px-3 w-40 text-left">مدين أجنبي</th>
                      <th className="py-2.5 px-3 w-40 text-left">دائن أجنبي</th>
                      <th className="py-2.5 px-3 w-32 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {entities.map(en => {
                      const foreign = en.row.currency !== baseCode;
                      const local = localOf(en.row, baseCode, rateOf);
                      const net = round2(local.debit - local.credit);
                      return (
                        <tr key={en.id} className="hover:bg-white/[0.03]">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-200 whitespace-nowrap">{en.nameAr}</div>
                            <div className="text-xs text-slate-500 font-mono" dir="ltr">{en.code}</div>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${KIND_BADGE[en.kind]}`}>
                              {SUB_LEDGER_KIND_LABEL[en.kind]}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={en.row.currency}
                              onClick={e => e.stopPropagation()}
                              onChange={e => onCurrencyChange(en.id, e.target.value)}
                              className="w-full px-2 py-2 text-sm glass-input rounded-xl font-mono text-slate-200 text-center"
                            >
                              {currencyOptionsFor(en).map(code => (
                                <option key={code} value={code}>{code}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            <ExchangeRateField
                              value={en.row.rate ?? 1}
                              onChange={v => onChange(en.id, 'rate', String(v))}
                              disabled={!foreign}
                              isBase={!foreign}
                              min={boundsOf(en.row.currency).min}
                              max={boundsOf(en.row.currency).max}
                              currencyCode={en.row.currency}
                              compact
                              inputClassName="w-full px-2 py-2 text-sm glass-input rounded-xl font-mono text-slate-200 text-center disabled:opacity-40"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <AmountInput
                              value={en.row.debit}
                              disabled={foreign}
                              onClick={e => e.stopPropagation()}
                              onChange={v => onChange(en.id, 'debit', v)}
                              className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-emerald-300 text-left disabled:opacity-60"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <AmountInput
                              value={en.row.credit}
                              disabled={foreign}
                              onClick={e => e.stopPropagation()}
                              onChange={v => onChange(en.id, 'credit', v)}
                              className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-amber-300 text-left disabled:opacity-60"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <AmountInput
                              value={en.row.debitForeign}
                              disabled={!foreign}
                              onClick={e => e.stopPropagation()}
                              onChange={v => onChange(en.id, 'debitForeign', v)}
                              className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-amber-300 text-left disabled:opacity-40"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <AmountInput
                              value={en.row.creditForeign}
                              disabled={!foreign}
                              onClick={e => e.stopPropagation()}
                              onChange={v => onChange(en.id, 'creditForeign', v)}
                              className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-amber-200 text-left disabled:opacity-40"
                            />
                          </td>
                          <td className="py-2 px-3 text-left">
                            <span className={`font-mono font-bold ${net > 0 ? 'text-emerald-300' : net < 0 ? 'text-amber-300' : 'text-slate-500'}`} dir="ltr">
                              {fmtAmountCur(net, baseCode)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-800/80 font-bold text-[12.5px] text-slate-200 border-t border-slate-800">
                    <tr className="border-t border-slate-800">
                      <td colSpan={4} className="py-2.5 px-3">إجمالي المساعدين ({entities.length}) — يُحقن في {account.code}</td>
                      <td className="py-2.5 px-3 text-left font-mono text-emerald-400" dir="ltr">{fmtAmountCur(totals.debit, baseCode)}</td>
                      <td className="py-2.5 px-3 text-left font-mono text-amber-400" dir="ltr">{fmtAmountCur(totals.credit, baseCode)}</td>
                      <td colSpan={2} className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-left font-mono text-white" dir="ltr">{fmtAmountCur(round2(totals.debit - totals.credit), baseCode)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/70 flex-shrink-0 flex justify-end gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400 mr-auto">
            <Info className="w-3.5 h-3.5" />
            يدعم التنقل بالأسهم Enter / Tab / أسهم اللوحة داخل الحقول.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold rounded-xl bg-sky-500/15 hover:bg-sky-400 text-white shadow-lg transition-all cursor-pointer"
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
}
