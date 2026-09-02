import DateField from '../ui/DateField';
import React, { useMemo, useState } from 'react';
import { FileSignature, Plus, ShieldCheck, Send, XCircle, CheckCircle2, Link2, AlertTriangle } from 'lucide-react';
import type { Account, CostCenter, Currency, Customer, PaymentVoucher, ReceiptVoucher, Vendor } from '../../types/erp';
import type { ContractClassification, ContractPartyType, ERPContract } from '../../types/contracts';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { amendContract, approveContract, cancelContract, contractMetrics, linkContractVoucher, recordContractReview, rejectContract, submitContract } from '../../utils/contractLifecycle';
import PageHeader from '../ui/PageHeader';
import ModalShell from '../ui/ModalShell';
import AttachmentPicker from '../ui/AttachmentPicker';
import { useToast } from '../ui/Toast';

interface Props {
  contracts: ERPContract[];
  customers: Customer[];
  vendors: Vendor[];
  accounts: Account[];
  costCenters: CostCenter[];
  currencies: Currency[];
  paymentVouchers: PaymentVoucher[];
  receiptVouchers: ReceiptVoucher[];
  currentUserName: string;
  onChange: (contracts: ERPContract[], audit: string) => void;
}

const statusLabel: Record<ERPContract['status'], string> = { CREATED: 'جديد', UNDER_REVIEW: 'قيد المراجعة', APPROVED: 'معتمد', REJECTED: 'مرفوض', CANCELLED: 'ملغي', COMPLETED: 'مكتمل' };
const classLabel: Record<ContractClassification, string> = { CONSTRUCTION: 'مقاولات', SERVICES: 'خدمات', PROCUREMENT: 'توريد', LEASE: 'إيجار', OTHER: 'أخرى' };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ContractsView({ contracts, customers, vendors, accounts, costCenters, currencies, paymentVouchers, receiptVouchers, currentUserName, onChange }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(contracts[0]?.id || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [partyType, setPartyType] = useState<ContractPartyType>('VENDOR');
  const [partyId, setPartyId] = useState('');
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState<ContractClassification>('PROCUREMENT');
  const [value, setValue] = useState(0);
  const [currency, setCurrency] = useState(currencies.find(item => item.isBase)?.code || 'YER');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [taxRate, setTaxRate] = useState(0);
  const [retentionRate, setRetentionRate] = useState(0);
  const [costCenterId, setCostCenterId] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [controlAccountId, setControlAccountId] = useState('');
  const [guaranteeReference, setGuaranteeReference] = useState('');
  const [guaranteeExpiry, setGuaranteeExpiry] = useState('');
  const [attachments, setAttachments] = useState<SupportingDocument[]>([]);
  const [linkAmounts, setLinkAmounts] = useState<Record<string, number>>({});
  const [linkVoucherIds, setLinkVoucherIds] = useState<Record<string, string>>({});

  const selected = contracts.find(item => item.id === selectedId) || null;
  const parties = partyType === 'CUSTOMER' ? customers.map(item => ({ id: item.id, name: item.nameAr })) : vendors.map(item => ({ id: item.id, name: item.nameAr }));
  const metrics = useMemo(() => contractMetrics(contracts), [contracts]);
  const persist = (contract: ERPContract, message: string) => { onChange(contracts.map(item => item.id === contract.id ? contract : item), message); toast('success', message); };
  const apply = (result: ReturnType<typeof submitContract>, success: string) => result.ok ? persist(result.contract, success) : toast('error', result.errors.join(' | '));

  const create = (event: React.FormEvent) => {
    event.preventDefault();
    const party = parties.find(item => item.id === partyId);
    if (!party || !number.trim() || !title.trim() || !(value > 0) || startDate > endDate) { toast('error', 'أكمل رقم العقد والطرف والقيمة والفترة بصورة صحيحة.'); return; }
    if (contracts.some(item => item.contractNumber.trim().toLowerCase() === number.trim().toLowerCase())) { toast('error', 'رقم العقد مستخدم مسبقًا.'); return; }
    const stamp = Date.now();
    const contract: ERPContract = {
      id: `contract-${stamp}`, contractNumber: number.trim(), title: title.trim(), partyType, partyId, partyName: party.name, classification, status: 'CREATED', currency, exchangeRate: 1,
      totalValue: value, startDate, endDate, costCenterId: costCenterId || undefined, projectCode: projectCode || undefined, controlAccountId: controlAccountId || undefined,
      paymentTerms: 'حسب الاستحقاقات', retentionRate: retentionRate / 100, taxRate: taxRate / 100, guaranteeReference: guaranteeReference || undefined, guaranteeExpiry: guaranteeExpiry || undefined,
      milestones: [{ id: `milestone-${stamp}`, title: 'الاستحقاق الرئيسي', dueDate, amount: value, taxRate: taxRate / 100, retentionRate: retentionRate / 100 }], obligations: [], attachments,
      actions: [{ id: `ca-${stamp}`, action: 'CREATE', actor: currentUserName, at: new Date().toISOString(), note: 'إنشاء العقد' }], amendments: [], createdBy: currentUserName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    onChange([contract, ...contracts], `إنشاء العقد ${contract.contractNumber}`); setSelectedId(contract.id); setCreateOpen(false); setAttachments([]); toast('success', 'تم إنشاء العقد.');
  };

  const review = () => { if (!selected) return; const note = window.prompt('ملاحظة المراجعة:') || ''; apply(recordContractReview(selected, currentUserName, note), `تمت مراجعة العقد ${selected.contractNumber}`); };
  const reject = () => { if (!selected) return; const reason = window.prompt('سبب الرفض:') || ''; apply(rejectContract(selected, currentUserName, reason), `رُفض العقد ${selected.contractNumber}`); };
  const amend = () => { if (!selected) return; const reason = window.prompt('سبب التعديل:') || ''; const newValue = Number(window.prompt('القيمة الجديدة:', String(selected.totalValue))); apply(amendContract(selected, currentUserName, reason, newValue), `إضافة تعديل للعقد ${selected.contractNumber}`); };
  const cancel = () => { if (!selected) return; const reason = window.prompt('سبب الإلغاء:') || ''; apply(cancelContract(selected, currentUserName, reason), `إلغاء العقد ${selected.contractNumber}`); };

  const postedVouchers = selected?.partyType === 'VENDOR'
    ? paymentVouchers.filter(item => item.status === 'POSTED').map(item => ({ id: item.id, number: item.voucherNumber, amount: item.totalAmount, type: 'PAYMENT' as const }))
    : receiptVouchers.filter(item => item.status === 'POSTED').map(item => ({ id: item.id, number: item.receiptNumber, amount: item.totalAmount, type: 'RECEIPT' as const }));

  const linkVoucher = (obligationId: string) => {
    if (!selected) return;
    const voucher = postedVouchers.find(item => item.id === linkVoucherIds[obligationId]);
    if (!voucher) { toast('error', 'اختر سندًا مرحلًا.'); return; }
    const amount = Number(linkAmounts[obligationId] || voucher.amount);
    apply(linkContractVoucher(selected, obligationId, { voucherType: voucher.type, voucherId: voucher.id, voucherNumber: voucher.number, amount, linkedBy: currentUserName }), `ربط ${voucher.number} بالعقد ${selected.contractNumber}`);
  };

  return <div className="space-y-6 animate-fade-in text-right">
    <PageHeader icon={<FileSignature className="w-6 h-6" />} title="العقود والالتزامات" subtitle="دورة العقد من الإنشاء والمراجعة والاعتماد حتى الاستحقاق والسداد" actions={<button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 font-bold"><Plus className="w-4 h-4" />عقد جديد</button>} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
      ['الالتزامات المعتمدة', metrics.approvedCommitments], ['الرصيد القائم', metrics.outstanding], ['المتأخر', metrics.overdue], ['استحقاقات قادمة', metrics.upcoming]
    ].map(([label, amount]) => <div key={label as string} className="glass-card rounded-2xl p-4 border border-slate-700/50"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-xl font-black text-white">{typeof amount === 'number' ? fmt(amount) : amount}</div></div>)}</div>
    <div className="grid lg:grid-cols-[360px_1fr] gap-5">
      <section className="glass-card rounded-2xl border border-slate-700/50 overflow-hidden"><div className="p-4 border-b border-slate-800 font-bold text-white">سجل العقود</div>{contracts.length ? contracts.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full text-right p-4 border-b border-slate-800/70 ${selectedId === item.id ? 'bg-sky-500/15' : 'hover:bg-slate-800/40'}`}><div className="flex justify-between gap-2"><span className="font-bold text-white">{item.contractNumber}</span><span className="text-xs text-sky-300">{statusLabel[item.status]}</span></div><div className="text-sm text-slate-300 mt-1">{item.title}</div><div className="text-xs text-slate-500 mt-1">{item.partyName} — {fmt(item.totalValue)} {item.currency}</div></button>) : <div className="p-8 text-center text-slate-500">لا توجد عقود بعد.</div>}</section>
      <section className="glass-card rounded-2xl border border-slate-700/50 p-5">{selected ? <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-white">{selected.contractNumber} — {selected.title}</h2><p className="text-sm text-slate-400 mt-1">{selected.partyName} · {classLabel[selected.classification]} · {selected.startDate} — {selected.endDate}</p></div><span className="rounded-full bg-sky-500/15 text-sky-300 px-3 py-1 text-sm font-bold">{statusLabel[selected.status]}</span></div>
        <div className="flex flex-wrap gap-2">
          {(selected.status === 'CREATED' || selected.status === 'REJECTED') && <button onClick={() => apply(submitContract(selected, currentUserName), `إرسال العقد ${selected.contractNumber} للمراجعة`)} className="btn-primary inline-flex gap-1 items-center"><Send className="w-4 h-4" />إرسال للمراجعة</button>}
          {selected.status === 'UNDER_REVIEW' && <><button onClick={review} className="btn-primary inline-flex gap-1 items-center"><ShieldCheck className="w-4 h-4" />تسجيل مراجعة</button><button onClick={() => apply(approveContract(selected, currentUserName), `اعتماد العقد ${selected.contractNumber}`)} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold inline-flex gap-1 items-center"><CheckCircle2 className="w-4 h-4" />اعتماد</button><button onClick={reject} className="px-3 py-2 rounded-lg bg-red-500/15 text-red-300 font-bold">رفض</button></>}
          {selected.status === 'APPROVED' && <button onClick={amend} className="px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 font-bold">تعديل معتمد</button>}
          {!['COMPLETED','CANCELLED'].includes(selected.status) && <button onClick={cancel} className="px-3 py-2 rounded-lg border border-red-500/30 text-red-300 font-bold inline-flex gap-1 items-center"><XCircle className="w-4 h-4" />إلغاء</button>}
        </div>
        <div className="grid sm:grid-cols-3 gap-3"><div className="rounded-xl bg-slate-900/60 p-3"><div className="text-xs text-slate-500">قيمة العقد</div><div className="font-mono font-bold text-white mt-1">{fmt(selected.totalValue)} {selected.currency}</div></div><div className="rounded-xl bg-slate-900/60 p-3"><div className="text-xs text-slate-500">المشروع / مركز التكلفة</div><div className="font-bold text-white mt-1">{selected.projectCode || '—'} / {costCenters.find(item => item.id === selected.costCenterId)?.nameAr || '—'}</div></div><div className="rounded-xl bg-slate-900/60 p-3"><div className="text-xs text-slate-500">الضريبة / الاحتجاز</div><div className="font-bold text-white mt-1">{selected.taxRate * 100}% / {selected.retentionRate * 100}%</div></div></div>
        <div><h3 className="font-bold text-white mb-3">الاستحقاقات والسداد</h3><div className="space-y-3">{selected.obligations.length ? selected.obligations.map(obligation => { const remaining = obligation.netAmount - obligation.settledAmount; return <div key={obligation.id} className="rounded-xl border border-slate-700 p-3"><div className="flex justify-between"><div><span className="font-bold text-white">{obligation.title}</span><span className="text-xs text-slate-500 mr-2">استحقاق {obligation.dueDate}</span></div><span className={`text-xs font-bold ${obligation.dueDate < today() && obligation.status !== 'PAID' ? 'text-red-300' : 'text-emerald-300'}`}>{obligation.status}</span></div><div className="mt-2 text-sm text-slate-300">صافي {fmt(obligation.netAmount)} · مسدد {fmt(obligation.settledAmount)} · متبقي {fmt(remaining)}</div>{remaining > 0 && <div className="grid md:grid-cols-[1fr_140px_auto] gap-2 mt-3"><select aria-label="السند المرحل" value={linkVoucherIds[obligation.id] || ''} onChange={e => setLinkVoucherIds(prev => ({ ...prev, [obligation.id]: e.target.value }))} className="input"><option value="">اختر سندًا مرحلًا</option>{postedVouchers.map(voucher => <option key={voucher.id} value={voucher.id}>{voucher.number} — {fmt(voucher.amount)}</option>)}</select><input aria-label="قيمة الربط" type="number" min="0" value={linkAmounts[obligation.id] || ''} onChange={e => setLinkAmounts(prev => ({ ...prev, [obligation.id]: Number(e.target.value) }))} className="input" /><button onClick={() => linkVoucher(obligation.id)} className="px-3 py-2 rounded-lg bg-sky-600 text-white font-bold inline-flex gap-1 items-center"><Link2 className="w-4 h-4" />ربط</button></div>}</div> }) : <div className="rounded-xl bg-amber-500/10 text-amber-300 p-4 flex gap-2"><AlertTriangle className="w-5 h-5" />تُولد الاستحقاقات مرة واحدة بعد المراجعة والاعتماد.</div>}</div></div>
        <div><h3 className="font-bold text-white mb-2">الأثر الرقابي</h3><div className="max-h-44 overflow-auto space-y-2">{[...selected.actions].reverse().map(item => <div key={item.id} className="rounded-lg bg-slate-900/50 p-2 text-xs"><span className="font-bold text-sky-300">{item.action}</span><span className="text-slate-300"> — {item.actor}: {item.note}</span><span className="text-slate-600 mr-2">{item.at}</span></div>)}</div></div>
      </div> : <div className="p-12 text-center text-slate-500">اختر عقدًا لعرض تفاصيله.</div>}</section>
    </div>
    <ModalShell id="contract-create" open={createOpen} onClose={() => setCreateOpen(false)} title="عقد جديد" icon={FileSignature} size="xl" footer={null}><form onSubmit={create} className="space-y-4"><div className="grid md:grid-cols-2 gap-3"><input required aria-label="رقم العقد" value={number} onChange={e => setNumber(e.target.value)} className="input" /><input required aria-label="اسم العقد" value={title} onChange={e => setTitle(e.target.value)} className="input" /><select value={partyType} onChange={e => { setPartyType(e.target.value as ContractPartyType); setPartyId(''); }} className="input"><option value="VENDOR">عقد مورد / التزام</option><option value="CUSTOMER">عقد عميل / مستحق</option></select><select required value={partyId} onChange={e => setPartyId(e.target.value)} className="input"><option value="">اختر طرف العقد</option>{parties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={classification} onChange={e => setClassification(e.target.value as ContractClassification)} className="input">{Object.entries(classLabel).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select><input required type="number" min="0.01" step="0.01" value={value || ''} onChange={e => setValue(Number(e.target.value))} className="input" /><select value={currency} onChange={e => setCurrency(e.target.value)} className="input">{currencies.filter(item => item.isActive).map(item => <option key={item.code}>{item.code}</option>)}</select><DateField  value={startDate} onChange={e => setStartDate(e.target.value)} className="input" /><DateField  value={endDate} onChange={e => setEndDate(e.target.value)} className="input" /><DateField  value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" /><input type="number" min="0" max="100" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="input" /><input type="number" min="0" max="100" value={retentionRate} onChange={e => setRetentionRate(Number(e.target.value))} className="input" /><select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} className="input"><option value="">مركز تكلفة اختياري</option>{costCenters.map(item => <option key={item.id} value={item.id}>{item.nameAr}</option>)}</select><input value={projectCode} onChange={e => setProjectCode(e.target.value)} className="input" /><select value={controlAccountId} onChange={e => setControlAccountId(e.target.value)} className="input"><option value="">حساب الربط اختياري</option>{accounts.filter(item => item.level === 5 && item.isActive).map(item => <option key={item.id} value={item.id}>{item.code} — {item.nameAr}</option>)}</select><input value={guaranteeReference} onChange={e => setGuaranteeReference(e.target.value)} className="input" /><DateField  value={guaranteeExpiry} onChange={e => setGuaranteeExpiry(e.target.value)} className="input" /></div><AttachmentPicker documents={attachments} onChange={setAttachments} uploadedBy={currentUserName} documentType="CONTRACT_SUPPORT" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">إلغاء</button><button type="submit" className="px-4 py-2 rounded-lg bg-sky-600 text-white font-bold">حفظ العقد</button></div></form></ModalShell>
  </div>;
}
