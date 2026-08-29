import { Component, ReactNode } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { getPersistentEntries } from '../utils/desktopStorage';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export function downloadEmergencyBackup(): boolean {
  try {
    const payload = Object.fromEntries(getPersistentEntries());
    const blob = new Blob([JSON.stringify({ __emergencyBackup: true, exportedAt: new Date().toISOString(), data: payload }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fullerp-emergency-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1120', padding: 24, fontFamily: 'Tajawal, sans-serif' }}>
        <div style={{ maxWidth: 560, width: '100%', background: '#111a2e', border: '1px solid #1e293b', borderRadius: 16, padding: 28, color: '#e2e8f0', textAlign: 'center' }}>
          <AlertTriangle size={44} style={{ color: '#f59e0b', marginBottom: 12 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>حدث خطأ غير متوقع</h1>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.9, marginBottom: 6 }}>
            توقّف العرض بسبب خطأ داخلي. بياناتك محفوظة في قاعدة بيانات التطبيق ولم تُفقد.
          </p>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20, wordBreak: 'break-word', maxHeight: 80, overflow: 'auto' }}>
            {this.state.message}
          </p>
          <p style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 16 }}>ننصح بتنزيل نسخة احتياطية طارئة قبل أي شيء آخر.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { downloadEmergencyBackup(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              <Download size={16} /> تنزيل نسخة احتياطية طارئة
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              <RefreshCw size={16} /> إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      </div>
    );
  }
}
