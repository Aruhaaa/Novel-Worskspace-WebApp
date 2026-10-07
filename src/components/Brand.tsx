import React from 'react';

/** The "n." mark and wordmark from the Literary Studio design. */
export const Brand: React.FC<{ to?: string }> = ({ to }) => {
  const inner = (
    <>
      <span className="brand-mark" aria-hidden="true">
        n<span>.</span>
      </span>
      <span className="brand-type" aria-hidden="true">
        novelist<span>WORKSPACE</span>
      </span>
    </>
  );
  return to ? (
    <a className="brand" href={to} aria-label="Novelist Workspace home">
      {inner}
    </a>
  ) : (
    <span className="brand" aria-label="Novelist Workspace">
      {inner}
    </span>
  );
};
