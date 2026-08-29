import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, X, Keyboard, Check } from 'lucide-react';

interface Props<T> {
  /** المعرّف المختار حالياً */
  value: string;
  /** يُستدعى عند اختيار عنصر (أو عند الإفراغ) */
  onChange: (value: string, item?: T) => void;
  options: T[];
  getValue: (item: T) => string;
  getLabel: (item: T) => React.ReactNode;
  getSearchText: (item: T) => string;
  /** إظهار خيار «بدون / مسح» بجانب القائمة */
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  panelClassName?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  searchIcon?: React.ElementType;
}

// حالياً، ModalStack يغلق أعلى نافذة عبر مستمع Escape في طور الالتقاط على window.
// هذا السجل على مستوى الوحدة يمنع ذلك أثناء فتح القائمة المنسدلة فقط:
const activeDropdowns = new Set<() => void>();

const onWindowKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || activeDropdowns.size === 0) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  activeDropdowns.forEach(close => close());
};

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onWindowKeyDown, true);
}

/**
 * قائمة منسدلة ذكية (Searchable Select / Combobox):
 * حقل أنيق يعرض القيمة المختارة ويفتح نافذة بحث فورية بالكتابة،
 * مع تنقّل كامل بلوحة المفاتيح (أسهم + Enter) ودعم اللغة العربية (RTL).
 */
export default function SearchableSelect<T>({
  value,
  onChange,
  options,
  getValue,
  getLabel,
  getSearchText,
  allowClear = false,
  clearLabel = 'بدون',
  disabled = false,
  className = '',
  panelClassName = '',
  searchPlaceholder = 'اكتب للبحث...',
  emptyMessage = 'لا توجد نتائج مطابقة للبحث.',
  searchIcon: SearchIcon = Search,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => (value ? options.find(o => getValue(o) === value) : undefined),
    [options, value, getValue]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => getSearchText(o).toLowerCase().includes(q));
  }, [options, query, getSearchText]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (open && filtered.length > 0 && activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1);
    }
  }, [open, filtered.length, activeIndex]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen(o => !o);
  }, [disabled]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    activeDropdowns.add(close);
    return () => {
      activeDropdowns.delete(close);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, close]);

  const selectItem = useCallback(
    (item: T) => {
      onChange(getValue(item), item);
      close();
    },
    [onChange, getValue, close]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (filtered.length === 0) return;
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
    <div ref={wrapperRef} className="relative w-full">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'F9') {
            e.preventDefault();
            toggle();
          }
        }}
        className={`flex items-center gap-2 px-3 py-2 text-sm glass-input rounded-xl cursor-pointer select-none ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-white font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
          {selected ? getLabel(selected) : null}
        </span>
        {allowClear && value && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={e => e.preventDefault()}
            onClick={e => {
              e.stopPropagation();
              onChange('', undefined);
            }}
            className="p-0.5 rounded text-slate-400 hover:text-red-400 dark:text-slate-500 cursor-pointer"
            title={clearLabel}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div
          role="listbox"
          className={`nav-popover absolute top-full right-0 left-0 z-50 mt-1.5 w-full overflow-visible animate-scale-in ${panelClassName}`}
        >
          <div className="glass-card border border-slate-700/80 shadow-2xl overflow-hidden">
            <div className="p-2.5 border-b border-slate-800">
              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}

                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-9 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
                <Keyboard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div ref={listRef} className="max-h-60 overflow-y-auto custom-scrollbar p-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center">
                  <Search className="w-6 h-6 text-slate-600 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{emptyMessage}</p>
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const v = getValue(item);
                  const isActive = idx === activeIndex;
                  const isSelected = v === value;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-right flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        isActive ? 'bg-sky-500/15' : 'hover:bg-white/5'
                      } ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}
                    >
                      <span className="flex-1 min-w-0 truncate">{getLabel(item)}</span>
                      {isSelected && <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
