import React, { createContext, useCallback, useContext, useState} from'react';
import { CheckCircle2, AlertCircle, Info, X} from'lucide-react';

type ToastType ='success' |'error' |'info';

interface ToastItem {
 id: number;
 type: ToastType;
 message: string;
}

type PushToast = (type: ToastType, message: string) => void;

const ToastContext = createContext<PushToast>(() => {});

export function useToast(): PushToast {
 return useContext(ToastContext);
}

const TOAST_STYLES: Record<ToastType, { box: string; bar: string; iconBox: string; icon: React.ReactNode}> = {
  success: {
  box:'border-sky-500/40 bg-[#0c1428]/95 text-[#dbeafe]',
  bar:'bg-sky-400',
  iconBox:'bg-sky-500/20',
  icon: <CheckCircle2 className="w-5 h-5 text-[#38bdf8]" />
},
  error: {
  box:'border-sky-500/40 bg-[#0c1428]/95 text-[#dbeafe]',
  bar:'bg-blue-500',
  iconBox:'bg-blue-500/20',
  icon: <AlertCircle className="w-5 h-5 text-[#60a5fa]" />
},
  info: {
  box:'border-sky-500/40 bg-[#0a1220]/95 text-[#dbeafe]',
  bar:'bg-sky-400',
  iconBox:'bg-sky-500/20',
  icon: <Info className="w-5 h-5 text-[#38bdf8]" />
}
};

export function ToastProvider({ children}: { children: React.ReactNode}) {
 const [toasts, setToasts] = useState<ToastItem[]>([]);

 const push = useCallback<PushToast>((type, message) => {
 const id = Date.now() + Math.random();
 setToasts(prev => [...prev, { id, type, message}]);
 window.setTimeout(() => {
 setToasts(prev => prev.filter(t => t.id !== id));
}, 4500);
}, []);

 return (
 <ToastContext.Provider value={push}>
 {children}
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4 space-y-2 pointer-events-none">
 {toasts.map(t => (
 <div
 key={t.id}
 className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-2xl animate-toast-in ${TOAST_STYLES[t.type].box}`}
 >
 <span className={`absolute right-0 top-0 bottom-0 w-1 ${TOAST_STYLES[t.type].bar}`} />
 <div className={`flex-shrink-0 mt-0.5 p-2 rounded-xl border border-white/10 shadow-lg ${TOAST_STYLES[t.type].iconBox}`}>
 {TOAST_STYLES[t.type].icon}
 </div>
 <p className="text-sm font-semibold flex-1 leading-relaxed">{t.message}</p>
 <button
 onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
 className="text-slate-400 hover:text-white transition-colors cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 ))}
 </div>
 </ToastContext.Provider>
 );
}
