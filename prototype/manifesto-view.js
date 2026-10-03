const ALLOWED_TAGS = new Set(['P','H1','H2','H3','H4','H5','H6','STRONG','EM','B','I','CITE','BR','A','SECTION','NAV','DIV','SPAN','UL','OL','LI','BLOCKQUOTE','FOOTER','DETAILS','SUMMARY']);
const DROP_TAGS = new Set(['SCRIPT','STYLE','LINK','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','TEXTAREA','SELECT','TEMPLATE']);
const ID_PREFIX = 'inline-manifesto-';
const pendingLoads = new WeakMap();

function copyPublishedNode(source, documentRef, sourceUrl) {
  if (source.nodeType === 3) return documentRef.createTextNode(source.textContent || '');
  if (source.nodeType !== 1 || DROP_TAGS.has(source.tagName)) return null;
  const tag = source.tagName;
  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = documentRef.createDocumentFragment();
    for (const child of source.childNodes) {
      const copy = copyPublishedNode(child, documentRef, sourceUrl);
      if (copy) fragment.append(copy);
    }
    return fragment;
  }
  // The shell owns its main heading. Published chapter hierarchy remains intact.
  const heading = /^H[1-5]$/.test(tag) ? `h${Number(tag.slice(1)) + 1}` : tag.toLowerCase();
  const target = documentRef.createElement(heading);
  if (source.id) target.id = `${ID_PREFIX}${source.id}`;
  if (source.className) target.className = source.className;
  if (source.hasAttribute('aria-label')) target.setAttribute('aria-label', source.getAttribute('aria-label'));
  if (source.hasAttribute('aria-labelledby')) target.setAttribute('aria-labelledby', source.getAttribute('aria-labelledby').split(/\s+/).map((id) => `${ID_PREFIX}${id}`).join(' '));
  if (source.getAttribute('role') === 'list') target.setAttribute('role', 'list');
  if (tag === 'A') {
    const href = source.getAttribute('href') || '';
    try {
      const url = new URL(href, sourceUrl);
      if (!['https:', 'http:'].includes(url.protocol)) return documentRef.createTextNode(source.textContent || '');
      if (href.startsWith('#')) {
        target.href = `#${ID_PREFIX}${href.slice(1)}`;
      } else if (url.origin === sourceUrl.origin && url.pathname === new URL('../', sourceUrl).pathname) {
        target.href = '?view=unity';
        target.dataset.navigate = 'unity';
      } else {
        target.href = url.href;
        if (url.origin !== sourceUrl.origin) {
          target.target = '_blank';
          target.rel = 'noopener noreferrer';
        }
      }
    } catch {
      return documentRef.createTextNode(source.textContent || '');
    }
  }
  for (const child of source.childNodes) {
    const copy = copyPublishedNode(child, documentRef, sourceUrl);
    if (copy) target.append(copy);
  }
  return target;
}

/** Render the existing published public manifesto inside the persistent shell. */
export async function loadManifesto(element, { signal } = {}) {
  if (!element?.ownerDocument) throw new TypeError('A manifesto container is required.');
  const sourceUrl = new URL('../manifesto/', import.meta.url);
  const ownership = Symbol('manifesto-load');
  pendingLoads.set(element, ownership);
  element.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(sourceUrl, { signal, credentials:'same-origin' });
    if (!response.ok) throw new Error('The manifesto could not be opened.');
    const text = await response.text();
    signal?.throwIfAborted();
    if (pendingLoads.get(element) !== ownership) throw new DOMException('This manifesto request was superseded.', 'AbortError');
    const documentRef = element.ownerDocument;
    const parsed = new documentRef.defaultView.DOMParser().parseFromString(text, 'text/html');
    const published = parsed.querySelector('#manifesto');
    if (!published) throw new Error('The published manifesto is unavailable.');
    const fragment = documentRef.createDocumentFragment();
    for (const child of published.childNodes) {
      const copy = copyPublishedNode(child, documentRef, sourceUrl);
      if (copy) fragment.append(copy);
    }
    signal?.throwIfAborted();
    if (pendingLoads.get(element) !== ownership) throw new DOMException('This manifesto request was superseded.', 'AbortError');
    element.replaceChildren(fragment);
    element.dataset.loaded = 'true';
    return { title:'The Dream Unity manifesto', sourceUrl:sourceUrl.href, edition:published.querySelector('.manifesto-colophon > p')?.textContent?.trim() || 'Published manifesto' };
  } finally {
    if (pendingLoads.get(element) === ownership) {
      pendingLoads.delete(element);
      element.setAttribute('aria-busy', 'false');
    }
  }
}
