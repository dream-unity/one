(() => {
  if (window.__DREAM_UNITY_DOMAIN_NAV__) return;

  const WORLD_DOMAINS = {
    machine: ["HEART", "MIND", "BODY"],
    maker: ["INTEND", "ACT", "BECOME"],
    world: ["MATTER", "STRUCTURE", "EMERGE"]
  };
  const MACHINE_MIND_DOMAINS = ["PERCEIVE", "MODEL", "PREDICT"];
  const DOMAIN_ROUTES = {
    HEART: "./exercises/heart/?v=heart-depth-20260907",
    BODY: "./portals/body/", PERCEIVE: "./portals/perceive/", MODEL: "./exercises/cbt/", PREDICT: "./portals/predict/",
    INTEND: "./portals/intend/", ACT: "./portals/act/", BECOME: "./portals/become/",
    MATTER: "./portals/matter/", STRUCTURE: "./portals/structure/", EMERGE: "./portals/emerge/"
  };
  const DOMAIN_ACTIONS = {
    HEART: "Feel", MIND: "Think", BODY: "Move",
    PERCEIVE: "Look closely", MODEL: "Check a thought", PREDICT: "What comes next?",
    INTEND: "Choose a goal", ACT: "Take a step", BECOME: "Grow",
    MATTER: "Things", STRUCTURE: "How things fit", EMERGE: "What can grow"
  };
  const DOMAIN_DESCRIPTIONS = {
    HEART: "Learn to feel love and notice your heart.",
    MIND: "Look at a thought. Test it. Choose a step.",
    BODY: "Move gently, rest, or tap an easy rhythm.",
    PERCEIVE: "Find a quiet signal. How sure are you?",
    MODEL: "What could explain it? How could you check?",
    PREDICT: "Guess a chance before the next seed opens.",
    INTEND: "Turn a wish into a first step and a plan.",
    ACT: "Guide a moving light, then try a small step.",
    BECOME: "Imagine a challenge. Rehearse your next move.",
    MATTER: "Catch a bounce. See where its energy goes.",
    STRUCTURE: "Connect a network, or build a living village.",
    EMERGE: "Change a rule. Watch a flock grow together."
  };
  const WORLD_NAMES = {
    machine: "Dream Machine", maker: "Dream Maker", world: "Dream World"
  };
  const WORLD_COPY = {
    machine: {
      kicker: "Feel. Think. Move.",
      description: "Explore a feeling, look closely at a thought, or learn through an easy movement."
    },
    maker: {
      kicker: "Turn a wish into a step.",
      description: "Give a wish a first step. Guide it into action. Rehearse how you meet a challenge."
    },
    world: {
      kicker: "A world that dreams back.",
      description: "Enter two worlds. Test what holds them together. Grow a third world from what you discover."
    }
  };
  const returnTarget = new URLSearchParams(window.location.search).get("return");
  const worldSteps = document.getElementById("world-steps");
  const worldPanel = document.getElementById("world-panel");
  const worldKicker = document.getElementById("world-kicker");
  const worldTitle = document.getElementById("world-title");
  const worldDescription = document.getElementById("world-description");
  const returnHome = document.getElementById("return-unity");
  const portalButtons = [...document.querySelectorAll(".portal-card[data-world]")];

  if (!worldSteps) return;

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "domain-back";
  backButton.textContent = "Back to Dream Machine";
  backButton.setAttribute("aria-label", "Back to Dream Machine: Feel, Think and Move");
  worldSteps.before(backButton);

  const observatory = document.createElement("a");
  observatory.className = "world-observatory-link";
  observatory.href = new URL("./portals/dream-world/", document.baseURI).href;
  observatory.textContent = "Enter the world that dreams back ↗";
  observatory.hidden = true;
  worldSteps.before(observatory);

  const availability = document.createElement("div");
  availability.className = "domain-availability";
  availability.hidden = true;
  const availabilityMessage = document.createElement("p");
  availabilityMessage.setAttribute("role", "status");
  const tryThought = document.createElement("a");
  tryThought.className = "domain-try";
  tryThought.href = new URL("./exercises/cbt/", document.baseURI).href;
  tryThought.textContent = "Try a thought exercise";
  availability.append(availabilityMessage, tryThought);
  worldSteps.after(availability);

  if (returnHome) {
    returnHome.textContent = "Back to home";
    returnHome.setAttribute("aria-label", "Back to the Dream Unity home screen");
  }
  if (worldTitle) worldTitle.tabIndex = -1;

  function updateVisibleArchitecture() {
    const machinePortal = document.querySelector('[data-world="machine"] .portal-copy small');
    if (machinePortal) machinePortal.textContent = "HEART · MIND · BODY";
    const machineMap = document.querySelector(".panel-map .machine-dot")?.closest("span")?.querySelector("small");
    if (machineMap) machineMap.textContent = "Feel · Think · Move";
  }

  function setPortalExpansion(activeWorld) {
    portalButtons.forEach((button) => {
      button.setAttribute("aria-expanded", String(button.dataset.world === activeWorld));
      button.setAttribute("aria-controls", "world-panel");
    });
  }

  function emitSelection(world, domain, extra = {}) {
    window.dispatchEvent(new CustomEvent("dreamunity:domainselect", {
      detail: { world, domain: domain.toLowerCase(), label: domain, ...extra }
    }));
  }

  function markSelected(button) {
    worldSteps.querySelectorAll(".world-step-button").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
  }

  function openDomain(domain) {
    const route = DOMAIN_ROUTES[domain];
    if (route) window.location.href = new URL(route, document.baseURI).href;
  }

  function selectDomain(world, domain, button) {
    markSelected(button);
    document.body.dataset.domainSelected = `${world}:${domain.toLowerCase()}`;
    emitSelection(world, domain);
    if (world === "machine" && domain === "MIND") {
      renderMindDomains();
      worldTitle?.focus({ preventScroll: true });
    } else {
      openDomain(domain);
    }
  }

  function selectMindDomain(domain, button) {
    markSelected(button);
    document.body.dataset.domainSelected = `machine:mind:${domain.toLowerCase()}`;
    emitSelection("machine", domain, { parent: "mind", path: ["machine", "mind", domain.toLowerCase()] });
    openDomain(domain);
  }

  function buildButtons(domains, world, onSelect, ariaLabel) {
    availability.hidden = true;
    worldSteps.replaceChildren();
    worldSteps.setAttribute("role", "group");
    worldSteps.setAttribute("aria-label", ariaLabel);
    worldSteps.setAttribute("aria-describedby", "world-description");
    domains.forEach((domain) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-step-button";
      button.dataset.domain = domain.toLowerCase();
      const action = document.createElement("span");
      action.className = "world-step-action";
      action.textContent = DOMAIN_ACTIONS[domain];
      const name = document.createElement("span");
      name.className = "world-step-name";
      name.textContent = domain.charAt(0) + domain.slice(1).toLowerCase();
      const description = document.createElement("span");
      description.className = "world-step-description";
      description.id = `domain-description-${world}-${domain.toLowerCase()}`;
      description.textContent = DOMAIN_DESCRIPTIONS[domain];
      button.append(action, name, description);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${DOMAIN_ACTIONS[domain]}: ${name.textContent}, in ${WORLD_NAMES[world]}`);
      button.setAttribute("aria-describedby", description.id);
      button.addEventListener("click", () => onSelect(domain, button));
      worldSteps.append(button);
    });
    if (worldPanel) worldPanel.scrollTop = 0;
  }

  function renderMindDomains() {
    observatory.hidden = true;
    backButton.classList.add("is-visible");
    if (worldKicker) worldKicker.textContent = "Dream Machine · Mind";
    if (worldTitle) worldTitle.textContent = "Think";
    if (worldDescription) worldDescription.textContent = "Observe what is here. Test an explanation. Forecast what could happen next.";
    buildButtons(MACHINE_MIND_DOMAINS, "machine", selectMindDomain, "Choose a way to practise thinking");
  }

  function renderDomainButtons(world) {
    const domains = WORLD_DOMAINS[world];
    if (!domains) return;
    observatory.hidden = world !== "world";
    backButton.classList.remove("is-visible");
    if (worldKicker) worldKicker.textContent = WORLD_COPY[world].kicker;
    if (worldTitle) worldTitle.textContent = WORLD_NAMES[world];
    if (worldDescription) worldDescription.textContent = WORLD_COPY[world].description;
    buildButtons(domains, world, (domain, button) => selectDomain(world, domain, button), `Choose a practice in ${WORLD_NAMES[world]}`);
    setPortalExpansion(world);
  }

  backButton.addEventListener("click", () => {
    delete document.body.dataset.domainSelected;
    renderDomainButtons("machine");
    worldSteps.querySelector('[data-domain="mind"]')?.focus({ preventScroll: true });
  });

  window.addEventListener("dreamunity:worldfocus", (event) => {
    delete document.body.dataset.domainSelected;
    // The renderer also writes this panel. Apply navigation after all listeners.
    queueMicrotask(() => renderDomainButtons(event.detail?.key));
  });
  window.addEventListener("dreamunity:unityfocus", () => {
    observatory.hidden = true;
    delete document.body.dataset.domainSelected;
    backButton.classList.remove("is-visible");
    availability.hidden = true;
    setPortalExpansion(null);
  });

  updateVisibleArchitecture();
  setPortalExpansion(null);
  window.__DREAM_UNITY_DOMAIN_NAV__ = {
    worlds: WORLD_DOMAINS,
    nested: { machine: { mind: MACHINE_MIND_DOMAINS } },
    render: renderDomainButtons,
    renderMind: renderMindDomains
  };

  function revealWorldPanel(world = "machine") {
    document.body.dataset.worldSelected = "true";
    worldPanel?.style.setProperty("--unity", {machine:"#4e91ef",maker:"#51bfb4",world:"#8e63e8"}[world]);
    worldPanel?.classList.add("is-visible");
    worldPanel?.setAttribute("aria-hidden", "false");
    document.querySelectorAll("[data-portal]").forEach((portal) => {
      portal.classList.toggle("is-active", portal.dataset.portal === world);
    });
    setPortalExpansion(world);
  }

  let userNavigated = false;
  portalButtons.forEach(button => button.addEventListener("click", () => {
    userNavigated = true;
    queueMicrotask(() => { revealWorldPanel(button.dataset.world); renderDomainButtons(button.dataset.world); });
  }));
  returnHome?.addEventListener("click", () => {
    userNavigated = true;
    document.body.dataset.worldSelected = "false";
    worldPanel?.classList.remove("is-visible");
    worldPanel?.setAttribute("aria-hidden", "true");
    setPortalExpansion(null);
  });
  function restoreMachineContext() {
    if (userNavigated || !returnTarget) return;
    const parts = returnTarget.split("-");
    const world = parts[0], nested = parts[1] === "mind";
    if (!WORLD_DOMAINS[world]) return;
    const domain = parts.at(-1);
    window.__DREAM_UNITY__?.focus?.(world);
    queueMicrotask(() => {
      revealWorldPanel(world);
      if (nested) renderMindDomains();
      else renderDomainButtons(world);
      const selectedButton = [...worldSteps.querySelectorAll('[data-domain]')].find(button => button.dataset.domain === domain);
      if (selectedButton) {
        selectedButton.setAttribute("aria-pressed", "true");
        document.body.dataset.domainSelected = parts.join(":");
        selectedButton.focus({ preventScroll: true });
      }
    });
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("return");
    cleanUrl.searchParams.delete("focus");
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  window.setTimeout(restoreMachineContext, 0);
  window.addEventListener("dreamunity:ready", () => queueMicrotask(restoreMachineContext), { once: true });
})();
