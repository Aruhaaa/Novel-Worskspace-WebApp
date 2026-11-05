import React, { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type { LiveSession } from '../../lib/liveEditing';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify,
  Highlighter,
  MoreHorizontal,
  Search,
  SpellCheck,
  Keyboard,
  Volume2,
  BookA
} from 'lucide-react';
import Mention, { type MentionOptions } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import MentionList, { type MentionListHandle, type MentionListProps } from './MentionList';
import { useApp } from '../../context/AppContext';
import { EDITOR_FONTS, loadEditorFont, saveEditorFont, getEditorFontFamily } from '../../lib/editorFonts';
import { CurrentBlock, FindHighlight, SpeakHighlight, StyleNotes, Typewriter, findKey, findRanges, speakKey, styleKey, typewriterKey, type StyleState } from './editorExtensions';
import { loadLookupAllowed, loadTypewriter, saveTypewriter } from '../../lib/writingTools';
import { useReadAloud } from '../../lib/useReadAloud';
import { ReadAloudBar } from '../Speech/ReadAloudBar';
import { LookupPanel } from './LookupPanel';
import { mark, useT } from '../../i18n';
import { FIND_HANDOFF_KEY, onRequestFind } from '../../lib/uiEvents';
import { STYLE_KINDS, type StyleKind } from '../../lib/style';
import { loadSpellPrefs, loadStylePrefs, saveStylePrefs } from '../../lib/spell';

/** Another person's cursor: a thin line in their colour with their name above it (the name is for the eyes only) */
const renderCaret = (user: { name?: string; color?: string }): HTMLElement => {
  const caret = document.createElement('span');
  caret.classList.add('collaboration-carets__caret');
  caret.setAttribute('style', `border-color: ${user.color ?? '#888'}`);
  const label = document.createElement('div');
  label.classList.add('collaboration-carets__label');
  label.setAttribute('style', `background-color: ${user.color ?? '#888'}`);
  label.setAttribute('aria-hidden', 'true');
  label.appendChild(document.createTextNode(user.name ?? ''));
  // Word joiners keep the line from breaking around the cursor
  caret.appendChild(document.createTextNode(String.fromCharCode(0x2060)));
  caret.appendChild(label);
  caret.appendChild(document.createTextNode(String.fromCharCode(0x2060)));
  return caret;
};

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** Rendered on the paper above the text (running head, chapter number, title) */
  header?: React.ReactNode;
  /** Called with the entry a clicked @mention points at (its id, or its name in older text) */
  onMentionClick?: (idOrName: string) => void;
  /** Write together with the others who have this chapter open (lib/liveEditing.ts). Decided before the editor is made, never changed after. */
  live?: LiveSession | null;
  /** False for someone who may only read */
  editable?: boolean;
  /** Put this text in the chapter in place of what is there, such as a restored version. Only used while writing together. */
  replaceWith?: { html: string; nonce: number } | null;
}

interface ToolProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Tool: React.FC<ToolProps> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    className="tool"
    aria-label={label}
    title={label}
    aria-pressed={active === undefined ? undefined : active}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

const MenuBar = ({ editor, onToggleFindReplace, fontId, onFontChange, styleOn, onToggleStyle, typewriterOn, onToggleTypewriter, canListen, listening, onToggleListen, canLookup, lookupOn, onToggleLookup }: { editor: Editor | null, onToggleFindReplace: () => void, fontId: string, onFontChange: (id: string) => void, styleOn: boolean, onToggleStyle: () => void, typewriterOn: boolean, onToggleTypewriter: () => void, canListen: boolean, listening: boolean, onToggleListen: () => void, canLookup: boolean, lookupOn: boolean, onToggleLookup: () => void }) => {
  const t = useT();
  if (!editor) {
    return null;
  }

  return (
    <div className="tools" role="toolbar" aria-label={t('Formatting')}>
      <label className="sr-only" htmlFor="font-select">{t('Writing font')}</label>
      <select
        id="font-select"
        className="select font-select"
        value={fontId}
        onChange={(e) => onFontChange(e.target.value)}
        title={t('Writing font')}
      >
        {EDITOR_FONTS.map((font) => (
          <option key={font.id} value={font.id}>{font.label}</option>
        ))}
      </select>
      <span className="sep" />
      <Tool label={t('Bold')} active={editor.isActive('bold')} disabled={!editor.can().chain().focus().toggleBold().run()} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
      <Tool label={t('Italic')} active={editor.isActive('italic')} disabled={!editor.can().chain().focus().toggleItalic().run()} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
      <Tool label={t('Heading 1')} active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></Tool>
      <Tool label={t('Heading 2')} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Tool>
      <span className="sep" />
      <Tool label={t('Bullet list')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
      <Tool label={t('Numbered list')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
      <Tool label={t('Blockquote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
      <span className="sep" />
      <Tool label={t('Align left')} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft /></Tool>
      <Tool label={t('Align centre')} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter /></Tool>
      <Tool label={t('Align right')} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight /></Tool>
      <Tool label={t('Justify')} active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify /></Tool>
      <span className="sep" />
      <Tool label={t('Highlight')} active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter /></Tool>
      <Tool label={t('Insert scene separator')} onClick={() => editor.chain().focus().setHorizontalRule().run()}><MoreHorizontal /></Tool>
      <span className="sep" />
      <Tool label={t('Undo')} disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo /></Tool>
      <Tool label={t('Redo')} disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo /></Tool>
      <span className="sep" />
      <Tool label={t('Find and replace')} onClick={onToggleFindReplace}><Search /></Tool>
      <Tool label={t('Style notes')} active={styleOn} onClick={onToggleStyle}><SpellCheck /></Tool>
      <Tool label={t('Typewriter scrolling')} active={typewriterOn} onClick={onToggleTypewriter}><Keyboard /></Tool>
      {canLookup && <Tool label={t('Look up a word')} active={lookupOn} onClick={onToggleLookup}><BookA /></Tool>}
      {canListen && <Tool label={t('Read aloud')} active={listening} onClick={onToggleListen}><Volume2 /></Tool>}
    </div>
  );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder = mark('Every world begins somewhere…'), header, onMentionClick, live = null, editable = true, replaceWith = null }) => {
  const t = useT();
  const mentionClick = React.useRef(onMentionClick);
  useEffect(() => {
    mentionClick.current = onMentionClick;
  }, [onMentionClick]);
  const [handoff] = React.useState(() => {
    try {
      return sessionStorage.getItem(FIND_HANDOFF_KEY) || '';
    } catch {
      return '';
    }
  });
  const [showFindReplace, setShowFindReplace] = React.useState(!!handoff);
  const [findText, setFindText] = React.useState(handoff);
  const [replaceText, setReplaceText] = React.useState('');
  const [matchInfo, setMatchInfo] = React.useState({ count: 0, current: 0 });
  const jumpFirst = React.useRef(!!handoff);
  const [fontId, setFontId] = React.useState(loadEditorFont);
  const [spell] = React.useState(loadSpellPrefs);
  const allKinds = React.useMemo(() => STYLE_KINDS.map((k) => k.id), []);
  const [stylePrefs, setStylePrefs] = React.useState(() => loadStylePrefs(allKinds));
  const [lookupOpen, setLookupOpen] = React.useState(false);
  const [lookupAllowed] = React.useState(loadLookupAllowed);
  const [typewriter, setTypewriter] = React.useState(loadTypewriter);
  const toggleTypewriter = () => {
    setTypewriter((on) => {
      saveTypewriter(!on);
      return !on;
    });
  };
  const styleOn = stylePrefs.on;
  const styleKinds = stylePrefs.kinds as StyleKind[];
  const [styleReport, setStyleReport] = React.useState<Pick<StyleState, 'counts' | 'stats'> | null>(null);
  const styleStep = React.useRef(-1);

  const updateStylePrefs = (next: { on: boolean; kinds: string[] }) => {
    setStylePrefs(next);
    saveStylePrefs(next);
  };
  const toggleStyle = () => updateStylePrefs({ ...stylePrefs, on: !stylePrefs.on });
  const toggleKind = (kind: StyleKind) =>
    updateStylePrefs({ ...stylePrefs, kinds: stylePrefs.kinds.includes(kind) ? stylePrefs.kinds.filter((k) => k !== kind) : [...stylePrefs.kinds, kind] });

  const handleFontChange = (id: string) => {
    setFontId(id);
    saveEditorFont(id);
  };

  const { entities } = useApp();

  const suggestion: MentionOptions['suggestion'] = {
    items: ({ query }: { query: string }) => {
      return entities.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle, MentionListProps> | undefined;
      let popup: Instance[] | undefined;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          const rect = props.clientRect;
          popup = tippy('body', {
            // The caret's box can come back empty for a moment; an empty box keeps the list where it was
            getReferenceClientRect: () => rect() ?? new DOMRect(),
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'light-border',
          });
        },
        onUpdate(props) {
          component?.updateProps(props);
          if (!props.clientRect || !popup) return;
          const rect = props.clientRect;
          popup[0].setProps({
            getReferenceClientRect: () => rect() ?? new DOMRect(),
          });
        },
        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup?.[0].hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          if (popup) popup[0].destroy();
          if (component) component.destroy();
        },
      };
    },
  };

  const editor = useEditor({
    // The editor is made once the screen is on the page. Made earlier (while the screen is still being prepared), Tiptap
    // may throw it away a moment later, before it was ever shown.
    immediatelyRender: false,
    editable,
    extensions: [
      // Writing together keeps its own undo history, which only undoes this person's changes
      StarterKit.configure(live ? { undoRedo: false } : {}),
      Placeholder.configure({
        placeholder: t(placeholder),
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
      FindHighlight,
      CurrentBlock,
      StyleNotes,
      Typewriter,
      SpeakHighlight,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion,
      }),
      ...(live
        ? [
            Collaboration.configure({ document: live.ydoc }),
            CollaborationCaret.configure({ provider: { awareness: live.awareness }, user: live.user, render: renderCaret }),
          ]
        : []),
    ],
    // Writing together: the document comes from the others, or is filled once from the saved text (see onCreate)
    content: live ? undefined : content,
    onCreate: ({ editor: created }) => {
      if (live?.needsInit && content) live.fill(() => created.commands.setContent(content, { emitUpdate: false }), content);
    },
    editorProps: {
      attributes: {
        className: 'tiptap-body',
        // The browser underlines misspelled words; it knows nothing of your characters' names, so those may be marked too
        spellcheck: spell.check ? 'true' : 'false',
        ...(spell.lang ? { lang: spell.lang } : {}),
      },
      handleClick: (_view, _pos, event) => {
        const el = (event.target as HTMLElement | null)?.closest?.('[data-type="mention"]');
        const id = el?.getAttribute('data-id');
        if (id && mentionClick.current) {
          mentionClick.current(id);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync content when active chapter changes (but not on every keystroke to avoid cursor jumping)
  // Writing together has no such sync: the shared document is the truth, and a render that lags a moment behind it
  // must never put older text back over what someone else has just written
  useEffect(() => {
    if (live) return;
    if (editor && content !== editor.getHTML()) {
      // Only set content if it's vastly different (e.g., swapping chapters) to prevent cursor resets.
      // A simple heuristic: if lengths differ significantly or we just loaded a new chapter.
      // But Tiptap provides a better way: we only set if we haven't typed it.
      // Since `content` comes from props, we just check if it's not equal to what's inside.
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor, live]);

  // A restored version is put in the shared document as an ordinary change, so everyone sees it
  const lastReplace = React.useRef(0);
  useEffect(() => {
    if (!editor || !live || !replaceWith || replaceWith.nonce === lastReplace.current) return;
    lastReplace.current = replaceWith.nonce;
    editor.commands.setContent(replaceWith.html);
  }, [editor, live, replaceWith]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // Keep the highlighted matches in step with the find box
  const markMatches = React.useCallback(
    (term: string, current: number) => {
      if (!editor) return;
      editor.view.dispatch(editor.state.tr.setMeta(findKey, { term, current }));
      return findKey.getState(editor.state);
    },
    [editor]
  );

  // The match counter follows the editor itself, so it stays right while you type
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const st = findKey.getState(editor.state);
      const next = { count: st?.ranges.length || 0, current: st?.current || 0 };
      setMatchInfo((prev) => (prev.count === next.count && prev.current === next.current ? prev : next));
    };
    editor.on('transaction', sync);
    return () => {
      editor.off('transaction', sync);
    };
  }, [editor]);

  const scrollToMatch = React.useCallback(
    (state: ReturnType<typeof findKey.getState>) => {
      if (!editor || !state || state.ranges.length === 0) return;
      const { node } = editor.view.domAtPos(state.ranges[state.current].from);
      const el = node instanceof Element ? node : node.parentElement;
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const state = markMatches(showFindReplace ? findText : '', 0);
    if (jumpFirst.current && state && state.ranges.length > 0) {
      jumpFirst.current = false;
      scrollToMatch(state);
    }
  }, [editor, findText, showFindReplace, markMatches, scrollToMatch]);

  useEffect(() => {
    try {
      sessionStorage.removeItem(FIND_HANDOFF_KEY);
    } catch {
      // ignore
    }
  }, []);

  const stepMatch = (delta: number) => {
    const state = markMatches(findText, matchInfo.current + delta);
    scrollToMatch(state);
  };

  // Keep the counts above the page in step with the style notes. This listens first, so the update that turns the notes on is not missed.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const st = styleKey.getState(editor.state);
      if (!st || !st.enabled) {
        setStyleReport((prev) => (prev === null ? prev : null));
        return;
      }
      setStyleReport((prev) =>
        prev && JSON.stringify(prev.counts) === JSON.stringify(st.counts) && JSON.stringify(prev.stats) === JSON.stringify(st.stats)
          ? prev
          : { counts: st.counts, stats: st.stats }
      );
    };
    editor.on('transaction', sync);
    return () => {
      editor.off('transaction', sync);
    };
  }, [editor]);

  // Read aloud: the paragraphs of the chapter, and the one being read is marked on the page
  const speakBlocks = React.useRef<{ pos: number; size: number; text: string }[]>([]);
  const ra = useReadAloud({
    paragraphs: () => {
      const blocks: { pos: number; size: number; text: string }[] = [];
      editor?.state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        const text = node.textContent.trim();
        if (text) blocks.push({ pos, size: node.nodeSize, text });
        return false;
      });
      speakBlocks.current = blocks;
      return blocks.map((b) => b.text);
    },
    // From the paragraph the cursor is in
    startAt: () => {
      const head = editor?.state.selection.head ?? 0;
      return Math.max(0, speakBlocks.current.findIndex((b) => head <= b.pos + b.size));
    },
    onHighlight: (index) => {
      if (!editor || editor.isDestroyed) return;
      const block = index === null ? null : speakBlocks.current[index];
      editor.view.dispatch(editor.state.tr.setMeta(speakKey, { pos: block ? block.pos : null }));
      if (block) (editor.view.nodeDOM(block.pos) as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    },
    lang: spell.lang ? spell.lang.slice(0, 2) : undefined,
  });
  // Writing while it reads would move the paragraphs under it, so any change stops the reading
  const raRef = React.useRef(ra);
  useEffect(() => {
    raRef.current = ra;
  });
  useEffect(() => {
    if (!editor) return;
    const stopOnEdit = () => {
      if (raRef.current.state !== 'idle') raRef.current.stop();
    };
    editor.on('update', stopOnEdit);
    return () => {
      editor.off('update', stopOnEdit);
    };
  }, [editor]);

  // Typewriter scrolling follows the toolbar button
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(typewriterKey, { enabled: typewriter }));
  }, [editor, typewriter]);

  // Turn the style notes on or off in the editor
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(styleKey, { enabled: styleOn, kinds: styleKinds }));
  }, [editor, styleOn, styleKinds]);

  const stepStyle = () => {
    if (!editor) return;
    const st = styleKey.getState(editor.state);
    if (!st || st.issues.length === 0) return;
    styleStep.current = (styleStep.current + 1) % st.issues.length;
    const issue = st.issues[styleStep.current];
    editor.chain().focus().setTextSelection({ from: issue.pos, to: issue.pos + (issue.to - issue.from) }).scrollIntoView().run();
  };

  // Another part of the app (reader feedback) can ask the editor to find a passage
  useEffect(
    () =>
      onRequestFind((term) => {
        jumpFirst.current = true;
        setFindText(term);
        setShowFindReplace(true);
      }),
    []
  );

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    // Replace from the end so earlier positions stay valid
    const ranges = findRanges(editor.state.doc, findText).filter((r) => !r.atom).reverse();
    if (ranges.length === 0) return;
    let tr = editor.state.tr;
    for (const r of ranges) {
      tr = replaceText ? tr.replaceWith(r.from, r.to, editor.schema.text(replaceText)) : tr.delete(r.from, r.to);
    }
    editor.view.dispatch(tr);
  };

  return (
    <>
      {editable && <MenuBar editor={editor} onToggleFindReplace={() => setShowFindReplace(!showFindReplace)} fontId={fontId} onFontChange={handleFontChange} styleOn={styleOn} onToggleStyle={toggleStyle} typewriterOn={typewriter} onToggleTypewriter={toggleTypewriter} canListen={ra.supported} listening={ra.state !== 'idle'} onToggleListen={ra.state === 'idle' ? ra.start : ra.stop} canLookup={lookupAllowed} lookupOn={lookupOpen} onToggleLookup={() => setLookupOpen((v) => !v)} />}

      {styleOn && (
        <div className="style-bar" role="region" aria-label={t('Style notes')}>
          <div className="chips">
            {STYLE_KINDS.map((k) => (
              <button
                key={k.id}
                className="chip"
                aria-pressed={styleKinds.includes(k.id)}
                title={t('{hint} Click to show or hide.', { hint: t(k.hint) })}
                onClick={() => toggleKind(k.id)}
              >
                <span className={`style-dot style-dot-${k.id}`} aria-hidden="true" />
                {t(k.label)}
                <b>{styleReport ? styleReport.counts[k.id] : 0}</b>
              </button>
            ))}
          </div>
          <div className="style-meta">
            {styleReport && (
              <>
                <span>{t('Average sentence {n} words', { n: styleReport.stats.avgSentence })}</span>
                <span>{t('Longest {n}', { n: styleReport.stats.longest })}</span>
                <span>{t('Dialogue {n}%', { n: styleReport.stats.dialogue })}</span>
              </>
            )}
            <button className="small-btn" onClick={stepStyle}>{t('Next note')}</button>
          </div>
        </div>
      )}

      {showFindReplace && (
        <div className="find-bar">
          <input
            className="input"
            type="text"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder={t('Find…')}
            aria-label={t('Find')}
            autoFocus={!handoff}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              }
            }}
          />
          <span className="meta" role="status" aria-live="polite" style={{ minWidth: 70 }}>
            {findText ? (matchInfo.count === 0 ? t('No matches') : t('{current} of {count}', { current: matchInfo.current + 1, count: matchInfo.count })) : ''}
          </span>
          <button className="small-btn" onClick={() => stepMatch(-1)} disabled={matchInfo.count === 0}>{t('Previous')}</button>
          <button className="small-btn" onClick={() => stepMatch(1)} disabled={matchInfo.count === 0}>{t('Next')}</button>
          <input
            className="input"
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder={t('Replace with…')}
            aria-label={t('Replace with')}
          />
          <button className="small-btn is-primary" onClick={handleReplaceAll} disabled={!findText}>
            {t('Replace all')}
          </button>
        </div>
      )}

      {lookupOpen && editor && <LookupPanel editor={editor} onClose={() => setLookupOpen(false)} />}
      <ReadAloudBar ra={ra} />

      <div className="studio-view writing-view">
        <article className="writing-paper">
          {header}
          <div
            className={`manuscript-editor novel-editor${typewriter ? ' typewriter-on' : ''}`}
            style={{ fontFamily: getEditorFontFamily(fontId) }}
          >
            <EditorContent editor={editor} />
          </div>
          <div className="paper-end" aria-hidden="true">∗</div>
        </article>
      </div>
    </>
  );
};
