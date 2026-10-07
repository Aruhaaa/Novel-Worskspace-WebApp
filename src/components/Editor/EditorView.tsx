import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Maximize, Minimize, Printer, Download, Lightbulb, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { countWords, htmlToText, readMinutes } from '../../lib/text';
import { usePublishProject } from '../../lib/publish';
import { useDailyGoal } from '../../lib/dailyGoal';
import { metaFor, STATUS_LABEL, STATUS_ORDER, type ChapterStatus } from '../../lib/chapterMeta';
import { openCapture } from '../../lib/uiEvents';
import { RichTextEditor } from './RichTextEditor';
import { useChapterAutosave } from './useChapterAutosave';
import { VersionHistory } from './VersionHistory';
import { addSnapshot, maybeAutoSnapshot } from '../../lib/history';
import { MoreMenu } from '../ui/MoreMenu';
import { ExportDialog } from '../Export/ExportDialog';
import { ChapterIndexView } from './ChapterIndexView';
import { MarginsRail, RailBlock } from '../ui/MarginsRail';
import { EntityPeek } from '../Notebook/EntityPeek';
import { FeedbackDialog } from '../Feedback/FeedbackDialog';
import { requestFind } from '../../lib/uiEvents';
import { useOnline } from '../../lib/online';
import { quoteTerm, setFeedbackStatus, useFeedback } from '../../lib/feedback';
import { mentionCount, sceneChapterId, sceneWhen, withSceneLinks } from '../../lib/notes';

export const EditorView: React.FC = () => {
  const { activeProject, chapters, activeChapter, entities, chapterMeta, updateChapterMeta, updateEntity, isSupabase, zenMode, setZenMode } = useApp();
  const daily = useDailyGoal();
  const navigate = useNavigate();
  const autosave = useChapterAutosave((id, title, content) => {
    if (activeProject) void maybeAutoSnapshot(activeProject.id, id, title, content);
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const feedback = useFeedback(activeProject?.id);
  const online = useOnline();

  // A restore point of how the chapter looked when it was opened
  useEffect(() => {
    if (activeProject && activeChapter && activeChapter.content) {
      void addSnapshot(activeProject.id, activeChapter.id, activeChapter.title || '', activeChapter.content, 'session');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter?.id]);
  const { title: localTitle, content: localContent, status: saveStatus } = autosave;
  const togglePublish = usePublishProject();

  // Escape leaves Zen mode
  useEffect(() => {
    if (!zenMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZenMode(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zenMode, setZenMode]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => autosave.setTitle(e.target.value);
  const handleContentChange = (val: string) => autosave.setContent(val);

  if (!activeChapter) {
    return <ChapterIndexView />;
  }

  const wordCount = countWords(localContent);
  const charCount = htmlToText(localContent).length;
  const chapterNumber = Math.max(1, chapters.findIndex((c) => c.id === activeChapter.id) + 1);

  // Characters, places and other notes named in this chapter
  const plain = htmlToText(localContent);
  const notebookEntries = entities.filter((e) => e.type !== 'scene');
  const onThePage = notebookEntries.filter((e) => e.name && mentionCount(localContent, plain, e) > 0).slice(0, 8);

  // Outline scenes that belong to this chapter, and the ones that could be added to it
  const scenes = entities.filter((e) => e.type === 'scene');
  const sceneHere = scenes.filter((sc) => sceneChapterId(sc) === activeChapter.id);
  const sceneElsewhere = scenes.filter((sc) => sceneChapterId(sc) !== activeChapter.id);
  const setSceneChapter = (scene: (typeof scenes)[number], chapterId: string) =>
    updateEntity(scene.id, { content: withSceneLinks(scene, chapterId, sceneWhen(scene)) });

  const openMention = (idOrName: string) => {
    const hit = entities.find((e) => e.id === idOrName) || entities.find((e) => e.name === idOrName);
    if (hit) setPeekId(hit.id);
  };

  const saveLabel =
    !online && saveStatus !== 'saved'
      ? 'Offline: kept on this device, saves when you reconnect'
      : saveStatus === 'saved'
      ? `Saved ${isSupabase ? 'to the cloud' : 'on this device'}`
      : saveStatus === 'saving'
        ? 'Saving…'
        : saveStatus === 'error'
          ? 'Not saved yet'
          : 'Changes pending';

  const meta = metaFor(chapterMeta, activeChapter.id);

  const contextRail = (
    <MarginsRail>
      <RailBlock title="This chapter">
        <p>
          {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'} · {readMinutes(wordCount)}
        </p>
        <label className="rail-label" htmlFor="ch-status">Where it stands</label>
        <select
          id="ch-status"
          className="select rail-field"
          value={meta.status}
          onChange={(e) => updateChapterMeta(activeChapter.id, { status: e.target.value as ChapterStatus })}
        >
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>{STATUS_LABEL[st]}</option>
          ))}
        </select>
      </RailBlock>
      <RailBlock title="Synopsis and notes">
        <label className="rail-label" htmlFor="ch-synopsis">In a line or two</label>
        <textarea
          id="ch-synopsis"
          className="textarea rail-field"
          rows={3}
          value={meta.synopsis}
          onChange={(e) => updateChapterMeta(activeChapter.id, { synopsis: e.target.value })}
          placeholder="What happens here?"
        />
        <label className="rail-label" htmlFor="ch-notes">Notes to yourself</label>
        <textarea
          id="ch-notes"
          className="textarea rail-field"
          rows={5}
          value={meta.notes}
          onChange={(e) => updateChapterMeta(activeChapter.id, { notes: e.target.value })}
          placeholder="Fix the timeline. Foreshadow the storm."
        />
        <small>Saved on this device. Never part of your exports.</small>
      </RailBlock>
      <RailBlock title="On the page">
        {onThePage.length === 0 ? (
          <p>Characters and places from your notebook appear here when you name them.</p>
        ) : (
          onThePage.map((ent) => (
            <button className="character-chip chip-button" key={ent.id} onClick={() => setPeekId(ent.id)} aria-label={`Look at ${ent.name}`}>
              <span aria-hidden="true">{ent.name.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{ent.name}</strong>
                <small style={{ textTransform: 'capitalize' }}>{ent.type}</small>
              </div>
            </button>
          ))
        )}
      </RailBlock>
      {feedback.some((f) => f.chapterId === activeChapter.id && f.status === 'open') && (
        <RailBlock title="Reader notes">
          {feedback
            .filter((f) => f.chapterId === activeChapter.id && f.status === 'open')
            .map((f) => (
              <div className="reader-note" key={`${f.reader}-${f.id}`}>
                <small>{f.reader}</small>
                {f.quote && <q>{f.quote.length > 90 ? `${f.quote.slice(0, 87)}…` : f.quote}</q>}
                <p>{f.note}</p>
                <div>
                  {f.quote && (
                    <button className="link-accent" onClick={() => requestFind(quoteTerm(f.quote))}>Show</button>
                  )}
                  <button className="link-accent" onClick={() => setFeedbackStatus(activeProject!.id, f, 'done')}>Done</button>
                </div>
              </div>
            ))}
        </RailBlock>
      )}
      <RailBlock title="Scenes here">
        {sceneHere.length === 0 ? (
          <p>No outline scenes are linked to this chapter yet.</p>
        ) : (
          sceneHere.map((sc) => (
            <div className="scene-link" key={sc.id}>
              <span>
                {sc.name}
                <small>{sc.content.status || 'idea'}</small>
              </span>
              <button className="icon-button" aria-label={`Unlink ${sc.name} from this chapter`} title="Unlink" onClick={() => setSceneChapter(sc, '')}>×</button>
            </div>
          ))
        )}
        {sceneElsewhere.length > 0 && (
          <>
            <label className="rail-label" htmlFor="ch-link-scene">Link a scene</label>
            <select
              id="ch-link-scene"
              className="select rail-field"
              value=""
              onChange={(e) => {
                const sc = scenes.find((x) => x.id === e.target.value);
                if (sc) setSceneChapter(sc, activeChapter.id);
              }}
            >
              <option value="">Choose from your outline…</option>
              {sceneElsewhere.map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </>
        )}
      </RailBlock>
    </MarginsRail>
  );

  return (
    <>
      <div className="studio-toolbar">
        <h1>
          Manuscript <span>/ Chapter {String(chapterNumber).padStart(2, '0')}</span>
        </h1>
        <div className="toolbar-actions">
          <Link className="button button-outline button-small" to="/chapters">
            Chapter index
          </Link>
          <button className="button button-outline button-small" onClick={() => setShowHistory(true)}>
            History
          </button>
          <MoreMenu
            items={[
              { label: 'Jot an idea', icon: <Lightbulb />, onSelect: () => openCapture() },
              { label: 'Reader feedback…', icon: <MessageSquare />, onSelect: () => setShowFeedback(true) },
              { label: 'Export…', icon: <Download />, onSelect: () => setShowExport(true) },
              { label: 'Print view', icon: <Printer />, onSelect: () => navigate('/print') },
            ]}
          />
          {activeProject && (
            <button
              className={`button button-small ${activeProject.is_published ? 'button-outline' : 'button-primary'}`}
              onClick={() => togglePublish(activeProject)}
              aria-pressed={!!activeProject.is_published}
              title={activeProject.is_published ? 'Remove this novel from the Public Library' : 'Share this novel in the Public Library'}
            >
              {activeProject.is_published ? 'Published · Unpublish' : 'Publish novel'}
            </button>
          )}
          <button
            className="focus-button"
            onClick={() => setZenMode(!zenMode)}
            aria-pressed={zenMode}
            aria-label={zenMode ? 'Exit focus mode' : 'Enter focus mode'}
            title="Focus mode; Escape to exit"
          >
            {zenMode ? <Minimize /> : <Maximize />}
            <span>{zenMode ? 'Exit focus' : 'Zen mode'}</span>
          </button>
        </div>
      </div>

      {autosave.notice && (
        <div className="find-bar" role="status" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12 }}>{autosave.notice}</span>
          <button className="small-btn" onClick={autosave.dismissNotice}>Dismiss</button>
        </div>
      )}

      <RichTextEditor
        content={localContent}
        onChange={handleContentChange}
        onMentionClick={openMention}
        header={
          <>
            <div className="paper-running-head">
              <span>{(activeProject?.title || '').toUpperCase()}</span>
              <span>{activeProject?.is_published ? 'PUBLISHED' : 'DRAFT'}</span>
            </div>
            <p className="chapter-kicker">CHAPTER {String(chapterNumber).padStart(2, '0')}</p>
            <input
              className="chapter-title"
              value={localTitle}
              onChange={handleTitleChange}
              placeholder="Untitled chapter"
              aria-label="Chapter title"
              style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', display: 'block' }}
            />
          </>
        }
      />

      <footer className="studio-statusbar">
        <div>
          <span>{wordCount.toLocaleString()} words</span>
          <span>{charCount.toLocaleString()} characters</span>
          <span>{readMinutes(wordCount)}</span>
        </div>
        <div>
          {zenMode && <span className="status-hint">Today {daily.written.toLocaleString()} / {daily.goal.toLocaleString()} · Escape to exit</span>}
          <span className="save-status" role="status" style={saveStatus === 'error' ? { color: 'var(--danger)' } : undefined}>
            {saveLabel}
          </span>
          {saveStatus === 'error' && (
            <button className="link-accent" onClick={autosave.retry}>Retry now</button>
          )}
        </div>
      </footer>

      <ExportDialog project={showExport ? activeProject : null} onClose={() => setShowExport(false)} />

      <VersionHistory
        open={showHistory}
        projectId={activeProject?.id || ''}
        onClose={() => setShowHistory(false)}
        chapterId={activeChapter.id}
        currentTitle={localTitle}
        currentContent={localContent}
        currentWords={wordCount}
        onRestore={(t, c) => autosave.replaceAll(t, c)}
      />

      <EntityPeek entityId={peekId} onChange={setPeekId} />
      <FeedbackDialog project={showFeedback ? activeProject : null} onClose={() => setShowFeedback(false)} />

      {contextRail}
    </>
  );
};
