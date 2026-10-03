// Publication replaces this literal. URL parameters and fetched metadata never
// establish which release of this module is actually executing.
export const EXECUTING_RELEASE = null;

const exactCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

// A cached document may predate these controls while its module response is
// current. Install only the missing support UI; do not replace the experience.
export function ensureReleaseElements(document) {
  const ids = ['release-update-notice', 'release-update-message', 'release-reload', 'release-status',
    'release-running', 'release-document', 'release-requested', 'release-published'];
  if (ids.every(id => document.getElementById(id))) return;
  document.getElementById('release-update-notice')?.remove();
  document.querySelector('.release-details')?.remove();
  const node = (tag, id, text) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (text) element.textContent = text;
    return element;
  };
  const notice = node('section', 'release-update-notice'); notice.className = 'release-update-notice';
  notice.hidden = true; notice.setAttribute('aria-label', 'Site update');
  const message = node('p', 'release-update-message'); message.setAttribute('role', 'status');
  const reload = node('button', 'release-reload', 'Reload this page'); reload.type = 'button';
  notice.append(message, node('p', null, 'Reloading clears temporary notes, the current conversation, unsent text and unfinished edits. Notes saved on this device are kept.'), reload);
  const details = node('details'); details.className = 'release-details';
  const status = node('p', 'release-status'); status.setAttribute('role', 'status');
  const list = node('dl');
  for (const [id, label] of [['release-running', 'Running code'], ['release-document', 'Page document'],
    ['release-requested', 'Module request'], ['release-published', 'Published release']]) {
    list.append(node('dt', null, label), node('dd', id, 'Not established'));
  }
  details.append(node('summary', null, 'Release details'), status, list);
  (document.querySelector('.shell-footer') || document.body).append(notice, details);
}

export function createReleaseMonitor({
  runningCommit = EXECUTING_RELEASE,
  requestedCommit = new URL(import.meta.url).searchParams.get('v'),
  documentCommit = null,
  buildUrl = new URL('./build-info.json', import.meta.url),
  fetcher = globalThis.fetch,
  onChange = () => {},
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  const running = exactCommit(runningCommit) ? runningCommit : null;
  const declared = exactCommit(documentCommit) ? documentCommit : null;
  let published = null, publishedVersion = null, phase = 'idle', error = null;
  let closed = false, inFlight = null, abort = null, timer = null, cancelCheck = null;
  function snapshot() {
    const issue = running && ((requestedCommit !== null && requestedCommit !== running) || (declared && declared !== running))
      ? 'mixed' : running && published && published !== running ? 'published'
      : !running || !declared ? 'unidentified' : null;
    return Object.freeze({ running, requested: requestedCommit, declared, published, publishedVersion,
      phase, error, issue, status: phase === 'checking' ? 'checking' : issue === 'mixed' || issue === 'published' ? 'different'
        : issue === 'unidentified' || phase === 'complete' && !published ? 'unidentified'
        : phase === 'complete' ? 'current' : 'unavailable' });
  }
  function publish() { if (!closed) onChange(snapshot()); }
  function check() {
    if (closed) return Promise.resolve(snapshot());
    if (inFlight) return inFlight;
    phase = 'checking'; error = null; abort = new AbortController();
    const ownedAbort = abort;
    publish();
    const timeout = new Promise((resolve, reject) => {
      cancelCheck = () => reject(new Error('Release check cancelled.'));
      timer = setTimer(() => {
        reject(new Error('The published release check timed out.'));
        ownedAbort.abort();
      }, 5000);
    });
    const request = Promise.resolve().then(async () => {
      if (closed || ownedAbort.signal.aborted) throw new Error('Release check cancelled.');
      const response = await fetcher(buildUrl, { cache: 'no-store', credentials: 'omit', signal: ownedAbort.signal });
      if (!response.ok) throw new Error('The published release could not be checked.');
      const info = await response.json();
      if (!info || typeof info !== 'object' || Array.isArray(info) || !(info.sourceCommit === null || exactCommit(info.sourceCommit))) {
        throw new Error('The published release information is invalid.');
      }
      return { commit: info.sourceCommit, version: typeof info.version === 'string' ? info.version.slice(0, 120) : null };
    });
    inFlight = Promise.race([request, timeout]).then(result => {
      if (!closed) { published = result.commit; publishedVersion = result.version; phase = 'complete'; }
    }, failure => {
      if (!closed) { phase = 'unavailable'; error = failure?.message === 'The published release check timed out.'
        ? failure.message : 'The published release could not be checked. Your current visit can continue.'; }
    }).finally(() => {
      clearTimer(timer); timer = null; abort = null; cancelCheck = null; inFlight = null; publish();
    }).then(snapshot);
    return inFlight;
  }
  publish();
  return Object.freeze({ check, getState: snapshot, close() { closed = true; abort?.abort(); clearTimer(timer); cancelCheck?.(); } });
}
