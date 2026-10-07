/**
 * Makes manuscript HTML safe to show to someone else. A reading link puts one writer's text in front of strangers,
 * so nothing but plain writing is allowed through: paragraphs, headings, emphasis, lists, quotes and links.
 * Scripts, frames, forms, event handlers, styles and unknown tags are removed.
 */
const ALLOWED = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'span', 'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'sub', 'sup',
]);
// Removed together with everything inside them
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'template', 'noscript', 'audio', 'video', 'img', 'picture', 'canvas']);

const SAFE_ALIGN = /^\s*text-align:\s*(left|right|center|justify)\s*;?\s*$/i;
const SAFE_URL = /^(https?:|mailto:)/i;

const clean = (node: Node, out: Document): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) return out.createTextNode(node.nodeValue || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP.has(tag)) return null;

  if (!ALLOWED.has(tag)) {
    // Unknown tag: keep what is written inside it, lose the tag
    const frag = out.createDocumentFragment();
    el.childNodes.forEach((child) => {
      const kept = clean(child, out);
      if (kept) frag.appendChild(kept);
    });
    return frag;
  }

  const copy = out.createElement(tag);
  const style = el.getAttribute('style');
  if (style && SAFE_ALIGN.test(style)) copy.setAttribute('style', style.trim());
  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    if (SAFE_URL.test(href)) {
      copy.setAttribute('href', href);
      copy.setAttribute('rel', 'noopener noreferrer nofollow');
      copy.setAttribute('target', '_blank');
    }
  }
  // A mention is shown as its text, styled, but carries none of its data
  if (tag === 'span' && el.getAttribute('data-type') === 'mention') copy.setAttribute('class', 'mention');
  el.childNodes.forEach((child) => {
    const kept = clean(child, out);
    if (kept) copy.appendChild(kept);
  });
  return copy;
};

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const out = document.implementation.createHTMLDocument('');
  const wrapper = out.createElement('div');
  parsed.body.childNodes.forEach((child) => {
    const kept = clean(child, out);
    if (kept) wrapper.appendChild(kept);
  });
  return wrapper.innerHTML;
};
