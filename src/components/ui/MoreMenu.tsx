import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MoreMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

/** A small "More" dropdown for the less-used toolbar actions. */
export const MoreMenu: React.FC<{ items: MoreMenuItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="header-menu-wrap">
      <button
        className="button button-outline button-small"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal style={{ width: 16, height: 16 }} /> More
      </button>
      {open && (
        <div className="menu-pop" role="menu" style={{ width: 220 }}>
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
