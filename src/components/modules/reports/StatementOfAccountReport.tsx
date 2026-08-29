import React, { useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { CompanyBranch } from '../../../types/erp';
import { DEFAULT_COMPANY_BRANCH } from '../../../utils/companyStore';
import { tafqeet } from '../../../utils/tafqeet';
import type { StatementResult, StatementRow } from '../../../services/statementOfAccountService';
import BaseReportTemplate from '../../ui/BaseReportTemplate';
import { openDesktopPrintPreview } from '../../../utils/desktopPrintPreview';

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string): string => (d ? d.replace(/-/g, '/') : '—');

const DECIMAL_BY_CODE: Record<string, string> = {
  YER: 'فلس',
  IQD: 'فلس',
  JOD: 'فلس',
  KWD: 'فلس',
  BHD: 'فلس',
  OMR: 'بيسة',
  LBP: 'فلس',
  EGP: 'قرش',
};

interface Props {
  result: StatementResult;
  currentUserName?: string;
  company?: CompanyBranch | null;
  onClose?: () => void;
  rowsPerPage?: number;
}

export default function StatementOfAccountReport({
  result,
  currentUserName,
  company,
  onClose,
  rowsPerPage = 20
}: Props) {
  const companyInfo = company ?? DEFAULT_COMPANY_BRANCH;
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintPreview = () => openDesktopPrintPreview(printRef.current, `كشف حساب ${result.subject.name}`, 'portrait');

  const decimalName = useMemo(
    () => DECIMAL_BY_CODE[result.baseCode] || 'هللة',
    [result.baseCode]
  );
  const tafqeetText = useMemo(
    () => tafqeet(Math.abs(result.closing), result.baseNameAr, decimalName),
    [result.closing, result.baseNameAr, decimalName]
  );

  const openingRow: StatementRow = {
    seq: 0,
    date: '',
    docType: 'رصيد افتتاحي',
    docNumber: '—',
    reference: '—',
    narration: `رصيد افتتاحي ${result.subject.name}`,
    debit: result.openingDebit,
    credit: result.openingCredit,
    running: result.opening
  };

  const flatRows: StatementRow[] = [openingRow, ...result.rows];
  const pageCount = Math.max(1, Math.ceil(flatRows.length / rowsPerPage));
  const pages = Array.from({ length: pageCount }, (_, p) =>
    flatRows.slice(p * rowsPerPage, (p + 1) * rowsPerPage)
  );

  const closingTag = result.isDebit ? 'لكم (رصيد مدين)' : 'عليكم (رصيد دائن)';

  const openingLabel = result.openingDebit > 0
    ? `${fmt(result.openingDebit)} مدين`
    : result.openingCredit > 0
      ? `${fmt(result.openingCredit)} دائن`
      : 'صفر';

  return (
    <div className="soa-wrap">
      <style>{`
        .soa-wrap { direction: rtl; }
        .soa-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .soa-table th, .soa-table td { border: 1px solid #000; padding: 3px 5px; text-align: right; }
        .soa-table th { background: #c6c7f8; color: #000; font-weight: 900; white-space: nowrap; }
        .soa-table thead { display: table-header-group; }
        .soa-table tr { page-break-inside: avoid; }
        .soa-row-even { background: #f9f8fc; }
        .soa-row-opening { background: #e8e7fc !important; font-weight: 800; }
        .soa-col-seq { width: 28px; text-align: center; }
        .soa-col-date { width: 64px; }
        .soa-col-doc { width: 88px; }
        .soa-col-no { width: 62px; }
        .soa-col-ref { width: 70px; }
        .soa-col-num { width: 72px; text-align: left !important; font-family: 'Consolas', monospace; }
        .soa-col-bal { width: 80px; text-align: left !important; font-weight: 700; font-family: 'Consolas', monospace; color: #1e3a8a; }
        @media print {
          .soa-page { page-break-after: always; }
          .soa-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {/* شريط الأدوات — لا يُطبع */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-black text-slate-800">معاينة كشف الحساب التحليلي</div>
          <div className="text-sm text-slate-500 mt-0.5">
            {result.kindLabel}: {result.subject.name} — الفترة: {fmtDate(result.fromDate)} ← {fmtDate(result.toDate)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePrintPreview()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة / PDF
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 text-xs font-bold px-4 py-2 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* منطقة الطباعة A4 */}
      <div ref={printRef} dir="rtl" className="paper print-area" style={{ width: 794, margin: '0 auto' }}>
        {pages.map((pageRows, p) => (
          <div key={p} className="bg-white p-5" style={{ pageBreakAfter: p < pageCount - 1 ? 'always' : 'auto' }}>
            <BaseReportTemplate
              reportTitleAr="كشف حساب تحليلي"
              reportTitleEn="Statement of Account"
              fromDate={result.fromDate}
              toDate={result.toDate}
              currentUserName={currentUserName}
              company={companyInfo}
              entityInfo={[
                { label: 'رقم الحساب', value: result.subject.accountCode },
                { label: 'اسم الحساب', value: result.subject.accountName },
                { label: 'العملة', value: `${result.baseNameAr} (${result.baseSymbol})` },
                { label: 'الرصيد الافتتاحي', value: openingLabel },
                { label: 'عدد الحركات', value: String(result.count) },
              ]}
              totalDebit={result.totalDebit}
              totalCredit={result.totalCredit}
              docCount={result.count}
              openingBalance={result.opening}
              closingBalance={result.closing}
              tafqeetText={tafqeetText}
              balanceTag={closingTag}
              currencyNameAr={result.baseNameAr}
              currencySymbol={result.baseSymbol}
              signatures={[
                { roleLabel: 'المحاسب' },
                { roleLabel: 'المراجع' },
                { roleLabel: 'المدير المالي' },
                { roleLabel: 'توقيع المستلم' },
              ]}
              pageNumber={p + 1}
              totalPages={pageCount}
            >
              <table className="soa-table">
                <thead>
                  <tr>
                    <th className="soa-col-seq">#</th>
                    <th className="soa-col-date">التاريخ</th>
                    <th className="soa-col-doc">نوع المستند</th>
                    <th className="soa-col-no">رقم المستند</th>
                    <th className="soa-col-ref">المرجع</th>
                    <th>البيان</th>
                    <th className="soa-col-num">مدين</th>
                    <th className="soa-col-num">دائن</th>
                    <th className="soa-col-bal">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => (
                    <tr
                      key={row.seq}
                      className={row.seq === 0 ? 'soa-row-opening' : row.seq % 2 === 0 ? 'soa-row-even' : ''}
                    >
                      <td className="soa-col-seq">{row.seq === 0 ? '' : row.seq}</td>
                      <td className="soa-col-date">{row.seq === 0 ? '—' : fmtDate(row.date)}</td>
                      <td className="soa-col-doc">{row.docType}</td>
                      <td className="soa-col-no">{row.docNumber}</td>
                      <td className="soa-col-ref">{row.reference}</td>
                      <td>{row.narration}</td>
                      <td className="soa-col-num">{row.debit > 0 ? fmt(row.debit) : ''}</td>
                      <td className="soa-col-num">{row.credit > 0 ? fmt(row.credit) : ''}</td>
                      <td className="soa-col-bal">{fmt(row.running)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BaseReportTemplate>
          </div>
        ))}
      </div>
    </div>
  );
}
