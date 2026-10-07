import React, { useEffect, useRef } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}

/** A native <dialog> styled by the studio stylesheet. Children mount only while open, so forms reset. */
export const Dialog: React.FC<DialogProps> = ({ open, onClose, labelledBy, className = '', children }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`dialog ${className}`} aria-labelledby={labelledBy} onClose={onClose}>
      {open && children}
    </dialog>
  );
};
