import React from 'react';
import { Menu, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Brand } from '../Brand';
import { ProfileMenu } from './ProfileMenu';
import { NotificationBell } from '../Notifications/NotificationBell';
import { openSearch } from '../../lib/uiEvents';
import { useOnline } from '../../lib/online';
import { SpaceSwitch } from './SpaceSwitch';
import { useT } from '../../i18n';

export const AppHeader: React.FC<{ onOpenMenu: () => void; menuOpen: boolean }> = ({ onOpenMenu, menuOpen }) => {
  const t = useT();
  const { activeView, activeProject, isSupabase } = useApp();
  const online = useOnline();
  const projectViews = ['editor', 'outline', 'notebook', 'tracker', 'print'];
  const showProject = !!activeProject && projectViews.includes(activeView);

  const labels: Record<string, string> = {
    home: t('Studio'),
    read_home: t('Reading'),
    manuscripts: t('Manuscripts'),
    editor: t('Manuscript'),
    notebook: t('World notebook'),
    outline: t('Story outline'),
    tracker: t('Progress'),
    library: t('Library'),
    saved_library: t('Your Library'),
    reader: t('Reading'),
    profile: t('My profile'),
    messages: t('Messages'),
    notifications: t('Notifications'),
    print: t('Print view'),
    admin: t('Admin'),
    preferences: t('Preferences'),
  };

  return (
    <header className="studio-header">
      <button
        className="icon-button mobile-menu-button"
        onClick={onOpenMenu}
        aria-label={t('Open navigation')}
        aria-expanded={menuOpen}
        aria-controls="studio-sidebar"
      >
        <Menu />
      </button>
      <Brand to="#/" />
      <span className="studio-header-separator" aria-hidden="true" />
      <p className="project-breadcrumb">
        {showProject ? (
          <>
            {activeProject!.title}
            <span>/ {labels[activeView] || ''}</span>
          </>
        ) : (
          labels[activeView] || ''
        )}
      </p>
      <SpaceSwitch />
      <div className="studio-header-right">
        {!online && (
          <span className="offline-pill" role="status" title={t('Your words are kept on this device and save when you reconnect')}>
            {t('Offline')}
            {isSupabase ? ` · ${t('saving on this device')}` : ''}
          </span>
        )}
        <button className="search-button" onClick={openSearch} aria-label={t('Search and jump (Ctrl K)')} title={t('Search and jump (Ctrl K)')}>
          <Search />
          <span>{t('Search')}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
};
