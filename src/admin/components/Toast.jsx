import { createContext, useCallback, useContext, useState } from "react";

const ToastCtx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((msg, type = "info", duration = 3500) => {
    const id = ++_id;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const icons = { success: "✓", error: "✕", info: "ℹ" };

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="sa-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`sa-toast ${t.type}`}>
            <span>{icons[t.type]}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
