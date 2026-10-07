import { databaseService } from '../services/database';
import type { Project, WikiEntity } from '../services/types';
import { localDate } from './dates';
import { saveChapterMeta, type ChapterMetaMap } from './chapterMeta';
import { saveProjectGoal } from './projectGoal';
import { setLastChapter } from './lastOpened';

/**
 * A small, finished-looking project for trying the app: three chapters, a notebook with connections,
 * outline scenes placed in chapters, and a goal. Everything in it is original and can be removed.
 */
const SAMPLES_KEY = 'novelist_sample_projects';

const readSamples = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAMPLES_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

export const isSampleProject = (projectId: string): boolean => readSamples().includes(projectId);

export const forgetSample = (projectId: string): void => {
  try {
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(readSamples().filter((id) => id !== projectId)));
  } catch {
    // ignore
  }
};

const registerSample = (projectId: string) => {
  try {
    localStorage.setItem(SAMPLES_KEY, JSON.stringify([...readSamples(), projectId]));
  } catch {
    // ignore
  }
};

const mention = (e: WikiEntity) =>
  `<span data-type="mention" data-id="${e.id}" data-label="${e.name}" data-mention-suggestion-char="@">@${e.name}</span>`;

export const createSampleProject = async (userId: string): Promise<Project> => {
  const project = await databaseService.createProject(
    userId,
    "The Keeper's Daughter",
    'A sample project: a lighthouse that will not light, a letter in the tide table, and a daughter who was never told.'
  );
  const withGenre = await databaseService.updateProjectSettings(project.id, { genre: 'Mystery' });

  // The notebook first, so the chapters can mention it by id
  const make = (name: string, type: WikiEntity['type'], description: string, content: Record<string, string>) =>
    databaseService.createEntity(project.id, name, type, description, content);

  const ines = await make('Ines Calloway', 'character', "The lighthouse keeper's daughter. Has never missed lighting the lamp.", {
    Age: '24',
    Fear: 'Being the last of the line',
    _tags: 'protagonist, keeper',
  });
  const tomas = await make('Tomas Reyes', 'character', 'Pilots the supply boat. Knows more about the island than he says.', {
    Age: '41',
    _tags: 'ally, boat',
  });
  const harrow = await make('Harrow Light', 'location', 'A lighthouse on a rock two hours from the coast. One hundred and twelve steps to the lamp.', {
    Built: '1891',
    _tags: 'island, lighthouse',
  });
  const table = await make('The tide table', 'item', "Her father's annual tide table, written over in pencil. Something is hidden between its pages.", {
    _tags: 'clue',
  });
  const blackout = await make('The Blackout', 'lore', 'The one night in forty years the lamp went dark. Nobody on the island will say why.', {
    _tags: 'backstory',
  });

  const link = (to: WikiEntity, label: string) => JSON.stringify([{ to: to.id, label }]);
  await databaseService.updateEntity(ines.id, { content: { ...ines.content, _links: link(harrow, 'grew up at') } });
  await databaseService.updateEntity(tomas.id, { content: { ...tomas.content, _links: link(ines, 'brings supplies to') } });
  await databaseService.updateEntity(table.id, { content: { ...table.content, _links: link(harrow, 'kept at') } });
  await databaseService.updateEntity(blackout.id, { content: { ...blackout.content, _links: link(harrow, 'happened at') } });

  const chapterText: { title: string; html: string }[] = [
    {
      title: 'The Light Goes Out',
      html:
        `<p>Ines Calloway had climbed the one hundred and twelve steps of ${mention(harrow)} every evening of her life, and never once had the lamp failed to answer her. Tonight it did not.</p>` +
        `<p>She stood in the lantern room with the match still burning down toward her fingers. Below, the sea went on exactly as before, as if it had been waiting for this.</p>` +
        `<hr>` +
        `<p>${mention(tomas)} brought the supply boat in at first light, and he did not ask why the lamp had been dark. That was the thing she noticed. He did not ask at all.</p>`,
    },
    {
      title: 'A Letter in the Tide Table',
      html:
        `<p>Her father had kept ${mention(table)} on the hook by the stove for as long as she could remember, its pages soft as cloth. ${mention(ines)} turned to the week of the new moon and found the pencil marks she expected.</p>` +
        `<p>She did not expect the folded page tucked into the spine. It was a letter, dated eleven days before she was born, and it began: <em>If you are reading this, the lamp has gone out again.</em></p>`,
    },
    {
      title: "What the Keeper Knew",
      html: `<p>${mention(ines)} read the letter a third time, then went down to find her father.</p>`,
    },
  ];

  const chapters = [];
  for (const c of chapterText) {
    const created = await databaseService.createChapter(project.id, c.title);
    chapters.push(await databaseService.updateChapter(created.id, { content: c.html }));
  }

  const scene = (name: string, description: string, status: string, order: number, chapterId: string, when: string) =>
    make(name, 'scene', description, {
      status,
      order: String(order),
      ...(chapterId ? { _chapter: chapterId } : {}),
      ...(when ? { _when: when } : {}),
    });
  await scene('The lamp fails', 'Ines lights the match and nothing answers.', 'finished', 0, chapters[0].id, 'Autumn, night');
  await scene('Tomas does not ask', 'The supply boat arrives; his silence tells her something.', 'finished', 1, chapters[0].id, 'The next dawn');
  await scene('The letter in the tide table', 'Ines finds her father\'s hidden letter.', 'drafting', 0, chapters[1].id, 'Two days later');
  await scene('Facing her father', 'What he knew, and why he never said.', 'todo', 0, chapters[2].id, 'Winter');
  await scene('Who wrote the second tide table?', 'A loose end worth following. Where does it go?', 'idea', 0, '', '');

  const meta: ChapterMetaMap = {
    [chapters[0].id]: { status: 'done', synopsis: 'Ines finds the lamp dead and meets the supply boat.', notes: '' },
    [chapters[1].id]: { status: 'revising', synopsis: 'A letter in her father\'s hand changes what she thinks she knows.', notes: 'Tighten the letter. Hint at the Blackout without naming it.' },
    [chapters[2].id]: { status: 'draft', synopsis: 'Ines confronts her father.', notes: 'Decide how much he tells her.' },
  };
  saveChapterMeta(project.id, meta);

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 90);
  saveProjectGoal(project.id, { target: 60000, deadline: localDate(deadline) });

  // Open on the first chapter, not whichever was written last
  setLastChapter(project.id, chapters[0].id);
  registerSample(project.id);
  return withGenre;
};
