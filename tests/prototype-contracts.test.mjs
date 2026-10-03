import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemas, toolDefinitions } from '../prototype/wire-contracts.js';
import { validate, assertValid, validateTool, validateContract } from '../prototype/validate.js';

const id = '6d61a490-3419-49ba-8f59-8a8299dd8117';
const other = '72d5d306-fbcf-438c-8333-872a5031f025';
const request = (tool) => ({
  version: 1, sessionId: id, turnId: id, requestId: id,
  routeEpoch: 0, consentEpoch: 0, memoryRevision: 0, tool,
});
const bridge = (kind, payload) => ({
  channel: 'dream-unity:earth', version: 1, bridgeId: id,
  epoch: 0, requestId: id, kind, payload,
});
const proposal = (value) => validateTool('propose_memory', { proposal: value });

test('only registered public destination/tool forms enter the controller', () => {
  const allowed = request({ name: 'navigate', args: { destination: 'earth' } });
  assert.equal(assertValid(schemas.actionRequest, allowed), allowed);
  assert.equal(validateContract('action-request', allowed), allowed);
  assert.equal(validate(schemas.actionRequest, request({ name: 'navigate', args: { destination: 'dream-machine' } })).valid, false);
  assert.equal(validateTool('navigate', { destination: 'earth', url: 'https://example.com/' }).valid, false);
  assert.equal(validateTool('execute_script', { code: 'anything' }).valid, false);
});

test('bridge excludes personal transcript/capture fields and unsupported messages', () => {
  assert.equal(validate(schemas.earthBridge, bridge('INIT', {})).valid, true);
  assert.equal(validate(schemas.earthBridge, bridge('INIT', { transcript: 'private' })).valid, false);
  assert.equal(validate(schemas.earthBridge, bridge('MEDIA_FOCUS_GRANTED', { captureStopped: true, outputStopped: true })).valid, true);
  assert.equal(validate(schemas.earthBridge, bridge('MEDIA_FOCUS_GRANTED', { captureStopped: false, outputStopped: true })).valid, false);
  assert.equal(validate(schemas.earthBridge, bridge('RAW_AUDIO', {})).valid, false);
  assert.equal(validate(schemas.earthBridge, { ...bridge('INIT', {}), bridgeId: 'not-a-uuid' }).valid, false);
});

test('trusted bridge cancellation is a bounded control message, never a model tool', () => {
  assert.equal(validate(schemas.earthBridge, bridge('CANCEL', { commandRequestId: other })).valid, true);
  assert.equal(validate(schemas.earthBridge, bridge('CANCEL', { commandRequestId: null })).valid, true);
  assert.equal(validate(schemas.earthBridge, bridge('ACK', { forKind: 'CANCEL', active: true })).valid, true);
  for (const payload of [{}, { commandRequestId: 'not-a-uuid' }, { commandRequestId: other, transcript: 'private' }]) {
    assert.equal(validate(schemas.earthBridge, bridge('CANCEL', payload)).valid, false);
  }
  assert.equal(validateTool('CANCEL', { commandRequestId: other }).valid, false);
});

test('all tagged memory operations are proposals with exact revision preconditions', () => {
  assert.equal(proposal({ operation: 'create_node', kind: 'goal', title: 'Study', text: 'Practise daily.' }).valid, true);
  const update = { operation: 'update_node', nodeId: id, expectedRevision: 2, kind: 'goal', title: 'Study', text: 'Practise twice weekly.', status: 'active' };
  assert.equal(proposal(update).valid, true);
  const { expectedRevision, ...missingRevision } = update;
  assert.equal(proposal(missingRevision).valid, false);
  assert.equal(proposal({ operation: 'create_edge', from: id, fromRevision: 1, to: other, toRevision: 2, relation: 'supports', label: 'Supports study' }).valid, true);
  assert.equal(proposal({ operation: 'update_edge', edgeId: id, expectedRevision: 2, relation: 'challenges', label: '' }).valid, true);
  assert.equal(proposal({ ...update, confirmed: true }).valid, false);
  assert.equal(proposal({ operation: 'delete_node', nodeId: id }).valid, false);
  assert.equal(proposal({ operation: 'unlock_activity' }).valid, false);
});

test('unicode limits count code points rather than UTF-16 code units', () => {
  assert.equal(validateTool('propose_memory', { proposal: { operation: 'create_node', kind: 'insight', title: '🌍'.repeat(120), text: 'Present.' } }).valid, true);
  assert.equal(validateTool('propose_memory', { proposal: { operation: 'create_node', kind: 'insight', title: '🌍'.repeat(121), text: 'Present.' } }).valid, false);
  assert.equal(validate({ type: 'string', minLength: 2 }, '🌍').valid, false);
});

test('finite numbers, safe integers and geographic bounds are enforced', () => {
  const coordinates = { latitude: -37.8, longitude: 144.9, rangeM: 5000 };
  assert.equal(validateTool('earth_fly_to_coordinates', coordinates).valid, true);
  for (const latitude of [NaN, Infinity, -Infinity, 91]) {
    assert.equal(validateTool('earth_fly_to_coordinates', { ...coordinates, latitude }).valid, false);
  }
  assert.equal(validate(schemas.actionRequest, { ...request({ name: 'earth_zoom_to_globe', args: {} }), routeEpoch: Number.MAX_SAFE_INTEGER + 1 }).valid, false);
  assert.equal(validate(schemas.actionRequest, { ...request({ name: 'earth_zoom_to_globe', args: {} }), routeEpoch: 1.5 }).valid, false);
});

test('object, array, union, constant and uniqueness checks match JSON boundaries', () => {
  assert.equal(validate({ oneOf: [{ type: 'string' }, { enum: ['x'] }] }, 'x').valid, false);
  assert.equal(validate({ anyOf: [{ const: 'a' }, { const: 'b' }] }, 'b').valid, true);
  assert.equal(validate({ type: 'array', minItems: 1, maxItems: 2, items: { type: 'boolean' }, uniqueItems: true }, [true, false]).valid, true);
  assert.equal(validate({ type: 'array', uniqueItems: true }, [{ a: 1, b: 2 }, { b: 2, a: 1 }]).valid, false);
  assert.equal(validate({ type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: false }, {}).valid, false);
  assert.equal(validateTool('set_scene_reflection', { worlds: ['machine', 'machine'], summary: 'Maybe.', provisional: true }).valid, false);
});

test('UUID/date-time formats reject malformed identifiers and impossible dates', () => {
  const time = { type: 'string', format: 'date-time' };
  assert.equal(validate(time, '2024-02-29T23:59:59.123+10:00').valid, true);
  for (const value of ['2023-02-29T00:00:00Z', '2026-02-30T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01', '2026-01-01T00:00:00+24:00']) {
    assert.equal(validate(time, value).valid, false);
  }
  assert.equal(validate({ type: 'string', format: 'uuid' }, id).valid, true);
  assert.equal(validate({ type: 'string', format: 'uuid' }, 'x'.repeat(36)).valid, false);
  assert.equal(validate(schemas.access, { version: 1, inviteCode: 'a'.repeat(22) }).valid, true);
  assert.equal(validate(schemas.access, { version: 1, inviteCode: 'https://example.com/code' }).valid, false);
});

test('non-JSON input and accessor tricks fail without evaluating getters', () => {
  let accessed = false;
  const accessor = Object.defineProperty({}, 'destination', { enumerable: true, get() { accessed = true; return 'earth'; } });
  assert.equal(validateTool('navigate', accessor).valid, false);
  assert.equal(accessed, false);
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(validate({}, cyclic).valid, false);
  assert.equal(validate({}, { value: undefined }).valid, false);
  assert.equal(validate({}, new Date()).valid, false);
  assert.equal(validate({}, new Array(2)).valid, false);
  assert.equal(validate({}, Object.create({ destination: 'earth' })).valid, false);
  assert.equal(validate({}, JSON.parse('{"__proto__":{"polluted":true}}')).valid, true);
  assert.equal({}.polluted, undefined);
});

test('bounded invalid-input errors are usable by frontend and backend', () => {
  assert.throws(() => assertValid(schemas.toolCall, { name: 'unknown', args: {} }), (failure) => {
    assert.equal(failure.code, 'INVALID_INPUT');
    assert.equal(failure.statusCode, 400);
    assert.ok(Array.isArray(failure.errors));
    assert.ok(failure.errors[0].path);
    return true;
  });
  assert.throws(() => validateContract('unknown-contract', {}), { code: 'INVALID_INPUT' });
  const oversizedField = validate({ type: 'object', additionalProperties: false }, { ['x'.repeat(4096)]: true });
  assert.equal(oversizedField.valid, false);
  assert.ok(oversizedField.errors[0].path.length <= 243);
});

test('generated contracts match the reviewed public JSON and exports remain immutable', async () => {
  const names = {
    actionRequest: 'action-request', actionResult: 'action-result', earthBridge: 'earth-bridge',
    constellation: 'constellation', realtimeStart: 'realtime-start', access: 'access',
    knowledgeRequest: 'knowledge-request', sessionClose: 'session-close', textTurn: 'text-turn', toolCall: 'tool-call',
  };
  for (const [key, filename] of Object.entries(names)) {
    const source = new URL(`../prototype/contracts/${filename}.schema.json`, import.meta.url);
    assert.deepEqual(schemas[key], JSON.parse(await readFile(source, 'utf8')));
  }
  const definitions = new URL('../prototype/contracts/tool-definitions.json', import.meta.url);
  assert.deepEqual(toolDefinitions, JSON.parse(await readFile(definitions, 'utf8')));
  assert.equal(Object.keys(schemas).length, 10);
  assert.ok(Object.isFrozen(schemas.actionRequest));
  assert.ok(Object.isFrozen(toolDefinitions.tools));
});
