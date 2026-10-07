import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const subscribeNever = () => () => undefined;
const findSlot = () => document.getElementById('context-slot');

interface MarginsRailProps {
  /** A short line set in italics at the foot of the panel */
  thought?: React.ReactNode;
  children: React.ReactNode;
}

/** A single "In the margins" block. */
export const RailBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="context-block">
    <h2>{title}</h2>
    {children}
  </div>
);

/** One label and value row, for short facts in a rail block. */
export const RailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--muted)', lineHeight: 2 }}>
    <span>{label}</span>
    <span style={{ color: 'var(--ink)' }}>{value}</span>
  </div>
);

/**
 * The right-hand "In the margins" panel shared by the workspace pages. It sits next to <main>
 * in the app shell, so it is mounted through a portal into #context-slot.
 */
export const MarginsRail: React.FC<MarginsRailProps> = ({
  thought = (
    <>
      Not every sentence has
      <br />
      to know where it’s going.
    </>
  ),
  children,
}) => {
  // The slot lives in the app shell and exists once the page has mounted; React re-checks after mounting
  const slot = useSyncExternalStore(subscribeNever, findSlot, () => null);

  if (!slot) return null;

  return createPortal(
    <aside className="studio-context" aria-label="In the margins">
      <div className="context-title">
        <h2 className="eyebrow">IN THE MARGINS</h2>
        <span aria-hidden="true">n.</span>
      </div>
      {children}
      <div className="context-thought">
        <span aria-hidden="true">✳</span>
        <p>{thought}</p>
      </div>
    </aside>,
    slot
  );
};
