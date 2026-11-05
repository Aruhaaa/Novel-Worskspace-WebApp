import React, { useMemo, useSyncExternalStore } from 'react';
import type { LiveSession, LiveUser } from '../../lib/liveEditing';
import { useT } from '../../i18n';

/** Who else has this chapter open right now, and whether what you write is reaching them. */
export const PresenceBar: React.FC<{ session: LiveSession }> = ({ session }) => {
  const t = useT();
  const { awareness } = session;

  // The list of people is read as one piece of text, so it only counts as changed when somebody really arrives or leaves
  const peopleText = useSyncExternalStore(
    (notify) => {
      awareness.on('change', notify);
      return () => awareness.off('change', notify);
    },
    () =>
      JSON.stringify(
        [...awareness.getStates().entries()]
          .filter(([clientId]) => clientId !== awareness.clientID)
          .map(([, state]) => state.user as LiveUser | undefined)
          .filter((u): u is LiveUser => !!u && typeof u.name === 'string')
      )
  );
  const people = useMemo(() => JSON.parse(peopleText) as LiveUser[], [peopleText]);
  const status = useSyncExternalStore(session.onStatus, session.getStatus);

  return (
    <div className="presence-bar" role="status" aria-live="polite">
      <span className={`live-dot is-${status}`} aria-hidden="true" />
      {status === 'offline' ? (
        <span>{t('Not connected to the others. Your changes still save as usual.')}</span>
      ) : people.length === 0 ? (
        <span>{t('Writing together: nobody else is here yet.')}</span>
      ) : (
        <>
          <span>{t('Here with you:')}</span>
          {people.map((person, i) => (
            <span className="presence-dot" key={`${person.name}-${i}`}>
              <i style={{ background: person.color }} aria-hidden="true" />
              {person.name}
            </span>
          ))}
        </>
      )}
    </div>
  );
};
