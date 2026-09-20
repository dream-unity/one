(() => {
  // Never take the application host or path from query parameters or the hash.
  // Those values are only shared camera/layer/feed state on the fixed app.
  const application = 'https://november-1st-sable.vercel.app/';
  const destination = application + window.location.search + window.location.hash;
  const link = document.getElementById('open-world');
  if (link) link.href = destination;
  try {
    // Replace this gateway so browser Back returns to the home screen once.
    window.location.replace(destination);
  } catch {
    const status = document.getElementById('entry-status');
    if (status) status.textContent = 'Choose Open God’s Eye View to continue to Dream World.';
  }
})();
