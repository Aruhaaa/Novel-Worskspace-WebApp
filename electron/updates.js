/**
 * Keeping the desktop app up to date. It asks GitHub (where the installer is published, see "publish" in package.json)
 * whether there is a newer version, downloads it quietly, and installs it the next time the app is closed, or at
 * once if the person chooses "Restart now". A failed check (no connection, no release yet) is never shown as a
 * problem: the app just carries on, and the Preferences screen can say what happened if asked.
 *
 * This file knows nothing about Electron itself: the updater, and the way to tell the window, are handed in. That is
 * what lets scripts/tests/updates.test.mjs run it against a pretend updater.
 */

/** The message the window listens for */
export const UPDATE_EVENT = 'update:state-changed';

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** The first line of an error, short, and without any address on this computer */
const plain = (error) =>
  String((error && error.message) || error || 'Unknown error')
    .split('\n')[0]
    .replace(/(?:file:\/\/\/?|[A-Za-z]:[\\/])[^\s)'"]*[\\/]/g, '')
    .slice(0, 160);

export const createUpdater = ({ autoUpdater, packaged, version, send = () => {} }) => {
  // unavailable: not an installed copy (running from source), so there is nothing to update
  let state = { status: packaged ? 'idle' : 'unavailable' };

  const set = (next) => {
    state = next;
    send(state);
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => set({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => set({ status: 'downloading', version: info && info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => set({ status: 'current', checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (progress) =>
    set({ status: 'downloading', version: state.version, percent: Math.max(0, Math.min(100, Math.round((progress && progress.percent) || 0))) })
  );
  autoUpdater.on('update-downloaded', (info) => set({ status: 'ready', version: (info && info.version) || state.version }));
  autoUpdater.on('error', (error) => set({ status: 'error', message: plain(error) }));

  const busy = () => ['checking', 'downloading', 'ready'].includes(state.status);

  /** Look for a newer version now. Never throws. */
  const check = async () => {
    if (!packaged || busy()) return state;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      if (state.status !== 'error') set({ status: 'error', message: plain(error) });
    }
    return state;
  };

  /** Close the app and put the downloaded version in its place, then open it again */
  const install = () => {
    if (state.status !== 'ready') return false;
    autoUpdater.quitAndInstall(false, true);
    return true;
  };

  /** Check shortly after the app opens and then every few hours. Returns a function that stops checking. */
  const start = ({ firstAfterMs = 10_000, everyMs = SIX_HOURS } = {}) => {
    if (!packaged) return () => {};
    const first = setTimeout(() => void check(), firstAfterMs);
    const again = setInterval(() => void check(), everyMs);
    // Waiting for the next check must never be what keeps the app open
    first.unref?.();
    again.unref?.();
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  };

  return { check, install, start, getState: () => state, getVersion: () => version };
};
