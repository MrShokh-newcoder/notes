#!/usr/bin/env node
// Copies the publishable part of the Obsidian vault into content/ for Quartz.
// Nothing outside publish.config.json's "include" folders is published, unless a note
// opts in with `publish: true` in its frontmatter. `publish: false` or `draft: true` opts out.
// Private context (sections, lines and sentences naming school projects) is removed on the way.
// The vault itself is never modified.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'publish.config.json'), 'utf8'));
const expand = (p) => p.replace(/^~(?=$|\/)/, os.homedir());
const VAULT = path.resolve(expand(process.argv[2] || process.env.VAULT || cfg.vault));
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROOT, 'content');
const IMG = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

if (!fs.existsSync(VAULT)) { console.error(`Vault not found: ${VAULT}`); process.exit(1); }

const rel = (p) => path.relative(VAULT, p).split(path.sep).join('/');
const under = (r, dir) => r === dir || r.startsWith(dir + '/');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;                 // .obsidian, .trash, dotfiles
    const p = path.join(dir, e.name);
    // some mounts (network drives, iCloud, VMs) don't report entry types, so stat to be sure
    const isDir = e.isDirectory() || (!e.isFile() && fs.statSync(p).isDirectory());
    if (isDir) walk(p, out); else if (e.isFile() || fs.statSync(p).isFile()) out.push(p);
  }
  return out;
}

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: '', body: text };
}
const fmFlag = (fm, key) => (fm.match(new RegExp(`^${key}:\\s*(\\S+)`, 'm')) || [])[1];

// ---- choose notes ---------------------------------------------------------
const files = walk(VAULT);
const notes = [];
for (const f of files.filter((f) => f.endsWith('.md'))) {
  const r = rel(f);
  const { fm } = splitFrontmatter(fs.readFileSync(f, 'utf8'));
  const flag = fmFlag(fm, 'publish');
  if (flag === 'false' || fmFlag(fm, 'draft') === 'true') continue;
  const inFolder = cfg.include.some((d) => under(r, d)) && !cfg.exclude.some((d) => under(r, d));
  if (cfg.excludeNamePattern && new RegExp(cfg.excludeNamePattern).test(path.basename(f)) && flag !== 'true') continue;
  if (inFolder || flag === 'true' || r === cfg.home) notes.push(f);
}
const published = new Set(notes.map((f) => path.basename(f, '.md')));
const homeName = path.basename(cfg.home, '.md');
const imagesByName = new Map(files.filter((f) => IMG.test(f)).map((f) => [path.basename(f), f]));

// ---- transforms -----------------------------------------------------------
const terms = (cfg.privateTerms || []).map((t) => t.toLowerCase());
const hasTerm = (s) => terms.length > 0 && terms.some((t) => s.toLowerCase().includes(t));
const stats = { sections: 0, lines: 0, sentences: 0, unlinked: 0, images: 0 };

function stripSections(body) {
  const lines = body.split('\n');
  const out = [];
  let skipLevel = 0;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && ((cfg.stripSections || []).some((s) => h[2].includes(s)) || hasTerm(h[2]))) {
        skipLevel = level; stats.sections++; continue;
      }
    }
    if (!skipLevel) out.push(line);
  }
  return out.join('\n');
}

function stripPrivate(body) {
  let inCode = false;
  return body.split('\n').flatMap((line) => {
    if (/^\s*```/.test(line)) inCode = !inCode;
    if (inCode) return [line];
    if ((cfg.stripLinePrefixes || []).some((p) => line.trim().startsWith(p))) { stats.lines++; return []; }
    if (!hasTerm(line)) return [line];
    if (/^\s*([-*+]|\d+\.|\|)/.test(line)) { stats.lines++; return []; }   // list item or table row
    const kept = line.split(/(?<=[.!?])\s+/).filter((s) => { const bad = hasTerm(s); if (bad) stats.sentences++; return !bad; });
    return kept.length ? [kept.join(' ')] : [];
  }).join('\n');
}

function fixLinks(body) {
  // embeds: keep images that exist in the vault, drop the rest
  body = body.replace(/!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, (m, target) => {
    const name = path.basename(target.trim());
    if (IMG.test(name) && imagesByName.has(name)) { neededImages.add(name); return m; }
    if (published.has(name.replace(/\.md$/, ''))) return m;
    stats.unlinked++; return '';
  });
  // wikilinks to notes that aren't published become plain text
  return body.replace(/(?<!!)\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (m, target, hash = '', alias) => {
    const name = path.basename(target.trim());
    if (name === homeName) return `[[index|${alias || cfg.homeTitle || 'Home'}]]`;
    if (published.has(name)) return m;
    stats.unlinked++; return alias || name;
  });
}

function renameFrontmatter(fm) {
  for (const [from, to] of Object.entries(cfg.renameFrontmatter || {}))
    fm = fm.replace(new RegExp(`^${from}:`, 'm'), `${to}:`);
  return fm;
}

// ---- write ----------------------------------------------------------------
const neededImages = new Set();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of notes) {
  const r = rel(f);
  let { fm, body } = splitFrontmatter(fs.readFileSync(f, 'utf8'));
  body = fixLinks(stripPrivate(stripSections(body))).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  // Quartz prints the note title itself, so drop a leading H1 that repeats it
  body = body.replace(/^# (.+)\n+/, (m, h) => {
    if (r !== cfg.home && !/^title:/m.test(fm) && h.trim() !== path.basename(f, '.md').trim())
      fm = `title: ${JSON.stringify(h.trim())}\n${fm}`;
    return '';
  });
  fm = renameFrontmatter(fm);
  let dest;
  if (r === cfg.home) {
    dest = 'index.md';
    fm = `title: ${JSON.stringify(cfg.homeTitle || 'Home')}\n${fm}`;
    body = body.replace(/^# .*\n+/, '');
  } else {
    const base = cfg.include.find((d) => under(r, d));
    dest = base && !cfg.keepFolderPaths ? path.relative(base, r) : r;
  }
  const target = path.join(OUT, dest);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, (fm ? `---\n${fm}\n---\n` : '') + body);
}
for (const name of neededImages) {
  fs.mkdirSync(path.join(OUT, 'attachments'), { recursive: true });
  fs.copyFileSync(imagesByName.get(name), path.join(OUT, 'attachments', name));
  stats.images++;
}

console.log(`Published ${notes.length} notes from ${VAULT}`);
console.log(`Removed: ${stats.sections} private sections, ${stats.lines} lines, ${stats.sentences} sentences. ` +
  `Unlinked ${stats.unlinked} links to unpublished notes. Copied ${stats.images} images.`);
