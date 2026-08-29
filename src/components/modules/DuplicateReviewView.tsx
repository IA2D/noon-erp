import React, { useMemo, useState } from 'react';
import { ScanSearch, Merge, ShieldAlert } from 'lucide-react';
import type { Customer, Employee, Vendor } from '../../types/erp';
import type { ERPContract } from '../../types/contracts';
import { findDuplicateEntities, mergeDuplicateEntity, type MergeEntityKind } from '../../utils/entityMerge';
import PageHeader from '../ui/PageHeader';
import { useToast } from '../ui/Toast';

interface Props { customers: Customer[]; vendors: Vendor[]; employees: Employee[]; contracts: ERPContract[]; currentUserName: string; onMerge: (result: { customers: Customer[]; vendors: Vendor[]; employees: Employee[]; contracts: ERPContract[] }, details: string) => void }
const labels: Record<MergeEntityKind,string> = { CUSTOMER:'العملاء', VENDOR:'الموردون', EMPLOYEE:'الموظفون' };

export default function DuplicateReviewView({ customers, vendors, employees, contracts, currentUserName, onMerge }: Props) {
  const toast=useToast(); const [kind,setKind]=useState<MergeEntityKind>('CUSTOMER');
  const entities=kind==='CUSTOMER'?customers:kind==='VENDOR'?vendors:employees;
  const candidates=useMemo(()=>findDuplicateEntities(kind,entities),[kind,entities]);
  const merge=(sourceId:string,targetId:string)=>{ const reason=window.prompt('سبب الدمج (سيبقى السجل المصدر مؤرشفًا وقابلًا للتتبع):','سجل مكرر بعد المراجعة')||''; const result=mergeDuplicateEntity(kind,sourceId,targetId,currentUserName,reason,{customers,vendors,employees,contracts}); if(!result.ok){toast('error',result.errors.join(' | '));return;} onMerge(result,`دمج ${labels[kind]}: ${result.record?.sourceCode} ← ${result.record?.targetCode}`); toast('success','تم الدمج مع أرشفة المصدر والحفاظ على الأثر المالي.'); };
  return <div className="space-y-6 animate-fade-in text-right"><PageHeader icon={<ScanSearch className="w-6 h-6"/>} title="مراجعة السجلات المكررة" subtitle="كشف ودمج آمن للعملاء والموردين والموظفين دون حذف التاريخ المالي"/>
    <div className="flex flex-wrap gap-2">{(['CUSTOMER','VENDOR','EMPLOYEE'] as MergeEntityKind[]).map(item=><button key={item} onClick={()=>setKind(item)} className={`px-4 py-2 rounded-xl font-bold ${kind===item?'bg-sky-600 text-white':'bg-slate-800 text-slate-300'}`}>{labels[item]}</button>)}</div>
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 flex gap-3 text-amber-200"><ShieldAlert className="w-5 h-5 shrink-0"/><p className="text-sm">الدمج لا يحذف السجل المصدر ولا يعيد كتابة القيود المرحلة؛ يُؤرشف المصدر ويُسجل الهدف وسجل الدمج. اختلاف حساب الربط يمنع الدمج حتى تنفيذ تحويل معتمد.</p></div>
    <section className="glass-card rounded-2xl border border-slate-700/50 overflow-hidden"><div className="p-4 border-b border-slate-800 flex justify-between"><span className="font-bold text-white">المرشحون للدمج</span><span className="text-sm text-slate-400">{candidates.length} تطابق</span></div>{candidates.length?candidates.map(item=><div key={`${item.firstId}:${item.secondId}`} className="p-4 border-b border-slate-800/70 grid lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center"><div className="rounded-xl bg-slate-900/60 p-3"><div className="font-bold text-white">{item.firstCode} — {item.firstName}</div><div className="text-xs text-slate-400 mt-1">سجل الهدف المقترح</div></div><div className="text-center"><div className="text-emerald-300 font-black">{item.score}%</div><div className="text-xs text-slate-500">{item.reasons.join('، ')}</div></div><div className="rounded-xl bg-slate-900/60 p-3"><div className="font-bold text-white">{item.secondCode} — {item.secondName}</div><div className="text-xs text-slate-400 mt-1">سجل مصدر مقترح</div></div><div className="flex gap-2"><button aria-label={`دمج ${item.secondCode} في ${item.firstCode}`} onClick={()=>merge(item.secondId,item.firstId)} className="px-3 py-2 rounded-lg bg-sky-600 text-white font-bold inline-flex gap-1"><Merge className="w-4 h-4"/>دمج</button><button aria-label={`دمج ${item.firstCode} في ${item.secondCode}`} onClick={()=>merge(item.firstId,item.secondId)} className="px-3 py-2 rounded-lg border border-slate-600 text-slate-300">عكس</button></div></div>):<div className="p-12 text-center text-slate-500">لا توجد سجلات متطابقة بدرجة تستدعي المراجعة.</div>}</section>
  </div>;
}
