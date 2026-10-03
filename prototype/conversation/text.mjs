/** Strict finite SSE decoding. Streamed text is never an executable instruction. */
export class ConversationError extends Error {
  constructor(code, message, retryable = false) {
    super(message); this.name = 'ConversationError'; this.code = code; this.retryable = retryable;
  }
}

export const utf8Bytes = value => new TextEncoder().encode(String(value)).byteLength;

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
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function serviceResponse(response) {
  if (response.ok) return response;
  let value = {};
  try { value = await response.json(); } catch { /* bounded generic error below */ }
  throw new ConversationError(typeof value.code === 'string' ? value.code : `HTTP_${response.status}`,
    typeof value.message === 'string' ? value.message.slice(0, 400) : 'The conversation service could not complete this request.', value.retryable === true);
}
