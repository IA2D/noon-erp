import React, { useState } from 'react';
import {
  Building2,
  Save,
  Plus,
  Pencil,
  X,
  Trash2,
  Upload,
  ImageOff,
  Shield,
  CheckCircle2,
  Mail,
  Globe,
  Phone,
  FolderOpen,
  MapPin,
  UserPlus,
  UserCheck,
  Landmark
} from 'lucide-react';
import { CompanyBranch } from '../../types/erp';
import { ROLES } from '../../constants/permissions';
import { useToast } from '../ui/Toast';
import { loadBranchesLocal, saveBranchesLocal, emptyCompanyBranch } from '../../utils/companyStore';
import ModalShell from '../ui/ModalShell';

interface Props {
  currentUserName: string;
  initialTab?: TabId;
}

type TabId = 'basic' | 'contact' | 'roles';

const YEARS = (() => {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 2; y <= current + 5; y++) years.push(y);
  return years;
})();

function fmtDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function CompanySettingsView({ currentUserName, initialTab = 'basic' }: Props) {
  const toast = useToast();
  const [branches, setBranches] = useState<CompanyBranch[]>(() => loadBranchesLocal());
  const [activeId, setActiveId] = useState<string>(() => loadBranchesLocal()[0]?.id ?? '');
  const [formData, setFormData] = useState<CompanyBranch>(() => loadBranchesLocal()[0] ?? emptyCompanyBranch());
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view');
  const [tab, setTab] = useState<TabId>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = mode === 'edit' || mode === 'new';
  const isNew = mode === 'new';

  const setField = <K extends keyof CompanyBranch>(key: K, value: CompanyBranch[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const selectBranch = (id: string) => {
    const branch = branches.find(b => b.id === id);
    if (!branch) return;
    setActiveId(id);
    setFormData(branch);
    setMode('view');
    setErrors({});
  };

  const startNew = () => {
    setActiveId('');
    setFormData(emptyCompanyBranch());
    setMode('new');
    setTab('basic');
    setErrors({});
  };

  const startEdit = () => {
    setMode('edit');
    setErrors({});
  };

  const cancel = () => {
    const branch = branches.find(b => b.id === activeId);
    if (branch) {
      setFormData(branch);
    } else if (branches[0]) {
      setActiveId(branches[0].id);
      setFormData(branches[0]);
    } else {
      setFormData(emptyCompanyBranch());
    }
    setMode('view');
    setErrors({});
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!formData.companyNameAr.trim()) errs.companyNameAr = 'اسم الشركة مطلوب';
    if (!formData.companyCode.trim()) errs.companyCode = 'كود الشركة مطلوب';
    if (!formData.branchCode.trim()) errs.branchCode = 'كود الفرع مطلوب';
    if (!formData.taxNumber.trim()) errs.taxNumber = 'الرقم الضريبي مطلوب';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTab('basic');
      toast('error', 'يرجى تعبئة الحقول الإجبارية قبل الحفظ');
      return;
    }

    const now = new Date().toISOString();
    const saved: CompanyBranch = isNew
      ? { ...formData, id: `br-${Date.now()}`, createdBy: currentUserName, createdAt: now, updatedBy: null, updatedAt: null }
      : { ...formData, updatedBy: currentUserName, updatedAt: now };

    const next = isNew ? [...branches, saved] : branches.map(b => (b.id === saved.id ? saved : b));
    saveBranchesLocal(next);
    setBranches(next);
    setActiveId(saved.id);
    setFormData(saved);
    setMode('view');
    setErrors({});
    toast('success', isNew ? `تم إنشاء الفرع ${saved.branchCode} بنجاح` : `تم حفظ بيانات الفرع ${saved.branchCode} بنجاح`);
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    if (branches.length <= 1) {
      toast('error', 'لا يمكن حذف آخر فرع في النظام');
      return;
    }
    const target = branches.find(b => b.id === activeId);
    const next = branches.filter(b => b.id !== activeId);
    saveBranchesLocal(next);
    setBranches(next);
    const first = next[0];
    setActiveId(first.id);
    setFormData(first);
    setMode('view');
    setErrors({});
    toast('success', target ? `تم حذف الفرع ${target.branchCode}` : 'تم حذف الفرع');
  };

  const toggleRole = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      allowedRoles: prev.allowedRoles.includes(roleId)
        ? prev.allowedRoles.filter(r => r !== roleId)
        : [...prev.allowedRoles, roleId]
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('error', 'حجم الصورة كبير — الحد الأقصى 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField('logoUrl', String(reader.result || ''));
    reader.onerror = () => toast('error', 'تعذر قراءة الصورة');
    reader.readAsDataURL(file);
  };

  const labelCls = 'block text-sm font-semibold text-slate-200 mb-2';
  const inputCls = (err?: string) =>
    `w-full glass-input rounded-xl px-4 py-3 text-sm bg-slate-900 text-slate-50 border border-slate-700 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed ${err ? 'border-red-500/70' : ''}`;
  const textareaCls = (err?: string) =>
    `w-full glass-input rounded-xl px-4 py-3 text-sm min-h-[92px] bg-slate-900 text-slate-50 border border-slate-700 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed ${err ? 'border-red-500/70' : ''}`;
  const errCls = 'text-xs text-red-600 mt-1.5 font-medium';

  const FieldError = ({ field }: { field: string }) => (errors[field] ? <p className={errCls}>{errors[field]}</p> : null);

  const SectionHead = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) => (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 bg-sky-500/15 rounded-xl">{icon}</div>
      <div>
        <h3 className="font-bold text-slate-50">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );

  const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'basic', label: 'بيانات الفرع والشركة', icon: Building2 },
    { id: 'contact', label: 'الاتصال والعناوين', icon: Globe },
    { id: 'roles', label: 'الصلاحيات والربط', icon: Shield }
  ];

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-sm overflow-hidden">
      {/* Toolbar: مبدّل الفروع + أزرار الإجراءات */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Landmark className="w-5 h-5 text-sky-400 shrink-0" />
          <select
            value={isNew ? '__new__' : activeId}
            onChange={e => (e.target.value === '__new__' ? startNew() : selectBranch(e.target.value))}
            className="glass-input rounded-xl px-4 py-2.5 text-sm bg-slate-900 text-slate-50 border border-slate-700 flex-1 min-w-0"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.branchCode} - {b.branchNameAr}
              </option>
            ))}
            <option value="__new__">＋ إضافة فرع جديد</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3.5 py-2.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            جديد
          </button>

          {!isNew && mode === 'view' && (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              تعديل
            </button>
          )}

          {isEditing && (
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2.5 text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              حفظ
            </button>
          )}

          {isEditing && (
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>
          )}

          {!isNew && mode === 'view' && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-500/15 px-3.5 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </button>
          )}
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex items-center gap-1.5 px-4 pt-4 border-b border-slate-800">
        {TABS.map(tabDef => {
          const TabIcon = tabDef.icon;
          const active = tab === tabDef.id;
          return (
            <button
              key={tabDef.id}
              type="button"
              onClick={() => setTab(tabDef.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-colors cursor-pointer border-b-2 ${
                active
                  ? 'bg-sky-500/15 text-sky-400 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tabDef.label}
            </button>
          );
        })}
      </div>

      {/* المحتوى */}
      <div className="p-5 space-y-6">
        {tab === 'basic' && (
          <>
            <section>
              <SectionHead icon={<Landmark className="w-5 h-5 text-sky-400" />} title="معلومات الهوية" subtitle="كود الشركة والفرع والسنة المالية والرقم الضريبي" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>كود الشركة</label>
                  <input type="text" value={formData.companyCode} disabled={!isEditing} onChange={e => setField('companyCode', e.target.value)} className={inputCls(errors.companyCode)} />
                  <FieldError field="companyCode" />
                </div>
                <div>
                  <label className={labelCls}>كود الفرع</label>
                  <input type="text" value={formData.branchCode} disabled={!isEditing} onChange={e => setField('branchCode', e.target.value)} className={inputCls(errors.branchCode)} />
                  <FieldError field="branchCode" />
                </div>
                <div>
                  <label className={labelCls}>السنة المالية</label>
                  <select value={formData.fiscalYear} disabled={!isEditing} onChange={e => setField('fiscalYear', e.target.value)} className={inputCls()}>
                    {YEARS.map(y => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>الرقم الضريبي</label>
                  <input type="text" value={formData.taxNumber} disabled={!isEditing} onChange={e => setField('taxNumber', e.target.value)} className={inputCls(errors.taxNumber)} />
                  <FieldError field="taxNumber" />
                </div>
              </div>
            </section>

            <section>
              <SectionHead icon={<Building2 className="w-5 h-5 text-sky-400" />} title="التعريب واللغات" subtitle="أسماء الشركة والفرع بالعربية والإنجليزية" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>اسم الشركة (عربي)</label>
                  <input type="text" value={formData.companyNameAr} disabled={!isEditing} onChange={e => setField('companyNameAr', e.target.value)} className={inputCls(errors.companyNameAr)} />
                  <FieldError field="companyNameAr" />
                </div>
                <div>
                  <label className={labelCls}>اسم الشركة (إنجليزي)</label>
                  <input type="text" value={formData.companyNameEn} disabled={!isEditing} onChange={e => setField('companyNameEn', e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className={labelCls}>اسم الفرع (عربي)</label>
                  <input type="text" value={formData.branchNameAr} disabled={!isEditing} onChange={e => setField('branchNameAr', e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className={labelCls}>اسم الفرع (إنجليزي)</label>
                  <input type="text" value={formData.branchNameEn} disabled={!isEditing} onChange={e => setField('branchNameEn', e.target.value)} className={inputCls()} />
                </div>
              </div>
            </section>

            <section>
              <SectionHead icon={<ImageOff className="w-5 h-5 text-sky-400" />} title="شعار الشركة / الفرع" subtitle="يُستخدم في هيدر التقارير والفواتير" />
              <div className="border-2 border-dashed border-slate-600/60 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
                <div className="w-28 h-28 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-slate-50">{formData.logoUrl ? 'تم رفع الشعار' : 'لا يوجد شعار'}</p>
                  <p className="text-xs text-slate-400 mt-1 mb-3">صيغ PNG / JPG حتى 2MB — معاينة فورية قبل الحفظ</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <Upload className="w-4 h-4" />
                      {formData.logoUrl ? 'استبدال الشعار' : 'رفع الشعار'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={!isEditing} onChange={handleLogoUpload} />
                    </label>
                    {formData.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setField('logoUrl', '')}
                        disabled={!isEditing}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-500/15 px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف الشعار
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === 'contact' && (
          <>
            <section>
              <SectionHead icon={<Globe className="w-5 h-5 text-sky-400" />} title="بيانات الاتصال" subtitle="الهاتف والفاكس والبريد الإلكتروني والموقع" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>الهاتف</label>
                  <input type="tel" value={formData.phone} disabled={!isEditing} onChange={e => setField('phone', e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className={labelCls}>الفاكس</label>
                  <input type="tel" value={formData.fax} disabled={!isEditing} onChange={e => setField('fax', e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className={labelCls}>البريد الإلكتروني</label>
                  <input type="email" value={formData.email} disabled={!isEditing} onChange={e => setField('email', e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className={labelCls}>الموقع الإلكتروني</label>
                  <input type="url" value={formData.website} disabled={!isEditing} onChange={e => setField('website', e.target.value)} className={inputCls()} />
                </div>
              </div>
            </section>

            <section>
              <SectionHead icon={<MapPin className="w-5 h-5 text-sky-400" />} title="العناوين" subtitle="العنوان التفصيلي للفرع بالعربية والإنجليزية" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>العنوان (عربي)</label>
                  <textarea value={formData.addressAr} disabled={!isEditing} onChange={e => setField('addressAr', e.target.value)} className={textareaCls()} />
                </div>
                <div>
                  <label className={labelCls}>العنوان (إنجليزي)</label>
                  <textarea value={formData.addressEn} disabled={!isEditing} onChange={e => setField('addressEn', e.target.value)} className={textareaCls()} />
                </div>
              </div>
            </section>

            <section>
              <SectionHead icon={<FolderOpen className="w-5 h-5 text-sky-400" />} title="مسار الحفظ / التصدير" subtitle="إعدادات التخزين والتصدير للتقارير والفواتير" />
              <div>
                <label className={labelCls}>مسار الحفظ الافتراضي</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={formData.exportPath} disabled={!isEditing} onChange={e => setField('exportPath', e.target.value)} className={inputCls()} />
                </div>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  يُستخدم كمسار افتراضي عند تصدير التقارير وملفات الفواتير.
                </p>
              </div>
            </section>
          </>
        )}

        {tab === 'roles' && (
          <section>
            <SectionHead icon={<Shield className="w-5 h-5 text-sky-400" />} title="الصلاحيات والربط" subtitle="الأدوار المصرح لها بالدخول والعمل على هذا الفرع" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(ROLES).map(([roleId, role]) => {
                const checked = formData.allowedRoles.includes(roleId);
                return (
                  <button
                    key={roleId}
                    type="button"
                    disabled={!isEditing}
                    onClick={() => toggleRole(roleId)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-right transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      checked ? 'bg-sky-500/15 border-sky-500/40' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${checked ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-50">{role.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{role.description}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        checked ? 'bg-blue-600 border-blue-600' : 'border-slate-700'
                      }`}
                    >
                      {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              اختيار الأدوار المصرح لها — الأدوار غير المحددة لن تتمكن من الوصول لبيانات هذا الفرع.
            </p>
          </section>
        )}
      </div>

      {/* شريط التدقيق (Audit Trail) */}
      <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-2 min-w-0">
          <UserPlus className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            أُدخل بواسطة: <b className="text-slate-200 font-semibold">{formData.createdBy || '—'}</b>
          </span>
          <span className="text-slate-400">·</span>
          <span className="truncate">{fmtDate(formData.createdAt)}</span>
        </div>
        <span className="hidden sm:block text-slate-400">|</span>
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            آخر تعديل: <b className="text-slate-200 font-semibold">{formData.updatedBy || '—'}</b>
          </span>
          <span className="text-slate-400">·</span>
          <span className="truncate">{fmtDate(formData.updatedAt)}</span>
        </div>
      </div>

      {/* تأكيد الحذف */}
      {confirmDelete && (
        <ModalShell
          id="company-settings-delete"
          open={!!confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="تأكيد حذف الفرع"
          icon={Trash2}
          size="sm"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
        >
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-200 leading-relaxed">
                هل أنت متأكد من حذف الفرع <b className="text-slate-50">{formData.branchCode} - {formData.branchNameAr}</b>؟ سيتم إزالته نهائياً من بيانات النظام.
              </p>
              <p className="text-xs text-amber-400 bg-amber-500/15 border border-amber-500/40 rounded-xl p-3">لا يمكن التراجع عن هذه العملية.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-slate-300 hover:bg-slate-800 rounded-xl text-sm font-medium cursor-pointer">
                  إلغاء
                </button>
                <button onClick={handleDelete} className="px-5 py-2 bg-red-500/150 hover:bg-red-400 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer">
                  نعم، احذف الفرع
                </button>
              </div>
            </div>
        </ModalShell>
      )}
    </div>
  );
}
