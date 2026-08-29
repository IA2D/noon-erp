import React, { useMemo } from 'react';
import ReportPageTemplate from './ReportPageTemplate';
import type { ReportMetadataEntry } from './ReportPageTemplate';
import { loadBranchesLocal, DEFAULT_COMPANY_BRANCH } from '../../utils/companyStore';
import type { CompanyBranch } from '../../types/erp';

export interface SignatureEntry {
  roleLabelAr: string;
  name?: string;
}

interface VoucherPrintTemplateProps {
  /** عنوان السند بالعربي (مثلاً: سند صرف نقدي) */
  voucherTitleAr: string;
  /** عنوان السند بالإنجليزي */
  voucherTitleEn: string;
  /** رقم المستند */
  documentNumber?: string;
  /** تاريخ المستند (YYYY-MM-DD أو DD/MM/YYYY) */
  documentDate?: string;
  /** العملة */
  currency?: string;
  /** بيانات إضافية تُعرض في شريط البيانات الوصفية */
  metadata?: ReportMetadataEntry[];
  /** التفقيط بالعربي — النص الكامل (مثلاً: فقط مئة ألف ريال يمني لا غير) */
  tafqeetText?: string;
  /** المبلغ الإجمالي بالأرقام مع رمز العملة */
  totalAmountText?: string;
  /** المعادل بالعملة المحلية */
  localEquivalentText?: string;
  /** التوقيعات — إذا لم يُمرَّر، يُستخدم المُعامل الافتراضي  */
  signatures?: SignatureEntry[];
  /** اسم المستخدم الحالي */
  currentUserName?: string;
  /** بيانات الشركة — تُجلب تلقائياً إذا لم تُمرَّر */
  company?: CompanyBranch;
  /** محتوى السند (الجدول الرئيسي) */
  children: React.ReactNode;
  /** فئة CSS إضافية على الحاوية الرئيسية */
  className?: string;
}

/** تنسيق التاريخ: YYYY-MM-DD → DD/MM/YYYY */
function fmtDate(d?: string): string {
  if (!d) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

const DEFAULT_SIGNATURES: SignatureEntry[] = [
  { roleLabelAr: 'أعده / المحاسب' },
  { roleLabelAr: 'المراجع الداخلي / التدقيق' },
  { roleLabelAr: 'المدير المالي / الاعتماد' },
  { roleLabelAr: 'المستلم / المستفيد' },
];

/**
 * قالب سند موحّد — يلفّ ReportPageTemplate ويضيف:
 *  • البطاقة الوصفية للسند (رقم + تاريخ + عملة + مرجع)
 *  • جدول التفقيط (المبلغ كتابةً + المعادل المحلي)
 *  • قسم التوقيعات والاعتمادات (4 أعمدة)
 */
export default function VoucherPrintTemplate({
  voucherTitleAr,
  voucherTitleEn,
  documentNumber,
  documentDate,
  currency,
  metadata = [],
  tafqeetText,
  totalAmountText,
  localEquivalentText,
  signatures,
  currentUserName = '—',
  company: companyProp,
  children,
  className = '',
}: VoucherPrintTemplateProps) {
  const company = useMemo(
    () => companyProp || loadBranchesLocal()[0] || DEFAULT_COMPANY_BRANCH,
    [companyProp]
  );

  const sigs = signatures || DEFAULT_SIGNATURES;

  // بناء شريط البيانات الوصفية: رقم المستند + تاريخ + عملة + البيانات الإضافية
  const metaEntries: ReportMetadataEntry[] = useMemo(() => {
    const entries: ReportMetadataEntry[] = [];
    if (documentNumber) entries.push({ label: 'رقم المستند', value: documentNumber });
    if (documentDate) entries.push({ label: 'التاريخ', value: fmtDate(documentDate) });
    if (currency) entries.push({ label: 'العملة', value: currency });
    entries.push(...metadata);
    return entries;
  }, [documentNumber, documentDate, currency, metadata]);

  return (
    <div className={`voucher-print-wrapper ${className}`} dir="rtl">
      <ReportPageTemplate
        reportTitleAr={voucherTitleAr}
        reportTitleEn={voucherTitleEn}
        reportSubtitle={documentNumber}
        currency={currency}
        metadata={metaEntries}
        currentUserName={currentUserName}
        company={company}
        orientation="portrait"
      >
        {/* ════════════════════════════════════════════════════
            محتوى السند — الجدول الرئيسي (يمرره الوالد)
            ════════════════════════════════════════════════════ */}
        <div className="voucher-body">
          {children}
        </div>

        {/* ════════════════════════════════════════════════════
            التفقيط والملخص المالي
            ════════════════════════════════════════════════════ */}
        {(tafqeetText || totalAmountText) && (
          <div className="voucher-tafqeet">
            <div className="voucher-tafqeet-right">
              {tafqeetText && (
                <>
                  <span className="voucher-tafqeet-label">المبلغ كتابةً:</span>
                  <span className="voucher-tafqeet-value">{tafqeetText}</span>
                </>
              )}
              {localEquivalentText && (
                <>
                  <span className="voucher-tafqeet-label">المعادل بالعملة المحلية:</span>
                  <span className="voucher-tafqeet-value">{localEquivalentText}</span>
                </>
              )}
            </div>
            <div className="voucher-tafqeet-left">
              {totalAmountText && (
                <div className="voucher-tafqeet-total">{totalAmountText}</div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            التوقيعات والاعتمادات المحاسبية
            ════════════════════════════════════════════════════ */}
        <div className="voucher-signatures">
          {sigs.map((sig, i) => (
            <div key={i} className="voucher-signature-col">
              <div className="voucher-sig-title">{sig.roleLabelAr}</div>
              <div className="voucher-sig-line">
                {sig.name ? (
                  <span className="voucher-sig-name">{sig.name}</span>
                ) : (
                  <span className="voucher-sig-placeholder">التوقيع: .....................</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ReportPageTemplate>
    </div>
  );
}
