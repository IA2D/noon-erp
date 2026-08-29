import React from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Wallet,
  Landmark,
  Gauge,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import {
  Account,
  Currency,
  JournalEntry,
  CashBox,
  BankAccount,
  PaymentVoucher,
  ReceiptVoucher
} from '../../types/erp';
import {
  calculateIncomeStatement,
  calculateBalanceSheet,
  accountFinancialType,
  percentChange,
  currentMonthKey,
  previousMonthKey,
  aggregateAccountBalance,
  calculateAccountActivity
} from '../../utils/accountingEngine';
import { ThemeMode } from '../../utils/useTheme';
import PageHeader from '../ui/PageHeader';
import EmptyState from '../ui/EmptyState';
import KPICard from '../ui/KPICard';

interface Props {
  accounts: Account[];
  journals: JournalEntry[];
  currencies?: Currency[];
  cashBoxes?: CashBox[];
  bankAccounts?: BankAccount[];
  paymentVouchers?: PaymentVoucher[];
  receiptVouchers?: ReceiptVoucher[];
  onNavigate: (module: string) => void;
  theme: ThemeMode;
}

const EXPENSE_CATEGORY_COLORS = ['#0ea5e9', '#38bdf8', '#f59e0b', '#94a3b8'];

/** فئات المصروفات التشغيلية — تعتمد على بادئات كود دليل الحسابات الفعلي */
const EXPENSE_CATEGORIES: { key: string; label: string; prefixes: string[] }[] = [
  { key: 'salaries', label: 'أجور ومرتبات', prefixes: ['4201'] },
  { key: 'admin', label: 'عمومية وإدارية', prefixes: ['4203', '4204'] },
  { key: 'depr', label: 'إهلاك وتصنيع', prefixes: ['4205'] },
  { key: 'other', label: 'مصروفات نثرية وأخرى', prefixes: [] }
];

const rnd = (n: number) => Math.round(n * 100) / 100;

function TrendBadge({ trend, positiveIsGood = true }: { trend?: number | null; positiveIsGood?: boolean }) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const neutral = !hasTrend || trend === 0;
  const isPositive = hasTrend && (trend as number) > 0;
  const isGood = isPositive === positiveIsGood;
  return (
    <span
      dir="ltr"
      title={neutral ? 'لا توجد بيانات للفترة السابقة' : 'مقارنة بالفترة السابقة'}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
        neutral
          ? 'bg-slate-100 text-slate-500 border-[#e2e8f0] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
          : isGood
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
            : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
      }`}
    >
      {neutral ? (
        <span>0.0% --</span>
      ) : (
        <>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          <span>{isPositive ? '+' : ''}{(trend as number).toFixed(1)}%</span>
        </>
      )}
    </span>
  );
}

/** رسم مصغر ناعم (Mini Sparkline) — AreaChart بتدرج لوني هادئ */
function Sparkline({
  data,
  stroke,
  gradientId
}: {
  data: number[];
  stroke: string;
  gradientId: string;
}) {
  if (data.length === 0) return null;
  const series = data.map(v => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SparklineKpiCard({
  title,
  value,
  icon: Icon,
  iconClass,
  trend,
  positiveIsGood = true,
  sparkData,
  sparkColor,
  sparkId
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconClass: string;
  trend?: number | null;
  positiveIsGood?: boolean;
  sparkData: number[];
  sparkColor: string;
  sparkId: string;
}) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 shadow-sm flex flex-col gap-2.5 min-w-0 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 truncate dark:text-slate-400">{title}</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 truncate dark:text-white">{value}</p>
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${iconClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <TrendBadge trend={trend} positiveIsGood={positiveIsGood} />
      </div>
      <div className="-mx-1">
        <Sparkline data={sparkData} stroke={sparkColor} gradientId={sparkId} />
      </div>
    </div>
  );
}

export default function DashboardView({
  accounts,
  journals,
  currencies = [],
  cashBoxes = [],
  bankAccounts = [],
  paymentVouchers = [],
  receiptVouchers = [],
  onNavigate,
  theme
}: Props) {
  const isLight = theme === 'light';

  // عملة النظام الأساسية — تُعرض بها كافة قيم المؤشرات المالية
  const baseCurrency = currencies.find(c => c.isActive && c.isBase) || currencies.find(c => c.isActive);
  const baseCode = baseCurrency?.code ?? 'YER';
  const fmtCur = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseCode}`;

  const tooltipStyle = {
    background: isLight ? '#ffffff' : '#0f172a',
    border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
    borderRadius: '12px',
    color: isLight ? '#1e293b' : '#e2e8f0',
    fontSize: '13px',
    boxShadow: isLight ? '0 12px 32px rgba(15,23,42,0.14)' : '0 12px 32px rgba(0,0,0,0.45)',
    direction: 'rtl' as const
  };

  const gridStroke = isLight ? '#e2e8f0' : '#1e293b';
  const tickColor = isLight ? '#64748b' : '#94a3b8';
  const cursorFill = isLight ? '#94a3b855' : '#1e293b55';
  const legendColor = isLight ? '#475569' : '#94a3b8';
  const pieStroke = isLight ? '#ffffff' : '#0f172a';

  const postedJournals = journals.filter(j => j.status === 'POSTED');
  const postedCount = postedJournals.length;
  const postedTotalValue = postedJournals.reduce((s, j) => s + j.totalDebit, 0);
  const income = calculateIncomeStatement(accounts, journals);
  const balanceSheet = calculateBalanceSheet(accounts, journals);

  const totalRevenues = income.totalRevenues;
  const netIncome = income.netIncome;
  const totalExpenses = income.totalExpenses;
  const capital = balanceSheet.equityBase;

  const curMonth = currentMonthKey();
  const prevMonth = previousMonthKey();
  const curPosted = postedJournals.filter(j => j.date.startsWith(curMonth));
  const prevPosted = postedJournals.filter(j => j.date.startsWith(prevMonth));
  const curIncome = calculateIncomeStatement(accounts, curPosted);
  const prevIncome = calculateIncomeStatement(accounts, prevPosted);
  const curExpenses = curIncome.totalExpenses;
  const prevExpenses = prevIncome.totalExpenses;

  const trendRevenues = percentChange(curIncome.totalRevenues, prevIncome.totalRevenues);
  const trendNetProfit = percentChange(curIncome.netIncome, prevIncome.netIncome);
  const trendExpenses = percentChange(curExpenses, prevExpenses);

  const prevBalanceSheet = calculateBalanceSheet(accounts, postedJournals.filter(j => j.date.slice(0, 7) <= prevMonth));
  const trendCapital = percentChange(balanceSheet.totalEquity, prevBalanceSheet.totalEquity);

  const liquidEntities = [
    ...cashBoxes.filter(b => b.isActive).map(b => ({ openingBalance: b.openingBalance || 0, linkedAccountId: b.linkedAccountId })),
    ...bankAccounts.filter(b => b.isActive).map(b => ({ openingBalance: b.openingBalance || 0, linkedAccountId: b.linkedAccountId }))
  ];
  const liquidityFor = (journalsInScope: JournalEntry[]) => {
    const act = calculateAccountActivity(accounts, journalsInScope);
    return liquidEntities.reduce((sum, e) => {
      if (e.linkedAccountId) {
        const acc = accounts.find(a => a.id === e.linkedAccountId);
        if (acc) return sum + aggregateAccountBalance(acc, accounts, act);
      }
      return sum + e.openingBalance;
    }, 0);
  };
  const totalLiquidity = liquidityFor(postedJournals);
  const curLiquidity = liquidityFor(curPosted);
  const prevLiquidity = liquidityFor(prevPosted);
  const trendLiquidity = percentChange(curLiquidity, prevLiquidity);

  const currentLiabilities = balanceSheet.currentLiabilities;
  const currentAssets = balanceSheet.currentAssets;
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const quickRatio = currentLiabilities > 0 ? totalLiquidity / currentLiabilities : null;

  const sym = baseCode;
  const totalAR = accounts.filter(a => a.level === 5 && a.isActive && a.category === 'RECEIVABLE').reduce((sum, a) => sum + Math.abs(a.openingBalance || 0), 0);
  const arTurnover = totalAR > 0 ? totalRevenues / totalAR : 0;
  const dsoDays = arTurnover > 0 ? Math.round(365 / arTurnover) : 0;

  const pendingJournals = journals.filter(j => j.status !== 'POSTED' && j.status !== 'VOIDED').length;
  const pendingPayments = paymentVouchers.filter(v => v.status === 'PENDING_POSTING').length;
  const pendingReceipts = receiptVouchers.filter(r => r.status === 'PENDING_POSTING').length;
  const pendingCount = pendingJournals + pendingPayments + pendingReceipts;

  const accountTypeMap = new Map(accounts.map(a => [a.id, accountFinancialType(a, accounts)]));
  const accountCodeById = new Map(accounts.map(a => [a.id, a.code]));
  const cashAccountIds = new Set<string>();
  cashBoxes.forEach(b => { if (b.linkedAccountId) cashAccountIds.add(b.linkedAccountId); });
  bankAccounts.forEach(b => { if (b.linkedAccountId) cashAccountIds.add(b.linkedAccountId); });

  const openingLiquidity = liquidEntities.reduce((s, e) => s + e.openingBalance, 0);
  const months = Array.from(new Set(postedJournals.map(j => j.date.slice(0, 7)))).sort();
  let cumCash = openingLiquidity;
  const monthlyData = months.map(m => {
    const mJournals = postedJournals.filter(j => j.date.startsWith(m));
    let revenue = 0;
    let expense = 0;
    let cashDelta = 0;
    mJournals.forEach(j => {
      j.lines.forEach(line => {
        const type = accountTypeMap.get(line.accountId);
        if (type === 'REVENUE' && line.credit > 0) revenue += line.credit;
        if (type === 'EXPENSE' && line.debit > 0) expense += line.debit;
        if (cashAccountIds.has(line.accountId)) cashDelta += line.debit - line.credit;
      });
    });
    cumCash += cashDelta;
    const [, y, mo] = m.split('-').map(Number);
    return {
      month: `${y}/${String(mo).padStart(2, '0')}`,
      revenue: rnd(revenue),
      expense: rnd(expense),
      net: rnd(revenue - expense),
      cash: rnd(cumCash)
    };
  });

  const categoryTotals = new Map<string, number>();
  postedJournals.forEach(j => {
    j.lines.forEach(line => {
      if (accountTypeMap.get(line.accountId) === 'EXPENSE' && line.debit > 0) {
        const code = accountCodeById.get(line.accountId) || '';
        let cat = 'other';
        if (code.startsWith('4201')) cat = 'salaries';
        else if (code.startsWith('4203') || code.startsWith('4204')) cat = 'admin';
        else if (code.startsWith('4205')) cat = 'depr';
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + line.debit);
      }
    });
  });
  const expenseCategoryTotal = Array.from(categoryTotals.values()).reduce((a, b) => a + b, 0);
  const expenseCategoryData = EXPENSE_CATEGORIES
    .map(c => ({ key: c.key, name: c.label, value: rnd(categoryTotals.get(c.key) || 0) }))
    .filter(d => d.value > 0);

  const monthExpenseMap = new Map<string, number>();
  curPosted.forEach(j => {
    j.lines.forEach(line => {
      if (accountTypeMap.get(line.accountId) === 'EXPENSE' && line.debit > 0) {
        monthExpenseMap.set(line.accountNameAr, (monthExpenseMap.get(line.accountNameAr) || 0) + line.debit);
      }
    });
  });
  const monthExpenseTotal = Array.from(monthExpenseMap.values()).reduce((a, b) => a + b, 0);
  const topMonthExpenses = Array.from(monthExpenseMap.entries())
    .map(([name, value]) => ({ name, value: rnd(value), pct: monthExpenseTotal > 0 ? rnd((value / monthExpenseTotal) * 100) : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<TrendingUp className="w-6 h-6" />}
        title="المؤشرات المالية"
      />

      <section>
        <div className="section-head">
          <div className="section-icon">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="section-title">الخلاصة المالية</h2>
          </div>
          <div className="section-line" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            title="إجمالي الإيرادات"
            value={fmtCur(totalRevenues)}
            icon={ArrowUpRight}
            iconClass="bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400"
            valueClass="text-sky-500/70"
            trend={trendRevenues}
            positiveIsGood
          />
          <KPICard
            title="رأس المال"
            value={fmtCur(capital)}
            icon={Wallet}
            iconClass="bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400"
            valueClass="text-sky-500/70"
            trend={trendCapital}
            positiveIsGood
          />
          <KPICard
            title="إجمالي الصادر"
            value={fmtCur(totalExpenses)}
            icon={ArrowDownRight}
            iconClass="bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400"
            valueClass="text-sky-500/70"
            trend={trendExpenses}
            positiveIsGood={false}
          />
          <KPICard
            title="صافي الرصيد"
            value={fmtCur(netIncome)}
            icon={TrendingUp}
            iconClass="bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400"
            valueClass={netIncome >= 0 ? 'text-sky-500/70' : 'text-red-500/70'}
            trend={trendNetProfit}
            positiveIsGood
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm lg:col-span-2 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
              <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              الإيرادات مقابل المصروفات
            </h3>
          </div>
          {monthlyData.length === 0 ? (
            <EmptyState title="لا توجد بيانات" compact />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} formatter={(v) => fmtCur(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 13, color: legendColor }} />
                <Bar dataKey="revenue" name="الإيرادات" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expense" name="المصروفات" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
              <PieChart className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              توزيع المصروفات التشغيلية
            </h3>
          </div>
          {expenseCategoryData.length === 0 ? (
            <EmptyState title="لا توجد بيانات" compact />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RePieChart>
                  <Pie
                    data={expenseCategoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke={pieStroke}
                    strokeWidth={1.5}
                  >
                    {expenseCategoryData.map((d) => {
                      const idx = EXPENSE_CATEGORIES.findIndex(c => c.key === d.key);
                      return <Cell key={d.key} fill={EXPENSE_CATEGORY_COLORS[Math.max(0, idx % EXPENSE_CATEGORY_COLORS.length)]} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCur(Number(v))} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {expenseCategoryData.map((item) => {
                  const idx = EXPENSE_CATEGORIES.findIndex(c => c.key === item.key);
                  const color = EXPENSE_CATEGORY_COLORS[Math.max(0, idx % EXPENSE_CATEGORY_COLORS.length)];
                  const pct = expenseCategoryTotal > 0 ? rnd((item.value / expenseCategoryTotal) * 100) : 0;
                  return (
                    <div key={item.key} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        {item.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{fmtCur(item.value)}</span>
                        <span className="text-slate-400 w-12 text-left">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">نسبة السيولة السريعة</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                {quickRatio === null ? (totalLiquidity > 0 ? '∞' : '—') : quickRatio.toFixed(2)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
              quickRatio === null
                ? 'bg-slate-100 text-slate-500 border-[#e2e8f0] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                : quickRatio >= 1
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                  : quickRatio >= 0.5
                    ? 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30'
                    : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
            }`}>
              {quickRatio === null ? (totalLiquidity > 0 ? 'لا التزامات متداولة' : 'لا بيانات') : quickRatio >= 1 ? 'وضع مريح' : quickRatio >= 0.5 ? 'متوازن' : 'يحتاج متابعة'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">قيود وسندات غير مرحّلة</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{pendingCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border bg-sky-50 text-[#006fba] border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30">
              {pendingCount > 0 ? 'بانتظار الترحيل' : 'كل شيء مرّحل'}
            </span>
            <button
              onClick={() => onNavigate('JOURNAL_ENTRIES')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold cursor-pointer dark:text-sky-400 dark:hover:text-sky-300"
            >
              الانتقال للترحيل ←
            </button>
          </div>
        </div>

        <SparklineKpiCard
          title="موقف السيولة والأصول"
          value={fmtCur(totalLiquidity)}
          icon={Landmark}
          iconClass="bg-sky-50 text-[#006fba] dark:bg-slate-800 dark:text-sky-400"
          trend={trendLiquidity}
          positiveIsGood
          sparkData={monthlyData.map(d => d.cash)}
          sparkColor="#06b6d4"
          sparkId="grad-liq"
        />
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
            <ArrowUpRight className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            أعلى حسابات المصروفات — الشهر الحالي
          </h3>
        </div>
        <div className="space-y-2">
          {topMonthExpenses.length === 0 && (
            <EmptyState title="لا توجد مصروفات هذا الشهر" compact />
          )}
          {topMonthExpenses.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors dark:bg-slate-800/50 dark:hover:bg-slate-800/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-sky-50 text-[#006fba] shrink-0 dark:bg-slate-800 dark:text-sky-400">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ترتيب {i + 1} · {item.pct.toFixed(1)}% من مصروفات الشهر</p>
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{fmtCur(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
