import React from 'react';

interface PageHeadProps {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}

/** The editorial page opening used across the studio: running head, big serif title, short lead. */
export const PageHead: React.FC<PageHeadProps> = ({ eyebrow, title, lead, actions }) => (
  <header className="page-head">
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
);
