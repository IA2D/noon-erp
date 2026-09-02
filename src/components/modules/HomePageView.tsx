import React, { useMemo } from 'react';
import {
  Home,
  Database,
  Zap,
  FileBarChart2,
  Lock,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ERPModule } from '../../constants/permissions';
import { useI18n } from '../../i18n';
import PageHeader from '../ui/PageHeader';
import { PRODUCT_NAME_AR, PRODUCT_TAGLINE_AR } from '../../constants/brand';

interface Props {
  onNavigate: (module: ERPModule) => void;
}

interface HubBox {
  id: string;
  module: ERPModule;
  icon: React.ElementType;
  title: string;
  meta: string;
}

const BOXES: HubBox[] = [
  {
    id: 'box-inputs',
    module: 'INPUTS',
    icon: Database,
    title: 'المدخلات',
    meta: 'البيانات الأساسية',
  },
  {
    id: 'box-operations',
    module: 'OPERATIONS',
    icon: Zap,
    title: 'العمليات',
    meta: 'العمليات اليومية',
  },
  {
    id: 'box-reports',
    module: 'REPORTS',
    icon: FileBarChart2,
    title: 'التقارير',
    meta: 'التقارير المالية',
  },
  {
    id: 'box-closing',
    module: 'CLOSING',
    icon: Lock,
    title: 'الإقفالات والترحيل',
    meta: 'الإقفالات والرقابة',
  },
  {
    id: 'box-dashboard',
    module: 'DASHBOARD',
    icon: TrendingUp,
    title: 'المؤشرات المالية',
    meta: 'المؤشرات والرسوم',
  },
  {
    id: 'box-settings',
    module: 'SETTINGS',
    icon: Settings,
    title: 'الإعدادات',
    meta: 'إدارة النظام',
  },
];

function getArabicDayName(date: Date): string {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[date.getDay()];
}

function getFormattedDate(date: Date): string {
  const day = date.getDate();
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function HomePageView({ onNavigate }: Props) {
  const today = useMemo(() => new Date(), []);
  const { lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-[clamp(0.65rem,1.5vh,1.5rem)] px-2 md:px-4 py-2 animate-fade-in overflow-hidden">
      <PageHeader
        icon={<Home className="w-6 h-6" />}
        title="الصفحة الرئيسية"
        subtitle={`${PRODUCT_NAME_AR} — ${PRODUCT_TAGLINE_AR}`}
      />

      {/* Welcome Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-1">
        <p className="text-slate-700 dark:text-slate-300 text-sm font-semibold">
          أهلاً بك في {PRODUCT_NAME_AR}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs bg-[#e0f2fe] dark:bg-sky-500/15 text-[#0369a1] dark:text-sky-300 px-2.5 py-1 rounded-md border border-[#bae6fd] dark:border-sky-500/20">
            {getArabicDayName(today)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-[#f0f9ff] dark:bg-slate-800 text-[#475569] dark:text-slate-400 px-2.5 py-1 rounded-md border border-[#e2e8f0] dark:border-slate-700">
            {getFormattedDate(today)}
          </span>
        </div>
      </div>

      {/* Sections Grid */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="section-head">
          <div className="section-icon">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">أقسام النظام</h2>
            <p className="section-subtitle">اضغط على أي قسم للانتقال إلى صفحته مباشرة</p>
          </div>
          <div className="section-line" />
        </div>

        <div className="grid flex-1 min-h-0 w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-[clamp(0.65rem,1.5vh,1.25rem)]">
          {BOXES.map(box => {
            const Icon = box.icon;
            return (
              <div
                key={box.id}
                onClick={() => onNavigate(box.module)}
                className="group relative min-h-0 text-right glass rounded-2xl p-[clamp(0.8rem,2vh,1.75rem)] border border-slate-700/50 hover:border-sky-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10 cursor-pointer overflow-hidden flex flex-col justify-center"
              >
                <div className="size-[clamp(2.5rem,6vh,3.5rem)] rounded-2xl bg-sky-500/20 border border-white/10 shadow-lg text-sky-400 flex items-center justify-center mb-[clamp(0.4rem,1vh,1rem)] group-hover:scale-105 transition-transform duration-300">
                  <Icon className="size-[clamp(1.25rem,3vh,1.75rem)]" />
                </div>
                <h3 className="font-black text-white text-[clamp(1rem,2.2vh,1.5rem)] leading-tight">{box.title}</h3>
                <div className="mt-[clamp(0.45rem,1.4vh,1.25rem)] flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 bg-slate-800/50 rounded-full px-3 py-1">{box.meta}</span>
                  <div className="flex items-center gap-2 text-sky-400 text-sm font-bold whitespace-nowrap">
                    <span>افتح القسم</span>
                    <Arrow className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
