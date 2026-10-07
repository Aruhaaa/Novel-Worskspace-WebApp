import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
  SpellCheck
} from 'lucide-react';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import MentionList from './MentionList';
import { useApp } from '../../context/AppContext';
import { EDITOR_FONTS, loadEditorFont, saveEditorFont, getEditorFontFamily } from '../../lib/editorFonts';
import { CurrentBlock, FindHighlight, StyleNotes, findKey, findRanges, styleKey, type StyleState } from './editorExtensions';
import { FIND_HANDOFF_KEY, onRequestFind } from '../../lib/uiEvents';
import { STYLE_KINDS, type StyleKind } from '../../lib/style';
import { loadSpellPrefs, loadStylePrefs, saveStylePrefs } from '../../lib/spell';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** Rendered on the paper above the text (running head, chapter number, title) */
  header?: React.ReactNode;
  /** Called with the entry a clicked @mention points at (its id, or its name in older text) */
  onMentionClick?: (idOrName: string) => void;
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

const MenuBar = ({ editor, onToggleFindReplace, fontId, onFontChange, styleOn, onToggleStyle }: { editor: any, onToggleFindReplace: () => void, fontId: string, onFontChange: (id: string) => void, styleOn: boolean, onToggleStyle: () => void }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="tools" role="toolbar" aria-label="Formatting">
      <label className="sr-only" htmlFor="font-select">Writing font</label>
      <select
        id="font-select"
        className="select font-select"
        value={fontId}
        onChange={(e) => onFontChange(e.target.value)}
        title="Writing font"
      >
        {EDITOR_FONTS.map((font) => (
          <option key={font.id} value={font.id}>{font.label}</option>
        ))}
      </select>
      <span className="sep" />
      <Tool label="Bold" active={editor.isActive('bold')} disabled={!editor.can().chain().focus().toggleBold().run()} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
      <Tool label="Italic" active={editor.isActive('italic')} disabled={!editor.can().chain().focus().toggleItalic().run()} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
      <Tool label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></Tool>
      <Tool label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Tool>
      <span className="sep" />
      <Tool label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
      <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
      <Tool label="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
      <span className="sep" />
      <Tool label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft /></Tool>
      <Tool label="Align centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter /></Tool>
      <Tool label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight /></Tool>
      <Tool label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify /></Tool>
      <span className="sep" />
      <Tool label="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter /></Tool>
      <Tool label="Insert scene separator" onClick={() => editor.chain().focus().setHorizontalRule().run()}><MoreHorizontal /></Tool>
      <span className="sep" />
      <Tool label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo /></Tool>
      <Tool label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo /></Tool>
      <span className="sep" />
      <Tool label="Find and replace" onClick={onToggleFindReplace}><Search /></Tool>
      <Tool label="Style notes" active={styleOn} onClick={onToggleStyle}><SpellCheck /></Tool>
    </div>
  );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder = 'Every world begins somewhere…', header, onMentionClick }) => {
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

  const suggestion = {
    items: ({ query }: { query: string }) => {
      return entities.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
    },
    render: () => {
      let component: any;
      let popup: any;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'light-border',
          });
        },
        onUpdate(props: any) {
          component.updateProps(props);
          if (!props.clientRect) return;
          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },
        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }
          return component.ref?.onKeyDown(props);
        },
        onExit() {
          if (popup) popup[0].destroy();
          if (component) component.destroy();
        },
      };
    },
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
      FindHighlight,
      CurrentBlock,
      StyleNotes,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion,
      }),
    ],
    content,
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
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Only set content if it's vastly different (e.g., swapping chapters) to prevent cursor resets.
      // A simple heuristic: if lengths differ significantly or we just loaded a new chapter.
      // But Tiptap provides a better way: we only set if we haven't typed it.
      // Since `content` comes from props, we just check if it's not equal to what's inside.
      editor.commands.setContent(content, { emitUpdate: false } as any);
    }
  }, [content, editor]);

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
      <MenuBar editor={editor} onToggleFindReplace={() => setShowFindReplace(!showFindReplace)} fontId={fontId} onFontChange={handleFontChange} styleOn={styleOn} onToggleStyle={toggleStyle} />

      {styleOn && (
        <div className="style-bar" role="region" aria-label="Style notes">
          <div className="chips">
            {STYLE_KINDS.map((k) => (
              <button
                key={k.id}
                className="chip"
                aria-pressed={styleKinds.includes(k.id)}
                title={`${k.hint} Click to show or hide.`}
                onClick={() => toggleKind(k.id)}
              >
                <span className={`style-dot style-dot-${k.id}`} aria-hidden="true" />
                {k.label}
                <b>{styleReport ? styleReport.counts[k.id] : 0}</b>
              </button>
            ))}
          </div>
          <div className="style-meta">
            {styleReport && (
              <>
                <span>Average sentence {styleReport.stats.avgSentence} words</span>
                <span>Longest {styleReport.stats.longest}</span>
                <span>Dialogue {styleReport.stats.dialogue}%</span>
              </>
            )}
            <button className="small-btn" onClick={stepStyle}>Next note</button>
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
            placeholder="Find…"
            aria-label="Find"
            autoFocus={!handoff}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              }
            }}
          />
          <span className="meta" role="status" aria-live="polite" style={{ minWidth: 70 }}>
            {findText ? (matchInfo.count === 0 ? 'No matches' : `${matchInfo.current + 1} of ${matchInfo.count}`) : ''}
          </span>
          <button className="small-btn" onClick={() => stepMatch(-1)} disabled={matchInfo.count === 0}>Previous</button>
          <button className="small-btn" onClick={() => stepMatch(1)} disabled={matchInfo.count === 0}>Next</button>
          <input
            className="input"
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with…"
            aria-label="Replace with"
          />
          <button className="small-btn is-primary" onClick={handleReplaceAll} disabled={!findText}>
            Replace all
          </button>
        </div>
      )}

      <div className="studio-view writing-view">
        <article className="writing-paper">
          {header}
          <div
            className="manuscript-editor novel-editor"
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
