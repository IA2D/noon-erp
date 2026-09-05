import type { JournalEntry } from '../types/erp';
import type { SupportingDocument } from '../types/supportingDocuments';
export type { SupportingDocument } from '../types/supportingDocuments';
export interface AttachmentRequirement { documentType: string; label: string; required: boolean; }
export function validateSupportingDocuments(documents: SupportingDocument[] = [], requirements: AttachmentRequirement[] = [], finalPosting = true): string[] {
  if (!finalPosting) return [];
  const errors: string[] = [];
  for (const requirement of requirements.filter(item => item.required)) {
    const matches = documents.filter(document => document.documentType === requirement.documentType);
    if (!matches.length) errors.push(`المرفق المطلوب غير موجود: ${requirement.label}.`);
    else if (!matches.some(document => document.status === 'VERIFIED')) errors.push(`المرفق المطلوب لم يتم التحقق منه: ${requirement.label}.`);
  }
  return errors;
}
export async function attachmentFromFile(file: File, documentType: string, uploadedBy: string): Promise<SupportingDocument> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const sha256 = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الملف المرفق.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  return { id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, documentType, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, sha256, uploadedBy, uploadedAt: new Date().toISOString(), status: 'VERIFIED', dataUrl };
}
export function verifiedDocumentsFor(record: { attachments?: SupportingDocument[] }): SupportingDocument[] { return (record.attachments || []).filter(document => document.status === 'VERIFIED'); }
export function replacementJournal(original: JournalEntry, replacement: JournalEntry, actor: string, reason: string): JournalEntry {
  if (original.status !== 'POSTED') throw new Error('Only a posted journal can receive a replacement document.');
  if (replacement.status !== 'PENDING_POSTING') throw new Error('Replacement must start as pending posting.');
  if (!reason.trim()) throw new Error('Replacement reason is required.');
  return { ...replacement, replacementOfEntryId: original.id, replacementReason: reason.trim(), createdBy: actor };
}
