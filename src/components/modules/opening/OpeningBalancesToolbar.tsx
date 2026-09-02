import type {BrowseRow} from './types';
import SavedBalancesSearch from './SavedBalancesSearch';
import {Save, Send, Printer, Loader2, ClipboardList, Plus, Lock} from 'lucide-react';

interface Props {
  savedRows: BrowseRow[];
  onPickSaved: (row: BrowseRow) => void;
  onBrowse: () => void;
  onLoadAll: () => void;
  onAddLine: () => void;
  canSaveDraft: boolean;
  canPost: boolean;
  isPosted: boolean;
  saving?: boolean;
  onSaveDraft: () => void;
  onPost: () => void;
  onPrint: () => void;
}

const ghostBtn =
  'flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition-all cursor-pointer';

export default function OpeningBalancesToolbar({
  savedRows,
  onPickSaved,
  onBrowse,
  onLoadAll,
  onAddLine,
  canSaveDraft,
  canPost,
  isPosted,
  saving,
  onSaveDraft,
  onPost,
  onPrint,
}: Props) {
  return (
    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
      {/* صف البحث + الإجراءات */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <SavedBalancesSearch rows={savedRows} onPick={onPickSaved} onBrowseAll={onBrowse} />

        <div className="flex items-center gap-2 flex-wrap flex-1">
          <button
            type="button"
            onClick={onLoadAll}
            className={ghostBtn}
            title="تحميل الأرصدة المحفوظة داخل جدول الإدخال الرئيسي"
          >
            <ClipboardList className="w-3.5 h-3.5 text-sky-600" />
            استعراض الأرصدة المدخلة
          </button>
          <button
            type="button"
            onClick={onPrint}
            className={ghostBtn}
            title="طباعة تقرير الأرصدة الافتتاحية"
          >
            <Printer className="w-3.5 h-3.5 text-sky-600" />
            طباعة التقرير
          </button>
        </div>
      </div>

      {/* صف الإجراءات الرئيسية */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-800 pt-3">
        {/* زر إضافة سطر — يُخفى بعد الترحيل */}
        {!isPosted && (
          <button
            type="button"
            onClick={onAddLine}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
            title="إضافة سطر فارغ جديد للإدخال اليدوي (أو اضغط F2 / Insert)"
          >
            <Plus className="w-3.5 h-3.5" />
            + إضافة سطر جديد
          </button>
        )}
        {isPosted && <div />}

        {/* أزرار الحفظ والترحيل */}
        <div className="flex items-center gap-2.5">
          {/* زر حفظ كمسودة */}
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={!canSaveDraft || saving || isPosted}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer border ${
              canSaveDraft && !saving && !isPosted
                ? 'bg-sky-500 hover:bg-sky-400 text-white border-sky-500'
                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
            title={isPosted ? 'البيانات مُرحَّلة — لا يمكن التعديل' : 'حفظ الأرصدة كمسودة بدون ترحيل'}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ كمسودة
          </button>

          {/* زر ترحيل الأرصدة */}
          <button
            type="button"
            onClick={onPost}
            disabled={!canPost || saving}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer border ${
              canPost && !saving
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-500'
                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
            title={isPosted ? 'تم الترحيل مسبقاً' : canPost ? 'ترحيل الأرصدة الافتتاحية إلى دفتر الأستاذ العام' : 'التوازن (المدين = الدائن) مطلوب للترحيل'}
          >
            {isPosted ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {isPosted ? 'مُرحَّل' : 'ترحيل الأرصدة'}
          </button>
        </div>
      </div>
    </div>
  );
}
