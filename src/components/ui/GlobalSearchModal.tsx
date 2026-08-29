import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  CornerDownLeft,
  Home,
  Zap,
  Database,
  TrendingUp,
  Layers,
  CircleDollarSign,
  BookOpen,
  FileCheck2,
  Receipt,
  Banknote,
  Landmark,
  Users,
  Building2,
  Truck,
  Boxes,
  Coins,
  Vault,
  FileBarChart2,
  Lock,
  ShieldCheck,
  Settings,
  Info
} from 'lucide-react';
import {
  Account,
  BankAccount,
  CashBox,
  CashBoxType,
  CostCenter,
  Currency,
  Customer,
  Employee,
  JournalEntry,
  PaymentVoucher,
  ReceiptVoucher,
  Trust,
  Vendor
} from '../../types/erp';
import { ERPModule } from '../../constants/permissions';

export interface GlobalSearchData {
  accounts: Account[];
  journals: JournalEntry[];
  vouchers: PaymentVoucher[];
  receipts: ReceiptVoucher[];
  customers: Customer[];
  vendors: Vendor[];
  employees: Employee[];
  trusts: Trust[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  currencies: Currency[];
  costCenters: CostCenter[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** معالج تبديل حالة الفتح/الإغلاق — يُستدعى من اختصار Ctrl + K. */
  onToggleOpen?: () => void;
  onNavigate: (module: ERPModule) => void;
  data: GlobalSearchData;
  allowedModules: ERPModule[];
}

interface NavPageDef {
  module: ERPModule;
  titleAr: string;
  titleEn: string;
  keywords: string;
  icon: React.ElementType;
  iconClass: string;
}

const NAV_PAGES: NavPageDef[] = [
  { module: 'HOME', titleAr: 'الصفحة الرئيسية', titleEn: 'Home', keywords: 'بداية رئيسية', icon: Home, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'OPERATIONS', titleAr: 'العمليات', titleEn: 'Operations', keywords: 'سند صرف سند قبض عهدة تشغيل', icon: Zap, iconClass: 'bg-amber-500/20 text-amber-400' },
  { module: 'INPUTS', titleAr: 'المدخلات', titleEn: 'Inputs', keywords: 'بيانات دليل حسابات', icon: Database, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'DASHBOARD', titleAr: 'المؤشرات المالية', titleEn: 'Financial Indicators', keywords: 'مؤشرات أداء احصائيات مالية', icon: TrendingUp, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'CHART_OF_ACCOUNTS', titleAr: 'دليل الحسابات', titleEn: 'Chart of Accounts', keywords: 'حساب أصول خصوم حقوق ملكية', icon: Layers, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'OPENING_BALANCES', titleAr: 'الأرصدة الافتتاحية', titleEn: 'Opening Balances', keywords: 'رصيد افتتاحي', icon: CircleDollarSign, iconClass: 'bg-emerald-500/20 text-emerald-400' },
  { module: 'JOURNAL_ENTRIES', titleAr: 'قيود اليومية', titleEn: 'Journal Entries', keywords: 'قيد محاسبي ترحيل يومية', icon: BookOpen, iconClass: 'bg-emerald-500/20 text-emerald-400' },
  { module: 'PAYMENT_VOUCHERS', titleAr: 'سندات الصرف', titleEn: 'Payment Vouchers', keywords: 'سند صرف مصروفات', icon: FileCheck2, iconClass: 'bg-emerald-500/20 text-emerald-400' },
  { module: 'RECEIPT_VOUCHERS', titleAr: 'سندات القبض', titleEn: 'Receipt Vouchers', keywords: 'سند قبض وارد تحصيل', icon: Receipt, iconClass: 'bg-emerald-500/20 text-emerald-400' },
  { module: 'CASH_BOXES', titleAr: 'الصناديق النقدية', titleEn: 'Cash Boxes', keywords: 'صندوق نقدية خزينة', icon: Banknote, iconClass: 'bg-amber-500/20 text-amber-400' },
  { module: 'BANK_ACCOUNTS', titleAr: 'البنوك والصرافين', titleEn: 'Banks', keywords: 'بنك صراف حوالة شيك', icon: Landmark, iconClass: 'bg-blue-500/20 text-blue-400' },
  { module: 'EMPLOYEES', titleAr: 'بيانات الموظفين', titleEn: 'Employees', keywords: 'موظف رواتب سلف', icon: Users, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'CUSTOMERS', titleAr: 'بيانات العملاء', titleEn: 'Customers', keywords: 'عميل ذمم مدينة', icon: Building2, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'VENDORS', titleAr: 'بيانات الموردين', titleEn: 'Vendors', keywords: 'مورد ذمم دائنة', icon: Truck, iconClass: 'bg-orange-500/20 text-orange-400' },
  { module: 'COST_CENTERS', titleAr: 'مراكز التكلفة', titleEn: 'Cost Centers', keywords: 'مركز تكلفة مشروع', icon: Boxes, iconClass: 'bg-teal-500/20 text-teal-400' },
  { module: 'CURRENCIES', titleAr: 'العملات', titleEn: 'Currencies', keywords: 'عملة سعر صرف تحويل', icon: Coins, iconClass: 'bg-emerald-500/20 text-emerald-400' },
  { module: 'TRUSTS', titleAr: 'العهد', titleEn: 'Trusts', keywords: 'عهدة أمانة سلف ضمان', icon: Vault, iconClass: 'bg-amber-500/20 text-amber-400' },
  { module: 'REPORTS', titleAr: 'التقارير المالية', titleEn: 'Reports', keywords: 'ميزان مراجعة قائمة دخل ميزانية عمومية كشف حساب', icon: FileBarChart2, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'CLOSING', titleAr: 'الإقفالات والترحيل', titleEn: 'Closing', keywords: 'إقفال سنة ترحيل أرباح مبقاة', icon: Lock, iconClass: 'bg-sky-500/20 text-sky-400' },
  { module: 'AUDIT_SECURITY', titleAr: 'التدقيق والصلاحيات', titleEn: 'Audit & Security', keywords: 'سجل تدقيق صلاحيات مستخدمون', icon: ShieldCheck, iconClass: 'bg-rose-500/20 text-rose-400' },
  { module: 'SETTINGS', titleAr: 'الإعدادات', titleEn: 'Settings', keywords: 'لغة مظهر نسخ احتياطي', icon: Settings, iconClass: 'bg-slate-500/20 text-slate-300' },
  { module: 'ABOUT', titleAr: 'About Us', titleEn: 'About Us', keywords: 'نبذة رؤية فريق مطور تواصل', icon: Info, iconClass: 'bg-sky-500/20 text-sky-400' }
];

interface SearchEntry {
  id: string;
  group: 'nav' | 'entity';
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconClass: string;
  module: ERPModule;
  searchText: string;
}

const BOX_TYPE_LABELS: Record<CashBoxType, string> = {
  MAIN: 'رئيسي',
  BRANCH: 'فرعي',
  RECEPTION: 'استقبال',
  OPERATIONS: 'تشغيلي'
};

function buildEntityEntries(data: GlobalSearchData, allowedModules: ERPModule[]): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const has = (m: ERPModule) => allowedModules.includes(m);

  if (has('CHART_OF_ACCOUNTS')) {
    data.accounts.forEach(a => {
      entries.push({
        id: `acc-${a.id}`,
        group: 'entity',
        title: `${a.code} - ${a.nameAr}`,
        subtitle: `حساب · ${a.nameEn}`,
        icon: Layers,
        iconClass: 'bg-sky-500/20 text-sky-400',
        module: 'CHART_OF_ACCOUNTS',
        searchText: `${a.code} ${a.nameAr} ${a.nameEn} حساب`
      });
    });
  }

  if (has('JOURNAL_ENTRIES')) {
    data.journals.forEach(j => {
      entries.push({
        id: `jv-${j.id}`,
        group: 'entity',
        title: `${j.entryNumber} - ${j.narration}`,
        subtitle: `قيد يومية · ${j.date}${j.status === 'POSTED' ? '' : j.status === 'VOIDED' ? ' · ملغي' : ' · بانتظار الترحيل'}`,
        icon: BookOpen,
        iconClass: 'bg-emerald-500/20 text-emerald-400',
        module: 'JOURNAL_ENTRIES',
        searchText: `${j.entryNumber} ${j.narration} ${j.reference} قيد يومية`
      });
    });
  }

  if (has('PAYMENT_VOUCHERS')) {
    data.vouchers.forEach(v => {
      entries.push({
        id: `pv-${v.id}`,
        group: 'entity',
        title: `${v.voucherNumber} - ${v.payeeName}`,
        subtitle: `سند صرف · ${v.date}${v.narration ? ` · ${v.narration}` : ''}`,
        icon: FileCheck2,
        iconClass: 'bg-emerald-500/20 text-emerald-400',
        module: 'PAYMENT_VOUCHERS',
        searchText: `${v.voucherNumber} ${v.payeeName} ${v.narration} سند صرف`
      });
    });
  }

  if (has('RECEIPT_VOUCHERS')) {
    data.receipts.forEach(r => {
      entries.push({
        id: `rv-${r.id}`,
        group: 'entity',
        title: `${r.receiptNumber} - ${r.payerName}`,
        subtitle: `سند قبض · ${r.date}${r.narration ? ` · ${r.narration}` : ''}`,
        icon: Receipt,
        iconClass: 'bg-emerald-500/20 text-emerald-400',
        module: 'RECEIPT_VOUCHERS',
        searchText: `${r.receiptNumber} ${r.payerName} ${r.narration} سند قبض`
      });
    });
  }

  if (has('CUSTOMERS')) {
    data.customers.forEach(c => {
      entries.push({
        id: `cus-${c.id}`,
        group: 'entity',
        title: `${c.code} - ${c.nameAr}`,
        subtitle: `عميل · ${c.nameEn}`,
        icon: Building2,
        iconClass: 'bg-sky-500/20 text-sky-400',
        module: 'CUSTOMERS',
        searchText: `${c.code} ${c.nameAr} ${c.nameEn} عميل`
      });
    });
  }

  if (has('VENDORS')) {
    data.vendors.forEach(v => {
      entries.push({
        id: `ven-${v.id}`,
        group: 'entity',
        title: `${v.code} - ${v.nameAr}`,
        subtitle: `مورد · ${v.nameEn}`,
        icon: Truck,
        iconClass: 'bg-orange-500/20 text-orange-400',
        module: 'VENDORS',
        searchText: `${v.code} ${v.nameAr} ${v.nameEn} مورد`
      });
    });
  }

  if (has('EMPLOYEES')) {
    data.employees.forEach(e => {
      entries.push({
        id: `emp-${e.id}`,
        group: 'entity',
        title: `${e.code} - ${e.nameAr}`,
        subtitle: `موظف · ${e.jobTitle || e.nameEn}`,
        icon: Users,
        iconClass: 'bg-sky-500/20 text-sky-400',
        module: 'EMPLOYEES',
        searchText: `${e.code} ${e.nameAr} ${e.nameEn} ${e.jobTitle} موظف`
      });
    });
  }

  if (has('TRUSTS')) {
    data.trusts.forEach(t => {
      entries.push({
        id: `tr-${t.id}`,
        group: 'entity',
        title: `${t.trustNumber} - ${t.title}`,
        subtitle: `عهدة · ${t.employeeName} · ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} YER`,
        icon: Vault,
        iconClass: 'bg-amber-500/20 text-amber-400',
        module: 'TRUSTS',
        searchText: `${t.trustNumber} ${t.title} ${t.employeeName} عهدة`
      });
    });
  }

  if (has('CASH_BOXES')) {
    data.cashBoxes.forEach(b => {
      entries.push({
        id: `bx-${b.id}`,
        group: 'entity',
        title: `${b.code} - ${b.nameAr}`,
        subtitle: `صندوق · ${BOX_TYPE_LABELS[b.boxType] || ''}`,
        icon: Banknote,
        iconClass: 'bg-amber-500/20 text-amber-400',
        module: 'CASH_BOXES',
        searchText: `${b.code} ${b.nameAr} ${b.nameEn} صندوق`
      });
    });
  }

  if (has('BANK_ACCOUNTS')) {
    data.bankAccounts.forEach(b => {
      entries.push({
        id: `bnk-${b.id}`,
        group: 'entity',
        title: `${b.code} - ${b.bankNameAr}`,
        subtitle: `${b.entityType === 'BANK' ? 'بنك' : 'صراف'} · ${b.accountNumber}`,
        icon: Landmark,
        iconClass: 'bg-blue-500/20 text-blue-400',
        module: 'BANK_ACCOUNTS',
        searchText: `${b.code} ${b.bankNameAr} ${b.bankNameEn} ${b.accountNumber} بنك صراف`
      });
    });
  }

  if (has('CURRENCIES')) {
    data.currencies.forEach(c => {
      entries.push({
        id: `cur-${c.id}`,
        group: 'entity',
        title: `${c.code} - ${c.nameAr}`,
        subtitle: `عملة · سعر التحويل ${c.exchangeRate}`,
        icon: Coins,
        iconClass: 'bg-emerald-500/20 text-emerald-400',
        module: 'CURRENCIES',
        searchText: `${c.code} ${c.nameAr} ${c.nameEn} عملة`
      });
    });
  }

  if (has('COST_CENTERS')) {
    data.costCenters.forEach(cc => {
      entries.push({
        id: `cc-${cc.id}`,
        group: 'entity',
        title: `${cc.code} - ${cc.nameAr}`,
        subtitle: `مركز تكلفة · ${cc.nameEn}`,
        icon: Boxes,
        iconClass: 'bg-teal-500/20 text-teal-400',
        module: 'COST_CENTERS',
        searchText: `${cc.code} ${cc.nameAr} ${cc.nameEn} مركز تكلفة`
      });
    });
  }

  return entries;
}

export default function GlobalSearchModal({ open, onClose, onToggleOpen, onNavigate, data, allowedModules }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const toggleOpenRef = useRef(onToggleOpen);
  useEffect(() => {
    toggleOpenRef.current = onToggleOpen;
  }, [onToggleOpen]);

  // اختصار عالمي Ctrl/Cmd + K لفتح/إغلاق نافذة البحث — يعمل حتى أثناء إخفائها.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleOpenRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // إغلاق بمفتاح Escape حتى لو خرج التركيز من حقل البحث.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  // قفل تمرير الصفحة خلف النافذة أثناء فتحها.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const allEntities = useMemo(() => buildEntityEntries(data, allowedModules), [data, allowedModules]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pageResults: SearchEntry[] = NAV_PAGES
      .filter(p => allowedModules.includes(p.module))
      .filter(p => !q || `${p.titleAr} ${p.titleEn} ${p.keywords}`.toLowerCase().includes(q))
      .map(p => ({
        id: `nav-${p.module}`,
        group: 'nav' as const,
        title: p.titleAr,
        subtitle: p.titleEn,
        icon: p.icon,
        iconClass: p.iconClass,
        module: p.module,
        searchText: `${p.titleAr} ${p.titleEn} ${p.keywords}`
      }));
    if (!q) {
      return pageResults;
    }
    const entityResults = allEntities.filter(e => e.searchText.toLowerCase().includes(q)).slice(0, 30);
    return [...pageResults, ...entityResults];
  }, [query, allEntities, allowedModules]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-search-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const pageResults = results.filter(r => r.group === 'nav');
  const entityResults = results.filter(r => r.group === 'entity');

  const choose = (entry: SearchEntry) => {
    onNavigate(entry.module);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        choose(results[Math.min(activeIndex, results.length - 1)]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-[2px]"
        onMouseDown={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-[12%] -translate-x-1/2 z-[101] w-full max-w-xl px-4"
        onMouseDown={e => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="paper w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh] dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-3 border-b border-slate-200 shrink-0 dark:bg-slate-900/70 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-600 border border-sky-500/30 flex-shrink-0 dark:text-sky-400">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xl text-slate-900 truncate dark:text-slate-100">البحث الشامل</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">صفحات، سندات، عملاء، موردين، حسابات...</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold border border-slate-200 text-slate-500 bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:bg-slate-800">ESC</kbd>
            <button
              type="button"
              onClick={onClose}
              title="إغلاق"
              aria-label="إغلاق"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:border-red-500/60 hover:text-red-500 cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/50 shrink-0 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}

              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer dark:hover:text-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-2 min-h-0">
          {results.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">لا توجد نتائج مطابقة</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">جرّب كلمة أخرى أو اسم صفحة</p>
            </div>
          ) : (
            <>
              {pageResults.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">الصفحات</p>
                  {pageResults.map(entry => {
                    const idx = results.indexOf(entry);
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        data-search-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => choose(entry)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${idx === activeIndex ? 'bg-blue-50 dark:bg-slate-800/80' : 'hover:bg-blue-50 dark:hover:bg-slate-800/80'}`}
                      >
                        <div className={`p-2 rounded-lg border border-slate-200 bg-slate-50 shrink-0 dark:border-slate-800 dark:bg-slate-900 ${entry.iconClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">{entry.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{entry.subtitle}</p>
                        </div>
                        {idx === activeIndex && <CornerDownLeft className="w-4 h-4 text-sky-600 shrink-0 dark:text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {entityResults.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">البيانات والسجلات</p>
                  {entityResults.map(entry => {
                    const idx = results.indexOf(entry);
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        data-search-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => choose(entry)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${idx === activeIndex ? 'bg-blue-50 dark:bg-slate-800/80' : 'hover:bg-blue-50 dark:hover:bg-slate-800/80'}`}
                      >
                        <div className={`p-2 rounded-lg border border-slate-200 bg-white shrink-0 dark:border-slate-800 dark:bg-slate-900 ${entry.iconClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">{entry.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{entry.subtitle}</p>
                        </div>
                        {idx === activeIndex && <CornerDownLeft className="w-4 h-4 text-sky-600 shrink-0 dark:text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-200 text-xs text-slate-500 dark:text-slate-400 dark:border-slate-800">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">↑↓</kbd>
            للتنقل
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">Enter</kbd>
            للفتح
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">Esc</kbd>
            للإغلاق
          </span>
        </div>
      </div>
      </div>
    </>,
    document.body
  );
}
