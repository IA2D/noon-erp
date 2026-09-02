import DateField from '../ui/DateField';
import React, { useEffect, useMemo, useState } from 'react';
import { AuditLog } from '../../types/erp';
import {
  ShieldCheck, History, Search, Edit, Trash2, Download, Filter,
  CheckCircle2, Plus, X, LogIn, LogOut, Calendar, ChevronLeft, ChevronRight, ChevronsLeft,
  ChevronsRight, RefreshCcw, FileWarning, UserCircle, Activity, ChevronDown, ChevronUp
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import F9SearchInput from '../ui/F9SearchInput';
import PageHeader from '../ui/PageHeader';

interface Props {
  auditLogs: AuditLog[];
}

interface ActionMeta {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
}

const ACTION_META: Record<string, ActionMeta> = {
  CREATE: { label: 'إنشاء', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30', icon: <Plus className="w-3 h-3" /> },
  UPDATE: { label: 'تعديل', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', icon: <Edit className="w-3 h-3" /> },
  DELETE: { label: 'حذف', bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', icon: <Trash2 className="w-3 h-3" /> },
  POST: { label: 'ترحيل', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  VOID: { label: 'إلغاء', bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', icon: <X className="w-3 h-3" /> },
  EXPORT: { label: 'تصدير', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30', icon: <Download className="w-3 h-3" /> },
  LOGIN: { label: 'تسجيل دخول', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30', icon: <LogIn className="w-3 h-3" /> },
  LOGOUT: { label: 'تسجيل خروج', bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30', icon: <LogOut className="w-3 h-3" /> }
};

const ACTION_ORDER = ['CREATE', 'UPDATE', 'POST', 'VOID', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT'];

const MODULE_LABELS: Record<string, string> = {
  GENERAL_LEDGER: 'دليل الحسابات والقيود',
  TRUSTS: 'العهد',
  CUSTODY: 'العُهد المالية والعينية',
  PAYMENT_VOUCHERS: 'سندات الصرف',
  RECEIPT_VOUCHERS: 'سندات القبض',
  SETTINGS: 'الإعدادات والأمان',
  EMPLOYEES: 'الموظفون',
  CUSTOMERS: 'العملاء',
  VENDORS: 'الموردون',
  OPENING_BALANCES: 'الأرصدة الافتتاحية',
  COST_CENTERS: 'مراكز التكلفة',
  CURRENCIES: 'العملات'
};

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const PAGE_SIZE = 20;

const selectCls = 'bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer';

export default function AuditAndSecurityView({ auditLogs }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setPage(1);
  }, [searchTerm, actionFilter, moduleFilter, userFilter, dateFrom, dateTo]);

  const users = useMemo(() => Array.from(new Set(auditLogs.map(l => l.userName).filter(Boolean))).sort(), [auditLogs]);
  const modules = useMemo(() => Array.from(new Set(auditLogs.map(l => l.module))), [auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return auditLogs.filter(log => {
      const matchesSearch =
        !q ||
        log.userName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.module.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q);
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
      const matchesModule = moduleFilter === 'ALL' || log.module === moduleFilter;
      const matchesUser = userFilter === 'ALL' || log.userName === userFilter;
      const day = log.timestamp.slice(0, 10);
      const matchesFrom = !dateFrom || day >= dateFrom;
      const matchesTo = !dateTo || day <= dateTo;
      return matchesSearch && matchesAction && matchesModule && matchesUser && matchesFrom && matchesTo;
    });
  }, [auditLogs, searchTerm, actionFilter, moduleFilter, userFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pagedLogs = filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);

  const hasActiveFilters = searchTerm !== '' || actionFilter !== 'ALL' || moduleFilter !== 'ALL' || userFilter !== 'ALL' || dateFrom !== '' || dateTo !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('ALL');
    setModuleFilter('ALL');
    setUserFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const todayStr = new Date().toISOString().substring(0, 10);
  const stats = {
    total: auditLogs.length,
    today: auditLogs.filter(l => l.timestamp.slice(0, 10) === todayStr).length,
    create: auditLogs.filter(l => l.action === 'CREATE').length,
    update: auditLogs.filter(l => l.action === 'UPDATE').length,
    post: auditLogs.filter(l => l.action === 'POST').length,
    delete: auditLogs.filter(l => l.action === 'DELETE' || l.action === 'VOID').length
  };

  const formatDateTime = (ts: string): string => {
    if (!ts) return '—';
    const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return ts;
    const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0));
    if (isNaN(date.getTime())) return ts;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getDate()} ${MONTHS_AR[date.getMonth()]} ${date.getFullYear()} — ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const handleExportCSV = () => {
    const rows = filteredLogs.map(log => ({
      'التاريخ والوقت': log.timestamp,
      'المستخدم': log.userName,
      'الدور الوظيفي': log.userRole,
      'الوحدة': MODULE_LABELS[log.module] || log.module,
      'الإجراء': ACTION_META[log.action]?.label || log.action,
      'تفاصيل العملية': log.details,
      'عنوان IP': log.ipAddress
    }));

    if (rows.length === 0) {
      toast('info', 'لا توجد سجلات لتصديرها.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h as keyof typeof r])).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', `تم تصدير ${rows.length} سجل إلى ملف CSV`);
  };

  const renderFilterSelect = (label: string, icon: React.ReactNode, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <label className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 shrink-0">
        {icon}
        {label}
      </span>
      <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<ShieldCheck className="w-6 h-6" />}
        title="سجل التدقيق والأمان"
        subtitle="سجل تدقيق شامل وغير قابل للتعديل لجميع الأنشطة المحاسبية."
        actions={
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 text-[#ffffff] border border-white/30 backdrop-blur-xs transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 text-[#ffffff]" />
            <span>تصدير التقرير</span>
          </button>
        }
      />

      {/* Tab 1: Audit Logs */}
      <div className="space-y-4 animate-slide-up">
          {/* Toggle Header Button */}
          <button
            onClick={() => setIsHeaderExpanded(prev => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700/70 bg-slate-800/80 text-xs font-bold text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-all cursor-pointer"
          >
            {isHeaderExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isHeaderExpanded ? 'إخفاء الهيدر والإحصائيات' : 'عرض الهيدر والإحصائيات'}
          </button>

          {/* Collapsible: Filters + Stats */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${isHeaderExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            {/* Filters */}
            <div className="glass-elevated rounded-3xl border border-slate-700/50 p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <F9SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}

                    className="w-full glass-input rounded-xl py-3 pr-12 pl-9 text-sm focus:ring-2 focus:ring-slate-400/30"
                    items={filteredLogs}
                    columns={[
                      { label: 'المستخدم', render: (log: AuditLog) => log.userName },
                      { label: 'الإجراء', render: (log: AuditLog) => ACTION_META[log.action]?.label || log.action },
                      { label: 'التاريخ والوقت', render: (log: AuditLog) => formatDateTime(log.timestamp) },
                      { label: 'التفاصيل', render: (log: AuditLog) => log.details, className: 'max-w-xs truncate' }
                    ]}
                    searchText={log => `${log.userName} ${log.action} ${log.details} ${log.timestamp} ${log.userRole} ${log.module} ${log.ipAddress}`}
                    browseTitle="استعراض سجل العمليات"
                  />
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  {renderFilterSelect('الإجراء', <Activity className="w-3.5 h-3.5" />, actionFilter, setActionFilter, [
                    { value: 'ALL', label: 'كل الإجراءات' },
                    ...ACTION_ORDER.map(a => ({ value: a, label: ACTION_META[a].label }))
                  ])}
                  {renderFilterSelect('الوحدة', <Filter className="w-3.5 h-3.5" />, moduleFilter, setModuleFilter, [
                    { value: 'ALL', label: 'كل الوحدات' },
                    ...modules.map(m => ({ value: m, label: MODULE_LABELS[m] || m }))
                  ])}
                  {renderFilterSelect('المستخدم', <UserCircle className="w-3.5 h-3.5" />, userFilter, setUserFilter, [
                    { value: 'ALL', label: 'كل المستخدمين' },
                    ...users.map(u => ({ value: u, label: u }))
                  ])}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 border-t border-slate-800 pt-4">
                <label className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    من تاريخ
                  </span>
                  <DateField  value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selectCls} />
                </label>
                <label className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    إلى تاريخ
                  </span>
                  <DateField  value={dateTo} onChange={e => setDateTo(e.target.value)} className={selectCls} />
                </label>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-800/80 px-3 py-2.5 text-xs font-bold text-slate-300 hover:border-red-500 hover:text-red-300 transition-all cursor-pointer"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    مسح الفلاتر
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-800/80 px-3 py-2.5 text-xs font-bold text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير النتائج المفلترة ({filteredLogs.length})
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mt-4">
              <div className="glass-elevated p-4 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{stats.total.toLocaleString('en-US')}</div>
                <div className="text-xs text-slate-400 mt-1">إجمالي العمليات</div>
              </div>
              <div className="glass-elevated p-4 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-bold text-sky-400">{stats.today.toLocaleString('en-US')}</div>
                <div className="text-xs text-slate-400 mt-1">عمليات اليوم</div>
              </div>
              <div className="glass-elevated p-4 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-bold text-sky-400">{stats.create.toLocaleString('en-US')}</div>
                <div className="text-xs text-slate-400 mt-1">عمليات الإنشاء</div>
              </div>
              <div className="glass-elevated p-4 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-bold text-amber-400">{stats.update.toLocaleString('en-US')}</div>
                <div className="text-xs text-slate-400 mt-1">عمليات التعديل</div>
              </div>
              <div className="glass-elevated p-4 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-bold text-emerald-400">{stats.post.toLocaleString('en-US')}</div>
                <div className="text-xs text-slate-400 mt-1">عمليات الترحيل</div>
              </div>
              <div className="glass-elevated p-4 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-bold text-red-400">{stats.delete.toLocaleString('en-US')}</div>
                <div className="text-xs text-slate-400 mt-1">حذف وإلغاء</div>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="glass-elevated rounded-3xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-900/60 text-slate-300 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-4 px-4">التاريخ والوقت</th>
                    <th className="py-4 px-4">المستخدم</th>
                    <th className="py-4 px-4">الوحدة</th>
                    <th className="py-4 px-4">الإجراء</th>
                    <th className="py-4 px-4">تفاصيل العملية</th>
                    <th className="py-4 px-4">عنوان IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pagedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-14 text-center">
                        <FileWarning className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                        <div className="text-slate-400 font-bold">لا توجد سجلات مطابقة</div>
                        <p className="text-xs text-slate-500 mt-1">جرّب تعديل الفلاتر أو مسحها لعرض السجلات</p>
                      </td>
                    </tr>
                  ) : (
                    pagedLogs.map((log) => {
                      const badge = ACTION_META[log.action] || ACTION_META.LOGOUT;
                      const isExpanded = expandedId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <td className="py-4 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                              {formatDateTime(log.timestamp)}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                                  {log.userName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-white block">{log.userName}</span>
                                  <span className="text-sm text-slate-500">{log.userRole}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20 whitespace-nowrap">
                                {MODULE_LABELS[log.module] || log.module}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 w-fit ${badge.bg} ${badge.text} ${badge.border}`}>
                                {badge.icon}
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs font-medium text-slate-200 max-w-xs truncate">{log.details}</td>
                            <td className="py-4 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{log.ipAddress}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-900/40">
                              <td colSpan={6} className="p-5">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs font-bold text-slate-400">تفاصيل السجل رقم #{log.id}</span>
                                    <button
                                      onClick={() => setExpandedId(null)}
                                      className="text-slate-500 hover:text-white p-1 transition-colors cursor-pointer"
                                      title="إغلاق"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <p className="text-sm text-white leading-relaxed">{log.details}</p>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/70 text-sm font-semibold text-slate-300">
                                      الوحدة: {MODULE_LABELS[log.module] || log.module}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/70 text-sm font-semibold text-slate-300">
                                      الدور الوظيفي: {log.userRole}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/70 text-sm font-semibold text-slate-300">
                                      المعرّف: {log.userId}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/70 text-sm font-semibold text-slate-300">
                                      عنوان IP: {log.ipAddress}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/70 text-sm font-semibold text-slate-300 font-mono">
                                      {log.timestamp}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredLogs.length > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 border-t border-slate-800 bg-slate-900/40">
                <div className="text-xs text-slate-400">
                  عرض <span className="font-bold text-white">{startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredLogs.length)}</span> من
                  <span className="font-bold text-white"> {filteredLogs.length.toLocaleString('en-US')}</span> سجل
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(1)}
                    disabled={safePage === 1}
                    className="p-2 rounded-lg border border-slate-700/70 bg-slate-800/80 text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="الصفحة الأولى"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-2 rounded-lg border border-slate-700/70 bg-slate-800/80 text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/70 text-xs font-bold text-white">
                    صفحة {safePage} من {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-2 rounded-lg border border-slate-700/70 bg-slate-800/80 text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="p-2 rounded-lg border border-slate-700/70 bg-slate-800/80 text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="الأخيرة"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
