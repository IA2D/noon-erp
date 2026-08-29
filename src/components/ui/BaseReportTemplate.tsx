import React, { useMemo } from 'react';
import { loadBranchesLocal, DEFAULT_COMPANY_BRANCH } from '../../utils/companyStore';
import { tafqeetAmount, balanceNature } from '../../utils/tafqeetHelper';
import type { CompanyBranch } from '../../types/erp';
import FinancialReportPrintLayout from '../reports/FinancialReportPrintLayout';

export interface EntityInfo { label: string; value: string; }
export interface ReportSignature { roleLabel: string; name?: string; }

export interface BaseReportTemplateProps {
  reportTitleAr: string;
  reportTitleEn?: string;
  fromDate?: string;
  toDate?: string;
  entityInfo?: EntityInfo[];
  company?: CompanyBranch;
  currentUserName?: string;
  totalDebit?: number;
  totalCredit?: number;
  docCount?: number;
  openingBalance?: number;
  closingBalance?: number;
  tafqeetText?: string;
  balanceTag?: string;
  currencyNameAr?: string;
  currencySymbol?: string;
  signatures?: ReportSignature[];
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  className?: string;
  pageNumber?: number;
  totalPages?: number;
}

const fmt = (n: number): string => (Number(n) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Compatibility report body that now delegates all shared branding to the
 * “حركة الصندوق” master shell. Logo/header/footer edits belong in
 * FinancialReportPrintLayout only.
 */
export default function BaseReportTemplate({
  reportTitleAr,
  reportTitleEn,
  fromDate,
  toDate,
  entityInfo = [],
  company: companyProp,
  currentUserName = '—',
  totalDebit = 0,
  totalCredit = 0,
  docCount = 0,
  openingBalance,
  closingBalance,
  tafqeetText,
  balanceTag,
  currencyNameAr = '',
  currencySymbol = '',
  signatures = [],
  children,
  footerContent,
  className = '',
  pageNumber = 1,
  totalPages = 1,
}: BaseReportTemplateProps) {
  const company = useMemo(
    () => companyProp || loadBranchesLocal()[0] || DEFAULT_COMPANY_BRANCH,
    [companyProp]
  );
  const computedBalanceTag = balanceTag || (closingBalance !== undefined ? balanceNature(closingBalance).tag : '');
  const computedTafqeet = tafqeetText || (closingBalance !== undefined && currencyNameAr
    ? tafqeetAmount(Math.abs(closingBalance), currencyNameAr, currencySymbol)
    : '');
  const showSummary = totalDebit !== 0 || totalCredit !== 0 || closingBalance !== undefined || docCount > 0;

  return (
    <FinancialReportPrintLayout
      title={reportTitleAr}
      titleEn={reportTitleEn}
      fromDate={fromDate}
      toDate={toDate}
      printedBy={currentUserName}
      orientation="portrait"
      pageNumber={pageNumber}
      totalPages={totalPages}
      companyInfo={{
        name: company.companyNameAr || '—',
        branch: [company.branchNameAr, company.branchCode].filter(Boolean).join(' — ') || '—',
        address: company.addressAr || '',
        phone: company.phone || '',
        logoUrl: company.logoUrl || undefined,
        nameEn: company.companyNameEn || '—',
        branchEn: company.branchNameEn || company.branchCode || '—',
        addressEn: company.addressEn || '',
      }}
    >
      <style>{BASE_REPORT_BODY_CSS}</style>
      <section className={`brt-body ${className}`}>
        {entityInfo.length > 0 && (
          <div className="brt-infobar">
            {entityInfo.map((info, index) => (
              <div key={`${info.label}-${index}`} className="brt-info-cell">
                <span>{info.label}:</span><b>{info.value}</b>
              </div>
            ))}
          </div>
        )}

        <div className="brt-content">{children}</div>

        {showSummary && (
          <div className="brt-summary">
            <table className="brt-summary-table">
              <tbody><tr>
                <td className="brt-sum-label">إجمالي العمليات ({docCount} مستند)</td>
                <td className="brt-sum-num">{fmt(totalDebit)}</td>
                <td className="brt-sum-num">{fmt(totalCredit)}</td>
                {openingBalance !== undefined && <td className="brt-sum-num brt-sum-highlight">{fmt(closingBalance ?? 0)}</td>}
              </tr></tbody>
            </table>
            {closingBalance !== undefined && (
              <div className="brt-balance-box">
                <div><b>{computedBalanceTag || 'الرصيد الختامي'}:</b> {computedTafqeet}</div>
                <strong>{fmt(Math.abs(closingBalance))}</strong>
              </div>
            )}
            {footerContent}
            {signatures.length > 0 && (
              <div className="brt-signatures">
                {signatures.map((signature, index) => (
                  <div key={`${signature.roleLabel}-${index}`} className="brt-sign-cell">
                    <b>{signature.roleLabel}</b><div className="brt-sign-line" />
                    {signature.name && <small>{signature.name}</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </FinancialReportPrintLayout>
  );
}

export const BASE_REPORT_BODY_CSS = `
.brt-body { color:#000; direction:rtl; }
.brt-infobar { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; break-inside:avoid; }
.brt-info-cell { flex:1 1 140px; display:flex; justify-content:space-between; gap:6px; border:1px solid #000; background:#f9f8fc; padding:4px 8px; font-size:9.5px; }
.brt-info-cell b { font-weight:800; }
.brt-content table, .brt-summary-table { width:100%; border-collapse:collapse; font-size:10px; table-layout:auto; }
.brt-content th, .brt-content td, .brt-summary-table td { border:1px solid #000; padding:4px 5px; }
.brt-content th { background:#c5c7f1; font-weight:900; white-space:nowrap; }
.brt-content thead { display:table-header-group; }
.brt-content tr { break-inside:avoid; }
.brt-content tbody tr:nth-child(even) { background:#f9f8fc; }
.brt-summary { margin-top:6px; break-inside:avoid; }
.brt-sum-label { background:#c5c7f1; font-weight:900; }
.brt-sum-num { text-align:left; direction:ltr; font-family:Consolas,monospace; font-weight:700; }
.brt-sum-highlight { background:#f0f0ff; font-weight:900; }
.brt-balance-box { margin-top:6px; border:2px solid #000; background:#f9f8fc; padding:7px 12px; display:flex; justify-content:space-between; gap:12px; font-size:11px; }
.brt-balance-box strong { direction:ltr; font:900 16px Consolas,monospace; }
.brt-signatures { display:flex; gap:12px; margin-top:14px; break-inside:avoid; }
.brt-sign-cell { flex:1; text-align:center; font-size:10px; }
.brt-sign-line { height:28px; border-bottom:1px solid #000; }
.brt-sign-cell small { color:#475569; }
@media print {
  .brt-info-cell, .brt-content th, .brt-sum-label, .brt-sum-highlight, .brt-balance-box {
    -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;
  }
}
`;
