import {
  BookOpen,
  CalendarClock,
  CircleDollarSign,
  Contact,
  Coins,
  Database,
  FileBarChart2,
  FileCheck2,
  FileText,
  FileSignature,
  Home,
  Info,
  Landmark,
  Layers,
  TrendingUp,
  Lock,
  Network,
  Receipt,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Vault,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ERPModule } from '../constants/permissions';

export interface ModuleMeta {
  module: ERPModule;
  titleAr: string;
  titleEn: string;
  icon: LucideIcon;
}

export const MODULE_META: Record<ERPModule, ModuleMeta> = {
  HOME: { module: 'HOME', titleAr: 'الصفحة الرئيسية', titleEn: 'Home', icon: Home },
  OPERATIONS: { module: 'OPERATIONS', titleAr: 'العمليات', titleEn: 'Operations', icon: Zap },
  INPUTS: { module: 'INPUTS', titleAr: 'المدخلات', titleEn: 'Inputs', icon: Database },
  DASHBOARD: { module: 'DASHBOARD', titleAr: 'المؤشرات المالية', titleEn: 'Financial Indicators', icon: TrendingUp },
  CHART_OF_ACCOUNTS: { module: 'CHART_OF_ACCOUNTS', titleAr: 'دليل الحسابات', titleEn: 'Chart of Accounts', icon: Layers },
  OPENING_BALANCES: { module: 'OPENING_BALANCES', titleAr: 'الأرصدة الافتتاحية', titleEn: 'Opening Balances', icon: Coins },
  JOURNAL_ENTRIES: { module: 'JOURNAL_ENTRIES', titleAr: 'قيود اليومية', titleEn: 'Journal Entries', icon: BookOpen },
  PAYMENT_VOUCHERS: { module: 'PAYMENT_VOUCHERS', titleAr: 'سندات الصرف', titleEn: 'Payment Vouchers', icon: FileCheck2 },
  RECEIPT_VOUCHERS: { module: 'RECEIPT_VOUCHERS', titleAr: 'سندات القبض', titleEn: 'Receipt Vouchers', icon: Receipt },
  CASH_BOXES: { module: 'CASH_BOXES', titleAr: 'الصناديق النقدية', titleEn: 'Cash Boxes', icon: Wallet },
  BANK_ACCOUNTS: { module: 'BANK_ACCOUNTS', titleAr: 'البنوك والصرافين', titleEn: 'Banks & Exchangers', icon: Landmark },
  EMPLOYEES: { module: 'EMPLOYEES', titleAr: 'بيانات الموظفين', titleEn: 'Employees', icon: Users },
  CUSTOMERS: { module: 'CUSTOMERS', titleAr: 'بيانات العملاء', titleEn: 'Customers', icon: Contact },
  VENDORS: { module: 'VENDORS', titleAr: 'بيانات الموردين', titleEn: 'Vendors', icon: Truck },
  COST_CENTERS: { module: 'COST_CENTERS', titleAr: 'مراكز التكلفة', titleEn: 'Cost Centers', icon: Network },
  CURRENCIES: { module: 'CURRENCIES', titleAr: 'العملات', titleEn: 'Currencies', icon: CircleDollarSign },
  TRUSTS: { module: 'TRUSTS', titleAr: 'العهد', titleEn: 'Trusts', icon: Vault },
  CUSTODY: { module: 'CUSTODY', titleAr: 'العُهد المالية والعينية', titleEn: 'Custody & Petty Cash', icon: Vault },
  CONTRACTS: { module: 'CONTRACTS', titleAr: 'العقود والالتزامات', titleEn: 'Contracts & Obligations', icon: FileSignature },
  REPORTS: { module: 'REPORTS', titleAr: 'التقارير المالية', titleEn: 'Financial Reports', icon: FileBarChart2 },
  STATEMENT_ACCOUNT: { module: 'STATEMENT_ACCOUNT', titleAr: 'كشف حساب تحليلي', titleEn: 'Statement of Account', icon: FileText },
  AGING: { module: 'AGING', titleAr: 'أعمار الديون', titleEn: 'Aging Report', icon: CalendarClock },
  CLOSING: { module: 'CLOSING', titleAr: 'الإقفالات والترحيل', titleEn: 'Closings & Control', icon: Lock },
  AUDIT_SECURITY: { module: 'AUDIT_SECURITY', titleAr: 'سجل التدقيق والصلاحيات', titleEn: 'Audit Trail & Security', icon: ShieldCheck },
  SETTINGS: { module: 'SETTINGS', titleAr: 'الإعدادات', titleEn: 'Settings', icon: Settings },
  ABOUT: { module: 'ABOUT', titleAr: 'About Us', titleEn: 'About Us', icon: Info },
};
