/** Strict finite SSE decoding. Streamed text is never an executable instruction. */
export class ConversationError extends Error {
  constructor(code, message, retryable = false) {
    super(message); this.name = 'ConversationError'; this.code = code; this.retryable = retryable;
  }
}

export const utf8Bytes = value => new TextEncoder().encode(String(value)).byteLength;

const SERVICE_MESSAGES = {
  SERVICE_NOT_READY: 'AI conversation is awaiting private service configuration. You can explore the views and your own notes.',
  ACCESS_DENIED: 'This invitation is invalid or has expired. Enter a valid private invitation to connect.',
  ACCESS_RATE_LIMITED: 'Too many invitation attempts. Wait before trying again.',
  VOICE_RATE_LIMITED: 'The private voice limit has been reached. Wait before starting another voice connection.',
  TEXT_RATE_LIMITED: 'The private text limit has been reached. Wait before sending another message.',
};

export function connectionFailure(failure) {
  if (failure instanceof ConversationError || failure?.name === 'AbortError') return failure;
  return new ConversationError('NETWORK_UNAVAILABLE', 'The conversation service could not be reached. Check your connection and retry. If it continues, the service may be unavailable.', true);
}

export function microphoneFailure(failure) {
  if (failure instanceof ConversationError) return failure;
  const named = {
    NotAllowedError: ['MICROPHONE_PERMISSION_BLOCKED', 'Microphone access was blocked by permission or browser policy. Check this site’s microphone permission and device settings, then choose Speak again.'],
    SecurityError: ['MICROPHONE_POLICY_BLOCKED', 'This page is not allowed to use the microphone. Open the HTTPS site directly in a supported browser and check its microphone permission.'],
    NotFoundError: ['MICROPHONE_NOT_FOUND', 'No microphone is available. Connect or enable a microphone, then choose Speak again.'],
    NotReadableError: ['MICROPHONE_BUSY', 'The microphone could not be opened. Check your device settings or close another app using it, then choose Speak again.'],
    AbortError: ['MICROPHONE_INTERRUPTED', 'Microphone activation was interrupted. Check your device and choose Speak again.'],
    OverconstrainedError: ['MICROPHONE_CONSTRAINTS', 'The microphone does not support the requested audio settings. Choose another microphone or continue by writing.'],
    InvalidStateError: ['MICROPHONE_PAGE_INACTIVE', 'Return to this page in an active browser tab, then choose Speak again.'],
  }[failure?.name];
  return new ConversationError(...(named || ['MICROPHONE_FAILED', 'The microphone could not be activated. Check your browser and device settings, then choose Speak again.']));
}

const READINESS_REASONS = new Set(['AI_DISABLED', 'PROVIDER_NOT_CONFIGURED', 'SIGNING_NOT_CONFIGURED', 'CONTEXT_ENCRYPTION_NOT_CONFIGURED', 'ADMISSION_NOT_CONFIGURED', 'INVITES_NOT_CONFIGURED', 'CONFIG_INVALID']);
export function validateServiceStatus(value) {
  if (!value || value.version !== 1 || typeof value.ready !== 'boolean' || typeof value.enabled !== 'boolean'
    || value.access !== 'invite' || typeof value.voiceConfigured !== 'boolean' || typeof value.textConfigured !== 'boolean'
    || (value.ready && (!value.enabled || !value.voiceConfigured || !value.textConfigured || value.reason !== null))
    || (!value.ready && value.reason !== 'SERVICE_NOT_READY')
    || (value.reasonCodes !== undefined && (!Array.isArray(value.reasonCodes) || value.reasonCodes.length > 7
      || new Set(value.reasonCodes).size !== value.reasonCodes.length || value.reasonCodes.some(reason => !READINESS_REASONS.has(reason))
      || value.ready && value.reasonCodes.length))) {
    throw new ConversationError('INVALID_STATUS', 'The conversation service returned an incompatible status. Retry after the service has been updated.');
  }
  return value;
}

export function boundedHistory(records, consentEpoch, memoryRevision) {
  const eligible = records.filter(item => item.final && item.replayEligible && item.consentEpoch === consentEpoch && item.memoryRevision === memoryRevision);
  const history = []; let bytes = 0;
  for (let index = eligible.length - 1; index >= 0 && history.length < 12; index--) {
    const { role, text } = eligible[index];
    if (!['user', 'assistant'].includes(role) || utf8Bytes(text) > 8192) continue;
    const size = utf8Bytes(JSON.stringify({ role, content: text }));
    if (bytes + size > 24 * 1024) break;
    bytes += size; history.unshift({ role, content: text });
  }
  return history;
}

export async function readFiniteSSE(response, onEvent, signal) {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new ConversationError('INVALID_STREAM', 'The text service returned an invalid stream.');
  }
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  const abort = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  let buffer = ''; let bytes = 0; let count = 0;
  const dispatch = async block => {
    if (!block.trim() || block.split('\n').every(line => !line || line.startsWith(':'))) return;
    let event = 'message'; const data = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) return;
    if (++count > 256 || utf8Bytes(data.join('\n')) > 64 * 1024) throw new ConversationError('STREAM_LIMIT', 'The text stream exceeded its allowed size.');
    let value;
    try { value = JSON.parse(data.join('\n')); } catch { throw new ConversationError('INVALID_STREAM', 'The text service returned malformed data.'); }
    if (!['text.delta', 'action.request', 'turn.complete', 'turn.error'].includes(event) || !value || value.version !== 1) {
      throw new ConversationError('INVALID_STREAM', 'The text service returned an unsupported event.');
    }
    await onEvent(event, value);
  };
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 256 * 1024) throw new ConversationError('STREAM_LIMIT', 'The text stream exceeded its allowed size.');
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      if (utf8Bytes(buffer) > 64 * 1024) throw new ConversationError('STREAM_LIMIT', 'The text stream contains an oversized event.');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        await dispatch(block);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) await dispatch(buffer);
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function serviceResponse(response) {
  if (response.ok) return response;
  let value = {};
  try { value = await response.json(); } catch { /* bounded generic error below */ }
  if (response.status === 404) throw new ConversationError('SERVICE_DEPLOYMENT_MISSING', 'This deployment does not provide the conversation service. The site owner needs to deploy the coordinated backend before conversation can connect.');
  const code = typeof value.code === 'string' ? value.code : `HTTP_${response.status}`;
  const fallback = response.status === 429 ? 'The conversation limit has been reached. Wait before trying again.'
    : response.status >= 500 ? 'The conversation service is temporarily unavailable. Retry later; exploring the views and your own notes remains available.'
      : 'The conversation service could not complete this request.';
  throw new ConversationError(code, SERVICE_MESSAGES[code] || (typeof value.message === 'string' && value.message !== code ? value.message.slice(0, 400) : fallback), value.retryable === true);
}
