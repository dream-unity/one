(() => {
  if (window.__DREAM_UNITY_DOMAIN_NAV__) return;

  const WORLD_DOMAINS = {
    machine: ["PERCEIVE", "MODEL", "PREDICT"],
    maker: ["INTEND", "ACT", "BECOME"],
    world: ["MATTER", "STRUCTURE", "EMERGE"]
  };

  const WORLD_NAMES = {
    machine: "Dream Machine",
    maker: "Dream Maker",
    world: "Dream World"
  };

  const worldSteps = document.getElementById("world-steps");
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
    .world-step-button:focus-visible {
      color: color-mix(in srgb, var(--unity) 72%, #323348);
      border-color: color-mix(in srgb, var(--unity) 58%, rgba(82,88,124,.28));
      background:
        linear-gradient(115deg, rgba(255,255,255,.82), rgba(255,255,255,.25)),
        color-mix(in srgb, var(--unity) 10%, transparent);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.9),
        0 8px 24px color-mix(in srgb, var(--unity) 13%, transparent);
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

  function setPortalExpansion(activeWorld) {
    portalButtons.forEach((button) => {
      const expanded = button.dataset.world === activeWorld;
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-controls", "world-steps");
    });
  }

  function selectDomain(world, domain, button) {
    worldSteps.querySelectorAll(".world-step-button").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });

    document.body.dataset.domainSelected = `${world}:${domain.toLowerCase()}`;
    window.dispatchEvent(new CustomEvent("dreamunity:domainselect", {
      detail: {
        world,
        domain: domain.toLowerCase(),
        label: domain
      }
    }));
  }

  function renderDomainButtons(world) {
    const domains = WORLD_DOMAINS[world];
    if (!domains) return;

    worldSteps.replaceChildren();
    worldSteps.setAttribute("role", "group");
    worldSteps.setAttribute("aria-label", `${WORLD_NAMES[world]} domains`);

    domains.forEach((domain, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-step-button";
      button.dataset.world = world;
      button.dataset.domain = domain.toLowerCase();
      button.textContent = domain;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Select ${domain.toLowerCase()} in ${WORLD_NAMES[world]}`);
      button.addEventListener("click", () => selectDomain(world, domain, button));
      worldSteps.append(button);

      if (index < domains.length - 1) {
        const connector = document.createElement("span");
        connector.className = "world-step-link";
        connector.setAttribute("aria-hidden", "true");
        worldSteps.append(connector);
      }
    });

    setPortalExpansion(world);
  }

  window.addEventListener("dreamunity:worldfocus", (event) => {
    renderDomainButtons(event.detail?.key);
  });

  window.addEventListener("dreamunity:unityfocus", () => {
    delete document.body.dataset.domainSelected;
    setPortalExpansion(null);
  });

  setPortalExpansion(null);

  window.__DREAM_UNITY_DOMAIN_NAV__ = {
    worlds: WORLD_DOMAINS,
    render: renderDomainButtons
  };
})();
