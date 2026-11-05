// Pads each raw narration clip with a leading breath of silence (so the voice
// enters a little after its scene begins), estimates word times, and writes
// audio_meta.json. Whisper is not installed, so word times are ESTIMATED:
// real pauses are found with ffmpeg silencedetect, snapped to the nearest
// punctuation boundary, and the words are spread over the speech by syllable weight.
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(ROOT, 'assets', 'voice-raw')
const OUT = join(ROOT, 'assets', 'voice')
mkdirSync(RAW, { recursive: true })

const LINES = {
  1: { text: 'A little room. A whole world.', lead: 0.9 },
  2: { text: 'Novelist Workspace. A quiet place to write a novel, and to read one.', lead: 0.5 },
  3: { text: 'Write on a clean page, with your chapters beside you and your private notes in the margin.', lead: 0.7 },
  4: { text: 'Plan it as chapters, as a board of scenes, or as a notebook of people and places.', lead: 0.5 },
  5: { text: 'Keep a streak. Race the clock in a sprint, and watch the words add up.', lead: 0.5 },
  6: { text: 'Bring a manuscript in from Word. Send it out the same way.', lead: 0.5 },
  7: { text: "Then read. Other writers' novels, in the light or the dark, opening where you left off.", lead: 0.5 },
  8: { text: 'And it all comes with you. The same novels, on your phone.', lead: 0.7 },
  9: { text: 'A little room. A whole world.', lead: 0.6 },
}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const probe = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim())

function pauses(file) {
  // ffmpeg prints the silencedetect log on stderr even when it succeeds
  const log = String(spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-40dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '')
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const list = []
  starts.forEach((s, i) => { if (ends[i] != null) list.push({ start: s, end: ends[i] }) })
  return list
}

const syllables = (w) => {
  const g = w.toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]+/g)
  return Math.max(1, g ? g.length : 1)
}
const weight = (w) => syllables(w) + 0.12 * w.replace(/[^A-Za-z]/g, '').length

function estimate(text, dur, found) {
  const tokens = text.split(/\s+/).map((t) => ({ raw: t, word: t.replace(/[.,]$/, ''), stop: /[.,]$/.test(t) }))
  // inner pauses only: ignore any that touch the very start or the tail of the file
  const inner = found.filter((p) => p.start > 0.3 && p.end < dur - 0.2)
  const total = tokens.reduce((a, t) => a + weight(t.word), 0)
  const tail = found.length && found[found.length - 1].end >= dur - 0.2 ? dur - found[found.length - 1].start : 0
  const lead = found.length && found[0].start < 0.05 ? found[0].end : 0
  const pauseSum = inner.reduce((a, p) => a + (p.end - p.start), 0)
  const speech = dur - tail - lead - pauseSum

  // first pass: where would each boundary fall with no pauses at all
  const bounds = []
  let acc = 0
  tokens.forEach((t, i) => {
    acc += weight(t.word)
    if (t.stop && i < tokens.length - 1) bounds.push({ i, at: lead + (acc / total) * (speech + pauseSum) })
  })
  const gapAfter = new Map()
  for (const p of inner) {
    let best = null
    for (const b of bounds) if (!best || Math.abs(b.at - p.start) < Math.abs(best.at - p.start)) best = b
    if (best) gapAfter.set(best.i, (gapAfter.get(best.i) || 0) + (p.end - p.start))
  }
  // second pass: spread the words over the speech, adding the pauses where they snapped
  let t = lead
  const words = []
  tokens.forEach((tok, i) => {
    const d = (weight(tok.word) / total) * speech
    words.push({ id: `w${i + 1}`, text: tok.word, start: +t.toFixed(3), end: +(t + d).toFixed(3) })
    t += d + (gapAfter.get(i) || 0)
  })
  return words
}

const meta = existsSync(join(ROOT, 'audio_meta.json')) ? JSON.parse(readFileSync(join(ROOT, 'audio_meta.json'), 'utf8')) : {}
meta.voices = []
for (const [n, info] of Object.entries(LINES)) {
  const id = String(n).padStart(2, '0')
  const raw = join(RAW, `${id}.wav`)
  const cur = join(OUT, `${id}.wav`)
  if (!existsSync(raw)) copyFileSync(cur, raw) // first run: the freshly generated clip is the raw one
  const found = pauses(raw)
  const rawDur = probe(raw)
  const words = estimate(info.text, rawDur, found).map((w) => ({ ...w, start: +(w.start + info.lead).toFixed(3), end: +(w.end + info.lead).toFixed(3) }))
  const ms = Math.round(info.lead * 1000)
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af', `adelay=${ms}|${ms}`, cur])
  meta.voices.push({ frame: Number(n), path: `assets/voice/${id}.wav`, duration_s: +probe(cur).toFixed(3), lead_s: info.lead, text: info.text, words })
  console.log(`line ${id}: raw ${rawDur.toFixed(2)}s + lead ${info.lead}s = ${probe(cur).toFixed(2)}s, pauses ${found.map((p) => p.start.toFixed(2)).join(', ') || 'none'}`)
}
writeFileSync(join(ROOT, 'audio_meta.json'), JSON.stringify(meta, null, 2))
console.log('wrote audio_meta.json')
