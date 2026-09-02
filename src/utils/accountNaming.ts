import type { Account } from '../types/erp';

const STANDARD_LEVEL_FIVE_NAMES: Record<string, { legacyAr: string[]; nameAr: string; nameEn: string }> = {
  '1101010001': { legacyAr: ['الصندوق الرئيسي'], nameAr: 'الصندوق العام', nameEn: 'General Cash Box' },
  '1101020001': { legacyAr: ['البنك الأهلي - الحساب الجاري'], nameAr: 'البنوك', nameEn: 'Banks' },
  '1101020002': { legacyAr: ['مصرف الراجحي - الحساب الجاري', 'صرافة الراجحي'], nameAr: 'الصرافات', nameEn: 'Exchange Houses' },
  '2201010001': { legacyAr: ['رأس المال المدفوع نقداً', 'رأس المال المدفوع نقدًا'], nameAr: 'رأس المال', nameEn: 'Capital' }
};

/** Updates only known shipped names; a user-renamed account with the same code is left untouched. */
export function normalizeStandardLevelFiveAccountNames(accounts: Account[]): Account[] {
  return accounts.map(account => {
    const standard = account.level === 5 ? STANDARD_LEVEL_FIVE_NAMES[account.code] : undefined;
    if (!standard || (!standard.legacyAr.includes(account.nameAr) && account.nameAr !== standard.nameAr)) return account;
    if (account.nameAr === standard.nameAr && account.nameEn === standard.nameEn) return account;
    return { ...account, nameAr: standard.nameAr, nameEn: standard.nameEn };
  });
}
