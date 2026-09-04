(() => {
  if (window.__DREAM_UNITY_DOMAIN_NAV__) return;

  const WORLD_DOMAINS = {
    machine: ["HEART", "MIND", "BODY"],
    maker: ["INTEND", "ACT", "BECOME"],
    world: ["MATTER", "STRUCTURE", "EMERGE"]
  };

  const MACHINE_MIND_DOMAINS = ["PERCEIVE", "MODEL", "PREDICT"];

  const WORLD_NAMES = {
    machine: "Dream Machine",
    maker: "Dream Maker",
    world: "Dream World"
  };

  const worldSteps = document.getElementById("world-steps");
  const worldPanel = document.getElementById("world-panel");
  const worldKicker = document.getElementById("world-kicker");
  const worldTitle = document.getElementById("world-title");
  const worldDescription = document.getElementById("world-description");
  const portalButtons = [...document.querySelectorAll("[data-world]")];

  if (!worldSteps) return;

  const style = document.createElement("style");
  style.id = "dream-unity-domain-button-styles";
  style.textContent = `
    .world-steps {
      width: 100%;
      gap: 7px;
    }

    .world-step-button {
      position: relative;
      flex: 1 1 0;
      min-width: 0;
      max-width: 112px;
      height: 34px;
      padding: 0 9px;
      overflow: hidden;
      color: #55566e;
      border: 1px solid color-mix(in srgb, var(--unity) 28%, rgba(82, 88, 124, 0.2));
      border-radius: 3px;
      background:
        linear-gradient(115deg, rgba(255,255,255,.62), rgba(255,255,255,.16)),
        color-mix(in srgb, var(--unity) 5%, transparent);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.82),
        0 7px 20px rgba(69,75,113,.045);
      cursor: pointer;
      font-size: 7px;
      font-weight: 650;
      letter-spacing: .14em;
      text-indent: .14em;
      white-space: nowrap;
      transition:
        color 220ms ease,
        border-color 220ms ease,
        background 220ms ease,
        box-shadow 220ms ease,
        transform 220ms cubic-bezier(.22,1,.36,1);
    }

    .world-step-button::before {
      position: absolute;
      inset: 4px;
      content: "";
      border: 1px solid color-mix(in srgb, var(--unity) 13%, transparent);
      border-radius: 1px;
      pointer-events: none;
    }

    .world-step-button:hover,
    .world-step-button:focus-visible,
    .domain-back:hover,
    .domain-back:focus-visible {
      color: color-mix(in srgb, var(--unity) 72%, #323348);
      border-color: color-mix(in srgb, var(--unity) 58%, rgba(82,88,124,.28));
      outline: none;
      transform: translateY(-1px);
    }

    .world-step-button[aria-pressed="true"] {
      color: color-mix(in srgb, var(--unity) 84%, #25263a);
      border-color: color-mix(in srgb, var(--unity) 70%, rgba(82,88,124,.28));
      background:
        radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--unity) 17%, white), transparent 72%),
        rgba(255,255,255,.56);
      box-shadow:
        inset 0 0 14px color-mix(in srgb, var(--unity) 8%, transparent),
        0 0 18px color-mix(in srgb, var(--unity) 13%, transparent);
    }

    .world-step-link {
      width: 3px;
      height: 3px;
      flex: 0 0 3px;
      transform: rotate(45deg);
      background: var(--unity);
      opacity: .4;
      pointer-events: none;
    }

    .domain-back {
      display: none;
      margin: -5px auto 10px;
      padding: 3px 8px 4px;
      color: #717286;
      border: 1px solid rgba(82, 88, 124, .13);
      border-radius: 12px;
      background: rgba(255,255,255,.28);
      cursor: pointer;
      font-size: 5px;
      font-weight: 600;
      letter-spacing: .16em;
      transition: color 220ms ease, border-color 220ms ease, transform 220ms cubic-bezier(.22,1,.36,1);
    }

    .domain-back.is-visible { display: block; }

    @media (max-width: 520px) {
      .world-steps { gap: 5px; }
      .world-step-button {
        height: 32px;
        padding-inline: 5px;
        font-size: 6px;
        letter-spacing: .1em;
        text-indent: .1em;
      }
      .world-step-link {
        width: 2px;
        height: 2px;
        flex-basis: 2px;
      }
    }
  `;
  document.head.append(style);

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "domain-back";
  backButton.textContent = "← HEART · MIND · BODY";
  backButton.setAttribute("aria-label", "Return to Heart, Mind and Body");
  worldSteps.before(backButton);

  function updateVisibleArchitecture() {
    const machinePortal = document.querySelector('[data-world="machine"] .portal-copy small');
    if (machinePortal) machinePortal.textContent = "HEART · MIND · BODY";

    const machineMap = document.querySelector(".panel-map .machine-dot")?.closest("span")?.querySelector("small");
    if (machineMap) machineMap.textContent = "HEART · MIND · BODY";
  }

  function setPortalExpansion(activeWorld) {
    portalButtons.forEach((button) => {
      const expanded = button.dataset.world === activeWorld;
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-controls", "world-steps");
    });
  }

  function emitSelection(world, domain, extra = {}) {
    window.dispatchEvent(new CustomEvent("dreamunity:domainselect", {
      detail: {
        world,
        domain: domain.toLowerCase(),
        label: domain,
        ...extra
      }
    }));
  }

  function selectDomain(world, domain, button) {
    worldSteps.querySelectorAll(".world-step-button").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });

    document.body.dataset.domainSelected = `${world}:${domain.toLowerCase()}`;
    emitSelection(world, domain);

    if (world === "machine" && domain === "MIND") {
      window.setTimeout(renderMindDomains, 120);
    }
  }

  function selectMindDomain(domain, button) {
    worldSteps.querySelectorAll(".world-step-button").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });

    document.body.dataset.domainSelected = `machine:mind:${domain.toLowerCase()}`;
    emitSelection("machine", domain, { parent: "mind", path: ["machine", "mind", domain.toLowerCase()] });
  }

  function buildButtons(domains, world, onSelect, ariaLabel) {
    worldSteps.replaceChildren();
    worldSteps.setAttribute("role", "group");
    worldSteps.setAttribute("aria-label", ariaLabel);

    domains.forEach((domain, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-step-button";
      button.dataset.world = world;
      button.dataset.domain = domain.toLowerCase();
      button.textContent = domain;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Select ${domain.toLowerCase()} in ${WORLD_NAMES[world]}`);
      button.addEventListener("click", () => onSelect(domain, button));
      worldSteps.append(button);

      if (index < domains.length - 1) {
        const connector = document.createElement("span");
        connector.className = "world-step-link";
        connector.setAttribute("aria-hidden", "true");
        worldSteps.append(connector);
      }
    });
  }

  function renderMindDomains() {
    backButton.classList.add("is-visible");
    if (worldKicker) worldKicker.textContent = "THE COGNITIVE MACHINE";
    if (worldTitle) worldTitle.textContent = "DREAM MACHINE · MIND";
    if (worldDescription) worldDescription.textContent = "Mind perceives the field, models what it finds, and predicts what may come next.";
    buildButtons(
      MACHINE_MIND_DOMAINS,
      "machine",
      selectMindDomain,
      "Dream Machine mind domains"
    );
  }

  function renderDomainButtons(world) {
    const domains = WORLD_DOMAINS[world];
    if (!domains) return;

    backButton.classList.remove("is-visible");

    if (world === "machine") {
      if (worldKicker) worldKicker.textContent = "THE HUMAN SYSTEM";
      if (worldTitle) worldTitle.textContent = "DREAM MACHINE";
      if (worldDescription) worldDescription.textContent = "Heart, mind and body form the Dream Machine. Mind contains the cognitive cycle: perceive, model, predict.";
    }

    buildButtons(
      domains,
      world,
      (domain, button) => selectDomain(world, domain, button),
      `${WORLD_NAMES[world]} domains`
    );

    setPortalExpansion(world);
  }

  backButton.addEventListener("click", () => {
    delete document.body.dataset.domainSelected;
    renderDomainButtons("machine");
  });

  window.addEventListener("dreamunity:worldfocus", (event) => {
    renderDomainButtons(event.detail?.key);
  });

  window.addEventListener("dreamunity:unityfocus", () => {
    delete document.body.dataset.domainSelected;
    backButton.classList.remove("is-visible");
    setPortalExpansion(null);
  });

  updateVisibleArchitecture();
  setPortalExpansion(null);

  window.__DREAM_UNITY_DOMAIN_NAV__ = {
    worlds: WORLD_DOMAINS,
    nested: {
      machine: {
        mind: MACHINE_MIND_DOMAINS
      }
    },
    render: renderDomainButtons,
    renderMind: renderMindDomains
  };
})();
