import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Search, Keyboard, BookOpen } from 'lucide-react';
import { JournalEntry } from '../../types/erp';
import { registerScopedShortcut } from '../../utils/scopedShortcutRegistry';

const fmtCur = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  items: JournalEntry[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (entry: JournalEntry) => void;
  /** عند فتح نافذة إنشاء/تعديل القيد — تعطيل اختصار F9 الشامل حتى لا يتعارض مع حقول النافذة */
  disabled?: boolean;
}

/**
 * شريط بحث مدمج لدفتر القيود اليدوية (JV) — وسام F9 داخل الحقل مع قائمة إكمال تلقائي منسدلة.
 * يوجّه F9 التركيز للحقل عندما يكون مركّزاً أو هدف F9 المرئي الوحيد في الواجهة.
 * لا يستخدم أي نافذة منبثقة (Modal).
 */
export default function JournalSearchBar({ items, value, onChange, onSelect, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const dropW = Math.max(rect.width, 550);
      let left = rect.right - dropW;
      if (left < 8) left = 8;
      if (left + dropW > window.innerWidth - 8) left = window.innerWidth - 8 - dropW;
      setDropdownRect({ top: rect.bottom + 8, left, width: dropW });
    }
  };

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    const onScroll = () => updateDropdownPosition();
    const onResize = () => updateDropdownPosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = q === '' ? items : items.filter(j =>
      j.entryNumber.toLowerCase().includes(q) ||
      j.narration.toLowerCase().includes(q) ||
      (j.reference || '').toLowerCase().includes(q) ||
      (j.createdBy || '').toLowerCase().includes(q) ||
      String(j.totalDebit).includes(q)
    );
    return base.slice(0, 50);
  }, [items, value]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة عند النقر خارج المكوّن (بما في ذلكPortal القائمة)
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && rootRef.current.contains(e.target as Node)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // المنسّق المشترك يمنع F9 من تشغيل أكثر من هدف مرئي في الواجهة نفسها.
  useEffect(() => {
    return registerScopedShortcut({
      key: 'F9',
      getElement: () => inputRef.current,
      enabled: () => !disabled,
      run: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
      setActiveIndex(0);
      },
    });
  }, [disabled]);

  // إبقاء السطر النشط داخل مجال الرؤية عند التنقل بلوحة المفاتيح
  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const activeEl = dropdownRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const selectItem = (entry: JournalEntry) => {
    onSelect(entry);
    setOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = filtered[activeIndex];
      if (entry) selectItem(entry);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-lg md:max-w-xl">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        id="journal-entries-search"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActiveIndex(0); }}
        onFocus={() => { setOpen(true); setActiveIndex(0); updateDropdownPosition(); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleInputKeyDown}

        className="w-full pl-12 pr-10 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => { inputRef.current?.focus(); inputRef.current?.select(); setOpen(true); setActiveIndex(0); }}
        className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-400 border border-sky-300/80 dark:border-slate-700 select-none cursor-pointer hover:bg-sky-200 dark:hover:bg-slate-700 transition-colors"
        title="اضغط F9 لاستعراض القيود اليدوية"
      >
        <Keyboard className="w-3 h-3" />
        F9
      </button>

      {open && dropdownRect && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 99999 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden max-h-[70vh]"
        >
          <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-t-2xl flex items-center justify-between gap-4">
            <span className="w-40">رقم القيد — التاريخ</span>
            <span className="flex-1">البيان</span>
            <span className="w-24 text-left">المبلغ (مدين)</span>
          </div>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center gap-2.5 py-12 text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">لا توجد قيود يومية مطابقة للبحث</span>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {filtered.map((entry, idx) => (
                <button
                  key={entry.id}
                  type="button"
                  data-idx={idx}
                  onClick={() => selectItem(entry)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 hover:bg-sky-50/80 dark:hover:bg-sky-950/40 cursor-pointer transition-colors flex items-center justify-between gap-4 text-xs text-right ${
                    idx === activeIndex ? 'bg-sky-50/80 dark:bg-sky-950/40' : ''
                  }`}
                >
                  <span className="w-40 flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 shrink-0 text-sky-500 dark:text-sky-400" />
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{entry.entryNumber}</span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{entry.date}</span>
                  </span>
                  <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{entry.narration}</span>
                  <span className="w-24 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">{fmtCur(entry.totalDebit)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="px-4 py-2 border-t border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>{filtered.length} قيد</span>
            <span>↑/↓ للتنقل · Enter للاختيار · Esc للإغلاق</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
