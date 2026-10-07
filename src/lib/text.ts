/** Plain text from the editor's HTML. */
export const htmlToText = (html: string): string =>
  (html || '')
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export const countWords = (html: string): number => {
  const text = htmlToText(html);
  return text ? text.split(' ').length : 0;
};

export const readMinutes = (words: number): string => {
  if (words < 200) return 'Less than 1 min read';
  return `${Math.max(1, Math.round(words / 200))} min read`;
};
