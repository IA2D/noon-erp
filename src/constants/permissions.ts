export type ERPModule =
  | 'HOME'
  | 'OPERATIONS'
  | 'INPUTS'
  | 'DASHBOARD'
  | 'CHART_OF_ACCOUNTS'
  | 'OPENING_BALANCES'
  | 'JOURNAL_ENTRIES'
  | 'PAYMENT_VOUCHERS'
  | 'RECEIPT_VOUCHERS'
  | 'CASH_BOXES'
  | 'BANK_ACCOUNTS'
  | 'EMPLOYEES'
  | 'CUSTOMERS'
  | 'VENDORS'
  | 'COST_CENTERS'
  | 'CURRENCIES'
  | 'TRUSTS'
  | 'CUSTODY'
  | 'CONTRACTS'
  | 'DATA_QUALITY'
  | 'REPORTS'
  | 'STATEMENT_ACCOUNT'
  | 'AGING'
  | 'CLOSING'
  | 'AUDIT_SECURITY'
  | 'SETTINGS'
  | 'ABOUT';

export const ALL_MODULES: ERPModule[] = [
  'HOME',
  'OPERATIONS',
  'INPUTS',
  'DASHBOARD',
  'CHART_OF_ACCOUNTS',
  'OPENING_BALANCES',
  'JOURNAL_ENTRIES',
  'PAYMENT_VOUCHERS',
  'RECEIPT_VOUCHERS',
  'CASH_BOXES',
  'BANK_ACCOUNTS',
  'EMPLOYEES',
  'CUSTOMERS',
  'VENDORS',
  'COST_CENTERS',
  'CURRENCIES',
  'TRUSTS',
  'CUSTODY',
  'CONTRACTS',
  'DATA_QUALITY',
  'REPORTS',
  'STATEMENT_ACCOUNT',
  'AGING',
  'CLOSING',
  'AUDIT_SECURITY',
  'SETTINGS',
  'ABOUT'
];

export type RoleId = 'CFO' | 'ACCOUNTANT' | 'AUDITOR';

/** صلاحية تجاوز الحدود المعتمدة لسعر التحويل (تُمنح للمدير المالي افتراضياً) */
export const CAN_OVERRIDE_EXCHANGE_LIMITS = 'CAN_OVERRIDE_EXCHANGE_LIMITS';

export const ALL_PERMISSIONS: string[] = [CAN_OVERRIDE_EXCHANGE_LIMITS];

export interface RoleDefinition {
  id: RoleId;
  label: string;
  shortLabel: string;
  description: string;
  modules: ERPModule[];
  permissions?: string[];
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  CFO: {
    id: 'CFO',
    label: 'المدير المالي التنفيذي (CFO)',
    shortLabel: 'المدير المالي',
    description: 'صلاحيات كاملة على جميع الوحدات والإعدادات',
    modules: ALL_MODULES,
    permissions: [CAN_OVERRIDE_EXCHANGE_LIMITS]
  },
  ACCOUNTANT: {
    id: 'ACCOUNTANT',
    label: 'المحاسب المالي (Accountant)',
    shortLabel: 'المحاسب المالي',
    description: 'إدارة العمليات اليومية والقيود والعهد والحسابات',
    modules: [
      'HOME',
      'OPERATIONS',
      'INPUTS',
      'DASHBOARD',
      'CHART_OF_ACCOUNTS',
      'OPENING_BALANCES',
      'JOURNAL_ENTRIES',
      'PAYMENT_VOUCHERS',
      'RECEIPT_VOUCHERS',
      'CASH_BOXES',
      'BANK_ACCOUNTS',
      'EMPLOYEES',
      'CUSTOMERS',
      'VENDORS',
      'COST_CENTERS',
      'CURRENCIES',
      'TRUSTS',
      'CUSTODY',
      'CONTRACTS',
      'DATA_QUALITY',
      'REPORTS',
      'STATEMENT_ACCOUNT',
      'AGING',
      'CLOSING',
      'AUDIT_SECURITY',
      'ABOUT'
    ]
  },
  AUDITOR: {
    id: 'AUDITOR',
    label: 'المدقق المالي (Auditor)',
    shortLabel: 'المدقق المالي',
    description: 'اطلاع على التقارير وسجل التدقيق دون إجراء تعديلات',
    modules: [
      'HOME',
      'OPERATIONS',
      'INPUTS',
      'DASHBOARD',
      'CHART_OF_ACCOUNTS',
      'JOURNAL_ENTRIES',
      'PAYMENT_VOUCHERS',
      'RECEIPT_VOUCHERS',
      'CASH_BOXES',
      'BANK_ACCOUNTS',
      'REPORTS',
      'STATEMENT_ACCOUNT',
      'AGING',
      'CLOSING',
      'AUDIT_SECURITY',
      'ABOUT'
    ]
  }
};

export interface AuthUser {
  username: string;
  name: string;
  roleId: RoleId;
  /** صلاحيات دقيقة إضافية (مثل CAN_OVERRIDE_EXCHANGE_LIMITS) */
  permissions?: string[];
  mustChangePassword?: boolean;
  expiresAt?: string;
}

// مستخدمي النظام الافتراضيين (يُنصح بتغيير كلمات المرور قبل التسليم)
export const AUTH_USERS: Record<string, { password: string; name: string; roleId: RoleId }> = {
  admin: { password: 'admin123', name: 'المدير المالي', roleId: 'CFO' },
  manager: { password: 'manager123', name: 'المحاسب المالي', roleId: 'ACCOUNTANT' },
  accountant: { password: 'accountant123', name: 'المحاسب', roleId: 'ACCOUNTANT' },
  auditor: { password: 'auditor123', name: 'المدقق المالي', roleId: 'AUDITOR' }
};

export function permissionsFor(roleId: RoleId): string[] {
  return ROLES[roleId].permissions || [];
}

export const SESSION_KEY = 'elite-erp-session-v1';
