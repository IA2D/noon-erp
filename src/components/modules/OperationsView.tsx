import React from 'react';
import {
    Zap,
    ShieldCheck,
    ArrowUpRight,
    FileText,
    ChevronLeft,
    ChevronRight,
    FileCheck2,
    Receipt,
    BookOpen
} from 'lucide-react';
import { Account, BankAccount, CashBox, CostCenter, Currency, JournalEntry, PaymentVoucher } from '../../types/erp';
import { ERPModule } from '../../constants/permissions';
import { useI18n } from '../../i18n';
import PageHeader from '../ui/PageHeader';
import { fmtAmount, fmtNum } from '../../utils/format';

interface Props {
    journals: JournalEntry[];
    vouchers?: PaymentVoucher[];
    accounts?: Account[];
    cashBoxes?: CashBox[];
    bankAccounts?: BankAccount[];
    costCenters?: CostCenter[];
    currencies?: Currency[];
    currentUserName?: string;
    onNavigate: (module: ERPModule) => void;
}

interface Tile {
    id: string;
    icon: React.ElementType;
    title: string;
    iconClass: string;
    meta: string;
    module?: ERPModule;
    action?: () => void;
}

export default function OperationsView({ journals, vouchers = [], accounts = [], cashBoxes = [], bankAccounts = [], costCenters = [], currencies = [], currentUserName = 'مستخدم', onNavigate }: Props) {
    const { lang } = useI18n();
    const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;

    const totalValue = journals.reduce((s, j) => s + j.totalDebit, 0);

    const tiles: Tile[] = [
        {
            id: 'op-journal-entry',
            icon: BookOpen,
            title: 'قيد يومي جديد',
            iconClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
            meta: 'القيود اليومية',
            module: 'JOURNAL_ENTRIES'
        },
        {
            id: 'op-payment-voucher',
            icon: FileCheck2,
            title: 'سند صرف',
            iconClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
            meta: 'سندات الصرف',
            module: 'PAYMENT_VOUCHERS'
        },
        {
            id: 'op-receipt-voucher',
            icon: Receipt,
            title: 'سند قبض',
            iconClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
            meta: 'سندات القبض',
            module: 'RECEIPT_VOUCHERS'
        },
        {
            id: 'op-custody',
            icon: ShieldCheck,
            title: 'عهدة مالية / عينية',
            iconClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
            meta: 'العُهد المالية والعينية',
            module: 'CUSTODY'
        }
    ];

    const stats = [
        { label: 'إجمالي القيود', value: journals.length, icon: FileText, iconClass: 'bg-sky-500/20 text-sky-400', money: false },
        { label: 'سندات الصرف', value: vouchers.length, icon: FileCheck2, iconClass: 'bg-emerald-500/20 text-emerald-400', money: false },
        { label: 'إجمالي قيمة القيود', value: totalValue, icon: ArrowUpRight, iconClass: 'bg-sky-500/20 text-sky-400', money: true }
    ];

    return (
        <div className="space-y-6 animate-fade-in text-right">
            <PageHeader
                icon={<Zap className="w-6 h-6 text-sky-400" />}
                title="صفحة العمليات"
                subtitle="العمليات اليومية في النظام — سندات الصرف والقبض والقيود اليومية وإدارة العهد والعُهد المالية والعينية"
            />

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="glass-card rounded-2xl p-5 border border-slate-700/50 flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${s.iconClass}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-400">{s.label}</p>
                                <p className="text-xl font-black text-white">{s.money ? fmtAmount(s.value) : fmtNum(s.value)}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Operations Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tiles.map(tile => {
                    const Icon = tile.icon;
                    return (
                        <button
                            key={tile.id}
                            onClick={() => {
                                if (tile.action) {
                                    tile.action();
                                } else if (tile.module) {
                                    onNavigate(tile.module);
                                }
                            }}
                            className="group relative text-right glass rounded-2xl p-6 border border-slate-700/50 hover:border-sky-500/40 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                        >
                            <div className="flex items-start justify-between relative">
                                <div className={`p-3.5 rounded-2xl border border-white/10 shadow-lg ${tile.iconClass} group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-semibold text-slate-500 bg-slate-800/50 rounded-full px-2.5 py-1">{tile.meta}</span>
                            </div>
                            <h3 className="mt-5 font-bold text-white text-lg">{tile.title}</h3>
                            <div className="mt-4 flex items-center gap-2 text-sky-400 text-xs font-bold">
                                <span>{tile.action ? 'فتح النافذة' : 'افتح الوحدة'}</span>
                                <Arrow className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
