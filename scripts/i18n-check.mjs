// Shows which sentences the code asks to have translated (t('...') and tp(n, '...', '...')) and which of them
// the Malay file does not have yet. Run with:  npm run i18n:check   (add --strict to fail when something is missing)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'data' || name === 'assets') continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) files.push(full);
  }
};
walk(src);

const unescape = (s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
const used = new Map(); // sentence -> first place it is used
const add = (text, file, index, source) => {
  const line = source.slice(0, index).split('\n').length;
  if (!used.has(text)) used.set(text, `${relative(root, file).replace(/\\/g, '/')}:${line}`);
};

const str = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`;
const tCall = new RegExp(String.raw`(?<![\w$.])(?:t|mark)\(\s*${str}`, 'g');
const tpCall = new RegExp(String.raw`(?<![\w$.])tp\(\s*[^,()]+,\s*${str}\s*,\s*${str}`, 'g');

for (const file of files) {
  if (file.replace(/\\/g, '/').includes('/src/i18n/')) continue;
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = tCall.exec(text))) add(unescape(m[1] ?? m[2]), file, m.index, text);
  while ((m = tpCall.exec(text))) {
    add(unescape(m[1] ?? m[2]), file, m.index, text);
    add(unescape(m[3] ?? m[4]), file, m.index, text);
  }
}

const catalog = (await import(pathToFileURL(join(src, 'i18n', 'ms.ts')).href)).default;
const missing = [...used.keys()].filter((k) => !(k in catalog));
const stale = Object.keys(catalog).filter((k) => !used.has(k));

console.log(`${used.size} sentences are marked for translation; ${used.size - missing.length} have a Malay translation, ${missing.length} do not.`);
if (missing.length) {
  console.log('\nNot translated yet:');
  for (const k of missing) console.log(`  ${used.get(k)}  ${JSON.stringify(k)}`);
}
if (stale.length) {
  console.log(`\nIn the Malay file but not used by the code (${stale.length}):`);
  for (const k of stale) console.log(`  ${JSON.stringify(k)}`);
}
if (process.argv.includes('--strict') && missing.length) process.exit(1);
