// What the app inside the window may ask of the desktop app. Nothing else of the computer is reachable from it.
// (A plain CommonJS file, so a sandboxed window can load it.)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novelistDesktop', {
  isDesktop: true,
  /** The version of the app that is running */
  version: () => ipcRenderer.invoke('desktop:version'),
  /** { status: 'unavailable' | 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'error', version?, percent?, message? } */
  getUpdateState: () => ipcRenderer.invoke('desktop:update-state'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates'),
  /** Close the app and put the downloaded version in its place (only does anything once one is ready) */
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  /** Called each time the update state changes. Returns a function that stops listening. */
  onUpdate: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('update:state-changed', handler);
    return () => ipcRenderer.removeListener('update:state-changed', handler);
  },
});
