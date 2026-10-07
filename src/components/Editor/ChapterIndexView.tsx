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
import { ExportDialog } from '../Export/ExportDialog';
import { FeedbackDialog } from '../Feedback/FeedbackDialog';
import { useFeedback } from '../../lib/feedback';

export const ChapterIndexView: React.FC = () => {
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
  } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [bin, setBin] = useState<DeletedChapter[]>([]);
  const [showExport, setShowExport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
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
      message: `Deleted “${chapterTitle || 'Untitled chapter'}”.`,
      actionLabel: 'Undo',
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
        Chapter index <span>/ {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}</span>
      </h1>
      <div className="toolbar-actions">
        <button className="button button-outline button-small" onClick={() => setShowFeedback(true)}>
          Reader feedback{openNotes.length > 0 ? ` (${openNotes.length})` : ''}
        </button>
        <button className="button button-outline button-small" onClick={() => setShowExport(true)}>
          Export
        </button>
        <button className="button button-primary button-small" onClick={() => setShowNew(true)}>
          Create new chapter
        </button>
      </div>
    </div>
    <div className="studio-view">
      <div className="page" style={{ paddingTop: 28 }}>
        {moveError && (
          <p className="mock-note" role="alert" style={{ marginBottom: 16 }}>
            Could not save the new order. It has been put back; check your connection and try again.
          </p>
        )}
        {chapters.length > 1 && (
          <p className="section-note" style={{ marginBottom: 14 }}>
            Drag a chapter by its handle to reorder. With the keyboard, focus the handle, press Space, move with the arrow keys, then Space again.
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
                    <Draggable key={chap.id} draggableId={chap.id} index={i}>
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
                              <span className="num">CHAPTER {String(i + 1).padStart(2, '0')}</span>
                              <h3 style={{ paddingRight: 60 }}>{chap.title || 'Untitled chapter'}</h3>
                            </div>
                            {meta.synopsis && <p className="tile-synopsis">{meta.synopsis}</p>}
                            <span className="meta">
                              {words > 0 ? `${words.toLocaleString()} words` : 'Not started'}
                              {noteTotals.get(chap.id) ? ` · ${noteTotals.get(chap.id)} reader ${noteTotals.get(chap.id) === 1 ? 'note' : 'notes'}` : ''}
                              {sceneTotals.get(chap.id) ? ` · ${sceneTotals.get(chap.id)} ${sceneTotals.get(chap.id) === 1 ? 'scene' : 'scenes'}` : ''}
                            </span>
                          </button>
                          <div className="tile-foot">
                            <label className="sr-only" htmlFor={`st-${chap.id}`}>Status of {chap.title || 'untitled chapter'}</label>
                            <select
                              id={`st-${chap.id}`}
                              className={`tile-status is-${meta.status}`}
                              value={meta.status}
                              onChange={(e) => updateChapterMeta(chap.id, { status: e.target.value as ChapterStatus })}
                            >
                              {STATUS_ORDER.map((s) => (
                                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                              ))}
                            </select>
                          </div>
                          <div className="tile-tools">
                            <span
                              {...drag.dragHandleProps}
                              className="icon-button"
                              aria-label={`Reorder ${chap.title || 'untitled chapter'}`}
                              title="Drag to reorder"
                              style={{ color: 'var(--muted)', cursor: 'grab' }}
                            >
                              <GripVertical />
                            </span>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${chap.title || 'untitled chapter'}`}
                              title="Delete chapter"
                              onClick={() => removeChapter(chap.id)}
                              style={{ color: 'var(--muted)' }}
                            >
                              <Trash2 />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {drop.placeholder}
                <button className="chapter-tile" onClick={() => setShowNew(true)} style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  <Plus style={{ width: 24, height: 24 }} />
                  New chapter
                </button>
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {bin.length > 0 && (
          <section aria-labelledby="bin-h" style={{ marginTop: 44 }}>
            <h2 className="section-title" id="bin-h">Recently deleted</h2>
            <p className="section-note">Kept on this device so a mistake is never final. Restore a chapter to put it back where it was.</p>
            {bin.map((item) => {
              const words = countWords(item.content);
              return (
                <div className="read-row" key={item.id} style={{ alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{item.title || 'Untitled chapter'}</strong>
                    <small>
                      Deleted {new Date(item.deletedAt).toLocaleDateString()} · {words.toLocaleString()} words
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
                    Restore
                  </button>
                  <button
                    className="small-btn is-danger"
                    onClick={async () => {
                      if (item.id !== undefined) await removeFromBin(item.id);
                      await loadBin();
                    }}
                  >
                    Delete forever
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <MarginsRail>
        <RailBlock title="This manuscript">
          <p>
            {totalWords.toLocaleString()} {totalWords === 1 ? 'word' : 'words'} · {readMinutes(totalWords)}
          </p>
        </RailBlock>
        <RailBlock title="Chapters">
          <RailRow label="Total" value={chapters.length} />
          <RailRow label="Done" value={doneCount} />
          <RailRow label="Still to finish" value={chapters.length - doneCount} />
        </RailBlock>
        <RailBlock title="Your target">
          {plan && projectGoal ? (
            <>
              <progress max={plan.target} value={Math.min(plan.written, plan.target)} aria-label="Progress toward the manuscript target" style={{ width: '100%' }} />
              <p style={{ marginTop: 8 }}>
                {plan.written.toLocaleString()} of {plan.target.toLocaleString()} words ({plan.percent}%)
                {plan.state === 'on-track' && plan.perDay !== null && ` · about ${plan.perDay.toLocaleString()} a day for ${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'}`}
                {plan.state === 'overdue' && ' · the deadline has passed'}
                {plan.state === 'reached' && ' · reached'}
              </p>
            </>
          ) : (
            <p>
              Set a length and a finish date on the <a className="link-accent" href="#/tracker">Progress</a> page and it shows here.
            </p>
          )}
        </RailBlock>
      </MarginsRail>

      <ExportDialog project={showExport ? activeProject : null} onClose={() => setShowExport(false)} />
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
          <p className="eyebrow">A FRESH PAGE</p>
          <h2 id="ci-h">What comes next?</h2>
          <label htmlFor="ci-title">Chapter title</label>
          <input id="ci-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 5: The tide table" required autoFocus />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="button button-primary button-small">Create chapter</button>
          </div>
        </form>
      </Dialog>

    </div>
    </>
  );
};
