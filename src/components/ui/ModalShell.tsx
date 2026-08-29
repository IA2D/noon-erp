import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './Toast';
import { useModalStackEntry } from './ModalStack';
import ModalHeader from './ModalHeader';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[96vw]',
};

const MIN_WINDOW_W = 400;
const MIN_WINDOW_H = 300;

type ResizeHandle = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l';

const RESIZE_HANDLES: ResizeHandle[] = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];

const HANDLE_CLASSES: Record<ResizeHandle, string> = {
  tl: 'top-0 left-0 w-3.5 h-3.5',
  t: 'top-0 left-0 right-0 h-1.5',
  tr: 'top-0 right-0 w-3.5 h-3.5',
  r: 'top-0 right-0 bottom-0 w-1.5',
  br: 'bottom-0 right-0 w-3.5 h-3.5',
  b: 'bottom-0 left-0 right-0 h-1.5',
  bl: 'bottom-0 left-0 w-3.5 h-3.5',
  l: 'top-0 left-0 bottom-0 w-1.5',
};

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  tl: 'cursor-nwse-resize',
  t: 'cursor-ns-resize',
  tr: 'cursor-nesw-resize',
  r: 'cursor-ew-resize',
  br: 'cursor-nwse-resize',
  b: 'cursor-ns-resize',
  bl: 'cursor-nesw-resize',
  l: 'cursor-ew-resize',
};

// عرض Tailwind الافتراضي لكل فئة max-w (بالريموغ؛ 1rem = 16px).
const REM_WIDTH: Record<string, number> = {
  'max-w-sm': 24,
  'max-w-md': 28,
  'max-w-lg': 32,
  'max-w-xl': 36,
  'max-w-2xl': 42,
  'max-w-3xl': 48,
  'max-w-4xl': 56,
  'max-w-5xl': 64,
  'max-w-6xl': 72,
  'max-w-7xl': 80,
};

function defaultWindowSize(maxWidth: string | undefined, size: ModalSize): { w: number; h: number } {
  const cls = (maxWidth || SIZE_CLASSES[size]).trim();
  let w = 512;
  const vw = cls.match(/max-w-\[(\d+(?:\.\d+)?)vw\]/);
  if (vw) {
    w = Math.round((window.innerWidth * parseFloat(vw[1])) / 100);
  } else if (cls === 'max-w-full') {
    w = window.innerWidth;
  } else {
    const rem = REM_WIDTH[cls];
    if (rem) w = rem * 16;
  }
  w = Math.min(w, Math.max(MIN_WINDOW_W, window.innerWidth - 16));
  const h = Math.max(MIN_WINDOW_H, Math.round((window.innerHeight * 85) / 100));
  return { w, h };
}

function centeredPosition(w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.round((window.innerWidth - w) / 2)),
    y: Math.max(0, Math.round((window.innerHeight - h) / 2)),
  };
}

interface ModalShellProps {
  /** معرف فريد للنافذة داخل المكدس — اختياري (يولَّد تلقائياً عند حذفه، مثل نوافذ F9). */
  id?: string;
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
  size?: ModalSize;
  maxWidth?: string;
  /** فوتر مخصص — عند عدم تمريره يُبنى فوتر افتراضي (رجوع + حفظ اختياري). */
  footer?: React.ReactNode;
  cancelLabel?: string;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  /** حارس البيانات غير المحفوظة: إرجاع false يمنع الإغلاق. */
  canClose?: () => boolean;
  /** يُستدعى عند محاولة إغلاق ممنوعة (لرسالة تأكيد داخل النافذة). */
  onCloseBlocked?: () => void;
  /** إغلاق النافذة عند النقر على طبقة الخلفية (عند تفعيل overlay). */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** عناصر إضافية في الهيدر (مثل رقم السند، زر طباعة). */
  topRight?: React.ReactNode;
  /** عنوان زر الرجوع في الهيدر. */
  backTitle?: string;
  /** تكبير النافذة لملء الشاشة بالكامل (100vw/100vh) — يُظهر زر الاستعادة في الهيدر. */
  maximized?: boolean;
  /** معالج زر التكبير/الاستعادة في الهيدر (نمط نوافذ ويندوز). */
  onToggleMaximize?: () => void;
  /** معالج زر التصغير — عند عدم تمريره تُستخدم وظيفة المدير (تخفي النافذة مع حفظ بياناتها). */
  onMinimize?: () => void;
  /** طبقة خلفية شفافة خفيفة جداً (bg-black/10) تُبقي الصفحة الخلفية واضحة مع إغلاق عند النقر عليها. */
  overlay?: boolean;
  /** الحد الأدنى للعرض (px) — الافتراضي 400. */
  minWidth?: number;
  /** الحد الأدنى للارتفاع (px) — الافتراضي 300. */
  minHeight?: number;
  /** الحد الأقصى للعرض (px) — الافتراضي 95vw. */
  maxWidthPx?: number;
  /** الحد الأقصى للارتفاع (px) — الافتراضي 90vh. */
  maxHeightPx?: number;
  /** هل تظهر النافذة في شريط المهام العلوي؟ الافتراضي true — نوافذ F9 والبحث لا تظهر. */
  taskbar?: boolean;
  /** الحد الأدنى لـ z-index — يضمن ظهور النافذة فوق أبويها حتى مع raise(). */
  minZIndex?: number;
  /** إخراج النافذة إلى document.body عبر Portal — يمنع قصّها داخل حاوية أب overflow:hidden
   *  أو إخفاءها بـ display:none عند تبديل التبويبات. الافتراضي true. */
  portal?: boolean;
}

export default function ModalShell({
  id,
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  maxWidth,
  footer,
  cancelLabel = 'رجوع',
  onSave,
  saveLabel = 'حفظ',
  saveDisabled = false,
  canClose,
  onCloseBlocked,
  closeOnBackdrop = true,
  children,
  className = '',
  bodyClassName = '',
  topRight,
  backTitle = 'رجوع خطوة للخلف',
  maximized = false,
  onToggleMaximize,
  onMinimize,
  overlay = false,
  minWidth,
  minHeight,
  maxWidthPx,
  maxHeightPx,
  taskbar = true,
  minZIndex,
  portal = true,
}: ModalShellProps) {
  const toast = useToast();
  const { zIndex, raise, isMinimized, minimize, setMaximized } = useModalStackEntry(id, {
    open,
    onClose,
    title,
    icon,
    canClose,
    onCloseBlocked: onCloseBlocked ?? (() => toast('error', 'توجد بيانات غير محفوظة — احفظ البيانات أو أفرغ الحقول قبل الإغلاق.')),
    taskbar,
    minZIndex,
  });

  // مزامنة حالة التكبير مع المدير (لشريط المهام العلوي).
  React.useEffect(() => {
    setMaximized(maximized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maximized]);

  const handleMinimize = onMinimize ?? minimize;

  // حدود الحجم الدنيا/القصوى (قابلة للتخصيص — تُحدَّث عند كل إعادة رسم).
  const minW = minWidth ?? MIN_WINDOW_W;
  const minH = minHeight ?? MIN_WINDOW_H;
  const maxW = Math.max(minW, maxWidthPx ?? Math.round(window.innerWidth * 0.95));
  const maxH = Math.max(minH, maxHeightPx ?? Math.round(window.innerHeight * 0.9));
  const limitsRef = useRef({ minW, minH, maxW, maxH });
  limitsRef.current = { minW, minH, maxW, maxH };

  // الحجم والموقع الافتراضيان (يُحسبان مرة واحدة عند التركيب — لا إعادة تهيئة عند كل فتح).
  const initialSizeRef = useRef<{ w: number; h: number } | null>(null);
  if (initialSizeRef.current === null) {
    const base = defaultWindowSize(maxWidth, size);
    initialSizeRef.current = {
      w: Math.min(Math.max(base.w, minW), maxW),
      h: Math.min(Math.max(base.h, minH), maxH),
    };
  }
  const [position, setPosition] = useState(() => centeredPosition(initialSizeRef.current!.w, initialSizeRef.current!.h));
  const [winSize, setWinSize] = useState(initialSizeRef.current!);

  const positionRef = useRef(position);
  positionRef.current = position;
  const sizeRef = useRef(winSize);
  sizeRef.current = winSize;

  const winElRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const moveStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeStateRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
  } | null>(null);

  // أثناء السحب/التحجيم تُحدَّث DOM مباشرة لتجنب إعادة رسم النموذج في كل حركة.
  const applyPos = (x: number, y: number) => {
    const el = winElRef.current;
    if (el) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  };

  const beginMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-drag]')) return;
    moveStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const handleMove = (e: React.PointerEvent<HTMLElement>) => {
    const m = moveStateRef.current;
    if (!m) return;
    const dx = e.clientX - m.startX;
    const dy = e.clientY - m.startY;
    const { w } = sizeRef.current;
    const maxX = Math.max(0, window.innerWidth - 80);
    const minX = Math.min(80 - w, maxX);
    const x = Math.min(Math.max(m.originX + dx, minX), maxX);
    const y = Math.min(Math.max(m.originY + dy, 0), Math.max(0, window.innerHeight - 48));
    applyPos(x, y);
  };

  const endMove = () => {
    const m = moveStateRef.current;
    if (m) {
      const el = winElRef.current;
      if (el) setPosition({ x: el.offsetLeft, y: el.offsetTop });
    }
    moveStateRef.current = null;
    document.body.style.userSelect = '';
  };

  const beginResize = (handle: ResizeHandle) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    resizeStateRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      originW: sizeRef.current.w,
      originH: sizeRef.current.h,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLElement>) => {
    const r = resizeStateRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const growLeft = r.handle.includes('l');
    const growRight = r.handle.includes('r');
    const growTop = r.handle.includes('t');
    const growBottom = r.handle.includes('b');
    let w = r.originW;
    let h = r.originH;
    let x = r.originX;
    let y = r.originY;
    if (growRight) w = r.originW + dx;
    if (growLeft) w = r.originW - dx;
    if (growBottom) h = r.originH + dy;
    if (growTop) h = r.originH - dy;
    const lim = limitsRef.current;
    w = Math.min(Math.max(w, lim.minW), lim.maxW);
    h = Math.min(Math.max(h, lim.minH), lim.maxH);
    if (growLeft) x = r.originX + (r.originW - w);
    if (growTop) y = r.originY + (r.originH - h);
    applyPos(x, y);
    const el = winElRef.current;
    if (el) {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }
  };

  const endResize = () => {
    const r = resizeStateRef.current;
    if (r) {
      const el = winElRef.current;
      if (el) {
        setWinSize({ w: el.offsetWidth, h: el.offsetHeight });
        setPosition({ x: el.offsetLeft, y: el.offsetTop });
      }
    }
    resizeStateRef.current = null;
    document.body.style.userSelect = '';
  };

  const requestClose = () => {
    if (canClose && canClose() === false) {
      if (onCloseBlocked) onCloseBlocked();
      else toast('error', 'توجد بيانات غير محفوظة — احفظ البيانات أو أفرغ الحقول قبل الإغلاق.');
      return;
    }
    onClose();
  };

  // حبس التركيز داخل أعلى نافذة وإعادته للعنصر الذي فتحها عند الإغلاق.
  React.useEffect(() => {
    if (!open || isMinimized) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = window.requestAnimationFrame(() => {
      const focusable = Array.from(winElRef.current?.querySelectorAll<HTMLElement>(selector) || []);
      (focusable[0] || winElRef.current)?.focus({ preventScroll: true });
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !winElRef.current) return;
      const focusable = Array.from(winElRef.current.querySelectorAll<HTMLElement>(selector)).filter(element => element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); winElRef.current.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap, true);
    return () => { window.cancelAnimationFrame(focusFirst); window.removeEventListener('keydown', trap, true); previousFocusRef.current?.focus({ preventScroll: true }); };
  }, [open, isMinimized]);

  if (!open) return null;

  const header = (
    <ModalHeader
      title={title}
      subtitle={subtitle}
      icon={icon}
      onClose={requestClose}
      backTitle={backTitle}
      right={topRight}
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      minimized={isMinimized}
      onMinimize={handleMinimize}
    />
  );

  const windowEl = (
    <div
      ref={winElRef}
      data-enter-scope=""
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'نافذة منبثقة'}
      tabIndex={-1}
      onPointerDown={(e) => { e.stopPropagation(); raise(); }}
      className={`flex flex-col overflow-hidden border border-slate-800 bg-slate-950 text-slate-100 shadow-xl ${
        maximized ? `${overlay ? 'absolute' : 'fixed'} inset-0 h-full w-full` : `${overlay ? 'absolute' : 'fixed'} rounded-3xl animate-scale-in`
      } ${className}`}
      style={
        {
          zIndex,
          // التصغير: إخفاء بـ CSS فقط (display:none) دون إزالة المكوّن — تُحفظ بيانات النموذج كاملة.
          ...(isMinimized ? { display: 'none' } : {}),
          ...(!maximized ? { left: position.x, top: position.y, width: winSize.w, height: winSize.h } : {}),
        }
      }
    >
      {maximized ? (
        header
      ) : (
        <div
          onPointerDown={beginMove}
          onPointerMove={handleMove}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          className="cursor-move touch-none select-none shrink-0"
        >
          {header}
        </div>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${bodyClassName || 'p-6'}`}>
        {children}
      </div>

      {footer !== undefined ? (
        footer
      ) : (
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/60 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={requestClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:border-slate-600 cursor-pointer"
          >
            {cancelLabel}
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saveLabel}
            </button>
          )}
        </div>
      )}

      {!maximized &&
        RESIZE_HANDLES.map(handle => (
          <div
            key={handle}
            onPointerDown={beginResize(handle)}
            onPointerMove={handleResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className={`absolute z-20 touch-none ${HANDLE_CLASSES[handle]} ${HANDLE_CURSOR[handle]}`}
          />
        ))}
    </div>
  );

  const content = overlay ? (
    <div className="fixed inset-0" style={{ zIndex: zIndex + 1, display: isMinimized ? 'none' : undefined }} onPointerDown={(e) => e.stopPropagation()}>
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-none"
        onMouseDown={() => {
          if (closeOnBackdrop) requestClose();
        }}
      />
      {windowEl}
    </div>
  ) : windowEl;

  return portal ? createPortal(content, document.body) : content;
}
