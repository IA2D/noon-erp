import React from 'react';
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { useI18n } from '../../i18n';

interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
  /** زر الرجوع — يعادل إغلاق النافذة إن لم يُمرَّر onBack. */
  onClose?: () => void;
  onBack?: () => void;
  backTitle?: string;
  closeTitle?: string;
  /** عناصر إضافية تُعرض في الطرف المقابل (مثل رقم سند، أزرار طباعة). */
  right?: React.ReactNode;
  /** حالة تكبير النافذة — عند تفعيلها يُعرض زر استعادة (المربعان المتداخلان) بدل زر التكبير. */
  maximized?: boolean;
  /** معالج زر التكبير/الاستعادة — عند تمريره تُعرض أزرار تحكم بنمط ويندوز بجوار زر الإغلاق. */
  onToggleMaximize?: () => void;
  /** حالة تصغير النافذة (لأغراض التمييز البصري عند الحاجة). */
  minimized?: boolean;
  /** معالج زر التصغير (-) — عند تمريره يُعرض زر التصغير ضمن أزرار التحكم بنمط ويندوز. */
  onMinimize?: () => void;
  className?: string;
}

export default function ModalHeader({
  title,
  subtitle,
  icon: Icon,
  onClose,
  onBack,
  backTitle = 'رجوع خطوة للخلف',
  closeTitle = 'إغلاق',
  right,
  maximized = false,
  onToggleMaximize,
  minimized = false,
  onMinimize,
  className = '',
}: ModalHeaderProps) {
  const { dir } = useI18n();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = onBack ?? onClose;

  return (
    <div className={`bg-slate-900/60 px-6 py-4 flex items-center justify-between gap-3 border-b border-slate-800 shrink-0 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <button
            type="button"
            onClick={back}
            title={backTitle}
            aria-label={backTitle}
            className="flex-shrink-0 p-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:border-sky-500/60 hover:text-sky-300 cursor-pointer"
          >
            <BackIcon className="w-4 h-4" />
          </button>
        )}
        {Icon && (
          <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-xl text-slate-100 truncate">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {right}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title={closeTitle}
            aria-label={closeTitle}
            className="p-1.5 rounded-lg text-slate-400 transition hover:text-rose-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {onToggleMaximize && (
          <button
            type="button"
            onClick={onToggleMaximize}
            title="تكبير / استعادة"
            aria-label={maximized ? 'استعادة الحجم الطبيعي' : 'تكبير النافذة'}
            className="p-1.5 rounded-lg text-slate-400 transition hover:text-blue-600 cursor-pointer"
          >
            {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
        {onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            title="تصغير"
            aria-label={minimized ? 'استعادة النافذة' : 'تصغير النافذة'}
            className="p-1.5 rounded-lg text-slate-400 transition hover:text-slate-700 cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
