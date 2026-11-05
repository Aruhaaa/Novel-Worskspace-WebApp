import React, { useCallback, useEffect, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import { countWords, readMinutes, htmlToText } from '../../lib/text';
import { listBin, removeFromBin, type DeletedChapter } from '../../lib/bin';
import { metaFor, STATUS_LABEL, STATUS_ORDER, type ChapterStatus } from '../../lib/chapterMeta';
import { planGoal } from '../../lib/projectGoal';
import { sceneChapterId } from '../../lib/notes';
import { MarginsRail, RailBlock, RailRow } from '../ui/MarginsRail';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';
import { ExportDialog } from '../Export/ExportDialogLazy';
import { FeedbackDialog } from '../Feedback/FeedbackDialog';
import { ImportDialog } from '../Import/ImportDialogLazy';
import { RoleBanner } from '../Collab/RoleBanner';
import { can } from '../../lib/collab';
import { useFeedback } from '../../lib/feedback';
import { fmtDate, tp, useT } from '../../i18n';

export const ChapterIndexView: React.FC = () => {
  const t = useT();
  const {
    activeProject,
    chapters,
    chapterMeta,
    entities,
    projectGoal,
    setActiveChapter,
    createChapter,
    deleteChapter,
    restoreDeletedChapter,
    reorderChapters,
    updateChapterMeta,
    projectRole,
  } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [bin, setBin] = useState<DeletedChapter[]>([]);
  const [showExport, setShowExport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const feedback = useFeedback(activeProject?.id);
  const openNotes = feedback.filter((f) => f.status === 'open');
  const noteTotals = new Map<string, number>();
  for (const f of openNotes) noteTotals.set(f.chapterId, (noteTotals.get(f.chapterId) || 0) + 1);
  const [moveError, setMoveError] = useState(false);

  const projectId = activeProject?.id;
  const loadBin = useCallback(async () => {
    if (projectId) setBin(await listBin(projectId));
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    if (projectId) {
      listBin(projectId).then((items) => {
        if (alive) setBin(items);
      });
    }
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!activeProject) return null;

  // Adding, removing and reordering chapters is for the owner and co-authors
  const structure = can.editStructure(projectRole);

  const totalWords = chapters.reduce((sum, c) => sum + countWords(c.content), 0);
  const plan = projectGoal ? planGoal(projectGoal, totalWords) : null;
  const sceneTotals = new Map<string, number>();
  for (const e of entities) {
    const id = e.type === 'scene' ? sceneChapterId(e) : undefined;
    if (id) sceneTotals.set(id, (sceneTotals.get(id) || 0) + 1);
  }
  const doneCount = chapters.filter((c) => metaFor(chapterMeta, c.id).status === 'done').length;

  // Deleting is immediate and can be undone from the message that appears; the chapter also waits in Recently deleted
  const removeChapter = async (chapterId: string) => {
    const chap = chapters.find((c) => c.id === chapterId);
    if (!chap) return;
    const { title: chapterTitle, content, position } = chap;
    const meta = chapterMeta[chapterId];
    const binId = await deleteChapter(chapterId);
    await loadBin();
    toast({
      message: t('Deleted “{title}”.', { title: chapterTitle || t('Untitled chapter') }),
      actionLabel: t('Undo'),
      onAction: async () => {
        await restoreDeletedChapter(chapterTitle, content, meta, position);
        if (binId !== undefined) await removeFromBin(binId);
        await loadBin();
      },
    });
  };

  const openChapter = (id: string) => {
    const chap = chapters.find((c) => c.id === id);
    if (chap) {
      setActiveChapter(chap);
      navigate('/editor');
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const ids = chapters.map((c) => c.id);
    const [moved] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, moved);
    setMoveError(false);
    try {
      await reorderChapters(ids);
    } catch {
      setMoveError(true);
    }
  };

  return (
    <>
    <div className="studio-toolbar">
      <h1>
        {t('Chapter index')} <span>/ {tp(chapters.length, '{n} chapter', '{n} chapters')}</span>
      </h1>
      <div className="toolbar-actions imp-toolbar">
        <button className="button button-outline button-small" onClick={() => setShowFeedback(true)}>
          {t('Reader feedback')}{openNotes.length > 0 ? ` (${openNotes.length})` : ''}
        </button>
        {structure && (
          <button className="button button-outline button-small" onClick={() => setShowImport(true)}>
            {t('Import chapters')}
          </button>
        )}
        <button className="button button-outline button-small" onClick={() => setShowExport(true)}>
          {t('Export')}
        </button>
        {structure && (
          <button className="button button-primary button-small" onClick={() => setShowNew(true)}>
            {t('Create new chapter')}
          </button>
        )}
      </div>
    </div>
    <div className="studio-view">
      <div className="page" style={{ paddingTop: 28 }}>
        <RoleBanner />
        {moveError && (
          <p className="mock-note" role="alert" style={{ marginBottom: 16 }}>
            Could not save the new order. It has been put back; check your connection and try again.
          </p>
        )}
        {structure && chapters.length > 1 && (
          <p className="section-note" style={{ marginBottom: 14 }}>
            {t('Drag a chapter by its handle to reorder. With the keyboard, focus the handle, press Space, move with the arrow keys, then Space again.')}
          </p>
        )}
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="chapters" direction="horizontal">
            {(drop) => (
              <div className="chapter-grid" ref={drop.innerRef} {...drop.droppableProps}>
                {chapters.map((chap, i) => {
                  const words = countWords(chap.content);
                  const meta = metaFor(chapterMeta, chap.id);
                  return (
                    <Draggable key={chap.id} draggableId={chap.id} index={i} isDragDisabled={!structure}>
                      {(drag, snap) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={`chapter-tile${words > 0 ? ' has-text' : ''}${snap.isDragging ? ' is-dragging' : ''}`}
                          style={{ position: 'relative', padding: 0, ...drag.draggableProps.style }}
                        >
                          <button
                            onClick={() => openChapter(chap.id)}
                            style={{ textAlign: 'left', padding: '22px 22px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}
                          >
                            <div>
                              <span className="num">{t('CHAPTER {n}', { n: String(i + 1).padStart(2, '0') })}</span>
                              <h3 style={{ paddingRight: 60 }}>{chap.title || t('Untitled chapter')}</h3>
                            </div>
                            {meta.synopsis && <p className="tile-synopsis">{meta.synopsis}</p>}
                            <span className="meta">
                              {words > 0 ? tp(words, '{n} word', '{n} words') : t('Not started')}
                              {noteTotals.get(chap.id) ? ` · ${tp(noteTotals.get(chap.id) ?? 0, '{n} reader note', '{n} reader notes')}` : ''}
                              {sceneTotals.get(chap.id) ? ` · ${tp(sceneTotals.get(chap.id) ?? 0, '{n} scene', '{n} scenes')}` : ''}
                            </span>
                          </button>
                          <div className="tile-foot">
                            <label className="sr-only" htmlFor={`st-${chap.id}`}>{t('Status of {title}', { title: chap.title || t('untitled chapter') })}</label>
                            <select
                              id={`st-${chap.id}`}
                              className={`tile-status is-${meta.status}`}
                              value={meta.status}
                              onChange={(e) => updateChapterMeta(chap.id, { status: e.target.value as ChapterStatus })}
                            >
                              {STATUS_ORDER.map((s) => (
                                <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>
                              ))}
                            </select>
                          </div>
                          {structure && (
                          <div className="tile-tools">
                            <span
                              {...drag.dragHandleProps}
                              className="icon-button"
                              aria-label={t('Reorder {title}', { title: chap.title || t('untitled chapter') })}
                              title={t('Drag to reorder')}
                              style={{ color: 'var(--muted)', cursor: 'grab' }}
                            >
                              <GripVertical />
                            </span>
                            <button
                              className="icon-button"
                              aria-label={t('Delete {title}', { title: chap.title || t('untitled chapter') })}
                              title={t('Delete chapter')}
                              onClick={() => removeChapter(chap.id)}
                              style={{ color: 'var(--muted)' }}
                            >
                              <Trash2 />
                            </button>
                          </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {drop.placeholder}
                {structure && (
                <button className="chapter-tile" onClick={() => setShowNew(true)} style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  <Plus style={{ width: 24, height: 24 }} />
                  {t('New chapter')}
                </button>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {structure && bin.length > 0 && (
          <section aria-labelledby="bin-h" style={{ marginTop: 44 }}>
            <h2 className="section-title" id="bin-h">{t('Recently deleted')}</h2>
            <p className="section-note">{t('Kept on this device so a mistake is never final. Restore a chapter to put it back where it was.')}</p>
            {bin.map((item) => {
              const words = countWords(item.content);
              return (
                <div className="read-row" key={item.id} style={{ alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{item.title || t('Untitled chapter')}</strong>
                    <small>
                      {t('Deleted {date}', { date: fmtDate(item.deletedAt) })} · {tp(words, '{n} word', '{n} words')}
                      {words > 0 && ` · “${htmlToText(item.content).slice(0, 50)}…”`}
                    </small>
                  </div>
                  <button
                    className="small-btn"
                    onClick={async () => {
                      await restoreDeletedChapter(item.title, item.content, item.meta, item.position);
                      if (item.id !== undefined) await removeFromBin(item.id);
                      await loadBin();
                    }}
                  >
                    {t('Restore')}
                  </button>
                  <button
                    className="small-btn is-danger"
                    onClick={async () => {
                      if (item.id !== undefined) await removeFromBin(item.id);
                      await loadBin();
                    }}
                  >
                    {t('Delete forever')}
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <MarginsRail>
        <RailBlock title={t('This manuscript')}>
          <p>
            {tp(totalWords, '{n} word', '{n} words')} · {readMinutes(totalWords)}
          </p>
        </RailBlock>
        <RailBlock title={t('Chapters')}>
          <RailRow label={t('Total')} value={chapters.length} />
          <RailRow label={t('Done')} value={doneCount} />
          <RailRow label={t('Still to finish')} value={chapters.length - doneCount} />
        </RailBlock>
        <RailBlock title={t('Your target')}>
          {plan && projectGoal ? (
            <>
              <progress max={plan.target} value={Math.min(plan.written, plan.target)} aria-label={t('Progress toward the manuscript target')} style={{ width: '100%' }} />
              <p style={{ marginTop: 8 }}>
                {t('{written} of {target} words ({percent}%)', { written: plan.written.toLocaleString(), target: plan.target.toLocaleString(), percent: plan.percent })}
                {plan.state === 'on-track' && plan.perDay !== null && ` · ${t('about {perDay} a day for {days}', { perDay: plan.perDay.toLocaleString(), days: tp(plan.daysLeft ?? 0, '{n} day', '{n} days') })}`}
                {plan.state === 'overdue' && ` · ${t('the deadline has passed')}`}
                {plan.state === 'reached' && ` · ${t('reached')}`}
              </p>
            </>
          ) : (
            <p>
              {t('Set a length and a finish date on the')} <a className="link-accent" href="#/tracker">{t('Progress')}</a> {t('page and it shows here.')}
            </p>
          )}
        </RailBlock>
      </MarginsRail>

      <ExportDialog project={showExport ? activeProject : null} onClose={() => setShowExport(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} target="append" />
      <FeedbackDialog project={showFeedback ? activeProject : null} onClose={() => setShowFeedback(false)} />

      <Dialog open={showNew} onClose={() => setShowNew(false)} labelledBy="ci-h">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await createChapter(title.trim());
            setTitle('');
            setShowNew(false);
          }}
        >
          <p className="eyebrow">{t('A FRESH PAGE')}</p>
          <h2 id="ci-h">{t('What comes next?')}</h2>
          <label htmlFor="ci-title">{t('Chapter title')}</label>
          <input id="ci-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Chapter 5: The tide table')} required autoFocus />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNew(false)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Create chapter')}</button>
          </div>
        </form>
      </Dialog>

    </div>
    </>
  );
};
