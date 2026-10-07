import React, { useMemo } from 'react';
import type { WikiEntity } from '../../services/types';
import { appearances, getLinks, getTags, incomingLinks, typedAttributes, TYPE_LABEL, type ChapterText } from '../../lib/notes';

interface EntityDetailsProps {
  entity: WikiEntity;
  entities: WikiEntity[];
  chapters: ChapterText[];
  onSelectEntity: (entity: WikiEntity) => void;
  onOpenChapter: (chapterId: string, term: string) => void;
}

/** Everything about one notebook entry: its picture, summary, tags, connections and where it appears. */
export const EntityDetails: React.FC<EntityDetailsProps> = ({ entity, entities, chapters, onSelectEntity, onOpenChapter }) => {
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const attrs = typedAttributes(entity);
  const tags = getTags(entity);
  const outgoing = getLinks(entity).flatMap((l) => {
    const target = byId.get(l.to);
    return target ? [{ target, label: l.label, incoming: false }] : [];
  });
  const incoming = incomingLinks(entity, entities).map((l) => ({ target: l.from, label: l.label, incoming: true }));
  const connections = [...outgoing, ...incoming];
  const where = useMemo(() => appearances(entity, chapters), [entity, chapters]);

  return (
    <>
      {entity.image_url && <img className="entity-image" src={entity.image_url} alt={`Picture of ${entity.name}`} />}
      <span className="eyebrow">{TYPE_LABEL[entity.type].toUpperCase()}</span>
      <h3>{entity.name}</h3>
      <p style={{ marginTop: 8 }}>{entity.description || 'No description provided.'}</p>

      {tags.length > 0 && (
        <div className="chips" style={{ marginTop: 14 }} aria-label="Tags">
          {tags.map((t) => (
            <span className="badge" key={t}>#{t}</span>
          ))}
        </div>
      )}

      {attrs.length > 0 && (
        <dl>
          {attrs.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k.toUpperCase()}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {connections.length > 0 && (
        <section className="detail-section" aria-label="Connections">
          <h4 className="eyebrow">CONNECTIONS</h4>
          {connections.map((c, i) => (
            <button key={`${c.target.id}-${i}`} className="detail-link" onClick={() => onSelectEntity(c.target)}>
              <span>{c.target.name}</span>
              <small title={c.incoming ? `${c.target.name} ${c.label || 'is linked to'} ${entity.name}` : `${entity.name} ${c.label || 'is linked to'} ${c.target.name}`}>
                {c.incoming ? '← ' : '→ '}
                {c.label || 'linked'}
              </small>
            </button>
          ))}
        </section>
      )}

      <section className="detail-section" aria-label="Appears in">
        <h4 className="eyebrow">APPEARS IN</h4>
        {where.length === 0 ? (
          <p className="meta">Not named in any chapter yet.</p>
        ) : (
          where.map((a) => (
            <button key={a.chapter.id} className="detail-link" onClick={() => onOpenChapter(a.chapter.id, entity.name)}>
              <span>
                {String(a.index + 1).padStart(2, '0')} · {a.chapter.title || 'Untitled chapter'}
              </span>
              <small>{a.count === 1 ? 'once' : `${a.count} times`}</small>
            </button>
          ))
        )}
      </section>
    </>
  );
};
