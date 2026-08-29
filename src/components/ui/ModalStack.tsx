import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useReducer,
  useRef,
} from 'react';

export const MODAL_Z_BASE = 80;
export const MODAL_Z_STEP = 20;
const MODAL_PARAM = 'modal';
/** الحد الأدنى لـ z-index للنوافذ المحصّنة (F9 / Sub-Ledger) — لا يقل عن هذا القيم regardless of stack depth. */
export const MODAL_Z_FLOOR = 500;

export interface ModalStackEntryOptions {
  open: boolean;
  onClose: () => void;
  /** حارس اختياري: إرجاع false يمنع الإغلاق (بيانات غير محفوظة). */
  canClose?: () => boolean;
  /** يُستدعى عند محاولة إغلاق ممنوعة (لعرض تنبيه داخل النافذة). */
  onCloseBlocked?: () => void;
  label?: string;
  /** عنوان النافذة المعروض في شريط المهام العلوي. */
  title?: React.ReactNode;
  /** أيقونة النافذة في شريط المهام العلوي. */
  icon?: React.ElementType;
  /** هل تظهر النافذة في شريط المهام العلوي (Taskbar)؟ الافتراضي true — نوافذ F9 والبحث لا تظهر. */
  taskbar?: boolean;
  /** الحد الأدنى لـ z-index — يضمن أن النافذة تظهر فوق أبويها حتى مع raise(). */
  minZIndex?: number;
}

/** سجل نافذة جاهز للعرض في شريط المهام العلوي. */
export interface ManagedWindow {
  id: string;
  title: React.ReactNode;
  icon?: React.ElementType;
  isMinimized: boolean;
  isMaximized: boolean;
  /** هل النافذة في قمة المكدس (المفتوحة حالياً على الشاشة)؟ */
  isActive: boolean;
}

interface StackItem {
  id: string;
}

interface ModalStackApi {
  /** إرجاع ترتيب z-index المحسوب من عمق النافذة في المكدس. */
  zIndexFor: (id: string, minZ?: number) => number;
  /** هل النافذة في قمة المكدس؟ */
  isTop: (id: string) => boolean;
  depthOf: (id: string) => number;
  /** هل النافذة مسجّلة حالياً في قائمة النوافذ المفتوحة (موجودة في windowsRef)؟ */
  isRegistered: (id: string) => boolean;
  register: (id: string, opts: Omit<ModalStackEntryOptions, 'open'>) => void;
  /** يُستدعى عند انتقال النافذة من مغلقة إلى مفتوحة. */
  open: (id: string) => void;
  /** يُستدعى عند إغلاق النافذة أو إزالتها. silent = إغلاق ناتج عن زر الرجوع. */
  unregister: (id: string, opts?: { silent?: boolean }) => void;
  /** نقل النافذة إلى قمة المكدس (رفعها فوق النوافذ الأخرى). */
  raise: (id: string) => void;
  /** تصغير النافذة (تختبئ بـ CSS وتحتفظ ببياناتها) وإخراجها من ترتيب z حتى تُستعاد. */
  minimize: (id: string) => void;
  /** استعادة نافذة مصغرة إلى الشاشة (تظهر في قمة المكدس). */
  restore: (id: string) => void;
  /** تبديل حالة التصغير. */
  toggleMinimize: (id: string) => void;
  isMinimized: (id: string) => boolean;
  isMaximized: (id: string) => boolean;
  /** تسجيل حالة التكبير في المدير (معلومات لشريط المهام). */
  setMaximized: (id: string, value: boolean) => void;
  /** إغلاق نافذة من الخارج (مثل زر × في شريط المهام) مع احترام canClose. */
  closeWindow: (id: string) => void;
  /** معرف النافذة النشطة (قمة المكدس). */
  activeId: string | null;
  /** قائمة النوافذ المفتوحة (بما فيها المصغّرة) لعرضها في شريط المهام العلوي. */
  windows: ManagedWindow[];
}

const ModalStackContext = createContext<ModalStackApi | null>(null);

function parseModalIds(search: string): string[] {
  return new URLSearchParams(search)
    .getAll(MODAL_PARAM)
    .map(s => s.trim())
    .filter(Boolean);
}

function buildUrl(modalIds: string[]): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete(MODAL_PARAM);
  modalIds.forEach(id => url.searchParams.append(MODAL_PARAM, id));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const orderRef = useRef<string[]>([]);
  const windowsRef = useRef<string[]>([]);
  const registryRef = useRef(new Map<string, Omit<ModalStackEntryOptions, 'open'>>());
  const historyClosedRef = useRef(new Set<string>());
  const urlStackRef = useRef<string[]>([]);
  const minimizedRef = useRef(new Set<string>());
  const maximizedRef = useRef(new Set<string>());
  const [, bump] = useReducer((c: number) => c + 1, 0);

  const register = useCallback((id: string, opts: Omit<ModalStackEntryOptions, 'open'>) => {
    registryRef.current.set(id, opts);
  }, []);

  const open = useCallback((id: string) => {
    const wasRegistered = windowsRef.current.includes(id);
    if (!wasRegistered) {
      windowsRef.current.push(id);
    }
    if (!orderRef.current.includes(id)) {
      orderRef.current.push(id);
    }
    if (!wasRegistered) {
      urlStackRef.current = [...urlStackRef.current, id];
      if (typeof window !== 'undefined') {
        window.history.pushState({ erpModalStack: urlStackRef.current }, '', buildUrl(urlStackRef.current));
      }
    }
    bump();
  }, []);

  const unregister = useCallback((id: string, opts?: { silent?: boolean }) => {
    const existed = orderRef.current.includes(id) || windowsRef.current.includes(id);
    orderRef.current = orderRef.current.filter(x => x !== id);
    windowsRef.current = windowsRef.current.filter(x => x !== id);
    minimizedRef.current.delete(id);
    maximizedRef.current.delete(id);
    registryRef.current.delete(id);
    if (historyClosedRef.current.has(id)) {
      historyClosedRef.current.delete(id);
      if (existed) bump();
      return;
    }
    if (!opts?.silent) {
      urlStackRef.current = urlStackRef.current.filter(x => x !== id);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ erpModalStack: urlStackRef.current }, '', buildUrl(urlStackRef.current));
      }
    }
    if (existed) bump();
  }, []);

  const zIndexFor = useCallback((id: string, minZ?: number) => {
    const idx = orderRef.current.indexOf(id);
    const base = idx < 0 ? MODAL_Z_BASE : MODAL_Z_BASE + idx * MODAL_Z_STEP;
    return minZ != null ? Math.max(base, minZ) : base;
  }, []);

  const raise = useCallback((id: string) => {
    if (!orderRef.current.includes(id)) return;
    orderRef.current = orderRef.current.filter(x => x !== id);
    orderRef.current.push(id);
    bump();
  }, []);

  const minimize = useCallback((id: string) => {
    if (!registryRef.current.has(id) || minimizedRef.current.has(id)) return;
    minimizedRef.current.add(id);
    // إخراج النافذة من ترتيب z حتى لا تستقبل Esc أو تبقى في المقدمة وهي مخفية.
    orderRef.current = orderRef.current.filter(x => x !== id);
    bump();
  }, []);

  const restore = useCallback((id: string) => {
    if (!registryRef.current.has(id)) return;
    minimizedRef.current.delete(id);
    if (!orderRef.current.includes(id)) {
      orderRef.current.push(id);
    }
    bump();
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    if (minimizedRef.current.has(id)) restore(id);
    else minimize(id);
  }, [restore, minimize]);

  const isMinimized = useCallback((id: string) => minimizedRef.current.has(id), []);

  const isMaximized = useCallback((id: string) => maximizedRef.current.has(id), []);

  const setMaximized = useCallback((id: string, value: boolean) => {
    const has = maximizedRef.current.has(id);
    if (value === has) return;
    if (value) maximizedRef.current.add(id);
    else maximizedRef.current.delete(id);
    bump();
  }, []);

  const closeWindow = useCallback((id: string) => {
    const entry = registryRef.current.get(id);
    if (!entry) return;
    if (entry.canClose && entry.canClose() === false) {
      entry.onCloseBlocked?.();
      return;
    }
    entry.onClose();
  }, []);

  const isTop = useCallback((id: string) => {
    const arr = orderRef.current;
    return arr.length > 0 && arr[arr.length - 1] === id;
  }, []);

  const depthOf = useCallback((id: string) => {
    const idx = orderRef.current.indexOf(id);
    return idx < 0 ? -1 : idx;
  }, []);

  const isRegistered = useCallback((id: string) => windowsRef.current.includes(id), []);

  const activeId = orderRef.current.length > 0 ? orderRef.current[orderRef.current.length - 1] : null;

  // قائمة النوافذ المفتوحة لشريط المهام (بما فيها المصغّرة). النوافذ دون عنوان
  // (طبقات بحث مؤقتة مثل GlobalSearch) أو النوافذ غير المرتبطة بالشريط (taskbar: false)
  // لا تُعرض كتفوذجات في الشريط.
  const windows: ManagedWindow[] = windowsRef.current
    .map((id): ManagedWindow | null => {
      const entry = registryRef.current.get(id);
      if (!entry || entry.title === undefined) return null;
      if (entry.taskbar === false) return null;
      return {
        id,
        title: entry.title,
        icon: entry.icon,
        isMinimized: minimizedRef.current.has(id),
        isMaximized: maximizedRef.current.has(id),
        isActive: activeId === id,
      };
    })
    .filter((w): w is ManagedWindow => w !== null);

  // مفتاح Escape: يغلق أعلى نافذة فقط (ويمنع انتشار الحدث لبقية المستمعين).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const arr = orderRef.current;
      if (arr.length === 0) return;
      const topId = arr[arr.length - 1];
      const entry = registryRef.current.get(topId);
      if (!entry) return;
      e.preventDefault();
      e.stopPropagation();
      if (entry.canClose && entry.canClose() === false) {
        entry.onCloseBlocked?.();
        return;
      }
      entry.onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // زر الرجوع في المتصفح: يُغلق النوافذ غير الموجودة في المسار الجديد فقط.
  useEffect(() => {
    const onPop = () => {
      const target = parseModalIds(window.location.search);
      const current = orderRef.current;
      const toClose = current.filter(id => !target.includes(id)).reverse();
      if (toClose.length === 0) return;

      toClose.forEach(id => {
        const entry = registryRef.current.get(id);
        if (!entry) return;
        if (entry.canClose && entry.canClose() === false) {
          entry.onCloseBlocked?.();
          // إعادة تأكيد المسار الحالي حتى يبقى المتصفح متزامناً مع الواجهة
          urlStackRef.current = current;
          window.history.pushState({ erpModalStack: current }, '', buildUrl(current));
          return;
        }
        historyClosedRef.current.add(id);
        entry.onClose();
      });

      urlStackRef.current = target;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // قفل تمرير الصفحة طالما توجد نافذة مفتوحة.
  useEffect(() => {
    document.body.style.overflow = orderRef.current.length > 0 ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const api: ModalStackApi = {
    zIndexFor,
    isTop,
    depthOf,
    isRegistered,
    register,
    open,
    unregister,
    raise,
    minimize,
    restore,
    toggleMinimize,
    isMinimized,
    isMaximized,
    setMaximized,
    closeWindow,
    activeId,
    windows,
  };

  return <ModalStackContext.Provider value={api}>{children}</ModalStackContext.Provider>;
}

export function useModalStack(): ModalStackApi {
  const ctx = useContext(ModalStackContext);
  if (!ctx) {
    throw new Error('useModalStack must be used within <ModalStackProvider>');
  }
  return ctx;
}

/**
 * خطاف خفيف لقراءة حالة نافذة محددة في المدير دون تسجيل مزدوج.
 * يستخدمه مكوّن الأصل (الزر) للتحقق: هل النافذة مصغرة؟ → استعادةها.
 * لا يُسجّل النافذة في المدير (التسجيل يتم عبر useModalStackEntry داخل ModalShell).
 */
export function useModalStackStatus(id: string) {
  const { isMinimized, restore, raise, isRegistered } = useModalStack();
  return {
    isRegistered: isRegistered(id),
    isMinimized: isMinimized(id),
    restore: () => restore(id),
    raise: () => raise(id),
  };
}

/**
 * خطاف التكامل الموحّد لأي نافذة منبثقة:
 * يسجّل النافذة في المدير، يدفع مسار المتصفح عند الفتح، ويرجّع z-index المحسوب
 * وحالات التصغير/التكبير ووظائف التحكم فيها (شريط المهام العلوي).
 * id اختياري — عند عدم تمريره يولّد النظام معرفاً فريداً (مناسب للمكوّنات المُستخدمة
 * في أكثر من موضع مثل F9SearchInput).
 */
export function useModalStackEntry(id: string | undefined, opts: ModalStackEntryOptions): {
  zIndex: number;
  isTop: boolean;
  depth: number;
  /** رفع النافذة إلى قمة المكدس (عند النقر داخل نافذة عائمة). */
  raise: () => void;
  /** هل النافذة مصغّرة حالياً (مخفية بـ CSS مع بقاء بياناتها)؟ */
  isMinimized: boolean;
  /** هل النافذة في وضع ملء الشاشة؟ */
  isMaximized: boolean;
  /** تصغير النافذة إلى شريط المهام العلوي. */
  minimize: () => void;
  /** استعادة النافذة من التصغير (تعود إلى قمة المكدس). */
  restore: () => void;
  /** تبديل حالة التصغير. */
  toggleMinimize: () => void;
  /** تسجيل حالة التكبير في المدير. */
  setMaximized: (value: boolean) => void;
} {
  const api = useModalStack();
  const generatedId = useId();
  const stackId = id || `m${generatedId.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const { open: isOpen, onClose, canClose, onCloseBlocked, label, title, icon, taskbar, minZIndex } = opts;

  // مراجع لأحدث القيم: `api` يُعاد إنشاؤه في كل إعادة رسم للمزود، لذا يجب عدم
  // الاعتماد عليه في اعتماديات (deps) التأثيرات — نقرأ منه عبر المرجع فقط.
  const apiRef = useRef(api);
  apiRef.current = api;
  const stackIdRef = useRef(stackId);
  stackIdRef.current = stackId;

  // إبقاء الاستدعاءات والبيانات محدّثة في سجل المزود (تُحدَّث عند كل إعادة رسم).
  useEffect(() => {
    apiRef.current.register(stackIdRef.current, { onClose, canClose, onCloseBlocked, label, title, icon, taskbar });
  });

  // دورة الحياة: مصالحة الحالة الفعلية في المدير مع الحالة المطلوبة (isOpen).
  // الاعتماد على الحالة الفعلية (وليس انتقال prevOpen) يجعل الخطاف سليماً أمام
  // React StrictMode الذي يشغّل التأثيرات مرتين (mount → cleanup → mount): بعد
  // التنظيف تُزال النافذة من المدير، فيُعيد هذا التأثير تسجيلها تلقائياً عند
  // إعادة التشغيل — فلا تُفقد النافذة من شريط المهام أبداً.
  useEffect(() => {
    const sid = stackIdRef.current;
    const registered = apiRef.current.isRegistered(sid);
    if (isOpen && !registered) {
      apiRef.current.open(sid);
    } else if (!isOpen && registered) {
      apiRef.current.unregister(sid);
    }
  }, [isOpen]);

  // التنظيف عند إزالة المكوّن من الشجرة نهائياً فقط (لا عند كل إعادة رسم للمزود —
  // وإلا أُزيلت النافذة من المدير أثناء حياتها فتُفقد من شريط المهام ولا تُستعاد).
  useEffect(() => {
    return () => {
      apiRef.current.unregister(stackIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    zIndex: api.zIndexFor(stackId, minZIndex),
    isTop: api.isTop(stackId),
    depth: api.depthOf(stackId),
    raise: () => api.raise(stackId),
    isMinimized: api.isMinimized(stackId),
    isMaximized: api.isMaximized(stackId),
    minimize: () => api.minimize(stackId),
    restore: () => api.restore(stackId),
    toggleMinimize: () => api.toggleMinimize(stackId),
    setMaximized: (value: boolean) => api.setMaximized(stackId, value),
  };
}
