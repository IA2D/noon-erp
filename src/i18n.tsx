import React, { createContext, useContext, useEffect, useState } from 'react';
import { PRODUCT_COPYRIGHT_AR, PRODUCT_NAME_AR } from './constants/brand';

export type Lang = 'ar';

export const LANG_KEY = 'elite-erp-lang';

const DICT: Record<string, { ar: string }> = {
  'app.title': { ar: PRODUCT_NAME_AR },
  'nav.notifications': { ar: 'الإشعارات' },
  'nav.noNotifications': { ar: 'لا توجد تنبيهات حالياً.' },
  'nav.trustAlert': { ar: 'عهد مفتوحة بحاجة للمتابعة' },
  'nav.trustCount': { ar: '{count} عهدة مفتوحة' },
  'nav.auditTrail': { ar: 'عرض سجل التدقيق' },
  'nav.auditSecurity': { ar: 'سجل التدقيق والصلاحيات' },
  'nav.settings': { ar: 'الإعدادات' },
  'nav.logout': { ar: 'تسجيل الخروج' },
  'nav.theme': { ar: 'تبديل المظهر' },
  'nav.closeNotifications': { ar: 'إغلاق الإشعارات' },

  'sidebar.available': { ar: 'الوحدات المتاحة لك' },
  'sidebar.main': { ar: 'القوائم الرئيسية' },
  'sidebar.operations': { ar: 'العمليات المالية' },
  'sidebar.system': { ar: 'النظام والأمان' },
  'sidebar.version': { ar: 'Enterprise ERP v4.0' },
  'sidebar.ifrs': { ar: 'IFRS & Double-Entry Compliant' },

  'login.ready': { ar: 'نسخة جاهزة للتشغيل والبدء مع العميل' },
  'login.version': { ar: 'الإصدار 4.0' },
  'login.secureStart': { ar: 'بدء آمن ومهيأ للاستخدام' },
  'login.startWith': { ar: 'ابدأ من خلال أي حساب جاهز' },
  'login.tryAccounts': { ar: 'يمكنك استخدام الحسابات أدناه لاختبار النظام بسرعة وبشكل عملي.' },
  'login.quickAccounts': { ar: 'حسابات جاهزة للتسجيل السريع:' },
  'login.username': { ar: 'اسم المستخدم' },
  'login.password': { ar: 'كلمة المرور' },
  'login.usernamePlaceholder': { ar: 'أدخل اسم المستخدم' },
  'login.passwordPlaceholder': { ar: 'أدخل كلمة المرور' },
  'login.signingIn': { ar: 'جاري تسجيل الدخول...' },
  'login.signIn': { ar: 'تسجيل الدخول' },
  'login.invalid': { ar: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
  'login.copyright': { ar: PRODUCT_COPYRIGHT_AR },
  'login.readyFooter': { ar: 'مهيأ للتسليم والبدء الفوري' },

  'settings.title': { ar: 'الإعدادات' },
  'settings.subtitle': { ar: 'تخصيص إعدادات النظام والبيانات والأمان' },
  'settings.appearance': { ar: 'المظهر والواجهة' },
  'settings.appearanceDesc': { ar: 'التحكم في مظهر النظام ولغة الواجهة.' },
  'settings.themeLabel': { ar: 'نمط المظهر' },
  'settings.themeDark': { ar: 'داكن' },
  'settings.themeLight': { ar: 'فاتح' },
  'settings.general': { ar: 'الإعدادات العامة' },
  'settings.companyName': { ar: 'اسم الشركة' },
  'settings.defaultCurrency': { ar: 'العملة الافتراضية' },
  'settings.data': { ar: 'إدارة البيانات' },
  'settings.dataDesc': { ar: 'إنشاء نسخة احتياطية أو إعادة تهيئة النظام بالكامل قبل التسليم.' },
  'settings.backup': { ar: 'نسخة احتياطية' },
  'settings.resetData': { ar: 'مسح البيانات وإعادة التهيئة' },
  'settings.db': { ar: 'قاعدة البيانات والتخزين' },
  'settings.notifications': { ar: 'إعدادات الإشعارات' },
  'settings.security': { ar: 'إعدادات الأمان' },
  'settings.save': { ar: 'حفظ التغييرات' },
  'settings.saved': { ar: 'تم الحفظ' },
  'settings.savedToast': { ar: 'تم حفظ الإعدادات بنجاح.' },
  'settings.savedError': { ar: 'تعذر حفظ الإعدادات. تأكد من مساحة التخزين المتاحة.' },

  'tabs.label': { ar: 'الشاشات المفتوحة' },
  'tabs.closeTab': { ar: 'إغلاق التبويب' },
  'tabs.closeOthers': { ar: 'إغلاق التبويبات الأخرى' },
  'tabs.closeLeft': { ar: 'إغلاق التي على اليسار' },
  'tabs.closeRight': { ar: 'إغلاق التي على اليمين' },
  'tabs.cancel': { ar: 'إلغاء' },
  'tabs.reloadTab': { ar: 'إعادة تحميل الشاشة' },
  'tabs.allTabs': { ar: 'كل الشاشات المفتوحة' },
  'tabs.unsavedTitle': { ar: 'تعديلات غير محفوظة' },
  'tabs.unsavedMessage': { ar: 'توجد تعديلات لم تُحفظ في "{title}". هل أنت متأكد من الإغلاق؟' },
  'tabs.keepOpen': { ar: 'إبقاء الشاشة مفتوحة' },
  'tabs.discardAndClose': { ar: 'إغلاق وتجاهل التعديلات' },
};

interface I18nContextValue {
  lang: Lang;
  dir: 'rtl';
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'ar',
  dir: 'rtl',
  t: key => DICT[key]?.ar ?? key
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang: Lang = 'ar';
  const dir: 'rtl' = 'rtl';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', dir);
  }, []);

  const t = (key: string, vars?: Record<string, string | number>) => {
    let str = DICT[key]?.ar ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ lang, dir, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
