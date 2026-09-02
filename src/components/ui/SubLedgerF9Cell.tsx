import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { SubLedgerDataset, SubLedgerEntity } from '../../utils/subLedger';
import { subLedgerTypeOf, subLedgerEntityById, subLedgerBadge, resolveSubLedgerName } from '../../utils/subLedger';
import { Account } from '../../types/erp';
import SubLedgerLookup from './SubLedgerLookup';
import { registerScopedShortcut } from '../../utils/scopedShortcutRegistry';

interface Props {
  dataset: SubLedgerDataset;
  account?: Account;            // الحساب المختار في السطر — منه يُشتق نوع المساعد
  subLedgerId?: string;
  subLedgerName?: string;       // اسم الكيان المساعد المختار (للعرض دون جلب إضافي)
  onChange: (subLedgerId: string, subLedgerName: string) => void;
  disabled?: boolean;
  compact?: boolean;            // وضع مختصر (سطر تفاصيل ضيق)
}

/**
 * خلية الحساب المساعد الموحّدة (Generic Sub-Ledger Cell):
 * - عند اختيار حساب عام (NONE): تُعرض رمادية معطّلة "بدون حساب مساعد".
 * - عند اختيار حساب ذي مساعد (موظف/عميل/مورد/صندوق/بنك/أصل...): تُفعَّل،
 *   ويتم اختيار الكيان المساعد عبر F9 (شاشة البحث الموحدة) من نفس النوع فقط.
 */
export default function SubLedgerF9Cell({
  dataset,
  account,
  subLedgerId,
  subLedgerName,
  onChange,
  disabled = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const type = subLedgerTypeOf(account, dataset);

  // تنفيذ اختيار الكيان من شاشة F9
  const handleSelect = (entity: SubLedgerEntity) => {
    onChange(entity.id, entity.nameAr);
    setOpen(false);
    window.setTimeout(() => cellRef.current?.focus(), 40);
  };

  // شارك سجل الاختصارات العام حتى تفوز خلية الحساب المساعد المركزة على
  // حقول F9 الموجودة خلف النافذة، بدلاً من فتح مستعرض السندات الخارجي.
  useEffect(() => registerScopedShortcut({
    key: 'F9',
    getElement: () => cellRef.current,
    run: () => setOpen(true),
    enabled: () => type !== 'NONE' && !disabled && !open,
  }), [type, disabled, open]);

  // عودة الوضع إلى "بدون مساعد" عند تغيير الحساب لنوع مختلف،
  // وإعادة ضبط الخلية تلقائياً إذا لم يعد المعرّف المحفوظ ينتمي لنوع المساعد الجديد
  // (حماية إضافية حتى لو لم يقم الأب بمسح القيمة — Cascading Reset)
  useEffect(() => {
    if (!subLedgerId) return;
    if (type === 'NONE' || !subLedgerEntityById(dataset, type, subLedgerId)) {
      onChange('', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, subLedgerId]);

  if (type === 'NONE') {
    return (
      <div className="text-slate-500/60 text-sm select-none leading-6 whitespace-nowrap" title="حساب عام — لا يتطلب كياناً مساعداً">
        بدون حساب مساعد
      </div>
    );
  }

  const badge = subLedgerBadge(type);
  const selected = subLedgerId
    ? subLedgerName || resolveSubLedgerName(dataset, type, subLedgerId)
    : '';

  if (compact) {
    return (
      <>
        <div
          ref={cellRef}
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setOpen(true)}
          className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 h-9 text-xs min-w-[150px] cursor-pointer transition-colors focus:outline-none focus:ring-1 ${
            disabled
              ? 'bg-slate-800/40 border-slate-700/40 text-slate-500'
              : selected
                ? 'bg-slate-900 border-slate-700 hover:border-sky-500/60'
                : 'bg-slate-900 border-slate-700 ring-1 ring-amber-500/30'
          }`}
          title={`${badge.text} — اضغط F9 لاختيار ${badge.text} من البحث الموحد`}
        >
          {selected ? (
            <span className="truncate text-slate-100">{selected}</span>
          ) : (
            <span className="truncate text-slate-500">اضغط F9 لاختيار {badge.text}...</span>
          )}
          {selected && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={e => { e.stopPropagation(); onChange('', ''); }}
              className="p-0.5 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="shrink-0 text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        {open && (
          <SubLedgerLookup open={open} type={type} dataset={dataset} onSelect={handleSelect} onClose={() => setOpen(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={cellRef}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen(true)}
        className={`flex items-center justify-between gap-2 rounded-xl border px-3 h-11 text-sm min-w-[220px] cursor-pointer transition-colors focus:outline-none focus:ring-1 ${
          disabled
            ? 'bg-slate-800/40 border-slate-700/40 text-slate-500'
            : selected
              ? 'bg-slate-900 border-slate-700 hover:border-sky-500/60'
              : 'bg-slate-900 border-slate-700 ring-1 ring-amber-500/40 hover:ring-amber-400/60'
        }`}
        title={`${badge.text} — اضغط F9 لاختيار ${badge.text} من البحث الموحد`}
      >
        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-xs font-bold ${badge.cls}`}>
          {badge.text}
        </span>
        {selected ? (
          <span className="truncate text-slate-100 font-semibold">{selected}</span>
        ) : (
          <span className="truncate text-slate-500 text-xs">اضغط F9 لاختيار {badge.text}...</span>
        )}
        <span className="shrink-0 flex items-center gap-1 text-slate-500">
          {selected && !disabled ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange('', ''); }}
              className="p-0.5 hover:text-rose-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <ChevronDown className="w-4 h-4" />
        </span>
      </div>
      {open && (
        <SubLedgerLookup open={open} type={type} dataset={dataset} onSelect={handleSelect} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
