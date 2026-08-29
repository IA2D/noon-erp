import React from 'react';

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

export const CustomerStatementPrint: React.FC<CustomerStatementPrintProps> = ({
  company = {
    nameAr: '\u0634\u0631\u0643\u0629 \u0627\u0644\u0646\u062e\u0628\u0629',
    branchAr: '\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064a\u0633\u064a',
    addressAr: '\u0635\u0639\u064b\u0627\u0621\u060c \u0634\u0627\u0631\u0639 \u062d\u062f\u0647',
    nameEn: 'Saba Contracting Company',
    branchEn: 'Main Branch',
    phone: '771272134-7712212345',
  },
  filter = { fromDate: '01/01/2025', toDate: '31/12/2026' },
  statements = [],
  printMetadata = { printedBy: '\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0627\u0644\u064a', printDateTime: '20/08/2026 15:49:26' },
}) => {
  if (!statements || statements.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Tahoma' }}>{'\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0644\u0639\u0631\u0636\u0647\u0627'}</div>;
  }

  const totalPages = statements.length;

  return (
    <div id="erp-statement-print-zone" style={{ width: '100%', direction: 'rtl', fontFamily: 'Tahoma, Arial, sans-serif', color: '#000' }}>
      {statements.map((stmt, idx) => {
        const currentPage = idx + 1;

        return (
          <div key={`${stmt.subLedgerCode}_${stmt.currency}_${idx}`} className="statement-page-item" style={{ width: '100%' }}>

            {/* 1. Company Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
              <div style={{ width: '30%', textAlign: 'right', fontSize: '11px', lineHeight: '1.3' }}>
                <strong style={{ fontSize: '12px' }}>{company.nameAr}</strong><br />
                <span>{company.branchAr}</span><br />
                <span>{company.addressAr}</span>
              </div>
              <div style={{ width: '40%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', marginBottom: '2px' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', margin: '0 auto 2px', border: '1.5px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>
                    LOGO
                  </div>
                )}
                <h2 style={{ margin: '0', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {'\u0643\u0634\u0641 \u062d\u0633\u0627\u0628 \u062d\u0633\u0628 \u0627\u0644\u0639\u0645\u064a\u0644 \u062a\u062d\u0644\u064a\u0644\u064a'}
                </h2>
                <div style={{ fontSize: '10.5px', marginTop: '2px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                  {'\u0645\u0646 \u062a\u0627\u0631\u064a\u062e'} : {filter.fromDate} &nbsp;&nbsp;&nbsp; {'\u0625\u0644\u0649 \u062a\u0627\u0631\u064a\u062e'} : {filter.toDate}
                </div>
              </div>
              <div style={{ width: '30%', textAlign: 'left', fontSize: '11px', lineHeight: '1.3', direction: 'ltr' }}>
                <strong style={{ fontSize: '12px' }}>{company.nameEn}</strong><br />
                <span>{company.branchEn}</span><br />
                <span>Tel No : {company.phone}</span>
              </div>
            </div>

            {/* 2. Sub-Ledger + Currency Info Bar */}
            <div style={{ border: '1px solid #000', padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>
              <div>{'\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0627\u0639\u062f'} : <span style={{ fontWeight: 'normal' }}>{stmt.subLedgerCode}</span></div>
              <div style={{ fontSize: '12px' }}>{stmt.subLedgerName}</div>
              <div>{'\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628'} : <span style={{ fontWeight: 'normal' }}>{stmt.accountNo}</span></div>
              <div>{'\u0627\u0644\u0639\u0645\u0644\u0629'} : <span style={{ fontWeight: 'bold' }}>{stmt.currency}</span></div>
            </div>

            {/* 3. Transactions Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#DDE2FB', borderBottom: '1px solid #000', height: '24px' }}>
                  <th style={{ border: '1px solid #000', padding: '3px', width: '70px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u0627\u0644\u062a\u0627\u0631\u064a\u062e'}</th>
                  <th style={{ border: '1px solid #000', padding: '3px', width: '85px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u062a\u0646\u062f'}</th>
                  <th style={{ border: '1px solid #000', padding: '3px', width: '70px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062a\u0646\u062f'}</th>
                  <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u0627\u0644\u0628\u064a\u0627\u0646'}</th>
                  <th style={{ border: '1px solid #000', padding: '3px', width: '65px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062c\u0639'}</th>
                  <th style={{ border: '1px solid #000', padding: '3px', width: '80px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u0645\u062f\u064a\u0646'}</th>
                  <th style={{ border: '1px solid #000', padding: '3px', width: '80px', textAlign: 'center', verticalAlign: 'middle' }}>{'\u062f\u0627\u0626\u0646'}</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance */}
                <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #000', height: '20px' }}>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{'\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0625\u0641\u062a\u062a\u0627\u062d\u064a'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{stmt.openingDebit > 0 ? stmt.openingDebit.toFixed(2) : ''}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{stmt.openingCredit > 0 ? stmt.openingCredit.toFixed(2) : ''}</td>
                </tr>

                {/* Transactions */}
                {stmt.transactions.length > 0 ? (
                  stmt.transactions.map((tx: any, tIdx: number) => (
                    <tr key={tx.id || tIdx} style={{ borderBottom: '1px solid #000', height: '20px' }}>
                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{tx.date}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{tx.docType}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{tx.docNo}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{tx.narration || tx.description}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{tx.refNo}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{tx.debit > 0 ? Number(tx.debit).toFixed(2) : ''}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{tx.credit > 0 ? Number(tx.credit).toFixed(2) : ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: '1px solid #000', height: '24px' }}>
                    <td colSpan={7} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', color: '#4b5563' }}>
                      {'\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u0631\u0643\u0627\u062a \u0645\u0627\u0644\u064a\u0629'}
                    </td>
                  </tr>
                )}

                {/* Totals */}
                <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #000', height: '20px' }}>
                  <td colSpan={3} style={{ border: '1px solid #000', padding: '2px' }}></td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{stmt.currency} {'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{'\u0627\u0644\u0639\u062f\u062f'} : {stmt.count}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{stmt.totalDebit.toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{stmt.totalCredit.toFixed(2)}</td>
                </tr>

                {/* Closing Balance */}
                <tr style={{ fontWeight: 'bold', color: '#b91c1c', borderBottom: '1px solid #000', height: '20px' }}>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{'\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0625\u0641\u062a\u062a\u0627\u062d\u064a \u0645\u0639 \u0627\u0644\u062d\u0631\u0643\u0629'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{stmt.closingDebit.toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>{stmt.closingCredit.toFixed(2)}</td>
                </tr>

                {/* Final Balance & Tafqeet */}
                <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #000', height: '22px' }}>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right' }}>
                    {'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0631\u0635\u064a\u062f'} {stmt.balanceType} : &nbsp;
                    <span style={{ fontWeight: 'bold' }}>{stmt.tafqeetText}</span>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center', fontSize: '11px' }}>
                    {stmt.netBalance.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4. Footer */}
            <div style={{ borderTop: '1px solid #000', marginTop: '12px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', fontWeight: 'bold' }}>
              <div style={{ width: '33%', textAlign: 'right' }}>
                {'\u0637\u0628\u0639 \u0628\u0648\u0627\u0635\u0637\u0629'} : {printMetadata.printedBy}
              </div>
              <div style={{ width: '33%', textAlign: 'center', letterSpacing: '1px' }}>
                {currentPage} / {totalPages}
              </div>
              <div style={{ width: '33%', textAlign: 'left', direction: 'ltr' }}>
                {'\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0642\u0631\u064a\u0631'} : {printMetadata.printDateTime}
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default CustomerStatementPrint;
