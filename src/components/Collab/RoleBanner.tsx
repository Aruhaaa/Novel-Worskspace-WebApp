import React from 'react';
import { useApp } from '../../context/AppContext';
import { ROLE_LABEL } from '../../lib/notifications';
import { useT } from '../../i18n';

/** At the top of the screens of a project that is someone else's: whose it is, and what this person may do in it. */
export const RoleBanner: React.FC = () => {
  const t = useT();
  const { activeProject, projectRole, sharedProjects } = useApp();
  if (!activeProject || projectRole === 'owner') return null;

  const owner = sharedProjects.find((p) => p.id === activeProject.id)?.ownerName || t('the owner');
  const what =
    projectRole === 'viewer'
      ? t('You can read it, but not change it.')
      : projectRole === 'editor'
        ? t('You can write in the chapters. Adding, removing and reordering chapters, and the outline and notebook, are for co-authors and the owner.')
        : t('You can change everything except sharing, publishing and deleting the project.');

  return (
    <p className="role-banner" role="note">
      <strong>{t('Shared with you')}.</strong> {t('Your role on “{title}”, by {owner}, is {role}.', { role: ROLE_LABEL[projectRole](), title: activeProject.title, owner })} {what}
    </p>
  );
};
