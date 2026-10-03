/** Confirmed memory with explicitly separate device and this-visit scopes. */
export const NODE_KINDS = Object.freeze(['goal', 'insight', 'project', 'possibility', 'question']);
export const NODE_STATUSES = Object.freeze(['active', 'paused', 'resolved', 'archived']);
export const EDGE_RELATIONS = Object.freeze(['relates_to', 'supports', 'challenges', 'depends_on']);
export const MEMORY_LIMITS = Object.freeze({ nodes: 128, edges: 256, selected: 6, contextCharacters: 2500, contextBytes: 10000 });
const DB_NAME = 'dream-unity-constellation-v1';
const STATE_KEY = 'constellation';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const receipts = new WeakMap();
const internals = new WeakMap();
const clone = value => structuredClone(value);

export class MemoryError extends Error {
  constructor(code, message) { super(message); this.name = 'MemoryError'; this.code = code; }
}
class StoredDataError extends MemoryError {
  constructor(validationCode) {
    super('STORED_DATA_INVALID', 'Saved device notes could not be read safely and have not been changed. Choose For this visit, or recover the device notes and reload.');
    this.name = 'StoredDataError'; this.validationCode = validationCode;
  }
}
function fail(code, message) { throw new MemoryError(code, message); }
function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_INPUT', `${name} must be a nonnegative safe integer.`);
}
function nextInteger(value) {
  integer(value, 'Revision');
  if (value === Number.MAX_SAFE_INTEGER) fail('REVISION_LIMIT', 'Memory revisions cannot advance further.');
  return value + 1;
}
function keys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', 'An object is required.');
  const allowed = new Set([...required, ...optional]);
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !allowed.has(key))) {
    fail('INVALID_INPUT', 'Memory fields do not match the supported operation.');
  }
}
function id(value) {
  if (typeof value !== 'string' || !UUID.test(value)) fail('INVALID_INPUT', 'A valid UUID is required.');
}
function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) fail('INVALID_INPUT', `${name} is not supported.`);
}
export function characterCount(value) { return [...value].length; }
function text(value, maximum, name, allowEmpty = false) {
  if (typeof value !== 'string') fail('INVALID_INPUT', `${name} must be text.`);
  if ((!allowEmpty && !value.trim()) || characterCount(value) > maximum || encoder.encode(value).length > maximum * 4) {
    fail('INVALID_INPUT', `${name} exceeds its text limit or is empty.`);
  }
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) fail('INVALID_INPUT', `${name} contains an invalid Unicode character.`);
  }
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) fail('INVALID_INPUT', 'A valid timestamp is required.');
}
function authorship(value) { enumValue(value, ['user', 'ai-confirmed'], 'Authorship'); }

export function validateProposal(proposal) {
  switch (proposal?.operation) {
    case 'create_node':
      keys(proposal, ['operation', 'kind', 'title', 'text']);
      enumValue(proposal.kind, NODE_KINDS, 'Kind'); text(proposal.title, 120, 'Title'); text(proposal.text, 1200, 'Note');
      break;
    case 'update_node':
      keys(proposal, ['operation', 'nodeId', 'expectedRevision', 'kind', 'title', 'text', 'status']);
      id(proposal.nodeId); integer(proposal.expectedRevision, 'Record revision');
      enumValue(proposal.kind, NODE_KINDS, 'Kind'); enumValue(proposal.status, NODE_STATUSES, 'Status');
      text(proposal.title, 120, 'Title'); text(proposal.text, 1200, 'Note');
      break;
    case 'create_edge':
      keys(proposal, ['operation', 'from', 'fromRevision', 'to', 'toRevision', 'relation', 'label']);
      id(proposal.from); id(proposal.to); integer(proposal.fromRevision, 'From revision'); integer(proposal.toRevision, 'To revision');
      if (proposal.from === proposal.to) fail('SELF_EDGE', 'A note cannot relate to itself.');
      enumValue(proposal.relation, EDGE_RELATIONS, 'Relation'); text(proposal.label, 240, 'Label', true);
      break;
    case 'update_edge':
      keys(proposal, ['operation', 'edgeId', 'expectedRevision', 'relation', 'label']);
      id(proposal.edgeId); integer(proposal.expectedRevision, 'Record revision');
      enumValue(proposal.relation, EDGE_RELATIONS, 'Relation'); text(proposal.label, 240, 'Label', true);
      break;
    default: fail('INVALID_INPUT', 'This memory operation is not supported.');
  }
  return clone(proposal);
}

function validateState(state, sessionOnly = false) {
  keys(state, ['schemaVersion', 'revision', 'consentEpoch', 'consent', 'nodes', 'edges']);
  if (state.schemaVersion !== 1) fail('UNSUPPORTED_SCHEMA', 'This memory version is not supported.');
  integer(state.revision, 'Dataset revision'); integer(state.consentEpoch, 'Consent epoch');
  keys(state.consent, ['policyVersion', 'storageEnabled', 'conversationUseEnabled', 'updatedAt']);
  if (state.consent.policyVersion !== 'constellation-1' || typeof state.consent.storageEnabled !== 'boolean' || typeof state.consent.conversationUseEnabled !== 'boolean') fail('INVALID_INPUT', 'Memory consent is invalid.');
  date(state.consent.updatedAt);
  if (sessionOnly && state.consent.storageEnabled) fail('INVALID_INPUT', 'Session notes cannot claim device storage consent.');
  if (!sessionOnly && state.consent.conversationUseEnabled && !state.consent.storageEnabled) fail('INVALID_INPUT', 'Sharing requires device storage consent.');
  if (!Array.isArray(state.nodes) || !Array.isArray(state.edges) || state.nodes.length > MEMORY_LIMITS.nodes || state.edges.length > MEMORY_LIMITS.edges) fail('MEMORY_LIMIT', 'The constellation exceeds its record limit.');
  if (!sessionOnly && !state.consent.storageEnabled && (state.nodes.length || state.edges.length)) fail('INVALID_INPUT', 'Notes cannot remain without storage consent.');
  const identifiers = new Set();
  for (const node of state.nodes) {
    keys(node, ['id', 'kind', 'title', 'text', 'status', 'authorship', 'createdAt', 'updatedAt', 'revision']);
    id(node.id); enumValue(node.kind, NODE_KINDS, 'Kind'); enumValue(node.status, NODE_STATUSES, 'Status');
    text(node.title, 120, 'Title'); text(node.text, 1200, 'Note'); authorship(node.authorship);
    date(node.createdAt); date(node.updatedAt); integer(node.revision, 'Record revision');
    if (identifiers.has(node.id) || node.revision > state.revision || Date.parse(node.updatedAt) < Date.parse(node.createdAt)) fail('INVALID_INPUT', 'The saved constellation has inconsistent records.');
    identifiers.add(node.id);
  }
  const nodeIds = new Set(identifiers), edgeKeys = new Set();
  for (const edge of state.edges) {
    keys(edge, ['id', 'from', 'to', 'relation', 'label', 'authorship', 'createdAt', 'updatedAt', 'revision']);
    id(edge.id); id(edge.from); id(edge.to); enumValue(edge.relation, EDGE_RELATIONS, 'Relation'); text(edge.label, 240, 'Label', true);
    authorship(edge.authorship); date(edge.createdAt); date(edge.updatedAt); integer(edge.revision, 'Record revision');
    const tuple = `${edge.from}|${edge.to}|${edge.relation}`;
    if (identifiers.has(edge.id) || !nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to || edgeKeys.has(tuple) || edge.revision > state.revision || Date.parse(edge.updatedAt) < Date.parse(edge.createdAt)) fail('INVALID_INPUT', 'The saved constellation has inconsistent relationships.');
    identifiers.add(edge.id); edgeKeys.add(tuple);
  }
  return state;
}

/** Persisted v1 validation stays strict; volatile state is validated separately. */
export function validateDataset(state) { return validateState(state); }
export function validateSessionDataset(state) { return validateState(state, true); }

function initialState(now) {
  return { schemaVersion: 1, revision: 0, consentEpoch: 0, consent: { policyVersion: 'constellation-1', storageEnabled: false, conversationUseEnabled: false, updatedAt: new Date(now()).toISOString() }, nodes: [], edges: [] };
}
function timestamp(state, now) {
  const latest = Math.max(Date.parse(state.consent.updatedAt), ...state.nodes.map(node => Date.parse(node.updatedAt)), ...state.edges.map(edge => Date.parse(edge.updatedAt)));
  return new Date(Math.max(now(), latest + 1)).toISOString();
}
function preconditions(state, expected) {
  if (!expected) fail('STALE_STATE', 'Reload the constellation before saving.');
  integer(expected.consentEpoch, 'Consent epoch'); integer(expected.revision, 'Dataset revision');
  if (state.consentEpoch !== expected.consentEpoch || state.revision !== expected.revision) fail('STALE_STATE', 'Memory changed. Review the current version before saving.');
}
function findRecord(records, identifier, revision) {
  const record = records.find(item => item.id === identifier);
  if (!record) fail('RECORD_NOT_FOUND', 'That saved record no longer exists.');
  if (record.revision !== revision) fail('STALE_RECORD', 'That saved record changed. Review it again.');
  return record;
}

/** One authoritative record is read, checked and written inside one IDB transaction. */
export function createIndexedDBPersistence({ indexedDB = globalThis.indexedDB, dbName = DB_NAME, timeoutMs = 8000 } = {}) {
  let opening, database, closed = false;
  const activeTransactions = new Set();
  const intentionalAborts = new WeakMap();
  function open() {
    if (closed) return Promise.reject(new MemoryError('STORE_CLOSED', 'Memory storage is closed.'));
    if (!indexedDB?.open) return Promise.reject(new MemoryError('STORAGE_UNAVAILABLE', 'Device storage is unavailable. Nothing was saved.'));
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let settled = false, request;
      const finish = (error, value) => {
        if (settled) { if (value) value.close(); return; }
        settled = true; clearTimeout(timer); error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => finish(new MemoryError('STORAGE_UNAVAILABLE', 'Device storage did not open. Nothing was saved.')), timeoutMs);
      try { request = indexedDB.open(dbName, 1); } catch { finish(new MemoryError('STORAGE_UNAVAILABLE', 'Device storage is unavailable. Nothing was saved.')); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records'); };
      request.onblocked = () => finish(new MemoryError('STORAGE_BLOCKED', 'Another tab is blocking device storage. Close it and retry.'));
      request.onerror = () => finish(new MemoryError('STORAGE_UNAVAILABLE', 'Device storage could not open. Nothing was saved.'));
      request.onsuccess = () => {
        const db = request.result;
        if (closed) { db.close(); finish(new MemoryError('STORE_CLOSED', 'Memory storage is closed.')); return; }
        if (settled) { db.close(); return; }
        database = db;
        db.onversionchange = () => { db.close(); database = null; opening = null; };
        finish(null, db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  return {
    async transact(transform, { signal } = {}) {
      if (signal?.aborted) fail('STALE_PROPOSAL', 'The confirmed suggestion was cancelled.');
      const db = await open();
      if (signal?.aborted) fail('STALE_PROPOSAL', 'The confirmed suggestion was cancelled.');
      return new Promise((resolve, reject) => {
        let transaction, result, error;
        try { transaction = db.transaction('records', 'readwrite'); } catch { reject(new MemoryError('STORAGE_UNAVAILABLE', 'Device storage is unavailable. Nothing was saved.')); return; }
        activeTransactions.add(transaction);
        const remove = () => { activeTransactions.delete(transaction); signal?.removeEventListener('abort', cancel); };
        const cancel = () => { intentionalAborts.set(transaction, 'STALE_PROPOSAL'); try { transaction.abort(); } catch { /* Already completed; it cannot be rewound. */ } };
        transaction.oncomplete = () => { remove(); resolve(result); };
        transaction.onabort = () => { remove(); reject(error || (intentionalAborts.has(transaction) ? new MemoryError(intentionalAborts.get(transaction), 'Memory was cancelled before commit. Nothing was saved.') : new MemoryError('STORAGE_ERROR', 'Device storage rejected the change. Nothing was saved.'))); };
        transaction.onerror = () => { /* onabort owns rejection; IDB rolls back the complete record. */ };
        signal?.addEventListener('abort', cancel, { once: true });
        const objectStore = transaction.objectStore('records');
        const request = objectStore.get(STATE_KEY);
        request.onsuccess = () => {
          try {
            const output = transform(request.result === undefined ? undefined : clone(request.result));
            if (!output || typeof output !== 'object' || output.then) fail('INVALID_TRANSACTION', 'Memory transactions must be synchronous.');
            result = clone(output.result);
            if (output.write) objectStore.put(clone(output.state), STATE_KEY);
          } catch (cause) { error = cause; transaction.abort(); }
        };
      });
    },
    abortPending() { for (const transaction of activeTransactions) { intentionalAborts.set(transaction, 'STALE_STATE'); try { transaction.abort(); } catch { /* It already completed; persisted preconditions still apply. */ } } },
    close() { closed = true; for (const transaction of activeTransactions) { intentionalAborts.set(transaction, 'STORE_CLOSED'); try { transaction.abort(); } catch { /* Already committed. */ } } database?.close(); }
  };
}

/** Serialized private graph, destroyed when this store closes. */
function createSessionPersistence(state) {
  let graph = clone(state), closed = false, generation = 0, queue = Promise.resolve();
  return {
    transact(transform, { signal } = {}) {
      const captured = generation;
      const task = queue.then(() => {
        if (closed) fail('STORE_CLOSED', 'This visit has ended.');
        if (captured !== generation) fail('STALE_STATE', 'The visit changed before saving.');
        if (signal?.aborted) fail('STALE_PROPOSAL', 'The confirmed suggestion was cancelled.');
        const output = transform(clone(graph));
        if (!output || typeof output !== 'object' || output.then) fail('INVALID_TRANSACTION', 'Memory transactions must be synchronous.');
        if (closed || captured !== generation || signal?.aborted) fail('STALE_STATE', 'The visit changed before saving.');
        if (output.write) graph = clone(output.state);
        return clone(output.result);
      });
      queue = task.catch(() => {}); return task;
    },
    abortPending() { generation++; },
    close() { closed = true; generation++; graph = undefined; }
  };
}

export function createMemoryStore({ onChange = () => {}, onRevoke = () => {}, indexedDB, BroadcastChannel = globalThis.BroadcastChannel, persistence, dbName = DB_NAME, now = Date.now, uuid = () => globalThis.crypto.randomUUID() } = {}) {
  const database = persistence || createIndexedDBPersistence({ indexedDB, dbName });
  const subscribers = new Set(), invalidators = new Set();
  let cached, closed = false, generation = 0, channel, sessionDatabase;
  let mode = 'device', deviceAvailable = true, deviceError = null, switching = false, switchOwner;
  let storedDataError = null;
  try { if (BroadcastChannel) channel = new BroadcastChannel(`${dbName}:revisions`); } catch { /* Transaction checks remain authoritative. */ }
  function getStatus() { return { mode, deviceAvailable, deviceError, switching, savingEnabled: !closed && !switching && (mode === 'session' || (mode === 'device' && deviceAvailable && Boolean(cached?.consent.storageEnabled))) }; }
  function announce(state) { try { channel?.postMessage({ schemaVersion: 1, revision: state.revision, consentEpoch: state.consentEpoch }); } catch { /* Device authority remains transactional. */ } }
  function notify(state, reason, external = false) {
    if (closed || (cached && state.revision < cached.revision)) return false;
    const previous = cached; cached = clone(state);
    if (previous && previous.revision === state.revision && previous.consentEpoch === state.consentEpoch) return true;
    const revoked = previous && state.consentEpoch !== previous.consentEpoch;
    if (revoked) generation++;
    const publication = cached, publicationGeneration = generation, publicationMode = mode;
    const current = () => !closed && !switching && cached === publication && generation === publicationGeneration && mode === publicationMode;
    if (revoked) { try { onRevoke({ consentEpoch: state.consentEpoch, revision: state.revision, reason }); } catch { /* Persistence is already authoritative. */ } }
    if (!current()) return false;
    const detail = { reason, external, initial: !previous, consentEpoch: state.consentEpoch, revision: state.revision };
    try { onChange(clone(state), detail); } catch { /* UI owns its error boundary. */ }
    if (!current()) return false;
    for (const listener of subscribers) {
      try { listener(clone(state), detail); } catch { /* Other subscribers still run. */ }
      if (!current()) return false;
    }
    return true;
  }
  function ensureOpen() { if (closed) fail('STORE_CLOSED', 'Memory storage is closed.'); }
  function ensureAvailable() { ensureOpen(); if (switching) fail('MODE_SWITCH_PENDING', 'Wait for the memory choice to finish.'); }
  function ensureDeviceReadable() { if (storedDataError) throw storedDataError; }
  function readDeviceDataset(raw) {
    ensureDeviceReadable();
    if (raw === undefined) return initialState(now);
    try { return validateDataset(raw); }
    catch (error) {
      // Only validation of an existing durable record can enable this fallback.
      // Caller input, generated state, transport errors and programmer faults
      // must retain their own failures instead of being called corrupt storage.
      if (!(error instanceof MemoryError) || !['INVALID_INPUT', 'UNSUPPORTED_SCHEMA', 'MEMORY_LIMIT'].includes(error.code)) throw error;
      storedDataError = new StoredDataError(error.code);
      deviceAvailable = false; deviceError = storedDataError.code;
      throw storedDataError;
    }
  }
  function invalidateWrites(reason) {
    generation++; database.abortPending?.(); sessionDatabase?.abortPending();
    for (const invalidate of invalidators) { try { invalidate(); } catch { /* Every controller still invalidates. */ } }
    if (reason) { try { onRevoke({ pending: true, reason, consentEpoch: cached?.consentEpoch ?? 0, revision: cached?.revision ?? 0 }); } catch { /* Requested operation still runs. */ } }
  }
  async function transaction(reason, transform, { announce: broadcast = false, capturedGeneration = generation, signal } = {}) {
    ensureAvailable(); const capturedMode = mode;
    if (capturedMode === 'unavailable') fail('STORAGE_UNAVAILABLE', 'Device storage is unavailable. Choose Only for this visit to save notes in memory.');
    if (capturedMode === 'device') ensureDeviceReadable();
    const backend = ['session', 'off'].includes(capturedMode) ? sessionDatabase : database;
    const validate = ['session', 'off'].includes(capturedMode) ? validateSessionDataset : validateDataset;
    const output = await backend.transact(raw => {
      ensureOpen();
      if (capturedGeneration !== generation || capturedMode !== mode || switching) fail('STALE_STATE', 'Memory consent changed before this operation completed.');
      const state = capturedMode === 'device' ? readDeviceDataset(raw) : raw === undefined ? initialState(now) : validate(raw), result = transform(state);
      validate(result.state);
      return { state: result.state, write: Boolean(result.changed), result: { dataset: result.state, ...(result.result || {}), changed: Boolean(result.changed) } };
    }, { signal });
    ensureOpen();
    // Completion from an old backend must never replace the graph in the new scope.
    if (capturedGeneration !== generation || capturedMode !== mode || switching) fail('STALE_STATE', 'Memory changed while this operation completed.');
    if (!notify(output.dataset, reason, reason === 'external-change')) fail('STALE_STATE', 'Memory changed while this operation was published.');
    if (broadcast && output.changed && capturedMode === 'device') announce(output.dataset);
    if (cached && (cached.revision > output.dataset.revision || cached.consentEpoch > output.dataset.consentEpoch)) fail('STALE_STATE', 'Memory changed while this operation completed.');
    return clone(output);
  }
  async function load(attempt = 0) {
    const capturedMode = mode;
    ensureAvailable(); if (mode === 'unavailable') return clone(cached);
    try { return (await transaction('load', state => ({ state, changed: false }))).dataset; }
    catch (error) {
      // Read-only retries can recover a concurrent authoritative revocation, never a scope switch.
      if (attempt < 2 && error.code === 'STALE_STATE' && mode === capturedMode && !switching && !closed) return load(attempt + 1);
      // Empty availability fallback never enables saving or reports a failed save as successful.
      if (!cached && !closed && mode === 'device' && !switching &&
          (error instanceof StoredDataError || ['STORAGE_UNAVAILABLE', 'STORAGE_BLOCKED', 'STORAGE_ERROR'].includes(error.code))) {
        deviceAvailable = false; deviceError = error.code; mode = 'unavailable'; notify(initialState(now), 'storage-unavailable'); return clone(cached);
      }
      throw error;
    }
  }
  if (channel) channel.onmessage = event => {
    const message = event.data;
    try {
      keys(message, ['schemaVersion', 'revision', 'consentEpoch']); integer(message.revision, 'Revision'); integer(message.consentEpoch, 'Consent epoch');
      if (message.schemaVersion !== 1 || closed || switching || mode !== 'device' || (cached && message.revision <= cached.revision && message.consentEpoch <= cached.consentEpoch)) return;
      // No payload is imported. Session scope ignores device hints and rereads on device return.
      transaction('external-change', state => ({ state, changed: false })).catch(() => {});
    } catch { /* Untrusted hints cannot mutate consent or records. */ }
  };
  function newId(state) {
    const identifier = uuid(); id(identifier);
    if ([...state.nodes, ...state.edges].some(item => item.id === identifier)) fail('DUPLICATE_ID', 'A new record ID collided. Nothing was saved.');
    return identifier;
  }
  function applyProposal(state, proposal, owner) {
    if (mode !== 'session' && !state.consent.storageEnabled) fail('STORAGE_DISABLED', 'Choose Only for this visit or Remember on this device before saving.');
    const updatedAt = timestamp(state, now);
    let record, before = null;
    if (proposal.operation === 'create_node') {
      if (state.nodes.length >= MEMORY_LIMITS.nodes) fail('MEMORY_LIMIT', 'This constellation has reached 128 saved notes. Delete a note before adding another.');
      record = { id: newId(state), kind: proposal.kind, title: proposal.title, text: proposal.text, status: 'active', authorship: owner, createdAt: updatedAt, updatedAt, revision: 1 };
      state.nodes.push(record);
    } else if (proposal.operation === 'update_node') {
      record = findRecord(state.nodes, proposal.nodeId, proposal.expectedRevision); before = clone(record);
      Object.assign(record, { kind: proposal.kind, title: proposal.title, text: proposal.text, status: proposal.status, authorship: owner, updatedAt, revision: nextInteger(record.revision) });
    } else if (proposal.operation === 'create_edge') {
      findRecord(state.nodes, proposal.from, proposal.fromRevision); findRecord(state.nodes, proposal.to, proposal.toRevision);
      const duplicate = state.edges.find(edge => edge.from === proposal.from && edge.to === proposal.to && edge.relation === proposal.relation);
      if (duplicate) return { state, changed: false, result: { record: duplicate, before: duplicate, duplicate: true } };
      if (state.edges.length >= MEMORY_LIMITS.edges) fail('MEMORY_LIMIT', 'This constellation has reached 256 relationships. Delete one before adding another.');
      record = { id: newId(state), from: proposal.from, to: proposal.to, relation: proposal.relation, label: proposal.label, authorship: owner, createdAt: updatedAt, updatedAt, revision: 1 };
      state.edges.push(record);
    } else {
      record = findRecord(state.edges, proposal.edgeId, proposal.expectedRevision); before = clone(record);
      const duplicate = state.edges.find(edge => edge.id !== record.id && edge.from === record.from && edge.to === record.to && edge.relation === proposal.relation);
      if (duplicate) fail('DUPLICATE_EDGE', 'That directed relationship already exists. Review it instead.');
      Object.assign(record, { relation: proposal.relation, label: proposal.label, authorship: owner, updatedAt, revision: nextInteger(record.revision) });
    }
    state.revision = nextInteger(state.revision);
    return { state, changed: true, result: { record, before, duplicate: false } };
  }
  const api = {
    load,
    getStatus,
    async setMode(nextMode, expected) {
      enumValue(nextMode, ['session', 'device', 'off'], 'Memory mode'); ensureAvailable();
      if (nextMode === 'device') ensureDeviceReadable();
      if (!cached) fail('STALE_STATE', 'Load the constellation before choosing how to save.');
      preconditions(cached, expected); if (nextMode === mode && (nextMode !== 'device' || cached.consent.storageEnabled)) return load();
      const owner = {}; switchOwner = owner; switching = true; invalidateWrites('mode-switch');
      const capturedGeneration = generation, current = clone(cached);
      try {
        let next;
        if (nextMode === 'session' || (nextMode === 'off' && mode !== 'device')) {
          next = initialState(now); next.revision = nextInteger(current.revision); next.consentEpoch = nextInteger(current.consentEpoch); next.consent.updatedAt = timestamp(current, now); validateSessionDataset(next);
        } else {
          next = await database.transact(raw => {
            ensureOpen(); if (capturedGeneration !== generation) fail('STALE_STATE', 'The memory choice was cancelled.');
            const state = readDeviceDataset(raw);
            state.revision = nextInteger(Math.max(current.revision, state.revision)); state.consentEpoch = nextInteger(Math.max(current.consentEpoch, state.consentEpoch));
            const updatedAt = timestamp(state, now);
            if (nextMode === 'off') { state.nodes = []; state.edges = []; }
            state.consent = { policyVersion: 'constellation-1', storageEnabled: nextMode === 'device', conversationUseEnabled: false, updatedAt }; validateDataset(state);
            return { state, write: true, result: state };
          });
          ensureOpen(); if (capturedGeneration !== generation) fail('STALE_STATE', 'The memory choice was cancelled.');
        }
        sessionDatabase?.close(); sessionDatabase = nextMode !== 'device' ? createSessionPersistence(next) : undefined;
        mode = nextMode; if (nextMode === 'device') { deviceAvailable = true; deviceError = null; }
        switching = false; if (!notify(next, 'mode-switch')) fail('STALE_STATE', 'The memory choice changed before publication completed.'); if (nextMode === 'device' || (nextMode === 'off' && current.consent.storageEnabled)) announce(next); return clone(next);
      } catch (error) {
        if (['STORAGE_UNAVAILABLE', 'STORAGE_BLOCKED', 'STORAGE_ERROR'].includes(error.code)) { deviceAvailable = false; deviceError = error.code; } throw error;
      } finally { if (switchOwner === owner) { switching = false; switchOwner = undefined; } }
    },
    async setConsent(consent, expected) {
      keys(consent, ['storageEnabled', 'conversationUseEnabled']);
      ensureAvailable();
      if (typeof consent.storageEnabled !== 'boolean' || typeof consent.conversationUseEnabled !== 'boolean' || (mode !== 'session' && consent.conversationUseEnabled && !consent.storageEnabled)) fail('INVALID_INPUT', 'Choose a saving mode before enabling conversation sharing.');
      if (mode === 'session' && consent.storageEnabled) fail('MODE_CONFIRMATION_REQUIRED', 'Choose Remember on this device explicitly. Session notes are not transferred.');
      if (consent.storageEnabled && ['off', 'unavailable'].includes(mode)) {
        const next = await api.setMode('device', expected);
        return consent.conversationUseEnabled ? api.setConsent(consent, { consentEpoch: next.consentEpoch, revision: next.revision }) : next;
      }
      const destructive = !consent.storageEnabled || !consent.conversationUseEnabled;
      if (destructive) invalidateWrites('consent');
      const result = await transaction('consent', state => {
        preconditions(state, expected);
        if (state.consent.storageEnabled === consent.storageEnabled && state.consent.conversationUseEnabled === consent.conversationUseEnabled) return { state, changed: false };
        state.consentEpoch = nextInteger(state.consentEpoch); state.revision = nextInteger(state.revision);
        state.consent = { policyVersion: 'constellation-1', ...consent, updatedAt: timestamp(state, now) };
        if (mode !== 'session' && !consent.storageEnabled) { state.nodes = []; state.edges = []; }
        return { state, changed: true };
      }, { announce: true });
      return result.dataset;
    },
    async commitProposal(candidate, options) {
      const proposal = validateProposal(candidate), owner = options?.authorship || 'user';
      authorship(owner);
      const receipt = owner === 'ai-confirmed' ? receipts.get(options?.confirmation) : null;
      if (owner === 'ai-confirmed' && (!receipt || receipt.store !== api || receipt.used || receipt.proposal !== JSON.stringify(proposal) || receipt.consentEpoch !== options.consentEpoch || receipt.revision !== options.revision)) fail('CONFIRMATION_REQUIRED', 'Review and confirm the exact AI suggestion before saving.');
      if (receipt) receipt.used = true;
      return transaction('save', state => {
        preconditions(state, options);
        if (receipt) {
          if (!receipt.current()) fail('STALE_PROPOSAL', 'That suggestion is no longer current.');
          checkSharedTargets(state, proposal, receipt.sharedIds);
        }
        return applyProposal(state, proposal, owner);
      }, { announce: true, signal: owner === 'user' ? options?.signal : receipt?.signal });
    },
    async deleteNode(identifier, expected) {
      id(identifier); integer(expected?.expectedRevision, 'Record revision'); invalidateWrites('delete-node');
      return (await transaction('delete-node', state => {
        preconditions(state, expected); findRecord(state.nodes, identifier, expected.expectedRevision);
        state.consent.updatedAt = timestamp(state, now);
        state.nodes = state.nodes.filter(node => node.id !== identifier);
        state.edges = state.edges.filter(edge => edge.from !== identifier && edge.to !== identifier);
        state.consentEpoch = nextInteger(state.consentEpoch); state.revision = nextInteger(state.revision);
        return { state, changed: true };
      }, { announce: true })).dataset;
    },
    async deleteEdge(identifier, expected) {
      id(identifier); integer(expected?.expectedRevision, 'Record revision'); invalidateWrites('delete-edge');
      return (await transaction('delete-edge', state => {
        preconditions(state, expected); findRecord(state.edges, identifier, expected.expectedRevision);
        state.consent.updatedAt = timestamp(state, now);
        state.edges = state.edges.filter(edge => edge.id !== identifier);
        state.consentEpoch = nextInteger(state.consentEpoch); state.revision = nextInteger(state.revision);
        return { state, changed: true };
      }, { announce: true })).dataset;
    },
    async clear(expected) {
      invalidateWrites('clear');
      return (await transaction('clear', state => {
        preconditions(state, expected);
        const updatedAt = timestamp(state, now);
        state.nodes = []; state.edges = [];
        state.consent = { policyVersion: 'constellation-1', storageEnabled: false, conversationUseEnabled: false, updatedAt };
        state.consentEpoch = nextInteger(state.consentEpoch); state.revision = nextInteger(state.revision);
        return { state, changed: true };
      }, { announce: true })).dataset;
    },
    async clearDevice() {
      ensureAvailable(); ensureDeviceReadable(); invalidateWrites('clear-device');
      const capturedGeneration = generation, capturedMode = mode;
      const output = await database.transact(raw => {
        ensureOpen(); if (capturedGeneration !== generation || capturedMode !== mode || switching) fail('STALE_STATE', 'Memory changed before deleting device notes.');
        const state = readDeviceDataset(raw), updatedAt = timestamp(state, now);
        state.nodes = []; state.edges = []; state.consent = { policyVersion: 'constellation-1', storageEnabled: false, conversationUseEnabled: false, updatedAt };
        state.consentEpoch = nextInteger(Math.max(state.consentEpoch, cached?.consentEpoch ?? 0)); state.revision = nextInteger(Math.max(state.revision, cached?.revision ?? 0)); validateDataset(state);
        return { state, write: true, result: state };
      });
      ensureOpen(); if (capturedGeneration !== generation || capturedMode !== mode || switching) fail('STALE_STATE', 'Memory changed while deleting device notes.');
      if (mode === 'device' && !notify(output, 'clear-device')) fail('STALE_STATE', 'Memory changed while deletion was published.'); announce(output); return clone(output);
    },
    async selectContext(identifiers) {
      if (!Array.isArray(identifiers) || identifiers.length > MEMORY_LIMITS.selected || new Set(identifiers).size !== identifiers.length) fail('CONTEXT_LIMIT', 'Select at most six distinct notes or relationships.');
      identifiers.forEach(id);
      const capturedGeneration = generation, capturedMode = mode;
      const state = await load();
      if (capturedGeneration !== generation || capturedMode !== mode || switching) fail('STALE_STATE', 'Memory changed while selected context was prepared.');
      if (!state.consent.conversationUseEnabled) {
        if (identifiers.length) fail('SHARING_DISABLED', 'Choose permission to use selected notes in conversation first.');
        return { consentEpoch: state.consentEpoch, revision: state.revision, records: [] };
      }
      const records = identifiers.map(identifier => {
        const node = state.nodes.find(item => item.id === identifier);
        if (node) { const { id, revision, kind, title, text, status } = node; return { recordType: 'node', id, revision, kind, title, text, status }; }
        const edge = state.edges.find(item => item.id === identifier);
        if (!edge) fail('RECORD_NOT_FOUND', 'One selected record no longer exists.');
        const { id, revision, from, to, relation, label } = edge; return { recordType: 'edge', id, revision, from, to, relation, label };
      });
      const fields = records.flatMap(record => record.recordType === 'node' ? [record.title, record.text] : [record.label]);
      if (fields.reduce((count, field) => count + characterCount(field), 0) > MEMORY_LIMITS.contextCharacters || fields.reduce((count, field) => count + encoder.encode(field).length, 0) > MEMORY_LIMITS.contextBytes) fail('CONTEXT_LIMIT', 'Selected note text exceeds 2,500 characters. Select fewer or shorter records.');
      return { consentEpoch: state.consentEpoch, revision: state.revision, records };
    },
    subscribe(listener) { ensureOpen(); subscribers.add(listener); return () => subscribers.delete(listener); },
    close() { closed = true; invalidateWrites(); sessionDatabase?.close(); sessionDatabase = undefined; cached = undefined; subscribers.clear(); invalidators.clear(); channel?.close(); database.close?.(); }
  };
  internals.set(api, { uuid, subscribeInvalidation: listener => { invalidators.add(listener); return () => invalidators.delete(listener); }, issueReceipt: details => { const token = Object.freeze({}); receipts.set(token, { ...details, store: api, used: false }); return token; } });
  return Object.freeze(api);
}

function checkSharedTargets(state, proposal, identifiers) {
  const shared = new Set(identifiers);
  const targets = proposal.operation === 'update_node' ? [proposal.nodeId] : proposal.operation === 'update_edge' ? [proposal.edgeId] : proposal.operation === 'create_edge' ? [proposal.from, proposal.to] : [];
  if (targets.length && !state.consent.conversationUseEnabled) fail('SHARING_DISABLED', 'Saved records are not available to this conversation.');
  if (targets.some(identifier => !shared.has(identifier))) fail('UNSHARED_TARGET', 'AI suggestions can only change records explicitly shared in this conversation.');
}

/** Volatile exact proposals. Only the trusted local review controller can issue a commit receipt. */
export function createMemoryController({ store, onPendingChange = () => {} }) {
  if (!internals.has(store)) fail('INVALID_INPUT', 'A memory store is required.');
  let pending = null, generation = 0;
  const confirmations = new Set();
  function emit() { onPendingChange(pending ? clone(pending) : null); }
  function invalidatePending() { generation++; pending = null; for (const abort of confirmations) abort.abort(); emit(); }
  const unsubscribeInvalidation = internals.get(store).subscribeInvalidation(invalidatePending);
  const unsubscribe = store.subscribe((state, detail) => { if (detail.initial) return; invalidatePending(); });
  return {
    async propose(candidate, { turnId, sharedIds = [], consentEpoch, revision, signal } = {}) {
      if (signal?.aborted) fail('STALE_PROPOSAL', 'That conversation action was cancelled.');
      id(turnId); const proposal = validateProposal(candidate);
      if (!Array.isArray(sharedIds) || sharedIds.length > MEMORY_LIMITS.selected || new Set(sharedIds).size !== sharedIds.length) fail('INVALID_INPUT', 'Shared records are invalid.');
      sharedIds.forEach(id);
      const start = generation, state = await store.load();
      if (start !== generation || signal?.aborted) fail('STALE_PROPOSAL', 'The conversation changed while the suggestion was prepared.');
      preconditions(state, { consentEpoch, revision });
      if (!store.getStatus().savingEnabled) fail('STORAGE_DISABLED', 'Choose Only for this visit or Remember on this device before saving.');
      checkSharedTargets(state, proposal, sharedIds);
      let before = null, duplicate = false;
      if (proposal.operation === 'update_node') before = clone(findRecord(state.nodes, proposal.nodeId, proposal.expectedRevision));
      if (proposal.operation === 'update_edge') before = clone(findRecord(state.edges, proposal.edgeId, proposal.expectedRevision));
      if (proposal.operation === 'create_edge') {
        findRecord(state.nodes, proposal.from, proposal.fromRevision); findRecord(state.nodes, proposal.to, proposal.toRevision);
        const existing = state.edges.find(edge => edge.from === proposal.from && edge.to === proposal.to && edge.relation === proposal.relation);
        if (existing) { before = clone(existing); duplicate = true; }
      }
      pending = { proposalId: internals.get(store).uuid(), turnId, consentEpoch, revision, proposal, sharedIds: [...sharedIds], before, after: clone(proposal), duplicate };
      id(pending.proposalId); emit(); return clone(pending);
    },
    getPending() { return pending ? clone(pending) : null; },
    async confirm(proposalId, { turnId } = {}) {
      if (!pending || pending.proposalId !== proposalId || pending.turnId !== turnId) fail('STALE_PROPOSAL', 'Review the current suggestion before confirming.');
      const exact = pending, expectedGeneration = generation;
      const abort = new AbortController(); confirmations.add(abort);
      const confirmation = internals.get(store).issueReceipt({ proposal: JSON.stringify(exact.proposal), consentEpoch: exact.consentEpoch, revision: exact.revision, sharedIds: exact.sharedIds, signal: abort.signal, current: () => generation === expectedGeneration && pending === exact && !abort.signal.aborted });
      try {
        const result = await store.commitProposal(exact.proposal, { consentEpoch: exact.consentEpoch, revision: exact.revision, authorship: 'ai-confirmed', confirmation });
        if (pending === exact) { pending = null; emit(); }
        return result;
      } catch (error) {
        // A storage failure leaves the exact candidate visible, honestly unsaved. Stale candidates are removed.
        if (['STALE_STATE', 'STALE_RECORD', 'RECORD_NOT_FOUND', 'STALE_PROPOSAL', 'STORAGE_DISABLED', 'SHARING_DISABLED'].includes(error.code) && pending === exact) { pending = null; emit(); }
        throw error;
      } finally { confirmations.delete(abort); }
    },
    reject(proposalId) { if (pending?.proposalId === proposalId) invalidatePending(); },
    invalidate: invalidatePending,
    close() { invalidatePending(); unsubscribe(); unsubscribeInvalidation(); }
  };
}
