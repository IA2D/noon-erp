import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, RotateCw, X, XCircle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useTabs, WorkspaceTab } from '../../tabs/TabsContext';
import { MODULE_META } from '../../tabs/moduleMeta';

interface ContextMenuState {
  tab: WorkspaceTab;
  x: number;
  y: number;
}

export default function WorkspaceTabBar() {
  const { t, lang } = useI18n();
  const { tabs, activeTabId, setActiveTab, requestCloseTab, closeOtherTabs, closeTabsToLeft, closeTabsToRight, reloadTab } = useTabs();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  const tabTitle = useCallback(
    (tab: WorkspaceTab) => MODULE_META[tab.module]?.[lang === 'ar' ? 'titleAr' : 'titleEn'] ?? tab.module,
    [lang]
  );

  // تمرير الشريط أفقياً بعجلة الفأرة (بدون أسهم) — مع كشف اصطلاح scrollLeft
  // لدى المتصفح في RTL (بعضها يستخدم قيماً سالبة) لضمان الاتجاه الصحيح.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const probe = () => {
      el.scrollLeft = 1;
      const positive = el.scrollLeft === 1;
      el.scrollLeft = 0;
      return !isRtl || positive;
    };
    let sign = probe() ? 1 : -1;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += sign * (e.deltaY || e.deltaX);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [tabs.length]);

  // إبقاء التبويب النشط ظاهراً في منطقة العرض
  useEffect(() => {
    if (!activeTabId) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeTabId, tabs.length]);

  // إغلاق قوائم السياق عند النقر خارجها أو Escape
  useEffect(() => {
    const closeMenus = () => {
      setCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
    };
    window.addEventListener('click', closeMenus);
    window.addEventListener('blur', closeMenus);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', closeMenus);
      window.removeEventListener('blur', closeMenus);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const openCtxMenu = (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ tab, x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 260) });
  };

  const menuItem =
    'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-sky-500/10 hover:text-sky-300 transition-colors text-right cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed';

  return (
    <div
      className="relative z-30 flex items-center gap-2 px-4 py-2 shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl"
      onContextMenu={e => e.preventDefault()}
    >
      {/* حاوية التبويبات */}
      <div ref={scrollRef} className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5" role="tablist" aria-label={t('tabs.label')}>
        {tabs.map(tab => {
          const active = tab.id === activeTabId;
          const Icon = MODULE_META[tab.module]?.icon;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={active}
              title={`${tabTitle(tab)}${tab.dirty ? ` — ${t('tabs.unsavedTitle')}` : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={e => openCtxMenu(e, tab)}
              className={`group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border select-none whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                active
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 shadow-sm'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              {Icon && <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}`} />}
              <span className={`${active ? 'font-bold' : ''}`}>{tabTitle(tab)}</span>

              {/* شارة البيانات غير المحفوظة */}
              {tab.dirty && <span className="w-2 h-2 rounded-full bg-amber-400 shadow shadow-amber-400/50 shrink-0" title={t('tabs.unsavedTitle')} />}

              {!tab.pinned && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    requestCloseTab(tab.id);
                  }}
                  title={t('tabs.closeTab')}
                  className="rounded-md p-0.5 text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* قائمة الزر الأيمن على التبويب */}
      {ctxMenu && (
        <div
          className="fixed z-[110] w-56 rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/40 p-1.5"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 mb-1">
            {(() => {
              const Icon = MODULE_META[ctxMenu.tab.module]?.icon;
              return Icon ? <Icon className="w-4 h-4 text-sky-400" /> : null;
            })()}
            <span className="flex-1 truncate text-xs font-bold text-slate-100">{tabTitle(ctxMenu.tab)}</span>
            {ctxMenu.tab.dirty && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          </div>

          <button
            type="button"
            disabled={ctxMenu.tab.pinned}
            onClick={() => {
              requestCloseTab(ctxMenu.tab.id);
              setCtxMenu(null);
            }}
            className={menuItem}
          >
            <XCircle className="w-4 h-4 text-red-400" />
            {t('tabs.closeTab')}
          </button>
          <button
            type="button"
            onClick={() => {
              closeOtherTabs(ctxMenu.tab.id);
              setCtxMenu(null);
            }}
            className={menuItem}
          >
            <LayoutGrid className="w-4 h-4 text-slate-400" />
            {t('tabs.closeOthers')}
          </button>
          <div className="flex items-center gap-1 px-1 py-0.5">
            <button
              type="button"
              onClick={() => {
                closeTabsToLeft(ctxMenu.tab.id);
                setCtxMenu(null);
              }}
              className={menuItem}
            >
              <ChevronRight className="w-4 h-4 text-slate-400" />
              {t('tabs.closeLeft')}
            </button>
            <button
              type="button"
              onClick={() => {
                closeTabsToRight(ctxMenu.tab.id);
                setCtxMenu(null);
              }}
              className={menuItem}
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
              {t('tabs.closeRight')}
            </button>
          </div>
          <div className="h-px bg-slate-800 my-1" />
          <button
            type="button"
            onClick={() => {
              reloadTab(ctxMenu.tab.id);
              setCtxMenu(null);
            }}
            className={menuItem}
          >
            <RotateCw className="w-4 h-4 text-slate-400" />
            {t('tabs.reloadTab')}
          </button>
        </div>
      )}
    </div>
  );
}
