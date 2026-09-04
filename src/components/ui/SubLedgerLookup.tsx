import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Keyboard, Users, UserRound, Factory, Wallet, Landmark, Boxes, CircleDollarSign, Network, Package, Repeat2 } from 'lucide-react';import { SubLedgerType } from '../../types/erp';
import {
  SubLedgerDataset,
  SubLedgerEntity,
  SUB_LEDGER_META,
  searchSubLedgers,
} from '../../utils/subLedger';
import ModalShell from './ModalShell';
import { MODAL_Z_FLOOR } from './ModalStack';

interface Props {
  open: boolean;
  type: SubLedgerType;
  dataset: SubLedgerDataset;
  initialQuery?: string;
  onSelect: (entity: SubLedgerEntity) => void;
  onClose: () => void;
}

const TYPE_ICONS: Record<SubLedgerType, React.ElementType> = {
  NONE: Boxes,
  EMPLOYEE: Users,
  CUSTOMER: UserRound,
  SUPPLIER: Factory,
  CASH_BOX: Wallet,
  BANK: Landmark,
  EXCHANGER: Repeat2,
  ASSET: CircleDollarSign,
  COST_CENTER: Network,
  ITEM: Package,
};

/**
 * شاشة البحث الموحّدة للحساب المساعد (Global Analytical Account Lookup):
 * تُستدعى عند الضغط على F9 داخل خلية «الحساب التحليلي» في أي جدول إدخال،
 * وتستقبل subLedgerType لتُظهر بيانات الكيان المحدد فقط عبر الخدمة الموحّدة.
 */
export default function SubLedgerLookup({ open, type, dataset, initialQuery = '', onSelect, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  /** العنصر الذي كان مركّزاً قبل فتح النافذة — يُستعاد عند الإغلاق. */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // حفظ التركيز الحالي عند فتح النافذة + عزل Tab داخل النافذة
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery(initialQuery);
    window.setTimeout(() => inputRef.current?.focus(), 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]:not([style*="display: none"])');
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, initialQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleClose = useCallback(() => {
    onClose();
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, [onClose]);

  const results = useMemo(() => searchSubLedgers(dataset, type, query), [dataset, type, query]);
  const meta = SUB_LEDGER_META[type];

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={
        <>
          اختيار الكيان التحليلي: {meta.label}
          <span className="ml-1.5 text-xs font-mono text-slate-500">({meta.labelEn})</span>
        </>
      }
      subtitle={meta.hint}
      icon={TYPE_ICONS[type] || Search}
      overlay
      minWidth={350}
      minHeight={300}
      bodyClassName="p-0"
      taskbar={true}
      minZIndex={MODAL_Z_FLOOR}
      portal
    >
      <div className="flex flex-col h-full">
        {/* Search */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex(i => Math.min(i + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex(i => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const sel = results[activeIndex];
                  if (sel) onSelect(sel);
                }
              }}

              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
            <Keyboard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-sm text-slate-500">
              {results.length} نتيجة
            </span>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              Esc للإغلاق — Enter لاختيار النتيجة المميزة
            </span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {results.length === 0 ? (
            <div className="p-10 text-center">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold text-sm">لا توجد نتائج مطابقة</p>
              <p className="text-xs text-slate-500 mt-1">
                {type === 'ITEM'
                  ? 'وحدة المخزون غير مفعّلة — أضف وحدة المخزون أولاً.'
                  : `لم يتم العثور على ${meta.label} مطابق.`}
              </p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800/60 text-slate-400 font-bold sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">الكود</th>
                  <th className="py-2.5 px-4">الاسم</th>
                  <th className="py-2.5 px-4">معلومات إضافية</th>
                  <th className="py-2.5 px-4">الحساب المرتبط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {results.map((entity, idx) => (
                   <tr
                     key={entity.id}
                     onMouseDown={e => { e.preventDefault(); onSelect(entity); }}
                     onClick={() => onSelect(entity)}
                     onMouseEnter={() => setActiveIndex(idx)}
                     className={`cursor-pointer transition-colors ${activeIndex === idx ? 'bg-sky-500/20 ring-1 ring-sky-500/40' : 'hover:bg-sky-500/10'}`}
                   >
                    <td className="py-2.5 px-4 font-mono font-bold text-sky-400 whitespace-nowrap">{entity.code}</td>
                    <td className="py-2.5 px-4 font-semibold text-white">{entity.nameAr}</td>
                    <td className="py-2.5 px-4 text-slate-400">{entity.meta || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-sm">
                      {entity.accountId ? (() => {
                        const acc = dataset.accounts.find(a => a.id === entity.accountId);
                        return acc ? `${acc.code} - ${acc.nameAr}` : entity.accountId;
                      })() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
