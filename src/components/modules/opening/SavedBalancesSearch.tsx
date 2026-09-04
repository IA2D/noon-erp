import {useEffect, useMemo, useRef, useState} from 'react';
import {Search, Pencil} from 'lucide-react';
import type {BrowseRow} from './types';
import {fmtAmountCur} from '../../../utils/format';

interface Props {
  /** الأرصدة المحفوظة فعلاً في قاعدة البيانات */
  rows: BrowseRow[];
  /** تحميل الرصيد المختار إلى ورقة العمل للتعديل */
  onPick: (row: BrowseRow) => void;
  /** retained for API compatibility; the old standalone عرض action is removed */
  onBrowseAll?: () => void;
}

const searchTextOf = (r: BrowseRow): string =>
  `${r.accountCode} ${r.accountName} ${r.entity?.code || ''} ${r.entity?.nameAr || ''} ${r.currency}`;

export default function SavedBalancesSearch({rows, onPick}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => searchTextOf(r).toLowerCase().includes(q));
  }, [rows, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filtered.length]);

  useEffect(() => {
    if (open && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({block: 'nearest'});
    }
  }, [activeIndex, open]);

  // إغلاق القائمة عند النقر خارج المكوّن أو الضغط على Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (r: BrowseRow) => {
    setOpen(false);
    onPick(r);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) pick(item);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-[320px] flex-1 max-w-md">
      <div className="flex items-center gap-2">
        {/* حقل البحث */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}

            className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full max-h-80 overflow-y-auto custom-scrollbar rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-800 bg-slate-900/70">
            الأرصدة المحفوظة ({filtered.length}) — اختر سطراً لتحميله إلى ورقة العمل
          </div>
          <div className="divide-y divide-slate-800">
            {filtered.map((r, idx) => (
              <button
                key={r.key}
                ref={idx === activeIndex ? activeRowRef : undefined}
                type="button"
                onClick={() => pick(r)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-right transition-colors cursor-pointer ${
                  idx === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-900'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-sky-300 whitespace-nowrap">{r.accountCode}</span>
                    <span className="text-xs text-slate-200 truncate">{r.accountName}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {r.entity ? (
                      <>
                        <span className="font-mono">{r.entity.code}</span> — {r.entity.nameAr}
                      </>
                    ) : (
                      'بدون حساب تحليلي'
                    )}
                    {' · '}عملة <span className="font-mono">{r.currency}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-left">
                    {r.debit > 0 && (
                      <div className="text-xs font-bold text-emerald-300 font-mono" dir="ltr">{fmtAmountCur(r.debit, r.currency)}</div>
                    )}
                    {r.credit > 0 && (
                      <div className="text-xs font-bold text-amber-300 font-mono" dir="ltr">{fmtAmountCur(r.credit, r.currency)}</div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                    <Pencil className="w-3 h-3" />
                    تعديل
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-slate-800 bg-slate-900/70 text-center text-xs text-slate-400">
            ↑/↓ للتنقل · Enter للتحميل · اضغط «عرض» لاستعراض الكل
          </div>
        </div>
      )}

      {open && query.trim() !== '' && filtered.length === 0 && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 shadow-xl px-4 py-4 text-center text-xs text-slate-400">
          <Search className="w-5 h-5 mx-auto mb-1 opacity-40" />
          لا توجد أرصدة محفوظة مطابقة لـ «{query.trim()}» — اضغط «عرض» لاستعراض الكل.
        </div>
      )}
    </div>
  );
}
