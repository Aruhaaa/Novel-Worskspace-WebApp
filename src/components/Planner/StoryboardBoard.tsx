import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import type { WikiEntity } from '../../services/types';

export const COLUMNS = [
  { id: 'brainstorming', title: 'Brainstorming' },
  { id: 'act1', title: 'Act I' },
  { id: 'act2', title: 'Act II' },
  { id: 'act3', title: 'Act III' }
];

interface Props {
  scenes: WikiEntity[];
  onCreateScene: (columnId: string, name: string) => void;
  onUpdateScene: (sceneId: string, updates: Partial<WikiEntity>) => void;
  onDeleteScene: (sceneId: string) => void;
}

export const StoryboardBoard: React.FC<Props> = ({ scenes, onCreateScene, onUpdateScene, onDeleteScene }) => {
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  
  // Local state for optimistic updates during drag
  const [localScenes, setLocalScenes] = useState<WikiEntity[]>([]);

  useEffect(() => {
    // Sort scenes by position
    const sorted = [...scenes].sort((a, b) => {
      const posA = parseInt(a.content?.position || '0', 10);
      const posB = parseInt(b.content?.position || '0', 10);
      return posA - posB;
    });
    setLocalScenes(sorted);
  }, [scenes]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const draggedScene = localScenes.find(s => s.id === draggableId);
    if (!draggedScene) return;

    // Create a new array to calculate positions
    const newScenes = Array.from(localScenes);
    
    // Remove from old position
    const sourceIndex = newScenes.findIndex(s => s.id === draggableId);
    newScenes.splice(sourceIndex, 1);
    
    // Update the columnId for the dragged item
    const updatedScene = { 
      ...draggedScene, 
      content: { 
        ...(draggedScene.content || {}), 
        columnId: destination.droppableId 
      } 
    };

    // We need to insert it into the correct position in the newScenes array
    // First, find all scenes in the destination column
    const destColumnScenes = newScenes.filter(s => 
      (s.content?.columnId || 'brainstorming') === destination.droppableId
    );
    
    // Find the exact insertion index in the full array
    let insertIndex = newScenes.length; // Default to end
    
    if (destination.index < destColumnScenes.length) {
      const sceneAtDestIndex = destColumnScenes[destination.index];
      insertIndex = newScenes.findIndex(s => s.id === sceneAtDestIndex.id);
    }

    newScenes.splice(insertIndex, 0, updatedScene);

    // Re-calculate all positions for the destination column to keep them integer-based
    const finalDestColumnScenes = newScenes.filter(s => 
      (s.content?.columnId || 'brainstorming') === destination.droppableId
    );

    // Optimistic update
    setLocalScenes(newScenes);

    // Save exactly what changed to backend
    // Only update the dragged item and any items that shifted
    finalDestColumnScenes.forEach((scene, index) => {
      const currentPos = parseInt(scene.content?.position || '0', 10);
      const currentCol = scene.content?.columnId || 'brainstorming';
      
      if (currentPos !== index || currentCol !== destination.droppableId) {
        onUpdateScene(scene.id, {
          content: {
            ...(scene.content || {}),
            columnId: destination.droppableId,
            position: index.toString()
          }
        });
      }
    });
  };

  const handleAddSubmit = (e: React.FormEvent, columnId: string) => {
    e.preventDefault();
    if (!newSceneName.trim()) {
      setAddingToCol(null);
      return;
    }
    onCreateScene(columnId, newSceneName.trim());
    setNewSceneName('');
    setAddingToCol(null);
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 h-full items-start px-2 min-w-max">
          {COLUMNS.map((column) => {
            const columnScenes = localScenes.filter(
              (scene) => (scene.content?.columnId || 'brainstorming') === column.id
            );

            return (
              <div key={column.id} className="w-80 flex flex-col bg-slate-900/50 rounded-xl border border-slate-800 shrink-0 max-h-full">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-200">{column.title}</h3>
                  <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-1 rounded-md">
                    {columnScenes.length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-indigo-900/10' : ''
                      }`}
                    >
                      {columnScenes.map((scene, index) => (
                        <Draggable key={scene.id} draggableId={scene.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`group relative bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-sm transition-all ${
                                snapshot.isDragging ? 'shadow-xl ring-2 ring-indigo-500 z-50' : 'hover:border-slate-600'
                              }`}
                            >
                              <div className="flex gap-2 items-start">
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing mt-0.5"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-slate-200 truncate">{scene.name}</h4>
                                  {scene.description && (
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{scene.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => onDeleteScene(scene.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-all"
                                  title="Delete scene"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {addingToCol === column.id ? (
                        <form onSubmit={(e) => handleAddSubmit(e, column.id)} className="bg-slate-800 border border-indigo-500/50 rounded-lg p-2 shadow-sm">
                          <input
                            type="text"
                            autoFocus
                            value={newSceneName}
                            onChange={(e) => setNewSceneName(e.target.value)}
                            onBlur={() => {
                              if (!newSceneName.trim()) setAddingToCol(null);
                            }}
                            placeholder="Scene name..."
                            className="w-full bg-transparent border-none text-sm text-slate-200 placeholder-slate-500 focus:ring-0 p-1"
                          />
                        </form>
                      ) : (
                        <button
                          onClick={() => setAddingToCol(column.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg border border-transparent hover:border-slate-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Scene</span>
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};
