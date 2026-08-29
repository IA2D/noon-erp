import React, { useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { CompanyBranch } from '../../../types/erp';
import { DEFAULT_COMPANY_BRANCH } from '../../../utils/companyStore';
import { tafqeetAmount } from '../../../utils/tafqeetHelper';
import BaseReportTemplate from '../../ui/BaseReportTemplate';
import { openDesktopPrintPreview } from '../../../utils/desktopPrintPreview';

export interface PrintableStatementRow { id?: string; date: string; docType: string; docNumber: string; reference: string; description: string; debit: number; credit: number; running?: number; seq?: number; }
export interface PrintableAccountStatementProps { titleAr: string; titleEn?: string; subjectCode: string; subjectName: string; subjectExtra?: string; fromDate: string; toDate: string; currencyCode: string; currencyNameAr?: string; currencySymbol?: string; opening: number; rows: PrintableStatementRow[]; isSummary?: boolean; showOpening?: boolean; currentUserName?: string; company?: CompanyBranch | null; rowsPerPage?: number; onClose?: () => void; }
const round2=(n:number)=>Math.round((n||0)*100)/100;
const fmt=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=(d:string)=>{const m=d?.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:(d||'—').replace(/-/g,'/');};

export default function PrintableAccountStatement({ titleAr,titleEn='Statement of Account',subjectCode,subjectName,subjectExtra,fromDate,toDate,currencyCode,currencyNameAr,currencySymbol,opening,rows,showOpening=true,currentUserName,company,onClose }:PrintableAccountStatementProps){
  const ref=useRef<HTMLDivElement>(null); const co=company??DEFAULT_COMPANY_BRANCH; const curName=currencyNameAr||currencyCode; const curSym=currencySymbol||currencyCode;
  const movements=useMemo(()=>{let running=round2(opening);return (rows||[]).map((r,i)=>{running=r.running!==undefined?round2(r.running):round2(running+r.debit-r.credit);return{...r,seq:r.seq??i+1,running};});},[rows,opening]);
  const totalDebit=round2(movements.reduce((s,m)=>s+m.debit,0)); const totalCredit=round2(movements.reduce((s,m)=>s+m.credit,0)); const closing=round2(opening+totalDebit-totalCredit);
  const handlePrint=()=>openDesktopPrintPreview(ref.current,`${titleAr} - ${subjectName}`,'portrait');
  return <div className="printable-account-statement">
    <div className="no-print flex items-center justify-between gap-3 mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div><div className="text-sm font-black text-slate-800">{titleAr}</div><div className="text-xs text-slate-500">{subjectCode} — {subjectName}</div></div>
      <div className="flex gap-2"><button type="button" onClick={()=>void handlePrint()} className="rounded-xl bg-blue-600 text-white text-xs font-bold px-4 py-2"><Printer className="inline w-4 h-4"/> معاينة الطباعة / PDF</button>{onClose&&<button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-xs font-bold"><X className="inline w-4 h-4"/> إغلاق</button>}</div>
    </div>
    <div ref={ref} className="paper print-area" style={{width:794,margin:'0 auto'}}>
      <BaseReportTemplate reportTitleAr={titleAr} reportTitleEn={titleEn} fromDate={fromDate} toDate={toDate} currentUserName={currentUserName} company={co}
        entityInfo={[{label:'الكود',value:subjectCode},{label:'الاسم',value:subjectName},{label:'البيان',value:subjectExtra||'—'},{label:'العملة',value:`${curName} (${curSym})`}]} totalDebit={totalDebit} totalCredit={totalCredit} docCount={movements.length} openingBalance={opening} closingBalance={closing} tafqeetText={tafqeetAmount(Math.abs(closing),curName,currencyCode)} balanceTag={closing>=0?'مدين':'دائن'} currencyNameAr={curName} currencySymbol={curSym}>
        <table className="report-table" style={{width:'100%',borderCollapse:'collapse',fontSize:10}}><thead><tr><th>#</th><th>التاريخ</th><th>المستند</th><th>الرقم</th><th>المرجع</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
          {showOpening&&<tr><td></td><td>—</td><td>رصيد افتتاحي</td><td>—</td><td>—</td><td>الرصيد الافتتاحي</td><td>{opening>0?fmt(opening):''}</td><td>{opening<0?fmt(Math.abs(opening)):''}</td><td>{fmt(opening)}</td></tr>}
          {movements.map(m=><tr key={m.id||m.seq}><td>{m.seq}</td><td>{fmtDate(m.date)}</td><td>{m.docType}</td><td>{m.docNumber}</td><td>{m.reference}</td><td>{m.description}</td><td>{m.debit?fmt(m.debit):''}</td><td>{m.credit?fmt(m.credit):''}</td><td>{fmt(m.running||0)}</td></tr>)}
        </tbody></table>
      </BaseReportTemplate>
    </div>
  </div>;
}
