import React from 'react';
import {
  Layers,
  Database,
  Wallet,
  Landmark,
  Users,
  Contact,
  Truck,
  Coins,
  Network,
  CircleDollarSign
  ,ScanSearch
} from 'lucide-react';
import { Account, CashBox, BankAccount, Employee, Customer, Vendor, CostCenter, Currency } from '../../types/erp';
import { ERPModule } from '../../constants/permissions';
import PageHeader from '../ui/PageHeader';
import MasterDataCard from '../ui/masterData/MasterDataCard';
import SetupProgressTracker from '../ui/masterData/SetupProgressTracker';

interface Props {
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  costCenters: CostCenter[];
  currencies: Currency[];
  onNavigate: (module: ERPModule) => void;
}

interface CardDef {
  id: string;
  icon: React.ElementType;
  title: string;
  iconClass: string;
  meta: string;
  module: ERPModule;
}

export default function InputsView({
  accounts, cashBoxes, bankAccounts, employees, customers, vendors, costCenters, currencies, onNavigate
}: Props) {

  const cards: CardDef[] = [
    {
      id: 'in-account',
      icon: Layers,
      title: 'دليل الحسابات',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${accounts.length} حساب`,
      module: 'CHART_OF_ACCOUNTS'
    },
    {
      id: 'in-opening-balances',
      icon: Coins,
      title: 'الأرصدة الافتتاحية',
      iconClass: 'bg-amber-500/20 text-amber-400',
      meta: `${accounts.filter(a => a.level === 5 && a.isActive).length} حساب تشغيلي`,
      module: 'OPENING_BALANCES'
    },
    {
      id: 'in-currencies',
      icon: CircleDollarSign,
      title: 'العملات',
      iconClass: 'bg-emerald-500/20 text-emerald-400',
      meta: `${currencies.length} عملة`,
      module: 'CURRENCIES'
    },
    {
      id: 'in-cashbox',
      icon: Wallet,
      title: 'بيانات الصناديق',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${cashBoxes.length} صندوق`,
      module: 'CASH_BOXES'
    },
    {
      id: 'in-bank',
      icon: Landmark,
      title: 'بيانات البنوك والصرافين',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${bankAccounts.length} كيان`,
      module: 'BANK_ACCOUNTS'
    },
    {
      id: 'in-employees',
      icon: Users,
      title: 'بيانات الموظفين',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${employees.length} موظف`,
      module: 'EMPLOYEES'
    },
    {
      id: 'in-customers',
      icon: Contact,
      title: 'بيانات العملاء',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${customers.length} عميل`,
      module: 'CUSTOMERS'
    },
    {
      id: 'in-vendors',
      icon: Truck,
      title: 'بيانات الموردين',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${vendors.length} مورد`,
      module: 'VENDORS'
    },
    {
      id: 'in-data-quality',
      icon: ScanSearch,
      title: 'جودة البيانات ودمج المكرر',
      iconClass: 'bg-amber-500/20 text-amber-400',
      meta: 'عملاء · موردون · موظفون',
      module: 'DATA_QUALITY'
    },
    {
      id: 'in-cost-centers',
      icon: Network,
      title: 'مراكز التكلفة',
      iconClass: 'bg-sky-500/20 text-sky-400',
      meta: `${costCenters.length} مركز`,
      module: 'COST_CENTERS'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Database className="w-6 h-6" />}
        title="صفحة المدخلات"
        subtitle="إضافة البيانات الأساسية للنظام — الحسابات المحاسبية والأرصدة الافتتاحية والصناديق والبنوك والموظفون والعملاء والموردون ومراكز التكلفة والعملات"
      />

      <SetupProgressTracker accounts={accounts} currencies={currencies} cashBoxes={cashBoxes} bankAccounts={bankAccounts} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <MasterDataCard
            key={card.id}
            id={card.id}
            icon={card.icon}
            title={card.title}
            iconClass={card.iconClass}
            meta={card.meta}
            module={card.module}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
