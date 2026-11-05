// Writes storyboard.html: the one-page sketch sheet of every scene (static layouts, no motion, no scripts).
// Everything is drawn in a 1920x1080 space and converted to cqw, so the sheet matches the build.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storyboard.html');
const VERSION = process.env.SHEET_VERSION || 'v1';

const px = (n) => `${(n / 19.2).toFixed(3)}cqw`;
const box = (x, y, w, h) => `left:${px(x)};top:${px(y)};width:${px(w)};${h ? `height:${px(h)};` : ''}`;

// Text
const text = (str, x, y, w, { size = 24, family = 'sans', color = 'var(--ink)', weight = 400, italic = false, track = 0, upper = false, align = 'left', lh = 1.15 } = {}) =>
  `<div class="t" style="${box(x, y, w)}font-size:${px(size)};font-family:var(--${family});font-weight:${weight};font-style:${italic ? 'italic' : 'normal'};color:${color};letter-spacing:${px(track)};text-transform:${upper ? 'uppercase' : 'none'};text-align:${align};line-height:${lh}">${str}</div>`;
const label = (str, x, y, w = 700) => text(str, x, y, w, { size: 22, color: 'var(--accent)', weight: 500, track: 4, upper: true });

// A picture, or a cropped part of one. `crop` is [x, y, w, h] in the screenshot's 1920x1080 space.
const pic = (name, x, y, w, crop, { ratio = 16 / 9, frame = true } = {}) => {
  const src = `capture/thumbs/${name}.jpg`;
  if (!crop) {
    return `<div class="pic${frame ? ' framed' : ''}" style="${box(x, y, w, w / ratio)}background-image:url('${src}');background-size:100% 100%"></div>`;
  }
  const [cx, cy, cw, ch] = crop;
  const h = (w * ch) / cw;
  const size = `${((1920 / cw) * 100).toFixed(2)}% auto`;
  const posX = cw >= 1920 ? 0 : (cx / (1920 - cw)) * 100;
  const posY = ch >= 1080 ? 0 : (cy / (1080 - ch)) * 100;
  return `<div class="pic${frame ? ' framed' : ''}" style="${box(x, y, w, h)}background-image:url('${src}');background-size:${size};background-position:${posX.toFixed(2)}% ${posY.toFixed(2)}%"></div>`;
};

const phone = (name, x, y, w = 300) =>
  `<div class="phone" style="${box(x, y, w, (w * 844) / 390)}"><div class="screen" style="background-image:url('capture/thumbs/${name}.jpg')"></div></div>`;

const hair = (x, y, w, h = 0) => `<div class="hair" style="${box(x, y, w, h || 1)}${h ? 'width:1px;' : ''}"></div>`;
const ring = (cx, cy, d, o = 0.5) => `<div class="ring" style="left:${px(cx - d / 2)};top:${px(cy - d / 2)};width:${px(d)};height:${px(d)};opacity:${o}"></div>`;
const pin = (n, x, y) => `<div class="pin" style="left:${px(x)};top:${px(y)};width:${px(44)};height:${px(44)};font-size:${px(22)}">${n}</div>`;
const wordmark = (x, y) =>
  `<div class="wm" style="left:${px(x)};top:${px(y)}"><span class="wm-n" style="font-size:${px(40)};width:${px(64)};height:${px(64)}">n.</span><span class="wm-t"><b style="font-size:${px(34)}">novelist</b><i style="font-size:${px(11)}">WORKSPACE</i></span></div>`;

const cells = [];
const cell = (n, name, time, stage, note, seam) => cells.push({ n, name, time, stage, note, seam });

// 1 — Cover
cell(
  1, 'Cover', '0:00–0:04',
  [
    ring(1513, 489, 760, 0.45),
    label('Novelist Workspace', 134, 124),
    text('A little room.', 134, 330, 1100, { size: 200, family: 'serif', lh: 1 }),
    text('A whole world.', 134, 540, 1100, { size: 200, family: 'serif', italic: true, color: 'var(--accent)', lh: 1 }),
    `<div class="pic framed art" style="${box(1240, 180, 546, 618)}background-image:url('capture/assets/quiet-landscape.svg');background-size:cover"></div>`,
    wordmark(134, 900),
  ].join(''),
  '<b>First to move:</b> the page fades up from paper, then the two lines draw in one after the other, the second on the word “world”. The landscape slides up a little behind them.',
  'cut in (first frame)'
);

// 2 — Contents
cell(
  2, 'Contents', '0:04–0:10',
  [
    label('Contents', 134, 120),
    text('Two rooms,<br><i>one door.</i>', 134, 180, 800, { size: 112, family: 'serif', lh: 1.02 }),
    ...['Write', 'Plan', 'Track', 'In and out', 'Read', 'Two doors'].map((t, i) =>
      [hair(134, 520 + i * 84, 760), text(`0${i + 1}`, 134, 530 + i * 84, 90, { size: 44, family: 'serif', color: 'var(--accent)' }), text(t, 230, 532 + i * 84, 600, { size: 44, family: 'serif' })].join('')
    ),
    hair(134, 520 + 6 * 84, 760),
    pic('web-01-home', 1000, 190, 780, [200, 0, 300, 72], { ratio: 300 / 72 }),
    text('The Read | Write switch, in the app’s header', 1000, 396, 780, { size: 22, color: 'var(--ink2)' }),
    pic('web-01-home', 1000, 500, 780, [440, 130, 720, 110], { ratio: 720 / 110 }),
    text('“Welcome back, Mira Vale.”', 1000, 636, 780, { size: 22, color: 'var(--ink2)' }),
  ].join(''),
  '<b>First to move:</b> the six contents lines draw in one by one, each hairline first. The header switch pushes in from the right and the “Write” half lights up as the voice says “write”.',
  'crossfade'
);

// 3 — Write
cell(
  3, 'Write', '0:10–0:20',
  [
    label('01 · Write', 134, 124),
    text('A clean<br>page.', 134, 190, 420, { size: 112, family: 'serif', lh: 1.02 }),
    text('Your chapters beside you.<br>Your private notes in the margin.', 134, 470, 420, { size: 26, color: 'var(--ink2)', lh: 1.45 }),
    pic('web-02-editor', 600, 100, 1220),
    pin(1, 1070, 330), text('the page', 1124, 338, 300, { size: 24, color: 'var(--accent)', weight: 500 }),
    pin(2, 620, 480), text('chapters', 674, 488, 300, { size: 24, color: 'var(--accent)', weight: 500 }),
    pin(3, 1640, 330), text('margin', 1694, 338, 140, { size: 24, color: 'var(--accent)', weight: 500 }),
  ].join(''),
  '<b>First to move:</b> the editor slides in from the right; the camera pushes into the paper (1), drifts left to the chapter list (2), then right to the margin rail (3). Typing sound under it.',
  'crossfade'
);

// 4 — Plan
cell(
  4, 'Plan', '0:20–0:29',
  [
    label('02 · Plan', 134, 124),
    text('Three ways to see<br><i>one novel.</i>', 134, 180, 1300, { size: 100, family: 'serif', lh: 1.02 }),
    pic('web-03-chapters', 134, 470, 540),
    text('Chapters', 134, 800, 540, { size: 44, family: 'serif' }),
    pic('web-05-outline-board', 690, 470, 540),
    text('A board of scenes', 690, 800, 540, { size: 44, family: 'serif' }),
    pic('web-04-notebook', 1246, 470, 540),
    text('A notebook of people and places', 1246, 800, 560, { size: 44, family: 'serif' }),
    hair(134, 900, 1652),
  ].join(''),
  '<b>First to move:</b> only the first card is on screen, large; as the voice names each way, the card shrinks into its place in the row and the next one takes the stage. A page-turn sound between them.',
  'crossfade'
);

// 5 — Track
cell(
  5, 'Track', '0:29–0:37',
  [
    label('03 · Track', 134, 124),
    text('Streak. Sprint.<br><i>Words.</i>', 134, 180, 900, { size: 100, family: 'serif', lh: 1.02 }),
    pic('web-07-tracker', 134, 440, 1060, [470, 300, 1210, 680], { ratio: 1210 / 680 }),
    pic('web-08c-sprint-done', 1260, 440, 520, [995, 140, 320, 210], { ratio: 320 / 210 }),
    text('478 words · goal of 400 reached', 1260, 800, 520, { size: 34, family: 'serif', lh: 1.1 }),
    pic('web-08b-sprint-running', 1260, 880, 520, [1045, 85, 270, 50], { ratio: 270 / 50 }),
    text('The sprint pill, counting down', 1260, 960, 520, { size: 20, color: 'var(--ink2)' }),
  ].join(''),
  '<b>First to move:</b> the tracker settles in with the chart line drawing left to right and the streak number counting up to 5. Then the sprint card pops up on the right with a soft chime.',
  'crossfade'
);

// 6 — In and out
cell(
  6, 'In and out', '0:37–0:43',
  [
    label('04 · In and out', 134, 124),
    text('Bring it in.<br><i>Send it out.</i>', 134, 190, 480, { size: 84, family: 'serif', lh: 1.04 }),
    text('A Word file in, split into chapters you check first. Out as Word, an e-book, a PDF, text or a full backup.', 134, 470, 440, { size: 24, color: 'var(--ink2)', lh: 1.5 }),
    pic('web-09b-import-review', 660, 150, 440, [620, 99, 680, 882], { ratio: 680 / 882 }),
    text('the-lamp-year.docx → 4 chapters', 660, 790, 460, { size: 22, color: 'var(--accent)', weight: 500 }),
    hair(1130, 470, 130),
    text('→', 1170, 430, 100, { size: 60, family: 'serif', color: 'var(--accent)' }),
    pic('web-10-export', 1290, 150, 440, [640, 124, 640, 830], { ratio: 640 / 830 }),
    text('Word · e-book · PDF · text · backup', 1290, 790, 480, { size: 22, color: 'var(--accent)', weight: 500 }),
  ].join(''),
  '<b>First to move:</b> the import dialog slides in from the left and its four chapters tick in; then an arrow draws across and the export dialog slides in from the right.',
  'crossfade'
);

// 7 — Read
cell(
  7, 'Read', '0:43–0:51',
  [
    label('05 · Read', 134, 124),
    text('Light, or<br><i>the dark.</i>', 134, 180, 700, { size: 100, family: 'serif', lh: 1.02 }),
    pic('web-12-reader-light', 134, 450, 620, [600, 150, 720, 900], { ratio: 720 / 900 }),
    pic('web-12-reader-dark', 780, 450, 620, [600, 150, 720, 900], { ratio: 720 / 900 }),
    pic('web-13-reader-home', 1440, 450, 380, [480, 190, 1000, 330], { ratio: 1000 / 330 }),
    text('Continue reading: opens on the chapter you were on.', 1440, 590, 380, { size: 22, color: 'var(--ink2)', lh: 1.4 }),
    pic('web-11-library', 1440, 760, 380, [235, 265, 610, 300], { ratio: 610 / 300 }),
  ].join(''),
  '<b>First to move:</b> the library fades in small at the right while the reader opens large on the left in light; on “the dark”, a soft wipe turns the same page dark. The Continue list slides up last.',
  'crossfade'
);

// 8 — Two doors
cell(
  8, 'Two doors', '0:51–0:59',
  [
    label('06 · Two doors', 134, 124),
    text('The same novels,<br><i>on your phone.</i>', 134, 180, 1200, { size: 100, family: 'serif', lh: 1.02 }),
    phone('phone-p01-discover', 360, 400, 270),
    phone('phone-p06-project', 700, 400, 270),
    phone('phone-p08-notebook', 1040, 400, 270),
    phone('phone-p12-discover-dark', 1380, 400, 270),
    text('Read<br>Write<br>Me', 134, 440, 200, { size: 22, color: 'var(--ink2)', track: 3, upper: true, lh: 2 }),
  ].join(''),
  '<b>First to move:</b> the first phone rises into place, then the next three follow a beat apart, each with a soft tap sound. The last one shows the dark theme.',
  'crossfade'
);

// 9 — Close
cell(
  9, 'Close', '0:59–1:03',
  [
    ring(960, 540, 900, 0.35),
    text('A little room.', 160, 330, 1600, { size: 190, family: 'serif', align: 'center', lh: 1 }),
    text('A whole world.', 160, 520, 1600, { size: 190, family: 'serif', italic: true, color: 'var(--accent)', align: 'center', lh: 1 }),
    wordmark(790, 800),
    hair(134, 960, 1652),
    text('The end.', 134, 975, 400, { size: 20, color: 'var(--ink2)', track: 4, upper: true }),
  ].join(''),
  '<b>First to move:</b> the opening lines return, lighter and slower. The wordmark fades in under them and the last chord rings out.',
  'ends on a held frame'
);

const swatch = (name, hex) => `<div class="sw"><i style="background:${hex}"></i><span>${name}<br>${hex}</span></div>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Novelist Workspace tour: storyboard ${VERSION}</title>
<style>
@font-face{font-family:"Instrument Serif";font-weight:400;font-style:normal;src:url("assets/fonts/InstrumentSerif-Regular.ttf") format("truetype")}
@font-face{font-family:"Instrument Serif";font-weight:400;font-style:italic;src:url("assets/fonts/InstrumentSerif-Regular-Italic.ttf") format("truetype")}
@font-face{font-family:"DM Sans";font-weight:400;src:url("assets/fonts/DMSans-Regular.ttf") format("truetype")}
@font-face{font-family:"DM Sans";font-weight:500;src:url("assets/fonts/DMSans-Medium.ttf") format("truetype")}
@font-face{font-family:"DM Sans";font-weight:700;src:url("assets/fonts/DMSans-Bold.ttf") format("truetype")}
:root{--bg:#F5F2EB;--bg2:#F1E4C2;--ink:#262722;--ink2:#5A5A5A;--accent:#813F38;--line:#E7CF93;--serif:"Instrument Serif",Georgia,serif;--sans:"DM Sans",system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:#e9e4d9;color:var(--ink);font-family:var(--sans)}
header{max-width:1500px;margin:0 auto;padding:48px 32px 8px}
h1{font:400 56px/1.05 var(--serif);margin:0}
h1 i{color:var(--accent)}
.dek{color:var(--ink2);max-width:760px;line-height:1.55;margin:14px 0 18px}
.tag{display:inline-block;font:500 12px var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);border:1px solid var(--line);padding:6px 12px}
.grid{max-width:1500px;margin:0 auto;padding:24px 32px 64px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}
@media (max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){.grid{grid-template-columns:1fr}}
.card{background:#fbf9f4;border:1px solid var(--line);padding:0 0 14px}
.stage{position:relative;aspect-ratio:16/9;container-type:inline-size;background:var(--bg);overflow:hidden;border-bottom:1px solid var(--line)}
.t{position:absolute}
.pic{position:absolute;background-repeat:no-repeat;background-color:#e8e2d4}
.pic.framed{border:${px(2)} solid var(--line);box-shadow:none}
.phone{position:absolute;border:${px(3)} solid var(--ink);border-radius:${px(40)};padding:${px(8)};background:#fff}
.phone .screen{width:100%;height:100%;border-radius:${px(30)};background-size:100% 100%;background-repeat:no-repeat}
.hair{position:absolute;background:var(--line)}
.ring{position:absolute;border:1px solid var(--line);border-radius:50%}
.ring::before{content:"";position:absolute;inset:9%;border:1px dashed var(--line);border-radius:50%}
.pin{position:absolute;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-family:var(--sans);font-weight:700}
.wm{position:absolute;display:flex;align-items:center;gap:${px(16)}}
.wm-n{display:grid;place-items:center;border:1px solid var(--accent);color:var(--accent);font-family:var(--serif);font-style:italic}
.wm-t{display:grid;line-height:1}
.wm-t b{font-family:var(--serif);font-weight:400}
.wm-t i{font-style:normal;letter-spacing:.3em;color:var(--ink2);margin-top:4px}
.art{border:${px(2)} solid var(--line)}
.meta{padding:12px 16px 0}
.row{display:flex;justify-content:space-between;font:500 12px var(--sans);letter-spacing:.14em;text-transform:uppercase}
.row span:first-child{color:var(--accent)}
.row span:last-child{color:var(--ink2)}
.meta p{font-size:14px;line-height:1.5;color:var(--ink2);margin:8px 0 10px}
.meta p b{color:var(--ink)}
.chip{display:inline-block;font:500 11px var(--sans);letter-spacing:.14em;text-transform:uppercase;border:1px solid var(--line);padding:4px 10px;color:var(--ink2)}
.wide{grid-column:span 3}
@media (max-width:1100px){.wide{grid-column:span 2}}
@media (max-width:700px){.wide{grid-column:span 1}}
.seams{display:flex;flex-wrap:wrap;gap:10px 8px;padding:24px;align-items:center}
.seams .n{font:400 22px var(--serif);color:var(--accent)}
.seams .arrow{color:var(--ink2);font-size:13px}
.tokens{display:grid;grid-template-columns:2fr 2fr 3fr;gap:32px;padding:28px}
.tokens h3{font:500 12px var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0 0 12px}
.sw{display:flex;align-items:center;gap:10px;margin:0 0 8px;font-size:13px;color:var(--ink2)}
.sw i{width:30px;height:30px;border:1px solid var(--line)}
.type p{margin:0 0 10px}
.bans li{margin:0 0 6px;color:var(--ink2);font-size:14px}
</style></head><body>
<header>
  <h1>A little room. <i>A whole world.</i></h1>
  <p class="dek">Storyboard sketches for the Novelist Workspace tour. This is a tour of the real website and phone app, not a promo. Each cell is a static layout at its key moment, drawn in the video’s own colours and type; the small pictures are real screenshots. Nothing moves here: the note under each cell says what moves first.</p>
  <span class="tag">${VERSION} · 1920×1080 · 63 s · 9 scenes · voice, soft music and effects</span>
</header>
<main class="grid">
${cells
  .map(
    (c) => `<section class="card" id="frame-${String(c.n).padStart(2, '0')}">
  <div class="stage">${c.stage}</div>
  <div class="meta">
    <div class="row"><span>${String(c.n).padStart(2, '0')} · ${c.name}</span><span>frame-${String(c.n).padStart(2, '0')} · ${c.time}</span></div>
    <p>${c.note}</p>
    <span class="chip">seam: ${c.seam}</span>
  </div>
</section>`
  )
  .join('\n')}
<section class="card wide" id="seams">
  <div class="meta"><div class="row"><span>Seams</span><span>every hand-off on one strip</span></div></div>
  <div class="seams">
    ${cells.map((c, i) => `<span class="n">${String(c.n).padStart(2, '0')}</span><span class="chip">${c.name}</span>${i < cells.length - 1 ? '<span class="arrow">→</span>' : ''}`).join('')}
    <p style="flex-basis:100%;margin:6px 0 0;font-size:14px;color:var(--ink2)">One rule for the whole piece: slow crossfades, like turning a page. The only hard cut is the first frame, and the video ends on a held frame.</p>
  </div>
</section>
<section class="card wide" id="tokens">
  <div class="meta"><div class="row"><span>Look</span><span>from frame.md</span></div></div>
  <div class="tokens">
    <div><h3>Colour</h3>${swatch('paper', '#F5F2EB')}${swatch('warm paper', '#F1E4C2')}${swatch('ink', '#262722')}${swatch('grey ink', '#5A5A5A')}${swatch('oxblood (accent)', '#813F38')}${swatch('gold hairline', '#E7CF93')}</div>
    <div class="type"><h3>Type</h3><p style="font:400 44px/1 var(--serif)">Instrument Serif</p><p style="font:italic 400 36px/1 var(--serif);color:var(--accent)">for headlines and numbers</p><p style="font:500 16px var(--sans)">DM Sans for labels and small text</p><p style="font:400 14px var(--sans);color:var(--ink2)">Both are the app’s own fonts.</p></div>
    <div class="bans"><h3>Rules for this video</h3><ul><li>Real screens only. Nothing redrawn, nothing invented.</li><li>No sales words: no price, no “sign up now”, no hype.</li><li>No fast cuts, whooshes or bounce. Slow and quiet.</li><li>No stock photos, no glow, no gradients.</li><li>One held frame: the ending stays still while the last chord rings.</li></ul></div>
  </div>
</section>
</main>
</body></html>`;

writeFileSync(OUT, html);
console.log('wrote', OUT, `(${cells.length} scenes, ${VERSION})`);
