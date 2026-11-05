---
format: 1920x1080
duration: 58s
message: "A quiet place to write a novel, and to read one: on the website and on your phone."
arc: Cover → Contents → Write → Plan → Track → In and out → Read → Two doors → Close
audience: writers and readers deciding whether Novelist Workspace is for them
mode: collaborative
music: none
---

## Locked

The nine layouts in `storyboard.html` (sheet v1, "Looks right, lock it") are the approved compositions: placement, hierarchy and copy stay. Direction change (the user, after the first audio pass): **no narration in the film** and a **cinematic, dramatic** treatment of motion. The recorded narration (Kokoro `bf_emma`) is kept untouched in `assets/voice/` and `SCRIPT.md` but is not mounted (`audio_meta.json` `voices: []`; the clips are listed in `audio_meta.voices-archive.json`). Sound is now music and effects only, composed by the host and listed as `"source": "host"`. With no voice to carry the story, the on-screen words do: each frame's headline (from the locked sketch) plus one short line where the sketch had one. Lengths were re-cut to a beat grid: 96 BPM, one beat = 0.625s, one bar = 2.5s, so every cut and hit lands on the music. Total 57.5s.

## Video direction

**What it is.** A cinematic tour of the real app, shown as it is. Not a promo: no price, link, sign-up word or hype copy. But it is directed like a film: a dramatic cold open, camera that moves with intent, hits that land on the beat, and a quiet resolution. The screens stay the real captured screenshots, never redrawn. They are shown the way frame.md draws a card: a one-pixel gold hairline border, a faint white overlay, square corners, no shadow. Phones are the one exception: a plain thin dark bezel with rounded corners, no status bar. Rings are the only decoration (frame.md `geo-ring`, at most two per frame).

**Palette (frame.md, by role).** Ground = `bg-primary` paper (#F5F2EB). Ink = `text-primary` (#262722), also used as the dark cold-open ground in frame 1 and as the phone bezel. Captions = `text-secondary` (#5A5A5A). The one accent is `accent` oxblood (#813F38): italic half of a headline, eyebrow, markers. Rules and borders = `line` gold (#E7CF93). `bg-secondary` warm paper (#F1E4C2) for quiet fills. No gradients, glows or new colours. The drama comes from scale, light-to-dark, camera and timing, not from decoration.

**Type (frame.md, by role).** `display` Instrument Serif for headlines: roman first half, *italic oxblood* second half. DM Sans for eyebrows (letter-spaced capitals) and short captions. Visible text is only short copy: eyebrow, headline, a caption of a few words, and (where the locked sketch had one) a single short supporting line.

**Shared furniture.** The same eyebrow at the same spot in every frame (top left, chapter number and name, oxblood capitals). The headline hangs under it, left-aligned, two lines. Content stays in the upper 85% of the canvas.

**Motion grammar (cinematic).**
- *Headline slam.* Each headline word arrives from a larger scale with a focus pull (scale 1.3→1, blur 14px→0, opacity 0→1) on a fast attack and long settle (`power4.out`), one word per beat. This is the film's signature move; it lands exactly on a music hit.
- *Cards whip in.* Screens arrive from off-axis with distance (60–160px) and a slight scale-down (1.10→1) on `expo.out`; mirrored rotation only where the blueprint asks.
- *One camera.* Every frame has one continuous slow push-in on its whole content (scale 1→1.04 over the frame), set in the direction that suits the beat; legs inside it (frame 3) are decisive moves between named targets, decelerating hard into each stop.
- *Hits.* On the big beats a 2–3 px deterministic shake decays in 0.3s over the whole content (frames 1, 5, 8). Nothing shakes at the smaller beats.
- *Between frames.* Real transitions, not a slow fade: zoom-through into Contents and into the phones, push-slides (left or up) between the working rooms, a squeeze into Track, a soft blur-dissolve back to the quiet at the end.
- All motion is paused-timeline GSAP, seek-safe, `fromTo`, no `repeat`, no random. Smooth long-tail settles; no springy overshoot.

**Rhythm.** Frames 1 and 9 mirror each other (a cold dark open that breaks into paper; a calm quiet resolve). The build: 2–3 gather, 4–6 drive (more hits, faster legs), 7 is the breath (the dark theme arrives slowly on a swell), 8 is the climax (the biggest hit, four phones), 9 resolves. The last frame ends held, no exit.

**Sound (music and effects only).** One cinematic cue in D minor at 96 BPM: sub drone and riser into the first impact (2.5s), a heartbeat pulse and plucked arpeggio that gather through the working rooms, a breakdown for the reading frame, the climax hit at 45s, a major-key resolve at the end. Effects are woven to the picture: headline slams, whooshes on every card and camera move, ticks, taps, the sprint chime. No voice.

**Negative list.** No narration, price, link, URL, sign-up word or call to action. No logos or screens that are not the app's. No stock photos, glow, gradients, bokeh. No browser chrome, no cursor. No spinning or looping, no random, no CSS transitions. No front-loaded canvas that then freezes: each frame keeps developing on the beat.

## Frame 1 — Cover

- scene: A dark cold open breaks into paper on the app's own line, "A little room. A whole world."
- duration: 5s
- transition_in: cut
- status: built
- src: compositions/frames/01-cover.html
- asset_candidates: assets/quiet-landscape.svg — the app's calm sign-in artwork, quiet backdrop; assets/logo-mark.svg — the oxblood n mark
- sound: sub drone and a riser into the first impact at 2.5s; a second, softer hit at 3.125s
- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/logo-mark.svg
- roles: logo-mark = cutout (the dark opening: the small n mark, then the wordmark lockup lower left) · quiet-landscape = cutout (right of centre, with a thin gold ring behind it)
- sfx: riser 0.0–2.5s; impact 2.5s; slam 3.125s; whoosh-up 3.2s
- handoff_out: none, the zoom-through takes the outgoing frame

Adapt: keep the mark that assembles and resolves into a centred-then-settled lockup, preceded by a held, tense dark. The mark draws first; the lines slam in after it.
Scene 1 (0.0–2.5s): ink ground (`text-primary`). The oxblood n mark (assets/logo-mark.svg) fades up dead centre by 0.4s, a thin gold ring **self-draws** around it (`svg-path-draw`, 0.3–2.3s), the mark swells slowly (1→1.18) like a held breath. Centred, one thing on screen, about 12% of the frame. No text.
Scene 2 (2.5–3.1s): on the downbeat the dark breaks: a paper-coloured circle expands from the mark to cover the frame (`power4.out`, 0.7s), the mark shrinks and is gone, and the eyebrow "NOVELIST WORKSPACE" and the faint gold ring appear on paper. The whole frame gives one 3 px shake.
Scene 3 (2.5–3.9s): line one "A little room." slams in word by word (**headline slam**, the first word on the downbeat at 2.6s), roman, ink, left aligned, display size. Asymmetric 60/40 with the landscape to come in the right 40%.
Scene 4 (3.1–4.4s): on the next beat (3.125s) line two "A whole world." slams in, oxblood italic; the landscape rises behind-right and fades in (3.2–4.4s) as a gold dashed ring **self-draws** around it; the wordmark lockup (n mark + "novelist · workspace") fades in at lower left at 3.9s.
Scene 5 (4.4–5.0s): hold; the slow push-in continues under it to the end (scale 1→1.04 over the whole of scenes 3–5).

## Frame 2 — Contents

- scene: A contents page lists the chapters of the tour, with the Read | Write switch from the app's header beside it
- duration: 5s
- transition_in: zoom-through 0.4s
- status: built
- src: compositions/frames/02-contents.html
- asset_candidates: assets/web-01-home.png — crop of the Read | Write switch and the welcome heading; assets/logo-mark.svg — the n mark
- sound: the pulse and the plucked arpeggio start; a tick as each contents line draws
- blueprint: grid-card-assemble (Adapt)
- focal: assets/web-01-home.png
- roles: web-01-home = cutout (two crops stacked at right: the header switch above, the "Welcome back" heading below) · logo-mark = supporting (not used on screen in this cut; frame 1 carries the mark)
- sfx: slam 0.3s and 0.9s; tick 1.25s, 1.45s, 1.65s, 1.85s, 2.05s, 2.25s; whoosh 2.45s; whoosh 3.1s; tap 3.4s; tap 4.2s
- handoff_in: none, the zoom-through is injected over the cover

Adapt: keep the cascade that assembles a vertical list line by line; here it runs fast, a drumroll of six lines on the beat, each hairline drawing before its words.
Scene 1 (0.0–1.2s): eyebrow "CONTENTS" and the headline "Two rooms," then "one door." slam in (**headline slam**, 0.3s and 0.9s). Asymmetric 60/40: type and list in the left column, the screen crops in the right.
Scene 2 (1.25–2.45s): the six contents lines drop in as a fast cascade, one every 0.2s: each hairline sweeps left to right first (`svg-path-draw` idea on a rule), then its number (oxblood, Instrument Serif) and its name (01 Write · 02 Plan · 03 Track · 04 In and out · 05 Read · 06 Two doors) snap up 24px into place.
Scene 3 (2.5–3.3s): on the downbeat the header switch crop whips in from the right (`expo.out`, 1.10→1, blur to sharp) and the "Welcome back" crop follows at 3.1s from below, each with its short caption.
Scene 4 (3.4–4.8s): an oxblood ring draws around the Write half of the switch (3.4s) while line 01 "Write" turns oxblood; at 4.2s the ring glides across to the Read half and line 05 "Read" turns oxblood, line 01 returns to ink. Hold to 5.0s under a slow push-in.

## Frame 3 — Write

- scene: The editor opens on chapter 3, Lantern Hill; the camera moves from the page to the margin notes beside it
- duration: 7.5s
- transition_in: push-slide LEFT 0.5s
- status: built
- src: compositions/frames/03-write.html
- asset_candidates: assets/web-02-editor.png — the manuscript editor, the paper and the In the margins rail
- sound: the arpeggio and the pulse; a soft typing pattern under the camera legs; a whoosh at each leg
- blueprint: camera-journey (Adapt)
- focal: assets/web-02-editor.png
- roles: web-02-editor = cutout (the whole editor as one large card, right of the headline, which the camera then travels across; regions in 1920×1080 screenshot coordinates: the paper (590,225,720,830), the chapter list (0,430,230,380), the margin rail (1665,100,260,980))
- sfx: slam 0.3s and 0.9s; whoosh 0.4s; whoosh 1.25s; typing 1.4–6.2s; whoosh 3.125s; whoosh 4.375s; whoosh 6.25s
- handoff_in: none

Adapt: keep the multi-leg motivated camera journey that travels one continuous world and lands held on its last stop. Two-dimensional legs only (push, swing, swing, pull back); the screen has to stay readable.
Scene 1 (0.0–1.25s): eyebrow "01 · WRITE"; the headline "A clean" then "page." slam in (0.3s, 0.9s); one supporting line in grey DM Sans fades up under it (1.0s). The editor card whips in from the right (0.4–1.4s, `expo.out`, scale 1.10→1). Asymmetric 70/30.
Scene 2 (1.25–2.9s): the camera pushes hard into the paper (`coordinate-target-zoom`, 0.95s, decelerating into the stop); label "1 · The page" lands at the card's lower edge.
Scene 3 (3.125–4.3s): on the beat the camera swings left to the chapter list (`viewport-change`, 0.8s); label becomes "2 · Chapters".
Scene 4 (4.375–6.0s): on the next bar-half the camera swings right across the page to the top of the margin rail (0.9s); label becomes "3 · In the margins". Hold on the rail.
Scene 5 (6.25–7.5s): one decelerating pull-back (1.0s) to the whole editor card; the labels stay; slow push resumes to the end.

## Frame 4 — Plan

- scene: Three ways to see the same novel in turn: chapter cards, an outline board, a notebook of people and places
- duration: 7.5s
- transition_in: push-slide UP 0.5s
- status: built
- src: compositions/frames/04-plan.html
- asset_candidates: assets/web-03-chapters.png — chapter index with status pills; assets/web-05-outline-board.png — the four-column scene board; assets/web-04-notebook.png — characters, places, items and lore
- sound: the music builds; a whoosh and a soft thud as each view arrives
- blueprint: compose
- focal: assets/web-03-chapters.png
- roles: web-03-chapters = cutout (first view, large, then slot 1 of the row) · web-05-outline-board = cutout (second view, slot 2) · web-04-notebook = cutout (third view, slot 3)
- sfx: slam 0.3s and 0.9s; whoosh 0.35s; whoosh 1.875s; thud 2.5s; whoosh 3.75s; thud 4.4s; whoosh 5.625s
- handoff_in: none

Compose: one hero card takes the stage on each beat, then shrinks into its slot in a row while the next whips in (`card-morph-anchor`, uniform scale and translate only). The row of three is the held read.
Scene 1 (0.0–1.8s): eyebrow "02 · PLAN"; the headline "Three ways to see" then "one novel." slam in (0.3s, 0.9s). The chapters card whips up from below-right to centre-right, large (0.35–1.3s), caption "Chapters". Hero card about 55% of the frame, type at the upper left.
Scene 2 (1.875–3.7s): the chapters card shrinks into slot 1 of a row of three along the lower half (0.7s, decelerating) while the outline board whips in from the right (`expo.out`) and lands large on the next beat, caption "A board of scenes".
Scene 3 (3.75–5.6s): the board shrinks into slot 2; the notebook whips in and lands large (4.4s), caption "A notebook of people and places".
Scene 4 (5.625–7.5s): the notebook shrinks into slot 3; the row of three rests under the headline with its three captions and one gold hairline beneath; slow push-in to the end.

## Frame 5 — Track

- scene: The writing chart and streak, then a sprint finishing with its summary card
- duration: 7.5s
- transition_in: squeeze 0.4s
- status: built
- src: compositions/frames/05-track.html
- asset_candidates: assets/web-07-tracker.png — totals, streak 5 days, 14-day chart, manuscript goal; assets/web-08c-sprint-done.png — the sprint summary card; assets/web-08b-sprint-running.png — the sprint pill counting down
- sound: a clock tick that ends on a soft chime when the sprint card lands; a drive of hats under it
- blueprint: compose
- focal: assets/web-07-tracker.png
- roles: web-07-tracker = cutout (large, left, with the streak card and the 14-day chart both visible) · web-08c-sprint-done = supporting (the summary card, right: crop 995,140,320,210) · web-08b-sprint-running = supporting (the pill, lower right: crop 1045,85,270,50)
- sfx: whoosh 0.1s; slam 0.4s; pencil 0.9s; slam 1.9s; clock-tick 2.0–3.0s; chime 3.125s; thud 3.125s; slam 4.4s; riser 4.4–6.0s
- handoff_in: none

Compose: two proofs of progress of different weight, the long view and the short one; the headline builds one word per beat. Emphasis uses the marker patterns (`css-marker-patterns`); the chart reveal is a left-to-right wipe (`stat-bars-and-fills` idea, a mask, not a redraw).
Scene 1 (0.0–1.8s): eyebrow "03 · TRACK"; the tracker card whips in from the left (0.1–1.0s). The headline word "Streak." slams in (0.4s) and a hand-drawn oxblood circle (`css-marker-patterns`, circle) closes around the streak-days card at 0.9s; a soft shake on the hit. Asymmetric 60/40, the tracker in the left 60%.
Scene 2 (1.875–3.0s): "Sprint." slams in (1.9s) on the beat; the countdown pill slides in at lower right while the clock ticks, one tick every 0.3s.
Scene 3 (3.125–4.3s): on the downbeat the sprint summary card slams in above the pill (chime, thud, 3 px shake); the pill steps back.
Scene 4 (4.375–6.0s): "Words." slams in (italic, oxblood) and the chart's wipe retracts left to right across the 14-day chart (4.4–5.7s) so the line draws itself; a riser builds under it.
Scene 5 (6.0–7.5s): hold, streak, summary card and chart all in place; slow push-in to the end.

## Frame 6 — In and out

- scene: A Word file is split into chapters; then the export choices appear
- duration: 5s
- transition_in: push-slide LEFT 0.5s
- status: built
- src: compositions/frames/06-in-and-out.html
- asset_candidates: assets/web-09b-import-review.png — importing the-lamp-year.docx, 4 chapters found; assets/web-10-export.png — Word, e-book, PDF, text, backup
- sound: a whoosh in on the left, a whoosh out on the right, a hit as the export dialog lands
- blueprint: comparison-split (Adapt)
- focal: assets/web-09b-import-review.png
- roles: web-09b-import-review = cutout (left dialog, crop 620,100,680,880) · web-10-export = cutout (right dialog, centre crop)
- sfx: slam 0.3s; whoosh 0.3s; tick 1.25s, 1.45s, 1.65s, 1.85s; whoosh 2.45s; slam 2.5s; thud 2.5s
- handoff_in: none

Adapt: keep the two equal cards arriving from opposite wings with mirrored tilts that settle flat; the tilt is small so every word stays readable. The arrow draws across between them.
Scene 1 (0.0–2.4s): eyebrow "04 · IN AND OUT"; the headline "Bring it in." slams (0.3s). The import dialog whips in from the left (0.3–1.3s, `expo.out`) with a small mirrored tilt that settles flat; the four chapter rows reveal top to bottom on the beat (1.25–2.0s, a masked wipe) and its caption "the-lamp-year.docx → 4 chapters" fades in. Split-screen, two equal cards, the left first.
Scene 2 (2.0–2.5s): a thin oxblood arrow **draws across** the gap (`svg-path-draw`, 2.0–2.5s).
Scene 3 (2.5–3.6s): on the downbeat "Send it out." slams in (oxblood italic) and the export dialog whips in from the right (2.5–3.5s) with the mirrored tilt, 3 px shake on the hit, its caption "Word · e-book · PDF · text · backup".
Scene 4 (3.6–5.0s): hold, both dialogs flat and still, slow push-in to the end.

## Frame 7 — Read

- scene: The library, then a chapter of a novel read in light and then in the dark theme
- duration: 7.5s
- transition_in: push-slide UP 0.5s
- status: built
- src: compositions/frames/07-read.html
- asset_candidates: assets/web-11-library.png — Stories from other rooms, six novel cards; assets/web-12-reader-light.png — reading with a drop cap; assets/web-12-reader-dark.png — the same chapter in the dark with reading settings; assets/web-13-reader-home.png — Continue reading
- sound: the breath of the piece: the pulse drops away to pad and sparse piano; a slow warm swell carries the light-to-dark change; a riser leans into the next frame's hit
- blueprint: compose
- focal: assets/web-12-reader-light.png
- roles: web-12-reader-light = cutout (left page, crop 600,170,700,560) · web-12-reader-dark = cutout (right page beside it, the same crop; plus the reading-settings crop 1650,100,270,240) · web-11-library = supporting (upper right, small: crop 235,265,610,300) · web-13-reader-home = supporting (lower right: the Continue reading crop 480,190,1000,200)
- sfx: whoosh 0.3s; whoosh 1.2s; slam 1.9s and 2.5s; warm-swell 2.5s; whoosh 4.2s; whoosh 4.6s; riser 5.0–7.5s
- handoff_in: none

Compose: the breath. One page opens in light; the same page opens beside it in the dark through a slow, soft wipe; the library and the Continue list are the small supporting cards on the right.
Scene 1 (0.0–1.8s): eyebrow "05 · READ"; the light reader page rises from below (0.3–1.3s, `expo.out`); the library card whips in at upper right (1.2s). Asymmetric 60/40, the pages in the left 60%.
Scene 2 (1.875–2.5s): the headline "Light, or" slams in (1.9s).
Scene 3 (2.5–4.5s): on the downbeat "the dark." slams in (oxblood italic) and a soft warm wipe (a slow clip reveal left to right with a feathered edge, 2.5–4.0s) opens the dark page beside the light one, matched to the swell; its reading-settings crop settles in at the end of the wipe (4.2s).
Scene 4 (4.4–7.5s): the Continue reading card slides up into the lower right (4.6s). Hold, slow push-in; a riser builds under it into the next frame.

## Frame 8 — Two doors

- scene: The phone app appears beside the website: discover, a project with chapters, the notebook
- duration: 7.5s
- transition_in: zoom-through 0.4s
- status: built
- src: compositions/frames/08-two-doors.html
- asset_candidates: assets/phone-p01-discover.png — Read tab on the phone; assets/phone-p06-project.png — a project with today's goal and chapters; assets/phone-p08-notebook.png — the world notebook; assets/phone-p10-me.png — Me with themes; assets/phone-p12-discover-dark.png — Discover in the dark theme
- sound: the climax: the big hit on the zoom-through at the start, the piano line rises one step; a tap and a thud as each phone lands
- blueprint: grid-card-assemble (Adapt)
- focal: assets/phone-p06-project.png
- roles: phone-p01-discover = cutout (phone 1) · phone-p06-project = cutout (phone 2) · phone-p08-notebook = cutout (phone 3) · phone-p12-discover-dark = cutout (phone 4, the last one, in the dark theme) · phone-p10-me = supporting (kept in reserve, not on screen in this cut; the four-phone row is the locked layout)
- sfx: slam 0.3s and 0.9s; whoosh 0.6s; tap 0.7s, 1.3s, 1.9s, 2.5s; thud 2.5s
- handoff_in: none

Adapt: keep the staggered cascade where each item arrives on its own beat and settles into a row that then holds. The items are four phones.
Scene 1 (0.0–1.2s): eyebrow "06 · TWO DOORS"; the headline "The same novels," slams in (0.3s). Phone 1 (Discover) rises into place (0.6s). The small app tab names (READ · WRITE · ME) are set small in a column at the left.
Scene 2 (1.25–2.5s): phone 2 (the project with chapters) rises at 1.25s, phone 3 (the notebook) at 1.875s, each a beat apart with its tap.
Scene 3 (2.5–3.6s): on the next downbeat phone 4 (Discover in the dark) rises and "on your phone." slams in (oxblood italic); a 3 px shake.
Scene 4 (3.6–7.5s): hold. Four phones in a row; the whole row drifts a few pixels left over the hold (parallax against the headline) and the slow push-in carries to the end.

## Frame 9 — Close

- scene: The cover closes on the app's line and its name
- duration: 5s
- transition_in: blur-crossfade 0.6s
- status: built
- src: compositions/frames/09-close.html
- asset_candidates: assets/quiet-landscape.svg — the quiet closing picture; assets/logo-mark.svg — the n mark
- sound: everything falls away to a single piano line and a pad; the last chord rings out under it, then room tone
- blueprint: titlecard-reveal (Adapt)
- focal: assets/quiet-landscape.svg
- roles: quiet-landscape = background (a very faint, large ring and landscape behind the lines, about 12% strength) · logo-mark = supporting (a small wordmark lockup under the lines)
- sfx: slam-soft 0.5s and 1.2s
- handoff_in: none, a soft blur-dissolve; the lines echo frame 1 but centred and lighter

Adapt: keep the one calm move and the still hold; the move is the opening lines coming back, lighter and slower, centred this time, and the frame ends held with no exit. After all the drive, this is the exhale.
Scene 1 (0.0–0.6s): the paper ground with the faint landscape ring behind it; the tiny "THE END" and a thin gold hairline across the bottom are quietly there. Centred, two lines in the middle of the frame.
Scene 2 (0.5–2.0s): "A little room." enters (**headline slam**, softer: scale 1.12→1, blur 8px→0, 0.5s) in ink; "A whole world." follows at 1.2s in oxblood italic.
Scene 3 (1.9–2.6s): the n mark wordmark lockup fades in under the lines. Hold still to the end under a very slow push-in; no fade out, no exit.
