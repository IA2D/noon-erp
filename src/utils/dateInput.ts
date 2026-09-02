export const latinDigits = (value: string): string => value.replace(/[٠-٩۰-۹]/g, d => String('٠١٢٣٤٥٦٧٨٩'.includes(d) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
export function isValidDateIso(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m || +m[1] < 1000) return false;
  const date = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
  return date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2]-1 && date.getUTCDate() === +m[3];
}
export function dateToIso(value: string): string {
  const v = latinDigits(value || '').trim();
  const iso = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(v)?.[1];
  if (iso) return isValidDateIso(iso) ? iso : '';
  const digits = v.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const out = `${digits.slice(4)}-${digits.slice(2,4)}-${digits.slice(0,2)}`;
  return isValidDateIso(out) ? out : '';
}
export function dateToDisplay(value: string): string {
  const iso = dateToIso(value);
  return iso ? `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}` : '';
}
export function inDateRange(value: string, from: string, to: string): boolean {
  const iso = dateToIso(value);
  return !!iso && (!from || iso >= dateToIso(from)) && (!to || iso <= dateToIso(to));
}
