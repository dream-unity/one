// Report module-loading failures instead of leaving the invitation indefinitely pending.
(() => {
  import('./main.js').then(() => {
    document.body.dataset.boot = 'ready';
  }).catch(error => {
    document.body.dataset.boot = 'failed';
    document.body.dataset.memory = 'failed';
    const get = id => document.getElementById(id);
    const message = 'This experience could not start. Reload the page, or use Exit to return to Dream Unity.';
    for (const [id, text] of [
      ['voice-label', 'Unavailable'],
      ['voice-hint', 'Reload this page'],
      ['session-status', message],
      ['service-status', message],
      ['memory-status', 'Notes could not start. Reload the page to try again.'],
    ]) {
      const element = get(id);
      if (element) element.textContent = text;
    }
    for (const id of ['voice-start', 'service-retry', 'memory-session-mode', 'memory-consent',
      'memory-share-consent', 'memory-revoke', 'memory-clear', 'memory-forget-device']) {
      const element = get(id);
      if (element) { element.disabled = true; element.setAttribute('aria-busy', 'false'); }
    }
    get('voice-start')?.setAttribute('aria-pressed', 'false');
    for (const id of ['access-panel', 'resume-button']) {
      const element = get(id);
      if (element) element.hidden = true;
    }
    console.error('Dream Unity startup failed:', error);
  });
})();
