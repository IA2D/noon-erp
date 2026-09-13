import type {
  Account, BankAccount, CashBox, CostCenter, Currency, Custody, Customer,
  Employee, JournalEntry, PaymentVoucher, ReceiptVoucher, Trust, Vendor,
} from '../types/erp';

/** Read-only snapshot used by reports and financial indicators without changing the operational year. */
export interface FiscalYearReportDataset {
  fiscalYear: string;
  accounts: Account[];
  journals: JournalEntry[];
  costCenters: CostCenter[];
  currencies: Currency[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  trusts: Trust[];
  custodies: Custody[];
  vouchers: PaymentVoucher[];
  receiptVouchers: ReceiptVoucher[];
}

export type FiscalYearDatasetLoader = (fiscalYear: string) => FiscalYearReportDataset;
