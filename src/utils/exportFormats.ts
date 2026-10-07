import JSZip from 'jszip';
import type { Project, Chapter, WikiEntity, WordCountLog } from '../services/types';
import { htmlToText } from '../lib/text';

const sorted = (chapters: Chapter[]) => [...chapters].sort((a, b) => a.position - b.position);

const safeName = (title: string) => (title || 'novel').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'novel';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const parseHtml = (html: string): HTMLElement => new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html').body;

// ---------------------------------------------------------------- plain text

export const exportText = (project: Project, chapters: Chapter[]) => {
  const parts: string[] = [project.title.toUpperCase()];
  if (project.author_name) parts.push(`by ${project.author_name}`);
  sorted(chapters).forEach((chapter, i) => {
    parts.push('\n\n' + `Chapter ${i + 1}: ${chapter.title || 'Untitled'}`);
    const body = parseHtml(chapter.content);
    const blocks: string[] = [];
    body.childNodes.forEach((node) => {
      if (node.nodeName === 'HR') blocks.push('* * *');
      else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        const items: string[] = [];
        (node as HTMLElement).querySelectorAll('li').forEach((li, n) => items.push(`${node.nodeName === 'OL' ? `${n + 1}.` : '-'} ${li.textContent}`));
        blocks.push(items.join('\n'));
      } else {
        const text = (node.textContent || '').trim();
        if (text) blocks.push(text);
      }
    });
    parts.push('\n' + blocks.join('\n\n'));
  });
  downloadBlob(new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' }), `${safeName(project.title)}.txt`);
};

// ---------------------------------------------------------------- Word (.docx)

interface RunFormat {
  bold?: boolean;
  italic?: boolean;
  highlight?: boolean;
}

const runXml = (text: string, f: RunFormat) => {
  const props = `${f.bold ? '<w:b/>' : ''}${f.italic ? '<w:i/>' : ''}${f.highlight ? '<w:highlight w:val="yellow"/>' : ''}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
};

const inlineRuns = (node: Node, f: RunFormat = {}): string => {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) out += runXml(child.textContent, f);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (tag === 'BR') out += '<w:r><w:br/></w:r>';
      else {
        out += inlineRuns(el, {
          bold: f.bold || tag === 'STRONG' || tag === 'B',
          italic: f.italic || tag === 'EM' || tag === 'I',
          highlight: f.highlight || tag === 'MARK',
        });
      }
    }
  });
  return out;
};

const alignOf = (el: HTMLElement): string => {
  const a = el.style?.textAlign;
  return a === 'center' ? '<w:jc w:val="center"/>' : a === 'right' ? '<w:jc w:val="right"/>' : a === 'justify' ? '<w:jc w:val="both"/>' : '';
};

const paragraph = (inner: string, opts: { style?: string; align?: string; indent?: string; pageBreakBefore?: boolean } = {}) => {
  const props = `${opts.style ? `<w:pStyle w:val="${opts.style}"/>` : ''}${opts.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}${opts.indent || ''}${opts.align || ''}`;
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${inner}</w:p>`;
};

const blockToDocx = (node: Node, indentFirst = true): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').trim();
    return text ? paragraph(runXml(text, {})) : '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  switch (el.tagName) {
    case 'H1':
    case 'H2':
    case 'H3':
      return paragraph(inlineRuns(el), { style: el.tagName === 'H1' ? 'Heading2' : 'Heading3', align: alignOf(el) });
    case 'HR':
      return paragraph(runXml('* * *', {}), { align: '<w:jc w:val="center"/>' });
    case 'UL':
    case 'OL': {
      let n = 0;
      let out = '';
      el.querySelectorAll(':scope > li').forEach((li) => {
        n += 1;
        const bullet = el.tagName === 'OL' ? `${n}.\t` : '•\t';
        out += paragraph(runXml(bullet, {}) + inlineRuns(li), { indent: '<w:ind w:left="720" w:hanging="360"/>' });
      });
      return out;
    }
    case 'BLOCKQUOTE': {
      let out = '';
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          out += paragraph(inlineRuns(child), { indent: '<w:ind w:left="720" w:right="720"/>', align: alignOf(child as HTMLElement) });
        }
      });
      return out;
    }
    default:
      return paragraph(inlineRuns(el), {
        align: alignOf(el),
        indent: indentFirst && !alignOf(el) ? '<w:ind w:firstLine="480"/>' : '',
      });
  }
};

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault>
  <w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="3600" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:jc w:val="center"/><w:spacing w:before="480" w:after="480"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
</w:styles>`;

export const exportDocx = async (project: Project, chapters: Chapter[]) => {
  let body = paragraph(runXml(project.title, {}), { style: 'Title' });
  if (project.author_name) body += paragraph(runXml(`by ${project.author_name}`, {}), { style: 'Subtitle' });

  sorted(chapters).forEach((chapter, i) => {
    body += paragraph(runXml(`Chapter ${i + 1}: ${chapter.title || 'Untitled'}`, {}), { style: 'Heading1', pageBreakBefore: true });
    parseHtml(chapter.content).childNodes.forEach((node) => {
      body += blockToDocx(node);
    });
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', DOCX_STYLES);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
  downloadBlob(blob, `${safeName(project.title)}.docx`);
};

// ---------------------------------------------------------------- EPUB

const toXhtml = (html: string): string => {
  const body = parseHtml(html);
  body.querySelectorAll('mark').forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
  const serializer = new XMLSerializer();
  let out = '';
  body.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) out += `<p>${escapeXml(t)}</p>`;
    } else {
      out += serializer.serializeToString(node).replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
    }
  });
  return out;
};

const xhtmlPage = (title: string, inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${inner}</body></html>`;

export const exportEpub = async (project: Project, chapters: Chapter[]) => {
  const list = sorted(chapters);
  const id = `urn:uuid:${crypto.randomUUID()}`;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file('OEBPS/style.css', `body { font-family: Georgia, serif; line-height: 1.6; margin: 5%; }
h1 { text-align: center; margin: 2.5em 0 1.5em; }
p { margin: 0; text-indent: 1.4em; text-align: justify; }
.title-page { text-align: center; margin-top: 30%; } .title-page p { text-indent: 0; text-align: center; }
hr { border: 0; text-align: center; margin: 1.5em 0; } hr::after { content: "* * *"; }
blockquote { margin: 1em 2em; font-style: italic; }`);

  zip.file('OEBPS/title.xhtml', xhtmlPage(project.title, `<div class="title-page"><h1>${escapeXml(project.title)}</h1>${project.author_name ? `<p>by ${escapeXml(project.author_name)}</p>` : ''}</div>`));
  list.forEach((c, i) => {
    zip.file(`OEBPS/chapter-${i + 1}.xhtml`, xhtmlPage(c.title || `Chapter ${i + 1}`, `<h1>Chapter ${i + 1}: ${escapeXml(c.title || 'Untitled')}</h1>${toXhtml(c.content)}`));
  });

  const navItems = list.map((c, i) => `<li><a href="chapter-${i + 1}.xhtml">Chapter ${i + 1}: ${escapeXml(c.title || 'Untitled')}</a></li>`).join('');
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><meta charset="utf-8"/><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol>${navItems}</ol></nav></body></html>`);

  const manifest = list.map((_, i) => `<item id="c${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('');
  const spine = list.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${id}</dc:identifier><dc:title>${escapeXml(project.title)}</dc:title><dc:language>en</dc:language>${project.author_name ? `<dc:creator>${escapeXml(project.author_name)}</dc:creator>` : ''}<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>${manifest}</manifest><spine><itemref idref="title"/>${spine}</spine></package>`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
  downloadBlob(blob, `${safeName(project.title)}.epub`);
};

// ---------------------------------------------------------------- full backup

export interface NovelBackup {
  format: 'novelist-workspace-backup';
  version: 1;
  exportedAt: string;
  project: Project;
  chapters: Chapter[];
  entities: WikiEntity[];
  wordCountLogs: WordCountLog[];
}

export const exportBackup = (project: Project, chapters: Chapter[], entities: WikiEntity[], wordCountLogs: WordCountLog[]) => {
  const backup: NovelBackup = {
    format: 'novelist-workspace-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    chapters: sorted(chapters),
    entities,
    wordCountLogs,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `${safeName(project.title)}-backup-${stamp}.json`);
};

/** Total words across the chapters, for the export summary. */
export const manuscriptWords = (chapters: Chapter[]) =>
  chapters.reduce((sum, c) => {
    const t = htmlToText(c.content);
    return sum + (t ? t.split(' ').length : 0);
  }, 0);
