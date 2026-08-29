import React, { useRef, useState } from 'react';
import {
  Settings,
  SlidersHorizontal,
  Building2,
  Coins,
  Shield,
  Database,
  Palette,
  Save,
  RotateCw,
  Download,
  Upload,
  CheckCircle2,
  ImageOff,
  Trash2,
  Clock,
  Hash,
  KeyRound,
  ShieldCheck,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { useTheme } from '../../utils/useTheme';
import { Currency, CompanyBranch } from '../../types/erp';
import ModalShell from '../ui/ModalShell';
import { DEFAULT_COMPANY_BRANCH, loadBranchesLocal, saveBranchesLocal } from '../../utils/companyStore';
import {
  clearLegacyPersistentEntries,
  getPersistentEntries,
  getPersistentItem,
  getPersistentStorageReport,
  replacePersistentEntries,
  setPersistentItem,
  type PersistentRestoreResult,
} from '../../utils/desktopStorage';

const SETTINGS_KEY = 'elite-erp-settings-v6';

interface SettingsState {
  companyName: string;
  backupFrequency: string;
  activityLogging: boolean;
  costCenterMandatory: boolean;
  sessionTimeout: string;
  decimalPlaces: string;
  showRefreshButton: boolean;
  attachmentRequirementsJson: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  companyName: 'شركة سبأ للمقاولات',
  backupFrequency: 'daily',
  activityLogging: true,
  costCenterMandatory: false,
  sessionTimeout: '30',
  decimalPlaces: '2',
  showRefreshButton: true,
  attachmentRequirementsJson: '[]',
};

interface IdentityState {
  companyNameAr: string;
  companyNameEn: string;
  phone: string;
  fax: string;
  addressAr: string;
  addressEn: string;
  logoUrl: string;
}

type SettingsTab = 'company' | 'financial' | 'security' | 'data' | 'appearance';

interface Props {
  currentUserName?: string;
  currencies?: Currency[];
  onPasswordChanged?: () => void;
}

const DECIMAL_OPTIONS = [0, 1, 2, 3, 4];

const SESSION_TIMEOUTS = [
  { value: '15', label: '15 دقيقة' },
  { value: '30', label: '30 دقيقة' },
  { value: '60', label: 'ساعة واحدة' },
  { value: '480', label: '8 ساعات' },
];

const SettingsWindow = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg shadow-black/25">
    <div className="p-5 lg:p-6">{children}</div>
  </section>
);

const Switch = ({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
      checked ? 'bg-sky-500' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-[20px] rtl:-translate-x-[20px]' : 'translate-x-[2px] rtl:-translate-x-[2px]'
      }`}
    />
  </button>
);

const ToggleRow = ({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
    </div>
    <Switch checked={checked} onChange={onChange} />
  </div>
);

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType; iconClass: string; description: string; meta: string }> = [
  { id: 'company', label: 'هوية المنشأة والطباعة', icon: Building2, iconClass: 'bg-sky-500/20 text-sky-400', description: 'الشعار وبيانات الشركة الرسمية وترويسة التقارير والسندات', meta: 'الهوية الرسمية' },
  { id: 'financial', label: 'الإعدادات المالية والعملات', icon: Coins, iconClass: 'bg-emerald-500/20 text-emerald-400', description: 'السنة المالية والعملة الأساسية ودقة الأرقام وإلزامية مراكز التكلفة', meta: 'الضبط المالي' },
  { id: 'security', label: 'الأمان وتدقيق العمليات', icon: Shield, iconClass: 'bg-amber-500/20 text-amber-400', description: 'حماية النظام وسجل التدقيق وسياسات الأمان ومنع تعديل القيود المرحلة', meta: 'الحماية والرقابة' },
  { id: 'data', label: 'حفظ واستعادة بيانات المنشأة', icon: Database, iconClass: 'bg-sky-500/20 text-sky-400', description: 'أخذ نسخة آمنة من بياناتك المالية واسترجاعها في أي وقت', meta: 'إدارة البيانات' },
  { id: 'appearance', label: 'الواجهة والمظهر', icon: Palette, iconClass: 'bg-pink-500/20 text-pink-400', description: 'الوضع الليلي والنهاري وتخصيص شكل الواجهة', meta: 'المظهر' },
];

function loadSettings(): SettingsState {
  try {
    const stored = getPersistentItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const supported = Object.fromEntries(
        Object.keys(DEFAULT_SETTINGS).filter(key => Object.prototype.hasOwnProperty.call(parsed, key)).map(key => [key, parsed[key]])
      );
      return { ...DEFAULT_SETTINGS, ...supported } as SettingsState;
    }
  } catch {
    // تجاهل الإعدادات التالفة
  }
  return DEFAULT_SETTINGS;
}

function loadIdentity(): IdentityState {
  const b = loadBranchesLocal()[0];
  return {
    companyNameAr: b?.companyNameAr ?? '',
    companyNameEn: b?.companyNameEn ?? '',
    phone: b?.phone ?? '',
    fax: b?.fax ?? '',
    addressAr: b?.addressAr ?? '',
    addressEn: b?.addressEn ?? '',
    logoUrl: b?.logoUrl ?? '',
  };
}

interface FullerpBackupEnvelope {
  __fullerpBackup: true;
  format: 'fullerp-sqlite-kv';
  formatVersion: 2;
  exportedAt: string;
  source: ReturnType<typeof getPersistentStorageReport>;
  data: Record<string, unknown>;
}

function collectBackupData(settings: SettingsState): FullerpBackupEnvelope {
  const data: Record<string, unknown> = {};
  getPersistentEntries().forEach(([key, value]) => {
    try {
      data[key] = JSON.parse(value);
    } catch {
      data[key] = value;
    }
  });
  data[SETTINGS_KEY] = settings;
  const themeVal = window.localStorage.getItem('theme');
  if (themeVal !== null) data['theme'] = themeVal;
  return {
    __fullerpBackup: true,
    format: 'fullerp-sqlite-kv',
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    source: getPersistentStorageReport(),
    data,
  };
}

function backupPayloadData(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.data;
  if ((payload.__fullerpBackup === true || payload.__emergencyBackup === true) && nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

export default function SettingsView({ currentUserName = 'مستخدم', onPasswordChanged }: Props) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [identity, setIdentity] = useState<IdentityState>(loadIdentity);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('company');
  const [activeModal, setActiveModal] = useState<SettingsTab | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Record<string, unknown> | null>(null);
  const [storageReport, setStorageReport] = useState(getPersistentStorageReport);
  const [lastRestore, setLastRestore] = useState<PersistentRestoreResult | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { t, lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;
  const activeDef = TABS.find(t => t.id === activeModal);
  const { theme, setTheme } = useTheme();

  const set = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const setIdentityField = <K extends keyof IdentityState>(key: K, value: IdentityState[K]) => {
    setIdentity(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    try {
      if (window.desktopStore) {
        const configured = window.desktopStore.configureSecurity({ sessionTimeoutMinutes: Number(settings.sessionTimeout) });
        if (!configured.ok) throw new Error(configured.error || 'SESSION_TIMEOUT_INVALID');
      }
      setPersistentItem(SETTINGS_KEY, JSON.stringify(settings));

      const branches = loadBranchesLocal();
      const main: CompanyBranch = branches[0] ?? { ...DEFAULT_COMPANY_BRANCH, id: 'br-main' };
      const updated: CompanyBranch = {
        ...main,
        companyNameAr: identity.companyNameAr,
        companyNameEn: identity.companyNameEn,
        phone: identity.phone,
        fax: identity.fax,
        addressAr: identity.addressAr,
        addressEn: identity.addressEn,
        logoUrl: identity.logoUrl,
        updatedBy: currentUserName,
        updatedAt: new Date().toISOString(),
      };
      const next = branches.length > 0 ? branches.map((b, i) => (i === 0 ? updated : b)) : [updated];
      saveBranchesLocal(next);
      setStorageReport(getPersistentStorageReport());

      setSaved(true);
      toast('success', t('settings.savedToast'));
    } catch {
      toast('error', t('settings.savedError'));
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('error', 'أدخل كلمة المرور الحالية وكلمة المرور الجديدة وتأكيدها.');
      return;
    }
    if (newPassword.length < 10) {
      toast('error', 'يجب ألا تقل كلمة المرور الجديدة عن 10 أحرف.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('error', 'تأكيد كلمة المرور الجديدة غير مطابق.');
      return;
    }
    if (currentPassword === newPassword) {
      toast('error', 'يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية.');
      return;
    }
    if (!window.desktopStore) {
      toast('error', 'تغيير كلمة المرور متاح داخل تطبيق سطح المكتب.');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = window.desktopStore.changePassword('', currentPassword, newPassword);
      if (!result.ok) {
        const message = result.error === 'CURRENT_PASSWORD_INVALID'
          ? 'كلمة المرور الحالية غير صحيحة.'
          : result.error === 'PASSWORD_REUSE'
            ? 'كلمة المرور الجديدة مستخدمة حالياً.'
            : result.error === 'SESSION_INVALID'
              ? 'انتهت الجلسة؛ سجّل الدخول مرة أخرى.'
              : 'كلمة المرور الجديدة لا تستوفي متطلبات الأمان.';
        toast('error', message);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged?.();
      toast('success', 'تم تغيير كلمة المرور بنجاح.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleBackup = async () => {
    const suggestedName = `fullerp-sqlite-backup-${new Date().toISOString().split('T')[0]}.json`;
    const backupData = collectBackupData(settings);

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{ description: 'JSON Backup File', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(backupData, null, 2));
        await writable.close();
        toast('success', 'تم حفظ النسخة الاحتياطية بنجاح.');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('File Picker Error:', err);
      }
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', 'تم إنشاء نسخة احتياطية كاملة من بيانات النظام.');
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
        setPendingRestore(parsed as Record<string, unknown>);
      } catch {
        toast('error', 'ملف النسخة الاحتياطية غير صالح — اختر ملف JSON صحيح.');
      }
    };
    reader.onerror = () => toast('error', 'تعذر قراءة ملف النسخة الاحتياطية.');
    reader.readAsText(file);
  };

  const applyRestore = () => {
    if (!pendingRestore) return;
    try {
      const data = backupPayloadData(pendingRestore);
      const entries: Array<[string, string]> = [];
      Object.entries(data).forEach(([key, value]) => {
        const k = String(key);
        if (k.startsWith('elite-erp-')) entries.push([k, typeof value === 'string' ? value : JSON.stringify(value)]);
      });
      const result = replacePersistentEntries(entries);
      if (!result.ok) throw new Error(result.error || 'SQLite restore failed');
      clearLegacyPersistentEntries();
      const theme = data.theme;
      if (typeof theme === 'string') window.localStorage.setItem('theme', theme);
      setLastRestore(result);
      setStorageReport(getPersistentStorageReport());
      setPendingRestore(null);
      toast('success', `تمت استعادة ${result.restored} سجل بنجاح، وفحص SQLite: ${result.integrity}. جاري إعادة التحميل...`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      toast('error', 'تعذر استعادة النسخة الاحتياطية — الملف غير صالح.');
      setPendingRestore(null);
    }
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
    reader.onload = () => setIdentityField('logoUrl', String(reader.result || ''));
    reader.onerror = () => toast('error', 'تعذر قراءة الصورة');
    reader.readAsDataURL(file);
  };

  const labelCls = 'block text-xs font-bold text-slate-300 mb-2';
  const inputCls = 'w-full glass-input rounded-lg px-3.5 py-2 text-xs font-semibold bg-slate-900 text-slate-50 border border-slate-700 hover:border-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 outline-none transition-all placeholder:text-slate-500';
  const selectCls = 'w-full glass-input rounded-lg px-3.5 py-2 text-xs font-semibold bg-slate-900 text-slate-50 border border-slate-700 hover:border-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 outline-none transition-all cursor-pointer';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Settings className="w-6 h-6" />}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <div className="overflow-visible">
        {/* رأس المركز */}
        <div className="px-6 py-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/15 rounded-2xl">
            <SlidersHorizontal className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h2 className="font-black text-white text-lg">مركز الإعدادات</h2>
            <p className="text-xs text-slate-500 mt-0.5">تخصيص هوية المنشأة والإعدادات المالية والأمان والصلاحيات والبيانات والواجهة</p>
          </div>
        </div>

        {/* شبكة أقسام الإعدادات */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TABS.map(tabDef => {
              const TabIcon = tabDef.icon;
              const active = tab === tabDef.id;
              return (
                <button
                  key={tabDef.id}
                  type="button"
                  onClick={() => {
                    setTab(tabDef.id);
                    setActiveModal(tabDef.id);
                  }}
                  className={`group relative text-right glass rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden ${
                    active ? 'border-sky-500/40' : 'border-slate-700/50 hover:border-sky-500/40'
                  }`}
                >
                  <div className={`p-3.5 rounded-2xl border border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-300 w-fit ${active ? tabDef.iconClass : 'bg-slate-800 text-slate-400'}`}>
                    <TabIcon className="w-6 h-6" />
                  </div>
                  <h3 className="mt-4 font-bold text-white text-base">{tabDef.label}</h3>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-500 bg-slate-800/50 rounded-full px-2.5 py-1">{tabDef.meta}</span>
                    <div className="flex items-center gap-2 text-sky-400 text-xs font-bold whitespace-nowrap">
                      <span>{active ? 'معروض الآن' : 'عرض الإعدادات'}</span>
                      <Arrow className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* نافذة القسم — تظهر عند النقر على أي مربع */}
        <ModalShell
          id="settings-section"
          open={activeModal !== null}
          onClose={() => setActiveModal(null)}
          title={activeDef ? activeDef.label : 'مركز الإعدادات'}
          subtitle={activeDef?.description}
          icon={activeDef?.icon ?? Settings}
          size="xl"
          bodyClassName="p-0"
          footer={
            <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-4 border-t border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('settings.saved')}
                  </span>
                )}
                <span className="text-xs text-slate-500">تُحفظ الإعدادات محلياً على هذا الجهاز</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-primary flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  حفظ كافة التغييرات
                </button>
              </div>
            </div>
          }
        >
          <div key={tab} className="p-5 lg:p-6 space-y-6 animate-fade-in">
            {tab === 'company' && (
              <>
              <SettingsWindow>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 hover:bg-sky-500/10 rounded-2xl p-6 transition-all flex flex-col items-center justify-center text-center group cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-300">شعار المنشأة الرسمي</p>
                      <p className="text-sm text-slate-500 mt-0.5">صيغ PNG / JPG / SVG — الحد الأقصى 2MB (يظهر في ترويسة التقارير)</p>
                      <span className="mt-3 px-3.5 py-1.5 bg-slate-950 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-900 flex items-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        {identity.logoUrl ? 'استبدال الشعار' : 'رفع شعار جديد'}
                      </span>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                    </label>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="w-24 h-24 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden">
                        {identity.logoUrl ? (
                          <img src={identity.logoUrl} alt="شعار المنشأة" className="w-full h-full object-contain" />
                        ) : (
                          <ImageOff className="w-8 h-8 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{identity.logoUrl ? 'تم رفع شعار المنشأة' : 'لا يوجد شعار بعد'}</p>
                        <p className="text-sm text-slate-500 mt-0.5">معاينة فورية — يُحفظ الشعار مع بيانات المنشأة</p>
                      </div>
                      {identity.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setIdentityField('logoUrl', '')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف الشعار
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div>
                      <label className={labelCls}>اسم الشركة (عربي)</label>
                      <input type="text" value={identity.companyNameAr} onChange={e => setIdentityField('companyNameAr', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>اسم الشركة (إنجليزي)</label>
                      <input type="text" value={identity.companyNameEn} onChange={e => setIdentityField('companyNameEn', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>العنوان (عربي)</label>
                      <input type="text" value={identity.addressAr} onChange={e => setIdentityField('addressAr', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>العنوان (إنجليزي)</label>
                      <input type="text" value={identity.addressEn} onChange={e => setIdentityField('addressEn', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>الهاتف</label>
                      <input type="tel" value={identity.phone} onChange={e => setIdentityField('phone', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>الفاكس</label>
                      <input type="tel" value={identity.fax} onChange={e => setIdentityField('fax', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </SettingsWindow>
              </>
            )}

            {tab === 'financial' && (
              <SettingsWindow>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>عدد المنازل العشرية (Decimal Places)</label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                      <select value={settings.decimalPlaces} onChange={e => set('decimalPlaces', e.target.value)} className={`${selectCls} ps-10`}>
                        {DECIMAL_OPTIONS.map(d => (
                          <option key={d} value={String(d)}>
                            {d} منازل
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">دقة عرض وتقريب المبالغ في النظام.</p>
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">إلزامية مراكز التكلفة</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">اشتراط اختيار مركز التكلفة عند إدخال المصروفات.</p>
                      </div>
                      <Switch checked={settings.costCenterMandatory} onChange={v => set('costCenterMandatory', v)} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>المستندات المؤيدة المطلوبة (JSON)</label>
                    <textarea value={settings.attachmentRequirementsJson} onChange={e => set('attachmentRequirementsJson', e.target.value)} className={`${inputCls} min-h-24 font-mono text-xs`} dir="ltr" />
                    <p className="text-xs text-slate-500 mt-2">مثال: [{`{\"documentType\":\"INVOICE\",\"label\":\"فاتورة\",\"required\":true}`}]. يمنع الترحيل النهائي حتى يتم إرفاق المستند والتحقق منه.</p>
                  </div>
                </div>
              </SettingsWindow>
            )}

            {tab === 'security' && (
              <SettingsWindow>
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <KeyRound className="w-5 h-5 text-sky-400" />
                    <div>
                      <h3 className="text-sm font-black text-white">تغيير كلمة المرور</h3>
                      <p className="text-xs text-slate-500 mt-0.5">أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة مرتين للتأكيد.</p>
                    </div>
                  </div>
                  <form onSubmit={e => { e.preventDefault(); handleChangePassword(); }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>كلمة المرور الحالية</label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls} autoComplete="current-password" required />
                    </div>
                    <div>
                      <label className={labelCls}>كلمة المرور الجديدة</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} autoComplete="new-password" minLength={10} required />
                    </div>
                    <div>
                      <label className={labelCls}>تأكيد كلمة المرور الجديدة</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} autoComplete="new-password" minLength={10} required />
                    </div>
                    <div className="md:col-span-3 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-slate-500">الحد الأدنى 10 أحرف، ويجب أن تختلف عن كلمة المرور الحالية.</p>
                      <button type="submit" disabled={passwordBusy} className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed">
                        {passwordBusy ? 'جارٍ تغيير كلمة المرور...' : 'تغيير كلمة المرور'}
                      </button>
                    </div>
                  </form>
                </div>
                <div className="divide-y divide-slate-800">
                  <ToggleRow
                    title="تسجيل كافة الأنشطة في سجل التدقيق (Audit Log)"
                    desc="توثيق جميع العمليات والتعديلات في سجل التدقيق للرقابة والمراجعة."
                    checked={settings.activityLogging}
                    onChange={v => set('activityLogging', v)}
                  />
                  <div className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">حماية القيود المرحلة</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">منع تعديل أو حذف القيود بعد الترحيل ضابط مالي إلزامي ومفعّل دائماً.</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> مفعّل
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <label className={labelCls}>مدة انتهاء الجلسة</label>
                  <div className="relative max-w-sm">
                    <Clock className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                    <select value={settings.sessionTimeout} onChange={e => set('sessionTimeout', e.target.value)} className={`${selectCls} ps-10`}>
                      {SESSION_TIMEOUTS.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    مدة خمول الجلسة قبل طلب تسجيل الدخول مجدداً.
                  </p>
                </div>
              </SettingsWindow>
            )}

            {tab === 'data' && (
              <>
                <SettingsWindow>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleBackup}
                      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-500 transition hover:bg-emerald-500/20 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      نسخة احتياطية
                    </button>
                    <button
                      type="button"
                      onClick={() => restoreInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-500 transition hover:bg-sky-500/20 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      استرجاع نسخة سابقة
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    تنبيه: استرجاع نسخة سابقة يستبدل البيانات الحالية في النظام بالبيانات المحفوظة في الملف المحدد.
                  </p>

                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-bold text-white">تقرير تخزين بيانات سطح المكتب</p>
                        <p className="text-xs text-slate-500 mt-1">حالة ترحيل بيانات النظام وفحص قاعدة البيانات المحلية.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${storageReport.engine === 'SQLite' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                        {storageReport.engine}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[11px] text-slate-500">سجلات قاعدة البيانات</p>
                        <p className="text-lg font-black text-sky-400 mt-1">{storageReport.storedEntries}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[11px] text-slate-500">سجلات المتصفح القديمة</p>
                        <p className="text-lg font-black text-slate-300 mt-1">{storageReport.legacyEntries}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[11px] text-slate-500">بانتظار الترحيل</p>
                        <p className={`text-lg font-black mt-1 ${storageReport.pendingMigrationEntries === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{storageReport.pendingMigrationEntries}</p>
                      </div>
                    </div>
                    {storageReport.databasePath && (
                      <div className="mt-3 rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
                        <p className="text-[11px] text-slate-500 mb-1">مسار قاعدة SQLite - الإصدار {storageReport.schemaVersion}</p>
                        <code dir="ltr" className="block text-[11px] text-slate-300 break-all text-left">{storageReport.databasePath}</code>
                      </div>
                    )}
                    {storageReport.relational && (
                      <div className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-xs font-bold text-indigo-300">الجداول المحاسبية المهيكلة - Schema {storageReport.relational.schemaVersion}</p>
                          <span className="text-[10px] text-slate-500" dir="ltr">{storageReport.relational.lastSyncedAt || '—'}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="rounded-md bg-slate-950/60 p-2">
                            <p className="text-[10px] text-slate-500">الحسابات</p>
                            <p className="text-sm font-black text-indigo-300">{storageReport.relational.accounts}</p>
                          </div>
                          <div className="rounded-md bg-slate-950/60 p-2">
                            <p className="text-[10px] text-slate-500">القيود / الأسطر</p>
                            <p className="text-sm font-black text-indigo-300">{storageReport.relational.journals} / {storageReport.relational.journalLines}</p>
                          </div>
                          <div className="rounded-md bg-slate-950/60 p-2">
                            <p className="text-[10px] text-slate-500">سندات الصرف</p>
                            <p className="text-sm font-black text-indigo-300">{storageReport.relational.paymentVouchers}</p>
                          </div>
                          <div className="rounded-md bg-slate-950/60 p-2">
                            <p className="text-[10px] text-slate-500">سندات القبض</p>
                            <p className="text-sm font-black text-indigo-300">{storageReport.relational.receiptVouchers}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {lastRestore && (
                      <p className="mt-3 text-xs text-emerald-400">
                        آخر استعادة: {lastRestore.restored} سجل - سلامة القاعدة: {lastRestore.integrity}
                      </p>
                    )}
                  </div>

                  <div className="mt-6">
                    <label className={labelCls}>الجدولة التلقائية للحفظ</label>
                    <div className="max-w-sm">
                      <select value={settings.backupFrequency} onChange={e => set('backupFrequency', e.target.value)} className={selectCls}>
                        <option value="daily">يومي</option>
                        <option value="weekly">أسبوعي</option>
                        <option value="monthly">شهري</option>
                        <option value="never">معطل</option>
                      </select>
                    </div>
                  </div>
                </SettingsWindow>
              </>
            )}

            {tab === 'appearance' && (
              <SettingsWindow>

                <div>
                  <label className={labelCls}>{t('settings.themeLabel')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      aria-pressed={theme === 'dark'}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-right transition-all cursor-pointer ${theme === 'dark'
                        ? 'border-sky-500/60 bg-sky-500/10 shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
                        <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-sky-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{t('settings.themeDark')}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">مظهر داكن مريح للعين</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      aria-pressed={theme === 'light'}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-right transition-all cursor-pointer ${theme === 'light'
                        ? 'border-sky-500/60 bg-sky-500/10 shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
                        <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-sky-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{t('settings.themeLight')}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">مظهر فاتح ناصع للعمل النهاري</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <label className={labelCls}>إعدادات زر التحديث</label>
                  <div className="space-y-4">
                    <ToggleRow
                      title="إظهار زر التحديث في الشريط العلوي"
                      desc="إظهار/إخفاء زر تحديث النظام بجانب أزرار المظهر والتنبيهات في الشريط العلوي."
                      checked={settings.showRefreshButton}
                      onChange={v => set('showRefreshButton', v)}
                    />
                    <div className="flex items-center justify-between gap-4 py-4 border-t border-slate-800">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">تحديث النظام الآن</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">إعادة تحميل الصفحة وتحديث كافة حالات النظام فوراً.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-400 transition hover:bg-sky-500/20 cursor-pointer shrink-0"
                      >
                        <RotateCw className="w-4 h-4" />
                        تحديث النظام
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsWindow>
            )}
          </div>
        </ModalShell>
      </div>

      {/* إدخال استعادة النسخة الاحتياطية */}
      <input ref={restoreInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestoreFile} />

      {/* تأكيد الاستعادة */}
      {pendingRestore && (
        <ModalShell
          id="settings-restore"
          open={!!pendingRestore}
          onClose={() => setPendingRestore(null)}
          title="تأكيد استعادة النسخة الاحتياطية"
          icon={Upload}
          size="sm"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
        >
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-400 leading-relaxed">
              سيتم <b className="font-bold text-white">استبدال جميع بيانات النظام الحالية</b> ببيانات النسخة الاحتياطية المستعادة (الحسابات، القيود، العهد، الإعدادات).
            </p>
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              لا يمكن التراجع عن هذه العملية. يُنصح بإنشاء نسخة احتياطية من الوضع الحالي أولاً.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="px-4 py-2 text-slate-400 hover:bg-slate-900 rounded-xl text-sm font-medium cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={applyRestore}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer"
              >
                نعم، استعادة النسخة
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
