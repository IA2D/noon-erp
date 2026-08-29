export type AccountLevel = 1 | 2 | 3 | 4 | 5;

import type { SupportingDocument } from './supportingDocuments';

/**
 * نوع الحساب المساعد (Sub-Ledger) الحاكم لحساب المستوى الخامس:
 * NONE = حساب عام بلا مساعد | EMPLOYEE = موظف | CUSTOMER = عميل
 * SUPPLIER = مورد | CASH_BOX = صندوق نقدي | BANK = بنك/صراف
 * ASSET = أصل ثابت | COST_CENTER = مركز تكلفة | ITEM = صنف/مخزون
 */
export type SubLedgerType =
  | 'NONE'
  | 'EMPLOYEE'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'CASH_BOX'
  | 'BANK'
  | 'EXCHANGER'
  | 'ASSET'
  | 'COST_CENTER'
  | 'ITEM';

/** مرجع حساب مساعد موحد يُجلب تلقائياً من نوع الحساب ويُحفظ في أسطر التفاصيل */
export interface SubLedgerRef {
  subLedgerType: SubLedgerType;
  subLedgerId?: string;   // معرف الكيان المساعد (ID الموظف/العميل/المورد/الصندوق/البنك)
  subLedgerName?: string; // اسم الكيان المساعد المختار (للقراءة السريعة)
}

/** نوع الحساب: 1 = رئيسي/تجميعي (المستويات 1-4)، 2 = فرعي/تشغيلي (المستوى 5) */
export type AccountType = 1 | 2;

/** نوع التقرير: 1 = ميزانية عمومية (أصول/خصوم/حقوق ملكية)، 2 = قائمة دخل (إيرادات/مصروفات) */
export type ReportType = 1 | 2;

/** طبيعة الحساب: مدين (DEBIT) أو دائن (CREDIT) */
export type AccountNature = 'DEBIT' | 'CREDIT';

/** تصنيف الحساب لغرض التقارير */
export type AccountCategory =
  | 'BALANCE_SHEET'      // ميزانية عمومية
  | 'INCOME_STATEMENT'   // قائمة دخل
  | 'CASH_BANK'          // نقدية / بنك
  | 'RECEIVABLE'         // عملاء / ذمم مدينة
  | 'PAYABLE'            // موردين / ذمم دائنة
  | 'INVENTORY';         // مخزون

/**
 * سجل رصيد افتتاحي فريد — يُخزَّن في مصفوفة openingBalances على كل كيان.
 * كل سطر له UUID فريد (id) يمنع التكرار ويُستخدم كمفتاح React وقاعدة البيانات.
 * يدعم تعدد العملات: نفس الحساب/المساعد يمكن أن يكون له سجلات بعدة عملات.
 */
export interface OpeningBalanceRecord {
  /** UUID فريد للسجل — المفتاح الأساسي لكل صف */
  id: string;
  /** معرف الحساب المرتبط (المستوى 5) */
  accountId: string;
  /** معرف الحساب المساعد (اختياري — للعملاء/الموردين/الموظفين/الصناديق/البنوك) */
  subAccountId?: string;
  /** رمز العملة (YER / USD / SAR) */
  currency: string;
  /** سعر التحويل من العملة الأجنبية إلى المحلية */
  exchangeRate: number;
  /** مدين بالعملة الأصلية */
  debit: number;
  /** دائن بالعملة الأصلية */
  credit: number;
  /** مدين بالعملة المحلية (= debit × exchangeRate) */
  debitLocal: number;
  /** دائن بالعملة المحلية (= credit × exchangeRate) */
  creditLocal: number;
  /** رقم الاعتماد / المرجع */
  documentRef?: string;
  /** تاريخ الاستحقاق */
  dueDate?: string;
  /** صافي الرصيد بالعملة المحلية (محسوب = debitLocal - creditLocal — للتوافق مع الكود القديم) */
  amount?: number;
  /** صافي المبلغ بالعملة الأجنبية (محسوب = debit - credit — للتوافق مع الكود القديم) */
  foreignAmount?: number;
  /** سعر التحويل عند الإدخال (مرادف exchangeRate — للتوافق) */
  rate?: number;
}

/** عملة مرتبطة بحساب المستوى 5 (جدول account_currencies الفرعي) */
export interface AccountCurrency {
  id: string;
  code: string;         // رمز العملة مثل YER / USD / SAR
  isDefault: boolean;   // العملة الافتراضية
  isActive: boolean;    // إيقاف بدلاً من الحذف
}

/** العملة الأساسية في النظام */
export interface Currency {
  id: string;
  code: string;          // رمز العملة مثل YER / USD / SAR
  nameAr: string;        // الاسم بالعربية: ريال يمني
  nameEn: string;        // الاسم بالإنجليزية: Yemeni Riyal
  symbol: string;        // رمز العرض: ر.ي / $ / €
  decimals: number;      // عدد الخانات العشرية (2 الافتراضي)
  isBase: boolean;       // هل هي العملة الأساسية للنظام (سعر صرفها 1)
  exchangeRate: number;  // سعر التحويل الحالي مقابل العملة الأساسية
  minExchangeRate: number; // أدنى سعر تحويل (حد سفلي للنطاق)
  maxExchangeRate: number; // أعلى سعر تحويل (حد علوي للنطاق)
  isActive: boolean;     // إيقاف بدلاً من الحذف
  notes?: string;
  createdAt: string;
}

export type ExchangeRateType = 'TRANSACTION' | 'HISTORICAL' | 'AVERAGE' | 'CLOSING';

export interface ExchangeRateEvidence {
  rateType?: ExchangeRateType;
  rateEffectiveDate?: string;
  rateSource?: string;
  rateOverrideReason?: string;
  rateApprovedBy?: string;
}

export interface ControlAccountTransferRecord {
  id: string;
  effectiveDate: string;
  fromAccountId: string;
  toAccountId: string;
  reason: string;
  requestedBy: string;
  approvedBy: string;
  journalEntryId?: string;
  createdAt: string;
}

export interface CostCenter {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  parentId?: string;
}

export interface Account {
  id: string;
  code: string;              // كود ذكي هرمي: 1 -> 11 -> 1101 -> 110103 -> 1101030002
  nameAr: string;
  nameEn: string;
  level: AccountLevel;       // المستوى 5 فقط يقبل القيود المحاسبية
  accountType: AccountType;  // 1 = رئيسي (تجميعي)، 2 = فرعي (تشغيلي يقبل الترحيل)
  reportType: ReportType;    // 1 = ميزانية عمومية، 2 = قائمة دخل
  parentId?: string;
  nature: AccountNature;     // طبيعة الحساب (مدين / دائن) — تُورَّث من الجذر
  category: AccountCategory; // تصنيف الحساب
  subLedgerType: SubLedgerType; // نوع الحساب المساعد الحاكم لهذا الحساب (NONE افتراضياً)
  currencies: AccountCurrency[]; // العملات المرتبطة (للمستوى 5)
  defaultCurrency: string;   // العملة الافتراضية
  openingBalance: number;    // الرصيد الافتتاحي (للحسابات التشغيلية)
  openingBalanceForeign?: number; // الرصيد الافتتاحي بالعملة الأجنبية (موجب مدين / سالب دائن)
  openingRate?: number;      // سعر التحويل المعتمد عند إدخال الرصيد الافتتاحي
  openingCurrency?: string;  // العملة المعتمدة عند إدخال الرصيد الافتتاحي (محلي أو أجنبي)
  openingDocumentRef?: string; // رقم الاعتماد / المرجع على مستوى الرصيد الافتتاحي
  openingDueDate?: string;   // تاريخ استحقاق الرصيد الافتتاحي
  /** أرصدة افتتاحية متعددة العملات — كل سجل لعملة مستقلة (يمكن حفظ نفس الحساب بعدة عملات) */
  openingBalances?: OpeningBalanceRecord[];
  isActive: boolean;
}

export interface JournalLine extends ExchangeRateEvidence {
  id: string;
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  debit: number;            // المدين بالعملة المحلية (المعادل بالعملة الأساسية)
  credit: number;           // الدائن بالعملة المحلية (المعادل بالعملة الأساسية)
  description: string;
  costCenterId?: string;
  subLedgerType?: SubLedgerType; // يُجلب تلقائياً من الحساب المختار
  subLedgerId?: string;          // معرف الكيان المساعد (موظف/عميل/مورد/صندوق/بنك)
  subLedgerName?: string;        // اسم الكيان المساعد للعرض
  currency?: string;             // عملة السطر (افتراضياً عملة القيد)
  exchangeRate?: number;         // سعر صرف السطر مقابل العملة الأساسية
  debitForeign?: number;         // مدين بالعملة الأجنبية (فقط للأسطر بعملة أجنبية)
  creditForeign?: number;        // دائن بالعملة الأجنبية (فقط للأسطر بعملة أجنبية)
  isExchangeDifferenceAdjustment?: boolean; // فرق عملة دون حركة جديدة في أصل العملة
  referenceNumber?: string;      // رقم المرجع على مستوى السطر
}

export type JournalStatus = 'PENDING_POSTING' | 'POSTED' | 'VOIDED';

/** نوع المستند الأصلي للقيد المحاسبي */
export type JournalDocType = 'JV' | 'PV' | 'RV';

/** مصدر توليد القيد المحاسبي (يدوي أو آلي من سند صرف/قبض) */
export type JournalSourceType = 'MANUAL' | 'PAYMENT_VOUCHER' | 'RECEIPT_VOUCHER';

export interface JournalEntry extends ExchangeRateEvidence {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  narration: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  currency: string;
  exchangeRate: number;
  status: JournalStatus;
  createdBy: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  /** نوع المستند الأصلي للقيد — JV (يدوي) / PV (سند صرف) / RV (سند قبض) */
  type?: JournalDocType;
  /** مصدر توليد القيد — MANUAL أو آلي من سند صرف/قبض */
  sourceType?: JournalSourceType;
  /** رمز المستند الأصلي المولّد للقيد (مثل PV-12 أو RV-2026-0003) */
  referenceCode?: string;
  /** Immutable lifecycle links: a posted entry is corrected only by a separate posted reversal. */
  reversalOfEntryId?: string;
  reversedByEntryId?: string;
  reversalReason?: string;
  replacementOfEntryId?: string;
  replacementReason?: string;
  attachments?: SupportingDocument[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  module: 'GENERAL_LEDGER' | 'TRUSTS' | 'CUSTODY' | 'PAYMENT_VOUCHERS' | 'RECEIPT_VOUCHERS' | 'SETTINGS' | 'EMPLOYEES' | 'CUSTOMERS' | 'VENDORS' | 'OPENING_BALANCES' | 'COST_CENTERS' | 'CURRENCIES';
  action: 'CREATE' | 'UPDATE' | 'POST' | 'VOID' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGOUT';
  details: string;
  ipAddress: string;
  beforeJson?: string;
  afterJson?: string;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export type TrustType = 'CASH_ADVANCE' | 'IN_KIND' | 'DEPOSIT' | 'GUARANTEE';
export type TrustStatus = 'OPEN' | 'PARTIAL' | 'SETTLED' | 'VOIDED';

export type TrustMovementType = 'SETTLE' | 'RETURN';

/** حركة تسوية أو رد على العهدة */
export interface TrustMovement {
  id: string;
  type: TrustMovementType;
  amount: number;
  date: string;
  referenceNumber?: string;
  createdBy: string;
  createdAt: string;
  attachments?: SupportingDocument[];
}

export interface Trust {
  id: string;
  trustNumber: string; // e.g. TR-1
  type: TrustType;
  title: string;
  employeeName: string;
  employeeId?: string; // اختياري: ربط الموظف بقاعدة بيانات الموظفين
  amount: number;
  date: string;
  settlementDate?: string;
  referenceNumber?: string;
  notes?: string;
  status: TrustStatus;
  settledAmount: number;
  returnedAmount: number;
  movements?: TrustMovement[]; // سجل حركات التصفية والرد
  createdBy: string;
  createdAt: string;
}

/** نوع العهدة: مؤقتة / مستديمة (مصاريف نثرية) / عينية */
export type CustodyType = 'TEMPORARY' | 'PETTY_CASH' | 'ASSET';

/** حالة العهدة عبر دورة حياتها (State Machine) */
export type CustodyStatus =
  | 'CREATED'          // جديدة
  | 'PENDING_APPROVAL' // قيد المراجعة
  | 'APPROVED'         // معتمدة
  | 'DISBURSED'        // مصروفة
  | 'PARTIAL_SETTLED'  // مصفاة جزئياً
  | 'FULL_SETTLED'     // مصفاة كلياً
  | 'CLOSED'           // مغلقة
  | 'VOIDED';          // ملغاة

/** أنواع الحركات المالية على العهدة */
export type CustodyTransactionType =
  | 'DISBURSE'     // صرف العهدة
  | 'REPLENISH'    // استعاضة المستديمة
  | 'SETTLEMENT'   // تصفية بالمستندات
  | 'REFUND'       // رد النقدية (فائض)
  | 'SHORTAGE'     // عجز / مبلغ مستحق للموظف
  | 'CANCEL';      // إلغاء / رد كامل

export type CustodyApprovalAction = 'SUBMIT' | 'APPROVE' | 'REJECT';

export interface CustodyApproval {
  id: string;
  level: number;               // المستوى 1..3 حسب الهيكل التنظيمي
  approverName: string;
  action: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  actionAt?: string;
}

/** بند تصفية (مصروف / أصل) مع دعم ضريبة القيمة المضافة والفواتير */
export interface CustodySettlementItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  description: string;
  amount: number;              // صافي المبلغ قبل الضريبة
  taxRate: number;             // نسبة الضريبة (0..1 أو 0..100)
  taxAmount: number;           // قيمة الضريبة
  vatInclusive: boolean;       // السعر شامل الضريبة؟
  total: number;               // الإجمالي (المبلغ + الضريبة)
  vendorId?: string;
  vendorName?: string;
  vendorVatNumber?: string;    // الرقم الضريبي للمورد — يُفحص عند الإدخال
  invoiceNumber?: string;
  invoiceDate?: string;
  costCenterId?: string;
}

/** جلسة تصفية واحدة (قد تكون جزئية) */
export interface CustodySettlement {
  id: string;
  settlementNumber: string;    // e.g. STL-1
  date: string;
  items: CustodySettlementItem[];
  totalExpense: number;        // إجمالي المصاريف (شامل الضريبة)
  cashRefunded: number;        // النقدية المعادة (فائض)
  shortageAmount: number;      // العجز أو المبلغ المستحق للموظف
  apTransferred: number;       // المحوَّل لحساب الدائنين (مستحق للموظف)
  narration?: string;
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
  attachments?: SupportingDocument[];
}

export interface CustodyTransaction {
  id: string;
  type: CustodyTransactionType;
  date: string;
  amount: number;
  journalEntryId?: string;
  settlementId?: string;
  narration?: string;
  createdBy: string;
  createdAt: string;
}

/** طريقة صرف العهدة: نقداً من صندوق / حساب بنكي أو شيك / شركة صرافة */
export type DisbursementMethod = 'CASH' | 'BANK_TRANSFER' | 'EXCHANGE';

export interface Custody {
  id: string;
  custodyNumber: string;       // رقم العهدة التلقائي الموحد بصيغة CST-001
  type: CustodyType;
  title: string;
  employeeId: string;          // ربط الأستاذ المساعد (Employee ID) إلزامي
  employeeName: string;
  amount: number;              // مبلغ العهدة / سقف المستديمة
  currency: string;
  exchangeRate: number;
  disbursementMethod?: DisbursementMethod; // طريقة الصرف: نقداً من صندوق / بنك / شركة صرافة
  disbursementSource?: string; // مصدر التمويل (معرف الصندوق أو البنك أو شركة الصرافة الذي خرجت منه النقدية)
  status: CustodyStatus;
  projectId?: string;          // للعهد المؤقتة — مشروع محدد
  costCenterId?: string;       // مركز التكلفة
  assetId?: string;            // للعهد العينية — سجل الأصول
  assetDescription?: string;   // وصف العين المسندة
  maxBalance?: number;         // السقف المالي للمستديمة
  requestedDate: string;
  expectedClearanceDate?: string; // تاريخ انقضاء — تصفية إجبارية للمؤقتة
  actualClearanceDate?: string;
  approvals: CustodyApproval[];    // سلسلة الاعتمادات
  settlements: CustodySettlement[];// جلسات التصفية
  transactions: CustodyTransaction[]; // الحركات المالية
  disbursedAmount: number;     // ما تم صرفه فعلياً
  settledAmount: number;       // قيمة المستندات المصفاة
  refundedAmount: number;      // النقدية المعادة
  shortageAmount: number;      // العجز المستحق على الموظف
  attachments?: SupportingDocument[];
  apTransferredAmount: number; // المحوَّل لدائنين
  replenishedAmount: number;   // إجمالي الاستعاضات
  narration?: string;
  referenceNumber?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

/** نوع الصندوق النقدي */
export type CashBoxType = 'MAIN' | 'BRANCH' | 'RECEPTION' | 'OPERATIONS';

export interface CashBox {
  id: string;
  code: string;              // كود الصندوق مثل BX-001
  nameAr: string;
  nameEn: string;
  boxType: CashBoxType;      // رئيسي / فرعي / استقبال / تشغيلي
  currencies: AccountCurrency[]; // العملات المرتبطة (تضمين / توقيف)
  defaultCurrency: string;   // العملة الافتراضية (أول عملة مضمّنة)
  openingBalance: number;    // الرصيد الافتتاحي
  openingBalanceForeign?: number; // الرصيد الافتتاحي بالعملة الأجنبية
  openingRate?: number;      // سعر التحويل المعتمد عند إدخال الرصيد الافتتاحي
  openingDocumentRef?: string; // رقم الاعتماد / المرجع على مستوى الرصيد الافتتاحي
  openingDueDate?: string;   // تاريخ استحقاق الرصيد الافتتاحي
  openingCurrency?: string;  // العملة المعتمدة عند إدخال الرصيد الافتتاحي
  /** أرصدة افتتاحية متعددة العملات */
  openingBalances?: OpeningBalanceRecord[];
  linkedAccountId?: string;  // الحساب المحاسبي المرتبط (مستوى 5)
  controlAccountTransfers?: ControlAccountTransferRecord[];
  responsibleName?: string;  // أمين الصندوق / المسؤول
  location?: string;         // الموقع / الفرع
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

/** نوع الكيان: بنك أو شركة صرافة */
export type BankEntityType = 'BANK' | 'EXCHANGE';

export interface BankAccount {
  id: string;
  code: string;              // كود البنك/الصراف مثل BNK-001
  bankNameAr: string;
  bankNameEn: string;
  entityType: BankEntityType; // بنك / صرافة
  accountNumber: string;     // رقم الحساب
  iban: string;              // رقم الآيبان
  swift: string;             // رمز السويفت
  branchName?: string;       // اسم الفرع
  branchCode?: string;       // رمز الفرع
  accountHolder?: string;    // الاسم على الحساب
  currencies: AccountCurrency[]; // العملات المرتبطة (تضمين / توقيف)
  defaultCurrency: string;   // العملة الافتراضية (أول عملة مضمّنة)
  openingBalance: number;    // الرصيد الافتتاحي
  openingBalanceForeign?: number; // الرصيد الافتتاحي بالعملة الأجنبية
  openingRate?: number;      // سعر التحويل المعتمد عند إدخال الرصيد الافتتاحي
  openingDocumentRef?: string; // رقم الاعتماد / المرجع على مستوى الرصيد الافتتاحي
  openingDueDate?: string;   // تاريخ استحقاق الرصيد الافتتاحي
  openingCurrency?: string;  // العملة المعتمدة عند إدخال الرصيد الافتتاحي
  /** أرصدة افتتاحية متعددة العملات */
  openingBalances?: OpeningBalanceRecord[];
  linkedAccountId?: string;  // الحساب المحاسبي المرتبط (مستوى 5)
  controlAccountTransfers?: ControlAccountTransferRecord[];
  contactPerson?: string;    // جهة الاتصال
  contactPhone?: string;     // هاتف جهة الاتصال
  contactEmail?: string;     // بريد جهة الاتصال
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentVoucherStatus = 'PENDING_POSTING' | 'POSTED' | 'VOIDED';
export type VoucherSourceType = 'CASH_BOX' | 'BANK_ACCOUNT' | 'ACCOUNT';

export interface PaymentVoucherLine extends ExchangeRateEvidence {
  id: string;
  accountId: string;          // حساب المستوى 5 المسدد له (مدين)
  accountCode: string;
  accountNameAr: string;
  description: string;       // البيان التفصيلي على مستوى السطر
  amount: number;            // مبلغ السطر
  totalAmount: number;       // إجمالي السطر
  costCenterId?: string;     // مركز التكلفة المرتبط
  currency?: string;         // عملة السطر (افتراضياً عملة السند)
   exchangeRate?: number;     // سعر صرف السطر مقابل العملة الأساسية
   localAmount?: number;      // المعادل بالعملة المحلية = المبلغ × سعر الصرف
  referenceNumber?: string;  // رقم المرجع على مستوى السطر
  subLedgerType?: SubLedgerType; // يُجلب تلقائياً من الحساب المختار
  subLedgerId?: string;          // معرف الكيان المساعد
  subLedgerName?: string;        // اسم الكيان المساعد للعرض
}

export interface PaymentVoucher extends ExchangeRateEvidence {
  id: string;
  voucherNumber: string;     // e.g. PV-1
  date: string;
  paymentMethod: PaymentMethod; // نقداً / تحويل بنكي / شيك
  sourceType: VoucherSourceType; // صندوق / بنك / حساب
  sourceEntityId?: string;   // معرف الصندوق أو البنك أو الحساب المسدد منه
  sourceAccountId: string;   // حساب الصندوق أو البنك المحاسبي (دائن)
  sourceAccountNameAr: string;
  payeeName: string;         // اسم المستفيد / المدفوع له
  referenceNumber?: string;  // رقم الشيك أو رقم الحوالة البنكية
  chequeBankName?: string;   // اسم بنك الشيك (للشيكات فقط)
  chequeDueDate?: string;    // تاريخ استحقاق الشيك (للشيكات فقط)
  narration: string;         // البيان العام للسند
  currency: string;
  exchangeRate: number;
  lines: PaymentVoucherLine[];
  subtotalAmount: number;    // المجموع قبل الضريبة (يساوي الإجمالي)
  totalAmount: number;       // الإجمالي النهائي للسند
  amountInWordsAr: string;   // التفقيط باللغة العربية
  status: PaymentVoucherStatus;
  journalEntryId?: string;   // القيد المحاسبي المولد آلياً
  reversalJournalEntryId?: string; // القيد العكسي المرتبط عند الإلغاء
  createdBy: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  attachments?: SupportingDocument[];
}

export type ReceiptMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
export type ReceiptVoucherStatus = 'PENDING_POSTING' | 'POSTED' | 'VOIDED';
export type ReceiptSourceType = 'CASH_BOX' | 'BANK_ACCOUNT' | 'ACCOUNT';

export interface ReceiptVoucherLine extends ExchangeRateEvidence {
  id: string;
  accountId: string;          // حساب المستوى 5 المستحق عليه القبض (دائن)
  accountCode: string;
  accountNameAr: string;
  description: string;        // البيان التفصيلي على مستوى السطر
  amount: number;             // مبلغ السطر
  totalAmount: number;        // إجمالي السطر
  costCenterId?: string;      // مركز التكلفة المرتبط
  referenceNumber?: string;   // رقم المرجع على مستوى السطر
  currency?: string;          // عملة السطر (افتراضياً عملة السند)
  exchangeRate?: number;      // سعر صرف السطر مقابل العملة الأساسية
  localAmount?: number;       // المعادل بالعملة المحلية = المبلغ × سعر الصرف
  subLedgerType?: SubLedgerType; // يُجلب تلقائياً من الحساب المختار
  subLedgerId?: string;          // معرف الكيان المساعد
  subLedgerName?: string;        // اسم الكيان المساعد للعرض
}

export interface ReceiptVoucher extends ExchangeRateEvidence {
  id: string;
  receiptNumber: string;      // e.g. RV-1
  date: string;
  receiptMethod: ReceiptMethod; // نقداً / تحويل بنكي / شيك
  sourceType: ReceiptSourceType; // صندوق / بنك / حساب
  sourceEntityId?: string;    // معرف الصندوق أو البنك أو الحساب المستلم
  sourceAccountId: string;    // حساب الصندوق أو البنك المحاسبي (مدين)
  sourceAccountNameAr: string;
  payerName: string;          // اسم السداد / المدفوع منه
  referenceNumber?: string;   // رقم الشيك أو رقم الحوالة البنكية
  chequeBankName?: string;    // اسم بنك الشيك (للشيكات فقط)
  chequeDueDate?: string;     // تاريخ استحقاق الشيك (للشيكات فقط)
  narration: string;          // البيان العام للسند
  currency: string;
  exchangeRate: number;
  lines: ReceiptVoucherLine[];
  subtotalAmount: number;     // المجموع قبل الضريبة (يساوي الإجمالي)
  totalAmount: number;        // الإجمالي النهائي للسند
  amountInWordsAr: string;    // التفقيط باللغة العربية
  status: ReceiptVoucherStatus;
  journalEntryId?: string;    // القيد المحاسبي المولد آلياً
  reversalJournalEntryId?: string; // القيد العكسي المرتبط عند الإلغاء
  createdBy: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  attachments?: SupportingDocument[];
}

/** الجنس */
export type EmployeeGender = 'MALE' | 'FEMALE';

export interface EntityMergeRecord {
  sourceId: string;
  targetId: string;
  sourceCode: string;
  targetCode: string;
  reason: string;
  mergedBy: string;
  mergedAt: string;
}

export interface Employee {
  id: string;
  code: string;              // كود الموظف مثل EMP-001
  nameAr: string;            // الاسم الكامل بالعربية
  nameEn: string;            // الاسم بالإنجليزية
  nationalId: string;        // رقم الهوية الوطنية / الإقامة
  gender: EmployeeGender;    // الجنس
  jobTitle: string;          // المسمى الوظيفي
  department: string;        // القسم / الإدارة
  phone: string;             // رقم الجوال
  email: string;             // البريد الإلكتروني
  basicSalary: number;       // الراتب الأساسي
  hireDate: string;          // تاريخ التعيين
  iban: string;              // رقم الآيبان لتحويل الراتب
  currencies: AccountCurrency[]; // العملات المرتبطة براتب الموظف (تضمين / توقيف)
  defaultCurrency: string;   // العملة الافتراضية (أول عملة مضمّنة)
  notes?: string;            // ملاحظات
  linkedAccountId?: string;  // الحساب المحاسبي المرتبط (سلف الموظفين الشهرية — مستوى 5)
  controlAccountTransfers?: ControlAccountTransferRecord[];
  openingBalance?: number;   // الرصيد الافتتاحي (سالب دائن / موجب مدين)
  openingBalanceForeign?: number; // الرصيد الافتتاحي بالعملة الأجنبية
  openingRate?: number;      // سعر التحويل المعتمد عند إدخال الرصيد الافتتاحي
  openingDocumentRef?: string; // رقم الاعتماد / المرجع على مستوى الرصيد الافتتاحي
  openingDueDate?: string;   // تاريخ استحقاق الرصيد الافتتاحي
  openingCurrency?: string;  // العملة المعتمدة عند إدخال الرصيد الافتتاحي
  /** أرصدة افتتاحية متعددة العملات */
  openingBalances?: OpeningBalanceRecord[];
  isActive: boolean;
  mergedIntoId?: string;
  mergeHistory?: EntityMergeRecord[];
  createdAt: string;
}

/** نوع العميل: شركة / فرد / جهة حكومية */
export type CustomerType = 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';

export interface Customer {
  id: string;
  code: string;              // كود العميل مثل CUS-001
  nameAr: string;            // الاسم بالعربية (اسم المنشأة / العميل)
  nameEn: string;            // الاسم بالإنجليزية
  customerType: CustomerType; // نوع العميل
  commercialRegistration: string; // السجل التجاري
  vatNumber: string;         // الرقم الضريبي
  phone: string;             // رقم الجوال / الهاتف
  email: string;             // البريد الإلكتروني
  address: string;           // العنوان
  city: string;              // المدينة
  creditLimit: number;       // حد الائتمان
  currencies: AccountCurrency[]; // العملات المرتبطة بالعميل (تضمين / توقيف)
  defaultCurrency: string;   // العملة الافتراضية (أول عملة مضمّنة)
  linkedAccountId?: string;  // الحساب المحاسبي المرتبط (ذمم عملاء — مستوى 5)
  controlAccountTransfers?: ControlAccountTransferRecord[];
  openingBalance?: number;   // الرصيد الافتتاحي (سالب دائن / موجب مدين)
  openingBalanceForeign?: number; // الرصيد الافتتاحي بالعملة الأجنبية
  openingRate?: number;      // سعر التحويل المعتمد عند إدخال الرصيد الافتتاحي
  openingDocumentRef?: string; // رقم الاعتماد / المرجع على مستوى الرصيد الافتتاحي
  openingDueDate?: string;   // تاريخ استحقاق الرصيد الافتتاحي
  openingCurrency?: string;  // العملة المعتمدة عند إدخال الرصيد الافتتاحي
  /** أرصدة افتتاحية متعددة العملات */
  openingBalances?: OpeningBalanceRecord[];
  notes?: string;            // ملاحظات
  isActive: boolean;
  mergedIntoId?: string;
  mergeHistory?: EntityMergeRecord[];
  createdAt: string;
}

/** نوع المورد: شركة / فرد */
export type VendorType = 'COMPANY' | 'INDIVIDUAL';
/** شروط الدفع */
export type VendorPaymentTerms = 'CASH' | 'NET_30' | 'NET_60' | 'NET_90';

export interface Vendor {
  id: string;
  code: string;              // كود المورد مثل SUP-001
  nameAr: string;            // الاسم بالعربية (اسم المنشأة / المورد)
  nameEn: string;            // الاسم بالإنجليزية
  vendorType: VendorType;    // نوع المورد
  commercialRegistration: string; // السجل التجاري
  vatNumber: string;         // الرقم الضريبي
  phone: string;             // رقم الجوال / الهاتف
  email: string;             // البريد الإلكتروني
  address: string;           // العنوان
  city: string;              // المدينة
  paymentTerms: VendorPaymentTerms; // شروط الدفع
  currencies: AccountCurrency[]; // العملات المرتبطة بالمورد (تضمين / توقيف)
  defaultCurrency: string;   // العملة الافتراضية (أول عملة مضمّنة)
  linkedAccountId?: string;  // الحساب المحاسبي المرتبط (ذمم موردين — مستوى 5)
  controlAccountTransfers?: ControlAccountTransferRecord[];
  openingBalance?: number;   // الرصيد الافتتاحي (سالب دائن / موجب مدين)
  openingBalanceForeign?: number; // الرصيد الافتتاحي بالعملة الأجنبية
  openingRate?: number;      // سعر التحويل المعتمد عند إدخال الرصيد الافتتاحي
  openingDocumentRef?: string; // رقم الاعتماد / المرجع على مستوى الرصيد الافتتاحي
  openingDueDate?: string;   // تاريخ استحقاق الرصيد الافتتاحي
  openingCurrency?: string;  // العملة المعتمدة عند إدخال الرصيد الافتتاحي
  /** أرصدة افتتاحية متعددة العملات */
  openingBalances?: OpeningBalanceRecord[];
  notes?: string;            // ملاحظات
  isActive: boolean;
  mergedIntoId?: string;
  mergeHistory?: EntityMergeRecord[];
  createdAt: string;
}

export interface CompanyBranch {
  id: string;
  companyCode: string;       // رقم / كود الشركة
  commercialRegistration: string; // رقم السجل التجاري
  branchCode: string;        // رقم / كود الفرع (مثل: 01 للفرع الرئيسي)
  companyNameAr: string;     // اسم الشركة بالعربية
  companyNameEn: string;     // اسم الشركة بالإنجليزية
  branchNameAr: string;      // اسم الفرع بالعربية
  branchNameEn: string;      // اسم الفرع بالإنجليزية
  taxNumber: string;         // الرقم الضريبي (VAT / TIN)
  fiscalYear: string;        // السنة المالية الحالية
  phone: string;             // الهاتف
  fax: string;               // الفاكس
  email: string;             // البريد الإلكتروني
  website: string;           // الموقع الإلكتروني
  addressAr: string;         // العنوان التفصيلي بالعربية
  addressEn: string;         // العنوان التفصيلي بالإنجليزية
  logoUrl: string;           // رابط شعار الشركة/الفرع (للهيدر والتقارير)
  exportPath: string;        // مسار الحفظ / التصدير
  allowedRoles: string[];    // الأدوار المصرح لها بالعمل على هذا الفرع
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}
