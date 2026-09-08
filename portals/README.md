# Portal implementation notes

This folder is a native extension of the existing static GitHub Pages site. It adds no API service, network submission, package dependency or replacement 3D renderer.

## Mathematical contracts

- **Perceive:** the visible sample contains exactly 48 left/right arrows. Majority counts are deterministic for a seed and round. Assistance is an explicit flag, excluded from the independent Brier average.
- **Predict:** all 24 Bernoulli outcomes are prepared before play; twelve are initial evidence. The probability is constant within a session. A locked forecast precedes its reveal. The optional Beta(1,1) model assumes a constant rate and independent samples. Binary Brier scoring uses the 0–1 convention, not Brier's doubled original binary form.
- **Matter:** ideal one-dimensional ballistics solves each impact time analytically. Restitution changes speed by e and first-peak height by e². Gravity and mass are expressed in SI units. Potential, kinetic and transferred energy sum to the original total. The final tiny bounce threshold explicitly transfers the remainder to surroundings.
- **Structure:** undirected links form the actual graph. A search is run for every possible single-link removal. The game omits link length/capacity and node failures; it measures edge resilience only.
- **Emerge:** 48 agents per world; wraparound 600×360 model coordinates; simultaneous updates from the previous state; finite neighbour radius, steering cap and speed bounds. Both worlds use the same seeded starting state. Resetting on parameter changes preserves the comparison. Alignment and crowding are calculated from positions and velocities, not interpolated display scores.
- **Act:** fixed-step constant-acceleration motion; zero push preserves velocity unless wind or a wall collision acts. The docking rule checks position, speed and continuous dwell time.

## Product boundaries

Movement, rehearsal and planning protocols are original educational designs. Their durations and task thresholds are design choices, not validated treatment doses or mastery cut-offs. Self-reports are labelled as reports. Ended-early sessions do not claim full completion. No personal account or health sensor is involved.

Source links are embedded beside each relevant explanation. They support the underlying concepts, not efficacy claims for these implementations.

## Maintenance

1. Update `catalog.js` when changing a portal title or destination.
2. Run `node scripts/generate-portals.mjs` after changing the catalog or template.
3. Keep `portal-subnav.js` routes consistent with the catalog.
4. Run `npm test`; new pure model checks live in `tests/portals.test.mjs`.
5. Serve the tracked root through the repository's existing GitHub Pages workflow.

The original scene and compiled renderer stay unchanged. Functional model tests and static resource checks are automated; this change has not been visually reviewed in a real browser during this session.
