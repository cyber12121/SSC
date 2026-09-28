import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'normal';
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Icons & Styles ──────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 shrink-0" />,
  error:   <XCircle className="w-4 h-4 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
  info:    <Info className="w-4 h-4 shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-slate-800 text-white',
};

// ─── Toast Item ──────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative flex items-start gap-2.5 rounded-xl px-4 py-3 shadow-xl text-sm font-semibold max-w-sm w-full overflow-hidden ${STYLES[toast.type]}`}
    >
      {/* Auto-dismiss progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-white/30 rounded-full"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: toast.duration / 1000, ease: 'linear' }}
      />
      {ICONS[toast.type]}
      <span className="leading-snug flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 ml-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: (result: boolean) => void }) {
  const isDanger = state.variant === 'danger';
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => onClose(false)}
      />
      <motion.div
        className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {state.title && (
          <h3 className="text-base font-bold text-slate-900 mb-2">{state.title}</h3>
        )}
        <p className="text-sm text-slate-600 leading-relaxed">{state.message}</p>
        <div className="flex gap-2.5 mt-5 justify-end">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => onClose(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, message, type, duration }].slice(-4));
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirm({ ...options, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    confirm?.resolve(result);
    setConfirm(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast stack — above mobile nav (bottom-20), desktop bottom-right */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[9998] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence mode="sync">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm dialog */}
      <AnimatePresence>
        {confirm && <ConfirmModal state={confirm} onClose={handleConfirmClose} />}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}
