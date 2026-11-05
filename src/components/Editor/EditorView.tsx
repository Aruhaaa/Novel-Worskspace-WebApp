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
import { RoleBanner } from '../Collab/RoleBanner';
import { PresenceBar } from '../Collab/PresenceBar';
import { can } from '../../lib/collab';
import { colorFor } from '../../lib/liveEditing';
import { useLiveSession } from '../../lib/useLiveSession';
import { loadLiveEditing } from '../../lib/writingTools';
import { onLocalChange, watchTable } from '../../lib/live';
import { databaseService } from '../../services/database';
import type { Chapter } from '../../services/types';
import { useChapterAutosave } from './useChapterAutosave';
import { SprintHint, SprintTimer } from './SprintTimer';
import { rebaseSprint } from '../../lib/sprint';
import { VersionHistory } from './VersionHistory';
import { addSnapshot, maybeAutoSnapshot } from '../../lib/history';
import { MoreMenu } from '../ui/MoreMenu';
import { ExportDialog } from '../Export/ExportDialogLazy';
import { ChapterIndexView } from './ChapterIndexView';
import { MarginsRail, RailBlock } from '../ui/MarginsRail';
import { EntityPeek } from '../Notebook/EntityPeek';
import { FeedbackDialog } from '../Feedback/FeedbackDialog';
import { requestFind } from '../../lib/uiEvents';
import { useOnline } from '../../lib/online';
import { quoteTerm, setFeedbackStatus, useFeedback } from '../../lib/feedback';
import { mentionCount, sceneChapterId, sceneWhen, withSceneLinks } from '../../lib/notes';
import { tp, useT } from '../../i18n';

export const EditorView: React.FC = () => {
  const t = useT();
  const { activeProject, chapters, activeChapter, entities, chapterMeta, updateChapterMeta, updateEntity, isSupabase, zenMode, setZenMode, projectRole, projectIsShared, user, profile, applyRemoteChapter } = useApp();
  const canText = can.editText(projectRole);
  const canManage = can.manage(projectRole);
  const daily = useDailyGoal();
  const navigate = useNavigate();
  const autosave = useChapterAutosave((id, title, content) => {
    if (activeProject) void maybeAutoSnapshot(activeProject.id, id, title, content);
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [restored, setRestored] = useState<{ html: string; nonce: number } | null>(null);
  const feedback = useFeedback(activeProject?.id);

  // Writing together: when the project has other people on it and this person may write, the open chapter is shared live
  const projectId = activeProject?.id;
  const chapterId = activeChapter?.id;
  const liveWanted = !!user && !!projectId && !!chapterId && projectIsShared && canText && loadLiveEditing();
  const live = useLiveSession(
    liveWanted && user && projectId && chapterId
      ? { projectId, chapterId, user: { name: profile?.display_name || user.email.split('@')[0], color: colorFor(user.id) }, canWrite: true }
      : null
  );

  // Someone who may only read sees the chapter change as the others save it
  useEffect(() => {
    if (canText || !projectId || !chapterId) return;
    const refetch = () => {
      void databaseService.getChapters(projectId).then((all) => {
        const fresh = all.find((c) => c.id === chapterId);
        if (fresh) applyRemoteChapter(fresh);
      });
    };
    const off = watchTable<Chapter>({
      name: `chapter-view:${chapterId}`,
      table: 'chapters',
      filter: `id=eq.${chapterId}`,
      onEvent: (e) => {
        if (e.event !== 'UPDATE') return;
        if (typeof e.row?.content === 'string') applyRemoteChapter(e.row);
        else refetch();
      },
    });
    const offLocal = onLocalChange(['novel_chapters'], refetch);
    // The live line is not needed for correctness: looking again now and then catches anything it missed
    const poll = window.setInterval(refetch, 15000);
    return () => {
      off();
      offLocal();
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canText, projectId, chapterId]);
  const online = useOnline();

  // A restore point of how the chapter looked when it was opened
  useEffect(() => {
    if (activeProject && activeChapter && activeChapter.content) {
      void addSnapshot(activeProject.id, activeChapter.id, activeChapter.title || '', activeChapter.content, 'session');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter?.id]);
  const { title: localTitle, status: saveStatus } = autosave;
  // Someone who cannot write shows what is saved; everyone else shows what they are writing
  const localContent = canText ? autosave.content : (activeChapter?.content ?? '');
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
      ? t('Offline: kept on this device, saves when you reconnect')
      : saveStatus === 'saved'
      ? isSupabase
        ? t('Saved to the cloud')
        : t('Saved on this device')
      : saveStatus === 'saving'
        ? t('Saving…')
        : saveStatus === 'error'
          ? t('Not saved yet')
          : t('Changes pending');

  const meta = metaFor(chapterMeta, activeChapter.id);

  const paperHeader = (
    <>
      <div className="paper-running-head">
        <span>{(activeProject?.title || '').toUpperCase()}</span>
        <span>{activeProject?.is_published ? t('PUBLISHED') : t('DRAFT')}</span>
      </div>
      {live.status === 'ready' && <PresenceBar session={live.session} />}
      <p className="chapter-kicker">{t('CHAPTER {n}', { n: String(chapterNumber).padStart(2, '0') })}</p>
      <input
        className="chapter-title"
        value={localTitle}
        onChange={handleTitleChange}
        readOnly={!canText}
        placeholder={t('Untitled chapter')}
        aria-label={t('Chapter title')}
        style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', display: 'block' }}
      />
    </>
  );

  const contextRail = (
    <MarginsRail>
      <RailBlock title={t('This chapter')}>
        <p>
          {tp(wordCount, '{n} word', '{n} words')} · {readMinutes(wordCount)}
        </p>
        <label className="rail-label" htmlFor="ch-status">{t('Where it stands')}</label>
        <select
          id="ch-status"
          className="select rail-field"
          value={meta.status}
          onChange={(e) => updateChapterMeta(activeChapter.id, { status: e.target.value as ChapterStatus })}
        >
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>{t(STATUS_LABEL[st])}</option>
          ))}
        </select>
      </RailBlock>
      <RailBlock title={t('Synopsis and notes')}>
        <label className="rail-label" htmlFor="ch-synopsis">{t('In a line or two')}</label>
        <textarea
          id="ch-synopsis"
          className="textarea rail-field"
          rows={3}
          value={meta.synopsis}
          onChange={(e) => updateChapterMeta(activeChapter.id, { synopsis: e.target.value })}
          placeholder={t('What happens here?')}
        />
        <label className="rail-label" htmlFor="ch-notes">{t('Notes to yourself')}</label>
        <textarea
          id="ch-notes"
          className="textarea rail-field"
          rows={5}
          value={meta.notes}
          onChange={(e) => updateChapterMeta(activeChapter.id, { notes: e.target.value })}
          placeholder={t('Fix the timeline. Foreshadow the storm.')}
        />
        <small>{t('Saved on this device. Never part of your exports.')}</small>
      </RailBlock>
      <RailBlock title={t('On the page')}>
        {onThePage.length === 0 ? (
          <p>{t('Characters and places from your notebook appear here when you name them.')}</p>
        ) : (
          onThePage.map((ent) => (
            <button className="character-chip chip-button" key={ent.id} onClick={() => setPeekId(ent.id)} aria-label={t('Look at {name}', { name: ent.name })}>
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
        <RailBlock title={t('Reader notes')}>
          {feedback
            .filter((f) => f.chapterId === activeChapter.id && f.status === 'open')
            .map((f) => (
              <div className="reader-note" key={`${f.reader}-${f.id}`}>
                <small>{f.reader}</small>
                {f.quote && <q>{f.quote.length > 90 ? `${f.quote.slice(0, 87)}…` : f.quote}</q>}
                <p>{f.note}</p>
                <div>
                  {f.quote && (
                    <button className="link-accent" onClick={() => requestFind(quoteTerm(f.quote))}>{t('Show')}</button>
                  )}
                  <button className="link-accent" onClick={() => setFeedbackStatus(activeProject!.id, f, 'done')}>{t('Done')}</button>
                </div>
              </div>
            ))}
        </RailBlock>
      )}
      <RailBlock title={t('Scenes here')}>
        {sceneHere.length === 0 ? (
          <p>{t('No outline scenes are linked to this chapter yet.')}</p>
        ) : (
          sceneHere.map((sc) => (
            <div className="scene-link" key={sc.id}>
              <span>
                {sc.name}
                <small>{sc.content.status || 'idea'}</small>
              </span>
              <button className="icon-button" aria-label={t('Unlink {name} from this chapter', { name: sc.name })} title={t('Unlink')} onClick={() => setSceneChapter(sc, '')}>×</button>
            </div>
          ))
        )}
        {sceneElsewhere.length > 0 && (
          <>
            <label className="rail-label" htmlFor="ch-link-scene">{t('Link a scene')}</label>
            <select
              id="ch-link-scene"
              className="select rail-field"
              value=""
              onChange={(e) => {
                const sc = scenes.find((x) => x.id === e.target.value);
                if (sc) setSceneChapter(sc, activeChapter.id);
              }}
            >
              <option value="">{t('Choose from your outline…')}</option>
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
          {t('Manuscript')} <span>/ {t('Chapter {n}', { n: String(chapterNumber).padStart(2, '0') })}</span>
        </h1>
        <div className="toolbar-actions">
          <Link className="button button-outline button-small" to="/chapters">
            {t('Chapter index')}
          </Link>
          {canText && (
            <button className="button button-outline button-small" onClick={() => setShowHistory(true)}>
              {t('History')}
            </button>
          )}
          {activeProject && <SprintTimer projectId={activeProject.id} chapterId={activeChapter.id} chapterWords={wordCount} />}
          <MoreMenu
            items={[
              { label: t('Jot an idea'), icon: <Lightbulb />, onSelect: () => openCapture() },
              { label: t('Reader feedback…'), icon: <MessageSquare />, onSelect: () => setShowFeedback(true) },
              { label: t('Export…'), icon: <Download />, onSelect: () => setShowExport(true) },
              { label: t('Print view'), icon: <Printer />, onSelect: () => navigate('/print') },
            ]}
          />
          {activeProject && canManage && (
            <button
              className={`button button-small ${activeProject.is_published ? 'button-outline' : 'button-primary'}`}
              onClick={() => togglePublish(activeProject)}
              aria-pressed={!!activeProject.is_published}
              title={activeProject.is_published ? t('Remove this novel from the Public Library') : t('Share this novel in the Public Library')}
            >
              {activeProject.is_published ? t('Published · Unpublish') : t('Publish novel')}
            </button>
          )}
          <button
            className="focus-button"
            onClick={() => setZenMode(!zenMode)}
            aria-pressed={zenMode}
            aria-label={zenMode ? t('Exit focus mode') : t('Enter focus mode')}
            title={t('Focus mode; Escape to exit')}
          >
            {zenMode ? <Minimize /> : <Maximize />}
            <span>{zenMode ? t('Exit focus') : t('Zen mode')}</span>
          </button>
        </div>
      </div>

      {autosave.notice && (
        <div className="find-bar" role="status" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12 }}>{autosave.notice}</span>
          <button className="small-btn" onClick={autosave.dismissNotice}>{t('Dismiss')}</button>
        </div>
      )}

      <RoleBanner />
      {live.status === 'connecting' ? (
        <div className="studio-view writing-view">
          <article className="writing-paper">
            {paperHeader}
            <p className="meta" role="status">{t('Joining the others who have this chapter open…')}</p>
          </article>
        </div>
      ) : (
        <RichTextEditor
          key={live.status === 'ready' ? 'together' : 'alone'}
          content={localContent}
          onChange={handleContentChange}
          onMentionClick={openMention}
          live={live.status === 'ready' ? live.session : null}
          editable={canText}
          replaceWith={restored}
          header={paperHeader}
        />
      )}

      <footer className="studio-statusbar">
        <div>
          <span>{tp(wordCount, '{n} word', '{n} words')}</span>
          <span>{tp(charCount, '{n} character', '{n} characters')}</span>
          <span>{readMinutes(wordCount)}</span>
        </div>
        <div>
          {activeProject && <SprintHint projectId={activeProject.id} />}
          {zenMode && <span className="status-hint">{t('Today {written} / {goal} · Escape to exit', { written: daily.written.toLocaleString(), goal: daily.goal.toLocaleString() })}</span>}
          <span className="save-status" role="status" style={saveStatus === 'error' ? { color: 'var(--danger)' } : undefined}>
            {saveLabel}
          </span>
          {saveStatus === 'error' && (
            <button className="link-accent" onClick={autosave.retry}>{t('Retry now')}</button>
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
        onRestore={(t, c) => {
          // A restored version is not new writing, so a running sprint should not count the difference
          if (activeProject) rebaseSprint(activeProject.id, activeChapter.id, countWords(c));
          autosave.replaceAll(t, c);
          // While writing together, the restored text is put in the shared document so the others see it too
          setRestored({ html: c, nonce: Date.now() });
        }}
      />

      <EntityPeek entityId={peekId} onChange={setPeekId} />
      <FeedbackDialog project={showFeedback ? activeProject : null} onClose={() => setShowFeedback(false)} />

      {contextRail}
    </>
  );
};
