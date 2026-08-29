import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Keyboard } from 'lucide-react';
import ModalShell from './ModalShell';
import { MODAL_Z_FLOOR } from './ModalStack';
import { registerScopedShortcut } from '../../utils/scopedShortcutRegistry';

export interface F9Column<T> {
  label: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  items: T[];
  columns: F9Column<T>[];
  searchText: (item: T) => string;
  browseTitle: string;
  emptyMessage?: string;
  showBadge?: boolean;
  onSelect?: (item: T) => void;
  /** يُستدعى عند الضغط Enter على الحقل (لتسليم النص المدخل يدوياً) */
  onEnter?: (value: string) => void;
  /** يُستدعى عند مغادرة الحقل (لتسليم النص المدخل يدوياً) */
  onBlur?: (value: string) => void;
  /** سمات إضافية تُمرَّر لحقل الإدخال (مثل data-* لربط التركيز) */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** عرض زر التكبير/الاستعادة في رأس النافذة — الافتراضي false. */
  maximize?: boolean;
}

/** خانة بحث تعمل بزر F9 من الكيبورد — تفتح نافذة استعراض للنتائج المطابقة */
export default function F9SearchInput<T>({
  value,
  onChange,
  className = '',
  items,
  columns,
  searchText,
  browseTitle,
  emptyMessage = 'لا توجد سجلات مطابقة للبحث.',
  showBadge = true,
  onSelect,
  onEnter,
  onBlur,
  inputProps,
  maximize = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [maximized, setMaximized] = useState(false);
  const activeRowRef = useRef<HTMLTableRowElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** العنصر الذي كان مركّزاً قبل فتح النافذة — يُستعاد عند الإغلاق. */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => searchText(item).toLowerCase().includes(q));
  }, [items, query, searchText]);

  // إعادة تعيين المؤشر عند تغيير الفلتر أو فتح النافذة
  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open, query, filtered.length]);

  // إبقاء السطر النشط داخل مجال الرؤية عند التنقل بلوحة المفاتيح
  useEffect(() => {
    if (open && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  // حفظ التركيز الحالي عند فتح النافذة + عزل Tab داخل النافذة
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    window.setTimeout(() => inputRef.current?.focus(), 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      // العثور على النافذة الحالية عبر role="dialog"
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
  }, [open]);

  const closeBrowse = useCallback(() => {
    setOpen(false);
    // إعادة التركيز للعنصر السابق بعد إغلاق النافذة
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, []);

  const openBrowse = useCallback(() => {
    setQuery(value);
    setActiveIndex(0);
    setOpen(true);
  }, [value]);

  // F9 is local to the focused lookup. When no lookup is focused, the shared
  // registry activates it only if this is the sole visible F9 target.
  useEffect(() => registerScopedShortcut({
    key: 'F9',
    getElement: () => inputRef.current,
    run: () => openBrowse(),
    enabled: () => !open,
  }), [open, openBrowse]);

  const selectItem = (item: T) => {
    if (!onSelect) return;
    onSelect(item);
    closeBrowse();
  };

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0 || !onSelect) return;
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
      const item = filtered[activeIndex];
      if (item) selectItem(item);
    }
  };

  return (
    <div className="relative w-full">
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}

        className={`dark:pl-14 ${className}`}
        onFocus={e => { inputProps?.onFocus?.(e); e.target.select(); }}
        onBlur={e => {
          inputProps?.onBlur?.(e);
          if (onBlur) onBlur(value);
        }}
        onKeyDown={e => {
          inputProps?.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            if (onEnter) onEnter(value);
          }
        }}
      />
      {showBadge && (
        <button
          type="button"
          onClick={openBrowse}
          title="فتح نافذة الاستعراض — يعمل F9 عند تركيز هذا الحقل أو عندما يكون هدف F9 الوحيد في الواجهة"
          tabIndex={-1}
          className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 shadow-2xs transition-colors cursor-pointer"
        >
          F9
        </button>
      )}

      <ModalShell
        open={open}
        onClose={closeBrowse}
        title={browseTitle}
        subtitle={`${filtered.length} سجل`}
        icon={Keyboard}
        overlay
        minWidth={350}
        minHeight={300}
        maximized={maximize ? maximized : undefined}
        onToggleMaximize={maximize ? () => setMaximized(m => !m) : undefined}
        bodyClassName="p-0"
        taskbar={true}
        minZIndex={MODAL_Z_FLOOR}
        portal
        footer={
          <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-center text-sm text-slate-500 shrink-0">
            ↑/↓ للتنقل · Enter للاختيار · Esc للإغلاق
          </div>
        }
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleModalKeyDown}

                className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800 text-xs font-bold">
                  <th className="p-3 w-10 text-center">#</th>
                  {columns.map((c, i) => (
                    <th key={i} className={`p-3 ${c.className || ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-10 text-center text-slate-500">
                      <Search className="w-7 h-7 mx-auto mb-2 opacity-40" />
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => (
                    <tr
                      key={idx}
                      ref={idx === activeIndex ? activeRowRef : undefined}
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`transition-colors cursor-pointer ${
                        idx === activeIndex ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/40' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                      {columns.map((c, i) => (
                        <td key={i} className={`p-3 ${c.className || ''}`}>{c.render(item)}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
