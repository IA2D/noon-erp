import React, { useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { CompanyBranch } from '../../../types/erp';
import { DEFAULT_COMPANY_BRANCH } from '../../../utils/companyStore';
import { tafqeetAmount } from '../../../utils/tafqeetHelper';
import BaseReportTemplate from '../../ui/BaseReportTemplate';
import { openDesktopPrintPreview } from '../../../utils/desktopPrintPreview';
import { summarizeStatementCurrencyConversions } from '../../../utils/statementSummary';

export interface CustodyStatementRow {
  id?: string;
  date: string;
  docType: string;
  docNumber: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  currency?: string;
  /** قيمة السطر بالعملة المحلية للتجميع متعدد العملات. */
  localDebit?: number;
  localCredit?: number;
  running?: number;
  seq?: number;
  disbursementMethod?: string;
  sourceName?: string;
  costCenter?: string;
}

interface Props {
  titleAr: string;
  titleEn?: string;
  subjectCode: string;
  subjectName: string;
  subjectExtra?: string;
  fromDate: string;
  toDate: string;
  currencyCode: string;
  currencyNameAr?: string;
  currencySymbol?: string;
  opening: number;
  rows: CustodyStatementRow[];
  isSummary?: boolean;
  currentUserName?: string;
  company?: CompanyBranch | null;
  onClose?: () => void;
  currencyRates?: Record<string, number>;
}

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const fmt = (value: number) => (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (value: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (value || '—').replace(/-/g, '/');
};

/** A currency-specific custody statement. Every displayed amount remains in its original currency. */
export default function PrintableCustodyStatement({
  titleAr, titleEn = 'Custody Financial Statement', subjectCode, subjectName, subjectExtra,
  fromDate, toDate, currencyCode, currencyNameAr, currencySymbol, opening, rows,
  isSummary = false, currentUserName, company, onClose, currencyRates,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const curName = currencyNameAr || currencyCode;
  const curSym = currencySymbol || currencyCode;
  const movements = useMemo(() => {
    let running = round2(opening);
    return rows.map((row, index) => {
      running = row.running === undefined ? round2(running + row.debit - row.credit) : round2(row.running);
      return { ...row, seq: row.seq ?? index + 1, running };
    });
  }, [rows, opening]);
  const totalDebit = round2(movements.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = round2(movements.reduce((sum, row) => sum + row.credit, 0));
  const closing = round2(opening + totalDebit - totalCredit);
  const currencyGroups = useMemo(() => { const groups = new Map<string, typeof movements>(); movements.forEach(row => { const code = row.currency || currencyCode; const bucket = groups.get(code) || []; bucket.push(row); groups.set(code, bucket); }); return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [movements, currencyCode]);
  const localTotals = useMemo(() => currencyGroups.reduce((totals, [, group]) => ({ debit: round2(totals.debit + group.reduce((sum, row) => sum + (row.localDebit ?? row.debit), 0)), credit: round2(totals.credit + group.reduce((sum, row) => sum + (row.localCredit ?? row.credit), 0)) }), { debit: 0, credit: 0 }), [currencyGroups]);
  const conversions = useMemo(() => summarizeStatementCurrencyConversions(movements, currencyCode, currencyRates), [movements, currencyCode, currencyRates]);
  const displayDebit = isSummary ? localTotals.debit : totalDebit; const displayCredit = isSummary ? localTotals.credit : totalCredit; const displayClosing = isSummary ? round2(conversions.reduce((sum, row) => sum + row.localClosing, 0)) : round2(opening + displayDebit - displayCredit);
  const balanceText = (amount: number) => `${amount >= 0 ? 'مدين' : 'دائن'} ${fmt(Math.abs(amount))}`;
  const handlePrint = () => openDesktopPrintPreview(ref.current, `${titleAr} - ${subjectName}`, 'landscape');

  return (
    <div className="printable-custody-statement">
      <div className="no-print flex items-center justify-between gap-3 mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div><div className="text-sm font-black text-slate-800">{titleAr}</div><div className="text-xs text-slate-500">{subjectCode} — {subjectName}</div></div>
        <div className="flex gap-2"><button type="button" onClick={() => void handlePrint()} className="rounded-xl bg-blue-600 text-white text-xs font-bold px-4 py-2"><Printer className="inline w-4 h-4" /> معاينة الطباعة / PDF</button>{onClose && <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-xs font-bold"><X className="inline w-4 h-4" /> إغلاق</button>}</div>
      </div>
      <div ref={ref} className="paper print-area" style={{ width: 1123, margin: '0 auto' }}>
        <BaseReportTemplate reportTitleAr={titleAr} reportTitleEn={titleEn} fromDate={fromDate} toDate={toDate} currentUserName={currentUserName} company={company ?? DEFAULT_COMPANY_BRANCH}
          entityInfo={[{ label: 'الكود', value: subjectCode }, { label: 'الاسم', value: subjectName }, { label: 'البيان', value: subjectExtra || '—' }, { label: 'العملة', value: curName === curSym ? curName : `${curName} (${curSym})` }]}
          totalDebit={displayDebit} totalCredit={displayCredit} docCount={movements.length} openingBalance={opening} closingBalance={displayClosing}
          tafqeetText={tafqeetAmount(Math.abs(displayClosing), curName, currencyCode)} balanceTag={displayClosing >= 0 ? 'عليكم (مدين)' : 'لكم (دائن)'} currencyNameAr={curName} currencySymbol={curSym} hideMovementSummary={isSummary}>
          {isSummary ? (
            <><table className="report-table" style={{ width: '98%', maxWidth: '98%', margin: '0 auto', borderCollapse: 'collapse', fontSize: 8 }}><thead><tr><th>#</th><th>الحساب / الموظف</th><th>العملة</th><th>الرصيد</th></tr></thead><tbody>{currencyGroups.flatMap(([code, group]) => { const groupClosing = round2(group.reduce((sum, row) => sum + row.debit - row.credit, 0)); return [<tr key={`${code}-heading`}><td colSpan={4} style={{ fontWeight: 900, background: '#e8e7fc' }}>العملة: {code}</td></tr>, ...group.map((row, index) => <tr key={row.id || `${code}-${index}`}><td>{index + 1}</td><td>{row.description}</td><td>{code}</td><td>{balanceText(row.debit - row.credit)}</td></tr>), <tr key={`${code}-total`} style={{ fontWeight: 900, background: '#f1f5f9' }}><td colSpan={3}>إجمالي {code}</td><td>{balanceText(groupClosing)}</td></tr>]; })}</tbody><tfoot><tr style={{ fontWeight: 900, background: '#c5c7f1' }}><td colSpan={3}>إجمالي جميع العملات بالعملة المحلية ({currencyCode})</td><td>{balanceText(conversions.reduce((sum, row) => sum + row.localClosing, 0))}</td></tr></tfoot></table><div style={{ width: '98%', margin: '7px auto', border: '1px solid #000', padding: '6px 8px', fontSize: 8 }}>{conversions.map(row => <div key={row.currency} dir="rtl" style={{ textAlign: 'right', unicodeBidi: 'plaintext', padding: '4px 0', borderBottom: '1px solid #d1d5db' }}><div style={{ fontWeight: 800 }}>إجمالي العملة <bdi dir="ltr">{row.currency}</bdi></div><div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 18px', alignItems: 'baseline' }}><bdi dir="ltr">{row.currency} {fmt(Math.abs(row.closing))}</bdi><span>سعر التحويل: <bdi dir="ltr">{fmt(row.exchangeRate)}</bdi></span></div><div>الإجمالي بالعملة المحلية (<bdi dir="ltr">{currencyCode}</bdi>)</div><bdi dir="ltr">{row.currency} {fmt(Math.abs(row.closing))} × {fmt(row.exchangeRate)} = {fmt(row.localClosing)} {currencyCode}</bdi></div>)}<div dir="rtl" style={{ fontWeight: 900, marginTop: 6, textAlign: 'right', unicodeBidi: 'plaintext' }}>مجموع إجمالي العملات بالعملة المحلية (<bdi dir="ltr">{currencyCode}</bdi>)<bdi dir="ltr" style={{ display: 'block' }}>{fmt(conversions.reduce((sum, row) => sum + row.localClosing, 0))} {currencyCode}</bdi></div></div></>
          ) : (
            <table className="report-table" style={{ width: '98%', maxWidth: '98%', margin: '0 auto', borderCollapse: 'collapse', fontSize: 6.5 }}>
              <thead><tr><th>#</th><th>التاريخ</th><th>رقم العهدة</th><th>البيان</th><th>طريقة الصرف</th><th>المصدر</th><th>مركز التكلفة</th><th>رقم المرجع</th><th>العملة</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
              <tbody>{movements.map(row => <tr key={row.id || row.seq}><td>{row.seq}</td><td>{fmtDate(row.date)}</td><td>{row.docNumber}</td><td>{row.description}</td><td>{row.disbursementMethod || '—'}</td><td>{row.sourceName || '—'}</td><td>{row.costCenter || '—'}</td><td>{row.reference || '—'}</td><td>{row.currency || currencyCode}</td><td>{row.debit ? fmt(row.debit) : ''}</td><td>{row.credit ? fmt(row.credit) : ''}</td><td>{fmt(row.running)}</td></tr>)}</tbody>
            </table>
          )}
        </BaseReportTemplate>
      </div>
    </div>
  );
}
