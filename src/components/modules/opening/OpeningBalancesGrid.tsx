import DateField from '../../ui/DateField';
import {useEffect, useMemo, useRef, type KeyboardEvent, type InputHTMLAttributes} from 'react';
import {Trash2, CheckCircle2, Info, Plus, Layers} from 'lucide-react';
import type {Account} from '../../../types/erp';
import type {LinkedEntity} from '../../../services/openingBalancesService';
import type {ExchangeRateBounds} from '../../../utils/exchangeRate';
import {localOf, round2, SUB_LEDGER_KIND_LABEL, type RowEditField, type RowState} from './types';
import {fmtAmountCur} from '../../../utils/format';
import AmountInput from '../../AmountInput';
import ExchangeRateField from '../../ui/ExchangeRateField';
import F9SearchInput from '../../ui/F9SearchInput';

export interface GridLine {
  key: string;
  codeText: string;
  account: Account | null;
  entity: LinkedEntity | null;
  isControl: boolean;
  /** null عندما لا يكون السطر قابلاً للتحرير بعد (حساب غير محسوم / تحكم بلا مساعد) */
  row: RowState | null;
}

interface Props {
  lines: GridLine[];
  baseCode: string;
  rateOf: (code: string) => number;
  boundsOf: (code: string) => ExchangeRateBounds;
  currencyOptionsForAccount: (a: Account) => string[];
  currencyOptionsForEntity: () => string[];
  allAccountItems: Account[];
  allEntities: LinkedEntity[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  isPosted: boolean;
  accountsWithBalance: number;
  /** العملات المسجلة مسبقاً لنفس (الحساب + المساعد) — تُعطَّل في قائمة العملة لمنع التكرار */
  usedCurrenciesFor: (key: string) => ReadonlySet<string>;
  /** فحص مباشر: هل هذه العملة مستخدمة بالفعل لنفس الحساب والمساعد؟ */
  isCurrencyUsedForAccount: (excludeKey: string, accountId: string, subLedgerId: string | undefined, currency: string) => boolean;
  /** مفاتيح الأسطر المكررة تماماً (حساب + مساعد + عملة) — تُظلل للتنبيه البصري */
  duplicateLineKeys: ReadonlySet<string>;
  /** مفاتيح الأسطر ذات القيم الصفرية — تُظلل بالحمراء للتنبيه */
  zeroLineKeys: ReadonlySet<string>;
  autoFocusKey: string | null;
  onAutoFocusHandled: () => void;
  onAddLine: () => void;
  onSelectAccount: (key: string, account: Account) => void;
  onSelectEntity: (key: string, entity: LinkedEntity) => void;
  onAccountTyped: (key: string, text: string) => void;
  onAccountEnter: (key: string, text: string) => void;
  onSetValue: (key: string, field: RowEditField, raw: string) => void;
  onSetCurrency: (key: string, code: string) => void;
  onSetDocumentRef: (key: string, value: string) => void;
  onSetDueDate: (key: string, value: string) => void;
  onClearLine: (key: string) => void;
  onEnterLastField: (key: string) => void;
}

const inputCls =
  'w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed';

const f9InputCls =
  'w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

// خانات المبالغ: مدين بالزمردي، دائن بالكهرماني، الأجنبي بالفيروزي — عريضة لاستيعاب 12 رقماً
const debitInputCls = `${inputCls} text-emerald-400 min-w-[135px]`;
const creditInputCls = `${inputCls} text-amber-400 min-w-[135px]`;
const foreignDebitInputCls = `${inputCls} text-teal-300 min-w-[135px]`;
const foreignCreditInputCls = `${inputCls} text-teal-200 min-w-[135px]`;

const thCls = 'p-2.5 text-sm font-bold text-slate-300 whitespace-nowrap border-b border-slate-800';
const tdCls = 'p-2 align-middle';

const staticCell = (text: string) => (
  <div className="w-full text-center text-sm text-slate-400 font-mono">{text}</div>
);

const ACCOUNT_COLUMNS = [
  {label: 'رقم الحساب', render: (a: Account) => <span className="font-mono text-sky-700">{a.code}</span>, className: 'w-36'},
  {label: 'اسم الحساب', render: (a: Account) => <span className="font-semibold text-slate-100 whitespace-nowrap">{a.nameAr}</span>},
];

const KIND_BADGE: Record<string, string> = {
  CASH_BOX: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BANK: 'bg-sky-50 text-sky-700 border-sky-200',
  CUSTOMER: 'bg-sky-50 text-sky-700 border-sky-200',
  VENDOR: 'bg-amber-50 text-amber-700 border-amber-200',
  EMPLOYEE: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function OpeningBalancesGrid({
  lines,
  baseCode,
  rateOf,
  boundsOf,
  currencyOptionsForAccount,
  currencyOptionsForEntity,
  allAccountItems,
  allEntities,
  totalDebit,
  totalCredit,
  isBalanced,
  isPosted,
  accountsWithBalance,
  usedCurrenciesFor,
  isCurrencyUsedForAccount,
  duplicateLineKeys,
  zeroLineKeys,
  autoFocusKey,
  onAutoFocusHandled,
  onAddLine,
  onSelectAccount,
  onSelectEntity,
  onAccountTyped,
  onAccountEnter,
  onSetValue,
  onSetCurrency,
  onSetDocumentRef,
  onSetDueDate,
  onClearLine,
  onEnterLastField,
}: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const difference = round2(totalDebit - totalCredit);
    const readOnly = isPosted;


  const handleAddShortcut = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'F2' && e.key !== 'Insert') return;
    if ((e.target as HTMLElement).closest('[data-enter-scope]')) return;
    e.preventDefault();
    onAddLine();
    };


  const editableFields = (): HTMLElement[] => {
    const root = tableRef.current;
    if (!root) return [];
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('[data-ob-field], [data-enter-field]'));
    return candidates
      .map(el => (el.matches('input, select') ? el : (el.querySelector('input, select') as HTMLElement | null)))
      .filter((el): el is HTMLElement => !!el && !el.hasAttribute('disabled') && el.getAttribute('readonly') === null);
  };

  const keyOf = (el: HTMLElement): string | undefined =>
    (el.closest('tr[data-line-key]') as HTMLElement | null)?.dataset.lineKey;

  const focusElement = (el: HTMLElement | undefined): boolean => {
    if (!el) return false;
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
    return true;
  };

  /** ينشئ سطراً جديداً فقط إذا كان السطر الحالي قابلاً للتحرير (حساب محسوم + مساعد مختار للتحكم) */
  const appendIfLastRow = (target: HTMLElement): boolean => {
    const rowKey = keyOf(target);
    const line = lines.find(l => l.key === rowKey);
    if (!rowKey || !line?.row) return false;
    onEnterLastField(rowKey);
    return true;
  };

  const handleNavKey = (e: KeyboardEvent<HTMLElement>, opts?: {commit?: (target: HTMLElement) => void}) => {
    const isEnter = e.key === 'Enter';
    const isTab = e.key === 'Tab';
    if (!isEnter && !isTab) return;
    const target = e.target as HTMLElement;

    // Tab: السلوك الطبيعي للنقل، لكن في آخر حقل ينشئ سطراً جديداً
    if (isTab) {
      const fields = editableFields();
      if (fields.indexOf(target) === fields.length - 1) {
        e.preventDefault();
        appendIfLastRow(target);
      }
      return;
    }

    // Enter: مثل Tab تماماً — الخانة التالية، وإن كانت الأخيرة فسطر جديد
    e.preventDefault();
    if (opts?.commit) {
      opts.commit(target);
      window.setTimeout(() => {
        const f = editableFields();
        if (!focusElement(f[f.indexOf(target) + 1])) appendIfLastRow(target);
      }, 0);
      return;
    }
    const fields = editableFields();
    const idx = fields.indexOf(target);
    if (idx === -1) return;
    if (!focusElement(fields[idx + 1])) appendIfLastRow(target);
  };

  const F3_FIELDS: RowEditField[] = ['debit', 'credit', 'debitForeign', 'creditForeign', 'rate'];

  const lineKeyOf = (el: HTMLElement): string | undefined =>
    (el.closest('tr[data-line-key]') as HTMLElement | null)?.dataset.lineKey;

  const handleCellKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const field = target.getAttribute('data-enter-field');
    if (!field) return;
    const rowKey = lineKeyOf(target);
    if (!rowKey) return;
    const idx = lines.findIndex(l => l.key === rowKey);
    if (idx <= 0) return;
    const prev = lines[idx - 1];
    if (!prev.row) return;

    // F3: نسخ قيمة الخلية العلوية (نفس الحقل)
    if (e.key === 'F3') {
      e.preventDefault();
      if (F3_FIELDS.includes(field as RowEditField)) {
        const val = prev.row[field as keyof RowState];
        if (typeof val === 'number') onSetValue(rowKey, field as RowEditField, String(val));
      } else if (field === 'documentRef') {
        onSetDocumentRef(rowKey, prev.row.documentRef || '');
      } else if (field === 'dueDate') {
        onSetDueDate(rowKey, prev.row.dueDate || '');
      }
      return;
    }

    // F4: نسخ كامل بيانات السطر السابق
    if (e.key === 'F4') {
      e.preventDefault();
      if (F3_FIELDS.includes(field as RowEditField)) {
        onSetValue(rowKey, field as RowEditField, String(prev.row[field as keyof RowState] || 0));
      } else if (field === 'documentRef') {
        onSetDocumentRef(rowKey, prev.row.documentRef || '');
      } else if (field === 'dueDate') {
        onSetDueDate(rowKey, prev.row.dueDate || '');
      }
      return;
    }
    };


  useEffect(() => {
    if (!autoFocusKey) return;
    const root = tableRef.current;
    if (!root) return;
    const input = root.querySelector<HTMLElement>(`input[data-ob-account="${autoFocusKey}"]`);
    if (input) {
      input.focus();
      if (input instanceof HTMLInputElement) input.select();
      input.scrollIntoView?.({block: 'center'});
    }
    onAutoFocusHandled();
  }, [autoFocusKey, onAutoFocusHandled]);

  return (
    <div className="space-y-3" onKeyDown={handleAddShortcut}>

      <div ref={tableRef} className="overflow-x-auto custom-scrollbar" onKeyDown={handleCellKeyDown}>
        <table className="w-full text-right text-xs min-w-[1200px]">
          <thead>
          <tr className="bg-slate-900/70 text-slate-300 text-xs font-bold border-b border-slate-800">
              <th className={`${thCls} w-10 text-center`}>#</th>
              <th className={`${thCls} w-40`}>رقم الحساب (F9)</th>
              <th className={`${thCls} w-44 max-w-44`}>اسم الحساب</th>
              <th className={`${thCls} w-72 min-w-72`}>الحساب المساعد (F8)</th>
              <th className={`${thCls} w-24`}>العملة</th>
              <th className={`${thCls} w-28`}>سعر التحويل</th>
              <th className={`${thCls} w-28`}>مدين</th>
              <th className={`${thCls} w-28`}>دائن</th>
              <th className={`${thCls} w-32`}>صافي الرصيد (YER)</th>
              <th className={thCls}>رقم الاعتماد / المرجع</th>
              <th className={thCls}>تاريخ الاستحقاق</th>
              <th className={`${thCls} w-24 text-center`}>إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-12 text-center text-slate-400">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  لا توجد سطور بعد — ابدأ بالزر «+ إضافة سطر جديد» في الشريط العلوي.
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => {
                const resolved = !!l.account;
                const editable = !!l.row;
                const isDup = duplicateLineKeys.has(l.key);
                const isZero = zeroLineKeys.has(l.key);
                const foreign = editable && (l.row!.currency || baseCode) !== baseCode;
                const local = editable ? localOf(l.row!, baseCode, rateOf) : {debit: 0, credit: 0};
                const isBase = editable && !foreign;
                const entities = resolved && l.isControl ? allEntities.filter(e => e.linkedAccountId === l.account!.id) : [];

                return (
                  <tr key={l.key} data-line-key={l.key} className={`hover:bg-slate-900 transition-colors ${isDup ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-600/40' : ''} ${isZero ? 'bg-red-500/10 ring-1 ring-inset ring-red-600/40' : ''}`}>
                    <td className={`${tdCls} text-center text-slate-500 font-mono`}>{idx + 1}</td>
                    <td className={tdCls}>
                      <F9SearchInput
                        value={resolved ? l.account!.code : l.codeText}
                        onChange={text => onAccountTyped(l.key, text)}
                        onEnter={text => onAccountEnter(l.key, text)}

                        className={f9InputCls}
                        items={allAccountItems}
                        columns={ACCOUNT_COLUMNS}
                        searchText={a => `${a.code} ${a.nameAr} ${a.nameEn}`}
                        browseTitle="اختيار حساب تشغيلي (مستوى 5) — F9"
                        emptyMessage="لا توجد حسابات تشغيلية (مستوى 5) مطابقة."
                        onSelect={acc => onSelectAccount(l.key, acc)}
                        inputProps={{
                          'data-ob-account': l.key,
                          'data-ob-field': '',
                          disabled: readOnly,
                          onKeyDown: e => handleNavKey(e, {commit: () => onAccountEnter(l.key, l.codeText)}),
                        } as InputHTMLAttributes<HTMLInputElement>}
                      />
                    </td>
                    <td className={tdCls}>
                      {resolved ? (
                        <div className={`flex items-center gap-1.5 max-w-44 overflow-hidden ${l.isControl ? 'pr-4' : ''}`}>
                          {l.isControl && <span className="inline-block w-2.5 h-2.5 border-b border-r border-sky-500/50 rounded-br shrink-0" />}
                          <div className="text-slate-50 font-bold truncate">{l.account!.nameAr}</div>
                          {l.isControl && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-sky-500/10 text-sky-300 border border-sky-500/30 whitespace-nowrap">مساعد</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">اختر الحساب (F9)</div>
                      )}
                    </td>
                    <td className={tdCls}>
                      {resolved && l.isControl ? (
                        <F9SearchInput
                          value={l.entity ? l.entity.nameAr : ''}
                          onChange={() => {}}

                          className={f9InputCls}
                          items={entities}
                          columns={[
                            {label: 'الكود', render: (e: LinkedEntity) => <span className="font-mono text-sky-700">{e.code}</span>, className: 'w-32'},
                            {label: 'الاسم', render: (e: LinkedEntity) => <span className="font-semibold text-sm text-slate-100 whitespace-nowrap">{e.nameAr}</span>},
                            {label: 'النوع', render: (e: LinkedEntity) => (
                              <span className={`inline-block px-1.5 py-0.5 rounded-md text-xs border ${KIND_BADGE[e.kind] || ''}`}>
                                {SUB_LEDGER_KIND_LABEL[e.kind]}
                              </span>
                            )},
                          ]}
                          searchText={e => `${e.code} ${e.nameAr} ${SUB_LEDGER_KIND_LABEL[e.kind]}`}
                          browseTitle="اختيار الحساب المساعد (F8)"
                          shortcutKey="F8"
                          emptyMessage="لا توجد كيانات مساعدة مرتبطة بهذا الحساب."
                          onSelect={entity => onSelectEntity(l.key, entity)}
                          inputProps={{
                            'data-ob-field': '',
                            disabled: readOnly,
                            onKeyDown: handleNavKey,
                          } as InputHTMLAttributes<HTMLInputElement>}
                        />
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={tdCls}>
                      {editable ? (
                        <select
                          data-ob-field
                          value={l.row!.currency || baseCode}
                          onChange={e => onSetCurrency(l.key, e.target.value)}
                          onKeyDown={handleNavKey}
                          disabled={readOnly}
                          className={inputCls}
                        >
                          {(l.isControl ? currencyOptionsForEntity() : currencyOptionsForAccount(l.account!)).map(c => {
                            const used = isCurrencyUsedForAccount(l.key, l.account!.id, l.isControl ? l.entity?.id : undefined, c);
                            return (
                              <option
                                key={c}
                                value={c}
                                disabled={used}
                                className={used ? 'text-slate-200 bg-slate-950' : 'text-slate-400'}
                              >
                                {c}{used ? ' — (مسجل مسبقاً)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={tdCls}>
                      {editable ? (
                        <ExchangeRateField
                          value={l.row!.rate > 0 ? l.row!.rate : rateOf(l.row!.currency || baseCode)}
                          onChange={v => onSetValue(l.key, 'rate', String(v))}
                          onBlur={() => {}}
                          isBase={isBase}
                          min={boundsOf(l.row!.currency || baseCode).min}
                          max={boundsOf(l.row!.currency || baseCode).max}
                          currencyCode={l.row!.currency || baseCode}
                          compact
                          disabled={readOnly}
                          inputClassName={inputCls}
                          data-enter-field="rate"
                          onKeyDown={handleNavKey}
                        />
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={tdCls}>
                      {editable ? (
                        <AmountInput
                          value={foreign ? l.row!.debitForeign : local.debit}
                          onChange={raw => onSetValue(l.key, foreign ? 'debitForeign' : 'debit', raw)}
                          className={debitInputCls}

                          disabled={readOnly}
                          data-enter-field={foreign ? 'debitForeign' : 'debit'}
                          onKeyDown={handleNavKey}
                        />
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={tdCls}>
                      {editable ? (
                        <AmountInput
                          value={foreign ? l.row!.creditForeign : local.credit}
                          onChange={raw => onSetValue(l.key, foreign ? 'creditForeign' : 'credit', raw)}
                          className={creditInputCls}

                          disabled={readOnly}
                          data-enter-field={foreign ? 'creditForeign' : 'credit'}
                          onKeyDown={handleNavKey}
                        />
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={tdCls}>
                      {editable ? (() => {
                        const net = round2(local.debit - local.credit);
                        return (
                          <div className={`w-full text-center text-sm font-bold font-mono ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {net !== 0 ? fmtAmountCur(Math.abs(net), baseCode) : '—'}
                          </div>
                        );
                      })() : staticCell('—')}
                    </td>
                    <td className={tdCls}>
                      {editable ? (
                        <input
                          data-ob-field
                          data-enter-field="documentRef"
                          type="text"
                          value={l.row!.documentRef || ''}
                          onChange={e => onSetDocumentRef(l.key, e.target.value)}
                          onKeyDown={handleNavKey}

                          disabled={readOnly}
                          className={`${inputCls} text-right`}
                        />
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={tdCls}>
                      {editable ? (
                        <DateField
                          data-ob-field
                          data-enter-field="dueDate"
                          value={l.row!.dueDate || ''}
                          onChange={e => onSetDueDate(l.key, e.target.value)}
                          onKeyDown={handleNavKey}

                          disabled={readOnly}
                          className={`${inputCls} text-center`}
                        />
                      ) : (
                        staticCell('—')
                      )}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onClearLine(l.key)}
                          title="حذف السطر من ورقة العمل"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/15 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          مسح
                        </button>
                      )}
                      {isZero && (
                        <div className="mt-1 text-[10px] font-bold text-red-400 leading-tight">قيمة صفرية</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* زر إضافة سطر آخر — يُخفى في وضع القراءة */}
      {!readOnly && (
        <button
          type="button"
          onClick={onAddLine}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold rounded-xl border border-dashed border-slate-700 bg-slate-900 text-slate-400 hover:text-sky-300 hover:border-sky-500/60 hover:bg-sky-500/15 transition-all cursor-pointer"
          title="إضافة سطر فارغ جديد أسفل الجدول (أو اضغط F2 / Insert)"
        >
          <Plus className="w-4 h-4" />
          إضافة سطر آخر
        </button>
      )}

      {/* شريط المجاميع — بالعملة المحلية (YER) فقط */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border ${
          isBalanced
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <div>
            <div className="text-xs text-slate-500">إجمالي المدين (YER)</div>
            <div className="font-black text-emerald-300 font-mono" dir="ltr">{fmtAmountCur(totalDebit, baseCode)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">إجمالي الدائن (YER)</div>
            <div className="font-black text-amber-300 font-mono" dir="ltr">{fmtAmountCur(totalCredit, baseCode)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">الفرق (YER)</div>
            <div className={`font-black font-mono ${isBalanced ? 'text-emerald-300' : 'text-amber-400'}`} dir="ltr">
              {fmtAmountCur(Math.abs(difference), baseCode)}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            حسابات ذات أرصدة: <span className="font-bold text-amber-400 font-mono">{accountsWithBalance}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${
              isBalanced
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {isBalanced
              ? `متوازن — ${fmtAmountCur(totalDebit, baseCode)} = ${fmtAmountCur(totalCredit, baseCode)}`
              : `غير متوازن — الفرق ${fmtAmountCur(Math.abs(difference), baseCode)} (يُسمح بالحفظ ويُقيّد لاحقاً)`}
          </span>
        </div>
      </div>
    </div>
  );
}
