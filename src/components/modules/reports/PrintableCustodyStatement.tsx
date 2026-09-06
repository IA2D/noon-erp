import React, { useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { CompanyBranch } from '../../../types/erp';
import { DEFAULT_COMPANY_BRANCH } from '../../../utils/companyStore';
import { tafqeetAmount } from '../../../utils/tafqeetHelper';
import BaseReportTemplate from '../../ui/BaseReportTemplate';
import { openDesktopPrintPreview } from '../../../utils/desktopPrintPreview';

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
  isSummary = false, currentUserName, company, onClose,
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
          totalDebit={totalDebit} totalCredit={totalCredit} docCount={movements.length} openingBalance={opening} closingBalance={closing}
          tafqeetText={tafqeetAmount(Math.abs(closing), curName, currencyCode)} balanceTag={closing >= 0 ? 'مدين' : 'دائن'} currencyNameAr={curName} currencySymbol={curSym}>
          {isSummary ? (
            <table className="report-table" style={{ width: '98%', maxWidth: '98%', margin: '0 auto', borderCollapse: 'collapse', fontSize: 8 }}><thead><tr><th>البند</th><th>العملة</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody><tr><td>إجمالي الحركة ({movements.length} عهدة)</td><td>{currencyCode}</td><td>{fmt(totalDebit)}</td><td>{fmt(totalCredit)}</td><td>{fmt(closing)}</td></tr></tbody></table>
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
