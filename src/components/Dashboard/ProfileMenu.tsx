import React, { useEffect, useRef, useState } from 'react';
import { User, Settings, LifeBuoy, LogOut, Download, BarChart2, MessageSquare, Shield, Compass } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { startTour } from '../../lib/tour';

const SUPPORT_URL = 'https://github.com/Aruhaaa/Novel-Worskspace-WebApp/issues';
const WINDOWS_URL = 'https://github.com/Aruhaaa/Novel-Worskspace-WebApp/releases/download/v1.0.0/Novelist.Workspace.Setup.0.0.0.exe';
const ANDROID_URL = 'https://github.com/Aruhaaa/Novel-Worskspace-WebApp/releases/download/v1.0.0-android/app-debug.apk';

type MenuView = 'profile' | 'preferences' | 'tracker' | 'messages' | 'admin';

export const ProfileMenu: React.FC = () => {
  const { user, profile, setActiveView, logout, activeView, activeProject } = useApp();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const name = profile?.display_name || (user?.email ? user.email.split('@')[0] : 'Guest');
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
        aria-label="Open profile menu"
      >
        {initial}
      </button>

      {open && (
        <div className="menu-pop" role="menu" style={{ maxHeight: 'calc(100dvh - 90px)', overflowY: 'auto' }}>
          <div className="menu-pop-head">
            <strong>{name}</strong>
            <small>Account settings</small>
          </div>
          <button role="menuitem" type="button" onClick={() => go('profile')}>
            <User /> Account
          </button>
          <button role="menuitem" type="button" onClick={() => go('preferences')}>
            <Settings /> Preferences
          </button>
          <hr />
          <a role="menuitem" href={WINDOWS_URL} onClick={() => setOpen(false)}>
            <Download /> Get the Windows app
          </a>
          <a role="menuitem" href={ANDROID_URL} onClick={() => setOpen(false)}>
            <Download /> Get the Android app
          </a>
          <hr />
          <button role="menuitem" type="button" onClick={() => go('tracker')}>
            <BarChart2 /> Progress tracker
          </button>
          <button role="menuitem" type="button" onClick={() => go('messages')}>
            <MessageSquare /> Messages
          </button>
          {isAdmin && (
            <button role="menuitem" type="button" onClick={() => go('admin')}>
              <Shield /> Admin dashboard
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
            <Compass /> Take the tour
          </button>
          <a role="menuitem" href={SUPPORT_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <LifeBuoy /> Support
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut /> Log out
          </button>
        </div>
      )}
    </div>
  );
};
