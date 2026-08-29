import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

/**
 * حقل تاريخ ذكي بنمط أنظمة الـ ERP:
 * - إدخال الأرقام مباشرة دون فواصل مع إدراج الشرطات تلقائياً (DDMMYYYY → DD/MM/YYYY).
 * - دعم كامل للوحة المفاتيح (Backspace / تحديد كامل / أسهم تتخطى الفواصل).
 * - زر أيقونة تقويم داخل يمين الحقل يفتح منتقي التاريخ الأصلي (showPicker) مع محاذاة RTL.
 * - يعرض القيمة بصيغة يوم/شهر/سنة ويُعيدها للخارج بصيغة ISO (YYYY-MM-DD).
 */
interface SmartDateInputProps {
  /** القيمة بصيغة ISO: YYYY-MM-DD أو سلسلة فارغة */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function displayToIso(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

function isValidIso(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export default function SmartDateInput({
  value,
  onChange,
  id,
  className,
  onKeyDown,
}: SmartDateInputProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const lastEmitted = useRef(value);
  const nativeDateRef = useRef<HTMLInputElement>(null);

  const syncNative = (iso: string) => {
    if (nativeDateRef.current) nativeDateRef.current.value = iso;
  };

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const display = isoToDisplay(value);
    setText(display);
    setInvalid(display.length === 10 && !isValidIso(value));
    syncNative(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const digitsBefore = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, '').length;
    const digits = el.value.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) {
      out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setText(out);
    const iso = displayToIso(out);
    lastEmitted.current = iso;
    onChange(iso);
    setInvalid(out.length === 10 && !isValidIso(iso));
    syncNative(iso);
    let pos = digitsBefore;
    if (pos > 4) pos += 2;
    else if (pos > 2) pos += 1;
    pos = Math.min(pos, out.length);
    requestAnimationFrame(() => {
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (e.key === 'ArrowLeft' && start === end && el.value[start - 1] === '/') {
      e.preventDefault();
      el.setSelectionRange(start - 1, start - 1);
    } else if (e.key === 'ArrowRight' && start === end && el.value[start] === '/') {
      e.preventDefault();
      el.setSelectionRange(start + 1, start + 1);
    }
    onKeyDown?.(e);
  };

  const handleCalendarClick = () => {
    const el = nativeDateRef.current;
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

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    lastEmitted.current = iso;
    onChange(iso);
    const display = isoToDisplay(iso);
    setText(display);
    setInvalid(display.length === 10 && !isValidIso(iso));
  };

  const base =
    'w-full pr-9 pl-3 py-1.5 text-xs text-center font-semibold text-slate-100 bg-slate-900 border rounded-lg focus:outline-none transition-colors';
  const border = invalid
    ? 'border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/40'
    : 'border-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30';

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"

        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        dir="ltr"
        className={`${base} ${border}`}
      />
      <button
        type="button"
        onClick={handleCalendarClick}
        aria-label="فتح منتقي التاريخ"
        title="فتح منتقي التاريخ"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={nativeDateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleNativeChange}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}
