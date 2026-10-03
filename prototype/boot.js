// Report module-loading failures instead of leaving the invitation indefinitely pending.
(() => {
  import('./main.js').then(() => {
    document.body.dataset.boot = 'ready';
  }).catch(error => {
    document.body.dataset.boot = 'failed';
    const status = document.getElementById('service-status');
    if (status) status.textContent = 'This experience could not start. Reload the page, or use Exit to return to Dream Unity.';
    console.error('Dream Unity startup failed:', error);
  });
})();
