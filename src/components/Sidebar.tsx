import React from 'react';
import { Database, FileBarChart2, ShieldCheck, TrendingUp, Settings, Home, Zap, Lock, PanelLeftClose, PanelLeftOpen, Info } from 'lucide-react';
import { ERPModule } from '../constants/permissions';
import { useI18n } from '../i18n';
import { useLocalStorageState } from '../utils/useLocalStorageState';

interface Props {
  activeModule: ERPModule;
  setActiveModule: (module: ERPModule) => void;
  allowedModules: ERPModule[];
}

export default function Sidebar({ activeModule, setActiveModule, allowedModules }: Props) {
  const { lang, t } = useI18n();
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('elite-erp-sidebar-collapsed-v1', false);

  const menuItems = [
    {
      id: 'HOME' as ERPModule,
      titleAr: 'الصفحة الرئيسية',
      titleEn: 'Home',
      icon: Home,
    },
    {
      id: 'INPUTS' as ERPModule,
      titleAr: 'المدخلات',
      titleEn: 'Inputs',
      icon: Database,
    },
    {
      id: 'OPERATIONS' as ERPModule,
      titleAr: 'العمليات',
      titleEn: 'Operations',
      icon: Zap,
    },
    {
      id: 'REPORTS' as ERPModule,
      titleAr: 'التقارير المالية',
      titleEn: 'Financial Reports',
      icon: FileBarChart2,
      badge: 'IFRS',
      badgeColor: 'bg-sky-50 text-[#006fba] border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
    },
    {
      id: 'DASHBOARD' as ERPModule,
      titleAr: 'المؤشرات المالية',
      titleEn: 'Financial Indicators',
      icon: TrendingUp,
    },
    {
      id: 'CLOSING' as ERPModule,
      titleAr: 'الإقفالات والرقابة',
      titleEn: 'Closings & Control',
      icon: Lock,
    },
    {
      id: 'AUDIT_SECURITY' as ERPModule,
      titleAr: 'سجل التدقيق',
      titleEn: 'Audit Trail',
      icon: ShieldCheck,
    },
    {
      id: 'SETTINGS' as ERPModule,
      titleAr: 'الإعدادات',
      titleEn: 'Settings',
      icon: Settings,
    },
    {
      id: 'ABOUT' as ERPModule,
      titleAr: 'About Us',
      titleEn: 'About Us',
      icon: Info,
    },
  ];

  const MenuItem = ({ item }: { item: any; key?: string }) => {
    const Icon = item.icon;
    const isActive = activeModule === item.id;

    if (!allowedModules.includes(item.id as ERPModule)) {
      return null;
    }

    return (
      <button
        title={collapsed ? (lang === 'ar' ? item.titleAr : item.titleEn) : undefined}
        onClick={() => setActiveModule(item.id)}
        className={`w-full flex items-center rounded-xl font-semibold text-[15px] transition-all duration-150 group relative overflow-hidden ${isActive
          ? 'bg-white dark:bg-[#006fba] shadow-sm border border-sky-200 dark:border-transparent text-[#006fba] dark:text-white font-extrabold rounded-xl'
          : 'text-slate-700 dark:text-slate-400 hover:bg-slate-950 hover:text-sky-900 hover:shadow-xs hover:border hover:border-sky-100 dark:hover:bg-sky-950/50 dark:hover:text-sky-100 border border-transparent'
          } ${collapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'}`}
      >
        {isActive && (
          <span className="absolute inset-0 bg-gradient-to-l from-sky-100/60 via-sky-50/30 to-transparent dark:from-white/10 dark:via-white/5 dark:to-transparent" />
        )}
        {isActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-l-full bg-[#006fba] dark:bg-white" />
        )}
        <div className={`relative flex items-center min-w-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className={`p-1.5 rounded-lg transition-colors duration-150 ${isActive ? 'bg-sky-100 dark:bg-white/20' : 'bg-sky-100 dark:bg-sky-950 group-hover:bg-sky-200 dark:group-hover:bg-sky-900'}`}>
            <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#006fba] dark:text-white' : 'text-sky-500 dark:text-slate-400 group-hover:text-sky-900 dark:group-hover:text-slate-200'}`} />
          </div>
          {!collapsed && (
            <span className={`truncate ${isActive ? 'sidebar-nav-label-active' : 'sidebar-nav-label'}`}>
              {lang === 'ar' ? item.titleAr : item.titleEn}
            </span>
          )}
        </div>

        {!collapsed && item.badge && (
          <span className={`relative text-sm font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`border-l border-sky-200 dark:border-slate-800 bg-[#f0f9ff] dark:bg-slate-900 text-slate-600 dark:text-slate-400 flex flex-col p-4 min-h-0 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Sidebar control; product branding lives in the top navbar. */}
      <div className={`flex items-center pt-1 pb-2 shrink-0 ${collapsed ? 'justify-center' : 'justify-start px-2'}`}>
        <button
          type="button"
          title={collapsed ? (lang === 'ar' ? 'توسيع اللوحة الجانبية' : 'Expand sidebar') : (lang === 'ar' ? 'طي اللوحة الجانبية' : 'Collapse sidebar')}
          onClick={() => setCollapsed(prev => !prev)}
          className="p-2 rounded-xl text-sky-400 dark:text-slate-400 hover:text-sky-700 dark:hover:text-white hover:bg-sky-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      {/* Menus — تمرير مستقل */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-4 pb-2">
        <div className="space-y-1">
          {menuItems.map(item => (
            <MenuItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Footer — اسم النظام ورقم الإصدار */}
      <div className="text-center pt-3 pb-3 border-t border-sky-200 dark:border-slate-800 shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-xs font-mono text-sky-400 dark:text-slate-500 mt-1 tracking-wider" dir="ltr">v1.0.0 Enterprise</p>
          </>
        )}
      </div>
    </aside>
  );
}
