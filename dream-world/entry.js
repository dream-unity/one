(() => {
  // Never take the application host or path from query parameters or the hash.
  // Those values are only shared camera/layer/feed state on the fixed app.
  const application = 'https://november-1st-sable.vercel.app/';
  const destination = application + window.location.search + window.location.hash;
  // Entry is always explicit. No timers, stored preference or URL can skip it.
  for (const id of ['open-world', 'guide-continue']) {
    const link = document.getElementById(id);
    if (link) link.href = destination;
  }
  const start = document.getElementById('welcome-start');
  const guide = document.getElementById('welcome-guide');
  const newUser = document.getElementById('new-user');
  const back = document.getElementById('guide-back');
  if (!start || !guide || !newUser || !back) return;

  const showStart = () => {
    start.hidden = false;
    guide.hidden = true;
    document.querySelector('main').setAttribute('aria-labelledby', 'welcome-title');
  };
  newUser.addEventListener('click', () => {
    start.hidden = true;
    guide.hidden = false;
    document.querySelector('main').setAttribute('aria-labelledby', 'guide-title');
    document.getElementById('guide-title').focus();
  });
  back.addEventListener('click', () => {
    showStart();
    newUser.focus();
  });
  // A cached page restored with browser Back must show the two choices again.
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      showStart();
      newUser.focus();
    }
  });
})();
