#!/usr/bin/env node
// After `quartz build`: turn the plain "Teacher.Shokh" page title into the blog's wordmark
// (tangerine full stop, italic Shokh) and add a link back to the main site.
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const TITLE = /<h2 class="page-title"><a href="([^"]*)">Teacher\.Shokh<\/a><\/h2>/g;
const WORDMARK = (href) =>
  `<h2 class="page-title"><a href="${href}" aria-label="Teacher Shokh notes">Teacher<span class="ts-dot" aria-hidden="true">.</span><em>Shokh</em></a>` +
  `<span class="ts-sub"><span>Notes</span> · <a href="https://teachershokh.blog">teachershokh.blog ↗</a></span></h2>`;

let files = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      const html = fs.readFileSync(p, 'utf8');
      const next = html.replace(TITLE, (_, href) => WORDMARK(href));
      if (next !== html) { fs.writeFileSync(p, next); files++; }
    }
  }
})(PUBLIC);
console.log(`Wordmark applied to ${files} pages`);
