import React, { useEffect, useRef, useState } from 'react';
import { User, Settings, LifeBuoy, LogOut, Download, BarChart2, MessageSquare, Shield, Compass, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLive } from '../../context/LiveContext';
import { useT } from '../../i18n';
import { startTour } from '../../lib/tour';

const SUPPORT_URL = 'https://github.com/Aruhaaa/Novel-Worskspace-WebApp/issues';
// "Get the Windows app" and "Get the Android app" download these two files from one GitHub release. They are not found by themselves: change
// the three values below with every release (README, "Desktop app and updates"), and publish that release, with both files attached,
// before the website that points at it goes live. The installed desktop app updates itself from the latest release and does not use these.
const RELEASE_TAG = 'v0.1.0';
const WINDOWS_FILE = 'Novelist-Workspace-Setup-0.1.0.exe';
const ANDROID_FILE = 'Novelist-Workspace-1.1.0.apk';
const RELEASE_URL = `https://github.com/Aruhaaa/Novel-Worskspace-WebApp/releases/download/${RELEASE_TAG}`;
const WINDOWS_URL = `${RELEASE_URL}/${WINDOWS_FILE}`;
const ANDROID_URL = `${RELEASE_URL}/${ANDROID_FILE}`;

type MenuView = 'profile' | 'preferences' | 'tracker' | 'messages' | 'notifications' | 'admin';

export const ProfileMenu: React.FC = () => {
  const t = useT();
  const { user, profile, setActiveView, logout, activeView, activeProject, isGuest } = useApp();
  const { unreadMessages, unreadNotifications } = useLive();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const name = profile?.display_name || (user?.email ? user.email.split('@')[0] : t('Guest'));
  const initial = name.trim().charAt(0).toUpperCase() || 'G';
  const isAdmin = user?.email === 'aruhaadmin@novelist.com';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const go = (view: MenuView) => {
    setOpen(false);
    setActiveView(view);
  };

  return (
    <div ref={wrapperRef} className="header-menu-wrap">
      <button
        type="button"
        className="avatar-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Open profile menu')}
      >
        {initial}
      </button>

      {open && (
        <div className="menu-pop" role="menu" style={{ maxHeight: 'calc(100dvh - 90px)', overflowY: 'auto' }}>
          <div className="menu-pop-head">
            <strong>{name}</strong>
            <small>{t('Account settings')}</small>
          </div>
          <button role="menuitem" type="button" onClick={() => go('profile')}>
            <User /> {t('Account')}
          </button>
          <button role="menuitem" type="button" onClick={() => go('preferences')}>
            <Settings /> {t('Preferences')}
          </button>
          <hr />
          <a role="menuitem" href={WINDOWS_URL} onClick={() => setOpen(false)}>
            <Download /> {t('Get the Windows app')}
          </a>
          <a role="menuitem" href={ANDROID_URL} onClick={() => setOpen(false)}>
            <Download /> {t('Get the Android app')}
          </a>
          <hr />
          <button role="menuitem" type="button" onClick={() => go('tracker')}>
            <BarChart2 /> {t('Progress tracker')}
          </button>
          {!isGuest && (
            <button role="menuitem" type="button" onClick={() => go('notifications')}>
              <Bell /> {t('Notifications')}
              {unreadNotifications > 0 && <span className="nav-count">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => go('messages')}>
            <MessageSquare /> {t('Messages')}
            {unreadMessages > 0 && <span className="nav-count">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
          </button>
          {isAdmin && (
            <button role="menuitem" type="button" onClick={() => go('admin')}>
              <Shield /> {t('Admin dashboard')}
            </button>
          )}
          <hr />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              // Inside a project the useful tour is the workspace one
              startTour(activeView === 'editor' && activeProject ? 'workspace' : 'welcome');
            }}
          >
            <Compass /> {t('Take the tour')}
          </button>
          <a role="menuitem" href={SUPPORT_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <LifeBuoy /> {t('Support')}
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut /> {t('Log out')}
          </button>
        </div>
      )}
    </div>
  );
};
