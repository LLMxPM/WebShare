// 文件功能描述：提供 React 全局 toast 提示队列、自动消失计时和上下文调用接口。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { classNames } from "./utils/format";

export type ToastType = "success" | "error";

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ToastProvider 维护全局消息队列并渲染固定定位提示栈。
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((items) => items.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      if (!message) return;
      const toast: ToastMessage = { id: nextId.current++, type, message };
      setToasts((items) => {
        const next = [...items, toast].slice(-4);
        items.filter((item) => !next.some((nextItem) => nextItem.id === item.id)).forEach((item) => clearTimer(item.id));
        return next;
      });
      timers.current.set(toast.id, window.setTimeout(() => dismissToast(toast.id), type === "error" ? 5000 : 3200));
    },
    [clearTimer, dismissToast],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[80] grid w-[min(360px,calc(100vw-28px))] gap-2" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            className={classNames(
              "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-white px-3 py-3 text-sm shadow-xl",
              toast.type === "error" ? "border-red-200 text-red-700" : "border-emerald-200 text-emerald-700",
            )}
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <span className="min-w-0 break-words">{toast.message}</span>
            <button
              className="inline-grid h-6 w-6 place-items-center rounded border-0 bg-transparent text-current hover:bg-black/5"
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="关闭消息"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// useToast 返回全局消息提示方法，必须在 ToastProvider 内使用。
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast 必须在 ToastProvider 内使用");
  return context;
}
