import React from'react';
import { Inbox} from'lucide-react';

interface Props {
 icon?: React.ReactNode;
 title: string;
 description?: string;
 action?: React.ReactNode;
 compact?: boolean;
}

export default function EmptyState({ icon, title, description, action, compact}: Props) {
 return (
 <div className={`flex flex-col items-center justify-center gap-3 text-center ${compact ?'py-8 px-4' :'py-16 px-6'}`}>
 <div className="relative">
 <div className={`${compact ?'w-12 h-12' :'w-16 h-16'} rounded-2xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center relative overflow-hidden`}>
 {icon ?? <Inbox className={`${compact ?'w-5 h-5' :'w-7 h-7'} text-sky-400 relative`} />}
 </div>
 </div>
 <div>
 <p className={`font-bold text-white ${compact ?'text-sm' :'text-lg'}`}>{title}</p>
 {description && <p className={`text-sm text-slate-400 mt-1 max-w-md mx-auto ${compact ?'text-xs' :''}`}>{description}</p>}
 </div>
 {action && <div className="mt-2">{action}</div>}
 </div>
 );
}
