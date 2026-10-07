import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenLine } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/** Read | Write: the two spaces of the app. Always shown, for everyone. */
export const SpaceSwitch: React.FC = () => {
  const { space } = useApp();
  return (
    <nav className="space-switch" aria-label="Space">
      <Link to="/read" aria-current={space === 'read' ? 'page' : undefined}>
        <BookOpen aria-hidden="true" /> Read
      </Link>
      <Link to="/write" aria-current={space === 'write' ? 'page' : undefined}>
        <PenLine aria-hidden="true" /> Write
      </Link>
    </nav>
  );
};
