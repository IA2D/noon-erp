import { useMemo, useRef } from 'react';
import { Search, Eye, EyeOff, ChevronDown, ChevronUp, ListTree, Coins, Keyboard } from 'lucide-react';
import type { Account } from '../../../types/erp';
import type { CategoryTab, RowState } from './types';
import { CATEGORY_TABS, localOf, round2, SUB_LEDGER_KIND_LABEL, zeroRow } from './types';
import { fmtAmountCur } from '../../../utils/format';
import type { ExchangeRateBounds } from '../../../utils/exchangeRate';
import F9SearchInput from '../../ui/F9SearchInput';
import AmountInput from '../../AmountInput';
import ExchangeRateField from '../../ui/ExchangeRateField';

interface Props {
  postingAccounts: Account[];
  rows: Record<string, RowState>;
  subLedgerTotals: Record<string, RowState>;
  controlAccountIds: Set<string>;
  controlEntitiesCount: (accountId: string) => number;
  controlKindOf: (accountId: string) => string;
  controlKindLabelOf: (accountId: string) => string;
  category: CategoryTab;
  onCategory: (c: CategoryTab) => void;
  searchTerm: string;
  onSearchTerm: (s: string) => void;
  hideZero: boolean;
  onHideZero: (v: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  baseCode: string;
  rateOf: (code: string) => number;
  boundsOf: (code: string) => ExchangeRateBounds;
  currencyOptionsFor: (acc: Account) => string[];
  onSetRowCurrency: (accountId: string, code: string) => void;
  onSetValue: (accountId: string, field: 'debit' | 'credit' | 'debitForeign' | 'creditForeign' | 'rate', raw: string) => void;
  onOpenSubLedger: (accountId: string) => void;
}

const NATURE_BADGES: Record<string, string> = {
  DEBIT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CREDIT: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const KIND_DOT: Record<string, string> = {
  CASH_BOX: 'bg-emerald-400',
  BANK: 'bg-sky-400',
  CUSTOMER: 'bg-sky-400',
  VENDOR: 'bg-amber-400',
  EMPLOYEE: 'bg-rose-400',
};

export default function OpeningBalancesTable({
  postingAccounts,
  rows,
  subLedgerTotals,
  controlAccountIds,
  controlEntitiesCount,
  category,
  onCategory,
  searchTerm,
  onSearchTerm,
  hideZero,
  onHideZero,
  selectedId,
  onSelect,
  baseCode,
  rateOf,
  boundsOf,
  currencyOptionsFor,
  onSetRowCurrency,
  onSetValue,
  onOpenSubLedger,
  controlKindLabelOf,
}: Props) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isControl = (a: Account): boolean => controlAccountIds.has(a.id);
  const rowOf = (a: Account): RowState =>
    isControl(a)
      ? subLedgerTotals[a.id] || zeroRow(baseCode, 1)
      : rows[a.id] || zeroRow(a.defaultCurrency || baseCode, rateOf(a.defaultCurrency || baseCode));

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const searching = term.length > 0;
    return postingAccounts.filter(a => {
      const ctrl = isControl(a);
      if (category === 'GENERAL' && ctrl) return false;
      if (category === 'CASH_BANK' && (!ctrl || controlKindLabelOf(a.id) !== 'الصناديق والبنوك')) return false;
      if (category === 'CUSTOMER_VENDOR' && (!ctrl || controlKindLabelOf(a.id) !== 'العملاء والموردين')) return false;
      if (category === 'EMPLOYEE_TRUST' && (!ctrl || controlKindLabelOf(a.id) !== 'الموظفين والعُهد')) return false;
      const r = rowOf(a);
      const hasBalance = (r.debit || r.credit || r.debitForeign || r.creditForeign) > 0;
      if (hideZero && !searching && !hasBalance) return false;
      if (!term) return true;
      return (
        a.code.toLowerCase().includes(term) ||
        a.nameAr.includes(searchTerm.trim()) ||
        a.nameEn.toLowerCase().includes(term)
      );
    });
  }, [postingAccounts, category, searchTerm, hideZero, baseCode, rateOf, rows, subLedgerTotals, controlAccountIds, controlKindLabelOf]);

  const cellOrder = useMemo(() => {
    const order: Array<{ accountId: string; field: string }> = [];
    filtered.forEach(a => {
      if (isControl(a)) return;
      const r = rowOf(a);
      const foreign = r.currency !== baseCode;
      (foreign ? ['debitForeign', 'creditForeign', 'debit', 'credit'] : ['debit', 'credit']).forEach(f => order.push({ accountId: a.id, field: f }));
    });
    return order;
  }, [filtered, baseCode, rows, subLedgerTotals, controlAccountIds]);

  const focusCell = (accountId: string, field: string) => {
    inputRefs.current[`${accountId}:${field}`]?.focus();
  };

  const handleNav = (accountId: string, field: string, e: React.KeyboardEvent) => {
    const idx = cellOrder.findIndex(c => c.accountId === accountId && c.field === field);
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = cellOrder[idx + 1] ?? cellOrder[0];
      if (next) focusCell(next.accountId, next.field);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = cellOrder[idx - 1] ?? cellOrder[cellOrder.length - 1];
      if (prev) focusCell(prev.accountId, prev.field);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const rowCells = cellOrder.filter(c => c.accountId === accountId);
      const rIdx = rowCells.findIndex(c => c.field === field);
      if (rowCells.length > 1) {
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const target = rowCells[(rIdx + delta + rowCells.length) % rowCells.length];
        focusCell(target.accountId, target.field);
      }
    }
  };

  // دالة احتساب الإجماليات بالعملة المحلية الأساسية اعتماداً على localOf
  const totals = useMemo(() => {
    const acc = filtered.reduce(
      (sum, a) => {
        const r = rowOf(a);
        const loc = localOf(r, baseCode, rateOf);
        sum.debit += loc.debit;
        sum.credit += loc.credit;
        return sum;
      },
      { debit: 0, credit: 0 }
    );
    return { debit: round2(acc.debit), credit: round2(acc.credit) };
  }, [filtered, baseCode, rateOf, rows, subLedgerTotals, controlAccountIds]);

  const showForeignColumn = filtered.some(a => rowOf(a).currency !== baseCode);

  return (
    <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
      {/* شريط الفلاتر */}
      <div className="p-4 space-y-3 border-b border-slate-800/60 bg-white/[0.02]">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <F9SearchInput
              value={searchTerm}
              onChange={onSearchTerm}

              className="w-full pr-10 pl-9 py-2.5 text-sm glass-input rounded-xl"
              items={filtered}
              columns={[
                { label: 'رمز الحساب', render: (a: Account) => <span className="font-mono font-bold text-sky-400">{a.code}</span> },
                { label: 'اسم الحساب', render: (a: Account) => <span className="font-semibold text-slate-100 whitespace-nowrap">{a.nameAr}</span> },
                {
                  label: 'الرصيد',
                  render: (a: Account) => {
                    const local = localOf(rowOf(a), baseCode, rateOf);
                    return <span className="font-mono">{fmtAmountCur(round2(local.debit - local.credit), baseCode)}</span>;
                  },
                  className: 'text-left',
                },
              ]}
              searchText={a => `${a.code} ${a.nameAr} ${a.nameEn}`}
              browseTitle="استعراض حسابات الأرصدة الافتتاحية"
            />
          </div>
          <button
            type="button"
            onClick={() => onHideZero(!hideZero)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${hideZero
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'glass text-slate-400 hover:text-white border-slate-700/60'
              }`}
            title={hideZero ? 'إظهار الحسابات ذات الأرصدة فقط' : 'عرض جميع الحسابات'}
          >
            {hideZero ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {hideZero ? 'إخفاء الأرصدة الصفرية' : 'عرض الكل'}
          </button>
        </div>

        {/* تبويبات الفئات */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onCategory(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full border transition-all cursor-pointer ${category === tab.id
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-[0_0_18px_-6px_rgba(56,189,248,0.5)]'
                  : 'glass text-slate-400 hover:text-white border-slate-700/60'
                }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Keyboard className="w-3 h-3" />
            Enter / Tab / أسهم اللوحة للتنقل بين الخلايا
          </span>
        </div>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto custom-scrollbar max-h-[58vh]">
        <table className="w-full text-right text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-slate-800/80 backdrop-blur-xl text-slate-200 font-bold text-sm border-b border-slate-800">
            <tr className="border-b border-slate-800">
              <th className="py-3 px-4">رمز الحساب</th>
              <th className="py-3 px-4">اسم الحساب</th>
              <th className="py-3 px-4 w-24">الطبيعة</th>
              <th className="py-3 px-4 w-20">العملة</th>
              {showForeignColumn && <th className="py-3 px-4 w-24">سعر التحويل</th>}
              <th className="py-3 px-4 w-40 text-left">مدين (Debit)</th>
              <th className="py-3 px-4 w-40 text-left">دائن (Credit)</th>
              {showForeignColumn && <th className="py-3 px-4 w-40 text-left">مدين أجنبي</th>}
              {showForeignColumn && <th className="py-3 px-4 w-40 text-left">دائن أجنبي</th>}
              <th className="py-3 px-4 w-32 text-left">المكافئ المحلي ({baseCode})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map(a => {
              const r = rowOf(a);
              const foreign = r.currency !== baseCode;
              const ctrl = isControl(a);
              const isSelected = selectedId === a.id;
              const local = localOf(r, baseCode, rateOf);
              const netLocal = round2(local.debit - local.credit);
              const entitiesCount = ctrl ? controlEntitiesCount(a.id) : 0;
              const editableFields = ctrl ? [] : foreign ? ['debitForeign', 'creditForeign', 'debit', 'credit'] : ['debit', 'credit'];

              return (
                <tr
                  key={a.id}
                  onClick={() => onSelect(ctrl ? null : a.id)}
                  className={`transition-colors ${ctrl ? 'bg-sky-500/[0.04]' : 'cursor-pointer'} ${isSelected ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/40' : 'hover:bg-white/[0.03]'
                    }`}
                >
                  <td className="py-2 px-4 font-mono font-bold text-sky-400 whitespace-nowrap">
                    {a.code}
                    {ctrl && <span className="mr-2 text-[9px] font-bold text-sky-500 border border-sky-500/30 rounded-full px-1.5 py-0.5">تحكم</span>}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      {ctrl ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenSubLedger(a.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-colors cursor-pointer"
                          title={entitiesCount > 0 ? `فتح تفكيك الأرصدة لـ ${entitiesCount} كيان مساعد` : 'لا توجد كيانات مساعدة بعد'}
                        >
                          {entitiesCount > 0 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                          تفكيك
                          <span className="font-mono">({entitiesCount})</span>
                        </button>
                      ) : (
                        <ListTree className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <div>
                        <div className={`font-semibold whitespace-nowrap ${ctrl ? 'text-sky-200' : 'text-slate-200'}`}>{a.nameAr}</div>
                        <div className="text-xs text-slate-500 font-mono" dir="ltr">{a.nameEn}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${NATURE_BADGES[a.nature]}`}>
                      {a.nature === 'DEBIT' ? 'مدين' : 'دائن'}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {ctrl ? (
                      <span className="font-mono text-slate-400 text-center block">{baseCode}</span>
                    ) : (
                      <select
                        value={r.currency}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onSetRowCurrency(a.id, e.target.value)}
                        className="w-full px-2 py-2 text-sm glass-input rounded-xl font-mono text-slate-200 text-center"
                        title="العملات المضمنة لحساب المستوى الخامس — يحدد تلقائياً سعر التحويل"
                      >
                        {currencyOptionsFor(a).map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  {showForeignColumn && (
                    <td className="py-2 px-4" onClick={e => e.stopPropagation()}>
                      <ExchangeRateField
                        value={r.rate ?? 1}
                        onChange={v => onSetValue(a.id, 'rate', String(v))}
                        disabled={ctrl || !foreign}
                        isBase={!foreign}
                        min={boundsOf(r.currency).min}
                        max={boundsOf(r.currency).max}
                        currencyCode={r.currency}
                        compact
                        inputClassName="w-full px-2 py-2 text-sm glass-input rounded-xl font-mono text-slate-200 text-center disabled:opacity-40 disabled:bg-slate-800/40"
                      />
                    </td>
                  )}
                  <td className="py-2 px-4">
                    <AmountInput
                      value={r.debit}
                      disabled={ctrl || foreign}
                      ref={el => { inputRefs.current[`${a.id}:debit`] = el; }}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => editableFields.includes('debit') && handleNav(a.id, 'debit', e)}
                      onChange={v => onSetValue(a.id, 'debit', v)}
                      className={`w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-emerald-300 text-left disabled:opacity-60 ${ctrl ? 'font-bold' : ''}`}
                    />
                  </td>
                  <td className="py-2 px-4">
                    <AmountInput
                      value={r.credit}
                      disabled={ctrl || foreign}
                      ref={el => { inputRefs.current[`${a.id}:credit`] = el; }}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => editableFields.includes('credit') && handleNav(a.id, 'credit', e)}
                      onChange={v => onSetValue(a.id, 'credit', v)}
                      className={`w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-amber-300 text-left disabled:opacity-60 ${ctrl ? 'font-bold' : ''}`}
                    />
                  </td>
                  {showForeignColumn && (
                    <td className="py-2 px-4">
                      <AmountInput
                        value={r.debitForeign}
                        disabled={ctrl || !foreign}
                        ref={el => { inputRefs.current[`${a.id}:debitForeign`] = el; }}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => editableFields.includes('debitForeign') && handleNav(a.id, 'debitForeign', e)}
                        onChange={v => onSetValue(a.id, 'debitForeign', v)}
                        className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-amber-300 text-left disabled:opacity-40"
                      />
                    </td>
                  )}
                  {showForeignColumn && (
                    <td className="py-2 px-4">
                      <AmountInput
                        value={r.creditForeign}
                        disabled={ctrl || !foreign}
                        ref={el => { inputRefs.current[`${a.id}:creditForeign`] = el; }}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => editableFields.includes('creditForeign') && handleNav(a.id, 'creditForeign', e)}
                        onChange={v => onSetValue(a.id, 'creditForeign', v)}
                        className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono text-amber-200 text-left disabled:opacity-40"
                      />
                    </td>
                  )}
                  <td className="py-2 px-4 text-left">
                    <span className={`font-mono font-bold ${netLocal > 0 ? 'text-emerald-300' : netLocal < 0 ? 'text-amber-300' : 'text-slate-500'}`} dir="ltr">
                      {fmtAmountCur(netLocal, baseCode)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <Coins className="w-10 h-10 text-slate-600" />
                    <p className="font-bold text-white">لا توجد حسابات مطابقة</p>
                    <p className="text-sm">جرّب تغيير الفئة أو البحث أو عطّل إخفاء الأرصدة الصفرية</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-800/80 backdrop-blur-xl font-bold text-[12.5px] text-slate-200 border-t border-slate-800">
            <tr className="border-t border-slate-800">
              <td colSpan={4 + (showForeignColumn ? 1 : 0)} className="py-3 px-4">
                الإجمالي الكلي بالعملة المحلية {baseCode} ({filtered.length} حساب معروض):
              </td>
              <td className="py-3 px-4 font-mono text-emerald-400 text-left" dir="ltr">{fmtAmountCur(totals.debit, baseCode)}</td>
              <td className="py-3 px-4 font-mono text-amber-400 text-left" dir="ltr">{fmtAmountCur(totals.credit, baseCode)}</td>
              {showForeignColumn && <td className="py-3 px-4" />}
              {showForeignColumn && <td className="py-3 px-4" />}
              <td className="py-3 px-4 font-mono text-white text-left" dir="ltr">{fmtAmountCur(round2(totals.debit - totals.credit), baseCode)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* أسطورة حسابات التحكم */}
      {filtered.some(isControl) && (
        <div className="px-4 py-3 border-t border-slate-800/60 flex items-center gap-4 flex-wrap text-xs text-slate-500">
          <span className="font-bold text-slate-400">حسابات التحكم:</span>
          {(['CASH_BOX', 'BANK', 'CUSTOMER', 'VENDOR', 'EMPLOYEE'] as const).map(k => (
            <span key={k} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${KIND_DOT[k]}`} />
              {SUB_LEDGER_KIND_LABEL[k]}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <ChevronDown className="w-3 h-3 text-sky-400" />
            اضغط «تفكيك» لإدخال أرصدة الكيانات المساعدة — الإجمالي يُحقن تلقائياً
          </span>
        </div>
      )}
    </div>
  );
}