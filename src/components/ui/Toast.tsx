import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ToastContext, type ToastOptions } from './toastContext';

interface ToastItem extends ToastOptions {
  id: number;
}

const MAX_VISIBLE = 3;

const ToastView: React.FC<{ item: ToastItem; onDone: (id: number) => void }> = ({ item, onDone }) => {
  const [paused, setPaused] = useState(false);
  const duration = item.duration ?? (item.actionLabel ? 8000 : 4500);

  // The clock stops while the pointer or keyboard focus is on the toast, so there is time to reach Undo
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => onDone(item.id), duration);
    return () => window.clearTimeout(t);
  }, [paused, duration, item.id, onDone]);

  return (
    <div
      className="snack"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{item.message}</span>
      {item.actionLabel && (
        <button
          className="snack-action"
          onClick={async () => {
            onDone(item.id);
            await item.onAction?.();
          }}
        >
          {item.actionLabel}
        </button>
      )}
      <button className="snack-close" aria-label="Dismiss" onClick={() => onDone(item.id)}>
        <X />
      </button>
    </div>
  );
};

/** Short messages at the foot of the screen, with an optional Undo. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...options, id }].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="snack-region" aria-label="Notifications">
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
