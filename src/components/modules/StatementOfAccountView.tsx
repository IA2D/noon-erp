import DateField from '../ui/DateField';
import React, { useMemo, useState, useEffect } from 'react';
import { FileText, Printer, Search } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import { useToast } from '../ui/Toast';
import StatementOfAccountReport from './reports/StatementOfAccountReport';
import {
  queryStatement,
  STATEMENT_KIND_META,
  type StatementEntityKind,
  type StatementResult
} from '../../services/statementOfAccountService';
import { isPostingAccount } from '../../utils/accountingEngine';
import { loadBranchesLocal } from '../../utils/companyStore';
import type {
  Account,
  BankAccount,
  CashBox,
  Currency,
  Customer,
  Employee,
  JournalEntry,
  PaymentVoucher,
  ReceiptVoucher,
  Vendor
} from '../../types/erp';
import { openDesktopPrintPreview } from '../../utils/desktopPrintPreview';
import { defaultReportToDate } from '../../utils/dateDefaults';

interface Props {
  accounts: Account[];
  journals: JournalEntry[];
  vouchers: PaymentVoucher[];
  receiptVouchers: ReceiptVoucher[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  currencies: Currency[];
  currentUserName?: string;
  fiscalYear: string;
  initialKind?: string;
  initialId?: string;
  onParamsConsumed?: () => void;
}

interface EntityOption {
  id: string;
  code: string;
  name: string;
  extra: string;
}

const KIND_ORDER: StatementEntityKind[] = ['ACCOUNT', 'CUSTOMER', 'VENDOR', 'EMPLOYEE', 'CASH_BOX', 'BANK'];

const KIND_ICONS: Record<StatementEntityKind, string> = {
  ACCOUNT: 'حساب',
  CUSTOMER: 'عميل',
  VENDOR: 'مورد',
  EMPLOYEE: 'موظف',
  CASH_BOX: 'صندوق',
  BANK: 'بنك/صراف'
};

export default function StatementOfAccountView({
  accounts,
  journals,
  vouchers,
  receiptVouchers,
  employees,
  customers,
  vendors,
  cashBoxes,
  bankAccounts,
  currencies,
  currentUserName,
  fiscalYear,
  initialKind,
  initialId,
  onParamsConsumed
}: Props) {
  const toast = useToast();
  const [kind, setKind] = useState<StatementEntityKind>('ACCOUNT');
  const [selectedId, setSelectedId] = useState<string>('');
  const [displayValue, setDisplayValue] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(`${fiscalYear}-01-01`);
  const [toDate, setToDate] = useState<string>(defaultReportToDate);
  const [result, setResult] = useState<StatementResult | null>(null);

  useEffect(() => {
    setFromDate(`${fiscalYear}-01-01`);
    setToDate(defaultReportToDate());
    setResult(null);
  }, [fiscalYear]);

  // تعيين القيم الأولية من التنقل الداخلي (عند الإبحار من التقارير المالية)
  useEffect(() => {
    if (initialKind && initialId) {
      setKind(initialKind as StatementEntityKind);
      setSelectedId(initialId);
      onParamsConsumed?.();
    }
  }, []);

  const [company] = useState(() => {
    try {
      return loadBranchesLocal()[0] || null;
    } catch {
      return null;
    }
  });

  const { baseNameAr, baseSymbol } = useMemo(() => {
    const active = (currencies || []).filter(c => c.isActive);
    const base = active.find(c => c.isBase) || active[0];
    return {
      baseNameAr: base?.nameAr || 'ريال يمني',
      baseSymbol: base?.symbol || 'ر.ي'
    };
  }, [currencies]);

  const entityOptions = useMemo<EntityOption[]>(() => {
    switch (kind) {
      case 'ACCOUNT':
        return accounts
          .filter(a => isPostingAccount(a))
          .map(a => ({
            id: a.id,
            code: a.code,
            name: a.nameAr,
            extra: a.nature === 'DEBIT' ? 'مدين' : 'دائن'
          }));
      case 'EMPLOYEE':
        return employees.map(e => ({ id: e.id, code: e.code, name: e.nameAr, extra: e.department || '—' }));
      case 'CUSTOMER':
        return customers.map(c => ({ id: c.id, code: c.code, name: c.nameAr, extra: c.city || '—' }));
      case 'VENDOR':
        return vendors.map(v => ({ id: v.id, code: v.code, name: v.nameAr, extra: v.paymentTerms || '—' }));
      case 'CASH_BOX':
        return cashBoxes.map(b => ({ id: b.id, code: b.code, name: b.nameAr, extra: b.boxType || '—' }));
      case 'BANK':
        return bankAccounts.map(b => ({ id: b.id, code: b.code, name: b.bankNameAr, extra: b.entityType === 'EXCHANGE' ? 'صرافة' : 'بنك' }));
    }
  }, [kind, accounts, employees, customers, vendors, cashBoxes, bankAccounts]);

  const selectedOption = useMemo(
    () => entityOptions.find(o => o.id === selectedId) || null,
    [entityOptions, selectedId]
  );

  const docTypeByJournal = useMemo(() => {
    const map: Record<string, string> = {};
    vouchers.forEach(v => {
      if (v.journalEntryId) {
        map[v.journalEntryId] = v.status === 'VOIDED' ? 'سند صرف (ملغي)' : 'سند صرف نقدي';
      }
    });
    receiptVouchers.forEach(r => {
      if (r.journalEntryId) {
        map[r.journalEntryId] = r.status === 'VOIDED' ? 'سند قبض (ملغي)' : 'سند قبض نقدي';
      }
    });
    return map;
  }, [vouchers, receiptVouchers]);

  const generate = () => {
    if (!selectedId) {
      toast('error', 'يرجى اختيار الحساب أو الكيان المطلوب إصدار كشف الحساب له.');
      return;
    }
    if (!fromDate || !toDate) {
      toast('error', 'يرجى تحديد فترة الكشف (من / إلى).');
      return;
    }
    if (fromDate > toDate) {
      toast('error', 'تاريخ البداية لا يمكن أن يسبق تاريخ النهاية.');
      return;
    }
    const res = queryStatement({
      kind,
      id: selectedId,
      accounts,
      journals,
      employees,
      customers,
      vendors,
      cashBoxes,
      bankAccounts,
      currencies,
      fromDate,
      toDate,
      docTypeByJournal: id => docTypeByJournal[id] || 'قيد يومية'
    });
    if (!res) {
      toast('error', 'تعذر العثور على الكيان المحدد.');
      return;
    }
    setResult(res);
    toast('success', `تم إصدار كشف الحساب (${res.count} حركة) لـ: ${res.subject.name}`);
  };

  const handleSelect = (item: EntityOption) => {
    setSelectedId(item.id);
    setDisplayValue(`${item.code} — ${item.name}`);
  };

  const handleType = (v: string) => {
    setDisplayValue(v);
    if (v !== displayValueOf(selectedOption)) {
      setSelectedId('');
      setResult(null);
    }
  };

  const displayValueOf = (opt: EntityOption | null) =>
    opt ? `${opt.code} — ${opt.name}` : '';

  const reset = () => {
    setSelectedId('');
    setDisplayValue('');
    setResult(null);
    setKind('ACCOUNT');
    setFromDate(`${fiscalYear}-01-01`);
    setToDate(defaultReportToDate());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<FileText className="w-6 h-6 text-sky-400" />}
        title="كشف الحساب التحليلي"
        subtitle="Statement of Account — رصيد جاري مع الحركات والتفقيط والتوقيعات (A4)"
        actions={
          <button
            type="button"
            onClick={() => result && void openDesktopPrintPreview(document.querySelector('.soa-wrap .paper'), `كشف حساب ${result.subject.name}`, 'portrait')}
            disabled={!result}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 transition-all cursor-pointer hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            طباعة الكشف / PDF
          </button>
        }
      />

      <div className="glass rounded-2xl border border-slate-700/50 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white">تحديد الكشف</span>
          </div>
          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block" />
          <span className="text-sm text-slate-400">
            العملة: {baseNameAr} ({baseSymbol}) — تُقرأ من دليل العملات النشط
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-all cursor-pointer"
          >
            إعادة تعيين
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* نطاق الكشف */}
          <div className="md:col-span-3">
            <label className="block text-sm font-bold text-slate-400 mb-1.5">نطاق الكشف</label>
            <div className="grid grid-cols-3 gap-1.5">
              {KIND_ORDER.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setSelectedId('');
                    setDisplayValue('');
                    setResult(null);
                  }}
                  className={`rounded-xl border px-2 py-2 text-sm font-bold transition-all cursor-pointer ${kind === k
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-lg shadow-sky-500/10'
                    : 'border-slate-700/50 text-slate-400 hover:border-slate-600 hover:bg-white/5'
                    }`}
                >
                  {KIND_ICONS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* الكيان */}
          <div className="md:col-span-5">
            <label className="block text-sm font-bold text-slate-400 mb-1.5">
              {STATEMENT_KIND_META[kind].labelAr} — {STATEMENT_KIND_META[kind].labelEn} (F9 للاستعراض)
            </label>
            <F9SearchInput<EntityOption>
              value={displayValue}
              onChange={handleType}
              onSelect={handleSelect}

              items={entityOptions}
              columns={[
                { label: 'الكود', render: o => <span className="font-mono font-bold text-sky-300">{o.code}</span>, className: 'w-24' },
                { label: 'الاسم', render: o => o.name },
                { label: 'تفاصيل', render: o => <span className="text-slate-400 text-xs">{o.extra}</span> }
              ]}
              searchText={o => `${o.code} ${o.name} ${o.extra}`}
              browseTitle={`اختيار ${STATEMENT_KIND_META[kind].labelAr}`}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {selectedOption && (
              <div className="mt-1.5 flex items-center gap-2 text-sm text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                تم اختيار: {selectedOption.code} — {selectedOption.name}
              </div>
            )}
          </div>

          {/* الفترة */}
          <div className="md:col-span-4">
            <label className="block text-sm font-bold text-slate-400 mb-1.5">الفترة المالية</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-xs text-slate-500 mb-0.5">من</span>
                <DateField

                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <span className="block text-xs text-slate-500 mb-0.5">إلى</span>
                <DateField

                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold px-5 py-2.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Search className="w-4 h-4" />
            توليد كشف الحساب
          </button>
          <span className="text-sm text-slate-500">
            يُراعى ترتيب الحركات زمنياً حسب التاريخ ورقم المستند مع حساب الرصيد الجاري.
          </span>
        </div>
      </div>

      {result && (
        <StatementOfAccountReport
          result={result}
          currentUserName={currentUserName}
          company={company}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}
