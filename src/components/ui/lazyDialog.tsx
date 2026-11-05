import React, { Suspense, lazy, useState } from 'react';

/**
 * A dialog whose code is only downloaded the first time it is opened. After that it stays mounted, exactly as a dialog
 * that was always there, so it keeps its own state while closed.
 */
export function lazyDialog<P extends object>(load: () => Promise<{ default: React.ComponentType<P> }>, isOpen: (props: P) => boolean): React.FC<P> {
  const Inner = lazy(load);
  const LazyDialog: React.FC<P> = (props) => {
    const [seen, setSeen] = useState(false);
    if (!seen && isOpen(props)) setSeen(true);
    if (!seen) return null;
    return (
      <Suspense fallback={null}>
        <Inner {...(props as P & React.JSX.IntrinsicAttributes)} />
      </Suspense>
    );
  };
  return LazyDialog;
}
