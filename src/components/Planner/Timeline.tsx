import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { STATUS_LABEL, metaFor } from '../../lib/chapterMeta';
import { indexChapters, mentionCount, sceneChapterId, sceneWhen } from '../../lib/notes';
import { countWords } from '../../lib/text';
import { useOpenChapter } from '../../lib/useOpenChapter';

const BOARD_LABEL: Record<string, string> = { idea: 'Idea', todo: 'To do', drafting: 'Drafting', finished: 'Finished' };

const byBoardOrder = (a: WikiEntity, b: WikiEntity) => parseInt(a.content.order || '0', 10) - parseInt(b.content.order || '0', 10);

/** The story laid out in reading order: each chapter with its scenes and the characters who appear in it. */
export const Timeline: React.FC<{ onEditScene: (scene: WikiEntity) => void }> = ({ onEditScene }) => {
  const { chapters, entities, chapterMeta } = useApp();
  const openChapter = useOpenChapter();
  const index = useMemo(() => indexChapters(chapters), [chapters]);

  const scenes = entities.filter((e) => e.type === 'scene');
  const characters = entities.filter((e) => e.type === 'character');
  const chapterIds = new Set(chapters.map((c) => c.id));
  const unplaced = scenes.filter((s) => !sceneChapterId(s) || !chapterIds.has(sceneChapterId(s)!)).sort(byBoardOrder);

  const sceneCard = (scene: WikiEntity) => (
    <button key={scene.id} className="tl-scene" onClick={() => onEditScene(scene)} aria-label={`Edit scene ${scene.name}`}>
      {sceneWhen(scene) && <span className="tl-when">{sceneWhen(scene)}</span>}
      <strong>{scene.name}</strong>
      <small>{BOARD_LABEL[scene.content.status || 'idea'] || 'Idea'}</small>
    </button>
  );

  if (chapters.length === 0 && scenes.length === 0) {
    return <p className="meta">Add chapters and link scenes to them, and the story lays itself out here in reading order.</p>;
  }

  return (
    <div>
      <p className="section-note">
        Chapters in reading order, with the scenes you linked to each and the characters named in it. Link a scene to a chapter from its Edit dialog, or from the chapter's margin.
      </p>
      <div className="timeline" role="list">
        {index.map((item) => {
          const here = scenes.filter((s) => sceneChapterId(s) === item.chapter.id).sort(byBoardOrder);
          const cast = characters.filter((ch) => mentionCount(item.html, item.text, ch) > 0);
          const words = countWords(item.chapter.content);
          return (
            <section className="tl-col" role="listitem" key={item.chapter.id} aria-label={`Chapter ${item.index + 1}`}>
              <button className="tl-head" onClick={() => openChapter(item.chapter)}>
                <span className="num">CHAPTER {String(item.index + 1).padStart(2, '0')}</span>
                <strong>{item.chapter.title || 'Untitled chapter'}</strong>
                <small>
                  {words > 0 ? `${words.toLocaleString()} words` : 'Not started'} · {STATUS_LABEL[metaFor(chapterMeta, item.chapter.id).status]}
                </small>
              </button>
              <div className="tl-body">
                {here.length === 0 ? <p className="meta">No scenes linked.</p> : here.map(sceneCard)}
              </div>
              <div className="tl-cast" aria-label="Characters in this chapter">
                {cast.length === 0 ? (
                  <small>No characters named yet</small>
                ) : (
                  cast.map((ch) => (
                    <span className="badge" key={ch.id}>{ch.name}</span>
                  ))
                )}
              </div>
            </section>
          );
        })}
        <section className="tl-col is-loose" role="listitem" aria-label="Scenes not yet in a chapter">
          <div className="tl-head is-static">
            <span className="num">NOT PLACED</span>
            <strong>Not in a chapter yet</strong>
            <small>{unplaced.length} {unplaced.length === 1 ? 'scene' : 'scenes'}</small>
          </div>
          <div className="tl-body">
            {unplaced.length === 0 ? <p className="meta">Every scene has a home.</p> : unplaced.map(sceneCard)}
          </div>
        </section>
      </div>
    </div>
  );
};
