(() => {
  const panel = document.getElementById("world-panel");
  const returnHome = document.getElementById("return-unity");
  const title = document.getElementById("world-title");

  function syncDialog() {
    const visible = panel.getAttribute("aria-hidden") === "false";
    if (visible && !panel.open) {
      panel.showModal();
      title.focus({ preventScroll: true });
    } else if (!visible && panel.open) {
      panel.close();
    }
  }

  // Keep the existing portal navigation and return links; use native modal focus.
  new MutationObserver(syncDialog).observe(panel, {
    attributes: true,
    attributeFilter: ["aria-hidden"]
  });
  panel.addEventListener("cancel", (event) => {
    event.preventDefault();
    returnHome.click();
  });
  panel.addEventListener("click", (event) => {
    if (event.target !== panel) return;
    const bounds = panel.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) returnHome.click();
  });
  syncDialog();
})();
