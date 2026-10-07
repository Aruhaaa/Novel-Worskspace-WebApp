import React, { useMemo, useState } from 'react';
import { Users, MapPin, Gem, BookOpen, LayoutTemplate, Plus, Pencil, Trash2, ImagePlus } from 'lucide-react';
import { NOTE_HANDOFF_KEY } from '../../lib/uiEvents';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { getLinks, getTags, indexChapters, parseTags, preservedKeys, typedAttributes, TYPE_LABEL, type NoteLink } from '../../lib/notes';
import { shrinkImage } from '../../lib/image';
import { useOpenChapter } from '../../lib/useOpenChapter';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { MarginsRail, RailBlock, RailRow } from '../ui/MarginsRail';
import { EntityDetails } from '../Notebook/EntityDetails';

type Tab = 'all' | 'character' | 'location' | 'item' | 'lore';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'character', label: 'Characters' },
  { id: 'location', label: 'Places' },
  { id: 'item', label: 'Items' },
  { id: 'lore', label: 'Lore' },
];

const typeIcon = (type: WikiEntity['type']) => {
  switch (type) {
    case 'character': return <Users />;
    case 'location': return <MapPin />;
    case 'item': return <Gem />;
    case 'lore': return <BookOpen />;
    default: return <LayoutTemplate />;
  }
};

export const NotebookView: React.FC = () => {
  const { entities, chapters, createEntity, deleteEntity, updateEntity } = useApp();
  const openChapter = useOpenChapter();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(() => {
    try {
      const id = sessionStorage.getItem(NOTE_HANDOFF_KEY);
      if (id) sessionStorage.removeItem(NOTE_HANDOFF_KEY);
      return id;
    } catch {
      return null;
    }
  });
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState<WikiEntity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<WikiEntity['type']>('character');
  const [desc, setDesc] = useState('');
  const [attrs, setAttrs] = useState<{ key: string; value: string }[]>([]);
  const [tagsText, setTagsText] = useState('');
  const [links, setLinks] = useState<NoteLink[]>([]);
  const [image, setImage] = useState('');
  const [imageError, setImageError] = useState('');

  // Scenes live in the Story outline, not in the notebook list
  const notebook = entities.filter((e) => e.type !== 'scene');
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of notebook) for (const t of getTags(e)) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);
  const visible = notebook
    .filter((e) => activeTab === 'all' || e.type === activeTab)
    .filter((e) => !activeTag || getTags(e).some((t) => t.toLowerCase() === activeTag.toLowerCase()));
  const selected = notebook.find((e) => e.id === selectedEntityId) || visible[0] || null;
  const chapterIndex = useMemo(() => indexChapters(chapters), [chapters]);

  const openForm = (entity: WikiEntity | null) => {
    setEditingEntity(entity);
    setName(entity?.name || '');
    setType(entity?.type || (activeTab !== 'all' ? activeTab : 'character'));
    setDesc(entity?.description || '');
    setAttrs(entity ? typedAttributes(entity).map(([key, value]) => ({ key, value })) : []);
    setTagsText(entity ? getTags(entity).join(', ') : '');
    setLinks(entity ? getLinks(entity) : []);
    setImage(entity?.image_url || '');
    setImageError('');
    setShowForm(true);
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setImageError('');
    try {
      setImage(await shrinkImage(file));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not use that image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const content: Record<string, string> = { ...preservedKeys(editingEntity) };
    if (editingEntity) {
      // Board position and map pins are not edited here, so they stay as they were
      for (const k of ['lat', 'lng', 'status', 'order']) if (editingEntity.content?.[k]) content[k] = editingEntity.content[k];
    }
    attrs.forEach(({ key, value }) => {
      const k = key.trim().replace(/^_+/, '');
      if (k && value.trim()) content[k] = value.trim();
    });
    const tags = parseTags(tagsText);
    if (tags.length) content._tags = tags.join(', ');
    const kept = links.filter((l) => l.to).map((l) => ({ to: l.to, label: l.label.trim() }));
    if (kept.length) content._links = JSON.stringify(kept);

    if (editingEntity) {
      const saved = await updateEntity(editingEntity.id, { name: name.trim(), type, description: desc.trim(), content, image_url: image });
      if (saved && saved.type !== 'scene') setSelectedEntityId(saved.id);
    } else {
      await createEntity(name.trim(), type, desc.trim(), content, image || undefined);
    }
    setShowForm(false);
    setEditingEntity(null);
  };

  const select = (entity: WikiEntity) => {
    setSelectedEntityId(entity.id);
    // A connection can lead to a note the current filters hide
    if (activeTab !== 'all' && activeTab !== entity.type) setActiveTab('all');
    setActiveTag(null);
  };

  return (
    <>
    <div className="studio-toolbar">
      <h1>
        World notebook <span>/ {notebook.length} {notebook.length === 1 ? 'note' : 'notes'}</span>
      </h1>
      <div className="toolbar-actions">
        <button className="button button-primary button-small" onClick={() => openForm(null)}>
          Add entity
        </button>
      </div>
    </div>
    <div className="studio-view">
      <div className="page page-wide" style={{ paddingTop: 28 }}>
        <div className="world-filter" role="group" aria-label="Filter the world notebook">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="world-filter tag-filter" role="group" aria-label="Filter by tag">
            {allTags.map(([tag, count]) => (
              <button key={tag} aria-pressed={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                #{tag} <small>{count}</small>
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState icon="book" title="No notes here" text={activeTag ? `Nothing is tagged #${activeTag} in this category.` : 'Create your first note and it will show up here.'}>
            {activeTag ? (
              <button className="small-btn" onClick={() => setActiveTag(null)}>Clear the tag filter</button>
            ) : (
              <button className="small-btn is-primary" onClick={() => openForm(null)}>Create your first note</button>
            )}
          </EmptyState>
        ) : (
          <div className="entity-layout">
            <div>
              {visible.map((ent) => (
                <button
                  key={ent.id}
                  className="entity-row"
                  aria-current={selected?.id === ent.id ? 'true' : undefined}
                  onClick={() => setSelectedEntityId(ent.id)}
                >
                  {ent.image_url ? (
                    <img className="type-icon type-photo" src={ent.image_url} alt="" />
                  ) : (
                    <span className="type-icon">{typeIcon(ent.type)}</span>
                  )}
                  <span>
                    <strong>{ent.name}</strong>
                    <small>
                      {TYPE_LABEL[ent.type]}
                      {ent.description ? ` · ${ent.description.slice(0, 60)}${ent.description.length > 60 ? '…' : ''}` : ''}
                    </small>
                  </span>
                </button>
              ))}
            </div>

            {selected && (
              <aside className="card detail-panel" aria-live="polite" aria-label="Entity details">
                <EntityDetails
                  entity={selected}
                  entities={notebook}
                  chapters={chapterIndex}
                  onSelectEntity={select}
                  onOpenChapter={(chapterId, term) => {
                    const chapter = chapters.find((c) => c.id === chapterId);
                    if (chapter) openChapter(chapter, term);
                  }}
                />
                <div className="page-actions" style={{ marginTop: 18 }}>
                  <button className="small-btn" onClick={() => openForm(selected)}>
                    <Pencil /> Edit entity
                  </button>
                  <button className="small-btn is-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </button>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      <MarginsRail
        thought={
          <>
            A small detail, kept,
            <br />
            makes a world believable.
          </>
        }
      >
        <RailBlock title="This notebook">
          <p>
            {notebook.length} {notebook.length === 1 ? 'note' : 'notes'} so far.
          </p>
        </RailBlock>
        <RailBlock title="By kind">
          <RailRow label="Characters" value={notebook.filter((e) => e.type === 'character').length} />
          <RailRow label="Places" value={notebook.filter((e) => e.type === 'location').length} />
          <RailRow label="Items" value={notebook.filter((e) => e.type === 'item').length} />
          <RailRow label="Lore" value={notebook.filter((e) => e.type === 'lore').length} />
        </RailBlock>
        {notebook.length > 0 && (
          <RailBlock title="Recently added">
            {[...notebook]
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .slice(0, 3)
              .map((ent) => (
                <div className="character-chip" key={ent.id}>
                  <span aria-hidden="true">{ent.name.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{ent.name}</strong>
                    <small>{TYPE_LABEL[ent.type]}</small>
                  </div>
                </div>
              ))}
          </RailBlock>
        )}
      </MarginsRail>

      <Dialog open={showForm} onClose={() => setShowForm(false)} labelledBy="en-h" className="dialog-wide">
        <form onSubmit={handleSubmit}>
          <p className="eyebrow">NOTEBOOK</p>
          <h2 id="en-h">{editingEntity ? 'Edit entity' : 'Add an entity'}</h2>
          <label htmlFor="en-name">Name</label>
          <input id="en-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lyra Vance, Spire of Whispers" required autoFocus />
          <label htmlFor="en-type">Type</label>
          <select id="en-type" className="select" style={{ marginTop: 8 }} value={type} onChange={(e) => setType(e.target.value as WikiEntity['type'])}>
            <option value="character">Character</option>
            <option value="location">Location</option>
            <option value="item">Item</option>
            <option value="lore">Lore</option>
            {editingEntity?.type === 'scene' && <option value="scene">Scene</option>}
          </select>
          <label htmlFor="en-sum">Short summary</label>
          <input id="en-sum" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="A quick summary of this entity" />

          <label htmlFor="en-image" style={{ marginTop: 24 }}>Picture (optional)</label>
          <div className="image-pick">
            {image ? <img src={image} alt="Chosen picture" /> : <span aria-hidden="true"><ImagePlus /></span>}
            <div>
              <input id="en-image" type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
              {image && (
                <button type="button" className="small-btn" onClick={() => setImage('')} style={{ marginTop: 8 }}>
                  Remove picture
                </button>
              )}
              {imageError && <p className="meta" role="alert" style={{ color: 'var(--danger)', marginTop: 6 }}>{imageError}</p>}
            </div>
          </div>

          <label htmlFor="en-tags" style={{ marginTop: 24 }}>Tags (optional)</label>
          <input id="en-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="ally, sailor, act one" />

          <label style={{ marginTop: 24 }}>Connections (optional)</label>
          <div style={{ marginTop: 8 }}>
            {links.map((row, i) => (
              <div className="kv-row" key={i}>
                <select
                  className="select"
                  aria-label="Connected to"
                  value={row.to}
                  onChange={(e) => setLinks(links.map((r, j) => (j === i ? { ...r, to: e.target.value } : r)))}
                >
                  <option value="">Choose a note…</option>
                  {notebook
                    .filter((e) => e.id !== editingEntity?.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
                <input
                  className="input"
                  aria-label="How they are connected"
                  value={row.label}
                  placeholder="How (e.g. sister of, lives in)"
                  onChange={(e) => setLinks(links.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                />
                <button type="button" className="small-btn" aria-label="Remove connection" onClick={() => setLinks(links.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="small-btn" onClick={() => setLinks([...links, { to: '', label: '' }])} disabled={notebook.filter((e) => e.id !== editingEntity?.id).length === 0}>
              <Plus /> Add connection
            </button>
          </div>

          <label style={{ marginTop: 24 }}>Structured attributes (optional)</label>
          <div style={{ marginTop: 8 }}>
            {attrs.map((row, i) => (
              <div className="kv-row" key={i}>
                <input className="input" value={row.key} placeholder="Attribute (e.g. Age, Region)" onChange={(e) => setAttrs(attrs.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} />
                <input className="input" value={row.value} placeholder="Value (e.g. 24, Stormpeaks)" onChange={(e) => setAttrs(attrs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} />
                <button type="button" className="small-btn" aria-label="Remove attribute" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="small-btn" onClick={() => setAttrs([...attrs, { key: '', value: '' }])}>
              <Plus /> Add attribute
            </button>
          </div>
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="button button-primary button-small">Save entity</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={confirmDelete && !!selected} onClose={() => setConfirmDelete(false)} labelledBy="de-h">
        <p className="eyebrow">CAREFUL</p>
        <h2 id="de-h">Delete {selected?.name}?</h2>
        <p>This can't be undone. Connections to it from other notes are dropped.</p>
        <div className="dialog-actions">
          <button className="button button-outline button-small" onClick={() => setConfirmDelete(false)}>Keep it</button>
          <button
            className="button button-primary button-small"
            onClick={async () => {
              if (selected) await deleteEntity(selected.id);
              setSelectedEntityId(null);
              setConfirmDelete(false);
            }}
          >
            Yes, delete
          </button>
        </div>
      </Dialog>
    </div>
    </>
  );
};
