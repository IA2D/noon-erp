import type { CompanyBranch } from '../types/erp';
import { getPersistentItem, setPersistentItem } from './desktopStorage';

export const COMPANY_BRANCHES_KEY = 'elite-erp-company-branches-v1';

export const DEFAULT_COMPANY_BRANCH: CompanyBranch = {
  id: 'br-main',
  companyCode: 'SB-001',
  commercialRegistration: '',
  branchCode: '01',
  companyNameAr: 'شركة سبأ للمقاولات',
  companyNameEn: 'Saba Contracting Company',
  branchNameAr: 'الفرع الرئيسي',
  branchNameEn: 'Main Branch',
  taxNumber: '',
  fiscalYear: new Date().getFullYear().toString(),
  phone: '',
  fax: '',
  email: '',
  website: '',
  addressAr: '',
  addressEn: '',
  logoUrl: '',
  exportPath: '',
  allowedRoles: ['CFO', 'ACCOUNTANT', 'AUDITOR'],
  createdBy: 'system',
  createdAt: new Date().toISOString(),
  updatedBy: null,
  updatedAt: null,
};

export function emptyCompanyBranch(): CompanyBranch {
  return {
    id: '',
    companyCode: '',
    commercialRegistration: '',
    branchCode: '',
    companyNameAr: '',
    companyNameEn: '',
    branchNameAr: '',
    branchNameEn: '',
    taxNumber: '',
    fiscalYear: new Date().getFullYear().toString(),
    phone: '',
    fax: '',
    email: '',
    website: '',
    addressAr: '',
    addressEn: '',
    logoUrl: '',
    exportPath: '',
    allowedRoles: [],
    createdBy: '',
    createdAt: '',
    updatedBy: null,
    updatedAt: null,
  };
}

export function loadBranchesLocal(): CompanyBranch[] {
  try {
    const raw = getPersistentItem(COMPANY_BRANCHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CompanyBranch[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
  }
  return [{ ...DEFAULT_COMPANY_BRANCH }];
}

export function saveBranchesLocal(branches: CompanyBranch[]): void {
  try {
    setPersistentItem(COMPANY_BRANCHES_KEY, JSON.stringify(branches));
  } catch {
  }
}
