import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { attachmentFromFile } from '../../utils/supportingDocuments';

export default function AttachmentPicker({ documents, onChange, uploadedBy, documentType = 'SUPPORTING_DOCUMENT' }: { documents: SupportingDocument[]; onChange: (documents: SupportingDocument[]) => void; uploadedBy: string; documentType?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const add = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const added = await Promise.all(files.map(file => attachmentFromFile(file, documentType, uploadedBy)));
    onChange([...documents, ...added]);
    event.target.value = '';
  };
  return <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-300">المستندات المؤيدة</span><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-300"><Paperclip className="w-3.5 h-3.5" />إرفاق ملف</button><input ref={inputRef} type="file" multiple className="hidden" onChange={add} /></div>{documents.length ? <div className="space-y-1">{documents.map(doc => <div key={doc.id} className="flex items-center gap-2 text-xs text-slate-300"><span className="truncate flex-1">{doc.fileName}</span><span className="text-amber-300">بانتظار التحقق</span><button type="button" onClick={() => onChange(documents.filter(item => item.id !== doc.id))} className="text-slate-500 hover:text-red-300" title="حذف المرفق"><X className="w-3.5 h-3.5" /></button></div>)}</div> : <p className="text-[11px] text-slate-500">لا توجد مرفقات. يمكن للمدقق اعتمادها من سجل المستندات.</p>}</div>;
}
