import React, { useRef } from 'react';
import { Eye, Paperclip, X } from 'lucide-react';
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
  const preview = async (doc: SupportingDocument) => {
    if (!doc.dataUrl) return;
    if (window.desktopFiles) {
      const result = await window.desktopFiles.openAttachment({ dataUrl: doc.dataUrl, fileName: doc.fileName, mimeType: doc.mimeType });
      if (!result.ok) window.alert(`تعذر فتح المستند بواسطة النظام التشغيلي: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    window.open(doc.dataUrl, '_blank', 'noopener,noreferrer');
  };
  return <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-300">المستندات المؤيدة</span><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-300"><Paperclip className="w-3.5 h-3.5" />إرفاق ملف</button><input ref={inputRef} type="file" multiple className="hidden" onChange={add} /></div>{documents.length ? <div className="space-y-2">{documents.map(doc => <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 px-2.5 py-2 text-xs text-slate-300"><span className="truncate flex-1 font-medium">{doc.fileName}</span><span className={doc.status === 'VERIFIED' ? 'text-emerald-300' : doc.status === 'REJECTED' ? 'text-rose-300' : 'text-amber-300'}>{doc.status === 'VERIFIED' ? 'مُرفق ومعتمد' : doc.status === 'REJECTED' ? 'مرفوض' : 'بانتظار التحقق'}</span><button type="button" onClick={() => void preview(doc)} disabled={!doc.dataUrl} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sky-400/50 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-600" title={doc.dataUrl ? 'فتح المستند بالتطبيق الافتراضي للنظام' : 'هذا المرفق القديم لا يحتوي نسخة قابلة للعرض'}><Eye className="h-4 w-4" />عرض المستند</button><button type="button" onClick={() => onChange(documents.filter(item => item.id !== doc.id))} className="shrink-0 rounded-md p-1 text-slate-500 hover:text-red-300" title="حذف المرفق"><X className="w-4 h-4" /></button></div>)}</div> : <p className="text-[11px] text-slate-500">لا توجد مرفقات. تُعتمد المرفقات مباشرةً عند الإرفاق.</p>}</div>;
}
