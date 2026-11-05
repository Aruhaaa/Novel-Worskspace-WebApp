import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { sceneChapterId, sceneWhen, withSceneLinks } from '../../lib/notes';
import { Dialog } from '../ui/Dialog';
import { MarginsRail, RailBlock, RailRow } from '../ui/MarginsRail';
import { Storyboard } from './Storyboard';
import { Timeline } from './Timeline';
import { RoleBanner } from '../Collab/RoleBanner';
import { can } from '../../lib/collab';
import { tp, useT } from '../../i18n';

type Mode = 'board' | 'timeline';

export const OutlineView: React.FC = () => {
  const t = useT();
  const { updateEntity, entities, chapters, projectRole } = useApp();
  const structure = can.editStructure(projectRole);
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
    // Only the owner and co-authors change the outline
    if (!structure) return;
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
        {t('Story outline')} <span>/ {tp(sceneCount, '{n} scene', '{n} scenes')}</span>
      </h1>
    </div>
    <div className="studio-view">
      <div className="page page-wide" style={{ paddingTop: 28 }}>
        <RoleBanner />
        <div className="world-filter" role="group" aria-label={t('How to view the outline')}>
          <button aria-pressed={mode === 'board'} onClick={() => setMode('board')}>{t('Board')}</button>
          <button aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')}>{t('Timeline')}</button>
        </div>
        {mode === 'board' ? <Storyboard onEditEntity={openEdit} /> : <Timeline onEditScene={openEdit} />}
      </div>

      <MarginsRail
        thought={
          <>
            {t('Let the middle')}
            <br />
            {t('be a little messy.')}
          </>
        }
      >
        <RailBlock title={t('This outline')}>
          <p>
            {t('{scenes} across four stages.', { scenes: tp(sceneCount, '{n} scene', '{n} scenes') })}
          </p>
        </RailBlock>
        <RailBlock title={t('On the board')}>
          <RailRow label={t('Ideas')} value={inColumn('idea')} />
          <RailRow label={t('To do')} value={inColumn('todo')} />
          <RailRow label={t('Drafting')} value={inColumn('drafting')} />
          <RailRow label={t('Finished')} value={inColumn('finished')} />
        </RailBlock>
        <RailBlock title={t('In the manuscript')}>
          <RailRow label={t('Placed in a chapter')} value={placed} />
          <RailRow label={t('Not placed yet')} value={sceneCount - placed} />
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
          <p className="eyebrow">{t('STORY OUTLINE')}</p>
          <h2 id="es-h">{t('Edit scene')}</h2>
          <label htmlFor="es-name">{t('Scene name')}</label>
          <input id="es-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <label htmlFor="es-desc">{t('Description')}</label>
          <input id="es-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('What happens in this scene?')} />
          <label htmlFor="es-chapter">{t('Chapter')}</label>
          <select id="es-chapter" className="select" style={{ marginTop: 8 }} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">{t('Not in a chapter yet')}</option>
            {chapters.map((c, i) => (
              <option key={c.id} value={c.id}>
                {String(i + 1).padStart(2, '0')} · {c.title || t('Untitled chapter')}
              </option>
            ))}
          </select>
          <label htmlFor="es-when">{t('When it happens (optional)')}</label>
          <input id="es-when" value={when} onChange={(e) => setWhen(e.target.value)} placeholder={t('Day 3, dusk · Spring 1942')} />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setEditing(null)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Save scene')}</button>
          </div>
        </form>
      </Dialog>
    </div>
    </>
  );
};
