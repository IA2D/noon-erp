import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle, LogIn, CalendarDays } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onLogin: (username: string, password: string, fiscalYear: string) => boolean;
  fiscalYears: string[];
  defaultFiscalYear: string;
}

export default function LoginView({ onLogin, fiscalYears, defaultFiscalYear }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    window.setTimeout(() => {
      const success = onLogin(username, password, fiscalYear);
      if (!success) {
        setError(t('login.invalid'));
      }
      setIsLoading(false);
    }, 700);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#0c0f1a] flex items-center justify-center p-4">
      {/* Login Card */}
      <div className="relative w-full max-w-sm">
        <div className="bg-[#ffffff] dark:bg-[#0f1629] rounded-2xl border border-sky-100/90 dark:border-slate-800 shadow-md p-6 sm:p-8 mx-auto">
          {/* Logo & Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white border border-sky-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl mb-4 shadow-sm overflow-hidden">
              <img src="./brand/fullerp-icon-128.png" alt="" aria-hidden="true" className="w-14 h-14 object-contain dark:hidden" />
              <img src="./brand/fullerp-icon-dark-128.png" alt="" aria-hidden="true" className="hidden w-14 h-14 object-contain dark:block" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">{t('app.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">تسجيل الدخول للنظام المحاسبي</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('login.username')}</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}

                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc]/50 text-[#0f172a] caret-sky-600 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-[#f8fafc] dark:caret-sky-400 dark:placeholder:text-slate-500 focus:bg-[#ffffff] focus:text-[#0f172a] focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none dark:focus:bg-[#0f172a] dark:focus:text-[#ffffff] dark:focus:border-sky-400 dark:focus:ring-sky-500/20 transition-all duration-200 pr-10"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('login.password')}</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}

                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc]/50 text-[#0f172a] caret-sky-600 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-[#f8fafc] dark:caret-sky-400 dark:placeholder:text-slate-500 focus:bg-[#ffffff] focus:text-[#0f172a] focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none dark:focus:bg-[#0f172a] dark:focus:text-[#ffffff] dark:focus:border-sky-400 dark:focus:ring-sky-500/20 transition-all duration-200 pr-10 pl-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">العام الافتراضي للتقارير</label>
              <div className="relative">
                <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full appearance-none text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc]/50 text-[#0f172a] dark:border-slate-700 dark:bg-slate-800 dark:text-[#f8fafc] focus:bg-[#ffffff] focus:text-[#0f172a] focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none dark:focus:bg-[#0f172a] dark:focus:text-[#ffffff] dark:focus:border-sky-400 dark:focus:ring-sky-500/20 transition-all duration-200 pr-10"
                  required
                >
                  {fiscalYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">تبدأ التقارير تلقائياً من 01/01 إلى 31/12 للعام المختار.</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3 border border-red-200 dark:border-red-500/30">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="light-primary-button w-full py-2.5 bg-[#006fba] hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('login.signingIn')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  {t('login.signIn')}
                </span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            <p>{t('login.copyright')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
