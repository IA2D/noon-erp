import React from 'react';
import {
  Info,
  Users,
  Github,
  Linkedin,
  ShieldCheck,
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useI18n } from '../../i18n';
import { PRODUCT_NAME, PRODUCT_NAME_AR, PRODUCT_VERSION } from '../../constants/brand';

const VERSION = PRODUCT_VERSION;

interface AboutCopy {
  title: string;
  subtitle: string;
  heroTitle: string;
  heroText: string;
  ifrsBadge: string;
  teamTitle: string;
  teamSubtitle: string;
  team: {
    name: string;
    role: string;
    initial: string;
    github?: string;
    linkedin?: string;
  }[];
  rights: string;
}

const TEXT: Record<'ar' | 'en', AboutCopy> = {
  ar: {
    title: 'About Us',
    subtitle: `${PRODUCT_NAME_AR} — الحل المحاسبي المتكامل للأستاذ العام`,
    heroTitle: `${PRODUCT_NAME_AR} — الحل المحاسبي المتكامل للأستاذ العام`,
    heroText:
      'نظام ERP محاسبي حديث يغطي دورة المحاسبة الكاملة بدءاً من دليل الحسابات الهرمي النقي والترحيل المزدوج الدقيق للقيود والسندات، مروراً بإدارة العهد، الأرصدة الافتتاحية، وإغلاقات الفترات المالية. يتميز النظام بسرعة استجابة فائقة تحاكي تطبيقات سطح المكتب دون انتظار، مع دعم كامل وبنائي للغة العربية (RTL)، وواجهة نوافذ متطورة تتيح فتح وتكبير وتصغير الشاشات التشغيلية بحرية تامة تلبي احتياجات المؤسسات بمرونة عالية.',
    ifrsBadge: 'متوافق مع معايير IFRS',
    teamTitle: 'الفريق البرمجي',
    teamSubtitle: 'المطورون القائمون على تطوير وصيانة النظام',
    team: [
      { name: 'ياسر محمد ياسر', role: 'المطور الرئيسي', initial: 'ي', github: 'noon-erp', linkedin: 'noon-erp' },
      { name: 'فريق واجهات FULLERP', role: 'مهندس فحص واختبار النظام', initial: 'و', github: 'fullerp-qa', linkedin: 'fullerp' },
      { name: 'فريق قواعد البيانات', role: 'المستشار المحاسبي', initial: 'ق', linkedin: 'noon-erp' },
    ],
    rights: `© 2026 ${PRODUCT_NAME_AR} — جميع الحقوق محفوظة. يُمنع إعادة توزيع النظام أو نسخه دون إذن كتابي من المطور.`,
  },
  en: {
    title: 'About Us',
    subtitle: `${PRODUCT_NAME} — the integrated accounting solution for the general ledger`,
    heroTitle: `${PRODUCT_NAME} — the integrated accounting solution for the general ledger`,
    heroText:
      'A modern ERP accounting system covering the full accounting cycle: from the hierarchical chart of accounts and precise double-entry posting of journals and vouchers, through custody management, opening balances, and period closings. The system features blazing-fast responsiveness that mimics desktop applications with zero wait time, full native Arabic (RTL) support, and an advanced windowing interface that allows opening, maximizing, and minimizing operational screens with complete freedom to meet enterprise needs with high flexibility.',
    ifrsBadge: 'IFRS Compliant',
    teamTitle: 'Development Team',
    teamSubtitle: 'The developers behind the system',
    team: [
      { name: 'Yasser Mohammed Yasser', role: 'Lead Developer', initial: 'ي', github: 'noon-erp', linkedin: 'noon-erp' },
      { name: 'Noon Frontend Team', role: 'QA & Testing Engineer', initial: 'و', github: 'noon-erp-qa', linkedin: 'noon-erp' },
      { name: 'Noon Database Team', role: 'Accounting Consultant', initial: 'ق', linkedin: 'noon-erp' },
    ],
    rights: `© 2026 ${PRODUCT_NAME} — All rights reserved. Redistribution or copying without written permission is prohibited.`,
  },
};

function SectionTitle({ icon, title, className = 'mb-5' }: { icon: React.ElementType; title: string; className?: string }) {
  const Icon = icon;
  return (
    <h2 className={`font-bold text-slate-900 text-base flex items-center gap-2.5 dark:text-slate-100 ${className}`}>
      <span className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      {title}
    </h2>
  );
}

export default function AboutUs() {
  const { lang } = useI18n();
  const t = TEXT[lang];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader icon={<Info className="w-6 h-6" />} title={t.title} subtitle={t.subtitle} />

      <div className="paper space-y-6">
      {/* الكتلة الموحدة: التعريف + المميزات */}
      <section className="bg-white rounded-2xl border border-sky-100/80 p-6 md:p-8 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">{t.heroTitle}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950/80 dark:border-sky-800/50 dark:text-sky-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t.ifrsBadge}
              </span>
              <span className="rounded-md border border-slate-200/80 bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" dir="ltr">
                {VERSION}
              </span>
            </div>
          </div>
          <div className="w-16 h-16 bg-sky-50 rounded-2xl border border-sky-100 flex items-center justify-center text-sky-600 font-bold text-2xl shadow-xs shrink-0 dark:bg-sky-950/80 dark:border-sky-800/50 dark:text-sky-400">
            ن
          </div>
        </div>
        <p className="text-slate-600 text-sm md:text-base leading-relaxed pt-2 border-t border-slate-100 dark:text-slate-400 dark:border-slate-800">
          {t.heroText}
        </p>
      </section>

      {/* الفريق البرمجي */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <SectionTitle icon={Users} title={t.teamTitle} className="mb-0" />
          <p className="text-xs text-slate-500 pt-3 dark:text-slate-400">{t.teamSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {t.team.map((m, i) => {
            const hasLinks = !!(m.github || m.linkedin);
            return (
              <div key={i} className="rounded-xl border border-slate-200/80 bg-slate-50 p-5 flex flex-col transition-all hover-lift dark:bg-slate-800/90 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-sky-100 border border-sky-200/80 text-sky-700 rounded-xl flex items-center justify-center text-lg font-black shrink-0 dark:bg-slate-800 dark:border-slate-700 dark:text-sky-400">
                    {m.initial}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate dark:text-slate-100">{m.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{m.role}</p>
                  </div>
                </div>
                {hasLinks && (
                  <>
                    <div className="flex-1" />
                    <div className="border-t border-slate-200/60 mt-4 pt-4 dark:border-slate-700">
                      <div className="flex flex-col gap-2">
                        {m.github && (
                          <a href={`https://github.com/${m.github}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 border border-sky-200/60 transition-colors hover:bg-sky-100 dark:bg-sky-600 dark:text-white dark:border-sky-500 dark:hover:bg-sky-500">
                            <Github className="w-4 h-4" />
                            GitHub
                          </a>
                        )}
                        {m.linkedin && (
                          <a href={`https://www.linkedin.com/in/${m.linkedin}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700">
                            <Linkedin className="w-4 h-4" />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-slate-500 text-center leading-relaxed dark:text-slate-400">{t.rights}</p>
      </div>
    </div>
  );
}
