import type { Chapter, Project } from '../services/types';
import { downloadBlob } from './exportFormats';
import { FEEDBACK_FORMAT } from '../lib/feedback';

/**
 * A "beta-reader copy": one self-contained web page holding the manuscript. A reader opens it in any browser,
 * selects a passage to comment on it, and sends back a small feedback file. Nothing is uploaded anywhere, and it
 * works offline. The writer imports the file in the app (see lib/feedback.ts).
 */
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The two Unicode line separators are not allowed inside a JavaScript string in older engines
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), 'g');
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), 'g');

/** JSON that is safe to place inside a <script> element. */
const scriptJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(LINE_SEP, '\\u2028').replace(PARA_SEP, '\\u2029');

const STYLE = `
:root{--paper:#fbf9f4;--ink:#25241f;--muted:#6f6d63;--line:#dcd8cc;--accent:#8a3b2a;--tint:#f1ede2;--mark:#f6e3a1}
@media (prefers-color-scheme:dark){:root{--paper:#1c1b18;--ink:#ece8dc;--muted:#a09c8e;--line:#37352e;--accent:#e0907a;--tint:#26241f;--mark:#5a4a1a}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.75 Georgia,'Times New Roman',serif}
header.top{max-width:1100px;margin:0 auto;padding:40px 24px 8px}
.kicker{font:600 11px/1 system-ui,sans-serif;letter-spacing:2px;color:var(--accent);margin:0 0 12px}
h1{font-size:42px;line-height:1.1;margin:0 0 6px;font-weight:400}
.by{color:var(--muted);margin:0 0 18px}
.how{font:14px/1.7 system-ui,sans-serif;color:var(--muted);max-width:640px}
.who{font:14px system-ui,sans-serif;margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.who input{font:inherit;padding:8px 12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:4px;min-width:220px}
.layout{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:40px;padding:0 24px 80px}
main{min-width:0}
section.chapter{padding:36px 0;border-top:1px solid var(--line)}
section.chapter>header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
section.chapter h2{font-size:30px;font-weight:400;margin:0 0 18px}
.num{font:600 11px system-ui,sans-serif;letter-spacing:1.6px;color:var(--muted)}
.chapter p{margin:0 0 1em}
.chapter hr{border:0;text-align:center;margin:1.6em 0}.chapter hr:before{content:'\\2217';color:var(--muted)}
.chapter blockquote{margin:1em 0;padding-left:1em;border-left:3px solid var(--line);color:var(--muted)}
.span-mention,[data-type=mention]{font-weight:inherit}
mark.note{background:var(--mark);color:inherit;border-radius:2px;cursor:pointer}
button{font:600 13px system-ui,sans-serif;padding:8px 14px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:4px;cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
button.link{border:0;background:none;color:var(--accent);padding:2px 4px;font-weight:500}
aside{font:14px/1.6 system-ui,sans-serif;position:sticky;top:20px;align-self:start;max-height:calc(100vh - 40px);overflow:auto;border:1px solid var(--line);border-radius:6px;padding:18px;background:var(--tint)}
aside h3{margin:0 0 4px;font-size:15px}
aside .count{color:var(--muted);margin:0 0 14px}
.note-item{border-top:1px solid var(--line);padding:12px 0}
.note-item .where{font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase}
.note-item q{display:block;font:italic 14px/1.5 Georgia,serif;margin:4px 0;color:var(--muted)}
.note-item p{margin:4px 0 6px;white-space:pre-wrap}
#pop{position:absolute;z-index:20;box-shadow:0 6px 20px #0003}
dialog{border:1px solid var(--line);border-radius:8px;padding:22px;background:var(--paper);color:var(--ink);width:min(480px,calc(100% - 32px))}
dialog::backdrop{background:#0006}
dialog h2{margin:0 0 8px;font:600 18px system-ui,sans-serif}
dialog blockquote{font:italic 14px/1.5 Georgia,serif;color:var(--muted);margin:0 0 12px;max-height:110px;overflow:auto}
dialog textarea{width:100%;min-height:110px;font:15px/1.6 system-ui,sans-serif;padding:10px;border:1px solid var(--line);border-radius:4px;background:var(--paper);color:var(--ink)}
.row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
.empty{color:var(--muted)}
@media (max-width:860px){.layout{grid-template-columns:1fr}aside{position:static;max-height:none}h1{font-size:32px}}
`;

const SCRIPT = `
(function(){
  var data = JSON.parse(document.getElementById('data').textContent);
  var KEY = 'novelist-beta:' + data.projectId + ':' + data.stamp;
  var state = { reader: '', comments: [] };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && saved.comments) state = saved; } catch (e) {}
  function persist(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var order = {}; data.chapters.forEach(function(c, i){ order[c.id] = i; });
  var book = document.getElementById('book'), list = document.getElementById('list'), count = document.getElementById('count');
  var pop = document.getElementById('pop'), dlg = document.getElementById('dlg'), quoteEl = document.getElementById('quote'), noteEl = document.getElementById('note'), whereEl = document.getElementById('where');
  var reader = document.getElementById('reader'); reader.value = state.reader || '';
  reader.addEventListener('input', function(){ state.reader = reader.value; persist(); });
  var pending = null, editing = null;

  function chapterOf(node){ while (node && node !== book) { if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-chapter')) return node; node = node.parentNode; } return null; }
  function newId(){ return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function titleOf(id){ var c = data.chapters[order[id]]; return c ? c.title : ''; }

  // Show a Comment button next to a selected passage
  function checkSelection(){
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { pop.hidden = true; return; }
    var range = sel.getRangeAt(0), a = chapterOf(range.startContainer), b = chapterOf(range.endContainer);
    var text = sel.toString().trim();
    if (!a || a !== b || !text) { pop.hidden = true; return; }
    var rect = range.getBoundingClientRect();
    pop.hidden = false;
    pop.style.top = (window.scrollY + rect.top - 44) + 'px';
    pop.style.left = Math.max(8, window.scrollX + rect.left) + 'px';
    pending = { chapterId: a.getAttribute('data-chapter'), quote: text.slice(0, 600) };
  }
  document.addEventListener('selectionchange', checkSelection);
  pop.addEventListener('mousedown', function(e){ e.preventDefault(); });
  pop.addEventListener('click', function(){ openDialog(pending, null); pop.hidden = true; });

  function openDialog(p, existing){
    if (!p) return;
    pending = p; editing = existing;
    quoteEl.textContent = p.quote || ''; quoteEl.hidden = !p.quote;
    whereEl.textContent = (p.quote ? 'Comment on this passage' : 'Comment on the chapter') + ' \\u2014 ' + titleOf(p.chapterId);
    noteEl.value = existing ? existing.note : '';
    dlg.showModal(); noteEl.focus();
  }
  document.getElementById('cancel').addEventListener('click', function(){ dlg.close(); });
  document.getElementById('form').addEventListener('submit', function(e){
    e.preventDefault();
    var note = noteEl.value.trim(); if (!note) return;
    if (editing) { editing.note = note; }
    else {
      var c = { id: newId(), chapterId: pending.chapterId, chapterTitle: titleOf(pending.chapterId), quote: pending.quote, note: note, createdAt: new Date().toISOString() };
      state.comments.push(c); highlight(c);
    }
    persist(); dlg.close(); renderList();
    var s = window.getSelection(); if (s) s.removeAllRanges();
  });

  // Wrap the commented words in a highlight when they sit inside one piece of text
  function highlight(c){
    if (!c.quote) return;
    var section = book.querySelector('[data-chapter="' + c.chapterId + '"]'); if (!section) return;
    var walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, null), node;
    var needle = c.quote.length > 120 ? c.quote.slice(0, 120) : c.quote;
    while ((node = walker.nextNode())) {
      var at = node.nodeValue.indexOf(needle);
      if (at === -1) continue;
      try {
        var r = document.createRange(); r.setStart(node, at); r.setEnd(node, at + needle.length);
        var m = document.createElement('mark'); m.className = 'note'; m.setAttribute('data-cid', c.id);
        r.surroundContents(m);
        m.addEventListener('click', function(){ var el = list.querySelector('[data-id="' + this.getAttribute('data-cid') + '"]'); if (el) el.scrollIntoView({ block: 'center' }); });
      } catch (e) {}
      return;
    }
  }

  function renderList(){
    list.textContent = '';
    var items = state.comments.slice().sort(function(a, b){ return (order[a.chapterId] || 0) - (order[b.chapterId] || 0) || a.createdAt.localeCompare(b.createdAt); });
    count.textContent = items.length === 0 ? 'No comments yet.' : items.length + (items.length === 1 ? ' comment' : ' comments');
    items.forEach(function(c){
      var li = document.createElement('div'); li.className = 'note-item'; li.setAttribute('data-id', c.id);
      var w = document.createElement('div'); w.className = 'where'; w.textContent = titleOf(c.chapterId) || c.chapterTitle; li.appendChild(w);
      if (c.quote) { var q = document.createElement('q'); q.textContent = c.quote.length > 160 ? c.quote.slice(0, 157) + '\\u2026' : c.quote; li.appendChild(q); }
      var p = document.createElement('p'); p.textContent = c.note; li.appendChild(p);
      var go = document.createElement('button'); go.className = 'link'; go.textContent = 'Show'; go.addEventListener('click', function(){ var m = book.querySelector('mark[data-cid="' + c.id + '"]'); (m || book.querySelector('[data-chapter="' + c.chapterId + '"]')).scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      var ed = document.createElement('button'); ed.className = 'link'; ed.textContent = 'Edit'; ed.addEventListener('click', function(){ openDialog({ chapterId: c.chapterId, quote: c.quote }, c); });
      var del = document.createElement('button'); del.className = 'link'; del.textContent = 'Delete'; del.addEventListener('click', function(){
        if (!confirm('Delete this comment?')) return;
        state.comments = state.comments.filter(function(x){ return x.id !== c.id; });
        var m = book.querySelector('mark[data-cid="' + c.id + '"]'); if (m) { var parent = m.parentNode; while (m.firstChild) parent.insertBefore(m.firstChild, m); parent.removeChild(m); parent.normalize(); }
        persist(); renderList();
      });
      if (c.quote) li.appendChild(go); li.appendChild(ed); li.appendChild(del);
      list.appendChild(li);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-whole]'), function(btn){
    btn.addEventListener('click', function(){ var id = btn.getAttribute('data-whole'); openDialog({ chapterId: id, quote: '' }, null); });
  });

  document.getElementById('save').addEventListener('click', function(){
    var name = (reader.value || '').trim();
    if (!name) { alert('Please add your name at the top first, so the writer knows who the feedback is from.'); reader.focus(); return; }
    if (state.comments.length === 0) { alert('You have not left any comments yet.'); return; }
    var out = { format: '${FEEDBACK_FORMAT}', version: 1, projectId: data.projectId, projectTitle: data.projectTitle, reader: name, createdAt: new Date().toISOString(), comments: state.comments };
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (data.projectTitle || 'manuscript').replace(/[^\\w\\- ]+/g, '').trim().replace(/\\s+/g, '-') + '-feedback-' + name.replace(/[^\\w\\-]+/g, '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  });

  state.comments.forEach(highlight); renderList();
})();
`;

/** The reading copy as one HTML document. */
export const buildBetaCopy = (project: Project, chapters: Chapter[]): string => {
  const sorted = [...chapters].sort((a, b) => a.position - b.position);
  const data = {
    projectId: project.id,
    projectTitle: project.title,
    stamp: new Date().toISOString().slice(0, 10),
    chapters: sorted.map((c) => ({ id: c.id, title: c.title || 'Untitled chapter' })),
  };
  const sections = sorted
    .map(
      (c, i) => `<section class="chapter" data-chapter="${escapeHtml(c.id)}">
<header><span class="num">CHAPTER ${String(i + 1).padStart(2, '0')}</span><button data-whole="${escapeHtml(c.id)}">Comment on this chapter</button></header>
<h2>${escapeHtml(c.title || 'Untitled chapter')}</h2>
${c.content || '<p class="empty">This chapter is empty.</p>'}
</section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(project.title)}: reading copy</title>
<style>${STYLE}</style>
</head>
<body>
<header class="top">
<p class="kicker">A READING COPY</p>
<h1>${escapeHtml(project.title)}</h1>
${project.author_name ? `<p class="by">by ${escapeHtml(project.author_name)}</p>` : ''}
<p class="how">Thank you for reading. Select any passage and choose <strong>Comment</strong> to leave a note, or use "Comment on this chapter". Your notes stay in this browser. When you are done, add your name and press <strong>Save my feedback</strong>, then send the file back to the writer. Nothing is uploaded.</p>
<div class="who"><label for="reader">Your name</label><input id="reader" autocomplete="name" placeholder="e.g. Sam"><button class="primary" id="save">Save my feedback</button></div>
</header>
<div class="layout">
<main id="book">
${sections}
</main>
<aside aria-label="Your comments"><h3>Your comments</h3><p class="count" id="count" role="status"></p><div id="list"></div></aside>
</div>
<button id="pop" class="primary" hidden>Comment</button>
<dialog id="dlg"><form id="form" method="dialog"><h2 id="where">Comment</h2><blockquote id="quote"></blockquote><textarea id="note" placeholder="What did you think? What confused you, moved you, or pulled you out of the story?" required></textarea><div class="row"><button type="button" id="cancel">Cancel</button><button class="primary">Save comment</button></div></form></dialog>
<script type="application/json" id="data">${scriptJson(data)}</script>
<script>${SCRIPT}</script>
</body>
</html>`;
};

export const exportBetaCopy = (project: Project, chapters: Chapter[]) => {
  const safe = project.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'manuscript';
  downloadBlob(new Blob([buildBetaCopy(project, chapters)], { type: 'text/html;charset=utf-8' }), `${safe}-reading-copy.html`);
};
