import React, { useRef, useState } from 'react';
import { Bell, Shield, ChevronDown, Settings, LogOut, X, AlertTriangle, Search, Sun, Moon, RotateCw } from 'lucide-react';
import { AuthUser, ERPModule } from '../constants/permissions';
import { useI18n } from '../i18n';
import { ThemeMode } from '../utils/useTheme';
import AnchoredPopover from './ui/AnchoredPopover';
import GlobalSearchModal, { GlobalSearchData } from './ui/GlobalSearchModal';
import { useModalStack } from './ui/ModalStack';
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from '../constants/brand';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  onNavigate: (module: ERPModule) => void;
  notificationCount: number;
  theme: ThemeMode;
  toggleTheme: () => void;
  searchData?: GlobalSearchData;
  allowedModules?: ERPModule[];
  showRefreshButton?: boolean;
}

export default function Navbar({ user, onLogout, onNavigate, notificationCount, theme, toggleTheme, searchData, allowedModules, showRefreshButton = true }: Props) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const { t, dir } = useI18n();
  const { windows, activeId, restore, minimize, raise, closeWindow } = useModalStack();

  const handleTabClick = (id: string, isMinimized: boolean, isActive: boolean) => {
    if (isMinimized) restore(id);
    else if (isActive) minimize(id);
    else raise(id);
  };

  const closeNotifications = () => setShowNotifications(false);
  const closeUserMenu = () => setShowUserMenu(false);

  return (
    <header
      className="paper sticky top-0 z-50 px-4 py-2 flex flex-col gap-2 border-b border-[#023e6a] bg-[#0284c7] text-white overflow-visible transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
    >
      <div className="flex items-center justify-between gap-2 min-h-[40px]">
      <div className="flex items-center gap-2.5 min-w-0 shrink-0" aria-label={`${PRODUCT_NAME} for Finance & Accounting`}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/40 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
          <img src="./brand/fullerp-icon-64.png" alt="" aria-hidden="true" className="w-9 h-9 object-contain dark:hidden" />
          <img src="./brand/fullerp-icon-dark-64.png" alt="" aria-hidden="true" className="hidden w-9 h-9 object-contain dark:block" />
        </div>
        <div className="min-w-0 text-right leading-none">
          <p className="truncate text-base font-black tracking-wide text-white">{PRODUCT_NAME}</p>
          <p className="mt-1 truncate text-[11px] font-medium tracking-wide text-sky-100 dark:text-slate-400">{PRODUCT_TAGLINE_AR}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 ms-auto">
        <button
          onClick={() => setSearchOpen(true)}
          title="بحث في النظام (Ctrl + K)"
          className="hidden sm:flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all cursor-pointer bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          <Search className="w-4 h-4" />
          <span>بحث في النظام...</span>
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Ctrl K</kbd>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          title="بحث في النظام (Ctrl + K)"
          className="sm:hidden p-2.5 rounded-xl transition-all cursor-pointer bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={t('nav.theme')}
          aria-label={t('nav.theme')}
          className="relative p-2.5 rounded-xl transition-all cursor-pointer bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {showRefreshButton && (
          <button
            type="button"
            onClick={() => {
              setRefreshSpinning(true);
              window.setTimeout(() => window.location.reload(), 150);
            }}
            title="تحديث النظام"
            aria-label="تحديث النظام"
            className="relative p-2.5 rounded-xl transition-all cursor-pointer bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
          >
            <RotateCw className={`w-5 h-5 ${refreshSpinning ? 'animate-spin' : ''}`} />
          </button>
        )}

        <button
          ref={notificationTriggerRef}
          type="button"
          aria-expanded={showNotifications}
          aria-haspopup="dialog"
          onClick={() => {
            setShowNotifications(prev => !prev);
            setShowUserMenu(false);
          }}
          className={`relative p-2.5 rounded-xl transition-all cursor-pointer bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 ${showNotifications
              ? 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700'
              : ''
            }`}
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white"
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        <AnchoredPopover
          open={showNotifications}
          onClose={closeNotifications}
          anchorRef={notificationTriggerRef}
          width={320}
          align="end"
          dir={dir}
        >
          <div className="nav-popover-header">
            <h3 className="nav-popover-title">{t('nav.notifications')}</h3>
            <button
              type="button"
              aria-label={t('nav.closeNotifications')}
              onClick={closeNotifications}
              className="nav-popover-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {notificationCount === 0 ? (
              <div className="nav-popover-empty">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>{t('nav.noNotifications')}</p>
              </div>
            ) : (
              <button
                type="button"
                className="nav-popover-item w-full"
                onClick={() => {
                  closeNotifications();
                  onNavigate('TRUSTS');
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-semibold">{t('nav.trustAlert')}</p>
                  <p className="text-xs opacity-70 mt-1">{t('nav.trustCount', { count: notificationCount })}</p>
                </div>
              </button>
            )}
          </div>

          <div className="nav-popover-footer">
            <button
              type="button"
              onClick={() => {
                closeNotifications();
                onNavigate('AUDIT_SECURITY');
              }}
              className="w-full text-center text-sm text-sky-500 hover:text-sky-600 font-semibold transition-colors cursor-pointer"
            >
              {t('nav.auditTrail')}
            </button>
          </div>
        </AnchoredPopover>

        <button
          ref={userMenuTriggerRef}
          type="button"
          aria-expanded={showUserMenu}
          aria-haspopup="dialog"
          onClick={() => {
            setShowUserMenu(prev => !prev);
            setShowNotifications(false);
          }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all cursor-pointer bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          <div className="w-8 h-8 bg-[#38bdf8] text-white rounded-lg flex items-center justify-center font-bold dark:bg-slate-900 dark:text-sky-400">
            {user.name.charAt(0)}
          </div>
          <div className="hidden sm:block text-right">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user.username}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>

        <AnchoredPopover
          open={showUserMenu}
          onClose={closeUserMenu}
          anchorRef={userMenuTriggerRef}
          width={256}
          align="end"
          dir={dir}
        >
          <div className="nav-popover-header">
            <div className="min-w-0 text-right">
              <p className="nav-popover-title truncate">{user.name}</p>
              <p className="text-xs opacity-70 mt-1 truncate">{user.username}</p>
            </div>
          </div>

          <div className="px-4 pb-3">
            <div className="inline-flex items-center gap-1.5 text-xs text-sky-500 bg-sky-500/10 border border-sky-500/20 rounded-full px-2 py-1">
              <Shield className="w-3 h-3" />
              {user.roleId}
            </div>
          </div>

          <div className="p-2 pt-0">
            <button
              type="button"
              onClick={() => {
                closeUserMenu();
                onNavigate('AUDIT_SECURITY');
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-500/10 transition-colors text-sm cursor-pointer text-right"
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>{t('nav.auditSecurity')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeUserMenu();
                onNavigate('SETTINGS');
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-500/10 transition-colors text-sm cursor-pointer text-right"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>{t('nav.settings')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeUserMenu();
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors text-sm mt-1 cursor-pointer text-right"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </AnchoredPopover>
      </div>
      </div>

      {windows.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 border-t border-[#023e6a] pt-2 dark:border-slate-800">
          {windows.map(w => {
            const Icon = w.icon;
            const isActive = w.isActive;
            return (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => handleTabClick(w.id, w.isMinimized, isActive)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTabClick(w.id, w.isMinimized, isActive);
                  }
                }}
                title={typeof w.title === 'string' ? w.title : undefined}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold border cursor-pointer select-none transition-colors max-w-[180px] ${
                  isActive
                    ? 'bg-white border-white/80 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100'
                    : 'bg-white/60 border-white/40 text-slate-600 hover:bg-white hover:text-slate-900 dark:bg-slate-800/70 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                } ${w.isMinimized ? 'opacity-60' : ''}`}
              >
                {Icon && (
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-700 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}
                  />
                )}
                <span className="truncate flex-1 text-right">{w.title}</span>
                <button
                  type="button"
                  aria-label="إغلاق النافذة"
                  title="إغلاق النافذة"
                  onClick={e => {
                    e.stopPropagation();
                    closeWindow(w.id);
                  }}
                  className={`opacity-50 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 cursor-pointer ${isActive ? 'text-slate-700 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onToggleOpen={() => setSearchOpen(prev => !prev)}
        onNavigate={onNavigate}
        data={searchData || { accounts: [], journals: [], vouchers: [], receipts: [], customers: [], vendors: [], employees: [], trusts: [], cashBoxes: [], bankAccounts: [], currencies: [], costCenters: [] }}
        allowedModules={allowedModules || []}
      />
    </header>
  );
}
