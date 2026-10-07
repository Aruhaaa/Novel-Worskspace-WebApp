import React from 'react';
import { Menu, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Brand } from '../Brand';
import { ProfileMenu } from './ProfileMenu';
import { openSearch } from '../../lib/uiEvents';
import { useOnline } from '../../lib/online';
import { SpaceSwitch } from './SpaceSwitch';

const VIEW_LABELS: Record<string, string> = {
  home: 'Studio',
  read_home: 'Reading',
  manuscripts: 'Manuscripts',
  editor: 'Manuscript',
  notebook: 'World notebook',
  outline: 'Story outline',
  tracker: 'Progress',
  library: 'Library',
  saved_library: 'Your Library',
  reader: 'Reading',
  profile: 'My profile',
  messages: 'Messages',
  print: 'Print view',
  admin: 'Admin',
  preferences: 'Preferences',
};

export const AppHeader: React.FC<{ onOpenMenu: () => void; menuOpen: boolean }> = ({ onOpenMenu, menuOpen }) => {
  const { activeView, activeProject, isSupabase } = useApp();
  const online = useOnline();
  const projectViews = ['editor', 'outline', 'notebook', 'tracker', 'print'];
  const showProject = !!activeProject && projectViews.includes(activeView);

  return (
    <header className="studio-header">
      <button
        className="icon-button mobile-menu-button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
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
            <span>/ {VIEW_LABELS[activeView] || ''}</span>
          </>
        ) : (
          VIEW_LABELS[activeView] || ''
        )}
      </p>
      <SpaceSwitch />
      <div className="studio-header-right">
        {!online && (
          <span className="offline-pill" role="status" title="Your words are kept on this device and save when you reconnect">
            Offline{isSupabase ? ' · saving on this device' : ''}
          </span>
        )}
        <button className="search-button" onClick={openSearch} aria-label="Search and jump (Ctrl K)" title="Search and jump (Ctrl K)">
          <Search />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
};
