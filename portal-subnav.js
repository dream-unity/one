(() => {
  const panel = document.getElementById('world-panel');
  const title = document.getElementById('world-title');
  const steps = document.getElementById('world-steps');
  const world = document.querySelector('.portal-card[data-world="world"]');
  const back = document.getElementById('return-unity');
  if (!world) return;

  // Access is closed in the HTML as well, so it does not depend on JavaScript.
  for (const button of document.querySelectorAll('.portal-card[data-world]')) {
    const restricted = button.dataset.world !== 'world';
    if (restricted) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function clearContents() {
    steps?.replaceChildren();
    if (steps) steps.hidden = true;
    for (const id of ['world-kicker', 'world-description']) {
      const element = document.getElementById(id);
      if (element) { element.textContent = ''; element.hidden = true; }
    }
    panel?.querySelectorAll('.world-observatory-link, .domain-back, .domain-availability')
      .forEach(element => element.remove());
    if (title) title.textContent = 'Dream World';
    delete document.body.dataset.domainSelected;
  }

  function openWorld(key = 'world') {
    if (key !== 'world') return false;
    // Keep the complete application and provider backend on their own origin.
    // The native anchor handles normal clicks, keyboard use and new tabs.
    window.location.assign(new URL('./dream-world/', document.baseURI).href);
    return true;
  }

  function closeWorld() {
    document.body.dataset.worldSelected = 'false';
    panel?.classList.remove('is-visible');
    panel?.setAttribute('aria-hidden', 'true');
  }

  clearContents();
  closeWorld();
  // Older cached markup used a button. It still reaches the same application.
  if (world.tagName === 'BUTTON') world.addEventListener('click', () => openWorld());
  back?.addEventListener('click', closeWorld);
  window.addEventListener('dreamunity:worldfocus', event => openWorld(event.detail?.key));
  window.addEventListener('dreamunity:unityfocus', closeWorld);
  window.addEventListener('pageshow', closeWorld);

  // Old return links and integration hooks cannot reopen a restricted area.
  window.__DREAM_UNITY_DOMAIN_NAV__ = {
    worlds: { machine: [], maker: [], world: [] },
    nested: {}, render: openWorld, renderMind: () => false,
  };
  const url = new URL(window.location.href);
  if (url.searchParams.has('return') || url.searchParams.has('focus')) {
    url.searchParams.delete('return');
    url.searchParams.delete('focus');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
})();
