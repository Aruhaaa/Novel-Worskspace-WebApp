import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addMyComment, deleteMyComment, getSharedManuscript, listMyComments, refusalMessage, type LinkComment, type SharedManuscript } from '../../lib/share';
import { sanitizeHtml } from '../../lib/sanitize';
import { Dialog } from '../ui/Dialog';

/**
 * The page a beta reader opens from a private link. No account needed: the secret in the link is their key.
 * They read the manuscript and comment on passages or chapters. The writer sees the comments.
 */
type Load = { state: 'loading' } | { state: 'ready'; data: SharedManuscript } | { state: 'gone' } | { state: 'setup' } | { state: 'offline' };

interface Identity {
  key: string;
  name: string;
}

const identityKey = (token: string) => `novelist_reader_${token.slice(0, 16)}`;

const loadIdentity = (token: string): Identity => {
  try {
    const saved = JSON.parse(localStorage.getItem(identityKey(token)) || 'null');
    if (saved && typeof saved.key === 'string') return { key: saved.key, name: typeof saved.name === 'string' ? saved.name : '' };
  } catch {
    // make a new one
  }
  const fresh = { key: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`, name: '' };
  try {
    localStorage.setItem(identityKey(token), JSON.stringify(fresh));
  } catch {
    // the page still works
  }
  return fresh;
};

interface Pending {
  chapterId: string;
  quote: string;
}

export const SharedReaderView: React.FC = () => {
  const { token = '' } = useParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [identity, setIdentity] = useState<Identity>(() => loadIdentity(token));
  const [mine, setMine] = useState<LinkComment[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pop, setPop] = useState<{ top: number; left: number } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bookRef = useRef<HTMLDivElement>(null);
  const selection = useRef<Pending | null>(null);

  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getSharedManuscript(token);
      if (!alive) return;
      if (!res.ok) return setLoad({ state: res.reason === 'setup' ? 'setup' : res.reason === 'network' ? 'offline' : 'gone' });
      if (!res.value) return setLoad({ state: 'gone' });
      setLoad({ state: 'ready', data: res.value });
      const mineRes = await listMyComments(token, identityRef.current.key);
      if (alive && mineRes.ok) setMine(mineRes.value);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const chapters = useMemo(
    () =>
      load.state === 'ready'
        ? [...load.data.chapters].sort((a, b) => a.position - b.position).map((c) => ({ ...c, html: sanitizeHtml(c.content) }))
        : [],
    [load]
  );
  const titleOf = useCallback((id: string) => chapters.find((c) => c.id === id)?.title || '', [chapters]);

  // A "Comment" button beside selected words
  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    const root = bookRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) {
      selection.current = null;
      setPop(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const sectionOf = (n: Node | null): HTMLElement | null => {
      let el: Node | null = n;
      while (el && el !== root) {
        if (el.nodeType === 1 && (el as HTMLElement).dataset?.chapter) return el as HTMLElement;
        el = el.parentNode;
      }
      return null;
    };
    const a = sectionOf(range.startContainer);
    const b = sectionOf(range.endContainer);
    const text = sel.toString().trim();
    if (!a || a !== b || !text) {
      selection.current = null;
      setPop(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    selection.current = { chapterId: a.dataset.chapter || '', quote: text.slice(0, 600) };
    setPop({ top: Math.max(8, rect.top - 44), left: Math.max(8, Math.min(rect.left, window.innerWidth - 120)) });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', checkSelection);
    window.addEventListener('scroll', checkSelection, true);
    return () => {
      document.removeEventListener('selectionchange', checkSelection);
      window.removeEventListener('scroll', checkSelection, true);
    };
  }, [checkSelection]);

  const openComment = (p: Pending) => {
    setPending(p);
    setNote('');
    setError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    if (!identity.name.trim()) {
      setError('Please add your name first, so the writer knows who the comment is from.');
      return;
    }
    if (!note.trim()) return;
    setBusy(true);
    setError('');
    const res = await addMyComment(token, identity.key, identity.name.trim(), pending.chapterId, pending.quote, note.trim());
    setBusy(false);
    if (res.ok) {
      setMine((prev) => [...prev, res.value]);
      setPending(null);
      window.getSelection()?.removeAllRanges();
    } else {
      setError(res.reason === 'network' ? 'You seem to be offline. Your comment was not sent. Try again when you are back online.' : refusalMessage(res.error));
    }
  };

  const remove = async (c: LinkComment) => {
    if (!window.confirm('Delete this comment?')) return;
    const res = await deleteMyComment(token, identity.key, c.id);
    if (res.ok) setMine((prev) => prev.filter((x) => x.id !== c.id));
  };

  const changeName = (name: string) => {
    const next = { ...identity, name };
    setIdentity(next);
    try {
      localStorage.setItem(identityKey(token), JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Show where a comment was made by selecting those words in the text
  const show = (c: LinkComment) => {
    const section = bookRef.current?.querySelector(`[data-chapter="${CSS.escape(c.chapterId)}"]`);
    if (!section) return;
    if (c.quote) {
      const needle = c.quote.slice(0, 80);
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const at = (node.nodeValue || '').indexOf(needle);
        if (at !== -1) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, Math.min((node.nodeValue || '').length, at + c.quote.length));
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          (node.parentElement || (section as HTMLElement)).scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
      }
    }
    section.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  if (load.state === 'loading') {
    return (
      <div className="shared-reader">
        <p className="meta" role="status" style={{ padding: 40 }}>Opening the manuscript…</p>
      </div>
    );
  }

  if (load.state !== 'ready') {
    const text =
      load.state === 'offline'
        ? 'Could not reach the server. Check your connection and try again.'
        : load.state === 'setup'
          ? 'Reading links are not switched on for this site yet.'
          : 'This reading link is not active. It may have been turned off, or the address is incomplete. Ask the writer for a new one.';
    return (
      <div className="shared-reader">
        <div className="shared-card">
          <p className="eyebrow">A READING COPY</p>
          <h1>This link cannot be opened</h1>
          <p>{text}</p>
        </div>
      </div>
    );
  }

  const { project } = load.data;
  return (
    <div className="shared-reader">
      <header className="shared-top">
        <p className="eyebrow">A READING COPY</p>
        <h1>{project.title}</h1>
        {project.author_name && <p className="meta">by {project.author_name}</p>}
        <p className="how">
          Thank you for reading. Select any passage and choose <strong>Comment</strong>, or use “Comment on this chapter”. The writer will see what you write. You do not need an account.
        </p>
        <label className="shared-name">
          <span>Your name</span>
          <input className="input" value={identity.name} onChange={(e) => changeName(e.target.value)} placeholder="e.g. Sam" autoComplete="name" maxLength={80} />
        </label>
      </header>

      <div className="shared-layout">
        <main ref={bookRef}>
          {chapters.map((c, i) => (
            <section className="shared-chapter" data-chapter={c.id} key={c.id}>
              <div className="shared-chapter-head">
                <span className="num">CHAPTER {String(i + 1).padStart(2, '0')}</span>
                <button className="small-btn" onClick={() => openComment({ chapterId: c.id, quote: '' })}>Comment on this chapter</button>
              </div>
              <h2>{c.title || 'Untitled chapter'}</h2>
              <div className="shared-prose" dangerouslySetInnerHTML={{ __html: c.html || '<p class="meta">This chapter is empty.</p>' }} />
            </section>
          ))}
        </main>

        <aside className="shared-panel" aria-label="Your comments">
          <h2>Your comments</h2>
          <p className="meta" role="status">{mine.length === 0 ? 'None yet.' : `${mine.length} ${mine.length === 1 ? 'comment' : 'comments'}`}</p>
          {mine.map((c) => (
            <div className="shared-note" key={c.id}>
              <small>{titleOf(c.chapterId) || c.chapterTitle}</small>
              {c.quote && <q>{c.quote.length > 140 ? `${c.quote.slice(0, 137)}…` : c.quote}</q>}
              <p>{c.note}</p>
              <button className="link-accent" onClick={() => show(c)}>Show</button>
              <button className="link-accent" onClick={() => remove(c)}>Delete</button>
            </div>
          ))}
        </aside>
      </div>

      {pop && (
        <button
          className="small-btn is-primary shared-pop"
          style={{ top: pop.top, left: pop.left }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (selection.current) openComment(selection.current);
            setPop(null);
          }}
        >
          Comment
        </button>
      )}

      <Dialog open={!!pending} onClose={() => setPending(null)} labelledBy="sr-h">
        {pending && (
          <form onSubmit={save}>
            <p className="eyebrow">{pending.quote ? 'COMMENT ON THIS PASSAGE' : 'COMMENT ON THE CHAPTER'}</p>
            <h2 id="sr-h">{titleOf(pending.chapterId) || 'Chapter'}</h2>
            {pending.quote && <blockquote className="shared-quote">{pending.quote}</blockquote>}
            {!identity.name.trim() && (
              <>
                <label htmlFor="sr-name">Your name</label>
                <input id="sr-name" value={identity.name} onChange={(e) => changeName(e.target.value)} placeholder="e.g. Sam" maxLength={80} />
              </>
            )}
            <label htmlFor="sr-note">Your comment</label>
            <textarea id="sr-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you think? What confused you, moved you, or pulled you out of the story?" maxLength={5000} required autoFocus />
            {error && <p className="meta" role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="button button-outline button-small" onClick={() => setPending(null)}>Cancel</button>
              <button className="button button-primary button-small" disabled={busy}>{busy ? 'Sending…' : 'Send comment'}</button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};
