import { contextBridge } from 'electron';

// Expose safe APIs to the React app if needed later
contextBridge.exposeInMainWorld('electronAPI', {
  // Examples for future usage:
  // ping: () => ipcRenderer.invoke('ping'),
});
