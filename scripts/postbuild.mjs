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

// Graph view: keep labels readable when zooming in. The graph plugin draws every label at once and
// scales them with the graph, so long note titles pile on top of each other. Patch its script so that
// labels keep a fixed on-screen size (zooming in spreads them apart), long titles are shortened
// (the full title shows on hover), and a label that would overlap a more connected note's label is hidden.
const GRAPH_PRELUDE = 'var __tsN=0;function __tsShort(t){return t.length>30?t.slice(0,28).trimEnd()+"…":t}' +
  'function __tsCull(P,F,H){if(!(F>0))return;var B=[],A=P.slice().sort(function(a,b){return((b.simulationData.id===H)-(a.simulationData.id===H))||(b.active-a.active)||(b.gfx.width-a.gfx.width)});' +
  'for(var n=0;n<A.length;n++){var e=A[n],L=e.label,b=L.getBounds(),r={x:b.x-3,y:b.y-1,w:b.width+6,h:b.height+2},hit=!1;' +
  'for(var m=0;m<B.length;m++){var q=B[m];if(r.x<q.x+q.w&&r.x+r.w>q.x&&r.y<q.y+q.h&&r.y+r.h>q.y){hit=!0;break}}' +
  'if(e.simulationData.id===H){B.push(r);continue}if(hit)L.alpha=0;else{if(!e.active)L.alpha=F;else if(!(L.alpha>0))L.alpha=Math.max(F,.6);B.push(r)}}}\n';
const GRAPH_PATCHES = [
  ['{text:iu.text,', '{text:__tsShort(iu.text),'],
  ['for(var i=1/Vu,l=i*1.1,', 'for(var i=1/(Vu*Math.sqrt(Math.max(j.k,1))),l=i*1.1,'],
  ['(v.label.alpha=1,v.label.scale.set(l)):v.label.scale.set(i)',
   '(v.label.alpha=1,v.label.text=v.simulationData.text,v.label.scale.set(l)):(v.label.text=__tsShort(v.simulationData.text),v.label.scale.set(i))'],
  ['v.indexOf(T)===-1&&(T.alpha=F)}},et=o.zoom()', 'v.indexOf(T)===-1&&(T.alpha=F)}qe();__tsCull(P,F,_u)},et=o.zoom()'],
  ['requestAnimationFrame(se)}}', '++__tsN%15==0&&__tsCull(P,Math.max((j.k*Me-1)/3.75,0),_u);requestAnimationFrame(se)}}'],
];
(function patchGraph(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { patchGraph(p); continue; }
    if (!e.name.endsWith('.js')) continue;
    let js = fs.readFileSync(p, 'utf8');
    if (!js.includes('graph-visited') || js.includes('__tsCull')) continue;
    const missing = GRAPH_PATCHES.filter(([from]) => !js.includes(from)).map(([from]) => from);
    if (missing.length) { console.warn(`Graph labels: plugin code changed, patch skipped (${missing.length} spots not found)`); continue; }
    for (const [from, to] of GRAPH_PATCHES) js = js.split(from).join(to);
    fs.writeFileSync(p, GRAPH_PRELUDE + js);
    console.log(`Graph labels patched in ${path.relative(PUBLIC, p)}`);
  }
})(PUBLIC);
