import DateField from '../ui/DateField';
import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  ShieldAlert,
  Briefcase,
  Building2,
  Phone,
  Mail,
  Hash,
  Wallet,
  Calendar,
  CreditCard,
  User,
  HandCoins,
  CheckCircle2,
  Coins,
  Link2
} from 'lucide-react';
import { Account, AccountCurrency, Currency, JournalEntry, Employee, EmployeeGender, Trust } from '../../types/erp';
import { calculateAccountActivity, aggregateAccountBalance, employeeAdvancePostingAccounts, isLinkedOutOfDomain } from '../../utils/accountingEngine';
import { useActiveCurrencies, defaultIncludedCodes } from '../../hooks/useActiveCurrencies';
import { useToast } from '../ui/Toast';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import AmountInput from '../AmountInput';
import ModalShell from '../ui/ModalShell';

interface Props {
  employees: Employee[];
  trusts: Trust[];
  accounts: Account[];
  journals: JournalEntry[];
  currencies: Currency[];
  onAddEmployee: (emp: Omit<Employee, 'id'>) => void;
  onUpdateEmployee: (id: string, updates: Partial<Employee>) => void;
  onDeleteEmployee: (id: string) => void;
}

const GENDER_LABELS: Record<EmployeeGender, string> = {
  MALE: 'ذكر',
  FEMALE: 'أنثى'
};

const GENDER_BADGES: Record<EmployeeGender, string> = {
  MALE: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  FEMALE: 'bg-pink-500/20 text-pink-300 border-pink-500/30'
};

const AVATAR_GRADIENTS = [
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-300 to-sky-500',
  'from-rose-500 to-pink-600'
];

function buildCurrencies(codes: string[]): AccountCurrency[] {
  const ts = Date.now();
  return codes.map((code, i) => ({
    id: `cur-${ts}-${i}`,
    code,
    isDefault: i === 0,
    isActive: true
  }));
}

/** دمج العملات عند تعديل موظف: تضمين/إيقاف مع الحفاظ على السجل (إيقاف بدلاً من الحذف) */
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

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (n: number) => `${fmt(n)} YER`;

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[1][0] || '');
}

function nextEmployeeCode(employees: Employee[]): string {
  const max = employees.reduce((acc, e) => {
    const match = /^EMP-(\d+)$/i.exec((e.code || '').trim());
    const n = match ? parseInt(match[1], 10) : NaN;
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `EMP-${String(max + 1).padStart(3, '0')}`;
}

interface EmployeeForm {
  code: string;
  nameAr: string;
  nameEn: string;
  nationalId: string;
  gender: EmployeeGender;
  jobTitle: string;
  department: string;
  phone: string;
  email: string;
  basicSalary: number;
  hireDate: string;
  iban: string;
  notes: string;
  isActive: boolean;
  linkedAccountId: string;
  includedCurrencies: string[];
}

function emptyForm(code: string, includedCurrencies: string[]): EmployeeForm {
  return {
    code,
    nameAr: '',
    nameEn: '',
    nationalId: '',
    gender: 'MALE',
    jobTitle: '',
    department: '',
    phone: '',
    email: '',
    basicSalary: 0,
    hireDate: new Date().toISOString().split('T')[0],
    iban: '',
    notes: '',
    isActive: true,
    linkedAccountId: '',
    includedCurrencies
  };
}

export default function EmployeesView({ employees, trusts, accounts, journals, currencies, onAddEmployee, onUpdateEmployee, onDeleteEmployee }: Props) {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string; form: EmployeeForm } | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const { options: currencyOptions } = useActiveCurrencies(currencies);
  const defaultCodes = defaultIncludedCodes(currencies);

  const activity = calculateAccountActivity(accounts, journals);

  const openTrustsCount = (emp: Employee): number =>
    trusts.filter(t =>
      (t.status === 'OPEN' || t.status === 'PARTIAL') &&
      t.employeeName.trim() === emp.nameAr.trim()
    ).length;

  const linkedAccountName = (id?: string): string => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? `${acc.code} - ${acc.nameAr}` : '—';
  };

  const linkedAccountBalance = (id?: string): number | null => {
    if (!id) return null;
    const acc = accounts.find(a => a.id === id);
    if (!acc) return null;
    return aggregateAccountBalance(acc, accounts, activity);
  };

  const employeeAdvanceAccounts = (currentLinkedId?: string): Account[] =>
    employeeAdvancePostingAccounts(accounts, currentLinkedId);

  const filtered = employees.filter(e => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      e.code.toLowerCase().includes(term) ||
      e.nameAr.includes(searchTerm.trim()) ||
      e.nameEn.toLowerCase().includes(term) ||
      e.nationalId.includes(searchTerm.trim()) ||
      e.jobTitle.includes(searchTerm.trim()) ||
      e.department.includes(searchTerm.trim()) ||
      e.phone.includes(searchTerm.trim())
    );
  });

  const activeCount = employees.filter(e => e.isActive).length;
  const totalSalaries = employees.reduce((s, e) => s + e.basicSalary, 0);
  const departmentsCount = new Set(employees.map(e => e.department.trim()).filter(Boolean)).size;

  const openAdd = () => {
    setFormError('');
    setModal({ mode: 'add', form: emptyForm(nextEmployeeCode(employees), defaultCodes) });
  };

  const openEdit = (emp: Employee) => {
    setFormError('');
    setModal({
      mode: 'edit',
      id: emp.id,
      form: {
        code: emp.code,
        nameAr: emp.nameAr,
        nameEn: emp.nameEn,
        nationalId: emp.nationalId,
        gender: emp.gender,
        jobTitle: emp.jobTitle,
        department: emp.department,
        phone: emp.phone,
        email: emp.email,
        basicSalary: emp.basicSalary,
        hireDate: emp.hireDate,
        iban: emp.iban,
        notes: emp.notes || '',
        isActive: emp.isActive,
        linkedAccountId: emp.linkedAccountId || '',
        includedCurrencies: (emp.currencies || []).filter(c => c.isActive).map(c => c.code)
      }
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const f = modal.form;
    const entityCode = f.code.trim();
    if (!entityCode) {
      setFormError('كود الموظف مطلوب.');
      return;
    }
    if (!f.nameAr.trim()) {
      setFormError('الاسم الكامل بالعربية مطلوب.');
      return;
    }
    if (f.nationalId.trim() && !/^\d{8,10}$/.test(f.nationalId.trim())) {
      setFormError('رقم الهوية يجب أن يتكون من أرقام فقط (8 إلى 10 خانات).');
      return;
    }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      setFormError('صيغة البريد الإلكتروني غير صحيحة.');
      return;
    }
    if (f.includedCurrencies.length === 0) {
      setFormError('يجب تضمين عملة واحدة على الأقل لراتب الموظف.');
      return;
    }
    if (modal.mode === 'add') {
      if (!f.linkedAccountId) {
        setFormError('يجب ربط الموظف بحساب سلف الموظفين الشهرية من دليل الحسابات.');
        return;
      }
      if (employees.some(e => e.code.toLowerCase() === entityCode.toLowerCase())) {
        setFormError(`كود الموظف ${entityCode} مستخدم مسبقاً — لا يمكن تكرار الكود.`);
        return;
      }
      if (f.nationalId.trim() && employees.some(e => e.nationalId === f.nationalId.trim())) {
        setFormError('رقم الهوية مسجل مسبقاً لموظف آخر.');
        return;
      }
      try {
        onAddEmployee({
        code: entityCode,
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        nationalId: f.nationalId.trim(),
        gender: f.gender,
        jobTitle: f.jobTitle.trim(),
        department: f.department.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        basicSalary: Number(f.basicSalary) || 0,
        hireDate: f.hireDate,
        iban: f.iban.trim(),
        notes: f.notes.trim(),
        isActive: f.isActive,
        linkedAccountId: f.linkedAccountId,
        currencies: buildCurrencies(f.includedCurrencies),
        defaultCurrency: f.includedCurrencies[0] || 'YER',
        createdAt: new Date().toISOString().substring(0, 10)
        });
        toast('success', `تمت إضافة الموظف ${entityCode} - ${f.nameAr.trim()}`);
      } catch (err) {
        console.error('EmployeesView: فشل حفظ الموظف', err);
        setFormError('تعذر حفظ الموظف — يرجى المحاولة مرة أخرى، وإذا استمرت المشكلة راجع وحدة التحكم.');
        toast('error', 'تعذر حفظ الموظف — حدث خطأ أثناء الحفظ.');
        return;
      }
    } else if (modal.id) {
      if (f.nationalId.trim() && employees.some(e => e.id !== modal.id && e.nationalId === f.nationalId.trim())) {
        setFormError('رقم الهوية مسجل مسبقاً لموظف آخر.');
        return;
      }
      const editing = employees.find(e => e.id === modal.id);
      try {
        onUpdateEmployee(modal.id, {
        code: entityCode,
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        nationalId: f.nationalId.trim(),
        gender: f.gender,
        jobTitle: f.jobTitle.trim(),
        department: f.department.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        basicSalary: Number(f.basicSalary) || 0,
        hireDate: f.hireDate,
        iban: f.iban.trim(),
        notes: f.notes.trim(),
        isActive: f.isActive,
        linkedAccountId: f.linkedAccountId || undefined,
        currencies: mergeCurrencies(editing?.currencies || [], f.includedCurrencies),
        defaultCurrency: f.includedCurrencies[0] || editing?.defaultCurrency || 'YER'
        });
        toast('success', `تم تحديث بيانات الموظف ${entityCode}`);
      } catch (err) {
        console.error('EmployeesView: فشل تحديث الموظف', err);
        setFormError('تعذر تحديث بيانات الموظف — يرجى المحاولة مرة أخرى.');
        toast('error', 'تعذر تحديث بيانات الموظف — حدث خطأ أثناء الحفظ.');
        return;
      }
    }
    setModal(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteEmployee(deleteTarget.id);
    toast('success', `تم حذف الموظف ${deleteTarget.code} - ${deleteTarget.nameAr}`);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Users className="w-6 h-6" />}
        title="بيانات الموظفين"
        subtitle="إدارة سجل الموظفين — بيانات الهوية والوظيفة والراتب وربطهم بسلف الموظفين الشهرية"
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            إضافة موظف جديد
          </button>
        }
      />

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">إجمالي الموظفين</div>
          <div className="text-2xl font-black text-white mt-1">{employees.length}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">موظفون نشطون</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">إجمالي الرواتب الشهرية</div>
          <div className="text-2xl font-black gradient-text mt-1">{fmtCurrency(totalSalaries)}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">الأقسام</div>
          <div className="text-2xl font-black text-sky-400 mt-1">{departmentsCount}</div>
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
              { label: 'الكود', render: (e: Employee) => <span className="font-mono font-bold text-sky-400">{e.code}</span> },
              {
                label: 'الاسم', render: (e: Employee) => (
                  <div>
                    <div className="font-bold text-white">{e.nameAr}</div>
                    <div className="text-xs text-slate-400 font-mono">{e.nameEn || '—'}</div>
                  </div>
                )
              },
              {
                label: 'الوظيفة / القسم', render: (e: Employee) => (
                  <div>
                    <div className="text-slate-200">{e.jobTitle || '—'}</div>
                    <div className="text-xs text-slate-400">{e.department || '—'}</div>
                  </div>
                )
              },
              { label: 'الجوال', render: (e: Employee) => <span className="font-mono text-slate-300" dir="ltr">{e.phone || '—'}</span> }
            ]}
            searchText={e => `${e.code} ${e.nameAr} ${e.nameEn} ${e.nationalId} ${e.jobTitle} ${e.department} ${e.phone}`}
            browseTitle="استعراض الموظفين"
          />
        </div>
      </div>

      {/* القائمة */}
      <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1520px]">
            {filtered.map((emp, idx) => (
              <div key={emp.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-white/5 transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
                <div className="w-12 flex-shrink-0 flex items-center justify-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-xs font-bold">
                    {employees.indexOf(emp) + 1}
                  </span>
                </div>
                <div className="flex items-center gap-3 w-80 flex-shrink-0 min-w-0">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]} text-white flex items-center justify-center font-black text-sm shadow-lg flex-shrink-0`}>
                    {initials(emp.nameAr)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400 text-sm">{emp.code}</span>
                      <span className="font-bold text-white truncate block">{emp.nameAr}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono whitespace-nowrap">{emp.nameEn || '—'}</div>
                  </div>
                </div>

                <div className="w-36 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{emp.jobTitle || '—'}</span>
                </div>

                <div className="w-32 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{emp.department || '—'}</span>
                </div>

                <div className="w-28 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0" dir="ltr">
                  <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate">{emp.nationalId || '—'}</span>
                </div>

                <div className="w-32 flex items-center gap-1 text-xs text-slate-400 flex-shrink-0" dir="ltr">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate">{emp.phone || '—'}</span>
                </div>

                <div className="w-32 flex-shrink-0">
                  <div className="text-xs text-slate-500">الراتب الأساسي</div>
                  <div className="font-mono font-bold text-white text-sm">{fmt(emp.basicSalary)} <span className="text-slate-400 text-xs">{emp.defaultCurrency || 'YER'}</span></div>
                </div>

                <div className="w-40 flex-shrink-0">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-400" />
                    العملات (تضمين / توقيف)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {(emp.currencies && emp.currencies.length > 0 ? emp.currencies.filter(c => c.isActive) : [{ id: `cur-def-${emp.defaultCurrency || 'YER'}`, code: emp.defaultCurrency || 'YER', isDefault: true, isActive: true } as AccountCurrency]).map(c => (
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

                <div className="w-28 flex-shrink-0">
                  <div className="text-xs text-slate-500">العهد المفتوحة</div>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${openTrustsCount(emp) > 0
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    <HandCoins className="w-3 h-3" />
                    {openTrustsCount(emp)}
                  </span>
                </div>

                <div className="w-48 flex-shrink-0">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-sky-400" />
                    حساب السلفة المرتبط
                  </div>
                  {emp.linkedAccountId ? (
                    <>
                      <div className="text-xs text-sky-300 truncate font-mono" dir="ltr">{linkedAccountName(emp.linkedAccountId)}</div>
                      <div className="font-mono text-xs text-emerald-400">{fmt(linkedAccountBalance(emp.linkedAccountId) || 0)} <span className="text-slate-500">رصيد</span></div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">—</div>
                  )}
                </div>

                <div className="w-16 flex flex-shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${GENDER_BADGES[emp.gender]}`}>
                    {GENDER_LABELS[emp.gender]}
                  </span>
                </div>

                <div className="w-20 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${emp.isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                    <Power className="w-3 h-3" />
                    {emp.isActive ? 'نشط' : 'موقوف'}
                  </span>
                </div>

                <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(emp)}
                    title="تعديل بيانات الموظف"
                    className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(emp)}
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
                  <Users className="w-10 h-10 text-slate-600" />
                  <p className="font-bold text-white">لا يوجد موظفون مطابقون</p>
                  <p className="text-sm">جرّب تغيير نص البحث أو أضف موظفاً جديداً</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نافذة الإضافة / التعديل */}
      {modal && (
        <ModalShell
          id="employee-form"
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal.mode === 'add' ? 'إضافة موظف جديد' : 'تعديل بيانات الموظف'}
          icon={Users}
          size="lg"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
        >

            <form id="employee-form" onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {formError && (
                <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">كود الموظف (تلقائي)</label>
                  <div className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900/60 border border-slate-700/60 font-mono font-bold text-sky-400 text-center" dir="ltr">
                    {modal.form.code || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">الجنس</label>
                  <select
                    value={modal.form.gender}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, gender: e.target.value as EmployeeGender } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
                  >
                    <option value="MALE">ذكر</option>
                    <option value="FEMALE">أنثى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهوية / الإقامة</label>
                  <input
                    type="text"
                    value={modal.form.nationalId}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nationalId: e.target.value.replace(/\D/g, '') } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
                    dir="ltr"

                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">الاسم الكامل بالعربية *</label>
                  <input
                    type="text"
                    required
                    value={modal.form.nameAr}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nameAr: e.target.value } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl"

                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    value={modal.form.nameEn}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nameEn: e.target.value } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
                    dir="ltr"

                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">المسمى الوظيفي</label>
                  <div className="relative">
                    <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={modal.form.jobTitle}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, jobTitle: e.target.value } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl"

                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">القسم / الإدارة</label>
                  <div className="relative">
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={modal.form.department}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, department: e.target.value } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl"

                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الجوال</label>
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">الراتب الأساسي</label>
                  <div className="relative">
                    <Wallet className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <AmountInput
                      value={modal.form.basicSalary}
                      onChange={v => setModal({ ...modal, form: { ...modal.form, basicSalary: Number(v) } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">تاريخ التعيين</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <DateField

                      value={modal.form.hireDate}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, hireDate: e.target.value } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الآيبان (تحويل الراتب)</label>
                  <div className="relative">
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={modal.form.iban}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, iban: e.target.value } })}
                      className="w-full px-9 py-2 text-sm glass-input rounded-xl font-mono uppercase"
                      dir="ltr"

                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-3.5 border border-slate-700/60 bg-slate-900/40">
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  عملات الراتب (تضمين / توقيف)
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات</label>
                <textarea
                  value={modal.form.notes}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })}
                  className="w-full px-3 py-2 text-sm glass-input rounded-xl"
                  rows={2}

                />
              </div>

              {/* حساب الربط المحاسبي — سلف الموظفين الشهرية */}
              <div className="rounded-xl p-3.5 border border-slate-700/60 bg-slate-900/40">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-sky-400" />
                  حساب سلف الموظفين الشهرية *
                </label>
                <select
                  required
                  value={modal.form.linkedAccountId}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, linkedAccountId: e.target.value } })}
                  className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white font-mono"
                  dir="ltr"
                >
                  <option value="">— اختر حساب السلفة —</option>
                  {employeeAdvanceAccounts(modal.form.linkedAccountId).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.nameAr}</option>
                  ))}
                </select>
                {isLinkedOutOfDomain(accounts, 'EMPLOYEE_ADVANCE', modal.form.linkedAccountId) && (<p className="text-xs text-amber-400 mt-1">
                    الحساب المرتبط حالياً خارج مجموعة سلف الموظفين الشهرية — اختر حساباً من القائمة أعلاه.
                  </p>)}
              </div>

              <div className="flex items-center gap-3 rounded-xl p-3 border border-slate-700/60 bg-slate-900/40">
                <input
                  type="checkbox"
                  id="emp-active"
                  checked={modal.form.isActive}
                  onChange={e => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked } })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor="emp-active" className="text-sm text-slate-300 font-semibold cursor-pointer">
                  الموظف نشط (يقبل تكليفه بالعهد)
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
                form="employee-form"
                className="px-5 py-2 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-[#ffffff] shadow-lg transition-all cursor-pointer"
              >
                {modal.mode === 'add' ? 'حفظ الموظف' : 'حفظ التعديلات'}
              </button>
            </div>
        </ModalShell>
      )}

      {/* نافذة تأكيد الحذف */}
      {deleteTarget && (
        <ModalShell
          id="employee-delete"
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="حذف الموظف"
          icon={Trash2}
          size="sm"
          footer={null}
          closeOnBackdrop={false}
          className="border-red-500/30"
          bodyClassName="p-0"
        >
            <div className="p-6">
              <p className="text-sm text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف الموظف <span className="font-bold text-white">{deleteTarget.code} - {deleteTarget.nameAr}</span>؟
              </p>
              <p className="text-xs text-amber-400 mt-2">تنبيه: يُفضل "الإيقاف" بدلاً من الحذف عند وجود عهد مرتبطة بالموظف.</p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
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
