export type SupportingDocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export interface SupportingDocument {
  id: string; documentType: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string; uploadedBy: string; uploadedAt: string; status: SupportingDocumentStatus; verifiedBy?: string; verifiedAt?: string; notes?: string;
  /** Original file retained locally so an attached document can be reopened. */
  dataUrl?: string;
}
