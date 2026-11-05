// A made-up writer, a made-up novel and a small library, put into the app's local storage so the real screens
// have something real to show. Nothing here belongs to anyone: the names, the book and the prose are invented.

const EMAIL = 'mira@example.com';
export const USER_ID = `mock-user-${EMAIL}`;
export const PROJECT_ID = 'salt-road';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// A pool of sentences in the book's voice. Longer chapters are made by drawing paragraphs from it, so the word
// counts on the chapter index look like a real manuscript; only the opening lines are ever read on screen.
const POOL = [
  'The tide came in the way it always had, slowly and then all at once.',
  'Nets hung in the rigging like grey laundry, stiff with salt.',
  'Nobody in the harbour said the name aloud; they pointed with their chins.',
  'Ada kept her hand on the rail and counted the waves in sevens, as her mother had taught her.',
  'Somewhere under the water a bell was ringing, slow and patient.',
  'The lamp room smelled of paraffin, brass polish and old weather.',
  'He charged a story for the crossing, and he was particular about the endings.',
  'There are roads that exist only when the sea allows it.',
  'She wrote the time in the margin of the table and underlined it twice.',
  'The gulls wheeled, argued, and settled again on the same wet stones.',
  'Every house on the front had a window turned towards the water and a door turned away.',
  'The rope was warm where the sun had found it and cold everywhere else.',
  'Hester lit the lamp for ships that no longer existed, and nobody asked her to stop.',
  'The ferry bell rang twice, which meant the crossing was off and the argument was on.',
  'What the salt remembers, it keeps in the grain of the wood.',
  'A single gull stood guard over the lobster pots as though it held the lease.',
  'The map ended where the paper had been folded too often.',
  'Wren talked while he walked, and what he said was never quite a lie.',
  'By evening the fog had come down to the level of the lamps and stayed there.',
  'She read the page again, because the handwriting on it was not her mother\'s.',
];

const paragraphsOfWords = (target, seed) => {
  const out = [];
  let words = 0;
  let i = seed * 7;
  while (words < target) {
    const sentences = [];
    const n = 4 + ((i + seed) % 3);
    for (let s = 0; s < n; s += 1) {
      sentences.push(POOL[(i * 3 + s * 5 + seed) % POOL.length]);
      i += 1;
    }
    const text = sentences.join(' ');
    out.push(`<p>${text}</p>`);
    words += text.split(' ').length;
  }
  return out.join('');
};

const HERO_LEAD = [
  'The road to Lantern Hill was only a road at low water. At high tide it was a rumour, a pale seam in the sea that the fishermen swore they could read like a sentence.',
  'Ada stood at its edge with the tide table folded small in her fist and counted what was left of the afternoon. Forty minutes, if the book was right. The book was usually right. That was what frightened her.',
  'Behind her the harbour had already gone quiet. Nets hung in the rigging like grey laundry. Somewhere a bell was ringing under the water, slow and patient, as though it had all the time in the world to be answered.',
  '“You’ll want to hurry,” said the boy on the wall. He had not been there a moment ago. He swung his bare heels against the stones and watched her with the flat, unhurried interest of a gull.',
  '“I know what the tide does,” Ada said.',
  '“Not this one,” said Wren. “This one has opinions.”',
  'She looked at the water again, and for the first time it seemed to look back. The line of the road brightened, then dimmed, like a breath held and let go.',
  'Ada put the book in her pocket, took off her boots, and stepped onto the Salt Road.',
];

const CHAPTERS = [
  { id: 'c1', title: 'The Tide Table', words: 3120, status: 'done', synopsis: 'A parcel arrives at the lighthouse with a tide table in a stranger’s handwriting.', lead: ['The parcel came on a Tuesday, which was the day nothing came.', 'Ada Marlow signed for it with a hand that did not shake, which she was proud of afterwards.', 'It was the size of a hymn book and tied with the kind of knot sailors use when they do not want to be followed.'] },
  { id: 'c2', title: 'A Harbour Not on the Map', words: 3480, status: 'done', synopsis: 'Ada follows the table to a harbour that appears only on the lowest spring tides.', lead: ['Ada Marlow had been told all her life that the coast had no harbour north of the Narrows.', 'The table disagreed, and in four years it had never once been wrong.'] },
  { id: 'c3', title: 'Lantern Hill', words: 2860, status: 'revising', synopsis: 'Wren dares Ada to cross the Salt Road before the tide closes it.', lead: HERO_LEAD },
  { id: 'c4', title: 'What the Salt Remembers', words: 2210, status: 'draft', synopsis: 'Old Hester shows Ada the lamp that has burned for ships that no longer exist.', lead: ['Hester kept the lamp room the way other people keep a grudge: daily, thoroughly, and without being asked.'] },
  { id: 'c5', title: 'The Ferryman’s Price', words: 1640, status: 'draft', synopsis: 'Joss Reed will take them across, for a story with the right ending.', lead: ['Joss Reed did not take money. He took stories, and he was particular about the endings.'] },
  { id: 'c6', title: 'Low Water', words: 790, status: 'draft', synopsis: 'The sea draws back further than it has in a hundred years.', lead: ['On the fourth morning the sea went out and did not come back at the usual hour.'] },
  { id: 'c7', title: 'The Drowned Bell', words: 0, status: 'draft', synopsis: 'What rings under the water, and who it answers.', lead: [] },
];

const SCENES = [
  { id: 's1', name: 'The parcel arrives', status: 'finished', order: 0, chapter: 'c1', when: 'Tuesday, early spring' },
  { id: 's2', name: 'First reading of the table', status: 'finished', order: 1, chapter: 'c1', when: 'That night' },
  { id: 's3', name: 'A harbour at spring tide', status: 'finished', order: 2, chapter: 'c2', when: 'Four years on' },
  { id: 's4', name: 'Wren on the wall', status: 'drafting', order: 0, chapter: 'c3', when: 'Late afternoon' },
  { id: 's5', name: 'Crossing the Salt Road', status: 'drafting', order: 1, chapter: 'c3', when: 'Forty minutes before the tide' },
  { id: 's6', name: 'The lamp that burns for no one', status: 'drafting', order: 2, chapter: 'c4', when: 'Dusk' },
  { id: 's7', name: 'Joss names his price', status: 'todo', order: 0, chapter: 'c5', when: 'The next morning' },
  { id: 's8', name: 'The sea goes out', status: 'todo', order: 1, chapter: 'c6', when: 'The fourth day' },
  { id: 's9', name: 'The bell answers back', status: 'idea', order: 0, chapter: '', when: '' },
  { id: 's10', name: 'Hester’s confession', status: 'idea', order: 1, chapter: '', when: '' },
];

const ENTITIES = [
  { id: 'e1', name: 'Ada Marlow', type: 'character', description: 'A lighthouse keeper’s daughter who reads a tide table the way other people read faces.', content: { Age: '19', Role: 'Protagonist', Wants: 'To find the harbour her mother talked about', Fear: 'Being right too late', _tags: 'protagonist, keeper' } },
  { id: 'e2', name: 'Wren', type: 'character', description: 'A barefoot stowaway who knows every ferry timetable and trusts none of them.', content: { Age: '11', Role: 'Guide', Secret: 'Has never once been dry', _tags: 'ally, stowaway' } },
  { id: 'e3', name: 'Joss Reed', type: 'character', description: 'The ferryman. He charges a story for the crossing and is particular about the endings.', content: { Age: '52', Role: 'Gatekeeper', Habit: 'Hums in the key of whatever the sea is doing', _tags: 'ferryman' } },
  { id: 'e4', name: 'Old Hester', type: 'character', description: 'Keeps the lamp lit at Lantern Hill for ships that no longer exist.', content: { Age: '81', Role: 'Mentor', Habit: 'Polishes the same brass rail every morning', _tags: 'keeper, mentor' } },
  { id: 'e5', name: 'Lantern Hill', type: 'location', description: 'A hump of black rock joined to the mainland only at low water.', content: { Region: 'The Narrows', Danger: 'The tide closes the road in forty minutes', _tags: 'rock, lighthouse' } },
  { id: 'e6', name: 'The Salt Road', type: 'location', description: 'A causeway of pale stone that the sea uncovers twice a day, mostly.', content: { Region: 'The Narrows', Length: 'About a mile at the lowest water', _tags: 'causeway' } },
  { id: 'e7', name: 'Harbour of Teeth', type: 'location', description: 'A harbour that is not on any map, ringed by rocks like a mouth.', content: { Region: 'North of the Narrows', Secret: 'Visible only on the lowest spring tides', _tags: 'harbour' } },
  { id: 'e8', name: 'The Tide Table', type: 'item', description: 'A water-stained book of tides, in a handwriting that is not Ada’s mother’s.', content: { Origin: 'A parcel with no sender', Property: 'Has never once been wrong', _tags: 'book, clue' } },
  { id: 'e9', name: 'The Drowned Bell', type: 'lore', description: 'A bell under the harbour that rings only when someone within earshot is lying.', content: { Heard: 'First by Hester, forty years ago', _tags: 'myth' } },
];

const LIBRARY = [
  { id: 'p1', user: 'author-iris', author: 'Iris Okafor', title: 'The Lamp Year', genre: 'Historical', likes: 128, views: 940, description: 'A year in the life of a gas-lamp lighter, told one street at a time.' },
  { id: 'p2', user: 'author-tom', author: 'Tom Reyes', title: 'Glass Orchard', genre: 'Contemporary', likes: 76, views: 612, description: 'Three siblings, one failing orchard and a summer to decide who stays.' },
  { id: 'p3', user: 'author-dev', author: 'Dev Anand', title: 'Salt and Static', genre: 'Sci-Fi', likes: 203, views: 1480, description: 'A radio operator on a drowned coast hears a voice from next week.' },
  { id: 'p4', user: 'author-sam', author: 'Sam Lindqvist', title: 'Hollow Kings', genre: 'Fantasy', likes: 95, views: 830, description: 'The crown is empty. The three who want it are not.' },
  { id: 'p5', user: 'author-lia', author: 'Lia Ferreira', title: 'Paper Tigers', genre: 'Mystery', likes: 64, views: 505, description: 'A bookshop, a missing ledger, and a customer who never leaves.' },
  { id: 'p6', user: 'author-noor', author: 'Noor Haddad', title: 'The Slow Rivers', genre: 'Romance', likes: 141, views: 1102, description: 'Two translators, one border and a letter that took ten years to arrive.' },
];

const READER_CHAPTERS = [
  { title: 'The Lamplighter’s Round', paras: ['Before the first bell, before the milk and the news, Odile walked the length of Tanner Street with a brass pole over her shoulder and the dark folded behind her like a coat.', 'Each lamp took her four seconds. She counted them without meaning to: the hiss, the small blue cough, the glow climbing the glass. By the ninth lamp she had stopped being afraid of anything.', 'It was not courage. It was routine, which is what courage looks like from the inside.'] },
  { title: 'A Street That Remembers', paras: ['Tanner Street kept its own accounts. The baker’s step was worn on the left because he always came in carrying something. The widow’s curtain moved at six, and only at six.', 'Odile had learned the street the way you learn a hymn: by repetition, until the meaning came loose and arrived on its own.', 'It was the Thursday the new lamp failed that she first understood the street was learning her back.'] },
  { title: 'Gas and Gossip', paras: ['By Friday everyone had a theory. The grocer said it was the pipes. The curate said it was the weather. The child on the second floor said it was the lamp, which was offended.', 'Odile said nothing, and carried a spare mantle in her left pocket where a more sociable woman would have kept a handkerchief.'] },
];

const BIO_LINES = {
  'author-iris': 'Writes about work, weather and the people who keep cities running.',
  'author-tom': 'Orchard kid turned novelist.',
  'author-dev': 'Engineer by day, storyteller by flood warning.',
  'author-sam': 'Fantasy, maps, and too much tea.',
  'author-lia': 'Mysteries set in places that sell books.',
  'author-noor': 'Translator. Writes love stories with footnotes.',
};

export const buildSeed = (now = new Date()) => {
  const iso = (offsetDays = 0, hour = 9) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offsetDays);
    d.setHours(hour, 12, 0, 0);
    return d.toISOString();
  };

  const chapters = [];
  CHAPTERS.forEach((c, i) => {
    const lead = c.lead.map((t) => `<p>${t}</p>`).join('');
    const body = c.words > 0 ? paragraphsOfWords(Math.max(0, c.words - c.lead.join(' ').split(' ').length), i + 1) : '';
    chapters.push({
      id: c.id,
      project_id: PROJECT_ID,
      title: c.title,
      content: lead + body,
      position: i,
      created_at: iso(30 - i * 3),
      updated_at: iso(Math.max(0, 6 - i)),
    });
  });

  const entities = [
    ...ENTITIES.map((e, i) => ({ ...e, project_id: PROJECT_ID, created_at: iso(24 - i), updated_at: iso(2) })),
    ...SCENES.map((s, i) => ({
      id: s.id,
      project_id: PROJECT_ID,
      name: s.name,
      type: 'scene',
      description: '',
      content: { status: s.status, order: String(s.order), ...(s.chapter ? { _chapter: s.chapter } : {}), ...(s.when ? { _when: s.when } : {}) },
      created_at: iso(20 - i),
      updated_at: iso(1),
    })),
  ];

  // Fourteen days of writing, today included. A few quiet days make the chart honest.
  const counts = [420, 0, 1180, 960, 1450, 800, 1620, 1210, 0, 1750, 980, 1340, 2010, 1260];
  const wordLogs = counts.map((n, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (counts.length - 1 - i));
    return { id: `l${i}`, project_id: PROJECT_ID, date: ymd(d), word_count: n, created_at: iso(0), updated_at: iso(0) };
  });

  const projects = [
    {
      id: PROJECT_ID,
      user_id: USER_ID,
      title: 'The Salt Road',
      description: 'A lighthouse keeper’s daughter follows a tide table to a harbour that is not on any map.',
      is_published: false,
      author_name: 'Mira Vale',
      genre: 'Fantasy',
      likes: [],
      views: [],
      created_at: iso(30),
      updated_at: iso(0),
    },
    ...LIBRARY.map((l, i) => ({
      id: l.id,
      user_id: l.user,
      title: l.title,
      description: l.description,
      is_published: true,
      author_name: l.author,
      genre: l.genre,
      likes: Array.from({ length: l.likes }, (_, k) => `reader-${l.id}-${k}`),
      views: Array.from({ length: l.views }, (_, k) => `visit-${l.id}-${k}`),
      created_at: iso(60 - i * 5),
      updated_at: iso(i + 1),
    })),
  ];

  const libraryChapters = READER_CHAPTERS.map((c, i) => ({
    id: `lc${i + 1}`,
    project_id: 'p1',
    title: c.title,
    content: c.paras.map((t) => `<p>${t}</p>`).join('') + paragraphsOfWords(180, i + 3),
    position: i,
    created_at: iso(50),
    updated_at: iso(3),
  }));

  const profiles = [
    { id: USER_ID, display_name: 'Mira Vale', bio: 'Writes about tides, lighthouses and the people who keep them.', daily_word_goal: 1000, followers: ['author-iris', 'author-tom', 'author-noor'], following: ['author-iris'] },
    ...Object.entries(BIO_LINES).map(([id, bio]) => ({ id, display_name: LIBRARY.find((l) => l.user === id).author, bio, daily_word_goal: 1000, followers: [], following: [] })),
  ];

  // Sprint history: the last week, newest first
  const sprint = (daysAgo, hour, minutes, words, goal) => {
    const startedAt = new Date(now);
    startedAt.setDate(startedAt.getDate() - daysAgo);
    startedAt.setHours(hour, 5, 0, 0);
    const activeMs = minutes * 60 * 1000;
    return {
      id: `sp-${daysAgo}-${hour}`,
      projectId: PROJECT_ID,
      startedAt: startedAt.getTime(),
      endedAt: startedAt.getTime() + activeMs,
      durationMs: activeMs,
      activeMs,
      words,
      goalWords: goal,
      completed: true,
      wpm: Math.round(words / minutes),
    };
  };
  const sprints = [sprint(0, 8, 25, 612, 500), sprint(1, 20, 20, 388, 400), sprint(2, 7, 25, 704, 600), sprint(3, 21, 15, 301, null), sprint(5, 9, 30, 805, 700), sprint(6, 19, 20, 466, 400)];

  const reviews = [
    { id: 'rv1', project_id: 'p1', user_id: 'author-tom', rating: 5, content: 'I read it in one sitting and then started again.', created_at: iso(4), updated_at: iso(4) },
    { id: 'rv2', project_id: 'p1', user_id: 'author-noor', rating: 4, content: 'Quietly wonderful. The street is a character.', created_at: iso(2), updated_at: iso(2) },
  ];
  const comments = [
    { id: 'cm1', project_id: 'p1', chapter_id: 'lc1', user_id: 'author-dev', content: 'That line about routine and courage has stayed with me all week.', created_at: iso(1), updated_at: iso(1) },
  ];

  const chapterMeta = {};
  CHAPTERS.forEach((c) => {
    chapterMeta[c.id] = { status: c.status, synopsis: c.synopsis, notes: c.id === 'c3' ? 'Foreshadow the bell. Keep Wren’s answers short.' : '', updatedAt: now.getTime() };
  });

  // Today's words continue from this morning: 1,260 were written earlier today, all of them in chapter 3, so
  // anything typed during the video adds on top of that instead of starting the day again at zero
  const words = (html) => html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  const day = { date: ymd(now), base: {}, last: {}, logged: 1260 };
  for (const c of chapters) {
    day.last[c.id] = words(c.content);
    day.base[c.id] = day.last[c.id];
  }
  day.base.c3 = day.last.c3 - 1260;

  const storage = {
    [`novelist_day_${PROJECT_ID}`]: day,
    novel_projects: projects,
    novel_chapters: [...chapters, ...libraryChapters],
    novel_entities: entities,
    novel_word_logs: wordLogs,
    novel_profiles: profiles,
    novel_reviews: reviews,
    novel_comments: comments,
    novel_chats: [],
    novelist_local_session: { id: USER_ID, email: EMAIL },
    [`novelist_mode_${USER_ID}`]: 'both',
    [`novelist_tour_welcome_${USER_ID}`]: 'done',
    [`novelist_tour_workspace_${USER_ID}`]: 'done',
    [`novelist_chapter_meta_${PROJECT_ID}`]: chapterMeta,
    [`novelist_goal_${PROJECT_ID}`]: { target: 80000, deadline: ymd(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 120)), updatedAt: now.getTime() },
    [`novelist_sprint_history_${PROJECT_ID}`]: sprints,
    [`novelist_last_project_${USER_ID}`]: PROJECT_ID,
    [`novelist_last_chapter_${PROJECT_ID}`]: 'c3',
    novelist_recently_read: ['p3', 'p1'],
  };

  // Strings stay strings (a few keys hold plain text, not JSON)
  const plain = new Set([`novelist_mode_${USER_ID}`, `novelist_tour_welcome_${USER_ID}`, `novelist_tour_workspace_${USER_ID}`, `novelist_last_project_${USER_ID}`, `novelist_last_chapter_${PROJECT_ID}`]);
  const out = {};
  for (const [k, v] of Object.entries(storage)) out[k] = plain.has(k) ? String(v) : JSON.stringify(v);
  return out;
};

export const totalWords = (seed) =>
  JSON.parse(seed.novel_chapters)
    .filter((c) => c.project_id === PROJECT_ID)
    .reduce((n, c) => n + c.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length, 0);
