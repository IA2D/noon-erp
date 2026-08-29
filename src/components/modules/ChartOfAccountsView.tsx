import React, { useState} from'react';
import {
  Account,
  AccountLevel,
  AccountNature,
  AccountCategory,
  AccountCurrency,
  SubLedgerType,
  BankAccount,
  CashBox,
  Customer,
  Employee,
  JournalEntry,
  Vendor,
  AccountType,
  ReportType,
  Currency
} from'../../types/erp';
import {
  SUB_LEDGER_META,
  SUB_LEDGER_TYPES,
  subLedgerBadge
} from'../../utils/subLedger';
import { useActiveCurrencies, defaultIncludedCodes } from '../../hooks/useActiveCurrencies';
import {
 childrenOf,
 ancestorChain,
 nextAccountCode,
 canDeleteAccount,
 isPostingAccount,
 getAccountType,
 getReportType,
 validateAccountCode,
 expectedCodeLength,
 canPromoteToParent,
 hasAccountTransactions
} from'../../utils/accountingEngine';
import {
 Plus,
 Search,
 ChevronDown,
 ChevronLeft,
 Folder,
 FileText,
 Layers,
 ShieldAlert,
 Pencil,
 Trash2,
 Coins,
 Power,
 CheckCircle2,
 AlertTriangle,
 Lock,
 Scale,
 Hash,
 List
} from'lucide-react';
import PageHeader from'../ui/PageHeader';
import { useToast} from'../ui/Toast';
import ModalShell from'../ui/ModalShell';
import AmountInput from'../AmountInput';

interface Props {
  accounts: Account[];
  journals: JournalEntry[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  currencies?: Currency[];
  onAddAccount: (account: Omit<Account,'id'>) => void;
  onUpdateAccount: (id: string, account: Partial<Account>) => void;
  onDeleteAccount: (id: string) => void;
}

interface FormState {
 nameAr: string;
 nameEn: string;
 nature: AccountNature;
 category: AccountCategory;
 isActive: boolean;
 openingBalance: number;
 subLedgerType: SubLedgerType;
 includedCurrencies: string[]; // رموز العملات المضمّنة (نشطة) — الباقي موقوف
}

interface ModalState {
 mode:'add' |'edit';
 accountId?: string;
 parentId?: string;
 level: AccountLevel;
 code: string;
 parentCode?: string;
 parentNameAr?: string;
 form: FormState;
}

const LEVEL_BADGES: Record<number, string> = {
 1:'bg-sky-500/15 text-sky-300 border-sky-500/25',
 2:'bg-sky-500/15 text-sky-300 border-sky-500/25',
 3:'bg-sky-500/15 text-sky-300 border-sky-500/25',
 4:'bg-sky-500/15 text-sky-300 border-sky-500/25',
 5:'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
};

const CATEGORY_LABELS: Record<AccountCategory, string> = {
 BALANCE_SHEET:'ميزانية عمومية',
 INCOME_STATEMENT:'قائمة دخل',
 CASH_BANK:'نقدية / بنك',
 RECEIVABLE:'عملاء / ذمم مدينة',
 PAYABLE:'موردين / ذمم دائنة',
 INVENTORY:'مخزون'
};

function defaultForm(baseCodes: string[]): FormState {
 return {
 nameAr:'',
 nameEn:'',
 nature:'DEBIT',
 category:'BALANCE_SHEET',
 isActive: true,
 openingBalance: 0,
 subLedgerType:'NONE',
 includedCurrencies: baseCodes
};
}

function buildCurrencies(codes: string[]): AccountCurrency[] {
 const ts = Date.now();
 return codes.map((code, i) => ({
 id: `cur-${ts}-${i}`,
 code,
 isDefault: i === 0,
 isActive: true
}));
}

/** دمج العملات عند تعديل حساب: تضمين/إيقاف مع الحفاظ على السجل (إيقاف بدلاً من الحذف) */
function mergeCurrencies(existing: AccountCurrency[], included: string[]): AccountCurrency[] {
 const ts = Date.now();
 const next: AccountCurrency[] = [];
 existing.forEach(c => {
 const active = included.includes(c.code);
 next.push({ ...c, isActive: active, isDefault: included[0] === c.code });
});
 included.forEach(code => {
 if (!existing.some(c => c.code === code)) {
 next.push({ id: `cur-${ts}-${code}`, code, isActive: true, isDefault: included[0] === code });
}
});
 return next;
}

export default function ChartOfAccountsView({ accounts, journals, cashBoxes, bankAccounts, employees, customers, vendors, currencies, onAddAccount, onUpdateAccount, onDeleteAccount}: Props) {
 const toast = useToast();
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedRoot, setSelectedRoot] = useState<string>('ALL');
 const [expanded, setExpanded] = useState<Record<string, boolean>>({});

 const { options: currencyOptions } = useActiveCurrencies(currencies);
 const defaultCodes = defaultIncludedCodes(currencies);
 const currencyLabel = (code: string): string => {
   const found = currencyOptions.find(c => c.code === code);
   return found ? `${found.label} (${code})` : code;
 };

 const [f9ListOpen, setF9ListOpen] = useState(false);
 const [f9Query, setF9Query] = useState('');
 const [f9HighlightId, setF9HighlightId] = useState<string | null>(null);

 const [modal, setModal] = useState<ModalState | null>(null);
 const [formError, setFormError] = useState('');

 const [currencyTarget, setCurrencyTarget] = useState<Account | null>(null);
 const [currencyError, setCurrencyError] = useState('');
 const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

 const toggleExpand = (id: string) => {
 setExpanded(prev => ({ ...prev, [id]: !(prev[id] ?? false)}));
};

 const openAddModal = (parent?: Account) => {
 setFormError('');
 if (parent && parent.level >= 5) return;
 const level = (parent ? parent.level + 1 : 1) as AccountLevel;
 const code = nextAccountCode(accounts, parent?.id);
 const form = defaultForm(defaultCodes);
 if (parent) {
 form.nature = parent.nature;
 form.category = parent.category;
}
 setModal({
 mode:'add',
 parentId: parent?.id,
 level,
 code,
 parentCode: parent?.code,
 parentNameAr: parent?.nameAr,
 form
});
};

 const openEditModal = (account: Account) => {
 setFormError('');
 setModal({
 mode:'edit',
 accountId: account.id,
 level: account.level,
 code: account.code,
 parentCode: account.parentId ? accounts.find(a => a.id === account.parentId)?.code : undefined,
 parentNameAr: account.parentId ? accounts.find(a => a.id === account.parentId)?.nameAr : undefined,
  form: {
  nameAr: account.nameAr,
  nameEn: account.nameEn,
  nature: account.nature,
  category: account.category,
  isActive: account.isActive,
  openingBalance: account.openingBalance,
  subLedgerType: account.subLedgerType ||'NONE',
  includedCurrencies:
 account.level === 5
 ? (account.currencies.filter(c => c.isActive).map(c => c.code).length > 0
 ? account.currencies.filter(c => c.isActive).map(c => c.code)
 : [account.defaultCurrency ||'YER'])
 : ['YER']
}
});
};

 const handleSave = (e: React.FormEvent) => {
 e.preventDefault();
 if (!modal) return;
 setFormError('');

 const nameAr = modal.form.nameAr.trim();
 if (!nameAr) {
 setFormError('يرجى إدخال اسم الحساب باللغة العربية.');
 return;
}

 const codeCheck = validateAccountCode(modal.code, modal.level, modal.parentCode);
 if (!codeCheck.valid) {
 setFormError(codeCheck.error ||'كود الحساب غير صالح وفق قاعدة الترميز.');
 return;
}

 if (modal.level === 5 && modal.form.includedCurrencies.length === 0) {
 setFormError('يرجى تضمين عملة واحدة على الأقل للحساب التشغيلي.');
 return;
}

 if (modal.mode ==='add') {
 const isPosting = modal.level === 5;
 const parentAccount = modal.parentId ? accounts.find(a => a.id === modal.parentId) : undefined;
 const currencies = isPosting ? buildCurrencies(modal.form.includedCurrencies) : [];
  const newAccount: Omit<Account,'id'> = {
  code: modal.code,
  nameAr,
  nameEn: modal.form.nameEn.trim() || nameAr,
  level: modal.level,
  accountType: getAccountType(modal.level),
  reportType: parentAccount
  ? parentAccount.reportType
  : getReportType(modal.code),
  parentId: modal.parentId || undefined,
  nature: modal.form.nature,
  category: modal.form.category,
  subLedgerType: isPosting ? modal.form.subLedgerType :'NONE',
  currencies,
 defaultCurrency: isPosting ? (modal.form.includedCurrencies[0] ||'YER') :'YER',
 openingBalance: isPosting ? Number(modal.form.openingBalance) || 0 : 0,
 isActive: true
};
 onAddAccount(newAccount);
 toast('success', `تم إضافة الحساب ${modal.code} - ${nameAr}`);
} else if (modal.accountId) {
 const editing = accounts.find(a => a.id === modal.accountId);
 const isPosting = modal.level === 5;
  onUpdateAccount(modal.accountId, {
  nameAr,
  nameEn: modal.form.nameEn.trim() || nameAr,
  nature: modal.form.nature,
  category: modal.form.category,
  subLedgerType: modal.level === 5 ? modal.form.subLedgerType :'NONE',
  isActive: modal.form.isActive,
 defaultCurrency: isPosting
 ? (modal.form.includedCurrencies[0] || editing?.defaultCurrency ||'YER')
 : (editing?.defaultCurrency ||'YER'),
 currencies:
 isPosting && editing
 ? mergeCurrencies(editing.currencies, modal.form.includedCurrencies)
 : editing?.currencies,
 openingBalance: modal.level === 5 ? Number(modal.form.openingBalance) || 0 : 0
});
 toast('success', `تم حفظ تعديلات الحساب ${modal.code} - ${nameAr}`);
}

 setModal(null);
};

  const handleDelete = (account: Account) => {
    const check = canDeleteAccount(account, accounts, journals);
    if (check.allowed && referenceCounts(account).length === 0) {
      onDeleteAccount(account.id);
    } else {
      onUpdateAccount(account.id, { isActive: false});
    }
    setDeleteTarget(null);
  };

 const matchesSearch = (acc: Account) => {
 const term = searchTerm.trim().toLowerCase();
 if (!term) return true;
 return (
 acc.code.toLowerCase().includes(term) ||
 acc.nameAr.includes(searchTerm.trim()) ||
 acc.nameEn.toLowerCase().includes(term)
 );
};

 const isSearching = searchTerm.trim().length > 0;

 const roots = accounts
 .filter(a => a.level === 1)
 .filter(a => selectedRoot ==='ALL' || a.code === selectedRoot)
 .sort((a, b) => a.code.localeCompare(b.code,'en', { numeric: true}));

 /** هل الحساب هو آخر ابن بين إخوته (يرسم خط التوصيل الأدنى)؟ */
 const isLastOfParent = (acc: Account): boolean => {
 if (!acc.parentId) return true;
 const sibs = childrenOf(accounts, acc.parentId);
 return sibs[sibs.length - 1]?.id === acc.id;
};

 /** قطاعات خطوط الشجرة: خط عمودي لكل جد غير أخير + كوع العقدة الحالية */
 const treeSegments = (acc: Account, depth: number): React.ReactNode[] => {
 const segs: React.ReactNode[] = [];
 if (depth > 0) {
 const ancestors = ancestorChain(acc, accounts).slice(1); // بدون الجذر نفسه
 ancestors.forEach((a, i) => {
 segs.push(
 <span key={`anc-${i}`} className={`coa-seg ${isLastOfParent(a) ?'' :'coa-seg-vert'}`} />
 );
});
 segs.push(
 <span key="elbow" className={`coa-seg ${isLastOfParent(acc) ?'coa-seg-elbow-last' :'coa-seg-elbow'}`} />
 );
}
 return segs;
};

 const renderNode = (acc: Account, depth: number): React.ReactNode => {
 const children = childrenOf(accounts, acc.id);
 const hasChildren = children.length > 0;
 const isExpanded = (expanded[acc.id] ?? false) && acc.level < 5;

 const rowBg =
 acc.level === 1
 ?'bg-slate-900/60 border-slate-700/60'
 : acc.level <= 3
 ?'bg-slate-900/40 border-slate-800/60'
 : acc.level === 4
 ?'bg-slate-900/20 border-slate-800/40'
 :'bg-transparent border-slate-800/20';

 const nodeRow = (
 <div
 id={`coa-row-${acc.id}`}
 className={`flex items-center gap-3 px-4 py-2 border-b min-w-max hover:bg-white/5 transition-colors ${rowBg} ${!acc.isActive ?'opacity-50' :''} ${f9HighlightId === acc.id ?'bg-sky-500/10 ring-1 ring-sky-500/50' :''}`}
 >
 <div className="flex items-center min-w-[320px] flex-1">
 <div className="flex items-center coa-tree-line">
 {treeSegments(acc, depth)}
 {hasChildren ? (
 <button
 onClick={() => toggleExpand(acc.id)}
 className="p-0.5 text-slate-400 hover:text-white rounded"
 title={isExpanded ?'طيّ الفرع' :'توسيع الفرع'}
 >
 {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
 </button>
 ) : (
 <span className="w-5" />
 )}
 </div>

 <span className="mx-1.5 flex-shrink-0">
 {acc.level <= 4 ? (
 <Folder className="w-4 h-4 text-amber-400" />
 ) : (
 <FileText className="w-4 h-4 text-emerald-400" />
 )}
 </span>

 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-mono font-bold text-sky-400 text-sm">{acc.code}</span>
 <span className="font-bold text-white whitespace-nowrap">{acc.nameAr}</span>
 </div>
 <div className="text-sm text-slate-400 font-mono whitespace-nowrap">{acc.nameEn}</div>
 </div>
 </div>

 <div className="w-24 flex-shrink-0">
 <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${LEVEL_BADGES[acc.level]}`}>
 مستوى {acc.level}
 </span>
 </div>

 {acc.level === 5 && acc.subLedgerType && acc.subLedgerType !== 'NONE' && (
 <div className="w-28 flex-shrink-0">
 <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-bold border ${subLedgerBadge(acc.subLedgerType).cls}`}>
 {subLedgerBadge(acc.subLedgerType).text}
 </span>
 </div>
 )}

 <div className="w-20 flex-shrink-0">
 <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border ${acc.isActive
 ?'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
 :'bg-slate-800 text-slate-400 border-slate-700'
}`}>
 <Power className="w-3 h-3" />
 {acc.isActive ?'نشط' :'موقوف'}
 </span>
 </div>

 <div className="w-40 flex items-center gap-1.5 flex-shrink-0">
 {acc.level < 5 && (
 <button
 onClick={() => openAddModal(acc)}
 title="إضافة حساب فرعي"
 className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
 >
 <Plus className="w-4 h-4" />
 </button>
 )}
 <button
 onClick={() => openEditModal(acc)}
 title="تعديل الحساب"
 className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button
 onClick={() => setDeleteTarget(acc)}
 title="حذف / إيقاف"
 className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 );

 return (
 <React.Fragment key={acc.id}>
 {nodeRow}
 {hasChildren && isExpanded && children.map(c => renderNode(c, depth + 1))}
 </React.Fragment>
 );
};

 const visibleList = isSearching
 ? accounts
 .filter(a => matchesSearch(a))
 .sort((a, b) => a.code.localeCompare(b.code,'en', { numeric: true}))
 : roots.map(root => root);

 const f9List = accounts
 .filter(a => {
 const q = f9Query.trim().toLowerCase();
 if (!q) return true;
 return (
 a.code.toLowerCase().includes(q) ||
 a.nameAr.includes(f9Query.trim()) ||
 a.nameEn.toLowerCase().includes(q)
 );
})
 .sort((a, b) => a.code.localeCompare(b.code,'en', { numeric: true}));

 const expandAll = () =>
 setExpanded(Object.fromEntries(accounts.filter(a => a.level < 5).map(a => [a.id, true])));
 const collapseAll = () =>
 setExpanded(Object.fromEntries(accounts.filter(a => a.level < 5).map(a => [a.id, false])));

 const openF9 = () => {
 setF9Query(searchTerm);
 setF9ListOpen(true);
};

 /** اختيار حساب من قائمة البحث: يعرضه في الشجرة (يوسّع أجداده ويحدده وينتقل إليه) */
 const selectFromF9 = (acc: Account) => {
 const ancestors = ancestorChain(acc, accounts);
 setExpanded(prev => {
 const next = { ...prev};
 ancestors.forEach(a => { next[a.id] = true;});
 return next;
});
 setSelectedRoot('ALL');
 setSearchTerm('');
 setF9Query('');
 setF9HighlightId(acc.id);
 setF9ListOpen(false);
 setTimeout(() => {
 document.getElementById(`coa-row-${acc.id}`)?.scrollIntoView({ block:'center', behavior:'smooth'});
}, 80);
};

  const deleteCheck = deleteTarget ? canDeleteAccount(deleteTarget, accounts, journals) : null;
  const deleteHasChildren = deleteTarget ? accounts.some(a => a.parentId === deleteTarget.id) : false;

  /** الجهات المرتبطة بالحساب (صناديق، بنوك، موظفون، عملاء، موردون) — تمنع الحذف النهائي */
  const referenceCounts = (acc: Account): { label: string; count: number }[] => {
    const refs: { label: string; count: number }[] = [];
    const countFor = (list: Array<{ linkedAccountId?: string }>) => list.filter(x => x.linkedAccountId === acc.id).length;
    const cashBoxCount = countFor(cashBoxes);
    if (cashBoxCount > 0) refs.push({ label:'صناديق', count: cashBoxCount});
    const bankCount = countFor(bankAccounts);
    if (bankCount > 0) refs.push({ label:'حسابات بنكية', count: bankCount});
    const empCount = countFor(employees);
    if (empCount > 0) refs.push({ label:'موظفين', count: empCount});
    const cusCount = countFor(customers);
    if (cusCount > 0) refs.push({ label:'عملاء', count: cusCount});
    const venCount = countFor(vendors);
    if (venCount > 0) refs.push({ label:'موردين', count: venCount});
    return refs;
  };
  const deleteRefs = deleteTarget ? referenceCounts(deleteTarget) : [];
  const deleteHasRefs = deleteRefs.length > 0;
  const canDeleteFully = !!deleteCheck?.allowed && !deleteHasRefs;

 return (
 <div className="space-y-6 animate-fade-in">
 <PageHeader
 icon={<Layers className="w-6 h-6" />}
 title="دليل الحسابات الشجري المتكامل"
 subtitle="شجرة من 5 مستويات — المستوى 5 فقط يقبل القيود، مع إدارة عملات الحسابات التشغيلية"
  actions={null}
/>

 <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col gap-4 bg-slate-900/60">
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
 <div className="text-xs text-slate-400">
 إجمالي الحسابات: <span className="font-bold text-white">{accounts.length}</span> —
 التشغيلية: <span className="font-bold text-emerald-400">{accounts.filter(isPostingAccount).length}</span>
 </div>
 </div>

 <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 custom-scrollbar">
 <button
 onClick={() => setSelectedRoot('ALL')}
 className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
 selectedRoot ==='ALL'
 ?'bg-sky-500/15 text-sky-600 border-sky-400 shadow-md'
 :'glass text-slate-300 hover:bg-white/10 border-slate-700/60'
}`}
 >
 جميع المجموعات
 </button>
 {roots.length > 0 && selectedRoot !=='ALL' && (
 <button
 onClick={() => setSelectedRoot('ALL')}
 className="text-xs text-sky-400 hover:underline"
 >
 مسح الفلتر
 </button>
 )}
 {accounts
 .filter(a => a.level === 1)
 .sort((a, b) => a.code.localeCompare(b.code,'en', { numeric: true}))
 .map(root => (
 <button
 key={root.id}
 onClick={() => setSelectedRoot(selectedRoot === root.code ?'ALL' : root.code)}
 className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
 selectedRoot === root.code
 ?'bg-sky-500/15 text-sky-600 border-sky-400 shadow-md'
 :'glass text-slate-300 hover:bg-white/10 border-slate-700/60'
}`}
 >
 {root.code} - {root.nameAr}
 </button>
 ))}
 </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 border-t border-slate-800">
 <div className="flex items-center gap-2 flex-shrink-0">
 <List className="w-4 h-4 text-sky-400" />
 <span className="text-xs font-bold text-slate-300 whitespace-nowrap">قائمة البحث</span>
 <kbd className="text-xs px-1.5 py-0.5 rounded-md border border-slate-600 bg-slate-800 text-slate-300 font-mono">F9</kbd>
 </div>
 <div className="relative flex-1">
 <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 onKeyDown={e => {
 if (e.key ==='F9') {
 e.preventDefault();
 openF9();
}
}}

 className="w-full px-9 py-2.5 text-sm glass-input rounded-xl"
 />
 </div>
 <button
 onClick={openF9}
 className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
 >
 <List className="w-4 h-4" />
 استعراض الدليل
 </button>
 </div>
 </div>

 <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
 <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
 <div className="flex items-center gap-2 text-slate-300">
 <Folder className="w-4 h-4 text-amber-400" />
 <span className="font-bold text-sm">دليل الحسابات</span>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={expandAll}
 className="text-xs font-semibold px-3 py-1.5 rounded-lg glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
 >
 توسيع الكل
 </button>
 <button
 onClick={collapseAll}
 className="text-xs font-semibold px-3 py-1.5 rounded-lg glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
 >
 طي الكل
 </button>
 </div>
 </div>

 <div className="overflow-x-auto custom-scrollbar">
 <div className="min-w-[760px]">
 {isSearching
 ? visibleList.map(acc => renderNode(acc, acc.level - 1))
 : visibleList.map(root => renderNode(root, 0))}
 {visibleList.length === 0 && (
 <div className="py-12 text-center">
 <div className="flex flex-col items-center gap-3 text-slate-400">
 <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center">
 <FileText className="w-7 h-7 text-sky-400" />
 </div>
 <p className="font-bold text-white">لا توجد حسابات مطابقة</p>
 <p className="text-sm">جرّب تغيير نص البحث أو المجموعة المحددة</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {modal && (
 <ModalShell
  id="account-form"
  open={!!modal}
  onClose={() => setModal(null)}
  title={modal.mode ==='add' ?'إضافة حساب جديد بالدليل' :'تعديل الحساب المحاسبي'}
  icon={Layers}
  size="md"
  footer={null}
  closeOnBackdrop={false}
  bodyClassName="p-0"
 >
 <form onSubmit={handleSave} className="flex flex-col h-full">
 <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
 {formError && (
 <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
 <ShieldAlert className="w-4 h-4 flex-shrink-0" />
 <span>{formError}</span>
 </div>
 )}

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-2xl bg-slate-900/40 p-4 border border-slate-800 text-xs">
 <div>
 <div className="text-slate-400 font-semibold flex items-center gap-1">
 <Hash className="w-3 h-3" />
 كود الحساب (آلي)
 </div>
 <div className="font-mono font-bold text-sky-400 text-base mt-1" dir="ltr">{modal.code}</div>
 <div className="text-xs text-slate-500 mt-0.5 font-mono" dir="ltr">
 {expectedCodeLength(modal.level)} أرقام — {expectedCodeLength(modal.level - 1)}+
 </div>
 </div>
 <div>
 <div className="text-slate-400 font-semibold">المستوى</div>
 <div className="font-bold text-white text-base mt-1">مستوى {modal.level}</div>
 <div className="text-xs text-slate-500 mt-0.5">
 {modal.level <= 4 ?'تجميعي — لا يقبل القيود' :'تشغيلي — يقبل القيود'}
 </div>
 </div>
 <div>
 <div className="text-slate-400 font-semibold">نوع الحساب</div>
 <div className={`font-bold text-base mt-1 ${modal.level === 5 ?'text-emerald-400' :'text-sky-400'}`}>
 {modal.level === 5 ?'فرعي (2)' :'رئيسي (1)'}
 </div>
 </div>
 <div>
 <div className="text-slate-400 font-semibold">نوع التقرير</div>
 <div className="font-bold text-white text-base mt-1">
 {modal.parentCode
 ? undefined
 : modal.code ==='3' || modal.code ==='4' ?'قائمة دخل (2)' :'ميزانية (1)'}
 {modal.parentCode && (
 <span className="text-sm text-slate-300 font-semibold">موروث من الأب</span>
 )}
 </div>
 </div>
 </div>

 {modal.mode ==='add' && (
 <div className="rounded-xl p-3 border border-slate-700/60 bg-slate-900/40 text-xs text-slate-300 flex items-start gap-2">
 <Scale className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
 <span>
 <span className="text-slate-200 font-bold">قاعدة التوريث:</span> طبيعة الحساب (مدين/دائن) تُورَّث تلقائياً من الجذر —
 {modal.form.nature ==='DEBIT' ?' مدين (Debit)' :' دائن (Credit)'}
 {modal.parentNameAr ? ` (من الأب: ${modal.parentNameAr})` :' (يحدده المحاسب للمجموعة الرئيسية)'}.
 </span>
 </div>
 )}

 {modal.mode ==='add' && (
 <div className={`rounded-xl p-3 border text-sm ${modal.level <= 4 ?'bg-amber-500/10 border-amber-500/30 text-amber-200' :'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
 {modal.level <= 4
 ?'حساب تجميعي — لا يقبل القيود اليومية، أضف حساباً فرعياً تحته حتى المستوى الخامس.'
 :'حساب تشغيلي — يقبل القيود اليومية ويمكن إدارة عملاته.'}
 </div>
 )}

 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الحساب باللغة العربية *</label>
 <input
 type="text"
 required
 value={modal.form.nameAr}
 onChange={e => setModal({ ...modal, form: { ...modal.form, nameAr: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl"

 />
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الحساب باللغة الإنجليزية</label>
 <input
 type="text"
 value={modal.form.nameEn}
 onChange={e => setModal({ ...modal, form: { ...modal.form, nameEn: e.target.value}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"

 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">طبيعة الحساب</label>
 <select
 value={modal.form.nature}
 onChange={e => setModal({ ...modal, form: { ...modal.form, nature: e.target.value as AccountNature}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
 >
 <option value="DEBIT">مدين (Debit)</option>
 <option value="CREDIT">دائن (Credit)</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 mb-1">تصنيف الحساب</label>
 <select
 value={modal.form.category}
 onChange={e => setModal({ ...modal, form: { ...modal.form, category: e.target.value as AccountCategory}})}
 className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
 >
 {(Object.keys(CATEGORY_LABELS) as AccountCategory[]).map(cat => (
 <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
 ))}
 </select>
 </div>
 </div>

 {modal.level === 5 && (
 <div className="grid grid-cols-2 gap-4">
  <div>
  <label className="block text-xs font-semibold text-slate-300 mb-1">الرصيد الافتتاحي (Op. Balance)</label>
   <AmountInput
   value={modal.form.openingBalance}
   onChange={v => setModal({ ...modal, form: { ...modal.form, openingBalance: Number(v) }})}
   className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
   />
  </div>
  <div>
  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
  <List className="w-4 h-4 text-sky-400" />
  نوع الحساب المساعد (Sub-Ledger)
  </label>
  <select
  value={modal.form.subLedgerType}
  onChange={e => setModal({ ...modal, form: { ...modal.form, subLedgerType: e.target.value as SubLedgerType }})}
  className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
  >
  {SUB_LEDGER_TYPES.map(t => (
  <option key={t} value={t}>{SUB_LEDGER_META[t].label} ({SUB_LEDGER_META[t].labelEn})</option>
  ))}
  </select>
  <p className="text-sm text-slate-500 mt-1.5">
  {SUB_LEDGER_META[modal.form.subLedgerType].hint}
  </p>
  </div>
  <div className="col-span-2">
 <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
 <Coins className="w-4 h-4 text-emerald-400" />
 العملات (تضمين / توقيف)
 </label>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
  {currencyOptions.map(c => {
  const included = modal.form.includedCurrencies.includes(c.code);
 return (
 <button
 key={c.code}
 type="button"
 onClick={() => {
 const includedCurrencies = included
 ? modal.form.includedCurrencies.filter(code => code !== c.code)
 : [...modal.form.includedCurrencies, c.code];
 setModal({ ...modal, form: { ...modal.form, includedCurrencies}});
}}
 className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
 included
 ?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
 :'border-slate-700 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
}`}
 >
 <span className="flex items-center gap-1.5">
 {included
 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
 : <Power className="w-4 h-4" />}
 <span className="font-mono font-bold">{c.code}</span>
 </span>
 <span className={`text-xs px-1.5 py-0.5 rounded-full border ${included
 ?'text-emerald-300 border-emerald-500/40 bg-emerald-500/15'
 :'text-slate-500 border-slate-700 bg-slate-800/60'
}`}>
 {included ?'تضمين' :'توقيف'}
 </span>
 </button>
 );
})}
 </div>
 <p className="text-sm text-slate-500 mt-2">
 أول عملة مضمّنة تُعتبر الافتراضية للحساب — تُوقف العملات بدلاً من حذفها لضمان سلامة السجل المحاسبي.
 </p>
 </div>
 </div>
 )}

 {modal.level === 5 && modal.mode ==='edit' && (
 <button
 type="button"
 onClick={() => {
 const editing = accounts.find(a => a.id === modal.accountId);
 if (editing) {
 setCurrencyError('');
 setModal(null);
 setCurrencyTarget(editing);
}
}}
 className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-sm font-semibold transition-colors cursor-pointer"
 >
 <Coins className="w-4 h-4" />
 إدارة عملات الحساب
 </button>
 )}

 {modal.mode ==='edit' && modal.accountId && modal.level === 5 && (
 (() => {
 const editing = accounts.find(a => a.id === modal.accountId);
 if (!editing) return null;
 const txCount = journals.filter(j => j.status ==='POSTED' && j.lines.some(l => l.accountId === editing.id)).length;
 const promotion = canPromoteToParent(editing, journals);
 return (
 <div className={`rounded-xl p-3 border text-xs flex items-start gap-2 ${txCount > 0
 ?'bg-red-500/10 border-red-500/30 text-red-200'
 :'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
}`}>
 {txCount > 0 ? <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
 <span>
 <span className="font-bold">Rule B — حماية التحويل:</span>{''}
 {txCount > 0
 ? `الحساب عليه ${txCount} قيد مرحلة — يمنع نهائياً تحويله إلى حساب رئيسي. (${promotion.reason})`
 :'الحساب التشغيلي لا يحمل حركات مالية — يمكن تحويله إلى حساب رئيسي إذا لزم.'}
 </span>
 </div>
 );
})()
 )}

 {modal.mode ==='edit' && (
 <div className="flex items-center gap-3 rounded-xl p-3 border border-slate-700/60 bg-slate-900/40">
 <input
 type="checkbox"
 id="acc-active"
 checked={modal.form.isActive}
 onChange={e => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked}})}
 className="w-4 h-4 accent-emerald-500"
 />
 <label htmlFor="acc-active" className="text-sm text-slate-300 font-semibold cursor-pointer">
 الحساب نشط (يقبل القيود/الترحيل)
 </label>
 </div>
 )}

 </div>

 <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/70 flex-shrink-0 flex items-center justify-between gap-3">
 <p className="text-sm text-slate-500">
 {modal.mode ==='add' ?'سيُضاف الحساب بعد الضغط على موافق.' :'تُحفظ تعديلاتك فور الضغط على موافق.'}
 </p>
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => setModal(null)}
 className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium cursor-pointer"
 >
 إلغاء
 </button>
 <button
 type="submit"
 className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer"
 >
  موافق — حفظ
 </button>
 </div>
 </div>
 </form>
 </ModalShell>
 )}

 {currencyTarget && (
 <ModalShell
  id="account-currency-manager"
  open={!!currencyTarget}
  onClose={() => setCurrencyTarget(null)}
  title={`إدارة عملات الحساب: ${currencyTarget.code} - ${currencyTarget.nameAr}`}
  icon={Coins}
  size="md"
  footer={null}
  closeOnBackdrop={false}
  bodyClassName="p-6 space-y-4"
 >
 {currencyError && (
 <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
 <ShieldAlert className="w-4 h-4 flex-shrink-0" />
 <span>{currencyError}</span>
 </div>
 )}

 <div className="space-y-2">
 {currencyTarget.currencies.length === 0 && (
 <div className="text-sm text-slate-400">لا توجد عملات مرتبطة — أضف أول عملة.</div>
 )}
 {currencyTarget.currencies.map(cur => (
 <div key={cur.id} className="flex items-center justify-between rounded-xl p-3 border border-slate-700/60 bg-slate-900/40">
 <div className="flex items-center gap-2">
 <span className="font-mono font-bold text-white">{cur.code}</span>
 <span className="text-xs text-slate-400">{currencyLabel(cur.code)}</span>
 {cur.isDefault && (
 <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
 افتراضية
 </span>
 )}
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cur.isActive
 ?'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
 :'bg-slate-800 text-slate-400 border-slate-700'
}`}>
 {cur.isActive ?'نشطة' :'موقفة'}
 </span>
 </div>

 <div className="flex items-center gap-1.5">
 {cur.isActive && !cur.isDefault && (
 <button
 onClick={() => {
 const updatedCurrencies = currencyTarget.currencies.map(c => ({
 ...c,
 isDefault: c.id === cur.id
}));
 onUpdateAccount(currencyTarget.id, {
 currencies: updatedCurrencies,
 defaultCurrency: cur.code
});
 setCurrencyTarget({ ...currencyTarget, currencies: updatedCurrencies, defaultCurrency: cur.code});
}}
 className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
 >
 تعيين كافتراضي
 </button>
 )}
 {cur.isActive ? (
 <button
 onClick={() => {
 if (cur.isDefault) {
 setCurrencyError('لا يمكن إيقاف العملة الافتراضية — انقل الافتراضية أولاً.');
 return;
}
 const updatedCurrencies = currencyTarget.currencies.map(c =>
 c.id === cur.id ? { ...c, isActive: false} : c
 );
 onUpdateAccount(currencyTarget.id, { currencies: updatedCurrencies});
 setCurrencyTarget({ ...currencyTarget, currencies: updatedCurrencies});
 setCurrencyError('');
}}
 className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
 >
 إيقاف
 </button>
 ) : (
 <button
 onClick={() => {
 const updatedCurrencies = currencyTarget.currencies.map(c =>
 c.id === cur.id ? { ...c, isActive: true} : c
 );
 onUpdateAccount(currencyTarget.id, { currencies: updatedCurrencies});
 setCurrencyTarget({ ...currencyTarget, currencies: updatedCurrencies});
 setCurrencyError('');
}}
 className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
 >
 تفعيل
 </button>
 )}
 </div>
 </div>
 ))}
 </div>

 <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
 <select
 id="new-currency"
 className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
 value=""
 onChange={e => {
 const code = e.target.value;
 if (!code) return;
 if (currencyTarget.currencies.some(c => c.code === code)) {
 setCurrencyError(`العملة ${code} مضافة مسبقاً لهذا الحساب.`);
 return;
}
 const newCurrency: AccountCurrency = {
 id: `cur-${Date.now()}`,
 code,
 isDefault: false,
 isActive: true
};
 const updatedCurrencies = [...currencyTarget.currencies, newCurrency];
 onUpdateAccount(currencyTarget.id, { currencies: updatedCurrencies});
 setCurrencyTarget({ ...currencyTarget, currencies: updatedCurrencies});
 setCurrencyError('');
 e.target.value ='';
}}
 >
 <option value="">— اختر عملة لإضافتها —</option>
  {currencyOptions.map(c => (
  <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
  ))}
 </select>
 </div>

 <p className="text-sm text-slate-500">
 ملاحظة: تُدار العملات بإضافة/إيقاف فقط ولا تُحذف نهائياً لضمان سلامة السجل المحاسبي.
 </p>
 </ModalShell>
 )}

 {deleteTarget && deleteCheck && (
 <ModalShell
  id="account-delete"
  open={!!(deleteTarget && deleteCheck)}
  onClose={() => setDeleteTarget(null)}
  title={`حذف الحساب: ${deleteTarget.code} - ${deleteTarget.nameAr}`}
  icon={Trash2}
  size="sm"
  footer={null}
  closeOnBackdrop={false}
  bodyClassName="p-6 space-y-4"
 >
 {deleteHasChildren ? (
 <>
 <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
 <span>لا يمكن حذف حساب يحتوي على حسابات فرعية. احذف الأبناء أولاً أو قم بإيقافهم جميعاً.</span>
 </div>
 <div className="flex justify-end">
 <button
 onClick={() => setDeleteTarget(null)}
 className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium"
 >
 إغلاق
 </button>
 </div>
 </>
          ) : (
            <>
              {canDeleteFully ? (
                <div className="rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>الحساب لا يحمل أي قيود محاسبية ولا حسابات فرعية ولا جهات مرتبطة — يمكن حذفه نهائياً من دليل الحسابات.</span>
                </div>
              ) : (
                <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    لا يمكن حذف الحساب نهائياً
                    {deleteCheck.allowed
                      ? ` لأنه مستخدم كحساب مرتبط لـ ${deleteRefs.map(r => `${r.label} (${r.count})`).join('، ')}`
                      : ` — ${deleteCheck.reason}`}
                    {' '}وسيتم تحويله إلى حساب غير نشط (Inactive).
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl text-sm font-medium"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  className="px-5 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl text-sm font-bold shadow-lg"
                >
                  {canDeleteFully ?'حذف نهائي' :'إيقاف الحساب (Inactive)'}
                </button>
              </div>
            </>
          )}
 </ModalShell>
 )}

 {f9ListOpen && (
 <ModalShell
  id="account-f9-browse"
  open={!!f9ListOpen}
  onClose={() => setF9ListOpen(false)}
  title={
   <span className="flex items-center gap-2">
   قائمة البحث — دليل الحسابات
   <span className="text-xs font-semibold text-slate-400">({f9List.length} حساب)</span>
   </span>
  }
  icon={List}
  size="lg"
  footer={null}
  bodyClassName="p-0"
 >
 <div className="flex flex-col h-full">
 <div className="p-4 border-b border-slate-800">
 <div className="relative">
 <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 autoFocus
 value={f9Query}
 onChange={e => setF9Query(e.target.value)}
 onKeyDown={e => {
 if (e.key ==='Escape') setF9ListOpen(false);
 if (e.key ==='Enter' && f9List.length > 0) selectFromF9(f9List[0]);
 }}

 className="w-full px-9 py-2.5 text-sm glass-input rounded-xl"
 />
 </div>
 </div>

 <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
 {f9List.length === 0 ? (
 <div className="py-14 text-center text-slate-400">
 <div className="flex flex-col items-center gap-3">
 <FileText className="w-10 h-10 text-slate-600" />
 <p className="font-bold text-white">لا توجد حسابات مطابقة</p>
 <p className="text-sm">جرّب كلمة أخرى أو أعد ضبط البحث.</p>
 </div>
 </div>
 ) : (
 f9List.map(acc => (
 <button
 key={acc.id}
 onClick={() => selectFromF9(acc)}
 className="w-full text-right flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 hover:bg-sky-500/10 transition-colors cursor-pointer"
 >
 <div className="flex-shrink-0">
 {acc.level <= 4 ? (
 <Folder className="w-4 h-4 text-amber-400" />
 ) : (
 <FileText className="w-4 h-4 text-emerald-400" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-mono font-bold text-sky-400 text-sm">{acc.code}</span>
 <span className="font-bold text-white whitespace-nowrap">{acc.nameAr}</span>
 {!acc.isActive && (
 <span className="text-xs font-bold px-1.5 py-0.5 rounded-full border border-slate-700 text-slate-500">موقوف</span>
 )}
 </div>
 <div className="text-sm text-slate-400 font-mono whitespace-nowrap truncate">{acc.nameEn}</div>
 </div>
 <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${LEVEL_BADGES[acc.level]}`}>
 مستوى {acc.level}
 </span>
 <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:inline">
 {acc.level === 5 ?'تشغيلي' :'تجميعي'}
 </span>
 <span className="text-xs text-slate-400 flex-shrink-0 hidden md:inline w-28 truncate">
 {CATEGORY_LABELS[acc.category]}
 </span>
 </button>
 ))
 )}
 </div>

 <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400 bg-slate-900/60">
 <span>اختر حساباً للانتقال إليه في الشجرة</span>
 <span className="flex items-center gap-3">
 <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-800 font-mono">Enter</kbd> اختيار أول نتيجة</span>
 <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-800 font-mono">Esc</kbd> إغلاق</span>
 </span>
 </div>
 </div>
 </ModalShell>
 )}
 </div>
 );
}
