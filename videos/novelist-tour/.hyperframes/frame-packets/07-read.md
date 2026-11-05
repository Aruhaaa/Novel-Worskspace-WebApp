# Frame packet: 07-read

## Project inputs

- Project: C:\Users\USER\side2\novelist-workspace\videos\novelist-tour
- Design tokens: C:\Users\USER\side2\novelist-workspace\videos\novelist-tour\frame.md
- RULES_DIR: C:\Users\USER\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 7 — Read

- scene: The library, then a chapter of a novel read in light and then in the dark theme
- duration: 8s
- transition_in: crossfade
- status: built
- src: compositions/frames/07-read.html
- voiceover: "Then read. Other writers' novels, in the light or the dark, opening where you left off."
- asset_candidates: assets/web-11-library.png — Stories from other rooms, six novel cards; assets/web-12-reader-light.png — reading with a drop cap; assets/web-12-reader-dark.png — the same chapter in the dark with reading settings; assets/web-13-reader-home.png — Continue reading
- sound: soft piano; the light-to-dark change is a slow warm swell, not a click
- blueprint: compose
- focal: assets/web-12-reader-light.png
- roles: web-12-reader-light = cutout (left page, crop 600,170,700,800) · web-12-reader-dark = cutout (right page beside it, the same crop, plus the reading-settings panel crop 1650,100,270,240) · web-11-library = supporting (upper right, small: the cards crop 235,265,610,300) · web-13-reader-home = supporting (lower right: the Continue reading crop 480,190,1000,200)
- sfx: paper-soft at 0.4s; warm-swell at 3.7s; slide-soft at 5.0s
- handoff_in: none

Compose: the second room is reading. One page opens large in light and, as the voice says "the dark", the same page opens beside it in the dark through a soft warm wipe. The library and the Continue list are the small supporting cards on the right.
Scene 1 (0.0–1.4s): eyebrow "05 · READ"; the light reader page opens large at the left on the voice's "Then read" (0.5–1.3s). Layout: asymmetric 60/40, the pages in the left 60%, the small cards in the right column.
Scene 2 (1.4–2.8s): as the voice says "Other writers' novels" (1.3–2.7s), the library card fades in small at the upper right (1.4–2.2s).
Scene 3 (2.8–4.8s): the headline "Light, or" / "*the dark.*" enters on "in the light or the dark" (2.8–4.0s): "Light, or" at 3.2s, "the dark." at 3.9s. On "dark" (3.9s) a soft warm wipe (a slow clip reveal from left to right, 3.9–5.0s, matched to the slow swell of the music, not a click) opens the dark page beside the light one; its reading-settings panel crop settles in at the end of the wipe.
Scene 4 (4.8–6.6s): as the voice says "opening where you left off" (4.3–6.2s), the Continue reading card slides up into the lower right (5.0–5.7s).
Scene 5 (6.6–8.0s): hold: two pages, the library card and the Continue card all still.
