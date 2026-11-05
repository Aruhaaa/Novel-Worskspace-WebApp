// The same invented writer and novel as the website demo, written in the phone app's own storage format.
// On the web build of the phone app, shared_preferences keeps each value in localStorage as `flutter.<key>`,
// JSON-encoded (so a string is stored with quotes around it).
import { buildSeed, USER_ID as WEB_USER, PROJECT_ID } from './seed-data.mjs';

export const PHONE_USER = 'local-mira@example.com';
export const PHONE_EMAIL = 'mira@example.com';

const FILLER = [
  'The first lamp of the evening was always the hardest, because it asked her to believe in the rest.',
  'Rain had a way of finding the one tile that was loose. She had stopped fixing it, out of respect.',
  'Somewhere below, a door closed softly, the way doors do when someone is trying not to wake the house.',
  'By the time the kettle sang she had decided nothing, which was its own kind of decision.',
  'The street smelled of wet slate and bread, and beneath both, faintly, of the sea that was not there.',
  'Nobody in the building could say when the stairwell clock had stopped, only that it was right twice a day.',
];

export const buildPhoneSeed = (now = new Date()) => {
  const web = buildSeed(now);
  const parse = (k) => JSON.parse(web[k]);
  const swapUser = (id) => (id === WEB_USER ? PHONE_USER : id);

  const projects = parse('novel_projects').map((p) => ({ ...p, user_id: swapUser(p.user_id), cover_url: '' }));
  const chapters = parse('novel_chapters');

  // Every library novel gets a couple of chapters so it opens
  const extra = [];
  for (const p of projects.filter((p) => p.is_published && p.user_id !== PHONE_USER)) {
    if (chapters.some((c) => c.project_id === p.id)) continue;
    for (let i = 0; i < 3; i += 1) {
      extra.push({
        id: `${p.id}-c${i}`,
        project_id: p.id,
        title: ['The First Evening', 'What the Street Knew', 'A Small Reckoning'][i],
        content: [0, 1, 2].map((k) => `<p>${FILLER[(i * 2 + k) % FILLER.length]} ${FILLER[(i + k * 3 + 1) % FILLER.length]}</p>`).join(''),
        position: i,
        created_at: p.created_at,
        updated_at: p.updated_at,
      });
    }
  }
  const allChapters = [...chapters, ...extra];

  const entities = parse('novel_entities');
  const logs = parse('novel_word_logs').map((l) => ({ project_id: l.project_id, date: l.date, count: l.word_count }));
  const profiles = parse('novel_profiles').map((p) => ({ ...p, id: swapUser(p.id) }));

  const meta = JSON.parse(web[`novelist_chapter_meta_${PROJECT_ID}`]);
  const notes = {};
  for (const [id, m] of Object.entries(meta)) notes[id] = { status: m.status, synopsis: m.synopsis, notes: m.notes, updatedAt: now.getTime() };

  const db = { projects, chapters: allChapters, entities, logs, profiles, notes, bin: [] };

  // Today carries on from this morning: 1,260 words already written in chapter 3
  const words = (html) => html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  const mine = allChapters.filter((c) => c.project_id === PROJECT_ID);
  const day = { date: JSON.parse(web[`novelist_day_${PROJECT_ID}`]).date, base: {}, last: {}, logged: 1260 };
  for (const c of mine) {
    day.last[c.id] = words(c.content);
    day.base[c.id] = day.last[c.id];
  }
  day.base.c3 = day.last.c3 - 1260;

  const at = now.getTime();
  const flutter = {
    novelist_local_db_v1: JSON.stringify(db),
    novelist_local_session: JSON.stringify({ id: PHONE_USER, email: PHONE_EMAIL }),
    [`mode_${PHONE_USER}`]: 'both',
    theme: 'studio',
    saved: ['p3', 'p6'],
    progress: JSON.stringify({ p1: { c: 1, at: at - 3600_000 }, p3: { c: 0, at: at - 86_400_000 } }),
    [`day_${PROJECT_ID}`]: JSON.stringify(day),
  };

  // shared_preferences on the web: every value JSON-encoded under "flutter."
  const out = {};
  for (const [k, v] of Object.entries(flutter)) out[`flutter.${k}`] = JSON.stringify(v);
  return out;
};
