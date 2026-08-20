import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { 
  Users, 
  MapPin, 
  Sparkles, 
  BookOpen, 
  Plus, 
  Trash2, 
  Tag, 
  Info, 
  X,
  LayoutTemplate
} from 'lucide-react';

import { Storyboard } from './Storyboard';

export const PlannerView: React.FC = () => {
  const { entities, createEntity, deleteEntity, updateEntity } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'storyboard' | 'character' | 'location' | 'item' | 'lore'>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Derive selectedEntity from entities list and ID state
  const selectedEntity = entities.find(e => e.id === selectedEntityId) || null;

  // Creation form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState<WikiEntity | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WikiEntity['type']>('character');
  const [newDesc, setNewDesc] = useState('');
  
  // Custom properties for character/location
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [tempContent, setTempContent] = useState<Record<string, string>>({});

  const handleAddProperty = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    setTempContent(prev => ({
      ...prev,
      [newKey.trim()]: newVal.trim()
    }));
    setNewKey('');
    setNewVal('');
  };

  const handleRemoveProperty = (key: string) => {
    setTempContent(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let savedEntity: WikiEntity | void;
    if (editingEntity) {
      savedEntity = await updateEntity(editingEntity.id, {
        name: newName.trim(),
        type: newType,
        description: newDesc.trim(),
        content: tempContent
      });
      if (savedEntity) {
        setSelectedEntityId(savedEntity.id);
      }
    } else {
      await createEntity(
        newName.trim(),
        newType,
        newDesc.trim(),
        tempContent
      );
    }

    // Reset Form
    setNewName('');
    setNewType('character');
    setNewDesc('');
    setTempContent({});
    setEditingEntity(null);
    setShowAddForm(false);
  };

  const filteredEntities = activeTab === 'all' 
    ? entities 
    : entities.filter(e => e.type === activeTab);

  const getIcon = (type: WikiEntity['type']) => {
    switch (type) {
      case 'character': return <Users className="w-4 h-4" />;
      case 'location': return <MapPin className="w-4 h-4" />;
      case 'item': return <Sparkles className="w-4 h-4" />;
      case 'lore': return <BookOpen className="w-4 h-4" />;
      case 'scene': return <LayoutTemplate className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: WikiEntity['type']) => {
    switch (type) {
      case 'character': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'location': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'item': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'lore': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'scene': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  return (
    <div className="flex-1 flex h-screen bg-slate-900 overflow-hidden text-slate-300">
      
      {/* Main planner feed */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Planner Header */}
        <header className="min-h-[4rem] py-4 sm:py-0 sm:h-16 border-b border-slate-800/80 px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 bg-slate-900/50 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <h2 className="text-lg font-semibold text-slate-100 shrink-0">World Planner & Wiki</h2>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg p-1 text-xs w-full sm:w-auto">
              {(['all', 'storyboard', 'character', 'location', 'item', 'lore'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-center rounded-md font-medium capitalize transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-200 text-slate-400'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setEditingEntity(null);
              setNewName('');
              setNewType('character');
              setNewDesc('');
              setTempContent({});
              setShowAddForm(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 py-2.5 sm:py-2 rounded-lg shadow-lg shadow-indigo-600/15 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Entity
          </button>
        </header>

        {/* Dynamic Main Content */}
        {activeTab === 'storyboard' ? (
          <Storyboard 
            onEditEntity={(entity) => {
              setSelectedEntityId(entity.id);
            }} 
          />
        ) : (
          <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-8">
            {filteredEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Info className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-sm">No wiki entities found in this category.</p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-2 underline"
              >
                Create your first note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEntities.map((ent) => (
                <div
                  key={ent.id}
                  onClick={() => setSelectedEntityId(ent.id)}
                  className={`group bg-slate-950/40 hover:bg-slate-950/85 border border-slate-800/80 rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:border-slate-700/80 hover:shadow-xl hover:shadow-black/15 ${selectedEntity?.id === ent.id ? 'ring-2 ring-indigo-500 border-transparent bg-slate-950' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getTypeColor(ent.type)}`}>
                        {getIcon(ent.type)}
                        {ent.type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-100 group-hover:text-white text-base truncate mb-1">{ent.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-4">{ent.description || 'No description provided.'}</p>
                  </div>

                  {/* Quick metadata badges */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-900 pt-3 text-[11px] text-slate-500">
                    <span className="truncate flex-1">
                      Updated {new Date(ent.updated_at).toLocaleDateString()}
                    </span>
                    {Object.keys(ent.content).length > 0 && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-[10px] border border-slate-800">
                        {Object.keys(ent.content).length} attributes
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </main>
        )}
      </div>

      {/* Selected Entity Details Panel */}
      {selectedEntity && (
        <div className="absolute inset-0 md:relative md:w-80 z-40 border-l border-slate-800/80 bg-slate-950/95 md:bg-slate-950/60 backdrop-blur-md flex flex-col h-full shrink-0 animate-in slide-in-from-right duration-200">
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 truncate text-sm">Entity Details</h3>
            <button 
              onClick={() => setSelectedEntityId(null)}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-900 p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getTypeColor(selectedEntity.type)}`}>
                {getIcon(selectedEntity.type)}
                {selectedEntity.type}
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-2">{selectedEntity.name}</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-slate-900">{selectedEntity.description || 'No description provided.'}</p>
            </div>

            {/* Custom attributes section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Attributes</h4>
              {Object.keys(selectedEntity.content).length === 0 ? (
                <div className="text-xs text-slate-500 italic">No structured attributes logged.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(selectedEntity.content).map(([key, val]) => {
                    // Only render if it's not map location metadata
                    if (key === 'lat' || key === 'lng') return null;
                    return (
                      <div key={key} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-0.5 text-xs">
                        <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">{key}</span>
                        <span className="text-slate-200">{String(val)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 border-t border-slate-900 bg-slate-950 flex flex-col gap-3">
            <button
              onClick={() => {
                setEditingEntity(selectedEntity);
                setNewName(selectedEntity.name);
                setNewType(selectedEntity.type);
                setNewDesc(selectedEntity.description || '');
                // Exclude lat/lng if they are in the content
                const filteredContent = { ...selectedEntity.content };
                delete filteredContent.lat;
                delete filteredContent.lng;
                setTempContent(filteredContent);
                setShowAddForm(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-700/60 hover:border-indigo-500/40 bg-slate-800/40 hover:bg-indigo-500/10 text-slate-300 text-xs font-semibold transition-all duration-150"
            >
              Edit Entity
            </button>
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete ${selectedEntity.name}?`)) {
                  await deleteEntity(selectedEntity.id);
                  setSelectedEntityId(null);
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold transition-all duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Entity
            </button>
          </div>
        </div>
      )}

      {/* Add Entity Slide-over / Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl animate-in scale-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" />
                {editingEntity ? 'Edit Entity' : 'Add World Entity'}
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-md transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Entity Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Lyra Vance, Spire of Whispers"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Entity Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as WikiEntity['type'])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="character">Character</option>
                    <option value="location">Location</option>
                    <option value="item">Item</option>
                    <option value="lore">Lore</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Short Summary</label>
                <textarea
                  placeholder="A quick summary of this entity..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
                />
              </div>

              {/* Attributes Builder */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Structured Attributes (Optional)</label>
                
                {/* Properties list */}
                {Object.keys(tempContent).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    {Object.entries(tempContent).map(([key, val]) => {
                      if (key === 'lat' || key === 'lng') return null; // Don't show map locations in the edit form if any still remain
                      return (
                        <div key={key} className="flex items-center gap-1 bg-slate-905 border border-slate-800 text-[10px] text-slate-300 pl-2.5 pr-1.5 py-1 rounded-md font-medium">
                          <span className="text-slate-500 font-semibold">{key}:</span>
                          <span className="text-slate-200">{String(val)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveProperty(key)}
                            className="text-slate-400 hover:text-rose-400 transition-colors p-0.5 rounded ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Properties inputs */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Age, Region)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="flex-1 bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 24, Stormpeaks)"
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    className="flex-1 bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddProperty}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
                >
                  {editingEntity ? 'Update Entity' : 'Save Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
