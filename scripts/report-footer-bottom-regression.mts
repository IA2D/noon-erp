import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('src/components/reports/FinancialReportPrintLayout.tsx', 'utf8');
const baseTemplate = fs.readFileSync('src/components/ui/BaseReportTemplate.tsx', 'utf8');
const pageTemplate = fs.readFileSync('src/components/ui/ReportPageTemplate.tsx', 'utf8');
const voucherTemplate = fs.readFileSync('src/components/ui/VoucherPrintTemplate.tsx', 'utf8');
const preview = fs.readFileSync('src/utils/desktopPrintPreview.ts', 'utf8');
const reportsView = fs.readFileSync('src/components/modules/FinancialReportsView.tsx', 'utf8');

assert.match(layout, /\.frp-wrap\s*\{[\s\S]*?min-height:\s*1123px;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
assert.match(layout, /\.frp-content\s*\{\s*flex:\s*1 0 auto;/);
assert.match(layout, /\.frp-page-foot\s*\{[\s\S]*?margin-top:\s*auto;/);
assert.match(layout, /طبع بواسطة: \{printedBy\}/);
assert.doesNotMatch(layout, /بواصطة/);
assert.match(layout, /@media print[\s\S]*?\.frp-wrap\s*\{[\s\S]*?display:\s*flex !important;[\s\S]*?min-height:\s*calc\(297mm - 28mm\) !important;/);
assert.match(layout, /\.frp-wrap\.frp-landscape\s*\{[\s\S]*?min-height:\s*calc\(210mm - 24mm\) !important;/);
assert.match(layout, /@media print[\s\S]*?\.frp-page-foot\s*\{[\s\S]*?position:\s*fixed !important;[\s\S]*?bottom:\s*-8mm !important;[\s\S]*?margin:\s*0 !important;/);
assert.match(preview, /orientation === 'landscape' \? '8mm 8mm 16mm' : '10mm 10mm 18mm'/);
assert.match(reportsView, /landscape \? '8mm 8mm 16mm' : '10mm 10mm 18mm'/);
assert.match(baseTemplate, /<FinancialReportPrintLayout/);
assert.match(pageTemplate, /<FinancialReportPrintLayout/);
assert.match(voucherTemplate, /<ReportPageTemplate/);

console.log('REPORT_FOOTER_BOTTOM_OK master=financial-report-layout portraitBottom=true landscapeBottom=true everyPrintedPage=true reservedFooterMargin=true previewBottom=true baseReports=true pageReports=true vouchers=true');
