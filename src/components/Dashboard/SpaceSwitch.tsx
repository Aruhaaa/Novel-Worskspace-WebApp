import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenLine } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useT } from '../../i18n';

/** Read | Write: the two spaces of the app. Always shown, for everyone. */
export const SpaceSwitch: React.FC = () => {
  const t = useT();
  const { space } = useApp();
  return (
    <nav className="space-switch" aria-label={t('Space')}>
      <Link to="/read" aria-current={space === 'read' ? 'page' : undefined}>
        <BookOpen aria-hidden="true" /> {t('Read')}
      </Link>
      <Link to="/write" aria-current={space === 'write' ? 'page' : undefined}>
        <PenLine aria-hidden="true" /> {t('Write')}
      </Link>
    </nav>
  );
};
