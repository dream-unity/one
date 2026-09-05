(() => {
  if (window.__DREAM_UNITY_DOMAIN_NAV__) return;

  const WORLD_DOMAINS = {
    machine: ["HEART", "MIND", "BODY"],
    maker: ["INTEND", "ACT", "BECOME"],
    world: ["MATTER", "STRUCTURE", "EMERGE"]
  };
  const MACHINE_MIND_DOMAINS = ["PERCEIVE", "MODEL", "PREDICT"];
  const DOMAIN_ACTIONS = {
    HEART: "Feel", MIND: "Think", BODY: "Move",
    PERCEIVE: "Look closely", MODEL: "Check a thought", PREDICT: "What comes next?",
    INTEND: "Choose a goal", ACT: "Take a step", BECOME: "Grow",
    MATTER: "Things", STRUCTURE: "How things fit", EMERGE: "What can grow"
  };
  const WORLD_NAMES = {
    machine: "Dream Machine", maker: "Dream Maker", world: "Dream World"
  };
  const WORLD_COPY = {
    machine: {
      kicker: "Feel. Think. Move.",
      description: "Practise using your feelings, thoughts and body. Choose Think to try a thought exercise."
    },
    maker: {
      kicker: "Turn a wish into a step.",
      description: "Choose a goal. Take a step. Learn as you go. These practices are not ready yet."
    },
    world: {
      kicker: "See how things work together.",
      description: "See what happens when things work together. Choose How things fit to build a village."
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

  function showUnavailable(domain) {
    tryThought.href = new URL("./exercises/cbt/", document.baseURI).href;
    tryThought.textContent = "Try a thought exercise";
    availabilityMessage.textContent = "This practice is not ready yet. You can try a thought exercise now.";
    availability.hidden = false;
    availability.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  function selectDomain(world, domain, button) {
    markSelected(button);
    document.body.dataset.domainSelected = `${world}:${domain.toLowerCase()}`;
    emitSelection(world, domain);
    if (world === "machine" && domain === "HEART") {
      window.location.href = new URL("./exercises/heart/?v=heart-research-20260905-2", document.baseURI).href;
    } else if (world === "machine" && domain === "MIND") {
      renderMindDomains();
      worldTitle?.focus({ preventScroll: true });
    } else if (world === "world" && domain === "STRUCTURE") {
      availabilityMessage.textContent = "Build a village. Gather food and wood. Choose what to build and help your village grow.";
      tryThought.href = new URL("./games/empire-dawn/", document.baseURI).href;
      tryThought.textContent = "Build a village";
      availability.hidden = false;
      availability.scrollIntoView({ block: "nearest", behavior: "instant" });
    } else {
      showUnavailable(domain);
    }
  }

  function selectMindDomain(domain, button) {
    markSelected(button);
    document.body.dataset.domainSelected = `machine:mind:${domain.toLowerCase()}`;
    emitSelection("machine", domain, { parent: "mind", path: ["machine", "mind", domain.toLowerCase()] });
    if (domain === "MODEL") {
      window.location.href = new URL("./exercises/cbt/", document.baseURI).href;
    } else {
      showUnavailable(domain);
    }
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
      button.dataset.world = world;
      button.dataset.domain = domain.toLowerCase();
      const action = document.createElement("span");
      action.className = "world-step-action";
      action.textContent = DOMAIN_ACTIONS[domain];
      const name = document.createElement("span");
      name.className = "world-step-name";
      name.textContent = domain.charAt(0) + domain.slice(1).toLowerCase();
      button.append(action, name);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${DOMAIN_ACTIONS[domain]}: ${name.textContent}, in ${WORLD_NAMES[world]}`);
      button.addEventListener("click", () => onSelect(domain, button));
      worldSteps.append(button);
    });
    if (worldPanel) worldPanel.scrollTop = 0;
  }

  function renderMindDomains() {
    backButton.classList.add("is-visible");
    if (worldKicker) worldKicker.textContent = "Dream Machine · Mind";
    if (worldTitle) worldTitle.textContent = "Think";
    if (worldDescription) worldDescription.textContent = "Look closely. Check a thought. Think about what could happen. Start with Check a thought.";
    buildButtons(MACHINE_MIND_DOMAINS, "machine", selectMindDomain, "Choose a way to practise thinking");
  }

  function renderDomainButtons(world) {
    const domains = WORLD_DOMAINS[world];
    if (!domains) return;
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
    renderDomainButtons(event.detail?.key);
  });
  window.addEventListener("dreamunity:unityfocus", () => {
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

  function revealMachinePanel() {
    document.body.dataset.worldSelected = "true";
    worldPanel?.style.setProperty("--unity", "#4e91ef");
    worldPanel?.classList.add("is-visible");
    worldPanel?.setAttribute("aria-hidden", "false");
    document.querySelectorAll("[data-portal]").forEach((portal) => {
      portal.classList.toggle("is-active", portal.dataset.portal === "machine");
    });
    setPortalExpansion("machine");
  }

  function restoreMachineContext() {
    const returningToHeart = returnTarget === "machine-heart";
    if (!returningToHeart && returnTarget !== "machine-mind-model") return;
    window.__DREAM_UNITY__?.focus?.("machine");
    revealMachinePanel();
    if (returningToHeart) renderDomainButtons("machine");
    else renderMindDomains();
    const selectedButton = worldSteps.querySelector(returningToHeart ? '[data-domain="heart"]' : '[data-domain="model"]');
    if (selectedButton) {
      selectedButton.setAttribute("aria-pressed", "true");
      document.body.dataset.domainSelected = returningToHeart ? "machine:heart" : "machine:mind:model";
      selectedButton.focus({ preventScroll: true });
    }
    if (!returningToHeart && worldDescription) worldDescription.textContent = "Try Check a thought again. Practise noticing a thought, testing it and choosing what to do next.";
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("return");
    cleanUrl.searchParams.delete("focus");
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  window.setTimeout(restoreMachineContext, 0);
})();
