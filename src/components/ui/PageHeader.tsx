import React from 'react';

interface Props {
  icon: React.ReactNode;
  title: string;
  titleBadge?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ icon, title, titleBadge, subtitle, actions }: Props) {
  return (
    <header className="block mb-6 rounded-2xl bg-[#006fba] p-4 shadow-md transition-all duration-200 dark:border dark:border-slate-800 dark:bg-slate-900 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-[#ffffff]/20 bg-[#ffffff]/15 p-2 text-[#ffffff] [&_svg]:text-[#ffffff]">
            {icon}
          </div>
          <div className="pt-0.5">
            <h1 className="text-lg font-bold text-[#ffffff] md:text-xl flex items-center gap-2">
              {title}
              {titleBadge && (
                <span
                  className="inline-flex items-center rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-black text-[#ffffff] border border-white/30 backdrop-blur-xs tracking-wide shadow-xs"
                >
                  {titleBadge}
                </span>
              )}
            </h1>
            {subtitle && <p className="mt-1 text-xs text-[#e0f2fe] dark:text-slate-300 md:text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 text-[#ffffff]">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
