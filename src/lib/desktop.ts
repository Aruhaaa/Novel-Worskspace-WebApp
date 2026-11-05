import { useCallback, useEffect, useState } from 'react';

/**
 * The desktop app (Electron) gives the page a small bridge, window.novelistDesktop, defined in electron/preload.cjs.
 * In a browser or on the phone it does not exist, and everything here quietly does nothing.
 */
export type UpdateStatus = 'unavailable' | 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  /** The new version, once there is one */
  version?: string;
  percent?: number;
  message?: string;
  checkedAt?: string;
}

interface DesktopBridge {
  isDesktop: true;
  version: () => Promise<string>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  installUpdate: () => Promise<boolean>;
  onUpdate: (listener: (state: UpdateState) => void) => () => void;
}

export const desktopBridge = (): DesktopBridge | null => {
  const bridge = (window as unknown as { novelistDesktop?: DesktopBridge }).novelistDesktop;
  return bridge?.isDesktop ? bridge : null;
};

export interface DesktopUpdates {
  /** False in a browser and on the phone */
  isDesktop: boolean;
  /** The version of the app that is running */
  version: string;
  state: UpdateState;
  check: () => Promise<void>;
  install: () => Promise<void>;
}

const NOTHING: UpdateState = { status: 'unavailable' };

/** Follow the desktop app's updates. Only the installed app has any; a copy run from source reports "unavailable". */
export const useDesktopUpdates = (): DesktopUpdates => {
  const bridge = desktopBridge();
  const [state, setState] = useState<UpdateState>(NOTHING);
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    void bridge.getUpdateState().then((s) => live && setState(s));
    void bridge.version().then((v) => live && setVersion(v));
    const off = bridge.onUpdate((s) => live && setState(s));
    return () => {
      live = false;
      off();
    };
  }, [bridge]);

  const check = useCallback(async () => {
    if (bridge) setState(await bridge.checkForUpdates());
  }, [bridge]);

  const install = useCallback(async () => {
    await bridge?.installUpdate();
  }, [bridge]);

  return { isDesktop: !!bridge, version, state, check, install };
};
