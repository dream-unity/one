import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore, createMemoryController, createIndexedDBPersistence, validateDataset, MEMORY_LIMITS } from '../prototype/memory/store.js';
import { mountMemoryView } from '../prototype/memory/view.js';

// Injection exists only in this test. It mirrors IDB's serialized readwrite transactions:
// a fresh authoritative record is read inside the lock, failure rolls back the whole record.
class TransactionalMemory {
  state;
  queue = Promise.resolve();
  failure = null;
  pause = null;
  afterTransformPause = null;
  afterTransform = null;
  generation = 0;
  transact(transform, { signal } = {}) {
    const run = this.queue.then(async () => {
      if (this.pause) await this.pause;
      if (this.failure) throw this.failure;
      if (signal?.aborted) throw Object.assign(new Error('Proposal was cancelled.'), { code: 'STALE_PROPOSAL' });
      const generation = this.generation;
      const result = transform(this.state === undefined ? undefined : structuredClone(this.state));
      this.afterTransform?.();
      if (this.afterTransformPause) await this.afterTransformPause;
      if (signal?.aborted) throw Object.assign(new Error('Proposal was cancelled before commit.'), { code: 'STALE_PROPOSAL' });
      if (generation !== this.generation) throw Object.assign(new Error('Transaction was aborted before commit.'), { code: 'STALE_STATE' });
      if (result.write) this.state = structuredClone(result.state);
      return structuredClone(result.result);
    });
    this.queue = run.catch(() => {});
    return run;
  }
  abortPending() { this.generation++; }
  close() {}
}
class LocalBroadcast {
  static channels = new Map();
  static messages = [];
  constructor(name) { this.name = name; const channels = LocalBroadcast.channels.get(name) || new Set(); channels.add(this); LocalBroadcast.channels.set(name, channels); }
  postMessage(data) { LocalBroadcast.messages.push(structuredClone(data)); for (const target of LocalBroadcast.channels.get(this.name)) if (target !== this) queueMicrotask(() => target.onmessage?.({ data: structuredClone(data) })); }
  close() { LocalBroadcast.channels.get(this.name)?.delete(this); }
}
let nextId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
const expected = state => ({ consentEpoch: state.consentEpoch, revision: state.revision });
const node = (title = 'An exact goal', text = 'A deliberate next step.') => ({ operation: 'create_node', kind: 'goal', title, text });
function fixture(options = {}) {
  const persistence = options.persistence || new TransactionalMemory();
  const store = createMemoryStore({ persistence, BroadcastChannel: null, now: () => 10, uuid, ...options });
  return { store, persistence };
}
async function enable(store, sharing = true) {
  const state = await store.load();
  return store.setConsent({ storageEnabled: true, conversationUseEnabled: sharing }, expected(state));
}
async function save(store, proposal) { const state = await store.load(); return store.commitProposal(proposal, expected(state)); }

test('device memory starts with independent opt-ins and refuses unavailable persistence', async () => {
  const { store, persistence } = fixture();
  const fresh = await store.load();
  assert.equal(fresh.consent.storageEnabled, false);
  assert.equal(fresh.consent.conversationUseEnabled, false);
  await assert.rejects(store.commitProposal(node(), expected(fresh)), { code: 'STORAGE_DISABLED' });
  await assert.rejects(store.setConsent({ storageEnabled: false, conversationUseEnabled: true }, expected(fresh)), { code: 'INVALID_INPUT' });
  assert.equal(persistence.state, undefined); // Reading/declining consent never creates a durable record.
  const unavailable = createMemoryStore({ indexedDB: null, BroadcastChannel: null });
  const empty = await unavailable.load();
  assert.equal(empty.nodes.length, 0); assert.equal(unavailable.getStatus().mode, 'unavailable');
  assert.equal(unavailable.getStatus().savingEnabled, false);
  await assert.rejects(unavailable.commitProposal(node(), expected(empty)), { code: 'STORAGE_UNAVAILABLE' });
  store.close(); unavailable.close();
});

test('persisted graph uses stable IDs, exact revisions and explicit pause/archive edits', async () => {
  const { store, persistence } = fixture(); await enable(store);
  const first = await save(store, node());
  const original = first.record;
  const updated = await store.commitProposal({ operation: 'update_node', nodeId: original.id, expectedRevision: original.revision, kind: 'project', title: 'Changed deliberately', text: original.text, status: 'paused' }, expected(first.dataset));
  assert.equal(updated.record.id, original.id);
  assert.equal(updated.record.createdAt, original.createdAt);
  assert.ok(updated.record.updatedAt > original.updatedAt);
  assert.equal(updated.record.revision, original.revision + 1);
  await assert.rejects(store.commitProposal({ operation: 'update_node', nodeId: original.id, expectedRevision: original.revision, kind: original.kind, title: original.title, text: original.text, status: 'archived' }, expected(updated.dataset)), { code: 'STALE_RECORD' });
  const reloaded = fixture({ persistence }).store;
  assert.equal((await reloaded.load()).nodes[0].status, 'paused');
  store.close(); reloaded.close();
});

test('relationships reject dangling/self edges and reuse duplicate directed identities without edits', async () => {
  const { store } = fixture(); await enable(store);
  const a = (await save(store, node('First'))).record;
  const b = (await save(store, node('Second'))).record;
  const proposal = { operation: 'create_edge', from: a.id, fromRevision: a.revision, to: b.id, toRevision: b.revision, relation: 'supports', label: 'A chosen connection' };
  const made = await save(store, proposal);
  const duplicate = await save(store, { ...proposal, label: 'Must not overwrite the old label' });
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.changed, false);
  assert.equal(duplicate.record.id, made.record.id); assert.equal(duplicate.record.label, made.record.label);
  assert.equal(duplicate.dataset.revision, made.dataset.revision);
  await assert.rejects(save(store, { ...proposal, to: a.id }), { code: 'SELF_EDGE' });
  await assert.rejects(save(store, { ...proposal, to: uuid() }), { code: 'RECORD_NOT_FOUND' });
  await assert.rejects(save(store, { ...proposal, fromRevision: 999 }), { code: 'STALE_RECORD' });
  store.close();
});

test('update edge cannot create an existing directed tuple, and deletion atomically removes incident edges', async () => {
  const revokes = []; const { store } = fixture({ onRevoke: value => revokes.push(value) }); await enable(store);
  const a = (await save(store, node('A'))).record, b = (await save(store, node('B'))).record;
  const base = { operation: 'create_edge', from: a.id, fromRevision: a.revision, to: b.id, toRevision: b.revision, label: '' };
  const support = await save(store, { ...base, relation: 'supports' });
  const challenge = await save(store, { ...base, relation: 'challenges' });
  await assert.rejects(store.commitProposal({ operation: 'update_edge', edgeId: challenge.record.id, expectedRevision: challenge.record.revision, relation: 'supports', label: '' }, expected(challenge.dataset)), { code: 'DUPLICATE_EDGE' });
  const state = await store.load();
  const deleted = await store.deleteNode(a.id, { ...expected(state), expectedRevision: a.revision });
  assert.equal(deleted.nodes.length, 1); assert.equal(deleted.edges.length, 0);
  assert.equal(deleted.consentEpoch, state.consentEpoch + 1);
  assert.equal(revokes.at(-1).reason, 'delete-node');
  await assert.rejects(store.commitProposal({ operation: 'update_edge', edgeId: support.record.id, expectedRevision: 1, relation: 'supports', label: '' }, expected(deleted)), { code: 'RECORD_NOT_FOUND' });
  store.close();
});

test('AI proposals are volatile, scope-bound and need an unforgeable exact local confirmation receipt', async () => {
  const { store, persistence } = fixture(); await enable(store);
  const controller = createMemoryController({ store });
  const state = await store.load(), turnId = uuid();
  const proposed = await controller.propose(node('An AI suggestion'), { ...expected(state), turnId, sharedIds: [] });
  assert.equal(persistence.state.nodes.length, 0);
  await assert.rejects(store.commitProposal(proposed.proposal, { ...expected(state), authorship: 'ai-confirmed', confirmation: { confirmed: true } }), { code: 'CONFIRMATION_REQUIRED' });
  await assert.rejects(controller.confirm(proposed.proposalId, { turnId: uuid() }), { code: 'STALE_PROPOSAL' });
  const confirmed = await controller.confirm(proposed.proposalId, { turnId });
  assert.equal(confirmed.record.authorship, 'ai-confirmed');
  assert.equal(confirmed.record.text, proposed.proposal.text);
  assert.equal(controller.getPending(), null);
  const updatedState = await store.load(), existing = confirmed.record;
  await assert.rejects(controller.propose({ operation: 'update_node', nodeId: existing.id, expectedRevision: existing.revision, kind: existing.kind, title: 'Expanded', text: 'New proposal', status: 'active' }, { ...expected(updatedState), turnId, sharedIds: [] }), { code: 'UNSHARED_TARGET' });
  const edit = await controller.propose({ operation: 'update_node', nodeId: existing.id, expectedRevision: existing.revision, kind: existing.kind, title: 'Expanded', text: 'New proposal', status: 'active' }, { ...expected(updatedState), turnId, sharedIds: [existing.id] });
  assert.equal(edit.before.text, existing.text); assert.equal(edit.after.text, 'New proposal');
  controller.invalidate(); await assert.rejects(controller.confirm(edit.proposalId, { turnId }), { code: 'STALE_PROPOSAL' });
  controller.close(); store.close();
});

test('concurrent saves compare authoritative transaction revisions; one wins without lost updates', async () => {
  const persistence = new TransactionalMemory(); const a = fixture({ persistence }).store, b = fixture({ persistence }).store;
  const state = await enable(a); await b.load();
  const results = await Promise.allSettled([a.commitProposal(node('A'), expected(state)), b.commitProposal(node('B'), expected(state))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'STALE_STATE');
  assert.equal((await b.load()).nodes.length, 1);
  a.close(); b.close();
});

test('revoke-before-inflight-save persists a tombstone and old tabs cannot resurrect notes', async () => {
  const persistence = new TransactionalMemory(), revokes = [];
  const a = fixture({ persistence, onRevoke: value => revokes.push(value) }).store, b = fixture({ persistence }).store;
  await enable(a); const saved = await save(a, node('Delete me')); const stale = await b.load();
  const cleared = a.clear(expected(saved.dataset));
  const attempted = b.commitProposal(node('Must not resurrect'), expected(stale));
  await cleared; await assert.rejects(attempted, { code: 'STALE_STATE' });
  const result = await b.load();
  assert.equal(result.nodes.length, 0); assert.equal(result.consent.storageEnabled, false);
  assert.equal(result.consent.conversationUseEnabled, false); assert.ok(result.consentEpoch > stale.consentEpoch);
  assert.equal(revokes.at(-1).reason, 'clear');
  const reopened = fixture({ persistence }).store;
  assert.equal((await reopened.load()).consentEpoch, result.consentEpoch);
  a.close(); b.close(); reopened.close();
});

test('same-tab clear invalidates an already queued save before it acquires the transaction', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  let release; persistence.pause = new Promise(resolve => { release = resolve; });
  const saveAttempt = store.commitProposal(node(), expected(state));
  const clearAttempt = store.clear(expected(state));
  release(); persistence.pause = null;
  await assert.rejects(saveAttempt, { code: 'STALE_STATE' }); await clearAttempt;
  assert.equal((await store.load()).nodes.length, 0); store.close();
});

test('revocation aborts a save after transform/put scheduling but before transaction completion', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  let release, transformed;
  persistence.afterTransformPause = new Promise(resolve => { release = resolve; });
  const atTransform = new Promise(resolve => { transformed = resolve; });
  persistence.afterTransform = transformed;
  const saveAttempt = store.commitProposal(node('Never commit this note'), expected(state));
  await atTransform;
  const clearAttempt = store.clear(expected(state));
  persistence.afterTransform = null; persistence.afterTransformPause = null; release();
  await assert.rejects(saveAttempt, { code: 'STALE_STATE' }); await clearAttempt;
  const current = await store.load();
  assert.equal(current.nodes.length, 0); assert.equal(current.consent.storageEnabled, false); assert.equal(current.consent.conversationUseEnabled, false);
  store.close();
});

test('cancelling a user-authored operation rolls back its queued write and preserves consent', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  const before = structuredClone(persistence.state), abort = new AbortController();
  let release, transformed;
  persistence.afterTransformPause = new Promise(resolve => { release = resolve; });
  const atTransform = new Promise(resolve => { transformed = resolve; });
  persistence.afterTransform = transformed;
  const saving = store.commitProposal(node('Cancelled exact remember command'), { ...expected(state), authorship: 'user', signal: abort.signal });
  await atTransform;
  abort.abort();
  persistence.afterTransform = null; persistence.afterTransformPause = null; release();
  await assert.rejects(saving, { code: 'STALE_PROPOSAL' });
  assert.deepEqual(persistence.state, before);
  assert.deepEqual(await store.load(), state);
  store.close();
});

test('sharing revocation retains notes and clears exact AI proposals', async () => {
  const { store } = fixture(); await enable(store); const saved = await save(store, node());
  const controller = createMemoryController({ store }); const turnId = uuid();
  const candidate = await controller.propose(node('Pending'), { ...expected(saved.dataset), turnId });
  const disabled = await store.setConsent({ storageEnabled: true, conversationUseEnabled: false }, expected(saved.dataset));
  assert.equal(disabled.nodes.length, 1); assert.equal(controller.getPending(), null);
  await assert.rejects(controller.confirm(candidate.proposalId, { turnId }), { code: 'STALE_PROPOSAL' });
  await assert.rejects(store.selectContext([saved.record.id]), { code: 'SHARING_DISABLED' });
  assert.deepEqual((await store.selectContext([])).records, []);
  controller.close(); store.close();
});

test('cross-tab broadcasts contain revisions only and force an authoritative reload/revocation callback', async () => {
  LocalBroadcast.messages = [];
  const persistence = new TransactionalMemory(), changes = [], revokes = [];
  const a = fixture({ persistence, dbName: 'broadcast-test', BroadcastChannel: LocalBroadcast }).store;
  const b = fixture({ persistence, dbName: 'broadcast-test', BroadcastChannel: LocalBroadcast, onChange: (state, detail) => changes.push({ state, detail }), onRevoke: info => revokes.push(info) }).store;
  await enable(a); await b.load(); const saved = await save(a, node('Private text'));
  await b.load(); await a.clear(expected(saved.dataset));
  await new Promise(resolve => setImmediate(resolve)); await persistence.queue;
  assert.equal(changes.at(-1).state.nodes.length, 0);
  assert.ok(revokes.some(info => info.reason === 'external-change'));
  assert.ok(LocalBroadcast.messages.length);
  for (const message of LocalBroadcast.messages) assert.deepEqual(Object.keys(message).sort(), ['consentEpoch', 'revision', 'schemaVersion']);
  a.close(); b.close();
});

test('context selection is explicit, tagged and bounded in aggregate Unicode characters', async () => {
  const { store } = fixture(); await enable(store);
  const a = (await save(store, node('A', '😀'.repeat(1200)))).record;
  const b = (await save(store, node('B', '😀'.repeat(1200)))).record;
  const c = (await save(store, node('C', 'x'.repeat(100)))).record;
  const included = await store.selectContext([a.id, b.id]);
  assert.equal(included.records.length, 2); assert.equal(included.records[0].recordType, 'node');
  assert.equal(Object.hasOwn(included.records[0], 'authorship'), false);
  await assert.rejects(store.selectContext([a.id, b.id, c.id]), { code: 'CONTEXT_LIMIT' });
  await assert.rejects(store.selectContext([a.id, a.id]), { code: 'CONTEXT_LIMIT' });
  await assert.rejects(store.selectContext(Array.from({ length: 7 }, uuid)), { code: 'CONTEXT_LIMIT' });
  const relation = await save(store, { operation: 'create_edge', from: a.id, fromRevision: 1, to: b.id, toRevision: 1, relation: 'relates_to', label: 'An explicit link' });
  const edgeOnly = await store.selectContext([relation.record.id]);
  assert.equal(edgeOnly.records.length, 1); assert.equal(edgeOnly.records[0].recordType, 'edge');
  assert.equal(edgeOnly.records[0].from, a.id); // Its endpoint notes were not automatically included.
  store.close();
});

test('record bounds include archived notes and errors neither overwrite nor fake persistence', async () => {
  const { store, persistence } = fixture(); await enable(store);
  for (let count = 0; count < MEMORY_LIMITS.nodes; count++) await save(store, node(`Note ${count}`));
  await assert.rejects(save(store, node('Overflow')), { code: 'MEMORY_LIMIT' });
  assert.equal((await store.load()).nodes.length, 128);
  const original = structuredClone(persistence.state);
  persistence.failure = new Error('Quota exceeded');
  await assert.rejects(store.commitProposal(node(), expected(original)), /Quota exceeded/);
  assert.deepEqual(persistence.state, original);
  persistence.failure = null; store.close();
});

test('transaction failure leaves an exact AI suggestion available but unsaved', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  const controller = createMemoryController({ store }), turnId = uuid();
  const candidate = await controller.propose(node(), { ...expected(state), turnId });
  persistence.failure = new Error('Storage denied');
  await assert.rejects(controller.confirm(candidate.proposalId, { turnId }), /Storage denied/);
  assert.equal(controller.getPending().proposalId, candidate.proposalId);
  assert.equal(persistence.state.nodes.length, 0);
  persistence.failure = null;
  assert.equal((await controller.confirm(candidate.proposalId, { turnId })).record.authorship, 'ai-confirmed');
  controller.close(); store.close();
});

test('edge bound retains all 256 relationships and permits a duplicate review at capacity', async () => {
  const { store, persistence } = fixture(); await enable(store);
  const notes = [];
  for (let count = 0; count < 18; count++) notes.push((await save(store, node(`Endpoint ${count}`))).record);
  const proposals = [];
  for (const from of notes) for (const to of notes) if (from.id !== to.id) proposals.push({ operation: 'create_edge', from: from.id, fromRevision: 1, to: to.id, toRevision: 1, relation: 'relates_to', label: '' });
  for (const proposal of proposals.slice(0, 256)) await save(store, proposal);
  await assert.rejects(save(store, proposals[256]), { code: 'MEMORY_LIMIT' });
  assert.equal(persistence.state.edges.length, 256);
  const duplicate = await save(store, proposals[0]); assert.equal(duplicate.duplicate, true); assert.equal(duplicate.dataset.edges.length, 256);
  store.close();
});

test('controller invalidation while an asynchronous proposal load is waiting cannot revive a candidate', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  const controller = createMemoryController({ store });
  let release; persistence.pause = new Promise(resolve => { release = resolve; });
  const candidate = controller.propose(node(), { ...expected(state), turnId: uuid() });
  controller.invalidate(); release(); persistence.pause = null;
  await assert.rejects(candidate, { code: 'STALE_PROPOSAL' }); assert.equal(controller.getPending(), null);
  controller.close(); store.close();
});

test('cancelled action cannot install a proposal after its asynchronous load', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  const controller = createMemoryController({ store }), abort = new AbortController();
  let release; persistence.pause = new Promise(resolve => { release = resolve; });
  const candidate = controller.propose(node(), { ...expected(state), turnId: uuid(), signal: abort.signal });
  abort.abort(); release(); persistence.pause = null;
  await assert.rejects(candidate, { code: 'STALE_PROPOSAL' }); assert.equal(controller.getPending(), null);
  controller.close(); store.close();
});

test('declining a confirming AI candidate aborts its queued write after transform but before commit', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  const controller = createMemoryController({ store }), turnId = uuid();
  const candidate = await controller.propose(node('Declined before commit'), { ...expected(state), turnId });
  let release, transformed;
  persistence.afterTransformPause = new Promise(resolve => { release = resolve; });
  const atTransform = new Promise(resolve => { transformed = resolve; }); persistence.afterTransform = transformed;
  const confirming = controller.confirm(candidate.proposalId, { turnId }); await atTransform;
  controller.reject(candidate.proposalId); persistence.afterTransform = null; persistence.afterTransformPause = null; release();
  await assert.rejects(confirming, { code: 'STALE_PROPOSAL' });
  assert.equal((await store.load()).nodes.length, 0); assert.equal(controller.getPending(), null);
  controller.close(); store.close();
});

test('failed revocation still invalidates volatile candidates and cancels root replay immediately', async () => {
  const revocations = []; const { store, persistence } = fixture({ onRevoke: event => revocations.push(event) });
  const state = await enable(store); const controller = createMemoryController({ store }), turnId = uuid();
  const candidate = await controller.propose(node(), { ...expected(state), turnId });
  persistence.failure = new Error('Storage is denied');
  const clearing = store.clear(expected(state));
  assert.equal(controller.getPending(), null); assert.equal(revocations.at(-1).pending, true);
  await assert.rejects(clearing, /Storage is denied/);
  await assert.rejects(controller.confirm(candidate.proposalId, { turnId }), { code: 'STALE_PROPOSAL' });
  assert.equal(persistence.state.consent.storageEnabled, true); // The UI must not claim deletion succeeded.
  persistence.failure = null; controller.close(); store.close();
});

test('close during an in-flight transaction aborts queued mutation ownership', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  let release; persistence.pause = new Promise(resolve => { release = resolve; });
  const saving = store.commitProposal(node(), expected(state)); store.close(); release(); persistence.pause = null;
  await assert.rejects(saving, { code: 'STORE_CLOSED' }); assert.equal(persistence.state.nodes.length, 0);
});

test('dataset validators reject forged consent, unknown fields and malformed Unicode without recovery overwrites', async () => {
  const { store, persistence } = fixture(); const state = await enable(store);
  await assert.rejects(store.commitProposal({ ...node(), confirmed: true }, expected(state)), { code: 'INVALID_INPUT' });
  await assert.rejects(store.commitProposal(node('Bad', '\ud800'), expected(state)), { code: 'INVALID_INPUT' });
  const corrupt = structuredClone(state); corrupt.consent.storageEnabled = false; corrupt.consent.conversationUseEnabled = true;
  assert.throws(() => validateDataset(corrupt), { code: 'INVALID_INPUT' });
  persistence.state = corrupt;
  await assert.rejects(store.load(), { code: 'INVALID_INPUT' }); assert.deepEqual(persistence.state, corrupt);
  store.close();
});

test('IDB adapter reports blocked opening and never falls back to an in-memory durable claim', async () => {
  const request = {};
  const adapter = createIndexedDBPersistence({ indexedDB: { open: () => request }, timeoutMs: 100 });
  const opening = adapter.transact(() => ({}));
  queueMicrotask(() => request.onblocked());
  await assert.rejects(opening, { code: 'STORAGE_BLOCKED' }); adapter.close();
});

test('production IDB request failure stays STORAGE_ERROR and keeps the exact uncommitted AI candidate', async () => {
  // Controlled IDB event facade exercises the production get/put/onabort path,
  // which differs from errors rejected directly by the transactional injection.
  const factory = { state: undefined, failNextCommit: false, open() {
    const request = {};
    const database = { objectStoreNames: { contains: () => true }, close() {}, transaction() {
      let pending, aborted = false;
      const transaction = { objectStore() { return {
        get() { const get = {}; setImmediate(() => {
          if (aborted) return;
          get.result = factory.state === undefined ? undefined : structuredClone(factory.state); get.onsuccess();
          setImmediate(() => {
            if (aborted) return;
            if (factory.failNextCommit) { factory.failNextCommit = false; transaction.error = new DOMException('Quota exceeded', 'QuotaExceededError'); transaction.abort(); return; }
            if (pending !== undefined) factory.state = structuredClone(pending);
            transaction.oncomplete();
          });
        }); return get; },
        put(value) { pending = structuredClone(value); }
      }; }, abort() { if (aborted) return; aborted = true; queueMicrotask(() => transaction.onabort()); } };
      return transaction;
    } };
    queueMicrotask(() => { request.result = database; request.onsuccess(); }); return request;
  } };
  const store = createMemoryStore({ indexedDB: factory, BroadcastChannel: null, now: () => 10, uuid });
  const state = await enable(store), turnId = uuid();
  const controller = createMemoryController({ store });
  const candidate = await controller.propose(node('Keep this exact candidate'), { ...expected(state), turnId });
  factory.failNextCommit = true;
  await assert.rejects(controller.confirm(candidate.proposalId, { turnId }), { code: 'STORAGE_ERROR' });
  assert.equal(controller.getPending().proposalId, candidate.proposalId); assert.equal(factory.state.nodes.length, 0);
  assert.equal((await controller.confirm(candidate.proposalId, { turnId })).record.title, 'Keep this exact candidate');
  controller.close(); store.close();
});

// Interaction-only DOM facade: detached/disabled controls cannot retain focus.
// This exercises real view event handlers; layout, native IDB and screen-reader
// behavior remain separate browser acceptance checks.
function memoryDocument() {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.parentNode = null; this.value = ''; }
    get isConnected() { return this === document.body || Boolean(this.parentNode?.isConnected); }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
    replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this._text = ''; this.append(...children); }
    remove() {
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get textContent() { return (this._text || '') + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    focus() { if (this.isConnected && !this.disabled) document.activeElement = this; }
    click() { if (!this.disabled) { this.focus(); return this.listeners.click?.({ preventDefault() {} }); } }
    querySelectorAll(selector) {
      const choices = selector.split(',').map(value => value.trim());
      const matches = node => choices.some(choice => {
        if (choice === '[data-focus-key]') return node.dataset.focusKey !== undefined;
        const focus = choice.match(/^\[data-focus-key="([^"]+)"\]$/);
        return focus ? node.dataset.focusKey === focus[1] : node.tagName === choice;
      });
      const found = [];
      for (const child of this.children) { if (matches(child)) found.push(child); found.push(...child.querySelectorAll(selector)); }
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const document = { createElement: tag => new Element(tag) };
  document.body = new Element('body'); document.activeElement = document.body;
  return document;
}
const byText = (container, title) => container.querySelectorAll('button').find(button => button.textContent === title);
const settleView = async () => { for (let turn = 0; turn < 4; turn++) await new Promise(resolve => setImmediate(resolve)); };
async function withMemoryView(run) {
  const previous = globalThis.document; globalThis.document = memoryDocument();
  const { store, persistence } = fixture(); await enable(store);
  const saved = await save(store, node('A recoverable goal'));
  const container = document.createElement('div'), proposals = document.createElement('div'); document.body.append(container, proposals);
  let view;
  const controller = createMemoryController({ store, onPendingChange: proposal => view?.setProposal(proposal) });
  view = mountMemoryView(container, { store, controller, proposalsContainer: proposals });
  try { await view.refresh(); await run({ store, persistence, saved, container, proposals, controller, view }); }
  finally { view.close(); controller.close(); store.close(); globalThis.document = previous; }
}

test('keyboard deletion returns to its owner on Keep and to an available control after commit', async () => {
  await withMemoryView(async ({ store, saved, container }) => {
    byText(container, 'Delete').click();
    assert.equal(document.activeElement.textContent, 'Delete this note');
    byText(container, 'Keep it').click();
    assert.equal(document.activeElement.dataset.focusKey, `delete-${saved.record.id}`);
    assert.equal((await store.load()).nodes.length, 1);
    byText(container, 'Delete').click(); byText(container, 'Delete this note').click(); await settleView();
    assert.equal((await store.load()).nodes.length, 0);
    assert.equal(document.activeElement.dataset.focusKey, 'add-note');
  });
});

test('cancelling note and relationship edits restores their keyboard entry points', async () => {
  await withMemoryView(async ({ store, saved, container }) => {
    byText(container, 'Edit').click(); byText(container, 'Cancel editing').click();
    assert.equal(document.activeElement.dataset.focusKey, `edit-${saved.record.id}`);
    const second = await save(store, node('Second endpoint'));
    const edge = await save(store, { operation: 'create_edge', from: saved.record.id, fromRevision: 1, to: second.record.id, toRevision: 1, relation: 'supports', label: 'Chosen connection' });
    byText(container, 'Edit relationship').click(); byText(container, 'Cancel').click();
    assert.equal(document.activeElement.dataset.focusKey, `edit-edge-${edge.record.id}`);
    byText(container, 'Delete relationship').click(); byText(container, 'Keep it').click();
    assert.equal(document.activeElement.dataset.focusKey, `delete-edge-${edge.record.id}`);
  });
});

test('failed AI confirmation keeps exact readable relationship review and keyboard retry', async () => {
  await withMemoryView(async ({ store, persistence, saved, container, proposals, controller }) => {
    const second = await save(store, node('Second endpoint'));
    const edge = await save(store, { operation: 'create_edge', from: saved.record.id, fromRevision: 1, to: second.record.id, toRevision: 1, relation: 'supports', label: 'Original wording' });
    const candidate = await controller.propose({ operation: 'update_edge', edgeId: edge.record.id, expectedRevision: 1, relation: 'challenges', label: 'Proposed wording' }, { ...expected(edge.dataset), turnId: uuid(), sharedIds: [edge.record.id] });
    const texts = proposals.querySelectorAll('pre').map(element => element.textContent);
    assert.match(texts[0], /From: A recoverable goal\nTo: Second endpoint\nRelationship: supports\nLabel: Original wording/);
    assert.match(texts[1], /From: A recoverable goal\nTo: Second endpoint\nRelationship: challenges\nLabel: Proposed wording/);
    persistence.failure = new Error('Device storage denied');
    await byText(proposals, 'Confirm this exact change').click();
    assert.equal(controller.getPending().proposalId, candidate.proposalId);
    assert.equal(document.activeElement.textContent, 'Confirm this exact change');
    assert.match(container.textContent, /Not saved\. Device storage denied/);
    persistence.failure = null;
    byText(proposals, 'Decline this suggestion').click();
    assert.equal(controller.getPending(), null); assert.equal(document.activeElement.dataset.focusKey, 'add-note');
    assert.equal((await store.load()).edges[0].label, 'Original wording');
  });
});

async function visit(store) { const state = await store.load(); return store.setMode('session', expected(state)); }

test('explicit visit notes, relationships and sharing use only the private graph', async () => {
  let deviceCalls = 0, forbidden = false;
  const persistence = new TransactionalMemory(), transact = persistence.transact.bind(persistence);
  persistence.transact = (...args) => { deviceCalls++; assert.equal(forbidden, false, 'visit operations must not access device persistence'); return transact(...args); };
  const { store } = fixture({ persistence });
  const first = await visit(store); forbidden = true; const calls = deviceCalls;
  assert.equal(store.getStatus().mode, 'session'); assert.equal(first.consent.storageEnabled, false);
  const a = await save(store, node('Visit A')), b = await save(store, node('Visit B'));
  const edge = await save(store, { operation: 'create_edge', from: a.record.id, fromRevision: 1, to: b.record.id, toRevision: 1, relation: 'supports', label: 'A chosen visit relationship' });
  await assert.rejects(store.selectContext([a.record.id]), { code: 'SHARING_DISABLED' });
  const sharing = await store.setConsent({ storageEnabled: false, conversationUseEnabled: true }, expected(edge.dataset));
  assert.equal(sharing.nodes.length, 2); assert.equal(sharing.consent.storageEnabled, false);
  const context = await store.selectContext([a.record.id, edge.record.id]);
  assert.deepEqual(context.records.map(record => record.id), [a.record.id, edge.record.id]);
  assert.equal(context.records.some(record => record.id === b.record.id), false);
  const paused = await store.commitProposal({ operation: 'update_node', nodeId: a.record.id, expectedRevision: 1, kind: 'goal', title: a.record.title, text: a.record.text, status: 'paused' }, expected(sharing));
  const revoked = await store.setConsent({ storageEnabled: false, conversationUseEnabled: false }, expected(paused.dataset));
  assert.equal(revoked.nodes[0].status, 'paused'); assert.equal(revoked.edges.length, 1);
  const deleted = await store.deleteNode(a.record.id, { ...expected(revoked), expectedRevision: 2 });
  assert.equal(deleted.edges.length, 0); assert.equal(deviceCalls, calls); assert.equal(persistence.state, undefined);
  const cleared = await store.clear(expected(deleted)); assert.equal(cleared.nodes.length, 0); assert.equal(store.getStatus().savingEnabled, true);
  store.close();
});

test('device unavailable remains honestly empty until a visit is explicitly chosen', async () => {
  let openings = 0;
  const store = createMemoryStore({ indexedDB: { open() { openings++; throw new Error('Denied'); } }, BroadcastChannel: null, now: () => 10, uuid });
  const fresh = await store.load();
  assert.equal(openings, 1); assert.equal(store.getStatus().mode, 'unavailable'); assert.equal(store.getStatus().deviceAvailable, false);
  await assert.rejects(store.commitProposal(node('Not authorized yet'), expected(fresh)), { code: 'STORAGE_UNAVAILABLE' });
  const selected = await store.setMode('session', expected(fresh));
  await save(store, node('A real visit note'));
  assert.equal(openings, 1); assert.equal(selected.consent.storageEnabled, false); assert.equal((await store.load()).nodes.length, 1);
  store.close();
  const reopened = createMemoryStore({ indexedDB: null, BroadcastChannel: null, now: () => 10, uuid });
  assert.equal((await reopened.load()).nodes.length, 0); assert.equal(reopened.getStatus().savingEnabled, false); reopened.close();
});

test('scope changes preserve prior device records and never promote visit records or sharing', async () => {
  const { store, persistence } = fixture(); const initial = await store.load();
  const enabled = await store.setMode('device', expected(initial)); assert.equal(enabled.consent.storageEnabled, true);
  const durable = await save(store, node('Durable original')); const before = structuredClone(persistence.state);
  const firstVisit = await store.setMode('session', expected(durable.dataset));
  assert.equal(firstVisit.nodes.length, 0); assert.deepEqual(persistence.state, before);
  const temporary = await save(store, node('Never promote'));
  const shared = await store.setConsent({ storageEnabled: false, conversationUseEnabled: true }, expected(temporary.dataset));
  await assert.rejects(store.setConsent({ storageEnabled: true, conversationUseEnabled: true }, expected(shared)), { code: 'MODE_CONFIRMATION_REQUIRED' });
  const recalled = await store.setMode('device', expected(shared));
  assert.deepEqual(recalled.nodes, before.nodes); assert.equal(recalled.consent.conversationUseEnabled, false);
  assert.ok(recalled.revision > shared.revision); assert.ok(recalled.consentEpoch > shared.consentEpoch);
  assert.equal(persistence.state.nodes.some(record => record.id === temporary.record.id), false);
  await assert.rejects(store.commitProposal(node('Old tuple'), expected(shared)), { code: 'STALE_STATE' });
  const secondVisit = await store.setMode('session', expected(recalled));
  assert.equal(secondVisit.nodes.length, 0); assert.ok(secondVisit.revision > recalled.revision); assert.ok(secondVisit.consentEpoch > recalled.consentEpoch);
  store.close();
});

test('failed device choice preserves exact visit notes and does not repair corrupt durable records', async () => {
  const { store, persistence } = fixture(); await visit(store); const saved = await save(store, node('Keep my visit'));
  persistence.failure = Object.assign(new Error('Device commit denied'), { code: 'STORAGE_ERROR' });
  await assert.rejects(store.setMode('device', expected(saved.dataset)), { code: 'STORAGE_ERROR' });
  assert.equal(store.getStatus().mode, 'session'); assert.deepEqual((await store.load()).nodes, saved.dataset.nodes);
  persistence.failure = null;
  const corrupt = { schemaVersion: 999 }; persistence.state = structuredClone(corrupt);
  await assert.rejects(store.setMode('device', expected(saved.dataset)), { code: 'INVALID_INPUT' });
  assert.deepEqual(persistence.state, corrupt); assert.deepEqual((await store.load()).nodes, saved.dataset.nodes); store.close();
});

test('visit to device rereads cross-tab changes and revocation without resurrecting either graph', async () => {
  const persistence = new TransactionalMemory();
  const a = fixture({ persistence, BroadcastChannel: LocalBroadcast }).store, b = fixture({ persistence, BroadcastChannel: LocalBroadcast }).store;
  await enable(a); const durable = await save(a, node('Existing device note')); await b.load();
  await a.setMode('session', expected(durable.dataset)); const temporary = await save(a, node('Private visit note'));
  const bSaved = await save(b, node('Another tab device note')); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await a.load()).nodes[0].title, 'Private visit note');
  const recalled = await a.setMode('device', expected(temporary.dataset));
  assert.deepEqual(recalled.nodes.map(record => record.title), ['Existing device note', 'Another tab device note']);
  const nextVisit = await a.setMode('session', expected(recalled)); await b.load();
  const oldB = await b.load(); await b.clear(expected(oldB));
  const afterRevoke = await a.setMode('device', expected(nextVisit));
  assert.equal(afterRevoke.nodes.length, 0); assert.equal(afterRevoke.consent.conversationUseEnabled, false);
  await assert.rejects(b.commitProposal(node('Old tab attempt'), expected(bSaved.dataset)), { code: 'STALE_STATE' });
  a.close(); b.close();
});

test('clearDevice from a visit deletes authoritative durable content and leaves visit content alone', async () => {
  const { store, persistence } = fixture(); await enable(store); const device = await save(store, node('Forget device only'));
  await store.setMode('session', expected(device.dataset)); const temporary = await save(store, node('Keep visit only'));
  const cleared = await store.clearDevice();
  assert.equal(cleared.nodes.length, 0); assert.equal(cleared.consent.storageEnabled, false);
  assert.deepEqual(persistence.state, cleared); assert.deepEqual((await store.load()).nodes, temporary.dataset.nodes);
  assert.equal(store.getStatus().mode, 'session');
  const recalled = await store.setMode('device', expected(temporary.dataset)); assert.equal(recalled.nodes.length, 0); store.close();
});

test('visit confirmation is exact and volatile, and ending the visit cancels queued writes', async () => {
  const { store, persistence } = fixture(); const state = await visit(store), controller = createMemoryController({ store }), turnId = uuid();
  const candidate = await controller.propose(node('An exact visit suggestion'), { ...expected(state), turnId });
  assert.equal(persistence.state, undefined); assert.equal((await store.load()).nodes.length, 0);
  const confirmed = await controller.confirm(candidate.proposalId, { turnId }); assert.equal(confirmed.record.authorship, 'ai-confirmed');
  const next = await controller.propose(node('Must expire'), { ...expected(confirmed.dataset), turnId });
  const pendingWrite = store.commitProposal(node('Queued visit write'), expected(confirmed.dataset));
  const ended = await store.setMode('off', expected(confirmed.dataset));
  await assert.rejects(pendingWrite, { code: 'STORE_CLOSED' });
  await assert.rejects(controller.confirm(next.proposalId, { turnId }), { code: 'STALE_PROPOSAL' });
  assert.equal(ended.nodes.length, 0); assert.equal(store.getStatus().savingEnabled, false);
  await assert.rejects(store.commitProposal(node(), expected(ended)), { code: 'STORAGE_DISABLED' });
  assert.equal(persistence.state, undefined); controller.close(); store.close();
});

test('close and reload discard visit records, proposals and consent without changing device records', async () => {
  const { store, persistence } = fixture(); await enable(store); const original = await save(store, node('Survive on device'));
  const deviceState = structuredClone(persistence.state); await store.setMode('session', expected(original.dataset));
  const temporary = await save(store, node('Expire on Exit')); const controller = createMemoryController({ store });
  await controller.propose(node('Expire unconfirmed'), { ...expected(temporary.dataset), turnId: uuid() });
  const pending = store.commitProposal(node('Expire pending save'), expected(temporary.dataset)); store.close();
  await assert.rejects(pending, { code: 'STORE_CLOSED' }); await assert.rejects(store.load(), { code: 'STORE_CLOSED' });
  assert.equal(controller.getPending(), null); assert.equal(store.getStatus().savingEnabled, false); assert.deepEqual(persistence.state, deviceState);
  const reloaded = fixture({ persistence }).store; assert.deepEqual((await reloaded.load()).nodes, deviceState.nodes);
  assert.equal(reloaded.getStatus().mode, 'device'); controller.close(); reloaded.close();
});

test('completion of an already committed device operation cannot publish into the new visit', async () => {
  const persistence = new TransactionalMemory(); let release, committed, hold = false;
  const waitForCommit = new Promise(resolve => { committed = resolve; });
  const completion = new Promise(resolve => { release = resolve; });
  const transact = persistence.transact.bind(persistence);
  persistence.transact = async (...args) => { const result = await transact(...args); if (hold) { hold = false; committed(); await completion; } return result; };
  const events = []; const { store } = fixture({ persistence, onChange: (state, detail) => events.push({ title: state.nodes[0]?.title, reason: detail.reason }) });
  const state = await enable(store); hold = true;
  const pending = store.commitProposal(node('Committed old scope'), expected(state)); await waitForCommit;
  const fresh = await store.setMode('session', expected(state)); release();
  await assert.rejects(pending, { code: 'STALE_STATE' });
  assert.equal((await store.load()).nodes.length, 0); assert.equal(fresh.nodes.length, 0);
  assert.equal(events.at(-1).reason, 'mode-switch'); assert.equal(events.some(event => event.title === 'Committed old scope'), false); store.close();
});

test('reentrant scope changes cannot publish a device snapshot after the new visit snapshot', async () => {
  let store, switching; const publications = [];
  ({ store } = fixture({ onChange(state, detail) { if (detail.reason === 'save') switching = store.setMode('session', expected(state)); } }));
  await enable(store); store.subscribe((state, detail) => publications.push({ reason: detail.reason, notes: state.nodes.length, mode: store.getStatus().mode }));
  const state = await store.load(); await assert.rejects(store.commitProposal(node('Old scope'), expected(state)), { code: 'STALE_STATE' }); await switching;
  assert.deepEqual(publications, [{ reason: 'mode-switch', notes: 0, mode: 'session' }]); store.close();
});

test('legacy durable v1 is read unchanged and never rewritten by visit work', async () => {
  const original = fixture(); await enable(original.store); await save(original.store, node('Legacy v1')); const legacy = structuredClone(original.persistence.state); original.store.close();
  const { store, persistence } = fixture({ persistence: original.persistence });
  assert.deepEqual(await store.load(), legacy); assert.deepEqual(persistence.state, legacy);
  await visit(store); const temporary = await save(store, node('Volatile v1')); await store.clear(expected(temporary.dataset));
  assert.deepEqual(persistence.state, legacy); store.close();
});

test('changing memory scope drops open visit editor drafts and record selections', async () => {
  await withMemoryView(async ({ store, container, view }) => {
    await visit(store); byText(container, 'Add a note').click();
    const title = container.querySelector('[data-focus-key="title"]'); title.value = 'Private unsaved visit draft'; title.listeners.input();
    const current = await store.load(); await store.setMode('device', expected(current));
    assert.equal(container.querySelector('[data-focus-key="title"]'), null); assert.deepEqual(view.getSelection(), []);
    byText(container, 'Add a note').click(); assert.equal(container.querySelector('[data-focus-key="title"]').value, '');
  });
});

test('a nested device choice retains its operation lock until its own transaction completes', async () => {
  const persistence = new TransactionalMemory(); let store, nested, shouldNest = false, release;
  ({ store } = fixture({ persistence, onChange(state, detail) {
    if (shouldNest && detail.reason === 'mode-switch' && store.getStatus().mode === 'session') { shouldNest = false; nested = store.setMode('device', expected(state)); }
  } }));
  const state = await enable(store); persistence.pause = new Promise(resolve => { release = resolve; }); shouldNest = true;
  await assert.rejects(store.setMode('session', expected(state)), { code: 'STALE_STATE' });
  assert.equal(store.getStatus().switching, true); assert.equal(store.getStatus().savingEnabled, false);
  await assert.rejects(store.load(), { code: 'MODE_SWITCH_PENDING' });
  release(); persistence.pause = null; const recalled = await nested;
  assert.equal(recalled.consent.storageEnabled, true); assert.equal(store.getStatus().switching, false); store.close();
});
