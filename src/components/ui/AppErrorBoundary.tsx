import React from 'react';
import { reportError } from '../../lib/errorReporter';
import { t } from '../../i18n';

interface Props {
  children: React.ReactNode;
  /** When this changes (for example the address), a screen that broke gets another try */
  resetKey?: string;
  /** Called with whatever broke, as well as it being reported (unless the person switched reports off) */
  onError?: (error: unknown, info: { componentStack?: string | null }) => void;
}

interface State {
  error: unknown;
}

/** A screen that failed to load (usually a lost connection) or to draw. Words already saved are untouched. */
const isLoadFailure = (error: unknown): boolean => {
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|Unable to preload/i.test(message);
};

/**
 * Catches an error in the screen below it, so one broken screen does not leave a blank page.
 * Writing is saved as it is typed, and a copy is kept on the device, so nothing is lost by reloading.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    reportError(error, { where: 'screen', components: info.componentStack });
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error !== null && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error === null) return this.props.children;
    const loadFailure = isLoadFailure(this.state.error);
    return (
      <div className="studio-view">
        <div className="page" role="alert">
          <div className="empty">
            <h3>{loadFailure ? t('This part of the app could not be loaded') : t('Something went wrong on this screen')}</h3>
            <p>
              {loadFailure
                ? t('Check your connection and try again. Anything you wrote is already kept on this device.')
                : t('Anything you wrote is already kept. Reloading usually fixes it.')}
            </p>
            <button className="small-btn is-primary" onClick={() => window.location.reload()}>
              {t('Reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
