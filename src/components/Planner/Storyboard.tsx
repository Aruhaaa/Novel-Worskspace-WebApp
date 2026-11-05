import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { sceneChapterId, sceneWhen } from '../../lib/notes';
import { Dialog } from '../ui/Dialog';
import { mark, useT } from '../../i18n';

const COLUMNS = [
  { id: 'idea', title: mark('Ideas') },
  { id: 'todo', title: mark('To do') },
  { id: 'drafting', title: mark('Drafting') },
  { id: 'finished', title: mark('Finished') },
];

interface StoryboardProps {
  onEditEntity: (entity: WikiEntity) => void;
}

export const Storyboard: React.FC<StoryboardProps> = ({ onEditEntity }) => {
  const t = useT();
  const { entities, chapters, createEntity, updateEntity, deleteEntity, activeProject } = useApp();

  const [showAdd, setShowAdd] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState('');
  const [newSceneName, setNewSceneName] = useState('');
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const scenes = entities.filter((e) => e.type === 'scene');

  const chapterLabel = (scene: WikiEntity): string | null => {
    const id = sceneChapterId(scene);
    const at = id ? chapters.findIndex((ch) => ch.id === id) : -1;
    return at === -1 ? null : `${t('Ch. {n}', { n: String(at + 1).padStart(2, '0') })} · ${chapters[at].title || t('Untitled chapter')}`;
  };

  const getScenesByStatus = (statusId: string) =>
    scenes
      .filter((s) => (s.content.status || 'idea') === statusId)
      .sort((a, b) => parseInt(a.content.order || '0', 10) - parseInt(b.content.order || '0', 10));

  const moveScene = async (scene: WikiEntity, statusId: string, order: number) => {
    await updateEntity(scene.id, { content: { ...scene.content, status: statusId, order: order.toString() } });
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const entity = scenes.find((s) => s.id === draggableId);
    if (!entity) return;
    await moveScene(entity, destination.droppableId, destination.index);
  };

  // Keyboard-friendly alternative to dragging
  const stepScene = async (scene: WikiEntity, direction: -1 | 1) => {
    const current = COLUMNS.findIndex((c) => c.id === (scene.content.status || 'idea'));
    const next = COLUMNS[current + direction];
    if (!next) {
      setAnnouncement(t('Already at the edge of the board'));
      return;
    }
    await moveScene(scene, next.id, 999);
    setAnnouncement(t('“{scene}” moved to {column}', { scene: scene.name, column: t(next.title) }));
  };

  const submitAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newSceneName.trim()) return;
    await createEntity(newSceneName.trim(), 'scene', '', { status: activeColumnId, order: '999' });
    setShowAdd(false);
  };

  const confirmDelete = async () => {
    if (sceneToDelete) {
      await deleteEntity(sceneToDelete);
      setSceneToDelete(null);
    }
  };

  return (
    <div>
      <p className="section-note">{t('Drag a scene, or use the arrow buttons to move it between columns. The move buttons work with a keyboard.')}</p>
      <p className="sr-only" role="status">{announcement}</p>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board-4">
          {COLUMNS.map((column) => {
            const list = getScenesByStatus(column.id);
            return (
              <div key={column.id}>
                <h3 className="board-column-label">
                  {t(column.title).toUpperCase()} <span>{String(list.length).padStart(2, '0')}</span>
                </h3>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{ minHeight: 60, background: snapshot.isDraggingOver ? 'var(--tint)' : undefined }}
                    >
                      {list.map((scene, index) => (
                        <Draggable key={scene.id} draggableId={scene.id} index={index}>
                          {(drag, dragSnapshot) => (
                            <article
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className="scene-card"
                              style={{ ...drag.draggableProps.style, boxShadow: dragSnapshot.isDragging ? '0 12px 24px -12px #3c332466' : undefined }}
                            >
                              <span className="scene-status">{t(column.title).toUpperCase()}</span>
                              <h4>{scene.name}</h4>
                              <p>{scene.description || t('No description')}</p>
                              {(chapterLabel(scene) || sceneWhen(scene)) && (
                                <div className="scene-meta">
                                  {chapterLabel(scene) && <span className="badge is-accent">{chapterLabel(scene)}</span>}
                                  {sceneWhen(scene) && <span className="badge">{sceneWhen(scene)}</span>}
                                </div>
                              )}
                              <div className="scene-tools">
                                <span className="grip" {...drag.dragHandleProps} aria-label={t('Drag to move')}>
                                  <GripVertical />
                                </span>
                                <button onClick={() => stepScene(scene, -1)} aria-label={t('Move to previous column')}><ChevronLeft /></button>
                                <button onClick={() => stepScene(scene, 1)} aria-label={t('Move to next column')}><ChevronRight /></button>
                                <button onClick={() => onEditEntity(scene)} aria-label={t('Edit scene')}><Edit2 /></button>
                                <button onClick={() => setSceneToDelete(scene.id)} aria-label={t('Delete scene')}><Trash2 /></button>
                              </div>
                            </article>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <button
                  className="add-scene"
                  onClick={() => {
                    setActiveColumnId(column.id);
                    setNewSceneName('');
                    setShowAdd(true);
                  }}
                >
                  + {t('Add scene')}
                </button>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <Dialog open={showAdd} onClose={() => setShowAdd(false)} labelledBy="sc-h">
        <form onSubmit={submitAddScene}>
          <p className="eyebrow">{t('STORYBOARD')}</p>
          <h2 id="sc-h">{t('Add a scene')}</h2>
          <label htmlFor="sc-name">{t('Scene name')}</label>
          <input id="sc-name" value={newSceneName} onChange={(e) => setNewSceneName(e.target.value)} placeholder={t('Scene name…')} required autoFocus />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowAdd(false)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Create scene')}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={sceneToDelete !== null} onClose={() => setSceneToDelete(null)} labelledBy="ds-h">
        <p className="eyebrow">{t('CAREFUL')}</p>
        <h2 id="ds-h">{t('Delete this scene?')}</h2>
        <p>{t('This can\'t be undone.')}</p>
        <div className="dialog-actions">
          <button className="button button-outline button-small" onClick={() => setSceneToDelete(null)}>{t('Keep it')}</button>
          <button className="button button-primary button-small" onClick={confirmDelete}>{t('Yes, delete')}</button>
        </div>
      </Dialog>
    </div>
  );
};
