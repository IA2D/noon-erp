import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  Building2,
  Hash,
  BadgePercent,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  Wallet,
  CalendarClock,
  CheckCircle2,
  Coins
} from 'lucide-react';
import { Account, AccountCurrency, Currency, JournalEntry, Vendor, VendorType, VendorPaymentTerms } from '../../types/erp';
import { calculateAccountActivity, aggregateAccountBalance, payablePostingAccounts, isLinkedOutOfDomain, nextEntityCode } from '../../utils/accountingEngine';
import { useActiveCurrencies, defaultIncludedCodes } from '../../hooks/useActiveCurrencies';
import { useToast } from '../ui/Toast';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import ModalShell from '../ui/ModalShell';

interface Props {
  vendors: Vendor[];
  accounts: Account[];
  journals: JournalEntry[];
  currencies: Currency[];
  onAddVendor: (ven: Omit<Vendor, 'id'>) => void;
  onUpdateVendor: (id: string, updates: Partial<Vendor>) => void;
  onDeleteVendor: (id: string) => void;
}

const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  COMPANY: 'شركة',
  INDIVIDUAL: 'فرد'
};

const VENDOR_TYPE_BADGES: Record<VendorType, string> = {
  COMPANY: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  INDIVIDUAL: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
};

const PAYMENT_TERMS_LABELS: Record<VendorPaymentTerms, string> = {
  CASH: 'دفع نقدي',
  NET_30: '30 يوم',
  NET_60: '60 يوم',
  NET_90: '90 يوم'
};

const AVATAR_GRADIENTS = [
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-300 to-sky-500',
  'from-rose-500 to-pink-600'
];

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[1][0] || '');
}

function nextVendorCode(vendors: Vendor[]): string {
 // يُولّد تلقائياً الكود التسلسلي التالي للمورد (MAX+1): SUP-###
 // — SUP-001 -> SUP-002.
 return nextEntityCode(vendors, 'SUP');
}

function buildCurrencies(codes: string[]): AccountCurrency[] {
  const ts = Date.now();
  return codes.map((code, i) => ({
    id: `cur-${ts}-${i}`,
    code,
    isDefault: i === 0,
    isActive: true
  }));
}

/** دمج العملات عند تعديل مورد: تضمين/إيقاف مع الحفاظ على السجل (إيقاف بدلاً من الحذف) */
function mergeCurrencies(existing: AccountCurrency[], included: string[]): AccountCurrency[] {
  const ts = Date.now();
  const next: AccountCurrency[] = [];
  existing.forEach(c => {
    const active = included.includes(c.code);
    next.push({ ...c, isActive: active, isDefault: included[0] === c.code });
  });
  included.forEach(code => {
    if (!existing.some(c => c.code === code)) {
      next.push({ id: `cur-${ts}-${code}`, code, isActive: true, isDefault: included[0] === code });
    }
  });
  return next;
}

interface VendorForm {
  code: string;
  nameAr: string;
  nameEn: string;
  vendorType: VendorType;
  commercialRegistration: string;
  vatNumber: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  paymentTerms: VendorPaymentTerms;
  linkedAccountId: string;
  includedCurrencies: string[];
  notes: string;
  isActive: boolean;
}

function emptyForm(code: string, includedCurrencies: string[]): VendorForm {
  return {
    code,
    nameAr: '',
    nameEn: '',
    vendorType: 'COMPANY',
    commercialRegistration: '',
    vatNumber: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    paymentTerms: 'NET_30',
    linkedAccountId: '',
    includedCurrencies,
    notes: '',
    isActive: true
  };
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VendorsView({ vendors, accounts, journals, currencies, onAddVendor, onUpdateVendor, onDeleteVendor }: Props) {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string; form: VendorForm } | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const { options: currencyOptions } = useActiveCurrencies(currencies);
  const defaultCodes = defaultIncludedCodes(currencies);

  const activity = calculateAccountActivity(accounts, journals);

  const vendorBalance = (ven: Vendor): number => {
    if (!ven.linkedAccountId) return 0;
    const linked = accounts.find(a => a.id === ven.linkedAccountId);
    if (!linked) return 0;
    return aggregateAccountBalance(linked, accounts, activity);
  };

  const linkedName = (id?: string): string => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? `${acc.code} - ${acc.nameAr}` : '—';
  };

  const filtered = vendors.filter(v => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      v.code.toLowerCase().includes(term) ||
      v.nameAr.includes(searchTerm.trim()) ||
      v.nameEn.toLowerCase().includes(term) ||
      v.commercialRegistration.includes(searchTerm.trim()) ||
      v.vatNumber.includes(searchTerm.trim()) ||
      v.phone.includes(searchTerm.trim()) ||
      v.city.includes(searchTerm.trim())
    );
  });

  const activeCount = vendors.filter(v => v.isActive).length;
  const totalPayable = vendors.reduce((s, v) => s + Math.max(vendorBalance(v), 0), 0);
  const companiesCount = vendors.filter(v => v.vendorType === 'COMPANY').length;

  const openAdd = () => {
    setFormError('');
    setModal({ mode: 'add', form: emptyForm(nextVendorCode(vendors), defaultCodes) });
  };

  const openEdit = (ven: Vendor) => {
    setFormError('');
    setModal({
      mode: 'edit',
      id: ven.id,
      form: {
        code: ven.code,
        nameAr: ven.nameAr,
        nameEn: ven.nameEn,
        vendorType: ven.vendorType,
        commercialRegistration: ven.commercialRegistration || '',
        vatNumber: ven.vatNumber || '',
        phone: ven.phone || '',
        email: ven.email || '',
        address: ven.address || '',
        city: ven.city || '',
        paymentTerms: ven.paymentTerms || 'NET_30',
        linkedAccountId: ven.linkedAccountId || '',
        includedCurrencies: (() => {
          const active = (ven.currencies || []).filter(c => c.isActive).map(c => c.code);
          return active.length > 0 ? active : [ven.defaultCurrency || 'YER'];
        })(),
        notes: ven.notes || '',
        isActive: ven.isActive
      }
    });
  };

  const changeVendorType = (type: VendorType) => {
    setModal(prev => {
      if (!prev) return prev;
      const form = { ...prev.form, vendorType: type };
      if (prev.mode === 'add') {
        form.code = nextVendorCode(vendors);
      }
      return { ...prev, form };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const f = modal.form;
    const entityCode = f.code.trim();
    if (!entityCode) {
      setFormError('كود المورد مطلوب.');
      return;
    }
    if (!f.nameAr.trim()) {
      setFormError('اسم المورد بالعربية مطلوب.');
      return;
    }
    if (!f.linkedAccountId) {
      setFormError('يجب ربط المورد بحساب ذمم موردين رئيسي من دليل الحسابات (المستوى الخامس).');
      return;
    }
    const cr = f.commercialRegistration.trim();
    if (cr && !/^\d{10}$/.test(cr)) {
      setFormError('السجل التجاري يجب أن يتكون من 10 أرقام.');
      return;
    }
    const vat = f.vatNumber.trim();
    if (vat && !/^\d{15}$/.test(vat)) {
      setFormError('الرقم الضريبي يجب أن يتكون من 15 رقماً.');
      return;
    }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      setFormError('صيغة البريد الإلكتروني غير صحيحة.');
      return;
    }
    if (f.includedCurrencies.length === 0) {
      setFormError('يجب تضمين عملة واحدة على الأقل للمورد.');
      return;
    }
    if (modal.mode === 'add') {
      if (vendors.some(v => v.code.toLowerCase() === entityCode.toLowerCase())) {
        setFormError(`كود المورد ${entityCode} مستخدم مسبقاً — لا يمكن تكرار الكود.`);
        return;
      }
      try {
        onAddVendor({
        code: entityCode,
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        vendorType: f.vendorType,
        commercialRegistration: cr,
        vatNumber: vat,
        phone: f.phone.trim(),
        email: f.email.trim(),
        address: f.address.trim(),
        city: f.city.trim(),
        paymentTerms: f.paymentTerms,
        currencies: buildCurrencies(f.includedCurrencies),
        defaultCurrency: f.includedCurrencies[0] || 'YER',
        linkedAccountId: f.linkedAccountId || undefined,
        notes: f.notes.trim(),
        isActive: f.isActive,
        createdAt: new Date().toISOString().substring(0, 10)
        });
        toast('success', `تمت إضافة المورد ${entityCode} - ${f.nameAr.trim()}`);
      } catch (err) {
        console.error('VendorsView: فشل حفظ المورد', err);
        setFormError('تعذر حفظ المورد — يرجى المحاولة مرة أخرى، وإذا استمرت المشكلة راجع وحدة التحكم.');
        toast('error', 'تعذر حفظ المورد — حدث خطأ أثناء الحفظ.');
        return;
      }
    } else if (modal.id) {
      const editing = vendors.find(v => v.id === modal.id);
      try {
        onUpdateVendor(modal.id, {
        code: entityCode,
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        vendorType: f.vendorType,
        commercialRegistration: cr,
        vatNumber: vat,
        phone: f.phone.trim(),
        email: f.email.trim(),
        address: f.address.trim(),
        city: f.city.trim(),
        paymentTerms: f.paymentTerms,
        currencies: mergeCurrencies(editing?.currencies || [], f.includedCurrencies),
        defaultCurrency: f.includedCurrencies[0] || editing?.defaultCurrency || 'YER',
        linkedAccountId: f.linkedAccountId || undefined,
        notes: f.notes.trim(),
        isActive: f.isActive
        });
        toast('success', `تم تحديث بيانات المورد ${entityCode}`);
      } catch (err) {
        console.error('VendorsView: فشل تحديث المورد', err);
        setFormError('تعذر تحديث بيانات المورد — يرجى المحاولة مرة أخرى.');
        toast('error', 'تعذر تحديث بيانات المورد — حدث خطأ أثناء الحفظ.');
        return;
      }
    }
    setModal(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteVendor(deleteTarget.id);
    toast('success', `تم حذف المورد ${deleteTarget.code} - ${deleteTarget.nameAr}`);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Truck className="w-6 h-6" />}
        title="بيانات الموردين"
        subtitle="إدارة سجل الموردين — السجل التجاري والرقم الضريبي وشروط الدفع والربط بذمم الموردين"
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إضافة مورد جديد
          </button>
        }
      />

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">إجمالي الموردين</div>
          <div className="text-2xl font-black text-white mt-1">{vendors.length}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">موردون نشطون</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">شركات موردة</div>
          <div className="text-2xl font-black text-sky-400 mt-1">{companiesCount}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">ذمم مستحقة للموردين</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{fmt(totalPayable)} YER</div>
        </div>
      </div>

      {/* البحث */}
      <div className="glass p-4 rounded-2xl border border-slate-700/50">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <F9SearchInput
            value={searchTerm}
            onChange={v => setSearchTerm(v)}

            className="w-full px-10 py-2.5 text-sm glass-input rounded-xl"
            items={filtered}
            columns={[
              { label: 'الكود', render: (v: Vendor) => <span className="font-mono font-bold text-sky-400">{v.code}</span> },
              {
                label: 'الاسم', render: (v: Vendor) => (
                  <div>
                    <div className="font-bold text-white">{v.nameAr}</div>
                    <div className="text-sm text-slate-400 font-mono">{v.nameEn || '—'}</div>
                  </div>
                )
              },
              { label: 'الجوال', render: (v: Vendor) => <span className="font-mono text-slate-300" dir="ltr">{v.phone || '—'}</span> },
              { label: 'المدينة', render: (v: Vendor) => <span className="text-slate-300">{v.city || '—'}</span> }
            ]}
            searchText={v => `${v.code} ${v.nameAr} ${v.nameEn} ${v.phone} ${v.city} ${v.email}`}
            browseTitle="استعراض الموردين"
          />
        </div>
      </div>

      {/* القائمة */}
      <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1400px]">
            {filtered.map((ven, idx) => (
              <div key={ven.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-white/5 transition-colors ${!ven.isActive ? 'opacity-50' : ''}`}>
                <div className="w-12 flex-shrink-0 flex items-center justify-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-xs font-bold">
                    {vendors.indexOf(ven) + 1}
                  </span>
                </div>
                <div className="flex items-center gap-3 w-80 flex-shrink-0 min-w-0">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]} text-white flex items-center justify-center font-black text-sm shadow-lg flex-shrink-0`}>
                    {initials(ven.nameAr)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400 text-sm">{ven.code}</span>
                      <span className="font-bold text-white truncate block">{ven.nameAr}</span>
                    </div>
                    <div className="text-sm text-slate-400 font-mono whitespace-nowrap">{ven.nameEn || '—'}</div>
                  </div>
                </div>

                <div className="w-24 flex-shrink-0">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-semibold border ${VENDOR_TYPE_BADGES[ven.vendorType]}`}>
                    {VENDOR_TYPE_LABELS[ven.vendorType]}
                  </span>
                </div>

                <div className="w-32 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate" dir="ltr">{ven.commercialRegistration || '—'}</span>
                </div>

                <div className="w-36 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <BadgePercent className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate" dir="ltr">{ven.vatNumber || '—'}</span>
                </div>

                <div className="w-28 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate" dir="ltr">{ven.phone || '—'}</span>
                </div>

                <div className="w-24 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{ven.city || '—'}</span>
                </div>

                <div className="w-24 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border bg-sky-500/10 text-sky-300 border-sky-500/25">
                    <CalendarClock className="w-3 h-3" />
                    {PAYMENT_TERMS_LABELS[ven.paymentTerms]}
                  </span>
                </div>

                <div className="w-36 flex-shrink-0">
                  <div className="text-sm text-slate-500">الذمم المستحقة</div>
                  <div className={`font-mono font-bold text-sm ${vendorBalance(ven) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{fmt(Math.max(vendorBalance(ven), 0))} <span className="text-slate-500 text-xs">{ven.defaultCurrency || 'YER'}</span></div>
                </div>

                <div className="w-44 flex-shrink-0">
                  <div className="text-sm text-slate-500 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-400" />
                    العملات (تضمين / توقيف)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {(ven.currencies && ven.currencies.length > 0 ? ven.currencies.filter(c => c.isActive) : [{ id: `cur-def-${ven.defaultCurrency || 'YER'}`, code: ven.defaultCurrency || 'YER', isDefault: true, isActive: true } as AccountCurrency]).map(c => (
                      <span
                        key={c.code}
                        title={c.isDefault ? 'العملة الافتراضية' : c.code}
                        className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${c.isDefault
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                      >
                        {c.code}
                        {c.isDefault && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="w-20 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border ${ven.isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                    <Power className="w-3 h-3" />
                    {ven.isActive ? 'نشط' : 'موقوف'}
                  </span>
                </div>

                <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(ven)}
                    title="تعديل بيانات المورد"
                    className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(ven)}
                    title="حذف / إيقاف"
                    className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-14 text-center text-slate-400">
                <div className="flex flex-col items-center gap-3">
                  <Truck className="w-10 h-10 text-slate-600" />
                  <p className="font-bold text-white">لا يوجد موردون مطابقون</p>
                  <p className="text-sm">جرّب تغيير نص البحث أو أضف مورداً جديداً</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نافذة الإضافة / التعديل */}
      {modal && (
        <ModalShell
          id="vendor-form"
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal.mode === 'add' ? 'إضافة مورد جديد' : 'تعديل بيانات المورد'}
          icon={Truck}
          size="lg"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
        >

            <form id="vendor-form" onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {formError && (
                <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">كود المورد (تلقائي)</label>
                  <div className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900/60 border border-slate-700/60 font-mono font-bold text-sky-400 text-center" dir="ltr">
                    {modal.form.code || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">نوع المورد</label>
                  <select
                    value={modal.form.vendorType}
                    onChange={e => changeVendorType(e.target.value as VendorType)}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
                  >
                    <option value="COMPANY">شركة</option>
                    <option value="INDIVIDUAL">فرد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">شروط الدفع</label>
                  <select
                    value={modal.form.paymentTerms}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, paymentTerms: e.target.value as VendorPaymentTerms } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
                  >
                    <option value="CASH">دفع نقدي</option>
                    <option value="NET_30">30 يوم</option>
                    <option value="NET_60">60 يوم</option>
                    <option value="NET_90">90 يوم</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المورد بالعربية *</label>
                  <input
                    type="text"
                    required
                    value={modal.form.nameAr}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nameAr: e.target.value } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl"

                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المورد بالإنجليزية</label>
                  <input
                    type="text"
                    value={modal.form.nameEn}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nameEn: e.target.value } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
                    dir="ltr"

                  />
                </div>
              </div>

              <div className="rounded-xl p-4 border border-slate-700/60 bg-slate-900/40">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  البيانات النظامية والسجل التجاري
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">السجل التجاري</label>
                    <div className="relative">
                      <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={modal.form.commercialRegistration}
                        onChange={e => setModal({ ...modal, form: { ...modal.form, commercialRegistration: e.target.value.replace(/\D/g, '') } })}
                        className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono"
                        dir="ltr"

                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">الرقم الضريبي</label>
                    <div className="relative">
                      <BadgePercent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={modal.form.vatNumber}
                        onChange={e => setModal({ ...modal, form: { ...modal.form, vatNumber: e.target.value.replace(/\D/g, '') } })}
                        className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono"
                        dir="ltr"

                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">المدينة</label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={modal.form.city}
                        onChange={e => setModal({ ...modal, form: { ...modal.form, city: e.target.value } })}
                        className="w-full px-9 py-2 text-sm glass-input rounded-xl"

                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الجوال / الهاتف</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={modal.form.phone}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono"
                      dir="ltr"

                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={modal.form.email}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono"
                      dir="ltr"

                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان</label>
                <input
                  type="text"
                  value={modal.form.address}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, address: e.target.value } })}
                  className="w-full px-3 py-2 text-sm glass-input rounded-xl"

                />
              </div>

              <div className="rounded-xl p-3.5 border border-slate-700/60 bg-slate-900/40">
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  عملات التعامل (تضمين / توقيف)
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {currencyOptions.map(c => {
                    const included = modal.form.includedCurrencies.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          const includedCurrencies = included
                            ? modal.form.includedCurrencies.filter(code => code !== c.code)
                            : [...modal.form.includedCurrencies, c.code];
                          setModal({ ...modal, form: { ...modal.form, includedCurrencies } });
                        }}
                        className={`inline-flex shrink-0 items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${included
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
                          }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {included
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            : <Power className="w-4 h-4" />}
                          <span className="font-mono font-bold">{c.code}</span>
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${included
                          ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15'
                          : 'text-slate-500 border-slate-700 bg-slate-800/60'
                          }`}>
                          {included ? 'تضمين' : 'توقيف'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">الحساب المحاسبي المرتبط (ذمم موردين) *</label>
                <select
                  value={modal.form.linkedAccountId}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, linkedAccountId: e.target.value } })}
                  className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
                >
                  <option value="">— اختر حساب ذمم موردين —</option>
                  {payablePostingAccounts(accounts, modal.form.linkedAccountId).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.nameAr}</option>
                  ))}
                </select>
                {isLinkedOutOfDomain(accounts, 'PAYABLE', modal.form.linkedAccountId) && (<p className="text-sm text-amber-400 mt-1">
                    الحساب المرتبط حالياً خارج مجموعة ذمم الموردين — اختر حساباً من القائمة أعلاه.
                  </p>)}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات</label>
                <textarea
                  value={modal.form.notes}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })}
                  className="w-full px-3 py-2 text-sm glass-input rounded-xl"
                  rows={2}

                />
              </div>

              <div className="flex items-center gap-3 rounded-xl p-3 border border-slate-700/60 bg-slate-900/40">
                <input
                  type="checkbox"
                  id="ven-active"
                  checked={modal.form.isActive}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked } })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor="ven-active" className="text-sm text-slate-300 font-semibold cursor-pointer">
                  المورد نشط (يقبل المشتريات والعمليات)
                </label>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/70 flex-shrink-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="vendor-form"
                className="px-5 py-2 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-[#ffffff] shadow-lg transition-all cursor-pointer"
              >
                {modal.mode === 'add' ? 'حفظ المورد' : 'حفظ التعديلات'}
              </button>
            </div>
        </ModalShell>
      )}

      {/* نافذة تأكيد الحذف */}
      {deleteTarget && (
        <ModalShell
          id="vendor-delete"
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="حذف المورد"
          icon={Trash2}
          size="sm"
          footer={null}
          closeOnBackdrop={false}
          className="border-red-500/30"
          bodyClassName="p-0"
        >
            <div className="p-6">
              <p className="text-sm text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف المورد <span className="font-bold text-white">{deleteTarget.code} - {deleteTarget.nameAr}</span>؟
              </p>
              <p className="text-xs text-amber-400 mt-2">تنبيه: يُفضل "الإيقاف" بدلاً من الحذف عند وجود ذمم أو حركات مالية على المورد.</p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-lg transition-all cursor-pointer"
                >
                  حذف نهائي
                </button>
              </div>
            </div>
        </ModalShell>
      )}
    </div>
  );
}
