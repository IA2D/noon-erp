import { Account, JournalEntry, AccountCategory, AccountType, ReportType, Employee, Customer, Vendor, CashBox, BankAccount } from '../types/erp';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface AccountingValidationResult {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  errorMessage?: string;
}

/**
 * Validates double-entry constraint: Total Debit MUST EXACTLY EQUAL Total Credit
 */
export function validateJournalEntryLines(lines: { debit: number; credit: number; accountId?: string }[], accounts?: Account[]): AccountingValidationResult {
  if (!lines || lines.length < 2) {
    return {
      isValid: false,
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
      errorMessage: 'القيد المحاسبي يجب أن يحتوي على طرفين على الأقل (مدين ودائن)'
    };
  }

  const missingAccount = lines.some(line => !line.accountId);
  if (missingAccount) {
    return {
      isValid: false,
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
      errorMessage: 'يجب اختيار حساب محاسبي لكل طرف من أطراف القيد'
    };
  }

  if (accounts) {
    const badAccount = lines.some(line => !!line.accountId && !accounts.find(a => a.id === line.accountId));
    if (badAccount) {
      return {
        isValid: false,
        totalDebit: 0,
        totalCredit: 0,
        difference: 0,
        errorMessage: 'أحد الحسابات المحددة غير موجود في دليل الحسابات'
      };
    }
    const nonPosting = lines.some(line => {
      const acc = accounts.find(a => a.id === line.accountId);
      return !!acc && !isPostingAccount(acc);
    });
    if (nonPosting) {
      return {
        isValid: false,
        totalDebit: 0,
        totalCredit: 0,
        difference: 0,
        errorMessage: 'لا يمكن ترحيل قيد على حساب غير فرعي (يجب أن يكون مستوى 5 قابلاً للترحيل)'
      };
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach(line => {
    totalDebit += Number(line.debit) || 0;
    totalCredit += Number(line.credit) || 0;
  });

  // Rounding to 2 decimal places to handle IEEE floating point differences
  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;

  if (totalDebit <= 0) {
    return {
      isValid: false,
      totalDebit,
      totalCredit,
      difference,
      errorMessage: 'لا يمكن ترحيل قيد بمبلغ صفري — أدخل مبالغ المدين والدائن أولاً'
    };
  }

  if (difference > 0.001) {
    return {
      isValid: false,
      totalDebit,
      totalCredit,
      difference,
      errorMessage: `القيد غير متوازن! الفارق بين المدين والدائن هو ${difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} عملة`
    };
  }

  return {
    isValid: true,
    totalDebit,
    totalCredit,
    difference: 0
  };
}

/**
 * عدد الأرقام التي يُضيفها كل مستوى إلى كود الأب:
 * المستوى 1: رقم واحد (1) | المستوى 2: خانتان (11) | المستوى 3: 4 خانات (1101)
 * المستوى 4: 6 خانات (110103) | المستوى 5: 10 خانات (1101030002)
 */
export const CODE_DIGITS_PER_LEVEL: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 4 };

/** الطول المتوقع لكود أي مستوى: 1 -> 2 -> 4 -> 6 -> 10 أرقام */
export function expectedCodeLength(level: number): number {
  if (level <= 0) return 0;
  return CODE_DIGITS_PER_LEVEL[level] + expectedCodeLength(level - 1);
}

/**
 * التحقق من صحة كود الحساب وفق قاعدة الترميز الصارمة:
 * طول الكود = الطول المتوقع للمستوى + الكود بادئة كود الأب عند وجوده.
 */
export function validateAccountCode(
  code: string,
  level: number,
  parentCode?: string
): { valid: boolean; expectedLength: number; error?: string } {
  const expected = expectedCodeLength(level);
  if (!/^\d+$/.test(code)) {
    return { valid: false, expectedLength: expected, error: 'الكود يجب أن يتكوّن من أرقام فقط.' };
  }
  if (code.length !== expected) {
    return {
      valid: false,
      expectedLength: expected,
      error: `كود المستوى ${level} يجب أن يكون من ${expected} أرقام بالضبط (الطول الحالي ${code.length}).`
    };
  }
  if (parentCode && !code.startsWith(parentCode)) {
    return {
      valid: false,
      expectedLength: expected,
      error: 'كود الحساب الفرعي يجب أن يبدأ بكود الحساب الأب.'
    };
  }
  return { valid: true, expectedLength: expected };
}

/** نوع الحساب (1 = رئيسي تجميعي، 2 = فرعي تشغيلي) مشتق من المستوى */
export function getAccountType(level: number): AccountType {
  return level === 5 ? 2 : 1;
}

/** نوع التقرير (1 = ميزانية عمومية، 2 = قائمة دخل) مشتق من جذر الشجرة */
export function getReportType(rootCode: string | undefined): ReportType {
  if (rootCode === '3' || rootCode === '4') return 2;
  return 1;
}

/** الحسابات التشغيلية فقط (المستوى 5 والنشطة) هي التي تقبل الترحيل — Rule A */
export function isPostingAccount(account: Account): boolean {
  return account.accountType === 2 && account.level === 5 && account.isActive;
}

export function leafAccounts(accounts: Account[]): Account[] {
  return accounts
    .filter(a => a.level === 5 && a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

export function childrenOf(accounts: Account[], parentId: string): Account[] {
  return accounts
    .filter(a => a.parentId === parentId)
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

/** مجموعة الحساب (المستوى 4) التي يتبعها حساب معين — تُستخدم لتحديد الحسابات المرتبطة بالصناديق والبنوك */
export function level4GroupOf(account: Account, accounts: Account[]): Account | undefined {
  let cur = account;
  while (cur.level > 4) {
    cur = accounts.find(a => a.id === cur.parentId);
    if (!cur) return undefined;
  }
  return cur.level === 4 ? cur : undefined;
}

/** قائمة حسابات التحكم (المجموعات من المستوى 4) التي تضم حسابات ترحيلية نشطة — تُعرض بجانب حساب المستوى الخامس */
export function controlAccountsList(postingAccounts: Account[], accounts: Account[]): Account[] {
  const map = new Map<string, Account>();
  postingAccounts.forEach(a => {
    const control = level4GroupOf(a, accounts);
    if (control && !map.has(control.id)) map.set(control.id, control);
  });
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

/** الحسابات الترحيليّة (المستوى 5) التابعة لحساب تحكم معيّن — تعرض كل الحسابات عند تمرير undefined أو '' */
export function postingAccountsInControl(
  postingAccounts: Account[],
  accounts: Account[],
  controlId: string | undefined
): Account[] {
  if (!controlId) return postingAccounts;
  return postingAccounts.filter(a => level4GroupOf(a, accounts)?.id === controlId);
}

/** حساب تحكم = حساب (مستوى 5) مرتبط بكيان من الدليل: موظف/عميل/مورد/صندوق/بنك */
export interface EntityControlAccount {
  id: string;
  code: string;
  nameAr: string;
  domain: string;
  entityCode: string;
  entityName: string;
}

/** حسابات التحكم الحقيقية = حسابات الكيانات المرتبطة بالدليل (وليست المجموعات التجميعية من المستوى 4) */
export function entityControlAccounts(
  accounts: Account[],
  employees: Employee[],
  customers: Customer[],
  vendors: Vendor[],
  cashBoxes: CashBox[],
  banks: BankAccount[]
): EntityControlAccount[] {
  const map = new Map<string, EntityControlAccount>();
  const push = (domain: string, entityCode: string, entityName: string, linkedId?: string) => {
    if (!linkedId || map.has(linkedId)) return;
    const acc = accounts.find(a => a.id === linkedId);
    if (!acc) return;
    map.set(linkedId, { id: linkedId, code: acc.code, nameAr: acc.nameAr, domain, entityCode, entityName });
  };
  employees.forEach(e => push('موظف', e.code, e.nameAr, e.linkedAccountId));
  customers.forEach(c => push('عميل', c.code, c.nameAr, c.linkedAccountId));
  vendors.forEach(v => push('مورد', v.code, v.nameAr, v.linkedAccountId));
  cashBoxes.forEach(b => push('صندوق', b.code, b.nameAr, b.linkedAccountId));
  banks.forEach(b => push('بنك', b.code, b.bankNameAr, b.linkedAccountId));
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

type LinkedDomain = 'CASH_BOX' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'EMPLOYEE_ADVANCE';

const LINKED_DOMAINS: Record<LinkedDomain, { code: string; name: string }> = {
  CASH_BOX: { code: '110101', name: 'الصندوق النقدي' },
  BANK: { code: '110102', name: 'البنوك' },
  RECEIVABLE: { code: '110201', name: 'العملاء' },
  PAYABLE: { code: '210101', name: 'ذمم موردين' },
  EMPLOYEE_ADVANCE: { code: '110205', name: 'عُهد الموظفين' }
};

function domainGroup(accounts: Account[], domain: LinkedDomain): Account | undefined {
  const def = LINKED_DOMAINS[domain];
  const found = accounts.find(a => a.level === 4 && (a.code === def.code || a.nameAr === def.name));
  if (found) return found;
  // الترحيل الرجعي ينطبق على النقد فقط: مجموعات الصناديق والبنوك تتبع فئة النقدية/البنك
  if (domain === 'CASH_BOX' || domain === 'BANK') {
    return accounts.find(a => a.level === 4 && a.category === 'CASH_BANK');
  }
  return undefined;
}

/**
 * حسابات المستوى الخامس النشطة التي تظهر في قائمة "الحساب المحاسبي المرتبط" وفق مجال الكيان:
 * الصناديق النقدية تعرض حسابات مجموعة "الصندوق النقدي" فقط، والبنوك/الصرافين حسابات مجموعة "البنوك" فقط.
 */
function postingAccountsForDomain(
  accounts: Account[],
  domain: LinkedDomain,
  currentLinkedId?: string
): Account[] {
  const group = domainGroup(accounts, domain);
  let filtered = accounts.filter(
    a => a.level === 5 && a.isActive && (group ? level4GroupOf(a, accounts)?.id === group.id : a.category === 'CASH_BANK')
  );

  // توسعة: إن لم توجد حسابات ضمن مجال الكيان (مثلاً لا توجد مجموعة صندوق نقدي/بنوك/ذمم في الدليل)،
  // تُعرض كل الحسابات التشغيلية النشطة (مستوى 5) كبديل حتى يبقى ربط الحساب ممكناً دائماً،
  // ويمكن تصحيح المجال لاحقاً من شاشة التعديل.
  if (filtered.length === 0) {
    filtered = accounts.filter(a => a.level === 5 && a.isActive);
  }

  // ضمان بقاء الحساب المرتبط حالياً ضمن القائمة حتى لو كان خارج مجال الكيان
  const current = currentLinkedId ? accounts.find(a => a.id === currentLinkedId) : undefined;
  const ids = new Set(filtered.map(a => a.id));
  if (current && !ids.has(current.id)) filtered.push(current);

  return filtered.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

export function cashBoxPostingAccounts(accounts: Account[], currentLinkedId?: string): Account[] {
  return postingAccountsForDomain(accounts, 'CASH_BOX', currentLinkedId);
}

export function bankPostingAccounts(accounts: Account[], currentLinkedId?: string): Account[] {
  return postingAccountsForDomain(accounts, 'BANK', currentLinkedId);
}

export function receivablePostingAccounts(accounts: Account[], currentLinkedId?: string): Account[] {
  return postingAccountsForDomain(accounts, 'RECEIVABLE', currentLinkedId);
}

export function payablePostingAccounts(accounts: Account[], currentLinkedId?: string): Account[] {
  return postingAccountsForDomain(accounts, 'PAYABLE', currentLinkedId);
}

export function employeeAdvancePostingAccounts(accounts: Account[], currentLinkedId?: string): Account[] {
  const list = postingAccountsForDomain(accounts, 'EMPLOYEE_ADVANCE', currentLinkedId);

  // مرونة: إن وُجد حساب تشغيلي باسم "عُهد الموظفين" في مكان آخر بالدليل — يُدرج للربط
  if (list.length === 0 || !list.some(a => a.nameAr === EMPLOYEE_ADVANCE_GROUP_NAME)) {
    const named = accounts.find(
      a => a.level === 5 && a.isActive && a.nameAr === EMPLOYEE_ADVANCE_GROUP_NAME && !list.some(x => x.id === a.id)
    );
    if (named) list.push(named);
  }

  return list.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

export const EMPLOYEE_ADVANCE_GROUP_CODE = '110205';
export const EMPLOYEE_ADVANCE_GROUP_NAME = 'عُهد الموظفين';

/** ضمان وجود مجموعة "عُهد الموظفين" في الدليل — تُضاف تلقائياً إن لم تكن موجودة (ميفريشن للبيانات المحفوظة) */
export function ensureEmployeeAdvanceGroup(accounts: Account[]): { accounts: Account[]; group: Account } {
  const existing = accounts.find(
    a => a.level === 4 && (a.code === EMPLOYEE_ADVANCE_GROUP_CODE || a.nameAr === EMPLOYEE_ADVANCE_GROUP_NAME)
  );
  if (existing) {
    const group = { ...existing, nameAr: EMPLOYEE_ADVANCE_GROUP_NAME, nameEn: 'Employee Custodies', subLedgerType: 'EMPLOYEE' as const };
    const changed = group.nameAr !== existing.nameAr || group.nameEn !== existing.nameEn || group.subLedgerType !== existing.subLedgerType;
    return { accounts: changed ? accounts.map(account => account.id === existing.id ? group : account) : accounts, group };
  }

  const group: Account = {
    id: EMPLOYEE_ADVANCE_GROUP_CODE,
    code: EMPLOYEE_ADVANCE_GROUP_CODE,
    nameAr: EMPLOYEE_ADVANCE_GROUP_NAME,
    nameEn: 'Employee Custodies',
    level: 4,
    accountType: 1,
    reportType: 1,
    parentId: '1102',
    nature: 'DEBIT',
    category: 'RECEIVABLE',
    subLedgerType: 'EMPLOYEE',
    currencies: [],
    defaultCurrency: 'YER',
    openingBalance: 0,
    isActive: true
  };
  return { accounts: [...accounts, group], group };
}

export function employeeAdvanceGeneralAccount(): Account {
  const ts = Date.now();
  return {
    id: '1102050001',
    code: '1102050001',
    nameAr: EMPLOYEE_ADVANCE_GROUP_NAME,
    nameEn: 'Employee Custodies',
    level: 5,
    accountType: 2,
    reportType: 1,
    parentId: EMPLOYEE_ADVANCE_GROUP_CODE,
    nature: 'DEBIT',
    category: 'RECEIVABLE',
    subLedgerType: 'EMPLOYEE',
    currencies: [
      { id: `cur-${ts}-yer`, code: 'YER', isDefault: true, isActive: true },
      { id: `cur-${ts}-usd`, code: 'USD', isDefault: false, isActive: true }
    ],
    defaultCurrency: 'YER',
    openingBalance: 0,
    isActive: true
  };
}

export function isLinkedOutOfDomain(
  accounts: Account[],
  domain: 'CASH_BOX' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'EMPLOYEE_ADVANCE',
  currentLinkedId?: string
): boolean {
  if (!currentLinkedId) return false;
  const current = accounts.find(a => a.id === currentLinkedId);
  if (!current) return false;
  const group = domainGroup(accounts, domain);
  if (!group) return false;
  return level4GroupOf(current, accounts)?.id !== group.id;
}

export function descendantsOf(accounts: Account[], parentId: string): Account[] {
  const result: Account[] = [];
  const walk = (pid: string) => {
    childrenOf(accounts, pid).forEach(child => {
      result.push(child);
      walk(child.id);
    });
  };
  walk(parentId);
  return result;
}

export function ancestorChain(account: Account, accounts: Account[]): Account[] {
  const chain: Account[] = [];
  let cur = account;
  while (cur.parentId) {
    const parent = accounts.find(a => a.id === cur.parentId);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}

export function rootOf(account: Account, accounts: Account[]): Account | undefined {
  const chain = ancestorChain(account, accounts);
  if (chain.length) return chain[0];
  return account.level === 1 ? account : undefined;
}

export function accountFinancialType(account: Account, accounts: Account[]): 'REVENUE' | 'EXPENSE' | 'BALANCE_SHEET' {
  const root = rootOf(account, accounts);
  if (!root) return 'BALANCE_SHEET';
  if (root.code === '3') return 'REVENUE';
  if (root.code === '4') return 'EXPENSE';
  return 'BALANCE_SHEET';
}

export function hasAncestorOrSelfCode(account: Account, accounts: Account[], prefix: string): boolean {
  if (account.code.startsWith(prefix)) return true;
  return ancestorChain(account, accounts).some(a => a.code.startsWith(prefix));
}

export function nextAccountCode(accounts: Account[], parentId?: string): string {
  if (!parentId) {
    let max = 0;
    accounts.filter(a => !a.parentId).forEach(a => {
      const n = parseInt(a.code, 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    });
    return String(max + 1);
  }

  const parent = accounts.find(a => a.id === parentId);
  if (!parent) return '';
  if (parent.level >= 5) return '';

  const childLevel = parent.level + 1;
  const suffixDigits = Math.max(expectedCodeLength(childLevel) - parent.code.length, 1);
  let maxSuffix = 0;

  accounts.filter(a => a.parentId === parentId).forEach(a => {
    const suffix = a.code.slice(parent.code.length);
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n)) maxSuffix = Math.max(maxSuffix, n);
  });

  return `${parent.code}${String(maxSuffix + 1).padStart(suffixDigits, '0')}`;
}

export function nextEntityCode<T extends { code?: string }>(
  list: T[],
  prefix: string,
  legacyPrefixes: string[] = [],
  digits = 3
): string {
  const escape = (p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = [prefix, ...legacyPrefixes].map(escape).join('|');
  const re = new RegExp(`^(${pattern})-(\\d+)$`, 'i');

  let max = 0;
  for (const item of list) {
    const m = re.exec((item.code || '').trim());
    if (m) {
      const n = parseInt(m[2], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }

  // ضمان عدم إعادة استخدام كود موجود فعلياً في القائمة (حماية من الحالات الشاذة)
  const taken = new Set(list.map(i => (i.code || '').trim().toLowerCase()));
  let candidate = max + 1;
  while (taken.has(`${prefix}-${String(candidate).padStart(digits, '0')}`.toLowerCase())) {
    candidate += 1;
  }

  return `${prefix}-${String(candidate).padStart(digits, '0')}`;
}

export function reindexAccountCodes(
  accounts: Account[],
  journals: JournalEntry[]
): { accounts: Account[]; journals: JournalEntry[] } {
  const childMap = new Map<string, Account[]>();
  accounts.forEach(a => {
    const list = childMap.get(a.parentId || '') || [];
    list.push(a);
    childMap.set(a.parentId || '', list);
  });

  // ترتيب الإخوة: بالكود الحالي رقمياً للحفاظ على الترتيب المنطقي المعروض
  const sortChildren = (list: Account[]) =>
    list.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));

  const newCodeById = new Map<string, string>();

  const walk = (parent: Account | undefined): void => {
    const children = sortChildren(childMap.get(parent ? parent.id : '') || []);
    const parentNewCode = parent ? newCodeById.get(parent.id) : undefined;
    const childLevel = parent ? parent.level + 1 : 1;
    const suffixDigits = parent
      ? Math.max(expectedCodeLength(childLevel) - parentNewCode!.length, 1)
      : 1;

    children.forEach((child, idx) => {
      const newCode = parent
        ? `${parentNewCode}${String(idx + 1).padStart(suffixDigits, '0')}`
        : String(idx + 1);
      newCodeById.set(child.id, newCode);
      walk(child);
    });
  };

  walk(undefined);

  let accountsChanged = false;
  let repairedAccounts = accounts.map(a => {
    const newCode = newCodeById.get(a.id);
    if (newCode && newCode !== a.code) {
      accountsChanged = true;
      return { ...a, code: newCode };
    }
    return a;
  });
  if (!accountsChanged) repairedAccounts = accounts;

  let journalsChanged = false;
  let repairedJournals = journals.map(j => {
    let entryChanged = false;
    const lines = j.lines.map(line => {
      const newCode = newCodeById.get(line.accountId);
      if (newCode && newCode !== line.accountCode) {
        entryChanged = true;
        return { ...line, accountCode: newCode };
      }
      return line;
    });
    if (entryChanged) {
      journalsChanged = true;
      return { ...j, lines };
    }
    return j;
  });
  if (!journalsChanged) repairedJournals = journals;

  return { accounts: repairedAccounts, journals: repairedJournals };
}

/**
 * هل يمكن حذف الحساب؟ — Rule C (Deletion Safeguard)
 * (1) يمنع الحذف إذا كان له حسابات فرعية.
 * (2) يمنع الحذف إذا ارتبط بقيود محاسبية سابقة — يُحوَّل إلى Inactive بدلاً من الحذف.
 */
export function canDeleteAccount(
  account: Account,
  accounts: Account[],
  journals: JournalEntry[]
): { allowed: boolean; reason?: string } {
  if (accounts.some(a => a.parentId === account.id)) {
    return { allowed: false, reason: 'لا يمكن حذف حساب يحتوي على حسابات فرعية — يمكن إيقافه (Inactive) بدلاً من ذلك.' };
  }
  if (journals.some(j => j.lines.some(l => l.accountId === account.id))) {
    return { allowed: false, reason: 'لا يمكن حذف حساب مرتبط بقيود محاسبية سابقة — تم تحويله إلى حساب غير نشط.' };
  }
  return { allowed: true };
}

/**
 * هل يوجد حركة مالية واحدة على الأقل على الحساب (من القيود المرحلة)؟
 * تُستخدم في Rule B لمنع تحويل الحساب التشغيلي إلى تجميعي.
 */
export function hasAccountTransactions(accountId: string, journals: JournalEntry[]): boolean {
  return journals.some(j => j.status === 'POSTED' && j.lines.some(l => l.accountId === accountId));
}

/**
 * هل يمكن تحويل حساب فرعي (مستوى 5) إلى حساب رئيسي؟ — Rule B (Parent Transition)
 * يُمنع التحويل نهائياً إذا وُجدت أي حركة مالية واحدة على الحساب.
 */
export function canPromoteToParent(
  account: Account,
  journals: JournalEntry[]
): { allowed: boolean; reason?: string } {
  if (account.level !== 5) {
    return { allowed: false, reason: 'الحساب ليس من المستوى الخامس التشغيلي — التحويل غير منطبق عليه.' };
  }
  if (hasAccountTransactions(account.id, journals)) {
    return {
      allowed: false,
      reason: 'لا يمكن تحويل حساب فرعي إلى حساب رئيسي لأنه توجد عليه حركات مالية مرحلة — أرشفه أو أنشئ حساباً جديداً.'
    };
  }
  return { allowed: true, reason: 'الحساب التشغيلي لا يحمل حركات مالية — يمكن تحويله لمستوى رئيسي.' };
}

/**
 * Rule D (Auto-Parent Assignment): المستوى التلقائي عند إضافة حساب تحت أب.
 * مستوى الابن = مستوى الأب + 1، مع منع الإضافة تحت حساب تشغيلي (المستوى 5).
 */
export function childLevelOf(parent: Account | undefined): number {
  if (!parent) return 1;
  if (parent.level >= 5) return -1;
  return parent.level + 1;
}

export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  BALANCE_SHEET: 'ميزانية عمومية',
  INCOME_STATEMENT: 'قائمة دخل',
  CASH_BANK: 'نقدية / بنك',
  RECEIVABLE: 'عملاء / ذمم مدينة',
  PAYABLE: 'موردين / ذمم دائنة',
  INVENTORY: 'مخزون'
};

export interface TrialBalanceRow {
  accountCode: string;
  accountNameAr: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
}

export function calculateAccountActivity(accounts: Account[], journals: JournalEntry[], includeAllStatuses = false): { [accountId: string]: { debit: number; credit: number } } {
  const accountBalances: { [key: string]: { debit: number; credit: number } } = {};

  accounts.forEach(acc => {
    accountBalances[acc.id] = {
      debit: acc.openingBalance > 0 ? acc.openingBalance : 0,
      credit: acc.openingBalance < 0 ? Math.abs(acc.openingBalance) : 0
    };
  });

  journals
    .filter(j => includeAllStatuses || j.status === 'POSTED')
    .forEach(entry => {
      entry.lines.forEach(line => {
        if (!accountBalances[line.accountId]) {
          accountBalances[line.accountId] = { debit: 0, credit: 0 };
        }
        accountBalances[line.accountId].debit += line.debit || 0;
        accountBalances[line.accountId].credit += line.credit || 0;
      });
    });

  return accountBalances;
}

export function netAccountBalance(
  account: Account,
  activity: { debit: number; credit: number }
): number {
  if (account.nature === 'DEBIT') {
    return activity.debit - activity.credit;
  }
  return activity.credit - activity.debit;
}

export function aggregateAccountBalance(
  account: Account,
  accounts: Account[],
  activity: { [accountId: string]: { debit: number; credit: number } }
): number {
  const children = childrenOf(accounts, account.id);
  if (children.length > 0) {
    return children.reduce((sum, c) => sum + aggregateAccountBalance(c, accounts, activity), 0);
  }
  return netAccountBalance(account, activity[account.id] || { debit: 0, credit: 0 });
}

export function calculateTrialBalance(accounts: Account[], journals: JournalEntry[]): { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; isBalanced: boolean } {
  const activity = calculateAccountActivity(accounts, journals);
  const postingAccounts = accounts.filter(isPostingAccount);

  const rows: TrialBalanceRow[] = [];
  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  postingAccounts.forEach(acc => {
    const net = netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 });
    let netDebit = 0;
    let netCredit = 0;

    if (net >= 0) {
      if (acc.nature === 'DEBIT') netDebit = net;
      else netCredit = net;
    } else {
      if (acc.nature === 'DEBIT') netCredit = Math.abs(net);
      else netDebit = Math.abs(net);
    }

    if (netDebit > 0 || netCredit > 0) {
      rows.push({
        accountCode: acc.code,
        accountNameAr: acc.nameAr,
        accountType: ACCOUNT_CATEGORY_LABELS[acc.category],
        debitBalance: netDebit,
        creditBalance: netCredit
      });

      grandTotalDebit += netDebit;
      grandTotalCredit += netCredit;
    }
  });

  grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
  grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;

  return {
    rows,
    totalDebit: grandTotalDebit,
    totalCredit: grandTotalCredit,
    isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01
  };
}

export interface StatementLine {
  key: string;
  labelAr: string;
  labelEn: string;
  amount: number;
}

function sumStatementByPrefix(
  accounts: Account[],
  activity: Record<string, { debit: number; credit: number }>,
  type: 'REVENUE' | 'EXPENSE',
  prefix: string
): number {
  let total = 0;
  accounts.filter(isPostingAccount).forEach(acc => {
    if (accountFinancialType(acc, accounts) !== type) return;
    if (!hasAncestorOrSelfCode(acc, accounts, prefix)) return;
    total += netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 });
  });
  return total;
}

function groupStatementLines(
  accounts: Account[],
  activity: Record<string, { debit: number; credit: number }>,
  type: 'REVENUE' | 'EXPENSE',
  prefixes: string[],
  groupLevel: number
): StatementLine[] {
  const map = new Map<string, StatementLine>();
  accounts.filter(isPostingAccount).forEach(acc => {
    if (accountFinancialType(acc, accounts) !== type) return;
    if (!prefixes.some(p => hasAncestorOrSelfCode(acc, accounts, p))) return;
    const chain = [acc, ...ancestorChain(acc, accounts)];
    const group = chain.find(a => a.level === groupLevel && prefixes.some(p => a.code.startsWith(p)));
    if (!group) return;
    const net = netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 });
    const existing = map.get(group.id);
    if (existing) existing.amount += net;
    else map.set(group.id, { key: group.code, labelAr: group.nameAr, labelEn: group.nameEn, amount: net });
  });
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function calculateIncomeStatement(accounts: Account[], journals: JournalEntry[], includeAllStatuses = false) {
  // Income statements are period reports. Opening/carry-forward balances belong
  // to balance-sheet and ledger reports and must never leak into period profit.
  const periodAccounts = accounts.map(account => ({ ...account, openingBalance: 0 }));
  const activity = calculateAccountActivity(periodAccounts, journals, includeAllStatuses);

  const revenueLines = groupStatementLines(accounts, activity, 'REVENUE', ['31', '32'], 3);
  const totalRevenues = sumStatementByPrefix(accounts, activity, 'REVENUE', '3');

  const expenseLines = groupStatementLines(accounts, activity, 'EXPENSE', ['41'], 3);
  const totalOperatingExpenses = sumStatementByPrefix(accounts, activity, 'EXPENSE', '41');

  const nonOperatingLines = groupStatementLines(accounts, activity, 'EXPENSE', ['42'], 3);
  const totalNonOperatingExpenses = sumStatementByPrefix(accounts, activity, 'EXPENSE', '42');

  const shownRevenues = revenueLines.reduce((s, l) => s + l.amount, 0);
  const revenueResidual = totalRevenues - shownRevenues;
  const shownOperating = expenseLines.reduce((s, l) => s + l.amount, 0);
  const operatingResidual = totalOperatingExpenses - shownOperating;

  const totalExpenses = totalOperatingExpenses + totalNonOperatingExpenses;
  const operatingProfit = totalRevenues - totalOperatingExpenses;
  const netIncome = operatingProfit - totalNonOperatingExpenses;

  return {
    revenueLines,
    revenueResidual,
    totalRevenues,
    expenseLines,
    operatingResidual,
    totalOperatingExpenses,
    nonOperatingLines,
    totalNonOperatingExpenses,
    totalExpenses,
    operatingProfit,
    netIncome
  };
}

export function calculateBalanceSheet(accounts: Account[], journals: JournalEntry[], includeAllStatuses = false) {
  const incomeStmt = calculateIncomeStatement(accounts, journals, includeAllStatuses);
  const activity = calculateAccountActivity(accounts, journals, includeAllStatuses);

  let currentAssets = 0;
  let nonCurrentAssets = 0;
  let currentLiabilities = 0;
  let nonCurrentLiabilities = 0;
  let equityBase = 0;

  accounts.filter(isPostingAccount).forEach(acc => {
    const net = netAccountBalance(acc, activity[acc.id] || { debit: 0, credit: 0 });

    if (hasAncestorOrSelfCode(acc, accounts, '11')) currentAssets += net;
    else if (hasAncestorOrSelfCode(acc, accounts, '12')) nonCurrentAssets += net;
    else if (hasAncestorOrSelfCode(acc, accounts, '2101')) currentLiabilities += net;
    else if (hasAncestorOrSelfCode(acc, accounts, '2102')) nonCurrentLiabilities += net;
    else if (hasAncestorOrSelfCode(acc, accounts, '22')) equityBase += net;
  });

  const totalAssets = currentAssets + nonCurrentAssets;
  const totalLiabilities = currentLiabilities + nonCurrentLiabilities;
  const totalEquity = equityBase + incomeStmt.netIncome; // Adding Current Year Net Income to Retained Equity
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilities,
    equityBase,
    netIncomeCurrentYear: incomeStmt.netIncome,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
  };
}

export interface CashFlowStatement {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  reconciliationDifference: number;
  isReconciled: boolean;
}

/** Direct cash-flow classification from posted ledger entries; every cash movement is classified exactly once. */
export function calculateCashFlowStatement(accounts: Account[], journals: JournalEntry[], includeAllStatuses = false): CashFlowStatement {
  const cashIds = new Set(accounts.filter(account => isPostingAccount(account) && hasAncestorOrSelfCode(account, accounts, '11') && (account.category === 'CASH_BANK' || /^11(01|02)/.test(account.code))).map(account => account.id));
  let operating = 0;
  let investing = 0;
  let financing = 0;
  journals.filter(entry => includeAllStatuses || entry.status === 'POSTED').forEach(entry => {
    const cashEffect = roundMoney(entry.lines.filter(line => cashIds.has(line.accountId)).reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0));
    if (Math.abs(cashEffect) < 0.005) return;
    const counterpart = entry.lines.map(line => accounts.find(account => account.id === line.accountId)).find((account): account is Account => !!account && !cashIds.has(account.id));
    if (counterpart && hasAncestorOrSelfCode(counterpart, accounts, '12')) investing = roundMoney(investing + cashEffect);
    else if (counterpart && (hasAncestorOrSelfCode(counterpart, accounts, '22') || hasAncestorOrSelfCode(counterpart, accounts, '2102'))) financing = roundMoney(financing + cashEffect);
    else operating = roundMoney(operating + cashEffect);
  });
  const openingCash = roundMoney(accounts.filter(account => cashIds.has(account.id)).reduce((sum, account) => sum + (account.openingBalance || 0), 0));
  const netChange = roundMoney(operating + investing + financing);
  const closingCash = roundMoney(openingCash + netChange);
  const activity = calculateAccountActivity(accounts, journals, includeAllStatuses);
  const ledgerClosingCash = roundMoney(accounts.filter(account => cashIds.has(account.id)).reduce((sum, account) => sum + netAccountBalance(account, activity[account.id] || { debit: 0, credit: 0 }), 0));
  const reconciliationDifference = roundMoney(closingCash - ledgerClosingCash);
  return { operating, investing, financing, netChange, openingCash, closingCash, reconciliationDifference, isReconciled: Math.abs(reconciliationDifference) < 0.01 };
}

export interface EquityChangesStatement {
  openingEquity: number;
  ownerMovements: number;
  netIncome: number;
  closingEquity: number;
  balanceSheetEquity: number;
  reconciliationDifference: number;
  isReconciled: boolean;
}

export function calculateEquityChangesStatement(accounts: Account[], journals: JournalEntry[], includeAllStatuses = false): EquityChangesStatement {
  const equityAccounts = accounts.filter(account => isPostingAccount(account) && hasAncestorOrSelfCode(account, accounts, '22'));
  const openingActivity = calculateAccountActivity(accounts, []);
  const openingEquity = roundMoney(equityAccounts.reduce((sum, account) => sum + netAccountBalance(account, openingActivity[account.id] || { debit: 0, credit: 0 }), 0));
  const periodAccounts = accounts.map(account => ({ ...account, openingBalance: 0 }));
  const activity = calculateAccountActivity(periodAccounts, journals.filter(entry => !entry.reference?.startsWith('CLOSE-')), includeAllStatuses);
  const ownerMovements = roundMoney(equityAccounts.reduce((sum, account) => sum + netAccountBalance(account, activity[account.id] || { debit: 0, credit: 0 }), 0));
  const netIncome = roundMoney(calculateIncomeStatement(accounts, journals.filter(entry => !entry.reference?.startsWith('CLOSE-')), includeAllStatuses).netIncome);
  const closingEquity = roundMoney(openingEquity + ownerMovements + netIncome);
  const balanceSheetEquity = roundMoney(calculateBalanceSheet(accounts, journals.filter(entry => !entry.reference?.startsWith('CLOSE-')), includeAllStatuses).totalEquity);
  const reconciliationDifference = roundMoney(closingEquity - balanceSheetEquity);
  return { openingEquity, ownerMovements, netIncome, closingEquity, balanceSheetEquity, reconciliationDifference, isReconciled: Math.abs(reconciliationDifference) < 0.01 };
}

export function nextDocumentNumber(
  prefix: string,
  existing: Array<{ entryNumber?: string; invoiceNumber?: string; trustNumber?: string; voucherNumber?: string; receiptNumber?: string; custodyNumber?: string }>
): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const reLegacy = new RegExp(`^${prefix}-\\d{4}-(\\d+)$`);
  let max = 0;

  existing.forEach(doc => {
    const number = (doc.entryNumber || doc.invoiceNumber || doc.trustNumber || doc.voucherNumber || doc.receiptNumber || doc.custodyNumber || '').match(re);
    if (number) {
      max = Math.max(max, parseInt(number[1], 10));
      return;
    }
    const legacy = (doc.entryNumber || doc.invoiceNumber || doc.trustNumber || doc.voucherNumber || doc.receiptNumber || doc.custodyNumber || '').match(reLegacy);
    if (legacy) {
      max = Math.max(max, parseInt(legacy[1], 10));
    }
  });

  return `${prefix}-${max + 1}`;
}

export function nextJournalNumber(journals: JournalEntry[]): string {
  return nextDocumentNumber('JV', journals);
}

export function nextPaymentVoucherNumber(vouchers: Array<{ voucherNumber?: string }>): string {
  return nextDocumentNumber('PV', vouchers);
}

export function nextReceiptVoucherNumber(receipts: Array<{ receiptNumber?: string }>): string {
  return nextDocumentNumber('RV', receipts);
}

export function percentChange(current: number, previous: number): number | null {
  const cur = Math.round(current * 100) / 100;
  const prev = Math.round(previous * 100) / 100;
  if (cur === 0 || prev === 0) {
    return null;
  }
  if (cur === prev) {
    return 0;
  }
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function previousMonthKey(): string {
  const now = new Date();
  return monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}
