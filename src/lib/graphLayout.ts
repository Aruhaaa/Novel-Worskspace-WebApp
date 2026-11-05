/**
 * A tidy place for every note on the relationship map. A force-directed layout: notes push each other apart, and
 * connected notes pull together, until things settle. It starts from a fixed arrangement and a fixed random sequence,
 * so the same notes and connections always give the same picture.
 */
export interface LayoutEdge {
  from: string;
  to: string;
}

export interface Point {
  x: number;
  y: number;
}

/** A small, repeatable random number generator (mulberry32), so the layout never changes by chance. */
const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const layoutGraph = (ids: string[], edges: LayoutEdge[], width: number, height: number, pad = 60): Record<string, Point> => {
  const n = ids.length;
  const out: Record<string, Point> = {};
  if (n === 0) return out;
  const cx = width / 2;
  const cy = height / 2;
  if (n === 1) {
    out[ids[0]] = { x: cx, y: cy };
    return out;
  }

  const sorted = [...ids].sort();
  const rand = seeded(hash(sorted.join('|')));
  const pos = new Map<string, Point>();
  // Start on a ring, a little uneven, so the notes can find their way to a good arrangement
  sorted.forEach((id, i) => {
    const angle = (i / n) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.32 * (0.85 + rand() * 0.3);
    pos.set(id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  });

  const index = new Map(sorted.map((id, i) => [id, i]));
  const links = edges.filter((e) => index.has(e.from) && index.has(e.to) && e.from !== e.to);
  const area = (width - pad * 2) * (height - pad * 2);
  const k = Math.sqrt(area / n) * 0.8;
  const iterations = 280;

  for (let step = 0; step < iterations; step++) {
    const disp = sorted.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(sorted[i])!;
        const b = pos.get(sorted[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = rand() - 0.5;
          dy = rand() - 0.5;
          dist = Math.hypot(dx, dy) || 0.01;
        }
        const force = (k * k) / dist;
        disp[i].x += (dx / dist) * force;
        disp[i].y += (dy / dist) * force;
        disp[j].x -= (dx / dist) * force;
        disp[j].y -= (dy / dist) * force;
      }
    }
    for (const e of links) {
      const u = index.get(e.from)!;
      const v = index.get(e.to)!;
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      disp[u].x -= (dx / dist) * force;
      disp[u].y -= (dy / dist) * force;
      disp[v].x += (dx / dist) * force;
      disp[v].y += (dy / dist) * force;
    }
    const heat = (Math.min(width, height) / 8) * (1 - step / iterations);
    sorted.forEach((id, i) => {
      const p = pos.get(id)!;
      // A gentle pull to the middle keeps unconnected notes from drifting to the edge
      disp[i].x += (cx - p.x) * 0.05;
      disp[i].y += (cy - p.y) * 0.05;
      const len = Math.hypot(disp[i].x, disp[i].y) || 0.01;
      const move = Math.min(len, heat);
      p.x = Math.min(width - pad, Math.max(pad, p.x + (disp[i].x / len) * move));
      p.y = Math.min(height - pad, Math.max(pad, p.y + (disp[i].y / len) * move));
    });
  }

  for (const id of ids) {
    const p = pos.get(id)!;
    out[id] = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
  }
  return out;
};
