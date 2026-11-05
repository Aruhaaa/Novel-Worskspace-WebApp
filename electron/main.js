import { app, BrowserWindow, ipcMain } from 'electron';
import electronUpdater from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUpdater, UPDATE_EVENT } from './updates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the app quits correctly if single instance is locked
const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      // A plain (CommonJS) file: a window that is sandboxed, as this one is, cannot load a preload written as a module
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow local media to load easily
    },
  });

  // Hides the default menu bar
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // In development mode, load the Vite dev server (another address can be given, for example by the tests)
    mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173');
    if (!process.env.ELECTRON_NO_DEVTOOLS) mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  return mainWindow;
}

// Updates come from the releases of the GitHub repository named under "publish" in package.json
const updater = createUpdater({
  autoUpdater: electronUpdater.autoUpdater,
  packaged: app.isPackaged,
  version: app.getVersion(),
  send: (state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(UPDATE_EVENT, state);
    }
  },
});

ipcMain.handle('desktop:version', () => updater.getVersion());
ipcMain.handle('desktop:update-state', () => updater.getState());
ipcMain.handle('desktop:check-for-updates', () => updater.check());
ipcMain.handle('desktop:install-update', () => updater.install());

app.whenReady().then(() => {
  createWindow();
  updater.start();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
