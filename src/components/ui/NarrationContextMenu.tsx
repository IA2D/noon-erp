import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, CornerUpLeft } from 'lucide-react';

export interface NarrationContextMenuProps {
  x: number;
  y: number;
  rowIndex: number;
  hasPrevious: boolean;
  onCopyMain: () => void;
  onCopyPrevious: () => void;
  onClose: () => void;
}

const VIEWPORT_PADDING = 8;

/**
 * قائمة سياق البيان العامة: تظهر عند النقر الأيمن على خلية البيان
 * وتوفر نسخ البيان الرئيسي/أول بيان أو البيان السابق.
 * تُعرض عبر Portal على body لتفادي أي اقتطاع بسبب overflow/transform داخل النوافذ.
 */
export default function NarrationContextMenu({
  x,
  y,
  rowIndex,
  hasPrevious,
  onCopyMain,
  onCopyPrevious,
  onClose,
}: NarrationContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (nx + rect.width > vw - VIEWPORT_PADDING) nx = vw - rect.width - VIEWPORT_PADDING;
    if (ny + rect.height > vh - VIEWPORT_PADDING) ny = vh - rect.height - VIEWPORT_PADDING;
    el.style.left = `${Math.max(VIEWPORT_PADDING, Math.round(nx))}px`;
    el.style.top = `${Math.max(VIEWPORT_PADDING, Math.round(ny))}px`;
  }, [x, y]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="قائمة إجراءات البيان"
      data-narration-menu
      className="fixed z-[10000] min-w-[250px] rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur shadow-2xl shadow-black/60 py-1.5 animate-scale-in"
      style={{ left: x, top: y }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-3 pb-1.5 pt-1 text-xs font-bold text-slate-500 border-b border-slate-800 mb-1">
        إجراءات البيان — السطر {rowIndex + 1}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCopyMain();
          onClose();
        }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-200 hover:bg-sky-500/15 hover:text-sky-300 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
          نسخ البيان الرئيسي / أول بيان
        </span>
        <span className="text-xs text-slate-500 font-mono">F4</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!hasPrevious}
        onClick={() => {
          onCopyPrevious();
          onClose();
        }}
        title={hasPrevious ? undefined : 'لا يوجد سطر سابق — هذا هو السطر الأول'}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-200 hover:bg-sky-500/15 hover:text-sky-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-200 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <CornerUpLeft className="w-3.5 h-3.5 text-emerald-400" />
          نسخ البيان السابق
        </span>
        <span className="text-xs text-slate-500 font-mono">F3</span>
      </button>
    </div>,
    document.body
  );
}
