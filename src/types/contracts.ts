import type { SupportingDocument } from './supportingDocuments';

export type ContractPartyType = 'CUSTOMER' | 'VENDOR';
export type ContractStatus = 'CREATED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
export type ContractClassification = 'CONSTRUCTION' | 'SERVICES' | 'PROCUREMENT' | 'LEASE' | 'OTHER';
export type ContractObligationStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export interface ContractMilestone {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  taxRate: number;
  retentionRate: number;
}

export interface ContractVoucherLink {
  id: string;
  voucherType: 'PAYMENT' | 'RECEIPT';
  voucherId: string;
  voucherNumber: string;
  amount: number;
  linkedAt: string;
  linkedBy: string;
}

export interface ContractObligation {
  id: string;
  milestoneId: string;
  title: string;
  dueDate: string;
  grossAmount: number;
  taxAmount: number;
  retentionAmount: number;
  netAmount: number;
  settledAmount: number;
  status: ContractObligationStatus;
  voucherLinks: ContractVoucherLink[];
}

export interface ContractAction {
  id: string;
  action: 'CREATE' | 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'AMEND' | 'CANCEL' | 'LINK_VOUCHER' | 'COMPLETE';
  actor: string;
  at: string;
  note: string;
}

export interface ContractAmendment {
  id: string;
  revision: number;
  reason: string;
  previousValue: number;
  newValue: number;
  createdBy: string;
  createdAt: string;
}

export interface ERPContract {
  id: string;
  contractNumber: string;
  title: string;
  partyType: ContractPartyType;
  partyId: string;
  partyName: string;
  classification: ContractClassification;
  status: ContractStatus;
  currency: string;
  exchangeRate: number;
  totalValue: number;
  startDate: string;
  endDate: string;
  costCenterId?: string;
  projectCode?: string;
  controlAccountId?: string;
  paymentTerms: string;
  retentionRate: number;
  taxRate: number;
  guaranteeReference?: string;
  guaranteeExpiry?: string;
  milestones: ContractMilestone[];
  obligations: ContractObligation[];
  attachments: SupportingDocument[];
  actions: ContractAction[];
  amendments: ContractAmendment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
