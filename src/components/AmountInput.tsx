import { useEffect, useRef, useState, type ChangeEvent, type MouseEventHandler, type Ref } from 'react';
import { fmtAmount } from '../utils/format';

interface AmountInputProps {
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  title?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  name?: string;
  ref?: Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClick?: MouseEventHandler<HTMLInputElement>;
  'data-enter-field'?: string;
}

const rawOf = (v: string | number): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  return String(n);
};

const groupInt = (s: string): string => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const displayOf = (raw: string): string => {
  const dot = raw.indexOf('.');
  if (dot === -1) return groupInt(raw);
  return groupInt(raw.slice(0, dot)) + raw.slice(dot);
};

const clean = (raw: string): string => {
  let s = raw.replace(/[^\d.]/g, '');
  if (s === '') return '';
  s = s.replace(/^0+(?=\d)/, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    const intPart = s.slice(0, dot);
    const decPart = s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    s = (intPart === '' ? '0' : intPart) + '.' + decPart;
  }
  return s;
};

export default function AmountInput({ value, onChange, className, title, required, disabled, readOnly, id, name, ref, onKeyDown, onClick, 'data-enter-field': enterField }: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!focused) {
      const raw = rawOf(value);
      const n = raw === '' ? NaN : Number(raw);
      setText(Number.isFinite(n) && n !== 0 ? fmtAmount(n) : '');
    }
  }, [value, focused]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleanText = clean(e.target.value);
    setText(displayOf(cleanText));
    onChangeRef.current(cleanText);
  };

  const handleBlur = () => {
    setFocused(false);
    // A derived/read-only amount is presentation-only. Navigating across it must never write zero back to its source side.
    if (readOnly || disabled) return;
    const trimmed = text.replace(/,/g, '');
    if (trimmed === '') {
      setText('');
      onChangeRef.current('');
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setText('');
      onChangeRef.current('');
      return;
    }
    setText(fmtAmount(n));
    onChangeRef.current(String(n));
  };

  return (
    <input
      type="text"
      id={id}
      name={name}
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      value={text}

      title={title}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      onFocus={e => { setFocused(true); e.target.select(); }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      onClick={onClick}
      data-enter-field={enterField}
      data-amount-input="true"
      className={className}
    />
  );
}
