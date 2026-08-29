import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BaseReportTemplate from '../src/components/ui/BaseReportTemplate.tsx';

(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => null, setItem: () => undefined };
const company = {
  companyNameAr: 'شركة اختبار', companyNameEn: 'Test Co', branchNameAr: 'الرئيسي', branchNameEn: 'Main',
  branchCode: '01', addressAr: '', addressEn: '', phone: '', logoUrl: '',
} as never;
const children = React.createElement('table', null, React.createElement('tbody', null,
  React.createElement('tr', null, React.createElement('td', null, 'row'))));
const html = renderToStaticMarkup(React.createElement(BaseReportTemplate, {
  reportTitleAr: 'كشف موحد', reportTitleEn: 'Unified', company, currentUserName: 'admin', children,
}));
const result = {
  master: html.includes('data-print-master="cash-movement"'),
  title: html.includes('كشف موحد'),
  footer: html.includes('طبع بواسطة: admin'),
  duplicateLegacyHeader: html.includes('brt-company-row'),
};
if (!result.master || !result.title || !result.footer || result.duplicateLegacyHeader) process.exitCode = 1;
console.log(`PRINT_TEMPLATE_SMOKE_OK ${JSON.stringify(result)}`);
