import { expect, test } from './fixtures';
import { addChapter, createProject, seedPublishedNovel, signIn, typeInEditor, waitForSaved } from './helpers';
import type { Page } from '@playwright/test';

/** Where the caret is, and where the scrolling area is, in the same coordinates. */
const caretAndBox = (page: Page) =>
  page.evaluate(() => {
    const range = window.getSelection()!.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rects = range.getClientRects();
    const caret = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    const box = document.querySelector('.writing-view')!.getBoundingClientRect();
    return { caret: (caret.top + caret.bottom) / 2, top: box.top, height: box.height };
  });

test.describe('typewriter scrolling', () => {
  test('keeps the line being written near the middle once it is switched on', async ({ page }) => {
    // Typing a page of text a key at a time takes a while when several tests share one busy machine
    test.setTimeout(120_000);
    await signIn(page, 'writer@example.com', 'Write');
    await createProject(page, 'Typewriter Test');
    await addChapter(page, 'One');

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Off by default: writing down the page leaves the caret at the bottom of the screen
    for (let i = 1; i <= 24; i++) {
      await page.keyboard.type(`Line number ${i}`);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('Where the caret is now');
    let m = await caretAndBox(page);
    expect(m.caret).toBeGreaterThan(m.top + m.height * 0.7);

    // Switched on, the next lines keep it near the middle
    const toggle = page.getByRole('button', { name: 'Typewriter scrolling' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await editor.click();
    await page.keyboard.press('Control+End');
    for (let i = 1; i <= 5; i++) {
      await page.keyboard.press('Enter');
      await page.keyboard.type(`More writing ${i}`);
    }
    m = await caretAndBox(page);
    expect(Math.abs(m.caret - (m.top + m.height * 0.45))).toBeLessThan(40);

    // The choice is remembered
    await waitForSaved(page, 'More writing 5');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Typewriter scrolling' })).toHaveAttribute('aria-pressed', 'true');
  });
});

// A voice that records what it is asked to say and finishes each piece after a short wait, so reading can be watched.
const fakeVoice = `
  (() => {
    const spoken = [];
    let timer = 0;
    const synth = {
      speaking: false,
      getVoices: () => [],
      addEventListener() {},
      removeEventListener() {},
      cancel() { clearTimeout(timer); window.__cancels = (window.__cancels || 0) + 1; },
      pause() {}, resume() {},
      speak(u) { spoken.push(u.text); window.__spoken = spoken; timer = setTimeout(() => u.onend && u.onend({}), window.__speakDelay ?? 120); },
    };
    class Utterance { constructor(text) { this.text = text; } }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true });
    window.__spoken = spoken;
  })();
`;

test.describe('read aloud', () => {
  test('reads a novel paragraph by paragraph, marks the one being read, and can pause, resume and stop', async ({ page }) => {
    await page.addInitScript(fakeVoice);
    await seedPublishedNovel(page, [
      { id: 'rc1', title: 'Part 1', html: '<p>First paragraph of the novel.</p><p>Second paragraph, a little longer than the first.</p>' },
      { id: 'rc2', title: 'Part 2', html: '<p>The second chapter begins here.</p>' },
    ]);
    await signIn(page, 'reader@example.com', 'Read');
    await page.goto('/#/library/novel/pub1');
    await expect(page.getByRole('heading', { name: 'Part 2' })).toBeVisible();

    const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
    await page.getByRole('button', { name: 'Read this novel aloud' }).click();

    // The bar appears, and the paragraph being read is marked
    const bar = page.getByRole('region', { name: 'Read aloud' });
    await expect(bar).toBeVisible();
    await expect(page.locator('.is-speaking')).toHaveCount(1);
    await expect.poll(spoken).toContain('Part 1');

    // Pause stops the voice; Continue picks up again
    await bar.getByRole('button', { name: 'Pause reading' }).click();
    const before = (await spoken()).length;
    await page.waitForTimeout(500);
    expect((await spoken()).length).toBe(before);
    await bar.getByRole('button', { name: 'Continue reading aloud' }).click();

    // It reads on to the end, then the bar goes away
    await expect(bar).toBeHidden({ timeout: 10_000 });
    // Everything was read, in order. The piece that was cut off by Pause is said again from its start, so it may appear twice.
    expect([...new Set(await spoken())]).toEqual([
      'Part 1',
      'First paragraph of the novel.',
      'Second paragraph, a little longer than the first.',
      'Part 2',
      'The second chapter begins here.',
    ]);
    await expect(page.locator('.is-speaking')).toHaveCount(0);

    // Stop ends it at once
    await page.evaluate(() => ((window as unknown as { __speakDelay: number }).__speakDelay = 2000));
    await page.getByRole('button', { name: 'Read this novel aloud' }).click();
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Stop reading aloud' }).click();
    await expect(bar).toBeHidden();
    await expect(page.locator('.is-speaking')).toHaveCount(0);
  });

  test('the manuscript can be read aloud from the paragraph the cursor is in, and writing stops it', async ({ page }) => {
    await page.addInitScript(fakeVoice);
    await signIn(page, 'writer2@example.com', 'Write');
    await createProject(page, 'Listen Test');
    await addChapter(page, 'One');
    await typeInEditor(page, 'Alpha one. ');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Beta two.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Gamma three.');
    await page.evaluate(() => ((window as unknown as { __speakDelay: number }).__speakDelay = 400));

    // The cursor is in the third paragraph, so reading starts there
    await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
    const bar = page.getByRole('region', { name: 'Read aloud' });
    await expect(bar).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(['Gamma three.']);
    await expect(page.locator('.ProseMirror .is-speaking')).toHaveText('Gamma three.');
    await expect(bar).toBeHidden({ timeout: 5000 });

    // Reading from the top, then writing something: it stops rather than reading words that have moved
    await page.evaluate(() => ((window as unknown as { __speakDelay: number }).__speakDelay = 5000));
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+Home');
    await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
    await expect(bar).toBeVisible();
    // Back into the text, and write
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('X');
    await expect(bar).toBeHidden();
  });
});

const DICTIONARY = [
  { word: 'quick', phonetic: '/kwɪk/', meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'Fast in motion.', example: 'a quick walk' }], synonyms: ['fast'] }] },
];

test.describe('word lookup', () => {
  test('shows what a word means and swaps in a similar one, keeping its capital', async ({ page }) => {
    const asked: string[] = [];
    await page.route('https://api.dictionaryapi.dev/**', (route) => {
      asked.push(route.request().url());
      return route.fulfill({ json: DICTIONARY });
    });
    await page.route('https://api.datamuse.com/**', (route) => {
      asked.push(route.request().url());
      return route.fulfill({ json: [{ word: 'swift' }, { word: 'rapid' }] });
    });
    await signIn(page, 'lookup@example.com', 'Write');
    await createProject(page, 'Lookup Test');
    await addChapter(page, 'One');
    await typeInEditor(page, 'Quick brown fox');

    // Select the first word and look it up
    await page.locator('.ProseMirror p').getByText('Quick brown fox').dblclick({ position: { x: 12, y: 8 } });
    await page.getByRole('button', { name: 'Look up a word' }).click();
    const panel = page.getByRole('complementary', { name: 'Word lookup' });
    await expect(panel.getByRole('heading', { name: 'Quick' })).toBeVisible();
    await expect(panel).toContainText('Fast in motion.');
    await expect(panel).toContainText('/kwɪk/');
    // Only the word was sent
    expect(asked.every((u) => /quick/.test(u))).toBe(true);
    expect(asked.some((u) => u.includes('/entries/en/quick'))).toBe(true);

    // Choosing a similar word replaces it, with the same capital letter
    await panel.getByRole('button', { name: 'swift', exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator('.ProseMirror')).toContainText('Swift brown fox');
  });

  test('says so when there is no connection, and can be switched off in Preferences', async ({ page }) => {
    await page.route('https://api.dictionaryapi.dev/**', (route) => route.abort());
    await page.route('https://api.datamuse.com/**', (route) => route.abort());
    await signIn(page, 'lookup2@example.com', 'Write');
    await createProject(page, 'Offline Lookup');
    await addChapter(page, 'One');
    await typeInEditor(page, 'Somewhere');
    await page.getByRole('button', { name: 'Look up a word' }).click();
    await expect(page.getByRole('complementary', { name: 'Word lookup' }).getByText('Could not look that up')).toBeVisible();

    await page.goto('/#/preferences');
    await page.getByRole('checkbox', { name: /^Word lookup/ }).uncheck();
    await page.goto('/#/editor');
    await expect(page.getByRole('button', { name: 'Typewriter scrolling' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Look up a word' })).toHaveCount(0);
  });
});
