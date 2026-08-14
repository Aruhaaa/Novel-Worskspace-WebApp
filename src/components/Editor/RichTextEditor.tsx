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
  Search
} from 'lucide-react';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import MentionList from './MentionList';
import { useApp } from '../../context/AppContext';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MenuBar = ({ editor, onToggleFindReplace }: { editor: any, onToggleFindReplace: () => void }) => {
  if (!editor) {
    return null;
  }

  const toggleBtnClass = (isActive: boolean) => 
    `p-2 rounded hover:bg-slate-800 transition-colors ${isActive ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400'}`;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-10 rounded-t-lg">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={toggleBtnClass(editor.isActive('bold'))}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={toggleBtnClass(editor.isActive('italic'))}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-800 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={toggleBtnClass(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={toggleBtnClass(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-800 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={toggleBtnClass(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={toggleBtnClass(editor.isActive('orderedList'))}
        title="Ordered List"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={toggleBtnClass(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-800 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={toggleBtnClass(editor.isActive({ textAlign: 'left' }))}
        title="Align Left"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={toggleBtnClass(editor.isActive({ textAlign: 'center' }))}
        title="Align Center"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={toggleBtnClass(editor.isActive({ textAlign: 'right' }))}
        title="Align Right"
      >
        <AlignRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        className={toggleBtnClass(editor.isActive({ textAlign: 'justify' }))}
        title="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-800 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={toggleBtnClass(editor.isActive('highlight'))}
        title="Highlight"
      >
        <Highlighter className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="p-2 rounded hover:bg-slate-800 text-slate-400 transition-colors"
        title="Insert Scene Separator"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-800 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="p-2 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-50 transition-colors"
        title="Undo"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="p-2 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-50 transition-colors"
        title="Redo"
      >
        <Redo className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-800 mx-1"></div>

      <button
        type="button"
        onClick={onToggleFindReplace}
        className="p-2 rounded hover:bg-slate-800 text-slate-400 transition-colors"
        title="Find & Replace"
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder = 'Write your story here...' }) => {
  const [showFindReplace, setShowFindReplace] = React.useState(false);
  const [findText, setFindText] = React.useState('');
  const [replaceText, setReplaceText] = React.useState('');

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
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-indigo-500/20 text-indigo-400 font-semibold px-1 rounded cursor-pointer hover:bg-indigo-500/30 transition-colors',
        },
        suggestion,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        className: 'prose prose-slate dark:prose-invert prose-lg max-w-none focus:outline-none min-h-[500px] p-6',
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

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    
    let tr = editor.state.tr;
    let modified = false;
    
    // Collect all text nodes
    const nodes: {node: any, pos: number}[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        nodes.push({ node, pos });
      }
    });

    // Iterate backwards so replacing doesn't shift positions of previous nodes we haven't processed yet
    for (let i = nodes.length - 1; i >= 0; i--) {
      const { node, pos } = nodes[i];
      const text = node.text || '';
      
      let matchIndex = text.lastIndexOf(findText);
      while (matchIndex !== -1) {
        tr = tr.replaceWith(
          pos + matchIndex,
          pos + matchIndex + findText.length,
          editor.schema.text(replaceText)
        );
        modified = true;
        matchIndex = text.lastIndexOf(findText, matchIndex - 1);
      }
    }

    if (modified) {
      editor.view.dispatch(tr);
    }
  };

  return (
    <div className="flex flex-col border border-slate-800 rounded-lg bg-slate-950/50 shadow-inner overflow-hidden">
      <MenuBar editor={editor} onToggleFindReplace={() => setShowFindReplace(!showFindReplace)} />
      
      {showFindReplace && (
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3 text-sm">
          <input 
            type="text" 
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find..." 
            className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
          />
          <input 
            type="text" 
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with..." 
            className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
          />
          <button 
            onClick={handleReplaceAll}
            disabled={!findText}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            Replace All
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
