import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  iconClass?: string;
  valueClass?: string;
  /** نسبة التغير مقارنة بالفترة السابقة — null تعني "لا توجد بيانات للمقارنة" (شارة محايدة) */
  trend?: number | null;
  /** هل ارتفاع القيمة يُعد إيجابياً؟ (مصروفات/خسائر = false) */
  positiveIsGood?: boolean;
}

export default function KPICard({
  title,
  value,
  hint,
  icon: Icon,
  iconClass = 'bg-sky-500/20 text-sky-400',
  valueClass = 'text-white',
  trend = null,
  positiveIsGood = true
}: KPICardProps) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const neutral = !hasTrend || trend === 0;
  const isPositive = hasTrend && (trend as number) > 0;
  const isGood = isPositive === positiveIsGood;
  const trendText = hasTrend ? `${isPositive ? '+' : ''}${(trend as number).toFixed(1)}%` : '0.0%';

  return (
    <div className="stat-card min-w-0">
      <div className="flex items-start justify-between gap-3 relative min-w-0">
        <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold min-w-0 truncate">{title}</p>
        <div className={`p-2.5 rounded-xl border border-sky-100/80 dark:border-slate-700 shrink-0 ${iconClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 min-w-0 flex-wrap">
        <p className={`text-2xl font-bold tracking-tight leading-snug break-words min-w-0 ${valueClass}`}>{value}</p>
        <span
          dir="ltr"
          title={neutral ? 'لا توجد بيانات للفترة السابقة' : 'مقارنة بالفترة السابقة'}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
            neutral
              ? 'bg-slate-700/50 text-slate-400 border-slate-600/60'
              : isGood
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-red-500/15 text-red-300 border-red-500/30'
          }`}
        >
          {neutral ? <Minus className="w-3 h-3" /> : isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          <span>{neutral ? '0.0% --' : trendText}</span>
        </span>
      </div>
      {hint && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-snug">{hint}</p>}
    </div>
  );
}
