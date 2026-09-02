import React from 'react';
import DateField from '../ui/DateField';
import { dateToIso, dateToDisplay } from '../../utils/dateInput';
export const smartDateToIso = dateToIso;
export const isoToSmartDate = dateToDisplay;
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
interface Props { value: string; onChange: (display: string) => void; className?: string; disabled?: boolean; }
export function SmartDateInput({ value, onChange, className='', disabled }: Props) {
 return <DateField value={dateToIso(value)} onChange={e => onChange(dateToDisplay(e.target.value))} disabled={disabled} className={`px-3 py-2 text-sm text-center text-slate-100 bg-slate-900 border border-slate-700 rounded-lg ${className}`} />;
}
export default SmartDateInput;
