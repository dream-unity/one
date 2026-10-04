const START_TIMEOUT_MS = 15000;
const LISTEN_TIMEOUT_MS = 60000;
const KEYBOARD_FALLBACK = 'Type instead or use your keyboard’s microphone.';

/** Browser dictation only: final words are drafts, never commands or AI replies. */
export function createDictation({
  Recognition = globalThis.window?.SpeechRecognition || globalThis.window?.webkitSpeechRecognition,
  ownerDocument = globalThis.document,
  isSecureContext = globalThis.isSecureContext,
  onState = () => {}, onResult = () => {}, locale = 'en-AU',
} = {}) {
  const ownerWindow = ownerDocument?.defaultView || globalThis.window;
  const supported = typeof Recognition === 'function' && isSecureContext === true;
  let state = { status: supported ? 'idle' : 'unavailable', supported, active: false,
    message: supported ? 'Choose Speak to dictate, then review your words before sending.'
      : isSecureContext !== true ? `Open this page over HTTPS to use browser dictation. ${KEYBOARD_FALLBACK}`
      : `This browser does not provide speech recognition. ${KEYBOARD_FALLBACK}` };
  let owner = null, generation = 0, disposed = false;
  let startTimer = null, listenTimer = null;
  const snapshot = () => ({ ...state });
  function update(patch) {
    state = { ...state, ...patch };
    try { onState(snapshot()); } catch { /* UI errors must not prevent cleanup. */ }
  }
  function clearWatchdogs() {
    clearTimeout(startTimer); clearTimeout(listenTimer);
    startTimer = null; listenTimer = null;
  }
  const owns = current => !disposed && owner === current && current.generation === generation;
  function abortRecognition(current) {
    if (current.aborting) return;
    current.aborting = true;
    try { current.recognition.abort(); } catch { /* Already ended. */ }
    finally { current.aborting = false; }
  }
  function finish(status, message, abort = true) {
    const previous = owner;
    owner = null; generation++; clearWatchdogs();
    // Invalidate before abort: some browsers dispatch end/error synchronously.
    if (abort && previous) abortRecognition(previous);
    update({ status, message, active: false });
    return snapshot();
  }
  function fail(code) {
    const messages = {
      'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser settings, then choose Speak again.',
      'service-not-allowed': 'Your browser has disabled its speech recognition service. Check your browser settings or try another browser.',
      'audio-capture': 'Your browser could not access a microphone. Check that one is connected and available, then choose Speak again.',
      'network': 'Your browser’s speech recognition service could not connect. Check your connection and choose Speak again.',
      'no-speech': 'No speech was detected. Choose Speak again when you are ready.',
      'language-not-supported': 'Your browser’s speech recognition service does not support this language.',
      'not-supported': 'This browser cannot start speech recognition.',
    };
    if (code === 'aborted') return finish('stopped', 'Dictation stopped. Choose Speak to begin again.');
    const unavailable = ['not-supported', 'language-not-supported'].includes(code);
    if (unavailable) state = { ...state, supported: false };
    return finish(unavailable ? 'unavailable' : 'failed', `${messages[code] || 'Browser dictation could not start. Choose Speak to try again.'} ${KEYBOARD_FALLBACK}`);
  }
  function stop() {
    if (!state.supported && !owner) return snapshot();
    return finish('stopped', 'Dictation stopped. Review any words already added before sending.');
  }
  function start() {
    if (disposed || !state.supported || state.active) return snapshot();
    if (ownerDocument?.hidden) return finish('stopped', 'Return to this tab and choose Speak to begin dictation.');
    let recognition;
    try { recognition = new Recognition(); }
    catch (error) { return fail(error?.name === 'NotSupportedError' ? 'not-supported' : 'unknown'); }
    const current = { recognition, generation: ++generation, finalIndexes: new Set(), heardWords: false };
    owner = current;
    try {
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        // Permission can resolve after an earlier abort. Stop the stale native
        // capture again without touching a replacement owner or its watchdogs.
        if (!owns(current)) { abortRecognition(current); return; }
        clearTimeout(startTimer); startTimer = null;
        // A repeated start notification must not extend this capture indefinitely.
        if (listenTimer === null) listenTimer = setTimeout(() => {
          if (owns(current)) finish('stopped', 'Dictation reached its one-minute limit. Review your words, or choose Speak again.');
        }, LISTEN_TIMEOUT_MS);
        update({ status: 'listening', active: true, message: 'Listening. Speak your words, then review the draft before sending. Stop ends dictation.' });
      };
      recognition.onresult = event => {
        if (!owns(current)) return;
        const results = event?.results;
        if (!results || !Number.isInteger(results.length)) return;
        const first = Number.isInteger(event.resultIndex) && event.resultIndex >= 0 ? event.resultIndex : 0;
        for (let index = first; index < results.length; index++) {
          if (!owns(current)) break;
          const result = results[index];
          if (!result?.isFinal || current.finalIndexes.has(index)) continue;
          const text = typeof result[0]?.transcript === 'string' ? result[0].transcript.trim() : '';
          if (!text) continue;
          current.finalIndexes.add(index); current.heardWords = true;
          try { onResult(text); }
          catch { finish('failed', `The dictated words could not be added to your draft. ${KEYBOARD_FALLBACK}`); }
        }
      };
      recognition.onerror = event => { if (owns(current)) fail(event?.error); };
      recognition.onend = () => {
        if (!owns(current)) return;
        finish('stopped', current.heardWords ? 'Dictation added. Review your words before sending.'
          : `Dictation ended without adding words. Choose Speak to try again. ${KEYBOARD_FALLBACK}`, false);
      };
      update({ status: 'starting', active: true, message: 'Starting browser dictation. Allow microphone access if your browser asks. Stop cancels.' });
      if (!owns(current)) return snapshot();
      startTimer = setTimeout(() => {
        if (owns(current)) finish('failed', `Your browser did not start dictation. Check microphone permission and choose Speak again. ${KEYBOARD_FALLBACK}`);
      }, START_TIMEOUT_MS);
      // Remain synchronous so this call retains the user's activation gesture.
      recognition.start();
    } catch (error) {
      if (owns(current)) return fail(error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'not-allowed'
        : error?.name === 'NotSupportedError' ? 'not-supported' : 'unknown');
    }
    return snapshot();
  }
  const onVisibility = () => { if (ownerDocument?.hidden) stop(); };
  const onPageHide = () => stop();
  ownerDocument?.addEventListener?.('visibilitychange', onVisibility);
  ownerWindow?.addEventListener?.('pagehide', onPageHide);
  function dispose() {
    if (disposed) return;
    disposed = true; stop();
    ownerDocument?.removeEventListener?.('visibilitychange', onVisibility);
    ownerWindow?.removeEventListener?.('pagehide', onPageHide);
  }
  return { getState: snapshot, start, stop, dispose };
}
