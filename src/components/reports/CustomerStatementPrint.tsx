import BaseReportTemplate from '../ui/BaseReportTemplate';
import type { CompanyBranch } from '../../types/erp';
import { dateToDisplay } from '../../utils/dateInput';
﻿import React from 'react';

export interface StatementItem {
  subLedgerCode: string;
  subLedgerName: string;
  accountNo: string;
  currency: string;
  openingDebit: number;
  openingCredit: number;
  transactions: Array<{
    id?: string;
    date: string;
    docType: string;
    docNo: string;
    narration?: string;
    description?: string;
    refNo: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  closingDebit: number;
  closingCredit: number;
  netBalance: number;
  balanceType: string;
  tafqeetText: string;
  count: number;
}

export interface CustomerStatementPrintProps {
  company?: {
    nameAr: string;
    branchAr: string;
    addressAr: string;
    nameEn: string;
    branchEn: string;
    phone: string;
    logoUrl?: string;
  };
  filter?: { fromDate: string; toDate: string };
  statements: StatementItem[];
  printMetadata?: { printedBy: string; printDateTime: string };
}

export const CustomerStatementPrint: React.FC<CustomerStatementPrintProps> = ({company, filter, statements = [], printMetadata}) => {
  const co = company ? {companyNameAr:company.nameAr,companyNameEn:company.nameEn,branchNameAr:company.branchAr,branchNameEn:company.branchEn,addressAr:company.addressAr,phone:company.phone,logoUrl:company.logoUrl} as CompanyBranch : undefined;
  const items = statements.length ? statements : [{subLedgerCode:'—',subLedgerName:'—',accountNo:'—',currency:'',openingDebit:0,openingCredit:0,totalDebit:0,totalCredit:0,closingDebit:0,closingCredit:0,netBalance:0,balanceType:'',tafqeetText:'',count:0,transactions:[]}];
  return <div id="erp-statement-print-zone">{items.map((stmt, index) => <div key={`${stmt.subLedgerCode}-${index}`} className="statement-page-item">
    <BaseReportTemplate reportTitleAr="كشف حساب حسب العميل تحليلي" fromDate={filter?.fromDate} toDate={filter?.toDate} company={co} currentUserName={printMetadata?.printedBy}
      entityInfo={[{label:'الحساب المساعد',value:stmt.subLedgerCode+' — '+stmt.subLedgerName},{label:'الحساب',value:stmt.accountNo},{label:'العملة',value:stmt.currency}]}
      totalDebit={stmt.totalDebit} totalCredit={stmt.totalCredit} openingBalance={stmt.openingDebit-stmt.openingCredit} closingBalance={stmt.netBalance} docCount={stmt.count} tafqeetText={stmt.tafqeetText} balanceTag={stmt.balanceType}>
      <table><thead><tr><th>التاريخ</th><th>نوع المستند</th><th>رقم المستند</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead><tbody>
        <tr><td colSpan={4}>الرصيد الافتتاحي</td><td>{stmt.openingDebit.toFixed(2)}</td><td>{stmt.openingCredit.toFixed(2)}</td></tr>
        {stmt.transactions.map((tx,i)=><tr key={tx.id||i}><td>{dateToDisplay(tx.date)||tx.date}</td><td>{tx.docType}</td><td>{tx.docNo}</td><td>{tx.narration||tx.description}</td><td>{tx.debit.toFixed(2)}</td><td>{tx.credit.toFixed(2)}</td></tr>)}
        {!stmt.transactions.length&&<tr><td colSpan={6}>لا توجد حركات مالية</td></tr>}
      </tbody></table>
    </BaseReportTemplate>
  </div>)}</div>;
};
export default CustomerStatementPrint;
