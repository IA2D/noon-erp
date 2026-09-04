import {
  Account,
  AccountLevel,
  AccountNature,
  AccountCategory,
  AccountCurrency,
  SubLedgerType,
  Currency,
  CostCenter,
  JournalEntry,
  AuditLog,
  Trust,
  Custody,
  CashBox,
  BankAccount,
  PaymentVoucher,
  ReceiptVoucher,
  Employee,
  Customer,
  Vendor
} from '../types/erp';

// ============================================================
// البذرة الافتراضية — دليل الحسابات الشجري المتكامل (5 مستويات)
// الترميز الذكي الصارم: 1 -> 11 -> 1101 -> 110103 -> 1101030002
//   المستوى 1: رقم واحد  |  المستوى 2: خانتان  |  المستوى 3: 4 خانات
//   المستوى 4: 6 خانات   |  المستوى 5: 10 خانات (تشغيلي فقط)
// المستويات 1-4 تجميعية (لا تقبل الترحيل)، المستوى 5 فقط يقبل القيود.
// accountType: 1 = رئيسي (1-4) / 2 = فرعي تشغيلي (5)
// reportType:  1 = ميزانية عمومية / 2 = قائمة دخل
// جميع الأرصدة صفرية (الرصيد الافتتاحي يحدده المحاسب عند الترحيل).
// ============================================================

/** العملات الافتراضية للحسابات التشغيلية (مستوى 5) */
function standardCurrencies(): AccountCurrency[] {
  return [
    { id: 'cur-yer', code: 'YER', isDefault: true, isActive: true },
    { id: 'cur-usd', code: 'USD', isDefault: false, isActive: true }
  ];
}

function ac(
  code: string,
  nameAr: string,
  nameEn: string,
  level: AccountLevel,
  parentId: string | undefined,
  nature: AccountNature,
  category: AccountCategory,
  isActive = true,
  subLedgerType: SubLedgerType = 'NONE'
): Account {
  const isPosting = level === 5;
  return {
    id: code,
    code,
    nameAr,
    nameEn,
    level,
    accountType: isPosting ? 2 : 1,
    reportType: category === 'INCOME_STATEMENT' ? 2 : 1,
    parentId,
    nature,
    category,
    subLedgerType,
    currencies: isPosting ? standardCurrencies() : [],
    defaultCurrency: 'YER',
    openingBalance: 0,
    isActive
  };
}

// ------------------------------------------------------------------
// المستوى الأول: المجموعات الرئيسية (4 مجموعات فقط — رقم واحد)
// ------------------------------------------------------------------
const l1Assets = ac('1', 'الأصول', 'Assets', 1, undefined, 'DEBIT', 'BALANCE_SHEET');
const l1LiabEquity = ac('2', 'الخصوم وحقوق الملكية', 'Liabilities & Equity', 1, undefined, 'CREDIT', 'BALANCE_SHEET');
const l1Revenue = ac('3', 'الإيرادات', 'Revenues', 1, undefined, 'CREDIT', 'INCOME_STATEMENT');
const l1Expenses = ac('4', 'المصروفات', 'Expenses', 1, undefined, 'DEBIT', 'INCOME_STATEMENT');

// ------------------------------------------------------------------
// المستوى الثاني (خانتان)
// ------------------------------------------------------------------
const l2Assets_11 = ac('11', 'الأصول المتداولة', 'Current Assets', 2, '1', 'DEBIT', 'BALANCE_SHEET');
const l2Assets_12 = ac('12', 'الأصول غير المتداولة', 'Non-Current Assets', 2, '1', 'DEBIT', 'BALANCE_SHEET');

const l2Liab_21 = ac('21', 'الخصوم', 'Liabilities', 2, '2', 'CREDIT', 'BALANCE_SHEET');
const l2Equity_22 = ac('22', 'حقوق الملكية', 'Equity', 2, '2', 'CREDIT', 'BALANCE_SHEET');

const l2Rev_31 = ac('31', 'الإيرادات التشغيلية', 'Operating Revenues', 2, '3', 'CREDIT', 'INCOME_STATEMENT');
const l2Rev_32 = ac('32', 'الإيرادات الأخرى', 'Other Revenues', 2, '3', 'CREDIT', 'INCOME_STATEMENT');

const l2Exp_41 = ac('41', 'المصروفات التشغيلية', 'Operating Expenses', 2, '4', 'DEBIT', 'INCOME_STATEMENT');
const l2Exp_42 = ac('42', 'المصروفات غير التشغيلية', 'Non-Operating Expenses', 2, '4', 'DEBIT', 'INCOME_STATEMENT');

// ------------------------------------------------------------------
// المستوى الثالث (4 خانات) — كود الأب (خانتان) + خانتان
// ------------------------------------------------------------------
const l3_1101 = ac('1101', 'النقد وما في حكمه', 'Cash & Cash Equivalents', 3, '11', 'DEBIT', 'CASH_BANK');
const l3_1102 = ac('1102', 'الذمم المدينة والمستحقات', 'Receivables', 3, '11', 'DEBIT', 'RECEIVABLE');
const l3_1103 = ac('1103', 'الأصول المتداولة الأخرى', 'Other Current Assets', 3, '11', 'DEBIT', 'BALANCE_SHEET');

const l3_1201 = ac('1201', 'الأصول الثابتة', 'Property & Equipment', 3, '12', 'DEBIT', 'BALANCE_SHEET');
const l3_1202 = ac('1202', 'الأصول غير الملموسة', 'Intangible Assets', 3, '12', 'DEBIT', 'BALANCE_SHEET');
const l3_1203 = ac('1203', 'الاستثمارات طويلة الأجل', 'Long-Term Investments', 3, '12', 'DEBIT', 'BALANCE_SHEET');

const l3_2101 = ac('2101', 'الخصوم المتداولة', 'Current Liabilities', 3, '21', 'CREDIT', 'BALANCE_SHEET');
const l3_2102 = ac('2102', 'الخصوم غير المتداولة', 'Non-Current Liabilities', 3, '21', 'CREDIT', 'BALANCE_SHEET');
const l3_2201 = ac('2201', 'رأس المال', 'Capital', 3, '22', 'CREDIT', 'BALANCE_SHEET');
const l3_2202 = ac('2202', 'الأرباح المبقاة', 'Retained Earnings', 3, '22', 'CREDIT', 'BALANCE_SHEET');

const l3_3101 = ac('3101', 'إيرادات الخدمات', 'Services Revenues', 3, '31', 'CREDIT', 'INCOME_STATEMENT');
const l3_3201 = ac('3201', 'إيرادات استثمارية', 'Investment Income', 3, '32', 'CREDIT', 'INCOME_STATEMENT');
const l3_3202 = ac('3202', 'إيرادات متنوعة', 'Miscellaneous Income', 3, '32', 'CREDIT', 'INCOME_STATEMENT');

const l3_4101 = ac('4101', 'الرواتب والأجور', 'Salaries & Wages', 3, '41', 'DEBIT', 'INCOME_STATEMENT');
const l3_4102 = ac('4102', 'الإيجارات والأملاك', 'Rent & Utilities', 3, '41', 'DEBIT', 'INCOME_STATEMENT');
const l3_4103 = ac('4103', 'المصاريف العمومية والإدارية', 'General & Administrative', 3, '41', 'DEBIT', 'INCOME_STATEMENT');
const l3_4104 = ac('4104', 'التسويق والمبيعات', 'Marketing & Sales', 3, '41', 'DEBIT', 'INCOME_STATEMENT');
const l3_4105 = ac('4105', 'الاستهلاك والإطفاء', 'Depreciation & Amortization', 3, '41', 'DEBIT', 'INCOME_STATEMENT');
const l3_4201 = ac('4201', 'المصاريف التمويلية', 'Financing Costs', 3, '42', 'DEBIT', 'INCOME_STATEMENT');
const l3_4202 = ac('4202', 'الزكاة والضرائب', 'Zakat & Taxes', 3, '42', 'DEBIT', 'INCOME_STATEMENT');

// ------------------------------------------------------------------
// المستوى الرابع (6 خانات) — كود الأب (4 خانات) + خانتان
// ------------------------------------------------------------------
const l4_110101 = ac('110101', 'الصندوق النقدي', 'Cash on Hand', 4, '1101', 'DEBIT', 'CASH_BANK');
const l4_110102 = ac('110102', 'البنوك', 'Bank Accounts', 4, '1101', 'DEBIT', 'CASH_BANK');

const l4_110201 = ac('110201', 'العملاء', 'Customers / Accounts Receivable', 4, '1102', 'DEBIT', 'RECEIVABLE');
const l4_110202 = ac('110202', 'أوراق قبض', 'Notes Receivable', 4, '1102', 'DEBIT', 'RECEIVABLE');
const l4_110203 = ac('110203', 'ذمم مدينة أخرى', 'Other Receivables', 4, '1102', 'DEBIT', 'RECEIVABLE');
const l4_110204 = ac('110204', 'مخصص الديون المشكوك في تحصيلها', 'Allowance for Doubtful Debts', 4, '1102', 'CREDIT', 'RECEIVABLE');
const l4_110205 = ac('110205', 'عُهد الموظفين', 'Employee Custodies', 4, '1102', 'DEBIT', 'RECEIVABLE');

const l4_110301 = ac('110301', 'مصاريف مدفوعة مقدماً', 'Prepaid Expenses', 4, '1103', 'DEBIT', 'BALANCE_SHEET');
const l4_110302 = ac('110302', 'دفعات مقدمة', 'Advances Paid', 4, '1103', 'DEBIT', 'BALANCE_SHEET');

// ------------------------------------------------------------------
// المستوى الرابع — الأصول غير المتداولة
// ------------------------------------------------------------------
const l4_120101 = ac('120101', 'مباني', 'Buildings', 4, '1201', 'DEBIT', 'BALANCE_SHEET');
const l4_120102 = ac('120102', 'أجهزة ومعدات', 'Equipment', 4, '1201', 'DEBIT', 'BALANCE_SHEET');
const l4_120103 = ac('120103', 'سيارات ومركبات', 'Vehicles', 4, '1201', 'DEBIT', 'BALANCE_SHEET');
const l4_120104 = ac('120104', 'مجمع إهلاك الأصول الثابتة', 'Accumulated Depreciation', 4, '1201', 'CREDIT', 'BALANCE_SHEET');

const l4_120201 = ac('120201', 'برمجيات وحقوق ملكية فكرية', 'Software & Intellectual Property', 4, '1202', 'DEBIT', 'BALANCE_SHEET');
const l4_120301 = ac('120301', 'استثمارات أسهم وسندات', 'Equity & Bond Investments', 4, '1203', 'DEBIT', 'BALANCE_SHEET');

// ------------------------------------------------------------------
// المستوى الرابع — الخصوم وحقوق الملكية
// ------------------------------------------------------------------
const l4_210101 = ac('210101', 'ذمم موردين', 'Accounts Payable', 4, '2101', 'CREDIT', 'PAYABLE');
const l4_210102 = ac('210102', 'رواتب وأجور مستحقة', 'Accrued Salaries', 4, '2101', 'CREDIT', 'BALANCE_SHEET');
const l4_210103 = ac('210103', 'ضرائب مستحقة', 'Taxes Payable', 4, '2101', 'CREDIT', 'BALANCE_SHEET');
const l4_210104 = ac('210104', 'دفعات مستلمة مقدماً', 'Customer Advances', 4, '2101', 'CREDIT', 'BALANCE_SHEET');

const l4_210201 = ac('210201', 'قروض طويلة الأجل', 'Long-Term Loans', 4, '2102', 'CREDIT', 'BALANCE_SHEET');

const l4_220101 = ac('220101', 'رأس المال المدفوع', 'Paid-Up Capital', 4, '2201', 'CREDIT', 'BALANCE_SHEET');
const l4_220201 = ac('220201', 'الأرباح المبقاة التراكمية', 'Accumulated Retained Earnings', 4, '2202', 'CREDIT', 'BALANCE_SHEET');

// ------------------------------------------------------------------
// المستوى الرابع — الإيرادات والمصروفات
// ------------------------------------------------------------------
const l4_310101 = ac('310101', 'خدمات استشارية', 'Consulting Services', 4, '3101', 'CREDIT', 'INCOME_STATEMENT');
const l4_320101 = ac('320101', 'فوائد وأرباح', 'Interest & Dividends', 4, '3201', 'CREDIT', 'INCOME_STATEMENT');
const l4_320201 = ac('320201', 'إيرادات متنوعة أخرى', 'Other Miscellaneous Income', 4, '3202', 'CREDIT', 'INCOME_STATEMENT');

const l4_410101 = ac('410101', 'رواتب الموظفين', 'Staff Salaries', 4, '4101', 'DEBIT', 'INCOME_STATEMENT');
const l4_410102 = ac('410102', 'بدلات ومكافآت', 'Allowances & Bonuses', 4, '4101', 'DEBIT', 'INCOME_STATEMENT');
const l4_410201 = ac('410201', 'إيجارات', 'Rent', 4, '4102', 'DEBIT', 'INCOME_STATEMENT');
const l4_410202 = ac('410202', 'كهرباء ومياه واتصالات', 'Utilities & Telecom', 4, '4102', 'DEBIT', 'INCOME_STATEMENT');
const l4_410301 = ac('410301', 'قرطاسية ومستلزمات مكتب', 'Office Supplies', 4, '4103', 'DEBIT', 'INCOME_STATEMENT');
const l4_410302 = ac('410302', 'استشارات ومصاريف مهنية', 'Professional Fees', 4, '4103', 'DEBIT', 'INCOME_STATEMENT');
const l4_410401 = ac('410401', 'إعلانات وتسويق', 'Advertising & Marketing', 4, '4104', 'DEBIT', 'INCOME_STATEMENT');
const l4_410501 = ac('410501', 'إهلاك واستهلاك', 'Depreciation Expense', 4, '4105', 'DEBIT', 'INCOME_STATEMENT');
const l4_420101 = ac('420101', 'فوائد قروض', 'Loan Interest', 4, '4201', 'DEBIT', 'INCOME_STATEMENT');
const l4_420201 = ac('420201', 'زكاة', 'Zakat', 4, '4202', 'DEBIT', 'INCOME_STATEMENT');
const l4_420202 = ac('420202', 'ضريبة الدخل', 'Income Tax', 4, '4202', 'DEBIT', 'INCOME_STATEMENT');

// ------------------------------------------------------------------
// المستوى الخامس (10 خانات) — الحسابات التشغيلية فقط (تقبل القيود)
// ------------------------------------------------------------------
const l5_1101010001 = ac('1101010001', 'الصندوق العام', 'General Cash Box', 5, '110101', 'DEBIT', 'CASH_BANK');
const l5_1101010002 = ac('1101010002', 'صندوق الاستقبال', 'Reception Cash Box', 5, '110101', 'DEBIT', 'CASH_BANK');
const l5_1101020001 = ac('1101020001', 'البنوك', 'Banks', 5, '110102', 'DEBIT', 'CASH_BANK');
const l5_1101020002 = ac('1101020002', 'الصرافات', 'Exchange Houses', 5, '110102', 'DEBIT', 'CASH_BANK', true, 'EXCHANGER');

const l5_1102010001 = ac('1102010001', 'عملاء محليون', 'Local Customers', 5, '110201', 'DEBIT', 'RECEIVABLE', true, 'CUSTOMER');
const l5_1102010002 = ac('1102010002', 'عملاء حكوميون', 'Government Customers', 5, '110201', 'DEBIT', 'RECEIVABLE', true, 'CUSTOMER');
const l5_1102020001 = ac('1102020001', 'أوراق قبض تحت التحصيل', 'Notes Receivable - Collection', 5, '110202', 'DEBIT', 'RECEIVABLE');
const l5_1102030001 = ac('1102030001', 'ذمم موظفين', 'Employee Receivables', 5, '110203', 'DEBIT', 'RECEIVABLE');
const l5_1102030002 = ac('1102030002', 'ذمم مدينة أخرى متنوعة', 'Other Receivables', 5, '110203', 'DEBIT', 'RECEIVABLE');
const l5_1102040001 = ac('1102040001', 'مخصص الديون المشكوك في تحصيلها', 'Allowance for Doubtful Debts', 5, '110204', 'CREDIT', 'RECEIVABLE');
const l5_1102050001 = ac('1102050001', 'عُهد الموظفين', 'Employee Custodies', 5, '110205', 'DEBIT', 'RECEIVABLE', true, 'EMPLOYEE');

const l5_1103010001 = ac('1103010001', 'مصاريف إيجار مدفوعة مسبقاً', 'Prepaid Rent', 5, '110301', 'DEBIT', 'BALANCE_SHEET');
const l5_1103020001 = ac('1103020001', 'دفعات مقدمة للموردين', 'Advances to Suppliers', 5, '110302', 'DEBIT', 'BALANCE_SHEET');

const l5_1201010001 = ac('1201010001', 'مبانٍ إدارية', 'Office Buildings', 5, '120101', 'DEBIT', 'BALANCE_SHEET');
const l5_1201020001 = ac('1201020001', 'أجهزة حاسب ومعدات مكتب', 'Computers & Office Equipment', 5, '120102', 'DEBIT', 'BALANCE_SHEET');
const l5_1201030001 = ac('1201030001', 'سيارات النقل', 'Delivery Vehicles', 5, '120103', 'DEBIT', 'BALANCE_SHEET');
const l5_1201040001 = ac('1201040001', 'مجمع إهلاك المباني', 'Accumulated Depreciation - Buildings', 5, '120104', 'CREDIT', 'BALANCE_SHEET');
const l5_1201040002 = ac('1201040002', 'مجمع إهلاك المعدات', 'Accumulated Depreciation - Equipment', 5, '120104', 'CREDIT', 'BALANCE_SHEET');

const l5_1202010001 = ac('1202010001', 'أنظمة برمجية وتراخيص', 'Software Licenses', 5, '120201', 'DEBIT', 'BALANCE_SHEET');
const l5_1203010001 = ac('1203010001', 'استثمارات طويلة الأجل', 'Long-Term Investments', 5, '120301', 'DEBIT', 'BALANCE_SHEET');

const l5_2101010001 = ac('2101010001', 'موردون محليون', 'Local Suppliers', 5, '210101', 'CREDIT', 'PAYABLE', true, 'SUPPLIER');
const l5_2101010002 = ac('2101010002', 'موردون خارجيون', 'Foreign Suppliers', 5, '210101', 'CREDIT', 'PAYABLE', true, 'SUPPLIER');
const l5_2101020001 = ac('2101020001', 'رواتب الشهر المستحقة', 'Monthly Salaries Payable', 5, '210102', 'CREDIT', 'BALANCE_SHEET');
const l5_2101030001 = ac('2101030001', 'ضريبة القيمة المضافة المستحقة', 'VAT Payable', 5, '210103', 'CREDIT', 'BALANCE_SHEET');
const l5_2101030002 = ac('2101030002', 'زكاة ودخل مستحق', 'Zakat & Income Payable', 5, '210103', 'CREDIT', 'BALANCE_SHEET');
const l5_2101040001 = ac('2101040001', 'عربونات عملاء', 'Customer Deposits', 5, '210104', 'CREDIT', 'BALANCE_SHEET');

const l5_2102010001 = ac('2102010001', 'قرض البنك طويل الأجل', 'Long-Term Bank Loan', 5, '210201', 'CREDIT', 'BALANCE_SHEET');

const l5_2201010001 = ac('2201010001', 'رأس المال', 'Capital', 5, '220101', 'CREDIT', 'BALANCE_SHEET');
const l5_2202010001 = ac('2202010001', 'أرباح مبقاة تراكمية', 'Accumulated Retained Earnings', 5, '220201', 'CREDIT', 'BALANCE_SHEET');

const l5_3101010001 = ac('3101010001', 'خدمات استشارية', 'Consulting Services', 5, '310101', 'CREDIT', 'INCOME_STATEMENT');
const l5_3101010002 = ac('3101010002', 'خدمات صيانة', 'Maintenance Services', 5, '310101', 'CREDIT', 'INCOME_STATEMENT');
const l5_3201010001 = ac('3201010001', 'إيرادات ودائع وأسهم', 'Deposits & Equity Income', 5, '320101', 'CREDIT', 'INCOME_STATEMENT');
const l5_3202010001 = ac('3202010001', 'إيرادات متفرقة', 'Miscellaneous Income', 5, '320201', 'CREDIT', 'INCOME_STATEMENT');

const l5_4101010001 = ac('4101010001', 'رواتب أساسية', 'Basic Salaries', 5, '410101', 'DEBIT', 'INCOME_STATEMENT');
const l5_4101010002 = ac('4101010002', 'رواتب ومكافآت إدارية', 'Management Salaries', 5, '410101', 'DEBIT', 'INCOME_STATEMENT');
const l5_4101020001 = ac('4101020001', 'بدل سكن ومواصلات', 'Housing & Transport Allowance', 5, '410102', 'DEBIT', 'INCOME_STATEMENT');
const l5_4102010001 = ac('4102010001', 'إيجار المقر الرئيسي', 'Head Office Rent', 5, '410201', 'DEBIT', 'INCOME_STATEMENT');
const l5_4102020001 = ac('4102020001', 'فواتير الكهرباء والمياه', 'Electricity & Water', 5, '410202', 'DEBIT', 'INCOME_STATEMENT');
const l5_4102020002 = ac('4102020002', 'فواتير الاتصالات والإنترنت', 'Telecom & Internet', 5, '410202', 'DEBIT', 'INCOME_STATEMENT');
const l5_4103010001 = ac('4103010001', 'قرطاسية ومستلزمات مكتب', 'Office Supplies', 5, '410301', 'DEBIT', 'INCOME_STATEMENT');
const l5_4103020001 = ac('4103020001', 'رسوم استشارية', 'Consulting Fees', 5, '410302', 'DEBIT', 'INCOME_STATEMENT');
const l5_4104010001 = ac('4104010001', 'حملات إعلانية', 'Advertising Campaigns', 5, '410401', 'DEBIT', 'INCOME_STATEMENT');
const l5_4105010001 = ac('4105010001', 'إهلاك المباني', 'Depreciation - Buildings', 5, '410501', 'DEBIT', 'INCOME_STATEMENT');
const l5_4105010002 = ac('4105010002', 'إهلاك الأجهزة والمعدات', 'Depreciation - Equipment', 5, '410501', 'DEBIT', 'INCOME_STATEMENT');
const l5_4201010001 = ac('4201010001', 'فوائد القروض البنكية', 'Bank Loan Interest', 5, '420101', 'DEBIT', 'INCOME_STATEMENT');
const l5_4202010001 = ac('4202010001', 'زكاة الشركة السنوية', 'Annual Zakat', 5, '420201', 'DEBIT', 'INCOME_STATEMENT');
const l5_4202020001 = ac('4202020001', 'ضريبة الدخل المستحقة', 'Income Tax Payable', 5, '420202', 'DEBIT', 'INCOME_STATEMENT');

// ============================================================
// تجميع الدليل الكامل
// ============================================================
export const initialAccounts: Account[] = [
  l1Assets, l1LiabEquity, l1Revenue, l1Expenses,

  l2Assets_11, l2Assets_12,
  l2Liab_21, l2Equity_22,
  l2Rev_31, l2Rev_32,
  l2Exp_41, l2Exp_42,

  l3_1101, l3_1102, l3_1103,
  l3_1201, l3_1202, l3_1203,
  l3_2101, l3_2102, l3_2201, l3_2202,
  l3_3101, l3_3201, l3_3202,
  l3_4101, l3_4102, l3_4103, l3_4104, l3_4105, l3_4201, l3_4202,

  l4_110101, l4_110102,
  l4_110201, l4_110202, l4_110203, l4_110204, l4_110205,
  l4_110301, l4_110302,
  l4_120101, l4_120102, l4_120103, l4_120104,
  l4_120201, l4_120301,
  l4_210101, l4_210102, l4_210103, l4_210104,
  l4_210201,
  l4_220101, l4_220201,
  l4_310101, l4_320101, l4_320201,
  l4_410101, l4_410102, l4_410201, l4_410202,
  l4_410301, l4_410302, l4_410401, l4_410501,
  l4_420101, l4_420201, l4_420202,

  l5_1101010001, l5_1101010002, l5_1101020001, l5_1101020002,
  l5_1102010001, l5_1102010002, l5_1102020001, l5_1102030001, l5_1102030002, l5_1102040001, l5_1102050001,
  l5_1103010001, l5_1103020001,
  l5_1201010001, l5_1201020001, l5_1201030001, l5_1201040001, l5_1201040002,
  l5_1202010001, l5_1203010001,
  l5_2101010001, l5_2101010002, l5_2101020001, l5_2101030001, l5_2101030002, l5_2101040001,
  l5_2102010001,
  l5_2201010001, l5_2202010001,
  l5_3101010001, l5_3101010002, l5_3201010001, l5_3202010001,
  l5_4101010001, l5_4101010002, l5_4101020001, l5_4102010001, l5_4102020001, l5_4102020002,
  l5_4103010001, l5_4103020001, l5_4104010001, l5_4105010001, l5_4105010002,
  l5_4201010001, l5_4202010001, l5_4202020001
];

// مراكز التكلفة الافتراضية (هيكلية فقط - لا توجد معاملات)
export const initialCostCenters: CostCenter[] = [
  { id: 'cc-admin', code: 'CC-ADMIN', nameAr: 'الإدارة العامة', nameEn: 'General Administration' },
  { id: 'cc-sales', code: 'CC-SALES', nameAr: 'المبيعات والتسويق', nameEn: 'Sales & Marketing' },
  { id: 'cc-proc', code: 'CC-PROC', nameAr: 'المشتريات واللوجستيات', nameEn: 'Procurement & Logistics' },
  { id: 'cc-ops', code: 'CC-OPS', nameAr: 'العمليات والإنتاج', nameEn: 'Operations & Production' },
  { id: 'cc-hr', code: 'CC-HR', nameAr: 'الموارد البشرية', nameEn: 'Human Resources' }
];

// المعاملات والبيانات التشغيلية: تبدأ فارغة تماماً
export const initialJournalEntries: JournalEntry[] = [];
export const initialAuditLogs: AuditLog[] = [];
export const initialTrusts: Trust[] = [];
export const initialCustodies: Custody[] = [];

// ============================================================
// الصناديق النقدية الافتراضية (بيانات الصناديق)
// ============================================================
// تُنشأ الصناديق التشغيلية من واجهة "بيانات الصناديق" وترتبط بالحسابات الرئيسية
// (المستوى 5) الموجودة في دليل الحسابات — لذا تبدأ قائمة الصناديق فارغة.
export const initialCashBoxes: CashBox[] = [];

// ============================================================
// البنوك والصرافين الافتراضية (بيانات البنوك والصرافين)
// ============================================================
// تُنشأ البنوك وشركات الصرافة من واجهة "البنوك والصرافين" وترتبط بالحسابات الرئيسية
// (المستوى 5) الموجودة في دليل الحسابات — لذا تبدأ القائمة فارغة.
export const initialBankAccounts: BankAccount[] = [];

// ============================================================
// دليل العملات الافتراضي (البيانات الرئيسية للعملات)
// ============================================================
export const initialCurrencies: Currency[] = [
  {
    id: 'cur-master-yer',
    code: 'YER',
    nameAr: 'ريال يمني',
    nameEn: 'Yemeni Riyal',
    symbol: 'ر.ي',
    decimals: 2,
    isBase: true,
    exchangeRate: 1,
    minExchangeRate: 1,
    maxExchangeRate: 1,
    isActive: true,
    createdAt: '2023-01-01'
  },
  {
    id: 'cur-master-sar',
    code: 'SAR',
    nameAr: 'ريال سعودي',
    nameEn: 'Saudi Riyal',
    symbol: 'ر.س',
    decimals: 2,
    isBase: false,
    exchangeRate: 145,
    minExchangeRate: 140,
    maxExchangeRate: 150,
    isActive: true,
    createdAt: '2023-01-01'
  },
  {
    id: 'cur-master-usd',
    code: 'USD',
    nameAr: 'دولار أمريكي',
    nameEn: 'US Dollar',
    symbol: '$',
    decimals: 2,
    isBase: false,
    exchangeRate: 3.75,
    minExchangeRate: 3.7,
    maxExchangeRate: 3.8,
    isActive: true,
    createdAt: '2023-01-01'
  }
];

// ============================================================
// مراكز التكلفة الافتراضية
// ============================================================
export const initialPaymentVouchers: PaymentVoucher[] = [];

// ============================================================
// سندات القبض الافتراضية
// ============================================================
export const initialReceiptVouchers: ReceiptVoucher[] = [];

// ============================================================
// بيانات الموظفين الافتراضية (البيانات الرئيسية للموظفين)
// ============================================================
export const initialEmployees: Employee[] = [];

// ============================================================
// بيانات العملاء الافتراضية (البيانات الرئيسية للعملاء)
// ============================================================
export const initialCustomers: Customer[] = [];

// ============================================================
// بيانات الموردين الافتراضية (البيانات الرئيسية للموردين)
// ============================================================
export const initialVendors: Vendor[] = [];
