import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { sceneChapterId, sceneWhen, withSceneLinks } from '../../lib/notes';
import { Dialog } from '../ui/Dialog';
import { MarginsRail, RailBlock, RailRow } from '../ui/MarginsRail';
import { Storyboard } from './Storyboard';
import { Timeline } from './Timeline';

type Mode = 'board' | 'timeline';

export const OutlineView: React.FC = () => {
  const { updateEntity, entities, chapters } = useApp();
  const scenes = entities.filter((e) => e.type === 'scene');
  const sceneCount = scenes.length;
  const inColumn = (id: string) => scenes.filter((sc) => (sc.content.status || 'idea') === id).length;
  const chapterIds = new Set(chapters.map((c) => c.id));
  const placed = scenes.filter((sc) => {
    const id = sceneChapterId(sc);
    return !!id && chapterIds.has(id);
  }).length;

  const [mode, setMode] = useState<Mode>('board');
  const [editing, setEditing] = useState<WikiEntity | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [when, setWhen] = useState('');

  const openEdit = (scene: WikiEntity) => {
    setEditing(scene);
    setName(scene.name);
    setDesc(scene.description || '');
    const linked = sceneChapterId(scene);
    setChapterId(linked && chapterIds.has(linked) ? linked : '');
    setWhen(sceneWhen(scene));
  };

  return (
    <>
    <div className="studio-toolbar">
      <h1>
        Story outline <span>/ {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}</span>
      </h1>
    </div>
    <div className="studio-view">
      <div className="page page-wide" style={{ paddingTop: 28 }}>
        <div className="world-filter" role="group" aria-label="How to view the outline">
          <button aria-pressed={mode === 'board'} onClick={() => setMode('board')}>Board</button>
          <button aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')}>Timeline</button>
        </div>
        {mode === 'board' ? <Storyboard onEditEntity={openEdit} /> : <Timeline onEditScene={openEdit} />}
      </div>

      <MarginsRail
        thought={
          <>
            Let the middle
            <br />
            be a little messy.
          </>
        }
      >
        <RailBlock title="This outline">
          <p>
            {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'} across four stages.
          </p>
        </RailBlock>
        <RailBlock title="On the board">
          <RailRow label="Ideas" value={inColumn('idea')} />
          <RailRow label="To do" value={inColumn('todo')} />
          <RailRow label="Drafting" value={inColumn('drafting')} />
          <RailRow label="Finished" value={inColumn('finished')} />
        </RailBlock>
        <RailBlock title="In the manuscript">
          <RailRow label="Placed in a chapter" value={placed} />
          <RailRow label="Not placed yet" value={sceneCount - placed} />
        </RailBlock>
      </MarginsRail>

      <Dialog open={!!editing} onClose={() => setEditing(null)} labelledBy="es-h">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing || !name.trim()) return;
            await updateEntity(editing.id, {
              name: name.trim(),
              description: desc.trim(),
              content: withSceneLinks(editing, chapterId, when),
            });
            setEditing(null);
          }}
        >
          <p className="eyebrow">STORY OUTLINE</p>
          <h2 id="es-h">Edit scene</h2>
          <label htmlFor="es-name">Scene name</label>
          <input id="es-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <label htmlFor="es-desc">Description</label>
          <input id="es-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What happens in this scene?" />
          <label htmlFor="es-chapter">Chapter</label>
          <select id="es-chapter" className="select" style={{ marginTop: 8 }} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">Not in a chapter yet</option>
            {chapters.map((c, i) => (
              <option key={c.id} value={c.id}>
                {String(i + 1).padStart(2, '0')} · {c.title || 'Untitled chapter'}
              </option>
            ))}
          </select>
          <label htmlFor="es-when">When it happens (optional)</label>
          <input id="es-when" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Day 3, dusk · Spring 1942" />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setEditing(null)}>Cancel</button>
            <button className="button button-primary button-small">Save scene</button>
          </div>
        </form>
      </Dialog>
    </div>
    </>
  );
};
