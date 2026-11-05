// Generates compositions/frames/NN-*.html and the pre-cropped screens in assets/crops/.
// Run from the project root: node capture-scripts/gen-frames.mjs
// Screens are real screenshots, only cropped and scaled (never redrawn).
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'compositions', 'frames')
const CROPS = join(ROOT, 'assets', 'crops')
mkdirSync(OUT, { recursive: true })
mkdirSync(CROPS, { recursive: true })

// ---- crops ---------------------------------------------------------------------
// x,y,w,h are in 1920x1080 space of a web screenshot (the PNG is 3840x2160, so x2).
const crops = {}
function crop(name, src, [x, y, w, h], displayW) {
  const outW = Math.min(w * 2, Math.round(displayW * 2))
  const file = join(CROPS, `${name}.png`)
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(ROOT, 'assets', src),
    '-vf', `crop=${w * 2}:${h * 2}:${x * 2}:${y * 2},scale=${outW}:-1:flags=lanczos`, file])
  if (r.status !== 0) throw new Error(`crop ${name} failed: ${r.stderr}`)
  crops[name] = { src: `assets/crops/${name}.png`, w: displayW, h: Math.round((displayW * h) / w) }
  return crops[name]
}
function phone(name, src, displayW) {
  const file = join(CROPS, `${name}.png`)
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(ROOT, 'assets', src),
    '-vf', `scale=${Math.round(displayW * 2)}:-1:flags=lanczos`, file])
  if (r.status !== 0) throw new Error(`phone ${name} failed: ${r.stderr}`)
  crops[name] = { src: `assets/crops/${name}.png`, w: displayW, h: Math.round((displayW * 2532) / 1170) }
  return crops[name]
}
function sample(src, x, y) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(ROOT, 'assets', src),
    '-vf', `crop=1:1:${x * 2}:${y * 2}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
  const b = r.stdout
  return `rgb(${b[0]},${b[1]},${b[2]})`
}

const C = {
  switch: crop('f02-switch', 'web-01-home.png', [165, 6, 290, 60], 700),
  welcome: crop('f02-welcome', 'web-01-home.png', [455, 125, 500, 100], 700),
  chapters: crop('f04-chapters', 'web-03-chapters.png', [440, 225, 1010, 631], 900),
  board: crop('f04-board', 'web-05-outline-board.png', [340, 285, 1220, 760], 900),
  notebook: crop('f04-notebook', 'web-04-notebook.png', [345, 265, 1210, 756], 900),
  tracker: crop('f05-tracker', 'web-07-tracker.png', [455, 290, 1240, 790], 1060),
  summary: crop('f05-summary', 'web-08c-sprint-done.png', [995, 140, 320, 210], 496),
  pill: crop('f05-pill', 'web-08b-sprint-running.png', [1045, 85, 270, 50], 496),
  imp: crop('f06-import', 'web-09b-import-review.png', [620, 100, 680, 880], 540),
  exp: crop('f06-export', 'web-10-export.png', [640, 124, 640, 832], 540),
  light: crop('f07-light', 'web-12-reader-light.png', [600, 170, 700, 560], 594),
  dark: crop('f07-dark', 'web-12-reader-dark.png', [600, 170, 700, 560], 594),
  settings: crop('f07-settings', 'web-12-reader-dark.png', [1650, 100, 270, 240], 300),
  library: crop('f07-library', 'web-11-library.png', [466, 125, 1215, 825], 396),
  cont: crop('f07-continue', 'web-13-reader-home.png', [466, 300, 1215, 300], 396),
  p1: phone('f08-p1', 'phone-p01-discover.png', 252),
  p2: phone('f08-p2', 'phone-p06-project.png', 252),
  p3: phone('f08-p3', 'phone-p08-notebook.png', 252),
  p4: phone('f08-p4', 'phone-p12-discover-dark.png', 252),
}
const PANEL = sample('web-07-tracker.png', 1299, 765)
const DIALOG = sample('web-09b-import-review.png', 700, 560)
console.log('sampled panel', PANEL, 'dialog', DIALOG)

// ---- shared shell ----------------------------------------------------------------
const FONTS = `@font-face{font-family:"DM Sans";font-weight:700;font-style:normal;font-display:block;src:url("assets/fonts/DMSans-Bold.ttf") format("truetype");}
@font-face{font-family:"DM Sans";font-weight:500;font-style:normal;font-display:block;src:url("assets/fonts/DMSans-Medium.ttf") format("truetype");}
@font-face{font-family:"DM Sans";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/DMSans-Regular.ttf") format("truetype");}
@font-face{font-family:"DM Sans";font-weight:600;font-style:normal;font-display:block;src:url("assets/fonts/DMSans-SemiBold.ttf") format("truetype");}
@font-face{font-family:"Instrument Serif";font-weight:400;font-style:italic;font-display:block;src:url("assets/fonts/InstrumentSerif-Regular-Italic.ttf") format("truetype");}
@font-face{font-family:"Instrument Serif";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/InstrumentSerif-Regular.ttf") format("truetype");}`

const BASE = `#root{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;font-family:"DM Sans",sans-serif;color:#262722}
#root *{box-sizing:border-box}
.bg{position:absolute;left:0;top:0;width:1920px;height:1080px;background:#F5F2EB}
.eyebrow{position:absolute;left:134px;top:118px;font:500 22px/1.15 "DM Sans",sans-serif;letter-spacing:4px;text-transform:uppercase;color:#813F38;white-space:nowrap}
.h{position:absolute;left:134px;font-family:"Instrument Serif",serif;font-weight:400;color:#262722;line-height:1.04;white-space:nowrap}
.h .l{display:block}
.h em{font-style:italic;color:#813F38}
.w{display:inline-block}
.cap{position:absolute;font:400 24px/1.3 "DM Sans",sans-serif;color:#5A5A5A;white-space:nowrap}
.card{position:absolute;border:1px solid #E7CF93;background:rgba(255,255,255,.3);overflow:hidden}
.card img{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.ring{position:absolute;border-radius:50%;border:1px solid #E7CF93}
.wm{position:absolute;display:flex;align-items:center;gap:16px;white-space:nowrap}
.wm .mk{width:54px;height:54px;display:block;background:url(assets/logo-mark.svg) center/contain no-repeat}
.wm .n{font-family:"Instrument Serif",serif;font-size:36px;line-height:1;color:#262722}
.wm .s{display:block;font:500 12px/1 "DM Sans",sans-serif;letter-spacing:5px;text-transform:uppercase;color:#5A5A5A;margin-top:6px}
svg{overflow:visible}`


function shell(id, dur, css, body, js, outer = '') {
  const p = id.slice(0, 2)
  return `<template>
  <style>
${FONTS}
${BASE}
.cam{position:absolute;left:0;top:0;width:1920px;height:1080px}
${css}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <div id="root" data-composition-id="${id}" data-start="0" data-duration="${dur}" data-width="1920" data-height="1080">
    <div id="f${p}-bg" class="clip bg" data-start="0" data-duration="${dur}" data-track-index="0"></div>
    <div id="f${p}-cam" class="cam">
${body}
    </div>
${outer}
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    const E = "power3.out";
    const IO = "power3.inOut";
    const CAM = "#f${p}-cam";
    gsap.set(CAM, { x: 0, y: 0, scale: 1, transformOrigin: "50% 50%" });
    // headline slam: each word arrives from a larger scale with a focus pull
    const slamLine = (sel, t, stagger = 0.1, dur = 0.75, blur = 14, from = 1.3) =>
      gsap.utils.toArray(sel + " .w").forEach((el, i) =>
        tl.fromTo(el, { opacity: 0, scale: from, filter: "blur(" + blur + "px)", transformOrigin: "0% 70%" },
          { opacity: 1, scale: 1, filter: "blur(0px)", duration: dur, ease: "power4.out" }, t + i * stagger));
    // a short, decaying shake of the whole content on a hit (deterministic)
    const shake = (t, a) => {
      tl.to(CAM, { x: a, y: -a * 0.6, duration: 0.04, ease: "none" }, t);
      tl.to(CAM, { x: -a * 0.8, y: a * 0.5, duration: 0.05, ease: "none" }, ">");
      tl.to(CAM, { x: a * 0.5, y: -a * 0.3, duration: 0.06, ease: "none" }, ">");
      tl.to(CAM, { x: 0, y: 0, duration: 0.18, ease: "power2.out" }, ">");
    };
    // one continuous, constant-speed push on all the content
    const push = (to, t0, d) => tl.fromTo(CAM, { scale: 1 }, { scale: to, duration: d, ease: "none" }, t0);
    // a card whips in from off axis with a focus pull
    const whip = (sel, t, from, d = 1.0) =>
      tl.fromTo(sel, Object.assign({ opacity: 0, scale: 1.1, filter: "blur(8px)" }, from),
        { opacity: 1, scale: 1, x: 0, y: 0, filter: "blur(0px)", duration: d, ease: "expo.out" }, t);
${js}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`
}

const words = (id, text, cls = '') => `<span class="l ${cls}" id="${id}">${text.split(' ').map((t) => `<span class="w">${t}</span>`).join(' ')}</span>`
const emWords = (id, text) => `<span class="l" id="${id}"><em>${text.split(' ').map((t) => `<span class="w">${t}</span>`).join(' ')}</em></span>`
const wordmark = (id, left, top) => `<div class="wm" id="${id}" style="left:${left}px;top:${top}px"><span class="mk"></span><div><span class="n">novelist</span><span class="s">Workspace</span></div></div>`
const write = (name, html) => { writeFileSync(join(OUT, name), html); console.log('wrote', name) }
const eyebrow = (p, text, t = 0.1) => ({ html: `<div class="eyebrow" id="f${p}-eyebrow">${text}</div>`, js: `tl.fromTo("#f${p}-eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, ${t});` })
const r2 = (n) => Math.round(n * 100) / 100

// =============== 01 Cover (5s) ===========================================================
{
  const eb = eyebrow('01', 'Novelist Workspace', 2.6)
  write('01-cover.html', shell('01-cover', 5,
`#f01-l1{position:absolute;left:134px;top:372px;font-size:154px}
#f01-l2{position:absolute;left:134px;top:532px;font-size:154px}
#f01-land{position:absolute;left:1216px;top:268px;width:448px;height:507px;display:block}
#f01-r1{left:1110px;top:190px;width:660px;height:660px}
#f01-drawn{position:absolute;left:1140px;top:220px;width:600px;height:600px}
#f01-ink{position:absolute;left:0;top:0;width:1920px;height:1080px;background:#262722;--r:0px;-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 3px));mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 3px))}
#f01-mk{position:absolute;left:885px;top:465px;width:150px;height:150px;display:block}
#f01-mrg{position:absolute;left:795px;top:375px;width:330px;height:330px}`,
`    <div class="ring" id="f01-r1"></div>
    <svg id="f01-drawn" viewBox="0 0 600 600"><circle id="f01-dr" cx="300" cy="300" r="299" fill="none" stroke="#E7CF93" stroke-width="1.5" stroke-dasharray="6 7" pathLength="1000"/></svg>
    <img id="f01-land" src="assets/quiet-landscape.svg" alt="">
    ${eb.html}
    <div class="h" id="f01-l1">${words('f01-l1w', 'A little room.')}</div>
    <div class="h" id="f01-l2">${emWords('f01-l2w', 'A whole world.')}</div>
    ${wordmark('f01-wm', 134, 836)}`,
`    ${eb.js}
    // the dark: the n mark gathers, a ring draws around it, a held breath before the hit
    tl.fromTo("#f01-mk", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0);
    tl.fromTo("#f01-mk", { scale: 1 }, { scale: 1.18, duration: 2.2, ease: "sine.in" }, 0.3);
    tl.fromTo("#f01-mdr", { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 2.0, ease: "power2.inOut" }, 0.3);
    // the break on the downbeat: paper floods out of the mark
    tl.fromTo("#f01-ink", { "--r": "0px" }, { "--r": "1500px", duration: 0.95, ease: "power4.out" }, 2.5);
    tl.to("#f01-mk, #f01-mrg", { opacity: 0, scale: 0.5, duration: 0.45, ease: "power3.in" }, 2.5);
    shake(2.5, 3);
    tl.fromTo("#f01-r1", { opacity: 0 }, { opacity: 0.55, duration: 0.5, ease: "power2.out" }, 2.6);
    slamLine("#f01-l1", 2.6, 0.13, 0.85, 16, 1.35);
    slamLine("#f01-l2", 3.125, 0.12, 0.85, 16, 1.35);
    tl.fromTo("#f01-land", { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 1.2, ease: E }, 3.2);
    tl.fromTo("#f01-dr", { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, 3.2);
    tl.fromTo("#f01-wm", { opacity: 0 }, { opacity: 1, duration: 0.7, ease: E }, 3.9);
    push(1.04, 2.5, 2.5);`,
`    <div id="f01-ink"></div>
    <svg id="f01-mrg" viewBox="0 0 330 330"><circle id="f01-mdr" cx="165" cy="165" r="163" fill="none" stroke="#E7CF93" stroke-width="1.5" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000"/></svg>
    <img id="f01-mk" src="assets/logo-mark.svg" alt="">`))
}

// =============== 02 Contents (5s) =========================================================
{
  const rows = ['Write', 'Plan', 'Track', 'In and out', 'Read', 'Two doors']
  const eb = eyebrow('02', 'Contents', 0.15)
  write('02-contents.html', shell('02-contents', 5,
`#f02-h{top:166px;font-size:88px}
.f02-row{position:absolute;left:134px;width:720px;height:66px}
.f02-row .no{position:absolute;left:0;top:14px;font-family:"Instrument Serif",serif;font-size:30px;color:#813F38}
.f02-row .nm{position:absolute;left:84px;top:6px;font-family:"Instrument Serif",serif;font-size:42px;color:#262722;line-height:1.1}
.f02-row .rl{position:absolute;left:0;bottom:0;width:720px;height:1px;background:#E7CF93}
#f02-sw{left:1050px;top:250px;width:700px;height:${C.switch.h}px}
#f02-wl{left:1050px;top:480px;width:700px;height:${C.welcome.h}px}
#f02-c1{left:1050px;top:${250 + C.switch.h + 18}px}
#f02-c2{left:1050px;top:${480 + C.welcome.h + 18}px}
#f02-mk{position:absolute;left:0;top:0;width:700px;height:${C.switch.h}px}`,
`    ${eb.html}
    <div class="h" id="f02-h">${words('f02-h1', 'Two rooms,')}${emWords('f02-h2', 'one door.')}</div>
    ${rows.map((r, i) => `<div class="f02-row" id="f02-row${i}" style="top:${470 + i * 66}px"><span class="no" id="f02-no${i}">0${i + 1}</span><span class="nm" id="f02-nm${i}">${r}</span><span class="rl" id="f02-rl${i}"></span></div>`).join('\n    ')}
    <div class="card" id="f02-sw"><img src="${C.switch.src}" alt=""><svg id="f02-mk" viewBox="0 0 700 ${C.switch.h}"><ellipse id="f02-ell" cx="500" cy="72" rx="100" ry="46" fill="none" stroke="#813F38" stroke-width="3.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-3 500 72)"/></svg></div>
    <div class="card" id="f02-wl"><img src="${C.welcome.src}" alt=""></div>
    <div class="cap" id="f02-c1">The Read | Write switch</div>
    <div class="cap" id="f02-c2">The studio home</div>`,
`    ${eb.js}
    slamLine("#f02-h1", 0.3);
    slamLine("#f02-h2", 0.9);
    // the contents land as a fast cascade, one line every 0.2s
    for (let i = 0; i < 6; i++) {
      const t = 1.25 + 0.2 * i;
      tl.fromTo("#f02-rl" + i, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.3, ease: "power3.out" }, t);
      tl.fromTo("#f02-no" + i + ", #f02-nm" + i, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, ease: "power4.out" }, t + 0.06);
    }
    whip("#f02-sw", 2.5, { x: 200, y: 0 }, 1.0);
    tl.fromTo("#f02-c1", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E }, 3.0);
    whip("#f02-wl", 3.1, { x: 0, y: 60 }, 0.9);
    tl.fromTo("#f02-c2", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E }, 3.6);
    // "write", then "read": a ring closes around each half of the switch
    tl.fromTo("#f02-ell", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, 3.4);
    tl.to("#f02-nm0", { color: "#813F38", duration: 0.3, ease: "power2.out" }, 3.4);
    tl.fromTo("#f02-ell", { x: 0 }, { x: -193, duration: 0.5, ease: "power3.inOut", immediateRender: false }, 4.2);
    tl.to("#f02-nm0", { color: "#262722", duration: 0.3, ease: "power2.out" }, 4.2);
    tl.to("#f02-nm4", { color: "#813F38", duration: 0.3, ease: "power2.out" }, 4.2);
    push(1.03, 0, 5);`))
}

// =============== 03 Write (7.5s) ==========================================================
// One camera travels one editor screenshot inside a fixed window. Card coordinates = 1920-space x 0.640625.
{
  const VW = 1230, VH = 692
  const cam = (cx, cy, s) => ({ s, x: VW / 2 - cx * s, y: VH / 2 - cy * s })
  const T0 = cam(VW / 2, VH / 2, 1), T1 = cam(608, 410, 1.25), T2 = cam(268, 397, 2.3), T3 = cam(923, 237, 2.0)
  const eb = eyebrow('03', '01 · Write', 0.15)
  const go = (T, t, d, ease) => `tl.to("#f03-world", { x: ${r2(T.x)}, y: ${r2(T.y)}, scale: ${T.s}, duration: ${d}, ease: "${ease}" }, ${t});`
  write('03-write.html', shell('03-write', 7.5,
`#f03-h{top:166px;font-size:104px}
#f03-sub{position:absolute;left:134px;top:420px;width:380px;font:400 26px/1.45 "DM Sans",sans-serif;color:#5A5A5A;white-space:normal}
#f03-view{position:absolute;left:580px;top:130px;width:${VW}px;height:${VH}px;border:1px solid #E7CF93;overflow:hidden;background:#fff}
#f03-world{position:absolute;left:0;top:0;width:${VW}px;height:${VH}px;transform-origin:0 0}
#f03-world img{position:absolute;left:0;top:0;width:${VW}px;height:${VH}px;display:block}
.f03-lab{position:absolute;left:580px;top:850px;height:48px;display:flex;align-items:center;gap:18px;white-space:nowrap}
.f03-lab .no{width:44px;height:44px;border-radius:50%;border:1px solid #813F38;color:#813F38;font-family:"Instrument Serif",serif;font-size:28px;line-height:42px;text-align:center}
.f03-lab .tx{font:500 26px/1 "DM Sans",sans-serif;color:#262722}`,
`    ${eb.html}
    <div class="h" id="f03-h">${words('f03-h1', 'A clean')}${emWords('f03-h2', 'page.')}</div>
    <div id="f03-sub">Your chapters beside you. Your private notes in the margin.</div>
    <div id="f03-view"><div id="f03-world"><img src="assets/web-02-editor.png" alt=""></div></div>
    <div class="f03-lab" id="f03-lab1"><span class="no">1</span><span class="tx">The page</span></div>
    <div class="f03-lab" id="f03-lab2"><span class="no">2</span><span class="tx">Chapters</span></div>
    <div class="f03-lab" id="f03-lab3"><span class="no">3</span><span class="tx">In the margins</span></div>`,
`    ${eb.js}
    slamLine("#f03-h1", 0.3);
    slamLine("#f03-h2", 0.9);
    tl.fromTo("#f03-sub", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: E }, 1.0);
    whip("#f03-view", 0.4, { x: 200, y: 0 }, 1.1);
    // the camera: a decisive move between named targets, braking hard into each stop
    gsap.set("#f03-world", { x: ${r2(T0.x)}, y: ${r2(T0.y)}, scale: ${T0.s} });
    ${go(T1, 1.25, 0.95, 'power4.inOut')}
    ${go(T2, 3.125, 0.8, 'power4.inOut')}
    ${go(T3, 4.375, 0.9, 'power4.inOut')}
    ${go(T0, 6.25, 1.0, 'power3.inOut')}
    tl.fromTo("#f03-lab1", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, 1.9);
    tl.to("#f03-lab1", { opacity: 0, duration: 0.3, ease: "power2.in" }, 3.0);
    tl.fromTo("#f03-lab2", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, 3.4);
    tl.to("#f03-lab2", { opacity: 0, duration: 0.3, ease: "power2.in" }, 4.3);
    tl.fromTo("#f03-lab3", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, 4.65);
    push(1.025, 0, 7.5);`))
}

// =============== 04 Plan (7.5s) ===========================================================
{
  const HERO = { x: 870, y: 330 }, SLOT_Y = 450, SLOT_W = 500, SK = SLOT_W / 900
  const SLOTS = [134, 694, 1254]
  const eb = eyebrow('04', '02 · Plan', 0.15)
  write('04-plan.html', shell('04-plan', 7.5,
`#f04-h{top:166px;font-size:84px}
.f04-c{position:absolute;left:0;top:0;width:900px;height:${C.chapters.h}px;transform-origin:0 0;border:1px solid #E7CF93;background:rgba(255,255,255,.3);overflow:hidden}
.f04-c img{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.f04-hc{left:${HERO.x}px;top:${HERO.y + C.chapters.h + 14}px}
.f04-sc{top:${SLOT_Y + Math.round(C.chapters.h * SK) + 18}px}
#f04-rule{position:absolute;left:134px;top:${SLOT_Y + Math.round(C.chapters.h * SK) + 74}px;width:1620px;height:1px;background:#E7CF93}`,
`    ${eb.html}
    <div class="h" id="f04-h">${words('f04-h1', 'Three ways to see')}${emWords('f04-h2', 'one novel.')}</div>
    <div id="f04-rule"></div>
    <div class="f04-c" id="f04-c1"><img src="${C.chapters.src}" alt=""></div>
    <div class="f04-c" id="f04-c2"><img src="${C.board.src}" alt=""></div>
    <div class="f04-c" id="f04-c3"><img src="${C.notebook.src}" alt=""></div>
    <div class="cap f04-hc" id="f04-hc1">Chapters</div>
    <div class="cap f04-hc" id="f04-hc2">A board of scenes</div>
    <div class="cap f04-hc" id="f04-hc3">A notebook of people and places</div>
    <div class="cap f04-sc" id="f04-sc1" style="left:${SLOTS[0]}px">Chapters</div>
    <div class="cap f04-sc" id="f04-sc2" style="left:${SLOTS[1]}px">A board of scenes</div>
    <div class="cap f04-sc" id="f04-sc3" style="left:${SLOTS[2]}px">A notebook of people and places</div>`,
`    const HX = ${HERO.x}, HY = ${HERO.y}, SY = ${SLOT_Y}, SK = ${r2(SK * 10000) / 10000};
    const SX = [${SLOTS.join(',')}];
    ${eb.js}
    slamLine("#f04-h1", 0.3, 0.09);
    slamLine("#f04-h2", 0.9);
    gsap.set("#f04-c1, #f04-c2, #f04-c3", { x: HX, y: HY, scale: 1, opacity: 0 });
    gsap.set("#f04-hc1, #f04-hc2, #f04-hc3, #f04-sc1, #f04-sc2, #f04-sc3, #f04-rule", { opacity: 0 });
    const hero = (sel, t, dx, dy) => tl.fromTo(sel, { x: HX + dx, y: HY + dy, scale: 1.1, opacity: 0, filter: "blur(8px)" }, { x: HX, y: HY, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.95, ease: "expo.out" }, t);
    const settle = (sel, t, slot) => tl.to(sel, { x: SX[slot], y: SY, scale: SK, duration: 0.7, ease: "power4.inOut" }, t);
    // 1 chapters: takes the stage, then shrinks into slot 1 as the board arrives
    hero("#f04-c1", 0.35, 120, 80);
    tl.fromTo("#f04-hc1", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, 1.0);
    tl.to("#f04-hc1", { opacity: 0, duration: 0.3, ease: "power2.in" }, 1.7);
    settle("#f04-c1", 1.875, 0);
    tl.fromTo("#f04-sc1", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, 2.45);
    // 2 board
    hero("#f04-c2", 1.875, 200, 0);
    tl.fromTo("#f04-hc2", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, 2.6);
    tl.to("#f04-hc2", { opacity: 0, duration: 0.3, ease: "power2.in" }, 3.5);
    settle("#f04-c2", 3.75, 1);
    tl.fromTo("#f04-sc2", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, 4.3);
    // 3 notebook
    hero("#f04-c3", 3.75, 200, 0);
    tl.fromTo("#f04-hc3", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, 4.5);
    tl.to("#f04-hc3", { opacity: 0, duration: 0.3, ease: "power2.in" }, 5.5);
    settle("#f04-c3", 5.625, 2);
    tl.fromTo("#f04-sc3", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, 6.2);
    tl.fromTo("#f04-rule", { opacity: 0, scaleX: 0, transformOrigin: "0% 50%" }, { opacity: 1, scaleX: 1, duration: 0.8, ease: "power3.out" }, 6.3);
    push(1.03, 0, 7.5);`))
}

// =============== 05 Track (7.5s) =========================================================
{
  const TX = 134, TY = 315
  const ts = 1060 / 1240
  const sx = (v) => r2((v - 455) * ts), sy = (v) => r2((v - 290) * ts)
  const eb = eyebrow('05', '03 · Track', 0.15)
  write('05-track.html', shell('05-track', 7.5,
`#f05-h{top:150px;font-size:100px}
#f05-tr{left:${TX}px;top:${TY}px;width:${C.tracker.w}px;height:${C.tracker.h}px}
#f05-sm{left:1290px;top:${TY}px;width:${C.summary.w}px;height:${C.summary.h}px}
#f05-pl{left:1290px;top:${TY + C.summary.h + 40}px;width:${C.pill.w}px;height:${C.pill.h}px}
#f05-mask{position:absolute;left:${sx(495)}px;top:${sy(818)}px;width:${r2(sx(1328) - sx(495))}px;height:${r2(sy(1058) - sy(818))}px;background:${PANEL};clip-path:inset(0 0 0 0)}
#f05-ov{position:absolute;left:0;top:0;width:${C.tracker.w}px;height:${C.tracker.h}px}`,
`    ${eb.html}
    <div class="h" id="f05-h"><span class="l">${['Streak.', 'Sprint.'].map((t, i) => `<span class="w" id="f05-w${i}">${t}</span>`).join(' ')} <em class="w" id="f05-w2">Words.</em></span></div>
    <div class="card" id="f05-tr"><img src="${C.tracker.src}" alt=""><div id="f05-mask"></div><svg id="f05-ov" viewBox="0 0 ${C.tracker.w} ${C.tracker.h}"><ellipse id="f05-ell" cx="${r2((sx(777) + sx(1068)) / 2)}" cy="${r2((sy(303) + sy(495)) / 2)}" rx="${r2((sx(1068) - sx(777)) / 2 + 16)}" ry="${r2((sy(495) - sy(303)) / 2 + 12)}" fill="none" stroke="#813F38" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-2 ${r2((sx(777) + sx(1068)) / 2)} ${r2((sy(303) + sy(495)) / 2)})"/></svg></div>
    <div class="card" id="f05-sm"><img src="${C.summary.src}" alt=""></div>
    <div class="card" id="f05-pl"><img src="${C.pill.src}" alt=""></div>`,
`    ${eb.js}
    whip("#f05-tr", 0.1, { x: -240, y: 0 }, 1.0);
    const sl = (id, t) => tl.fromTo(id, { opacity: 0, scale: 1.3, filter: "blur(14px)", transformOrigin: "0% 70%" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.75, ease: "power4.out" }, t);
    sl("#f05-w0", 0.4);
    tl.fromTo("#f05-ell", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, 0.9);
    shake(0.9, 2);
    sl("#f05-w1", 1.9);
    // the sprint: the countdown slides in while the clock ticks, then the summary slams in on the downbeat
    whip("#f05-pl", 1.9, { x: 200, y: 0 }, 0.9);
    tl.fromTo("#f05-sm", { opacity: 0, scale: 1.25, filter: "blur(10px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.65, ease: "power4.out" }, 3.125);
    shake(3.125, 3);
    tl.to("#f05-pl", { opacity: 0.55, duration: 0.6, ease: "power2.out" }, 3.4);
    // the words: the chart draws itself left to right
    sl("#f05-w2", 4.4);
    tl.fromTo("#f05-mask", { clipPath: "inset(0 0 0 0%)" }, { clipPath: "inset(0 0 0 100%)", duration: 1.3, ease: "power2.inOut" }, 4.4);
    push(1.03, 0, 7.5);`))
}

// =============== 06 In and out (5s) =======================================================
{
  const IX = 630, EX = 1260, DY = 150
  const ms = 540 / 680
  const ry0 = r2((604 - 100) * ms), ry1 = r2((807 - 100) * ms), rx0 = r2((651 - 620) * ms), rx1 = r2((1269 - 620) * ms)
  const AW = EX - IX - C.imp.w - 16
  const eb = eyebrow('06', '04 · In and out', 0.15)
  write('06-in-and-out.html', shell('06-in-and-out', 5,
`#f06-h{top:166px;font-size:92px}
#f06-i{left:${IX}px;top:${DY}px;width:${C.imp.w}px;height:${C.imp.h}px}
#f06-e{left:${EX}px;top:${DY}px;width:${C.exp.w}px;height:${C.exp.h}px}
#f06-mask{position:absolute;left:${rx0}px;top:${ry0}px;width:${r2(rx1 - rx0)}px;height:${r2(ry1 - ry0)}px;background:${DIALOG};clip-path:inset(0 0 0 0)}
#f06-ci{left:${IX}px;top:${DY + C.imp.h + 22}px}
#f06-ce{left:${EX}px;top:${DY + C.exp.h + 22}px}
#f06-arrow{position:absolute;left:${IX + C.imp.w + 8}px;top:${DY + 300}px;width:${AW}px;height:60px}`,
`    ${eb.html}
    <div class="h" id="f06-h">${words('f06-h1', 'Bring it in.')}${emWords('f06-h2', 'Send it out.')}</div>
    <div class="card" id="f06-i"><img src="${C.imp.src}" alt=""><div id="f06-mask"></div></div>
    <div class="card" id="f06-e"><img src="${C.exp.src}" alt=""></div>
    <svg id="f06-arrow" viewBox="0 0 ${AW} 60"><path id="f06-ap" d="M2 30 L${AW - 14} 30 M${AW - 28} 14 L${AW - 12} 30 L${AW - 28} 46" fill="none" stroke="#813F38" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
    <div class="cap" id="f06-ci">the-lamp-year.docx → 4 chapters</div>
    <div class="cap" id="f06-ce">Word · e-book · PDF · text · backup</div>`,
`    ${eb.js}
    slamLine("#f06-h1", 0.3, 0.1);
    // the import dialog from the left, the export dialog from the right, mirrored tilts that settle flat
    tl.fromTo("#f06-i", { opacity: 0, x: -240, scale: 1.1, rotationY: 10, transformPerspective: 1800, filter: "blur(8px)" }, { opacity: 1, x: 0, scale: 1, rotationY: 0, filter: "blur(0px)", duration: 1.0, ease: "expo.out" }, 0.3);
    tl.fromTo("#f06-mask", { clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)", duration: 0.8, ease: "power2.inOut" }, 1.25);
    tl.fromTo("#f06-ci", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E }, 1.5);
    tl.fromTo("#f06-ap", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, 2.0);
    slamLine("#f06-h2", 2.5, 0.1);
    tl.fromTo("#f06-e", { opacity: 0, x: 240, scale: 1.1, rotationY: -10, transformPerspective: 1800, filter: "blur(8px)" }, { opacity: 1, x: 0, scale: 1, rotationY: 0, filter: "blur(0px)", duration: 1.0, ease: "expo.out" }, 2.5);
    shake(2.5, 3);
    tl.fromTo("#f06-ce", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E }, 3.2);
    push(1.035, 0, 5);`))
}

// =============== 07 Read (7.5s) ==========================================================
{
  const PY = 410
  const eb = eyebrow('07', '05 · Read', 0.15)
  write('07-read.html', shell('07-read', 7.5,
`#f07-h{top:166px;font-size:92px}
#f07-l{left:134px;top:${PY}px;width:${C.light.w}px;height:${C.light.h}px}
#f07-d{left:${134 + C.light.w + 32}px;top:${PY}px;width:${C.dark.w}px;height:${C.dark.h}px;--p:-16%;-webkit-mask-image:linear-gradient(to right,#000 var(--p),transparent calc(var(--p) + 16%));mask-image:linear-gradient(to right,#000 var(--p),transparent calc(var(--p) + 16%))}
#f07-lib{left:1390px;top:150px;width:${C.library.w}px;height:${C.library.h}px}
#f07-set{left:1390px;top:${150 + C.library.h + 28}px;width:${C.settings.w}px;height:${C.settings.h}px}
#f07-con{left:1390px;top:${150 + C.library.h + 28 + C.settings.h + 28}px;width:${C.cont.w}px;height:${C.cont.h}px}`,
`    ${eb.html}
    <div class="h" id="f07-h">${words('f07-h1', 'Light, or')}${emWords('f07-h2', 'the dark.')}</div>
    <div class="card" id="f07-l"><img src="${C.light.src}" alt=""></div>
    <div class="card" id="f07-d"><img src="${C.dark.src}" alt=""></div>
    <div class="card" id="f07-lib"><img src="${C.library.src}" alt=""></div>
    <div class="card" id="f07-set"><img src="${C.settings.src}" alt=""></div>
    <div class="card" id="f07-con"><img src="${C.cont.src}" alt=""></div>`,
`    ${eb.js}
    whip("#f07-l", 0.3, { x: 0, y: 160 }, 1.1);
    whip("#f07-lib", 1.2, { x: 160, y: 0 }, 0.9);
    slamLine("#f07-h1", 1.9, 0.1);
    slamLine("#f07-h2", 2.5, 0.1);
    // on "the dark": the same chapter opens beside it through a slow, soft wipe, then its reading settings
    gsap.set("#f07-d", { opacity: 0 });
    tl.set("#f07-d", { opacity: 1 }, 2.5);
    tl.fromTo("#f07-d", { "--p": "-16%" }, { "--p": "100%", duration: 1.6, ease: "power2.inOut" }, 2.5);
    whip("#f07-set", 4.2, { x: 0, y: 30 }, 0.8);
    whip("#f07-con", 4.6, { x: 0, y: 70 }, 0.9);
    push(1.03, 0, 7.5);`))
}

// =============== 08 Two doors (7.5s) ====================================================
{
  const PX0 = 330, PGAP = 60, PW = 252 + 24, PH = C.p1.h + 24, PTOP = 336
  const phones = [['p1', C.p1, 0.6], ['p2', C.p2, 1.25], ['p3', C.p3, 1.875], ['p4', C.p4, 2.5]]
  const eb = eyebrow('08', '06 · Two doors', 0.15)
  write('08-two-doors.html', shell('08-two-doors', 7.5,
`#f08-h{top:150px;font-size:80px}
.f08-ph{position:absolute;top:${PTOP}px;width:${PW}px;height:${PH}px;background:#1d1c1a;border-radius:36px;padding:12px}
.f08-ph img{display:block;width:${C.p1.w}px;height:${C.p1.h}px;border-radius:25px}
.f08-tab{position:absolute;left:134px;font:500 14px/1 "DM Sans",sans-serif;letter-spacing:4px;color:#5A5A5A;text-transform:uppercase}
#f08-row{position:absolute;left:0;top:0;width:1920px;height:1080px}`,
`    ${eb.html}
    <div class="h" id="f08-h">${words('f08-h1', 'The same novels,')}${emWords('f08-h2', 'on your phone.')}</div>
    <div id="f08-row">
    <div class="f08-tab" id="f08-t1" style="top:${PTOP + 70}px">Read</div>
    <div class="f08-tab" id="f08-t2" style="top:${PTOP + 112}px">Write</div>
    <div class="f08-tab" id="f08-t3" style="top:${PTOP + 154}px">Me</div>
    ${phones.map(([id, c], i) => `<div class="f08-ph" id="f08-${id}" style="left:${PX0 + i * (PW + PGAP)}px"><img src="${c.src}" alt=""></div>`).join('\n    ')}
    </div>`,
`    ${eb.js}
    slamLine("#f08-h1", 0.3, 0.09);
    ${phones.map(([id, , t]) => `tl.fromTo("#f08-${id}", { opacity: 0, y: 70, scale: 1.06, filter: "blur(6px)" }, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, ${t});`).join('\n    ')}
    tl.fromTo("#f08-t1, #f08-t2, #f08-t3", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E, stagger: 0.1 }, 0.9);
    slamLine("#f08-h2", 2.5, 0.1);
    shake(2.5, 3);
    // parallax: the row drifts a little against the headline while it holds
    tl.fromTo("#f08-row", { x: 0 }, { x: -30, duration: 4.4, ease: "power1.inOut" }, 3.1);
    push(1.035, 0, 7.5);`))
}

// =============== 09 Close (5s) ===========================================================
{
  write('09-close.html', shell('09-close', 5,
`#f09-l1{left:0;width:1920px;text-align:center;top:372px;font-size:130px}
#f09-l2{left:0;width:1920px;text-align:center;top:512px;font-size:130px}
#f09-r{left:560px;top:90px;width:800px;height:800px;opacity:.35}
#f09-land{position:absolute;left:742px;top:222px;width:436px;height:493px;opacity:.07;display:block}
#f09-end{position:absolute;left:134px;top:930px;font:500 14px/1 "DM Sans",sans-serif;letter-spacing:4px;color:#813F38;text-transform:uppercase}
#f09-rule{position:absolute;left:134px;top:968px;width:1652px;height:1px;background:#E7CF93}
#f09-wm{width:400px;justify-content:center}`,
`    <div class="ring" id="f09-r"></div>
    <img id="f09-land" src="assets/quiet-landscape.svg" alt="">
    <div class="h" id="f09-l1">${words('f09-l1w', 'A little room.')}</div>
    <div class="h" id="f09-l2">${emWords('f09-l2w', 'A whole world.')}</div>
    ${wordmark('f09-wm', 760, 790)}
    <div id="f09-end">The end</div>
    <div id="f09-rule"></div>`,
`    tl.fromTo("#f09-r", { opacity: 0 }, { opacity: 0.35, duration: 0.6, ease: "power2.out" }, 0);
    tl.fromTo("#f09-land", { opacity: 0 }, { opacity: 0.07, duration: 0.6, ease: "power2.out" }, 0);
    tl.fromTo("#f09-end, #f09-rule", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.1);
    slamLine("#f09-l1w", 0.5, 0.13, 1.0, 8, 1.12);
    slamLine("#f09-l2w", 1.2, 0.13, 1.0, 8, 1.12);
    tl.fromTo("#f09-wm", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: E }, 1.9);
    push(1.02, 0, 5);`))
}
