(() => {
  // Preserve shared Earth state through the hub without choosing a portal.
  // The path is fixed; query parameters cannot replace its destination.
  const earth = document.getElementById('earth-portal');
  if (!earth) return;
  const portal = new URL('./gods-earth-view/', document.baseURI);
  earth.href = portal.href + window.location.search + window.location.hash;
})();
