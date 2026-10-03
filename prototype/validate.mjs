import { schemas, toolDefinitions } from './contracts.mjs';

// This validator covers the JSON Schema subset used by the pinned public contracts.
// It cannot establish trusted origins, cryptographic IDs, actual user confirmation,
// current consent/epochs, aggregate byte quotas, or observed application effects.
const MAX_ERRORS = 32;
const MAX_DEPTH = 64;
const MAX_VALUES = 20000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const escapePointer = (key) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const childPath = (path, key) => `${path}/${escapePointer(key)}`;
const isPlainObject = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function error(errors, path, keyword, message) {
  const boundedPath = path.length > 240 ? `${path.slice(0, 240)}...` : path;
  if (errors.length < MAX_ERRORS) errors.push({ path: boundedPath, keyword, message });
}

function isDateTime(value) {
  const match = DATE_TIME.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHour, offsetMinute] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] && Number(hourText) <= 23 && Number(minuteText) <= 59
    && Number(secondText) <= 59 && (!offsetHour || Number(offsetHour) <= 23)
    && (!offsetMinute || Number(offsetMinute) <= 59);
}

function equal(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length
      && keys.every((key) => own(right, key) && equal(left[key], right[key]));
  }
  return false;
}

// JSON boundaries must not admit Infinity, functions, cyclic values, inherited
// properties, or objects with getters merely because one branch omits a type.
function checkJson(value, errors) {
  const active = new Set();
  let count = 0;
  function visit(item, path, depth) {
    count += 1;
    if (depth > MAX_DEPTH || count > MAX_VALUES) {
      error(errors, path, 'json', 'Input exceeds the supported JSON nesting or value bound.');
      return;
    }
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) error(errors, path, 'json', 'Number must be finite.');
      return;
    }
    if (!Array.isArray(item) && !isPlainObject(item)) {
      error(errors, path, 'json', 'Value must be plain JSON data.');
      return;
    }
    if (active.has(item)) {
      error(errors, path, 'json', 'Cyclic input is not JSON data.');
      return;
    }
    active.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (Object.getOwnPropertySymbols(item).length) error(errors, path, 'json', 'Symbol properties are not JSON data.');
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length && errors.length < MAX_ERRORS && count <= MAX_VALUES; index += 1) {
        const descriptor = descriptors[index];
        if (!descriptor || !own(descriptor, 'value')) {
          error(errors, childPath(path, index), 'json', 'Sparse arrays and accessors are not JSON data.');
        } else visit(descriptor.value, childPath(path, index), depth + 1);
      }
      if (Object.keys(descriptors).some((key) => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))) {
        error(errors, path, 'json', 'Array properties are not JSON data.');
      }
    } else {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (errors.length >= MAX_ERRORS || count > MAX_VALUES) break;
        if (!own(descriptor, 'value') || !descriptor.enumerable) {
          error(errors, childPath(path, key), 'json', 'Accessors and hidden properties are not JSON data.');
        } else visit(descriptor.value, childPath(path, key), depth + 1);
      }
    }
    active.delete(item);
  }
  visit(value, '$', 0);
}

function matchesType(type, value) {
  switch (type) {
    case 'null': return value === null;
    case 'boolean': return typeof value === 'boolean';
    case 'string': return typeof value === 'string';
    case 'object': return isPlainObject(value);
    case 'array': return Array.isArray(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return Number.isSafeInteger(value);
    default: return false;
  }
}

function walk(schema, value, path, errors) {
  if (errors.length >= MAX_ERRORS || schema === true) return;
  if (schema === false || !isPlainObject(schema)) {
    error(errors, path, 'schema', 'Schema does not allow this value.');
    return;
  }
  if (schema.type && !matchesType(schema.type, value)) {
    error(errors, path, 'type', `Must be ${schema.type}${schema.type === 'integer' ? ' within the safe integer range' : ''}.`);
    return;
  }
  if (own(schema, 'const') && !equal(schema.const, value)) error(errors, path, 'const', 'Value does not match the required constant.');
  if (schema.enum && !schema.enum.some((candidate) => equal(candidate, value))) error(errors, path, 'enum', 'Value is not allowed.');
  for (const keyword of ['oneOf', 'anyOf']) {
    if (!schema[keyword]) continue;
    let matches = 0;
    for (const branch of schema[keyword]) {
      const branchErrors = [];
      walk(branch, value, path, branchErrors);
      if (branchErrors.length === 0) matches += 1;
    }
    if (keyword === 'oneOf' ? matches !== 1 : matches === 0) {
      error(errors, path, keyword, keyword === 'oneOf' ? 'Must match exactly one allowed form.' : 'Must match an allowed form.');
    }
  }
  if (typeof value === 'number') {
    if (own(schema, 'minimum') && value < schema.minimum) error(errors, path, 'minimum', 'Number is below the allowed minimum.');
    if (own(schema, 'maximum') && value > schema.maximum) error(errors, path, 'maximum', 'Number exceeds the allowed maximum.');
  }
  if (typeof value === 'string') {
    const length = Array.from(value).length;
    if (own(schema, 'minLength') && length < schema.minLength) error(errors, path, 'minLength', 'Text is shorter than allowed.');
    if (own(schema, 'maxLength') && length > schema.maxLength) error(errors, path, 'maxLength', 'Text exceeds the allowed character limit.');
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) error(errors, path, 'pattern', 'Text has an invalid format.');
    if (schema.format === 'uuid' && !UUID.test(value)) error(errors, path, 'format', 'Must be a UUID.');
    if (schema.format === 'date-time' && !isDateTime(value)) error(errors, path, 'format', 'Must be a valid RFC3339 date and time.');
  }
  if (Array.isArray(value)) {
    if (own(schema, 'minItems') && value.length < schema.minItems) error(errors, path, 'minItems', 'Array has too few items.');
    if (own(schema, 'maxItems') && value.length > schema.maxItems) error(errors, path, 'maxItems', 'Array has too many items.');
    if (schema.uniqueItems && value.some((item, index) => value.slice(0, index).some((prior) => equal(item, prior)))) {
      error(errors, path, 'uniqueItems', 'Array items must be unique.');
    }
    if (schema.items) value.forEach((item, index) => walk(schema.items, item, childPath(path, index), errors));
  }
  if (isPlainObject(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!own(value, key)) error(errors, childPath(path, key), 'required', 'Required field is missing.');
    }
    for (const key of Object.keys(value)) {
      if (own(properties, key)) walk(properties[key], value[key], childPath(path, key), errors);
      else if (schema.additionalProperties === false) error(errors, childPath(path, key), 'additionalProperties', 'Unexpected field is not allowed.');
      else if (isPlainObject(schema.additionalProperties)) walk(schema.additionalProperties, value[key], childPath(path, key), errors);
    }
  }
}

export function validate(schema, value) {
  const errors = [];
  checkJson(value, errors);
  if (errors.length === 0) walk(schema, value, '$', errors);
  return { valid: errors.length === 0, errors };
}

export function assertValid(schema, value) {
  const result = validate(schema, value);
  if (!result.valid) {
    const first = result.errors[0];
    const failure = new Error(`Invalid input at ${first.path}: ${first.message}`);
    failure.code = 'INVALID_INPUT';
    failure.status = 400;
    failure.statusCode = 400;
    failure.errors = result.errors;
    failure.details = result.errors;
    throw failure;
  }
  return value;
}

export function validateTool(name, args) {
  const definition = toolDefinitions.tools.find((tool) => tool.name === name);
  if (!definition) return { valid: false, errors: [{ path: '$/name', keyword: 'enum', message: 'Tool is not allowed.' }] };
  return validate(definition.parameters, args);
}

const names = {
  'action-request': 'actionRequest', 'action-result': 'actionResult', 'earth-bridge': 'earthBridge',
  constellation: 'constellation', 'realtime-start': 'realtimeStart', access: 'access',
  'knowledge-request': 'knowledgeRequest', 'session-close': 'sessionClose', 'text-turn': 'textTurn', 'tool-call': 'toolCall',
};

export function validateContract(name, value) {
  const key = own(schemas, name) ? name : names[name];
  return assertValid(key ? schemas[key] : false, value);
}
