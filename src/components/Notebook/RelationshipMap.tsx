import React, { useMemo, useRef, useState } from 'react';
import type { WikiEntity } from '../../services/types';
import { getLinks, TYPE_LABEL } from '../../lib/notes';
import { layoutGraph, type Point } from '../../lib/graphLayout';
import { useT } from '../../i18n';

const W = 1000;
const H = 640;
const R = 24;

interface Pair {
  a: string;
  b: string;
  /** What each direction says, in the order the notes were linked */
  labels: { from: string; to: string; text: string }[];
}

const positionsKey = (projectId: string) => `novelist_relmap_${projectId}`;

const loadPositions = (projectId: string): Record<string, Point> => {
  try {
    return JSON.parse(localStorage.getItem(positionsKey(projectId)) || '{}') as Record<string, Point>;
  } catch {
    return {};
  }
};

/**
 * Who is connected to whom. Every note is a dot, every connection a line with its words on it. Drag a dot to
 * tidy the picture (the arrangement is remembered), and open a note by clicking it.
 */
export const RelationshipMap: React.FC<{
  projectId: string;
  entities: WikiEntity[];
  selectedId: string | null;
  onSelect: (entity: WikiEntity) => void;
}> = ({ projectId, entities, selectedId, onSelect }) => {
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [moved, setMoved] = useState<Record<string, Point>>(() => loadPositions(projectId));
  const [dragging, setDragging] = useState<string | null>(null);
  const dragged = useRef(false);

  const ids = useMemo(() => entities.map((e) => e.id), [entities]);
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  // One line per pair of notes, however many ways they are connected
  const pairs = useMemo(() => {
    const map = new Map<string, Pair>();
    for (const e of entities) {
      for (const link of getLinks(e)) {
        if (!byId.has(link.to) || link.to === e.id) continue;
        const [a, b] = e.id < link.to ? [e.id, link.to] : [link.to, e.id];
        const key = `${a}|${b}`;
        const pair = map.get(key) ?? { a, b, labels: [] };
        pair.labels.push({ from: e.id, to: link.to, text: link.label });
        map.set(key, pair);
      }
    }
    return [...map.values()];
  }, [entities, byId]);

  const base = useMemo(
    () => layoutGraph(ids, pairs.map((p) => ({ from: p.a, to: p.b })), W, H),
    [ids, pairs]
  );
  const at = (id: string): Point => moved[id] ?? base[id] ?? { x: W / 2, y: H / 2 };

  const save = (all: Record<string, Point>) => {
    // Only arrangements for notes that still exist are kept
    const next = Object.fromEntries(Object.entries(all).filter(([id]) => byId.has(id)));
    setMoved(next);
    try {
      localStorage.setItem(positionsKey(projectId), JSON.stringify(next));
    } catch {
      // storage full or refused
    }
  };

  const toSvg = (event: React.PointerEvent): Point => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  };

  const onPointerDown = (id: string, event: React.PointerEvent) => {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    setDragging(id);
    dragged.current = false;
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    dragged.current = true;
    const p = toSvg(event);
    setMoved((prev) => ({ ...prev, [dragging]: { x: Math.min(W - R, Math.max(R, p.x)), y: Math.min(H - R - 14, Math.max(R, p.y)) } }));
  };
  const onPointerUp = () => {
    if (dragging && dragged.current) save(moved);
    setDragging(null);
  };

  const label = (e: WikiEntity) => (e.name.length > 20 ? `${e.name.slice(0, 19)}…` : e.name);
  const connectedIds = useMemo(() => new Set(pairs.flatMap((p) => [p.a, p.b])), [pairs]);

  if (entities.length === 0) return null;

  return (
    <div className="relmap">
      <div className="relmap-bar">
        <span className="meta">
          {t('{notes} notes, {links} connections. Drag a note to tidy the picture; click it to open it.', { notes: entities.length, links: pairs.length })}
        </span>
        <button className="small-btn" onClick={() => save({})} disabled={Object.keys(moved).length === 0}>
          {t('Reset layout')}
        </button>
      </div>

      <svg
        ref={svgRef}
        className="relmap-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('Relationship map')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker id="relmap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="relmap-arrowhead" />
          </marker>
        </defs>

        {pairs.map((pair) => {
          const a = at(pair.a);
          const b = at(pair.b);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const oneWay = pair.labels.every((l) => l.from === pair.labels[0].from);
          const forward = pair.labels[0].from === pair.a;
          const text = [...new Set(pair.labels.map((l) => l.text).filter(Boolean))].join(' / ');
          const hot = selectedId === pair.a || selectedId === pair.b;
          return (
            <g key={`${pair.a}|${pair.b}`} className={`relmap-edge${hot ? ' is-hot' : ''}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                markerEnd={oneWay && forward ? 'url(#relmap-arrow)' : undefined}
                markerStart={oneWay && !forward ? 'url(#relmap-arrow)' : undefined}
              />
              {text && (
                <text x={mid.x} y={mid.y - 5} textAnchor="middle" className="relmap-edge-label">
                  {text.length > 34 ? `${text.slice(0, 33)}…` : text}
                </text>
              )}
            </g>
          );
        })}

        {entities.map((e) => {
          const p = at(e.id);
          const selected = selectedId === e.id;
          return (
            <g
              key={e.id}
              className={`relmap-node type-${e.type}${selected ? ' is-selected' : ''}${connectedIds.has(e.id) ? '' : ' is-alone'}`}
              transform={`translate(${p.x} ${p.y})`}
              tabIndex={0}
              role="button"
              aria-label={`${e.name}, ${TYPE_LABEL[e.type]}`}
              aria-pressed={selected}
              onPointerDown={(ev) => onPointerDown(e.id, ev)}
              onClick={() => {
                if (!dragged.current) onSelect(e);
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onSelect(e);
                }
              }}
              style={{ cursor: dragging === e.id ? 'grabbing' : 'grab' }}
            >
              <circle r={R} />
              <text className="relmap-initial" textAnchor="middle" dy="0.35em">
                {e.name.trim().charAt(0).toUpperCase()}
              </text>
              <text className="relmap-name" textAnchor="middle" y={R + 16}>
                {label(e)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* The same connections as words, for anyone who cannot see the picture */}
      <ul className="sr-only" aria-label={t('Connections between notes')}>
        {pairs.flatMap((p) =>
          p.labels.map((l, i) => (
            <li key={`${p.a}|${p.b}|${i}`}>
              {byId.get(l.from)?.name} {l.text || t('is linked to')} {byId.get(l.to)?.name}
            </li>
          ))
        )}
      </ul>

      <ul className="relmap-legend" aria-hidden="true">
        {(['character', 'location', 'item', 'lore'] as const).map((type) => (
          <li key={type} className={`type-${type}`}>
            <i /> {TYPE_LABEL[type]}
          </li>
        ))}
      </ul>
    </div>
  );
};
