import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import { Plus, GripVertical, Trash2, Edit2 } from 'lucide-react';
import type { WikiEntity } from '../../services/types';

const COLUMNS = [
  { id: 'idea', title: 'Ideas' },
  { id: 'todo', title: 'To Do' },
  { id: 'drafting', title: 'Drafting' },
  { id: 'finished', title: 'Finished' },
];

interface StoryboardProps {
  onEditEntity: (entity: WikiEntity) => void;
}

export const Storyboard: React.FC<StoryboardProps> = ({ onEditEntity }) => {
  const { entities, createEntity, updateEntity, deleteEntity, activeProject } = useApp();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState('');
  const [newSceneName, setNewSceneName] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);

  
  // Filter only scenes
  const scenes = entities.filter(e => e.type === 'scene');
  
  // Group scenes by status
  const getScenesByStatus = (statusId: string) => {
    // We also use position to sort them if it exists
    const columnScenes = scenes.filter(s => (s.content.status || 'idea') === statusId);
    
    // Sort by content.order if it exists
    return columnScenes.sort((a, b) => {
      const orderA = parseInt(a.content.order || '0', 10);
      const orderB = parseInt(b.content.order || '0', 10);
      return orderA - orderB;
    });
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // Dropped outside a valid droppable
    if (!destination) return;
    
    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    
    // Identify the entity that was dragged
    const entity = scenes.find(s => s.id === draggableId);
    if (!entity) return;

    const newStatus = destination.droppableId;
    
    // Optimistic reordering logic for the entire column isn't perfectly supported by a single update 
    // unless we update all items in that column. Let's keep it simple and just update the status 
    // and order of the dragged item for now.
    
    await updateEntity(entity.id, {
      content: { 
        ...entity.content, 
        status: newStatus,
        order: destination.index.toString() 
      }
    });
  };

  const handleAddClick = (statusId: string) => {
    setActiveColumnId(statusId);
    setNewSceneName('');
    setShowAddModal(true);
  };

  const submitAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newSceneName.trim()) return;
    
    await createEntity(newSceneName.trim(), 'scene', '', { status: activeColumnId, order: '999' });
    setShowAddModal(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSceneToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (sceneToDelete) {
      await deleteEntity(sceneToDelete);
      setShowDeleteModal(false);
      setSceneToDelete(null);
    }
  };

  return (
    <div className="flex-1 h-full overflow-x-auto p-6 bg-slate-900/50">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 h-full items-start min-w-max pb-8">
          {COLUMNS.map(column => (
            <div key={column.id} className="w-[320px] flex flex-col bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 max-h-full shadow-xl">
              {/* Header */}
              <div className="p-4 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-slate-200 tracking-wide text-sm uppercase">{column.title}</h3>
                <span className="bg-slate-700/50 text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-600/50">
                  {getScenesByStatus(column.id).length}
                </span>
              </div>
              
              {/* Droppable Area */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 px-3 pb-3 overflow-y-auto space-y-3 min-h-[200px] transition-colors ${
                      snapshot.isDraggingOver ? 'bg-indigo-900/10' : ''
                    }`}
                  >
                    {getScenesByStatus(column.id).map((scene, index) => (
                      <Draggable key={scene.id} draggableId={scene.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-slate-700/80 p-3.5 rounded-lg border shadow-sm group transition-all ${
                              snapshot.isDragging 
                                ? 'border-indigo-500 shadow-indigo-500/25 shadow-xl scale-105 rotate-2 z-50' 
                                : 'border-slate-600/50 hover:border-indigo-500/50'
                            }`}
                            onClick={() => onEditEntity(scene)}
                          >
                            <div className="flex items-start gap-3">
                              <div 
                                {...provided.dragHandleProps}
                                className="shrink-0 p-1 -ml-1 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <h4 className="text-sm font-medium text-slate-200 leading-tight mb-1">{scene.name}</h4>
                                {scene.description ? (
                                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{scene.description}</p>
                                ) : (
                                  <p className="text-xs text-slate-500 italic">No description</p>
                                )}
                              </div>
                              <div className="shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onEditEntity(scene); }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-600 rounded"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteClick(e, scene.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-600 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Footer */}
              <div className="p-3 shrink-0">
                <button 
                  onClick={() => handleAddClick(column.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Scene</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Add Scene Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Create New Scene</h3>
              <form onSubmit={submitAddScene}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Scene name..."
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newSceneName.trim()}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Create Scene
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-rose-400 mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete Scene?
              </h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Are you sure you want to delete this scene? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSceneToDelete(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-lg shadow-rose-600/20"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
