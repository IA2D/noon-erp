import React, { useState, useEffect } from 'react';
import { FileCheck2, Plus, Trash2, X, FileText } from 'lucide-react';
import {
  Account,
  BankAccount,
  CashBox,
  CostCenter,
  Currency,
  JournalEntry,
  PaymentMethod,
  PaymentVoucher,
  PaymentVoucherLine,
  VoucherSourceType
} from '../../types/erp';
import { isPostingAccount, nextPaymentVoucherNumber } from '../../utils/accountingEngine';
import { tafqeet } from '../../utils/tafqeet';
import { decimalNameFor } from '../../utils/tafqeetHelper';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';

const CURRENCY_NAME_AR: Record<string, string> = {
  YER: 'ريال يمني',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
};
import AmountInput from '../AmountInput';
import SmartDateInput, { smartDateToIso, todayIso } from '../common/SmartDateInput';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  costCenters: CostCenter[];
  currencies: Currency[];
  vouchers: PaymentVoucher[];
  onAddVoucher: (voucher: PaymentVoucher, journalEntry?: JournalEntry) => void;
  currentUserName: string;
}

export default function CreatePaymentVoucherModal({
  isOpen,
  onClose,
  accounts,
  cashBoxes,
  bankAccounts,
  costCenters,
  currencies,
  vouchers,
  onAddVoucher,
  currentUserName
}: Props) {
  const { baseCode } = useActiveCurrencies(currencies);
  const [voucherDate, setVoucherDate] = useState<string>(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [sourceType, setSourceType] = useState<VoucherSourceType>('CASH_BOX');
  const [selectedSourceEntityId, setSelectedSourceEntityId] = useState<string>('');
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>('');
  const [payeeName, setPayeeName] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [currency, setCurrency] = useState<string>(baseCode || 'YER');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);

  const nextVoucherNo = nextPaymentVoucherNumber(vouchers);

  const [lines, setLines] = useState<Array<{
    id: string;
    accountId: string;
    description: string;
    amount: number;
    costCenterId: string;
  }>>([]);

  const postingAccounts = accounts.filter(isPostingAccount);

  const getSourceOptions = () => {
    if (sourceType === 'CASH_BOX') {
      if (cashBoxes.length > 0) {
        return cashBoxes.map(b => ({
          id: b.id,
          name: [b.code, b.nameAr].filter(Boolean).join(' - '),
          accountId: b.linkedAccountId || '1101010001',
          balance: b.openingBalance
        }));
      }
      return [{ id: '', name: 'لا توجد صناديق نقدية — أنشئ صندوقاً من (بيانات الصناديق) أولاً', accountId: '' }];
    } else if (sourceType === 'BANK_ACCOUNT') {
      if (bankAccounts.length > 0) {
        return bankAccounts.map(b => ({
          id: b.id,
          name: [b.code, `${b.bankNameAr} (${b.accountNumber})`].filter(Boolean).join(' - '),
          accountId: b.linkedAccountId || '1101020001',
          balance: b.openingBalance
        }));
      }
      return [{ id: '', name: 'لا توجد بنوك / صرافين — أنشئ بنكاً من (بيانات البنوك) أولاً', accountId: '' }];
    } else {
      return postingAccounts
        .filter(a => a.code.startsWith('1101'))
        .map(a => ({ id: a.id, name: `${a.code} - ${a.nameAr}`, accountId: a.id, balance: 0 }));
    }
  };

  const resetForm = () => {
    setVoucherDate(todayIso());
    setPaymentMethod('CASH');
    setSourceType('CASH_BOX');
    setSelectedSourceEntityId('');
    setSelectedSourceAccountId('');
    setPayeeName('');
    setReferenceNumber('');
    setNarration('');
    setCurrency('YER');
    setExchangeRate(1.0);
    setLines([
      {
        id: `line-${Date.now()}-1`,
        accountId: '',
        description: '',
        amount: 0,
        costCenterId: ''
      }
    ]);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
      const sources = getSourceOptions();
      if (sources.length > 0) {
        setSelectedSourceEntityId(sources[0].id);
        setSelectedSourceAccountId(sources[0].accountId);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
    let newSourceType: VoucherSourceType = 'CASH_BOX';
    if (method === 'CASH') {
      newSourceType = 'CASH_BOX';
    } else {
      newSourceType = 'BANK_ACCOUNT';
    }
    setSourceType(newSourceType);

    setTimeout(() => {
      let options: Array<{ id: string; name: string; accountId: string }>;
      if (newSourceType === 'CASH_BOX') {
        options = cashBoxes.map(b => ({ id: b.id, name: b.nameAr, accountId: b.linkedAccountId || '1101010001' }));
      } else {
        options = bankAccounts.map(b => ({ id: b.id, name: b.bankNameAr, accountId: b.linkedAccountId || '1101020001' }));
      }
      if (options.length > 0) {
        setSelectedSourceEntityId(options[0].id);
        setSelectedSourceAccountId(options[0].accountId);
      } else {
          const opts = getSourceOptions();
          if (opts.length > 0) {
              setSelectedSourceEntityId(opts[0].id);
              setSelectedSourceAccountId(opts[0].accountId);
          }
      }
    }, 50);
  };

  const computedLines: PaymentVoucherLine[] = lines.map(line => {
    const acc = accounts.find(a => a.id === line.accountId);
    const amount = Number(line.amount) || 0;
    const totalAmount = amount;

    return {
      id: line.id,
      accountId: line.accountId,
      accountCode: acc ? acc.code : '',
      accountNameAr: acc ? acc.nameAr : '',
      description: line.description || narration || 'مصروف سند صرف',
      amount,
      totalAmount,
      costCenterId: line.costCenterId || undefined
    };
  });

  const subtotalAmount = computedLines.reduce((sum, l) => sum + l.amount, 0);
  const netTotalAmount = subtotalAmount;
  const wordsTafqeet = tafqeet(netTotalAmount, CURRENCY_NAME_AR[currency] || 'ريال يمني', decimalNameFor(currency));

  const handleSaveVoucher = () => {
    if (!payeeName.trim()) {
      alert('يرجى إدخال اسم المستفيد / المدفوع له.');
      return;
    }

    if (!selectedSourceAccountId) {
      alert('يرجى اختيار الحساب أو الصندوق/البنك المسدد منه.');
      return;
    }

    const invalidLine = computedLines.find(l => !l.accountId || l.amount <= 0);
    if (invalidLine) {
      alert('يرجى التأكد من اختيار الحساب وإدخال مبلغ أكبر من صفر لكل سطر في جدول الصرف.');
      return;
    }

    const sourceAccount = accounts.find(a => a.id === selectedSourceAccountId);
    const sourceAccName = sourceAccount ? sourceAccount.nameAr : 'حساب الصناديق / البنوك';
    const nextVoucherNo = nextPaymentVoucherNumber(vouchers);

    const newVoucher: PaymentVoucher = {
      id: `pv-${Date.now()}`,
      voucherNumber: nextVoucherNo,
      date: voucherDate,
      paymentMethod,
      sourceType,
      sourceEntityId: selectedSourceEntityId,
      sourceAccountId: selectedSourceAccountId,
      sourceAccountNameAr: sourceAccName,
      payeeName,
      referenceNumber: referenceNumber || undefined,
      narration: narration || `سند صرف إلى ${payeeName}`,
      currency,
      exchangeRate,
      lines: computedLines,
      subtotalAmount,
      totalAmount: netTotalAmount,
      amountInWordsAr: wordsTafqeet,
      status: 'PENDING_POSTING', // يُحفظ بانتظار الترحيل من شاشة «الإقفالات والترحيل والرقابة»
      createdBy: currentUserName,
      createdAt: new Date().toISOString()
    };

    onAddVoucher(newVoucher);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="glass-card w-full max-w-4xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden my-8 animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80 text-right">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">إصدار سند صرف جديد</h3>
              <p className="text-xs text-slate-400">تعبئة بيانات التوزيع المحاسبي وحساب السداد — يُحفظ السند بانتظار الترحيل من شاشة الإقفالات</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 font-mono text-sm font-bold text-sky-300">
              <FileText className="w-3.5 h-3.5" />
              {nextVoucherNo}
            </span>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
          {/* Row 1: General Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">رقم السند (تلقائي)</label>
              <div className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-sky-300 flex items-center gap-2" dir="ltr">
                <FileText className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                {nextVoucherNo}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">تاريخ السند</label>
              <SmartDateInput value={voucherDate} onChange={d => setVoucherDate(smartDateToIso(d))} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">اسم المستفيد / المدفوع له *</label>
              <input
                type="text"
                value={payeeName}
                onChange={e => setPayeeName(e.target.value)}

                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">طريقة الصرف</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handlePaymentMethodChange('CASH')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  نقداً
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentMethodChange('BANK_TRANSFER')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  تحويل
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentMethodChange('CHEQUE')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'CHEQUE'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  شيك
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Source Account & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {paymentMethod === 'CASH' ? 'الصندوق النقدي المسدد منه (دائن)' : 'الحساب البنكي / الصراف (دائن)'}
              </label>
              <select
                value={selectedSourceEntityId}
                onChange={e => {
                  setSelectedSourceEntityId(e.target.value);
                  const selectedOpt = getSourceOptions().find(o => o.id === e.target.value);
                  if (selectedOpt) {
                    setSelectedSourceAccountId(selectedOpt.accountId);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {getSourceOptions().map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {paymentMethod === 'CASH' ? 'رقم الإيصال / المرجع (اختياري)' : paymentMethod === 'CHEQUE' ? 'رقم الشيك *' : 'رقم الحوالة البنكية *'}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}

                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono text-left dir-ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">البيان العام لسند الصرف</label>
              <input
                type="text"
                value={narration}
                onChange={e => setNarration(e.target.value)}

                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                جدول الحسابات والبنود المستفيدة (مدين)
              </h4>
              <button
                type="button"
                data-enter-nav="add-line"
                onClick={() => {
                  setLines(prev => [
                    ...prev,
                    {
                      id: `line-${Date.now()}-${prev.length + 1}`,
                      accountId: '',
                      description: '',
                      amount: 0,
                      costCenterId: ''
                    }
                  ]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة سطر حساب
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 min-w-[200px]">الحساب المستفيد (المستوى 5) *</th>
                      <th className="p-3">البيان التفصيلي للسطر</th>
                      <th className="p-3 w-28">المبلغ ({baseCode}) *</th>
                      <th className="p-3 w-36">مركز التكلفة</th>
                      <th className="p-3 w-28 text-left">الإجمالي</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {lines.map((line, idx) => {
                      const computed = computedLines[idx];
                      return (
                        <tr key={line.id} className="hover:bg-slate-900/40">
                          <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-3">
                            <select
                              value={line.accountId}
                              onChange={e => {
                                const val = e.target.value;
                                setLines(prev => prev.map(l => l.id === line.id ? { ...l, accountId: val } : l));
                              }}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            >
                              <option value="">-- اختر الحساب --</option>
                              {postingAccounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.code} - {a.nameAr}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={line.description}
                              onChange={e => {
                                const val = e.target.value;
                                setLines(prev => prev.map(l => l.id === line.id ? { ...l, description: val } : l));
                              }}

                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            />
                          </td>
                          <td className="p-3">
                            <AmountInput
                              value={line.amount || ''}
                              onChange={v => {
                                const val = parseFloat(v) || 0;
                                setLines(prev => prev.map(l => l.id === line.id ? { ...l, amount: val } : l));
                              }}

                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500 text-left dir-ltr"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={line.costCenterId}
                              onChange={e => {
                                const val = e.target.value;
                                setLines(prev => prev.map(l => l.id === line.id ? { ...l, costCenterId: val } : l));
                              }}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            >
                              <option value="">بدون مركز</option>
                              {costCenters.map(cc => (
                                <option key={cc.id} value={cc.id}>
                                  {cc.code} - {cc.nameAr}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-left font-bold text-white font-mono dir-ltr">
                            {computed.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            {lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))}
                                className="text-slate-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Summary and Tafqeet Card */}
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">التفقيط العربي المعتمد:</p>
                <p className="text-sm font-bold text-sky-300">{wordsTafqeet}</p>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 justify-end">
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
                  <span className="text-slate-400">الإجمالي النهائي: </span>
                  <span className="font-mono text-base font-black text-white dir-ltr inline-block">{netTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} YER</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveVoucher}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-sky-500/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              حفظ السند الحسابي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
