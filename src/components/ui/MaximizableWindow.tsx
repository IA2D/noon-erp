import React, { useState } from 'react';
import { Maximize2, Minimize2, ChevronUp, RotateCcw } from 'lucide-react';

export type WindowMode = 'normal' | 'maximized' | 'hidden';

export function useMaximizableWindow(initial: WindowMode = 'normal') {
  const [mode, setMode] = useState<WindowMode>(initial);
  const isMaximized = mode === 'maximized';
  const isHidden = mode === 'hidden';
  const toggleMaximize = () => setMode(m => (m === 'maximized' ? 'normal' : 'maximized'));
  const hide = () => setMode('hidden');
  const restore = () => setMode('normal');
  return { mode, isMaximized, isHidden, toggleMaximize, hide, restore };
}

export function WindowControls({
  isMaximized,
  onToggleMaximize,
  onHide
}: {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onHide: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 pl-2 ml-1 border-r border-slate-700/60">
      <button
        type="button"
        onClick={onToggleMaximize}
        title={isMaximized ? 'استعادة الحجم الطبيعي' : 'تكبير النافذة'}
        className="rounded-xl border border-slate-700/70 bg-slate-800/80 p-2 text-slate-300 transition hover:border-sky-500 hover:text-sky-300 cursor-pointer"
      >
        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={onHide}
        title="إخفاء النافذة (طي إلى شريط)"
        className="rounded-xl border border-slate-700/70 bg-slate-800/80 p-2 text-slate-300 transition hover:border-amber-500 hover:text-amber-300 cursor-pointer"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}

export function HiddenWindowBar({
  icon,
  title,
  subtitle,
  onRestore
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onRestore: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl border border-slate-700/70 px-4 py-3 flex items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20 flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{title}</div>
          {subtitle && <div className="text-sm text-slate-400 truncate">{subtitle}</div>}
        </div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        title="استعادة النافذة"
        className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-sky-500 hover:text-sky-300 cursor-pointer flex-shrink-0"
      >
        <RotateCcw className="w-4 h-4" />
        استعادة النافذة
      </button>
    </div>
  );
}
