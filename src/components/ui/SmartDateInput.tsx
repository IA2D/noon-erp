import React from 'react';
import DateField from './DateField';
interface Props { value: string; onChange: (iso: string) => void; id?: string; className?: string; disabled?: boolean; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>; }
export default function SmartDateInput({ onChange, className = '', ...props }: Props) {
 return <DateField {...props} onChange={e => onChange(e.target.value)} className={`px-3 py-2 text-sm text-center text-slate-100 bg-slate-900 border border-slate-700 rounded-lg ${className}`} />;
}
