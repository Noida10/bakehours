import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message, { type = 'success', duration = 2000, action } = {}) => {
      const id = ++idSeq;
      setToasts((t) => [...t, { id, message, type, action }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast flex items-center gap-3 rounded-lg px-4 py-2.5 shadow-lg text-sm font-medium ${
              t.type === 'error'
                ? 'bg-red-600 text-white'
                : t.type === 'info'
                ? 'bg-slate-800 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            <span>
              {t.type === 'success' && '✓ '}
              {t.message}
            </span>
            {t.action && (
              <button
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
                className="underline underline-offset-2 font-semibold"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
