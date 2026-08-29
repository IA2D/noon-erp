import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ERPModule } from '../constants/permissions';
import { useI18n } from '../i18n';
import { MODULE_META } from './moduleMeta';

export interface WorkspaceTab {
  id: string;          // tab:<module>
  module: ERPModule;
  dirty: boolean;
  pinned: boolean;     // مثبّت (الرئيسية) — لا يُغلق
  reloadToken: number; // يزيد لإعادة تحميل الشاشة (Remount)
  openedAt: number;
}

export function tabIdFor(module: ERPModule): string {
  return `tab:${module}`;
}

type CloseAction = 'CLOSE' | 'CLOSE_OTHERS' | 'CLOSE_LEFT' | 'CLOSE_RIGHT';

interface PendingClose {
  id: string;
  action: CloseAction;
}

interface TabsContextValue {
  tabs: WorkspaceTab[];
  activeTabId: string;
  activeModule: ERPModule;
  openModule: (module: ERPModule) => void;
  setActiveTab: (id: string) => void;
  requestCloseTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  reloadTab: (id: string) => void;
  markDirty: (module: ERPModule, dirty: boolean) => void;
  resetTabs: () => void;
  isDirty: (module: ERPModule) => boolean;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function makeTab(module: ERPModule, pinned = false): WorkspaceTab {
  return {
    id: tabIdFor(module),
    module,
    dirty: false,
    pinned,
    reloadToken: 0,
    openedAt: Date.now(),
  };
}

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n();
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [makeTab('HOME', true)]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabIdFor('HOME'));
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);

  const openModule = useCallback((module: ERPModule) => {
    const id = tabIdFor(module);
    setTabs(prev => (prev.some(tab => tab.id === id) ? prev : [...prev, makeTab(module, module === 'HOME')]));
    setActiveTabId(id);
  }, []);

  const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

  const markDirty = useCallback((module: ERPModule, dirty: boolean) => {
    const id = tabIdFor(module);
    setTabs(prev => (prev.some(tab => tab.id === id && tab.dirty === dirty) ? prev : prev.map(tab => (tab.id === id ? { ...tab, dirty } : tab))));
  }, []);

  const reloadTab = useCallback((id: string) => {
    setTabs(prev => prev.map(tab => (tab.id === id ? { ...tab, reloadToken: tab.reloadToken + 1, dirty: false } : tab)));
  }, []);

  const resetTabs = useCallback(() => {
    setTabs([makeTab('HOME', true)]);
    setActiveTabId(tabIdFor('HOME'));
    setPendingClose(null);
  }, []);

  /**
   * المنفّذ الوحيد لإغلاق التبويبات. عند وجود تعديلات غير محفوظة وعدم تمرير force
   * يُعلَّق الإجراء حتى يؤكد المستخدم عبر نافذة التأكيد.
   */
  const executeClose = useCallback(
    (id: string, action: CloseAction, force: boolean) => {
      const target = tabs.find(tab => tab.id === id);
      if (!target) return;

      let next = tabs;
      if (action === 'CLOSE') {
        if (target.pinned) return;
        if (target.dirty && !force) {
          setPendingClose({ id, action });
          return;
        }
        next = tabs.filter(tab => tab.id !== id);
      } else if (action === 'CLOSE_OTHERS') {
        const others = tabs.filter(tab => tab.id !== id && !tab.pinned);
        if (!force && others.some(tab => tab.dirty)) {
          setPendingClose({ id, action });
          return;
        }
        next = tabs.filter(tab => tab.id === id || tab.pinned);
      } else if (action === 'CLOSE_LEFT') {
        const idx = tabs.findIndex(tab => tab.id === id);
        const doomed = tabs.slice(0, idx).filter(tab => !tab.pinned);
        if (!force && doomed.some(tab => tab.dirty)) {
          setPendingClose({ id, action });
          return;
        }
        next = tabs.filter((_, i) => i >= idx || tabs[i].pinned);
      } else if (action === 'CLOSE_RIGHT') {
        const idx = tabs.findIndex(tab => tab.id === id);
        const doomed = tabs.slice(idx + 1).filter(tab => !tab.pinned);
        if (!force && doomed.some(tab => tab.dirty)) {
          setPendingClose({ id, action });
          return;
        }
        next = tabs.filter((_, i) => i <= idx || tabs[i].pinned);
      }

      if (next === tabs) return;
      const wasActive = activeTabId === id && !next.some(tab => tab.id === activeTabId);
      setTabs(next);
      if (wasActive) {
        const idx = tabs.findIndex(tab => tab.id === id);
        const neighbor = next[Math.min(idx, next.length - 1)];
        setActiveTabId(neighbor ? neighbor.id : tabIdFor('HOME'));
      }
    },
    [tabs, activeTabId]
  );

  const requestCloseTab = useCallback((id: string) => executeClose(id, 'CLOSE', false), [executeClose]);
  const closeOtherTabs = useCallback((id: string) => executeClose(id, 'CLOSE_OTHERS', false), [executeClose]);
  const closeTabsToLeft = useCallback((id: string) => executeClose(id, 'CLOSE_LEFT', false), [executeClose]);
  const closeTabsToRight = useCallback((id: string) => executeClose(id, 'CLOSE_RIGHT', false), [executeClose]);

  const confirmPendingClose = () => {
    if (!pendingClose) return;
    const { id, action } = pendingClose;
    setPendingClose(null);
    executeClose(id, action, true);
  };

  const activeModule = useMemo(
    () => tabs.find(tab => tab.id === activeTabId)?.module ?? 'HOME',
    [tabs, activeTabId]
  );

  const isDirty = useCallback((module: ERPModule) => tabs.find(tab => tab.id === tabIdFor(module))?.dirty ?? false, [tabs]);

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs,
      activeTabId,
      activeModule,
      openModule,
      setActiveTab,
      requestCloseTab,
      closeOtherTabs,
      closeTabsToLeft,
      closeTabsToRight,
      reloadTab,
      markDirty,
      resetTabs,
      isDirty,
    }),
    [tabs, activeTabId, activeModule, openModule, setActiveTab, requestCloseTab, closeOtherTabs, closeTabsToLeft, closeTabsToRight, reloadTab, markDirty, resetTabs, isDirty]
  );

  const pendingTab = pendingClose ? tabs.find(tab => tab.id === pendingClose.id) : null;

  return (
    <TabsContext.Provider value={value}>
      {children}
      {pendingTab && pendingClose && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={confirmPendingClose} />
          <div className="relative w-full max-w-md glass rounded-3xl border border-slate-700/70 shadow-2xl shadow-black/50 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm">{t('tabs.unsavedTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingClose(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label={t('tabs.cancel')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                {t('tabs.unsavedMessage', {
                  title: MODULE_META[pendingTab.module]?.[lang === 'ar' ? 'titleAr' : 'titleEn'] ?? pendingTab.module,
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700/60 bg-slate-900/40">
              <button
                type="button"
                onClick={() => setPendingClose(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {t('tabs.keepOpen')}
              </button>
              <button
                type="button"
                onClick={confirmPendingClose}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 transition-colors cursor-pointer"
              >
                {t('tabs.discardAndClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </TabsContext.Provider>
  );
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('useTabs must be used within TabsProvider');
  }
  return ctx;
}

export function useTabDirty(module: ERPModule) {
  const { markDirty } = useTabs();
  return useCallback((dirty: boolean) => markDirty(module, dirty), [module, markDirty]);
}
