import { mkdir, writeFile } from 'node:fs/promises';
import { portals, worlds } from '../portals/catalog.js';
const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(p) {
  const nested = Boolean(p), home = nested ? '../../' : '../', assets = nested ? '../' : './';
  const heading = p?.title || 'A world behind every door.';
  const description = p?.line || 'Feel something. Make something. Find out what happens.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a1220"><meta name="description" content="${escape(description)}"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'"><title>${escape(heading)} · Dream Unity</title><link rel="icon" href="data:,"><link rel="stylesheet" href="${assets}styles.css?v=portals-world-20260909"></head>
<body data-portal="${p?.id || 'all'}" data-world="${p?.world || 'machine'}"><a class="skip-link" href="#main">Skip to the activity</a>
<header class="site-header"><a href="${home}" class="brand"><svg viewBox="0 0 30 40" fill="none" aria-hidden="true"><path d="M15 2 28 20 15 38 2 20 15 2Zm0 0v36M2 20h26" stroke="currentColor"/></svg>DREAM UNITY</a><div class="header-actions"><a class="home-link" href="${home}">Home</a><label class="sr-only" for="portal-select">Choose a portal</label><select class="portal-select" id="portal-select"><option>Choose a portal</option></select></div></header>
<main class="shell" id="main"><div class="page-heading"><div><p class="eyebrow">${p ? `${worlds[p.world]} / ${p.name}` : 'Eleven places to explore'}</p><h1>${heading}</h1><p class="lede">${description}</p></div>${p ? `<span class="category">${p.type} · ${p.time}</span>` : ''}</div>
${p ? `<div class="lab"><div class="stage-column"><section class="stage" id="stage" aria-label="${escape(p.title)}"><div class="center-scene"><p>Opening the activity…</p></div></section><p class="feedback" id="feedback" role="status" aria-live="polite" aria-atomic="true"></p><div id="extra"></div></div><aside class="controls" id="controls" aria-label="Activity controls"></aside></div><details class="research" id="research"><summary>Go deeper</summary></details><div class="below"><a href="../">All portals</a><a id="next-portal" href="../">Choose another portal</a></div><p class="hint">Your answers stay in this page’s memory. Reload to start fresh. No account, camera or health sensor is used. These are learning experiments; game scores are not measures of intelligence or health.</p>` : `<div id="portal-groups"></div><div class="below"><a href="../">Return to the three worlds</a><span>Short instructions to begin. Open “Go deeper” to explore the science.</span></div>`}
<noscript><p class="note">Turn on JavaScript for the interactive activities. <a href="${home}">Return to Dream Unity</a>.</p></noscript></main><script type="module" src="${assets}app.js?v=portals-world-20260909"></script></body></html>\n`;
}
await writeFile(new URL('../portals/index.html', import.meta.url), page());
for (const p of portals.filter(p => !p.href)) {
  const dir = new URL(`../portals/${p.id}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), page(p));
}
console.log('Wrote the portal map and nine native activities.');
