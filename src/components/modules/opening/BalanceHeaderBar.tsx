import {CheckCircle2, AlertTriangle, ArrowLeftRight, ShieldCheck, Loader2} from 'lucide-react';
import {fmtAmountCur} from '../../../utils/format';

interface Props {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  accountsWithBalance: number;
  postingAccountsCount: number;
  baseCode: string;
  saving?: boolean;
  /** حجب الاعتماد عند وجود سعر تحويل خارج النطاق المسموح */
  rateBlocked?: boolean;
  onAutoBalance: () => void;
  onApprove: () => void;
}

export default function BalanceHeaderBar({totalDebit, totalCredit, isBalanced, accountsWithBalance, postingAccountsCount, baseCode, saving, rateBlocked, onAutoBalance, onApprove}: Props) {
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;

  return (
    <div className="sticky top-0 z-30 space-y-3">
      {/* شريط المؤشرات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass p-3.5 rounded-2xl border border-slate-700/50 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm text-slate-400">الحسابات التشغيلية</div>
            <div className="text-xl font-black text-white mt-0.5">{postingAccountsCount}</div>
          </div>
          <div className="text-xs text-slate-500">حسابات مستوى 5</div>
        </div>
        <div className="glass p-3.5 rounded-2xl border border-slate-700/50 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm text-slate-400">حسابات ذات أرصدة</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{accountsWithBalance}</div>
          </div>
          <div className="text-xs text-slate-500">محدّثة</div>
        </div>
        <div className={`glass p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${isBalanced ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
          <div>
            <div className="text-sm text-slate-400">إجمالي المدين</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5 font-mono" dir="ltr">{fmtAmountCur(totalDebit, baseCode)}</div>
          </div>
          <span className="text-xs text-slate-500">{baseCode}</span>
        </div>
        <div className={`glass p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${isBalanced ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
          <div>
            <div className="text-sm text-slate-400">إجمالي الدائن</div>
            <div className="text-lg font-black text-amber-400 mt-0.5 font-mono" dir="ltr">{fmtAmountCur(totalCredit, baseCode)}</div>
          </div>
          <span className="text-xs text-slate-500">{baseCode}</span>
        </div>
      </div>

      {/* حالة التوازن والفرق */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl ${
          isBalanced
            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_30px_-10px_rgba(16,185,129,0.35)]'
            : 'bg-red-500/10 border-red-500/40 shadow-[0_0_30px_-10px_rgba(239,68,68,0.45)]'
        }`}
      >
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 animate-pulse" />
          )}
          <div>
            <div className={`text-sm font-black ${isBalanced ? 'text-emerald-300' : 'text-red-300'}`}>
              {isBalanced ? 'الأرصدة الافتتاحية متوازنة 100%' : 'الأرصدة الافتتاحية غير متوازنة'}
            </div>
            <div className="text-sm text-slate-300 mt-0.5 font-mono" dir="ltr">
              {isBalanced
                ? `${fmtAmountCur(totalDebit, baseCode)} = ${fmtAmountCur(totalCredit, baseCode)}`
                : `الفرق (Variance): ${fmtAmountCur(Math.abs(difference), baseCode)} — ${totalDebit > totalCredit ? 'المدين أكبر من الدائن' : 'الدائن أكبر من المدين'}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isBalanced && (
            <button
              type="button"
              onClick={onAutoBalance}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-500/15 hover:bg-amber-400 text-white border border-amber-500/40 transition-all cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              توازَن تلقائياً في حساب رأس المال / الفروقات الافتتاحية
            </button>
          )}
          <button
            type="button"
            onClick={onApprove}
            disabled={!isBalanced || saving || rateBlocked}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer border ${
              isBalanced && !saving && !rateBlocked
                ? 'bg-emerald-500/20 hover:bg-emerald-400 text-white border-emerald-500/40'
                : 'bg-slate-800/60 text-slate-500 border-slate-700/60 cursor-not-allowed'
            }`}
            title={isBalanced ? 'اعتماد الأرصدة الافتتاحية وتسويتها محاسبياً' : 'يُفعَّل عند توازن المدين والدائن'}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            اعتماد الأرصدة الافتتاحية
          </button>
        </div>
      </div>
    </div>
  );
}
