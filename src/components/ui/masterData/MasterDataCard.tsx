import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ERPModule } from '../../../constants/permissions';
import { useI18n } from '../../../i18n';

interface Props {
  id: string;
  icon: React.ElementType;
  title: string;
  iconClass: string;
  meta: string;
  module: ERPModule;
  onNavigate: (module: ERPModule) => void;
}

export default function MasterDataCard({ id, icon: Icon, title, iconClass, meta, module, onNavigate }: Props) {
  const { lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div
      key={id}
      onClick={() => onNavigate(module)}
      className="group relative text-right glass rounded-2xl p-6 border border-slate-700/50 hover:border-sky-500/40 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
    >
      <div className={`p-3.5 rounded-2xl border border-white/10 shadow-lg ${iconClass} group-hover:scale-110 transition-transform duration-300 w-fit`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="mt-5 font-bold text-white text-lg">{title}</h3>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-500 bg-slate-800/50 rounded-full px-2.5 py-1">{meta}</span>
        <div className="flex items-center gap-2 text-sky-400 text-xs font-bold whitespace-nowrap">
          <span>افتح الوحدة</span>
          <Arrow className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
        </div>
      </div>
    </div>
  );
}
