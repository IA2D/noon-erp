import React, { useState, useMemo } from 'react';
import {
  Network,
  Plus,
  Search,
  Pencil,
  Trash2,
  Folder,
  FolderOpen,
  Layers,
  GitBranch,
  ShieldAlert,
  CheckCircle2,
  Users
} from 'lucide-react';
import { CostCenter, JournalEntry } from '../../types/erp';
import { useToast } from '../ui/Toast';
import PageHeader from '../ui/PageHeader';
import F9SearchInput from '../ui/F9SearchInput';
import ModalShell from '../ui/ModalShell';

interface Props {
  costCenters: CostCenter[];
  journals: JournalEntry[];
  onAddCostCenter: (cc: Omit<CostCenter, 'id'>) => void;
  onUpdateCostCenter: (id: string, updates: Partial<CostCenter>) => void;
  onDeleteCostCenter: (id: string) => void;
}

interface CenterForm {
  code: string;
  nameAr: string;
  nameEn: string;
  parentId: string;
}

function nextCostCenterCode(costCenters: CostCenter[]): string {
  const max = costCenters.reduce((acc, c) => {
    const raw = (c.code || '').replace(/\D/g, '');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `CC-${String(max + 1).padStart(3, '0')}`;
}

function emptyForm(code: string): CenterForm {
  return { code, nameAr: '', nameEn: '', parentId: '' };
}

export default function CostCentersView({ costCenters, journals, onAddCostCenter, onUpdateCostCenter, onDeleteCostCenter }: Props) {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string; form: CenterForm } | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CostCenter | null>(null);

  const childrenOf = (id?: string) => costCenters.filter(c => c.parentId === id);

  const descendantsOf = (id: string): string[] => {
    const result: string[] = [];
    childrenOf(id).forEach(child => {
      result.push(child.id);
      descendantsOf(child.id).forEach(d => result.push(d));
    });
    return result;
  };

  const journalUsage = (id: string): number =>
    journals.filter(j => j.lines.some(l => l.costCenterId === id)).length;

  const treeOrdered = useMemo(() => {
    const ordered: CostCenter[] = [];
    const walk = (parentId?: string, depth = 0) => {
      childrenOf(parentId)
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
        .forEach(cc => {
          ordered.push({ ...cc, _depth: depth } as CostCenter & { _depth: number });
          walk(cc.id, depth + 1);
        });
    };
    walk();
    return ordered as (CostCenter & { _depth: number })[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costCenters]);

  const filtered = treeOrdered.filter(cc => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      cc.code.toLowerCase().includes(term) ||
      cc.nameAr.includes(searchTerm.trim()) ||
      cc.nameEn.toLowerCase().includes(term)
    );
  });

  const parentName = (id?: string): string => {
    if (!id) return '—';
    const p = costCenters.find(c => c.id === id);
    return p ? `${p.code} - ${p.nameAr}` : '—';
  };

  const rootCount = childrenOf(undefined).length;
  const leafCount = costCenters.filter(c => childrenOf(c.id).length === 0).length;
  const usedCount = costCenters.filter(c => journalUsage(c.id) > 0).length;

  const openAdd = () => {
    setFormError('');
    setModal({ mode: 'add', form: emptyForm(nextCostCenterCode(costCenters)) });
  };

  const openEdit = (cc: CostCenter) => {
    setFormError('');
    setModal({
      mode: 'edit',
      id: cc.id,
      form: { code: cc.code, nameAr: cc.nameAr, nameEn: cc.nameEn, parentId: cc.parentId || '' }
    });
  };

  const availableParents = (selfId?: string): CostCenter[] => {
    const excluded = new Set(selfId ? [selfId, ...descendantsOf(selfId)] : []);
    return costCenters
      .filter(c => !excluded.has(c.id))
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const f = modal.form;
    if (!f.nameAr.trim()) {
      setFormError('اسم مركز التكلفة بالعربية مطلوب.');
      return;
    }
    if (!f.code.trim()) {
      setFormError('كود مركز التكلفة مطلوب.');
      return;
    }
    if (costCenters.some(c => c.code.toLowerCase() === f.code.trim().toLowerCase() && c.id !== modal.id)) {
      setFormError('كود مركز التكلفة مستخدم مسبقاً.');
      return;
    }
    if (modal.mode === 'add') {
      onAddCostCenter({
        code: f.code.trim(),
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        parentId: f.parentId || undefined
      });
      toast('success', `تمت إضافة مركز التكلفة ${f.code} - ${f.nameAr.trim()}`);
    } else if (modal.id) {
      onUpdateCostCenter(modal.id, {
        code: f.code.trim(),
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        parentId: f.parentId || undefined
      });
      toast('success', `تم تحديث مركز التكلفة ${f.code}`);
    }
    setModal(null);
  };

  const openDelete = (cc: CostCenter) => {
    const children = childrenOf(cc.id);
    if (children.length > 0) {
      toast('error', `لا يمكن حذف مركز التكلفة "${cc.nameAr}" لأنه يحتوي على ${children.length} مركز فرعي — احذفها أولاً أو انقلها.`);
      return;
    }
    const usage = journalUsage(cc.id);
    if (usage > 0) {
      toast('error', `لا يمكن حذف مركز التكلفة "${cc.nameAr}" لأنه مرتبط بـ ${usage} قيد محاسبي — لا يمكن حذف المركز بعد ترحيل قيود عليه.`);
      return;
    }
    setDeleteTarget(cc);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteCostCenter(deleteTarget.id);
    toast('success', `تم حذف مركز التكلفة ${deleteTarget.code} - ${deleteTarget.nameAr}`);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<Network className="w-6 h-6" />}
        title="مراكز التكلفة"
        subtitle="إدارة الهيكل التنظيمي لمراكز التكلفة (رئيسية وفرعية) لتحميل المصاريف والإيرادات عليها بدقة"
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-[#ffffff] font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إضافة مركز تكلفة
          </button>
        }
      />

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">إجمالي مراكز التكلفة</div>
          <div className="text-2xl font-black text-white mt-1">{costCenters.length}</div>
          <div className="text-sm text-slate-500 mt-1">المستوى الرئيسي والفرعي</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">مراكز رئيسية</div>
          <div className="text-2xl font-black text-sky-400 mt-1">{rootCount}</div>
          <div className="text-sm text-slate-500 mt-1">بدون أب هرمي</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">مراكز فرعية (أوراق)</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{leafCount}</div>
          <div className="text-sm text-slate-500 mt-1">لا تحتوي على أبناء</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50">
          <div className="text-xs text-slate-400">مستخدمة في القيود</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{usedCount}</div>
          <div className="text-sm text-slate-500 mt-1">مرتبطة بحركات محاسبية</div>
        </div>
      </div>

      {/* البحث */}
      <div className="glass p-4 rounded-2xl border border-slate-700/50">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <F9SearchInput
            value={searchTerm}
            onChange={v => setSearchTerm(v)}

            className="w-full px-10 py-2.5 text-sm glass-input rounded-xl"
            items={filtered}
            columns={[
              { label: 'الكود', render: (cc: CostCenter & { _depth: number }) => <span className="font-mono font-bold text-sky-400">{cc.code}</span> },
              {
                label: 'الاسم', render: (cc: CostCenter & { _depth: number }) => (
                  <div>
                    <div className="font-bold text-white">{cc.nameAr}</div>
                    <div className="text-sm text-slate-400 font-mono">{cc.nameEn || '—'}</div>
                  </div>
                )
              },
              { label: 'المستوى', render: (cc: CostCenter & { _depth: number }) => <span className="font-mono text-slate-300">مستوى {(cc._depth ?? 0) + 1}</span> }
            ]}
            searchText={cc => `${cc.code} ${cc.nameAr} ${cc.nameEn}`}
            browseTitle="استعراض مراكز التكلفة"
          />
        </div>
      </div>

      {/* القائمة الهيكلية */}
      <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[900px]">
            {filtered.map(cc => {
              const childCount = childrenOf(cc.id).length;
              const usage = journalUsage(cc.id);
              return (
                <div key={cc.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-white/5 transition-colors ${childCount === 0 ? 'opacity-100' : ''}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-[300px]" style={{ paddingInlineStart: `${cc._depth * 28}px` }}>
                    <div className={`p-2 rounded-lg border flex-shrink-0 ${childCount > 0 ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-800/60 text-slate-400 border-slate-700/50'}`}>
                      {childCount > 0 ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-400 text-sm">{cc.code}</span>
                        <span className="font-bold text-white whitespace-nowrap">{cc.nameAr}</span>
                      </div>
                      <div className="text-sm text-slate-400 font-mono whitespace-nowrap">{cc.nameEn || '—'}</div>
                    </div>
                  </div>

                  <div className="w-44 flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
                    <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{parentName(cc.parentId)}</span>
                  </div>

                  <div className="w-28 flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
                    <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-mono">{childCount} مركز فرعي</span>
                  </div>

                  <div className="w-28 flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className={`font-mono ${usage > 0 ? 'text-amber-400 font-bold' : ''}`}>{usage} قيد</span>
                  </div>

                  <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(cc)}
                      title="تعديل مركز التكلفة"
                      className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(cc)}
                      title="حذف مركز التكلفة"
                      className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-14 text-center text-slate-400">
                <div className="flex flex-col items-center gap-3">
                  <Network className="w-10 h-10 text-slate-600" />
                  <p className="font-bold text-white">لا توجد مراكز تكلفة مطابقة</p>
                  <p className="text-sm">جرّب تغيير نص البحث أو أضف مركز تكلفة جديداً</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نافذة الإضافة / التعديل */}
      {modal && (
        <ModalShell
          id="cost-center-form"
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal.mode === 'add' ? 'إضافة مركز تكلفة جديد' : 'تعديل مركز التكلفة'}
          icon={Network}
          size="md"
          footer={null}
          closeOnBackdrop={false}
          bodyClassName="p-0"
        >

            <form onSubmit={handleSave} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {formError && (
                  <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">كود مركز التكلفة *</label>
                    <input
                      type="text"
                      required
                      value={modal.form.code}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, code: e.target.value.toUpperCase() } })}
                      className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
                      dir="ltr"

                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">مركز التكلفة الأب (اختياري)</label>
                    <select
                      value={modal.form.parentId}
                      onChange={e => setModal({ ...modal, form: { ...modal.form, parentId: e.target.value } })}
                      className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 text-white"
                    >
                      <option value="">— مركز رئيسي (بدون أب) —</option>
                      {availableParents(modal.id).map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.code} - {cc.nameAr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم مركز التكلفة بالعربية *</label>
                  <input
                    type="text"
                    required
                    value={modal.form.nameAr}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nameAr: e.target.value } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl"

                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم مركز التكلفة بالإنجليزية</label>
                  <input
                    type="text"
                    value={modal.form.nameEn}
                    onChange={e => setModal({ ...modal, form: { ...modal.form, nameEn: e.target.value } })}
                    className="w-full px-3 py-2 text-sm glass-input rounded-xl font-mono"
                    dir="ltr"

                  />
                </div>

                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-sky-400" />
                  يمكن إنشاء هيكل هرمي متعدد المستويات — تظهر المراكز الفرعية داخل مركزها الرئيسي في الجدول.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/70 flex-shrink-0 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-[#ffffff] shadow-lg transition-all cursor-pointer"
                >
                  {modal.mode === 'add' ? 'حفظ المركز' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
        </ModalShell>
      )}

      {/* نافذة تأكيد الحذف */}
      {deleteTarget && (
        <ModalShell
          id="cost-center-delete"
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="حذف مركز التكلفة"
          icon={Trash2}
          size="sm"
          footer={null}
          closeOnBackdrop={false}
          className="border-red-500/30"
        >
              <p className="text-sm text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف مركز التكلفة <span className="font-bold text-white">{deleteTarget.code} - {deleteTarget.nameAr}</span>؟
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl glass text-slate-300 hover:bg-white/10 border border-slate-700/60 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-lg transition-all cursor-pointer"
                >
                  حذف نهائي
                </button>
              </div>
        </ModalShell>
      )}
    </div>
  );
}
