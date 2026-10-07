import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { analyseBlock, statsFor, type StyleIssue, type StyleKind, type StyleStats } from '../../lib/style';

/** Marks every match of a search word in the chapter, and one "current" match. */
export const findKey = new PluginKey<FindState>('novelistFind');

export interface FindState {
  term: string;
  current: number;
  ranges: FindRange[];
  deco: DecorationSet;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A match in the chapter. `atom` marks an @mention, which can be found but not replaced as text. */
export interface FindRange {
  from: number;
  to: number;
  atom?: boolean;
}

export const findRanges = (doc: PMNode, term: string): FindRange[] => {
  if (!term) return [];
  const re = new RegExp(escapeRegex(term), 'gi');
  const lower = term.toLowerCase();
  const ranges: FindRange[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'mention') {
      const label = String(node.attrs.label ?? node.attrs.id ?? '');
      if (label.toLowerCase().includes(lower)) ranges.push({ from: pos, to: pos + node.nodeSize, atom: true });
      return;
    }
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      ranges.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return ranges;
};

const build = (doc: PMNode, term: string, current: number): FindState => {
  const ranges = findRanges(doc, term);
  const at = ranges.length ? ((current % ranges.length) + ranges.length) % ranges.length : 0;
  const deco = DecorationSet.create(
    doc,
    ranges.map((r, i) => Decoration.inline(r.from, r.to, { class: i === at ? 'find-hit is-current' : 'find-hit' }))
  );
  return { term, current: at, ranges, deco };
};

export const FindHighlight = Extension.create({
  name: 'novelistFind',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: (_config, state) => build(state.doc, '', 0),
          apply(tr, prev, _old, next) {
            const meta = tr.getMeta(findKey) as { term: string; current: number } | undefined;
            if (meta) return build(next.doc, meta.term, meta.current);
            if (tr.docChanged && prev.term) return build(next.doc, prev.term, prev.current);
            return prev;
          },
        },
        props: {
          decorations: (state) => findKey.getState(state)?.deco,
        },
      }),
    ];
  },
});

const currentKey = new PluginKey('novelistCurrentBlock');

/** Gives the paragraph the cursor is in a class, so focus mode can quiet everything else. */
export const CurrentBlock = Extension.create({
  name: 'novelistCurrentBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: currentKey,
        props: {
          decorations(state) {
            const { $from } = state.selection;
            if ($from.depth < 1) return null;
            const start = $from.before(1);
            const node = state.doc.nodeAt(start);
            if (!node) return null;
            return DecorationSet.create(state.doc, [Decoration.node(start, start + node.nodeSize, { class: 'is-current-block' })]);
          },
        },
      }),
    ];
  },
});

// ---- Gentle style notes ----

export const styleKey = new PluginKey<StyleState>('novelistStyle');

export interface StyleRange extends StyleIssue {
  /** Position in the whole chapter */
  pos: number;
}

export interface StyleState {
  enabled: boolean;
  kinds: StyleKind[];
  deco: DecorationSet;
  counts: Record<StyleKind, number>;
  issues: StyleRange[];
  stats: StyleStats;
}

const EMPTY_COUNTS: Record<StyleKind, number> = { repeat: 0, adverb: 0, filler: 0, long: 0, opener: 0 };
const EMPTY_STATS: StyleStats = { words: 0, sentences: 0, avgSentence: 0, longest: 0, dialogue: 0 };

// Every inline leaf (a mention, a line break) counts as one character, so text offsets line up with positions
const LEAF = '￼';

const buildStyle = (doc: PMNode, enabled: boolean, kinds: StyleKind[]): StyleState => {
  if (!enabled) return { enabled, kinds, deco: DecorationSet.empty, counts: { ...EMPTY_COUNTS }, issues: [], stats: EMPTY_STATS };
  const counts = { ...EMPTY_COUNTS };
  const issues: StyleRange[] = [];
  const blocks: string[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = node.textBetween(0, node.content.size, undefined, LEAF);
    blocks.push(text.replace(new RegExp(LEAF, 'g'), ' '));
    for (const issue of analyseBlock(text)) {
      counts[issue.kind]++;
      if (kinds.includes(issue.kind)) issues.push({ ...issue, pos: pos + 1 + issue.from });
    }
  });
  issues.sort((a, b) => a.pos - b.pos);
  const deco = DecorationSet.create(
    doc,
    issues.map((i) => Decoration.inline(i.pos, i.pos + (i.to - i.from), { class: `style-note style-${i.kind}` }))
  );
  return { enabled, kinds, deco, counts, issues, stats: statsFor(blocks) };
};

export const StyleNotes = Extension.create({
  name: 'novelistStyle',
  addProseMirrorPlugins() {
    return [
      new Plugin<StyleState>({
        key: styleKey,
        state: {
          init: (_config, state) => buildStyle(state.doc, false, []),
          apply(tr, prev, _old, next) {
            const meta = tr.getMeta(styleKey) as { enabled: boolean; kinds: StyleKind[] } | undefined;
            if (meta) return buildStyle(next.doc, meta.enabled, meta.kinds);
            if (tr.docChanged && prev.enabled) return buildStyle(next.doc, prev.enabled, prev.kinds);
            return prev;
          },
        },
        props: {
          decorations: (state) => styleKey.getState(state)?.deco,
        },
      }),
    ];
  },
});
