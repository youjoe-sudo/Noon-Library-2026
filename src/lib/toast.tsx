import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, type?: ToastType) => void;
  remove: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toasts, show, remove }}>
      {children}
      <ToastContainer toasts={toasts} remove={remove} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`animate-fade-in cursor-pointer rounded-xl px-5 py-3 text-sm font-semibold shadow-card ${
            t.type === 'success'
              ? 'bg-primary-600 text-white'
              : t.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-ink-800 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
