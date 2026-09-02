import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const baseline=process.argv.includes('--baseline');
const {default:BaseReportTemplate}=await import(pathToFileURL(path.resolve(baseline?'transition_artifacts/report-system-v2-original/src/components/ui/BaseReportTemplate.tsx':'src/components/ui/BaseReportTemplate.tsx')).href);
import CustomerStatementPrint from '../src/components/reports/CustomerStatementPrint.tsx';
import { REPORT_PRINT_CSS } from '../electron/report-layout.mjs';
(globalThis as any).localStorage={getItem:()=>null};
const out='transition_artifacts/report-system-v2';fs.mkdirSync(out,{recursive:true});
for(const count of baseline?[0,28,60]:[0,1,28,60,150]) {
 const rows=Array.from({length:count},(_,i)=>React.createElement('tr',{key:i},...[
  `ROW-${i+1}`, '2026-08-30', `JV-${i+1}`, 'DUPLICATE-REFERENCE', 'شرح الحركة المحاسبية للتحقق من سلامة الطباعة', i===0?'12345678901234567890.00':'100.00', '0.00'
 ].map((v,k)=>React.createElement('td',{key:k},v))));
 const children=React.createElement('table',null,React.createElement('thead',null,React.createElement('tr',null,...['#','التاريخ','رقم المستند','رقم المرجع','البيان','عنوان عمود طويل للتحقق من التصغير','دائن'].map(v=>React.createElement('th',{key:v},v)))),React.createElement('tbody',null,rows.length?rows:React.createElement('tr',null,React.createElement('td',{colSpan:7},'EMPTY REPORT'))));
 const root=React.createElement(BaseReportTemplate,{reportTitleAr:'اختبار التقرير الموحد',reportTitleEn:`FIXTURE-${count}`,currentUserName:'PDF-TEST',fromDate:'2026-01-01',toDate:'2026-08-30',entityInfo:[{label:'العملة',value:'YER'},{label:'العملة',value:'YER'},{label:'رقم مستند المصدر',value:'DUPLICATE-SOURCE'}],children});
 fs.writeFileSync(`${out}/${baseline?"baseline":"fixture"}-${count}.html`, `<!doctype html><html dir="rtl"><head><meta charset="UTF-8"></head><body>${renderToStaticMarkup(root)}<style>${baseline?"":REPORT_PRINT_CSS}</style></body></html>`);
}
fs.writeFileSync(`${out}/legacy-empty.html`, `<!doctype html><html><meta charset="UTF-8"><body>${renderToStaticMarkup(React.createElement(CustomerStatementPrint,{statements:[]}))}</body></html>`);
console.log('REPORT_FIXTURES_CREATED counts=0,1,28,60,150 legacyEmpty=true');
