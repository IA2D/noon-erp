import { useState } from 'react';
import { ClipboardList, Pencil, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { BrowseRow } from './types';
import { round2 } from './types';
import { fmtAmountCur } from '../../../utils/format';
import ModalShell from '../../ui/ModalShell';

interface Props {
  open: boolean;
  onClose: () => void;
  rows: BrowseRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  baseCode: string;
  onEdit: (row: BrowseRow) => void;
  onDelete: (row: BrowseRow) => void;
}

const thCls = 'p-2.5 text-sm font-bold text-slate-400 whitespace-nowrap border-b border-slate-800';
const tdCls = 'p-2 align-middle';

export default function SavedBalancesModal({
  open,
  onClose,
  rows,
  totalDebit,
  totalCredit,
  isBalanced,
  baseCode,
  onEdit,
  onDelete,
}: Props) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const difference = round2(totalDebit - totalCredit);

  return (
    <ModalShell
      id="opening-balances-browse"
      open={open}
      onClose={onClose}
      title="استعراض الأرصدة المدخلة"
      subtitle="تعديل يحمّل الرصيد إلى ورقة العمل — حذف يزيله من قاعدة البيانات ويحدّث المجاميع"
      icon={ClipboardList}
      size="xl"
      maxWidth="max-w-5xl"
      maximized={isMaximized}
      onToggleMaximize={() => setIsMaximized(v => !v)}
      bodyClassName="p-0"
      footer={
        <div
          className={`flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-800 ${isBalanced ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
            }`}
        >
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div>
              <div className="text-xs text-slate-400">إجمالي المدين</div>
              <div className="font-black text-emerald-400 font-mono" dir="ltr">{fmtAmountCur(totalDebit, baseCode)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">إجمالي الدائن</div>
              <div className="font-black text-amber-400 font-mono" dir="ltr">{fmtAmountCur(totalCredit, baseCode)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">الفرق (Variance)</div>
              <div className={`font-black font-mono ${isBalanced ? 'text-emerald-400' : 'text-amber-400'}`} dir="ltr">
                {fmtAmountCur(Math.abs(difference), baseCode)}
              </div>
            </div>
          </div>
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${isBalanced
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              }`}
          >
            {isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {isBalanced ? 'متوازن' : `غير متوازن (فرق ${fmtAmountCur(Math.abs(difference), baseCode)})`}
          </span>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
          لا توجد أرصدة مدخلة بعد — ابدأ الإدخال اليدوي أو استخدم «إضافة سطر جديد».
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-xs min-w-[1100px]">
            <thead>
              <tr className="bg-slate-950 text-slate-200">
                <th className={`${thCls} w-10 text-center`}>#</th>
                <th className={thCls}>رقم الحساب</th>
                <th className={thCls}>اسم الحساب</th>
                <th className={thCls}>الحساب المساعد</th>
                <th className={`${thCls} w-20 text-center`}>العملة</th>
                <th className={`${thCls} w-24 text-center`}>سعر الصرف</th>
                <th className={`${thCls} w-32`}>مدين</th>
                <th className={`${thCls} w-32`}>دائن</th>
                <th className={`${thCls} w-36`}>صافي الرصيد ({baseCode})</th>
                <th className={thCls}>رقم المرجع</th>
                <th className={thCls}>تاريخ الاستحقاق</th>
                <th className={`${thCls} w-44 text-center`}>الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((r, idx) => {
                const isForeign = r.currency !== baseCode;
                const rate = Number(r.rate) > 0 ? Number(r.rate) : 1;

                const originalDebit = isForeign && rate > 0 ? round2(r.debit / rate) : r.debit;
                const originalCredit = isForeign && rate > 0 ? round2(r.credit / rate) : r.credit;

                const localNet = round2(r.debit - r.credit);

                return (
                  <tr key={r.key || idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className={`${tdCls} text-center text-slate-500 font-mono`}>{idx + 1}</td>
                    <td className={`${tdCls} font-mono text-sky-400 font-bold whitespace-nowrap`}>{r.accountCode}</td>
                    <td className={`${tdCls} text-slate-200 font-semibold whitespace-nowrap`}>{r.accountName}</td>
                    <td className={tdCls}>
                      {r.entity ? (
                        <span className="text-slate-300 whitespace-nowrap">
                          <span className="font-mono text-slate-500">{r.entity.code}</span> — {r.entity.nameAr}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className={`${tdCls} font-mono text-center font-bold text-slate-200`}>{r.currency}</td>

                    <td className={`${tdCls} font-mono text-center text-slate-300`} dir="ltr">
                      {isForeign ? rate : 1}
                    </td>

                    <td className={`${tdCls} font-mono text-left text-emerald-400 font-semibold`} dir="ltr">
                      {fmtAmountCur(originalDebit, r.currency)}
                    </td>
                    <td className={`${tdCls} font-mono text-left text-amber-400 font-semibold`} dir="ltr">
                      {fmtAmountCur(originalCredit, r.currency)}
                    </td>

                    <td className={tdCls}>
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold border ${localNet > 0
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : localNet < 0
                              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                              : 'border-slate-700 bg-slate-800 text-slate-400'
                          }`}
                      >
                        <span className="font-mono" dir="ltr">{fmtAmountCur(Math.abs(localNet), baseCode)}</span>
                        {localNet > 0 ? 'مدين' : localNet < 0 ? 'دائن' : 'متوازن'}
                      </span>
                    </td>

                    <td className={`${tdCls} text-slate-400`}>{r.documentRef || '—'}</td>
                    <td className={`${tdCls} text-slate-400`}>{r.dueDate ? new Date(r.dueDate).toLocaleDateString('ar-EG') : '—'}</td>

                    <td className={`${tdCls} text-center`}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(r);
                          }}
                          title="تعديل الرصيد"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-700 bg-slate-900 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          تعديل
                        </button>

                        {confirmKey === r.key ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded-lg border border-rose-500/40 bg-rose-500/20 text-rose-300">
                            تأكيد؟
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(r);
                                setConfirmKey(null);
                              }}
                              className="px-2 py-0.5 rounded bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer font-bold"
                            >
                              نعم
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmKey(null);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmKey(r.key);
                            }}
                            title="حذف الرصيد"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/25 hover:border-rose-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            حذف
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}