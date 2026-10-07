import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { indexChapters } from '../../lib/notes';
import { NOTE_HANDOFF_KEY } from '../../lib/uiEvents';
import { useOpenChapter } from '../../lib/useOpenChapter';
import { Dialog } from '../ui/Dialog';
import { EntityDetails } from './EntityDetails';

interface EntityPeekProps {
  entityId: string | null;
  onChange: (entityId: string | null) => void;
}

/** A quick look at a character, place or note without leaving the page you are writing on. */
export const EntityPeek: React.FC<EntityPeekProps> = ({ entityId, onChange }) => {
  const { entities, chapters } = useApp();
  const navigate = useNavigate();
  const openChapter = useOpenChapter();
  const index = useMemo(() => indexChapters(chapters), [chapters]);
  const entity = entities.find((e) => e.id === entityId) || null;

  return (
    <Dialog open={!!entity} onClose={() => onChange(null)} labelledBy="peek-h" className="dialog-wide">
      {entity && (
        <div className="peek">
          <h2 id="peek-h" className="sr-only">{entity.name}</h2>
          <EntityDetails
            entity={entity}
            entities={entities}
            chapters={index}
            onSelectEntity={(e) => onChange(e.id)}
            onOpenChapter={(chapterId, term) => {
              const chapter = chapters.find((c) => c.id === chapterId);
              onChange(null);
              if (chapter) openChapter(chapter, term);
            }}
          />
          <div className="dialog-actions">
            <button
              className="button button-outline button-small"
              onClick={() => {
                try {
                  sessionStorage.setItem(NOTE_HANDOFF_KEY, entity.id);
                } catch {
                  // the notebook still opens
                }
                onChange(null);
                navigate('/notebook');
              }}
            >
              Open in notebook
            </button>
            <button className="button button-primary button-small" onClick={() => onChange(null)}>Close</button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
