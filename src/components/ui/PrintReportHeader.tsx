import { useMemo } from 'react';
import { loadBranchesLocal, DEFAULT_COMPANY_BRANCH } from '../../utils/companyStore';
import type { CompanyBranch } from '../../types/erp';

interface PrintReportHeaderProps {
  reportTitleAr: string;
  reportTitleEn: string;
  reportSubtitle?: string;
  fromDate?: string;
  toDate?: string;
  currency?: string;
  currentUserName?: string;
  company?: CompanyBranch;
  printOnly?: boolean;
}

export default function PrintReportHeader({
  reportTitleAr,
  reportTitleEn,
  reportSubtitle,
  fromDate,
  toDate,
  currency,
  currentUserName = '—',
  company: companyProp,
  printOnly = true,
}: PrintReportHeaderProps) {
  const company = useMemo(
    () => companyProp || loadBranchesLocal()[0] || DEFAULT_COMPANY_BRANCH,
    [companyProp]
  );

  const now = new Date();
  const printDate = now.toLocaleDateString('ar-SA');
  const printTime = now.toLocaleTimeString('ar-SA');

  return (
    <div className={`print-report-header${printOnly ? ' hidden' : ''}`}>
      {/* صف الشركة: 3 أعمدة */}
      <div className="rpt-header-row">
        <div className="rpt-col-right">
          <div className="rpt-company-ar">{company.companyNameAr || '—'}</div>
          {(company.branchNameAr || company.branchCode) && (
            <div className="rpt-sub">{[company.branchNameAr, company.branchCode].filter(Boolean).join(' — ')}</div>
          )}
          {company.addressAr && <div className="rpt-sub">{company.addressAr}</div>}
        </div>
        <div className="rpt-col-center">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="Logo" className="rpt-logo" />
          ) : (
            <div className="rpt-logo rpt-logo-fallback" />
          )}
        </div>
        <div className="rpt-col-left">
          <div className="rpt-company-en">{company.companyNameEn || '—'}</div>
          {company.phone && <div className="rpt-sub">Tel No: {company.phone}</div>}
          {company.addressEn && <div className="rpt-sub">{company.addressEn}</div>}
        </div>
      </div>

      {/* عنوان التقرير */}
      <div className="rpt-title">{reportTitleAr}</div>
      <div className="rpt-title-en">{reportTitleEn}</div>
      {reportSubtitle && <div className="rpt-title-en">{reportSubtitle}</div>}

      {/* فترة التقرير */}
      {fromDate && toDate && (
        <div className="rpt-date-range">
          <span>من تاريخ : {fromDate}</span>
          <span className="rpt-date-sep">|</span>
          <span>إلى تاريخ : {toDate}</span>
        </div>
      )}

      {/* خط فاصل */}
      <div className="rpt-divider" />

      {/* شريط البيانات الوصفية */}
      <div className="rpt-meta-strip">
        <div>تاريخ الإصدار: {printDate} | الوقت: {printTime} | طبع بواسطة: {currentUserName}</div>
        <div>{currency && <>العملة: {currency}</>}</div>
      </div>
    </div>
  );
}
