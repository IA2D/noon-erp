import React, { useState } from 'react';
import {
  ListChecks,
  CheckCircle2,
  ChevronDown,
  BookOpenCheck,
  Coins,
  Wallet,
  Scale
} from 'lucide-react';
import { Account, Currency, CashBox, BankAccount } from '../../../types/erp';

interface SetupStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  icon: React.ElementType;
}

interface Props {
  accounts: Account[];
  currencies: Currency[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
}

export default function SetupProgressTracker({ accounts, currencies, cashBoxes, bankAccounts }: Props) {
  const [expanded, setExpanded] = useState(false);

  const steps: SetupStep[] = [
    {
      key: 'coa',
      label: 'دليل الحسابات',
      hint: 'يحتاج على الأقل حساب تشغيلي واحد (مستوى 5) نشط.',
      done: accounts.some(a => a.level === 5 && a.isActive),
      icon: BookOpenCheck
    },
    {
      key: 'currency',
      label: 'العملة الأساسية',
      hint: 'يجب تفعيل عملة رئيسية واحدة (isBase) معتمدة.',
      done: currencies.some(c => c.isBase && c.isActive),
      icon: Coins
    },
    {
      key: 'cash',
      label: 'صندوق / بنك',
      hint: 'يحتاج صندوقاً نقدياً أو حساباً بنكياً واحداً على الأقل.',
      done: cashBoxes.length > 0 || bankAccounts.length > 0,
      icon: Wallet
    },
    {
      key: 'opening',
      label: 'الأرصدة الافتتاحية',
      hint: 'يحتاج رصيداً افتتاحياً غير صفري لحساب تشغيلي واحد على الأقل.',
      done: accounts.some(a => a.level === 5 && a.isActive && a.openingBalance !== 0),
      icon: Scale
    }
  ];

  const doneCount = steps.filter(s => s.done).length;
  const total = steps.length;
  const percent = Math.round((doneCount / total) * 100);
  const ready = doneCount === total;

  return (
    <div
      className={`glass rounded-2xl border p-5 transition-colors ${
        ready ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-sky-500/30 bg-gradient-to-l from-sky-500/10 via-slate-900/80 to-transparent'
      }`}
    >
      <button type="button" onClick={() => setExpanded(e => !e)} className="w-full text-right cursor-pointer">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border border-white/10 shadow-lg ${ready ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-white">{ready ? 'الإعداد مكتمل — النظام جاهز للعمليات' : 'إعداد البيانات الأساسية'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {doneCount} من {total} خطوات مكتملة — افتح الوحدات لإكمال الإعداد.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-40 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${ready ? 'bg-emerald-400' : 'bg-gradient-to-r from-sky-400 to-cyan-400'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-sm font-bold text-white font-mono">{percent}%</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map(step => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.key}
                className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                  step.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/60 bg-slate-900/40'
                }`}
              >
                <div className={`p-2 rounded-xl border border-white/10 ${step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/60 text-slate-500'}`}>
                  {step.done ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${step.done ? 'text-emerald-200' : 'text-slate-200'}`}>{step.label}</p>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{step.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
