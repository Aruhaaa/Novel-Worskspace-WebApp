import React from 'react';
import { BookOpen, Bookmark, PenLine, Users } from 'lucide-react';

const ICONS = { book: BookOpen, bookmark: Bookmark, pen: PenLine, users: Users };

interface EmptyStateProps {
  icon?: keyof typeof ICONS;
  title: string;
  text?: string;
  children?: React.ReactNode;
}

/** The studio's dashed "nothing here yet" panel. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'book', title, text, children }) => {
  const Icon = ICONS[icon];
  return (
    <div className="empty">
      <Icon />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
};
