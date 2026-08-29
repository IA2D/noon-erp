import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

interface SmartDateInputProps {
  /** القيمة بصيغة YYYY-MM-DD أو DD/MM/YYYY (أو سلسلة فارغة) */
  value: string;
  /** يُستدعى بالقيمة المنسّقة بصيغة DD/MM/YYYY (أو سلسلة فارغة عند مسح الحقل) */
  onChange: (formattedDate: string) => void;
  className?: string;
  disabled?: boolean;
}

export function smartDateToIso(dmy: string): string {
  const d = dmy.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

export function isoToSmartDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const isValidIso = (iso: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
};

const resolveDisplay = (v: string): string => {
  if (!v) return '';
  return v.includes('-') ? isoToSmartDate(v) : v;
};

/** تاريخ اليوم بالوقت المحلي بصيغة YYYY-MM-DD (أساس افتراضي لحقول التواريخ) */
export const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const shiftDaysIso = (iso: string, days: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

export const SmartDateInput: React.FC<SmartDateInputProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const hiddenNativeDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(resolveDisplay(value));
  }, [value]);

  const getIsoDate = (dStr: string): string => {
    if (!dStr || dStr.length !== 10) return '';
    const [d, m, y] = dStr.split('/');
    if (!d || !m || !y) return '';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const input = el.value;

    if (input.toLowerCase() === 't' || input === 'ي') {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const today = `${dd}/${mm}/${now.getFullYear()}`;
      setDisplayValue(today);
      onChange(today);
      return;
    }

    const digitsBefore = input.slice(0, el.selectionStart ?? 0).replace(/\D/g, '').length;
    const digits = input.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    setDisplayValue(formatted);
    if (formatted.length === 10) {
      onChange(formatted);
    } else if (formatted.length === 0) {
      onChange('');
    }

    let pos = digitsBefore;
    if (pos > 4) pos += 2;
    else if (pos > 2) pos += 1;
    pos = Math.min(pos, formatted.length);
    requestAnimationFrame(() => {
      if (el.isConnected) el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (e.key === 'ArrowLeft' && start === end && el.value[start - 1] === '/') {
      e.preventDefault();
      el.setSelectionRange(start - 1, start - 1);
      return;
    }
    if (e.key === 'ArrowRight' && start === end && el.value[start] === '/') {
      e.preventDefault();
      el.setSelectionRange(start + 1, start + 1);
      return;
    }

    const digits = el.value.replace(/\D/g, '');
    if (digits.length === 8) {
      const iso = smartDateToIso(el.value);
      if (isValidIso(iso)) {
        let nextIso = '';
        if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') {
          nextIso = shiftDaysIso(iso, 1);
        } else if (e.key === '-' || e.key === '_' || e.key === 'ArrowDown') {
          nextIso = shiftDaysIso(iso, -1);
        }
        if (nextIso) {
          e.preventDefault();
          const display = isoToSmartDate(nextIso);
          setDisplayValue(display);
          onChange(display);
        }
      }
    }
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoVal = e.target.value;
    if (!isoVal) return;
    const [y, m, d] = isoVal.split('-');
    const formatted = `${d}/${m}/${y}`;
    setDisplayValue(formatted);
    onChange(formatted);
  };

  const openCalendarPicker = () => {
    if (disabled) return;
    const el = hiddenNativeDateRef.current;
    if (!el) return;
    try {
      const withPicker = el as HTMLInputElement & { showPicker?: () => void };
      if (typeof withPicker.showPicker === 'function') {
        withPicker.showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  };

  const invalid = displayValue.length === 10 && !isValidIso(smartDateToIso(displayValue));

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}

        disabled={disabled}
        maxLength={10}
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        className={`w-full bg-white border-2 rounded-lg px-3.5 py-2 pl-10 text-xs font-black text-black text-center tracking-wider outline-none transition-all shadow-2xs placeholder:text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${
          invalid
            ? 'border-red-500 hover:border-red-500 focus:border-red-600 focus:ring-1 focus:ring-red-500'
            : 'border-slate-500 hover:border-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-600 dark:hover:border-slate-400 dark:focus:border-blue-400'
        }`}
      />

      <button
        type="button"
        onClick={openCalendarPicker}
        disabled={disabled}
        title="استعراض التقويم"
        aria-label="استعراض التقويم"
        className="absolute left-2 p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
      >
        <Calendar className="w-4 h-4" />
      </button>

      <input
        ref={hiddenNativeDateRef}
        type="date"
        value={getIsoDate(displayValue)}
        onChange={handleNativePickerChange}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none w-0 h-0 bottom-0 left-0"
      />
    </div>
  );
};

export default SmartDateInput;
