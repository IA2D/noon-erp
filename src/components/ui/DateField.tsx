import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { dateToDisplay, dateToIso, latinDigits } from '../../utils/dateInput';
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> & { value?: string; defaultValue?: string };
/** Editable DD/MM/YYYY text with the existing native calendar. Persistence stays ISO. */
export default function DateField({ value = '', defaultValue, onChange, className = '', disabled, readOnly, min, max, onKeyDown, onBlur, ...props }: Props) {
  const [text, setText] = useState(() => dateToDisplay(value || defaultValue || ''));
  const last = useRef(value);
  const native = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (value !== last.current) { last.current = value; setText(dateToDisplay(value)); input.current?.setCustomValidity(''); } }, [value]);
  const change = (event: React.ChangeEvent<HTMLInputElement>, display: string) => {
    const iso = dateToIso(display);
    const invalid = !!display && (!iso || (min && iso < String(min)) || (max && iso > String(max)));
    setText(display);
    input.current?.setCustomValidity(invalid ? 'أدخل تاريخاً صحيحاً بصيغة يوم/شهر/سنة ضمن الفترة المسموحة' : '');
    last.current = invalid ? '' : iso;
    onChange?.({ ...event, target: { ...event.target, value: last.current }, currentTarget: { ...event.currentTarget, value: last.current } } as React.ChangeEvent<HTMLInputElement>);
  };
  return <div className="relative w-full min-w-0 inline-flex items-center">
    <input {...props} ref={input} type="text" value={text} disabled={disabled} readOnly={readOnly} inputMode="numeric" dir="ltr" autoComplete="off"
      aria-label={props['aria-label'] || 'التاريخ (يوم/شهر/سنة)'} title="DD/MM/YYYY" className={`erp-date-input ${className} w-full pr-9`}
      onChange={event => {
        const raw = latinDigits(event.target.value);
        const digits = raw.replace(/\D/g, '').slice(0,8);
        const formatted = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? dateToDisplay(raw) : digits.length>4 ? `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}` : digits.length>2 ? `${digits.slice(0,2)}/${digits.slice(2)}` : digits;
        change(event, formatted);
      }} onKeyDown={onKeyDown} onBlur={e => { if (text && !dateToIso(text)) e.currentTarget.reportValidity(); onBlur?.(e); }} />
    <button type="button" tabIndex={-1} disabled={disabled || readOnly} aria-label="اختيار التاريخ من التقويم" className="absolute right-2 text-sky-600 dark:text-sky-300" onClick={() => { try { native.current?.showPicker(); } catch { native.current?.focus(); } }}><Calendar className="w-4 h-4" /></button>
    <input ref={native} type="date" value={dateToIso(text)} min={min} max={max} disabled={disabled || readOnly} tabIndex={-1} aria-hidden="true" className="absolute w-px h-px opacity-0 pointer-events-none" onChange={e => change(e,dateToDisplay(e.target.value))} />
  </div>;
}
