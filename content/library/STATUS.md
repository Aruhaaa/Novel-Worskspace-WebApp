# Sample library: what is done and what is not

Goal: 20 original sample novels, each 50,000+ words, across the site's 8 genres, shown in the Public Library. Written fiction, not placeholder text. Last updated 27 October 2026. Nothing is committed.

## Done

**Six novels, complete and built into the site** (`node scripts/build-library.mjs` accepted them; every chapter passes `scripts/chapter-check.mjs`; 422,850 words in all)

| Novel | Genre | Chapters | Words |
|---|---|---|---|
| The Salt Road Cartographers | Fantasy | 24 | 73,632 |
| Murder at the Marigold Bindery | Mystery | 26 | 64,678 |
| The Ninth Floor | Mystery | 28 | 72,626 |
| Zero-Day Lullaby | Thriller | 30 | 68,569 |
| Unit 4B Does Not Exist | Horror | 26 | 65,316 |
| The Marquess's Misprint | Romance | 24 | 78,029 |

They are in `src/data/library/` (`index.json` plus one JSON file per novel) and show up in the Public Library with a "Sample" badge. They have had no edit pass yet (continuity, repeated phrases); only some endings were spot-checked.

**Checks:** on 27 October (three novels) `npx tsc -b` and `npm run lint` were clean. On 29 October (six novels) `npx tsc -b` was clean and the sample-library plus reading browser tests passed 14 of 14 on the second run; the first run, on a cold dev server with the new data, failed 6 of the 9 sample-library tests and the same tests passed alone and on rerun, so treat it as a slow first start, not a confirmed bug. Lint and the rest of the e2e suite were not re-run.

**Tooling** (`scripts/`): chapter checker (single file or a range), Markdown-to-HTML conversion, and the build script that fails any novel under 50,000 words or missing chapters. `package.json` has `library:build` and `library:check`.

**Writing guide and briefs** (`content/library/`): `STYLE.md` and `briefs.json` (all 20 briefs; Fantasy 3, Mystery 3, Thriller 2, Horror 2, Romance 3, Sci-Fi 3, Historical 2, Contemporary 2).

**Website wiring** (done in the forked session): sample novels merged into the Public Library from `src/lib/bundledLibrary.ts`, never written to Supabase, likes and views kept on the device, generated cover per genre, "Sample" badge, no Report/Follow/Message for sample items, an off switch (`VITE_SAMPLE_LIBRARY=off`, or the Preferences choice).

**Plans written, no chapters yet:** The Tin Dragon's Apprentice, The River That Remembered (Fantasy); The Quiet Witness (Thriller). These plans have not had their editor review.

## Not done

- **14 novels** have no chapters: about 346 chapters, roughly 800,000 words.
  - Three have a plan (listed above).
  - A Fortnight of Rain in Kilmuir and What the Peat Kept have partial plans.
  - Nine have no plan or no folder: The Observatory at Verglas, The Cold Open, The Long Quiet, Seawall, Vessel Nine, After the Shaking, Forty Below, The Summer We Sold the House, Everyone Here Is Fine.
- **Edit pass** over finished novels.
- **Full e2e suite** not re-run since the sample library went in.
- **README and `limit.md` notes** about the sample library: not confirmed written.
- **Phone app** (`mobile/`) does not get the sample novels.
- Until the other 14 are written, the Public Library shows only these 6 sample novels. The site data is rebuilt from scratch each time with `node scripts/build-library.mjs`, and only complete novels go in.

## How to continue

Run the next novels two or three at a time, using the saved workflow script at `C:\Users\USER\.claude\projects\C--Users-USER-side2-novelist-workspace\26fae43f-0cc3-41f3-b052-beab18f2f95a\workflows\scripts\write-sample-library-wf_841bef83-b54.js`. Pass the novels as `args`; set `skipPlan` to true for ones whose plan exists. Finished chapters are skipped, so a run stopped by a usage limit can simply be started again. Then run `node scripts/build-library.mjs`.

Cost note: each group of three novels took roughly 7 million agent tokens and hit the session limit about twice. Expect the same per group of three.
