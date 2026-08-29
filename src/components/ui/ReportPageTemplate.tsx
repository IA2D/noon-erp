import React, { useMemo } from 'react';
import { loadBranchesLocal, DEFAULT_COMPANY_BRANCH } from '../../utils/companyStore';
import type { CompanyBranch } from '../../types/erp';
import FinancialReportPrintLayout from '../reports/FinancialReportPrintLayout';

export interface ReportMetadataEntry { label: string; value: string; }
interface ReportPageTemplateProps {
  reportTitleAr: string; reportTitleEn: string; reportSubtitle?: string;
  fromDate?: string; toDate?: string; currency?: string; metadata?: ReportMetadataEntry[];
  currentUserName?: string; company?: CompanyBranch; pageNumber?: number; totalPages?: number;
  printOnly?: boolean; children: React.ReactNode; orientation?: 'portrait' | 'landscape'; className?: string;
}

/** Shared report shell. All vouchers and operational statements use the حركة الصندوق master layout. */
export default function ReportPageTemplate({
  reportTitleAr, reportTitleEn, reportSubtitle, fromDate, toDate, currency,
  metadata = [], currentUserName = '—', company: companyProp, pageNumber = 1,
  totalPages = 1, printOnly = false, children, orientation = 'portrait', className = '',
}: ReportPageTemplateProps) {
  const company = useMemo(() => companyProp || loadBranchesLocal()[0] || DEFAULT_COMPANY_BRANCH, [companyProp]);
  const entries = [
    ...(reportSubtitle ? [{ label: 'المرجع', value: reportSubtitle }] : []),
    ...(currency ? [{ label: 'العملة', value: currency }] : []),
    ...metadata,
  ];
  return (
    <div className={`report-page-template ${printOnly ? 'hidden' : ''} ${className}`} dir="rtl">
      <FinancialReportPrintLayout
        title={reportTitleAr}
        titleEn={reportTitleEn}
        fromDate={fromDate}
        toDate={toDate}
        printedBy={currentUserName}
        orientation={orientation}
        pageNumber={pageNumber}
        totalPages={totalPages}
        companyInfo={{
          name: company.companyNameAr || '—', branch: company.branchNameAr || company.branchCode || '—',
          address: company.addressAr || '', phone: company.phone || '', logoUrl: company.logoUrl || undefined,
          nameEn: company.companyNameEn || '—', branchEn: company.branchNameEn || company.branchCode || '—', addressEn: company.addressEn || '',
        }}
      >
        {entries.length > 0 && (
          <div className="frp-meta-grid">
            {entries.map((entry, index) => <div key={`${entry.label}-${index}`} className="frp-meta-item"><b>{entry.label}:</b> <span>{entry.value}</span></div>)}
          </div>
        )}
        <main className="report-content">{children}</main>
      </FinancialReportPrintLayout>
    </div>
  );
}
