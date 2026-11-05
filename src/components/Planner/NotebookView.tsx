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
import { RelationshipMap } from '../Notebook/RelationshipMap';
import { RoleBanner } from '../Collab/RoleBanner';
import { can } from '../../lib/collab';
import { mark, tp, useT } from '../../i18n';

type Tab = 'all' | 'character' | 'location' | 'item' | 'lore';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: mark('Everything') },
  { id: 'character', label: mark('Characters') },
  { id: 'location', label: mark('Places') },
  { id: 'item', label: mark('Items') },
  { id: 'lore', label: mark('Lore') },
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
  const t = useT();
  const { entities, chapters, createEntity, deleteEntity, updateEntity, activeProject, projectRole } = useApp();
  const structure = can.editStructure(projectRole);
  const [view, setView] = useState<'list' | 'map'>('list');
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
      setImageError(err instanceof Error ? err.message : t('Could not use that image.'));
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
        {t('World notebook')} <span>/ {tp(notebook.length, '{n} note', '{n} notes')}</span>
      </h1>
      <div className="toolbar-actions">
        {structure && (
          <button className="button button-primary button-small" onClick={() => openForm(null)}>
            {t('Add entity')}
          </button>
        )}
      </div>
    </div>
    <div className="studio-view">
      <div className="page page-wide" style={{ paddingTop: 28 }}>
        <RoleBanner />
        <div className="world-filter" role="group" aria-label={t('How to look at the notebook')}>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>{t('List')}</button>
          <button aria-pressed={view === 'map'} onClick={() => setView('map')}>{t('Relationship map')}</button>
        </div>
        <div className="world-filter" role="group" aria-label={t('Filter the world notebook')}>
          {TABS.map((tab) => (
            <button key={tab.id} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              {t(tab.label)}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="world-filter tag-filter" role="group" aria-label={t('Filter by tag')}>
            {allTags.map(([tag, count]) => (
              <button key={tag} aria-pressed={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                #{tag} <small>{count}</small>
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState icon="book" title={t('No notes here')} text={activeTag ? t('Nothing is tagged #{tag} in this category.', { tag: activeTag }) : t('Create your first note and it will show up here.')}>
            {activeTag ? (
              <button className="small-btn" onClick={() => setActiveTag(null)}>{t('Clear the tag filter')}</button>
            ) : (
              <button className="small-btn is-primary" onClick={() => openForm(null)}>{t('Create your first note')}</button>
            )}
          </EmptyState>
        ) : (
          <div className="entity-layout">
            {view === 'map' && activeProject ? (
              <RelationshipMap projectId={activeProject.id} entities={visible} selectedId={selected?.id ?? null} onSelect={(entity) => setSelectedEntityId(entity.id)} />
            ) : (
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
            )}

            {selected && (
              <aside className="card detail-panel" aria-live="polite" aria-label={t('Entity details')}>
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
                {structure && (
                <div className="page-actions" style={{ marginTop: 18 }}>
                  <button className="small-btn" onClick={() => openForm(selected)}>
                    <Pencil /> {t('Edit entity')}
                  </button>
                  <button className="small-btn is-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> {t('Delete')}
                  </button>
                </div>
                )}
              </aside>
            )}
          </div>
        )}
      </div>

      <MarginsRail
        thought={
          <>
            {t('A small detail, kept,')}
            <br />
            {t('makes a world believable.')}
          </>
        }
      >
        <RailBlock title={t('This notebook')}>
          <p>
            {t('{notes} so far.', { notes: tp(notebook.length, '{n} note', '{n} notes') })}
          </p>
        </RailBlock>
        <RailBlock title={t('By kind')}>
          <RailRow label={t('Characters')} value={notebook.filter((e) => e.type === 'character').length} />
          <RailRow label={t('Places')} value={notebook.filter((e) => e.type === 'location').length} />
          <RailRow label={t('Items')} value={notebook.filter((e) => e.type === 'item').length} />
          <RailRow label={t('Lore')} value={notebook.filter((e) => e.type === 'lore').length} />
        </RailBlock>
        {notebook.length > 0 && (
          <RailBlock title={t('Recently added')}>
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
          <p className="eyebrow">{t('NOTEBOOK')}</p>
          <h2 id="en-h">{editingEntity ? t('Edit entity') : t('Add an entity')}</h2>
          <label htmlFor="en-name">{t('Name')}</label>
          <input id="en-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Lyra Vance, Spire of Whispers')} required autoFocus />
          <label htmlFor="en-type">{t('Type')}</label>
          <select id="en-type" className="select" style={{ marginTop: 8 }} value={type} onChange={(e) => setType(e.target.value as WikiEntity['type'])}>
            <option value="character">{t('Character')}</option>
            <option value="location">{t('Location')}</option>
            <option value="item">{t('Item')}</option>
            <option value="lore">{t('Lore')}</option>
            {editingEntity?.type === 'scene' && <option value="scene">{t('Scene')}</option>}
          </select>
          <label htmlFor="en-sum">{t('Short summary')}</label>
          <input id="en-sum" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('A quick summary of this entity')} />

          <label htmlFor="en-image" style={{ marginTop: 24 }}>{t('Picture (optional)')}</label>
          <div className="image-pick">
            {image ? <img src={image} alt={t('Chosen picture')} /> : <span aria-hidden="true"><ImagePlus /></span>}
            <div>
              <input id="en-image" type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
              {image && (
                <button type="button" className="small-btn" onClick={() => setImage('')} style={{ marginTop: 8 }}>
                  {t('Remove picture')}
                </button>
              )}
              {imageError && <p className="meta" role="alert" style={{ color: 'var(--danger)', marginTop: 6 }}>{imageError}</p>}
            </div>
          </div>

          <label htmlFor="en-tags" style={{ marginTop: 24 }}>{t('Tags (optional)')}</label>
          <input id="en-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={t('ally, sailor, act one')} />

          <label style={{ marginTop: 24 }}>{t('Connections (optional)')}</label>
          <div style={{ marginTop: 8 }}>
            {links.map((row, i) => (
              <div className="kv-row" key={i}>
                <select
                  className="select"
                  aria-label={t('Connected to')}
                  value={row.to}
                  onChange={(e) => setLinks(links.map((r, j) => (j === i ? { ...r, to: e.target.value } : r)))}
                >
                  <option value="">{t('Choose a note…')}</option>
                  {notebook
                    .filter((e) => e.id !== editingEntity?.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
                <input
                  className="input"
                  aria-label={t('How they are connected')}
                  value={row.label}
                  placeholder={t('How (e.g. sister of, lives in)')}
                  onChange={(e) => setLinks(links.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                />
                <button type="button" className="small-btn" aria-label={t('Remove connection')} onClick={() => setLinks(links.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="small-btn" onClick={() => setLinks([...links, { to: '', label: '' }])} disabled={notebook.filter((e) => e.id !== editingEntity?.id).length === 0}>
              <Plus /> {t('Add connection')}
            </button>
          </div>

          <label style={{ marginTop: 24 }}>{t('Structured attributes (optional)')}</label>
          <div style={{ marginTop: 8 }}>
            {attrs.map((row, i) => (
              <div className="kv-row" key={i}>
                <input className="input" value={row.key} placeholder={t('Attribute (e.g. Age, Region)')} onChange={(e) => setAttrs(attrs.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} />
                <input className="input" value={row.value} placeholder={t('Value (e.g. 24, Stormpeaks)')} onChange={(e) => setAttrs(attrs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} />
                <button type="button" className="small-btn" aria-label={t('Remove attribute')} onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="small-btn" onClick={() => setAttrs([...attrs, { key: '', value: '' }])}>
              <Plus /> {t('Add attribute')}
            </button>
          </div>
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowForm(false)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Save entity')}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={confirmDelete && !!selected} onClose={() => setConfirmDelete(false)} labelledBy="de-h">
        <p className="eyebrow">{t('CAREFUL')}</p>
        <h2 id="de-h">{t('Delete {name}?', { name: selected?.name ?? '' })}</h2>
        <p>{t('This can\'t be undone. Connections to it from other notes are dropped.')}</p>
        <div className="dialog-actions">
          <button className="button button-outline button-small" onClick={() => setConfirmDelete(false)}>{t('Keep it')}</button>
          <button
            className="button button-primary button-small"
            onClick={async () => {
              if (selected) await deleteEntity(selected.id);
              setSelectedEntityId(null);
              setConfirmDelete(false);
            }}
          >
            {t('Yes, delete')}
          </button>
        </div>
      </Dialog>
    </div>
    </>
  );
};
