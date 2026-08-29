import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { loadBranchesLocal, DEFAULT_COMPANY_BRANCH } from '../../utils/companyStore';
import type { CompanyBranch } from '../../types/erp';

export interface CompanyInfo {
  name: string;
  branch: string;
  address: string;
  phone: string;
  logoUrl?: string;
  nameEn?: string;
  branchEn?: string;
  addressEn?: string;
}

export interface FinancialReportPrintLayoutProps {
  /** اسم التقرير بالعربي (مثال: ميزان المراجعة حسب الحساب) */
  title: string;
  /** تاريخ البداية (YYYY-MM-DD) */
  fromDate?: string;
  /** تاريخ النهاية (YYYY-MM-DD) */
  toDate?: string;
  /** معلومات الشركة */
  companyInfo?: CompanyInfo;
  /** اسم ورقم المستخدم الذي طبع التقرير */
  printedBy: string;
  /** اتجاه الصفحة */
  orientation?: 'landscape' | 'portrait';
  /** Optional English subtitle kept in the shared master header. */
  titleEn?: string;
  pageNumber?: number;
  totalPages?: number;
  /** محتوى التقرير (الجدول الرئيسي + الإجماليات) */
  children: React.ReactNode;
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d.replace(/-/g, '/');
}

function stampNow(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function defaultsFromStorage(): CompanyInfo {
  const local = loadBranchesLocal()[0] || DEFAULT_COMPANY_BRANCH;
  return {
    name: local.companyNameAr || '—',
    branch: local.branchNameAr || local.branchCode || '—',
    address: local.addressAr || '',
    phone: local.phone || '',
    logoUrl: local.logoUrl || undefined,
    nameEn: local.companyNameEn || '—',
    branchEn: local.branchNameEn || local.branchCode || '—',
    addressEn: local.addressEn || '',
  } as CompanyInfo;
}

export default function FinancialReportPrintLayout({
  title,
  fromDate,
  toDate,
  companyInfo,
  printedBy,
  orientation = 'portrait',
  titleEn,
  pageNumber = 1,
  totalPages = 1,
  children,
}: FinancialReportPrintLayoutProps) {
  const co = useMemo(
    () => ({ ...defaultsFromStorage(), ...(companyInfo || {}) }),
    [companyInfo]
  );
  const stamp = useMemo(() => stampNow(), []);
  const isLandscape = orientation === 'landscape';

  // companyInfo قد تحوي حقول إضافية من defaultsFromStorage
  const coAny = co;

  return (
    <div
      className={`frp-wrap report-print-master ${isLandscape ? 'frp-landscape print-landscape' : ''}`}
      data-print-master="cash-movement"
      dir="rtl"
    >
      <style>{FINANCIAL_REPORT_PRINT_CSS}</style>

      {/* ═══════════════════════════════════════════════════
          الترويسة: صف الشركة 3 أعمدة
          ═══════════════════════════════════════════════════ */}
      <div className="frp-header">
        {/* العمود الأيمن — معلومات الشركة بالعربي */}
        <div className="frp-col-right">
          <div className="frp-company-ar">{co.name}</div>
          {co.branch && <div className="frp-sub">{co.branch}</div>}
          {co.address && <div className="frp-sub">{co.address}</div>}
        </div>

        {/* العمود الأوسط — الشعار الدائري + اسم التقرير + الفترة */}
        <div className="frp-col-center">
          {co.logoUrl ? (
            <img src={co.logoUrl} alt="logo" className="frp-logo" />
          ) : (
            <div className="frp-logo frp-logo-fallback">
              <Building2 style={{ width: 28, height: 28, color: '#fff' }} />
            </div>
          )}
          <div className="frp-report-title">{title}</div>
          {titleEn && <div className="frp-report-title-en">{titleEn}</div>}
          {(fromDate || toDate) && (
            <div className="frp-date-range">
              <span>من تاريخ : {fmtDate(fromDate)}</span>
              <span className="frp-date-sep">|</span>
              <span>إلى تاريخ : {fmtDate(toDate)}</span>
            </div>
          )}
        </div>

        {/* العمود الأيسر — معلومات الشركة بالإنجليزي + Tel */}
        <div className="frp-col-left">
          {coAny.nameEn && <div className="frp-company-en">{coAny.nameEn}</div>}
          {coAny.branchEn && <div className="frp-sub">{coAny.branchEn}</div>}
          {co.phone && <div className="frp-sub">Tel No: {co.phone}</div>}
        </div>
      </div>

      {/* خط فاصل أسود مزدوج */}
      <div className="frp-divider" />
      <div className="frp-divider-thin" />

      {/* ═══════════════════════════════════════════════════
          محتوى التقرير (الجدول الرئيسي)
          ═══════════════════════════════════════════════════ */}
      <div className="frp-content">
        {children}
      </div>

      {/* ═══════════════════════════════════════════════════
          ذيل التقرير — طبع بواسطة / ترقيم / تاريخ
          ═══════════════════════════════════════════════════ */}
      <div className="frp-page-foot print-footer">
        <span className="frp-foot-right">طبع بواسطة: {printedBy}</span>
        <span className="frp-foot-center">صفحة {pageNumber} من {totalPages}</span>
        <span className="frp-foot-left">تاريخ التقرير: {stamp}</span>
      </div>
    </div>
  );
}

export const FINANCIAL_REPORT_PRINT_CSS = `
/* ── الحاوية الرئيسية ── */
.frp-wrap {
  font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
  background: #ffffff;
  color: #0f172a;
  text-align: right;
  direction: rtl;
  width: 794px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
  min-height: 1123px;
  display: flex;
  flex-direction: column;
}

/* ═══════════════════════════════════════════════════════════════
   الترويسة: صف الشركة 3 أعمدة
   ═══════════════════════════════════════════════════════════════ */
.frp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.frp-meta-grid { display:flex; flex-wrap:wrap; gap:6px 14px; border:1px solid #111; padding:6px 8px; margin:6px 0 8px; font-size:10px; }
.frp-meta-item { display:flex; gap:4px; align-items:center; }
.frp-col-right { flex: 1; text-align: right; }
.frp-col-center { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.frp-col-left  { flex: 1; text-align: left; direction: ltr; }
.frp-company-ar { font-size: 14px; font-weight: 900; color: #000; line-height: 1.4; }
.frp-company-en { font-size: 12px; font-weight: 800; color: #000; line-height: 1.3; }
.frp-sub { font-size: 9px; color: #555; margin-top: 1px; line-height: 1.3; }

/* ── الشعار الدائري ── */
.frp-logo {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid #ccc;
  margin-bottom: 4px;
}
.frp-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0ea5e9, #1d4ed8);
  border: none;
}

/* ── عنوان التقرير ── */
.frp-report-title {
  text-align: center;
  font-size: 16px;
  font-weight: 900;
  color: #000;
  margin: 2px 0 0;
  white-space: nowrap;
  padding: 4px 18px;
  border: 1.5px solid #c5c7f1;
  border-radius: 8px;
  background: #f0f0ff;
}
.frp-report-title-en {
  margin-top: 2px;
  color: #475569;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
}

/* ── فترة التقرير ── */
.frp-date-range {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #333;
  font-weight: 700;
  margin-top: 6px;
}
.frp-date-sep { color: #999; font-weight: 900; }

/* ── الخطوط الفاصلة ── */
.frp-divider {
  height: 2px;
  background: #000;
  margin-bottom: 2px;
}
.frp-divider-thin {
  height: 0.5px;
  background: #000;
  margin-bottom: 10px;
}

/* ═══════════════════════════════════════════════════════════════
   محتوى التقرير — الجداول الموحدة
   ═══════════════════════════════════════════════════════════════ */
.frp-content {
  flex: 1 0 auto;
  margin-bottom: 6px;
}

/* ═══════════════════════════════════════════════════════════════
   ذيل التقرير — طبع بواسطة / ترقيم / تاريخ
   ═══════════════════════════════════════════════════════════════ */
.frp-page-foot {
  border-top: 1.5px solid #000;
  width: 100%;
  margin-top: auto;
  padding-top: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: bold;
  color: #000;
}
.frp-foot-right,
.frp-foot-center,
.frp-foot-left {
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════════════════
   Landscape variant
   ═══════════════════════════════════════════════════════════════ */
.frp-wrap.frp-landscape {
  width: 1122px;
  min-height: 794px;
}

/* ═══════════════════════════════════════════════════════════════
   الطباعة — @media print
   ═══════════════════════════════════════════════════════════════ */
@media print {
  nav, sidebar, .no-print, button, header, footer:not(.print-footer) {
    display: none !important;
  }

  body {
    background: white !important;
    color: black !important;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  .frp-wrap {
    display: flex !important;
    flex-direction: column !important;
    visibility: visible !important;
    position: relative !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: calc(297mm - 28mm) !important;
    overflow: visible !important;
  }

  .frp-wrap.frp-landscape {
    min-height: calc(210mm - 24mm) !important;
  }

  .frp-content {
    flex: 1 0 auto !important;
  }

  .frp-report-title {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .frp-page-foot {
    position: fixed !important;
    right: 0 !important;
    left: 0 !important;
    bottom: -8mm !important;
    width: auto !important;
    margin: 0 !important;
    border-top: 1.5px solid #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  tr {
    page-break-inside: avoid !important;
    page-break-after: auto !important;
  }
  table { width: 100% !important; border-collapse: collapse !important; }
  img { max-width: 100% !important; }
  .frp-header, .frp-page-foot, .frp-date-range { break-inside: avoid !important; }
  thead {
    display: table-header-group !important;
  }
  tfoot {
    display: table-footer-group !important;
  }
}
`;
