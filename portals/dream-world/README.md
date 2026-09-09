# The World That Dreams Back

A working Dream World observatory, at `portals/dream-world/`. It extends the existing Matter, Structure and Emerge destinations and preserves the root renderer. No package or build step is required.

## Playable loop

Enter world A or B; trace a route; temporarily break a bridge; make a prediction; enumerate a complete failure experiment. Build a third world by combining both founders, or make a descendant of a saved/shared design. Edit actual graph edges within a length-based budget. Keep failed attempts, revisit immutable test snapshots, and grow a one-edge candidate from a completed test. Share a portable URL or export/import a notebook. Optional public submissions use GitHub's issue composer, which the visitor reviews before posting.

The graph is the playable space, not decorative artwork. Keyboard users can Tab between islands or navigate with arrow keys; Enter/Space selects them. Touch targets have equivalent bridge-removal buttons. Motion is brief, stops on hidden tabs and respects reduced-motion preferences. Tests pause when hidden and resume only on request.

## Exact model

`model.js` is pure JavaScript and is also used by the validation script and Node tests. Nine fixed vertices, undirected edges, one source at vertex 0. A shortest-path breadth-first search gives reachability and bridge-crossing distance. Edge cost is max(1, round(Euclidean distance / 12)); budget is 42. There is no strength, flow capacity, time delay, collision, noise or physical unit model.

We exhaustively remove each edge, each non-source vertex, or each unordered pair of edges. Each trial starts from the original graph. A sleeping vertex is removed from the denominator. The source is deliberately protected in vertex trials. Empty trial sets do not establish resilience. Worst reach is a count; mean reach averages this world's enumerated cases. Case averages across different graphs do not assert equal real-world failure probabilities. A/B share positions, source, budget cap and outage rule; actual edge counts/costs differ and are displayed.

The local `grow()` operation explores all legal one-edge additions and removals, preserves connectivity, then orders candidates by worst reach, mean reach, lower cost and lower average source distance. It accepts only an improvement under this ordering. This deterministic local search is not an AI service, has no global-optimality guarantee, and does not claim new real-world scientific evidence.

## Persistence and public participation

The optional personal notebook uses the browser's `dream-unity-dream-world-v1` key. Limits: 80 saved worlds, 200 completed test records. Records retain a world snapshot, model version, scenario, prediction and time; scores are recalculated, never trusted from an import. Storage failure is reported with an export fallback. A shared URL carries only the world, not the notebook or tests. User strings are length-bounded and escaped/text-only in rendering. No submitted data is evaluated as code.

The shared atlas is `community.json`: `{ "version": 1, "updatedAt": null, "worlds": [] }`. Its initial empty state is intentional. There are no fabricated participants, visits or discoveries. Every published community world must cite a positive GitHub issue number in this repository. The page fetches only this same-origin JSON file and can work without it.

## Astra evolution

The repository supplies the shared storage; scheduled ChatGPT Work runs supply Astra reasoning through the connected GitHub app. No OpenAI API key is placed in the website or required for that scheduled workflow. See `EVOLUTION.md` for the exact, bounded review procedure. The scheduled task is configured in ChatGPT, not in this repository; committing these instructions alone does not activate a schedule.

New worlds arrive only after a genuine, relevant public submission is checked. The agent can publish an original submitted design and at most one useful descendant in a run, with their source issue and parent IDs. Results must be computed from the actual graph. Simulation results are never represented as evidence about a participant's psychology or learning. This first model supports graph experiments; arbitrary essays cannot automatically become validated experiments.

## Maintenance and verification

Run `node scripts/validate-dream-world.mjs` and `node --test tests/dream-world.test.mjs`, then the repository's `npm test` gate. The tracked entrypoint and assets deploy through the existing GitHub Pages workflow. `portal-subnav.js` adds the observatory link inside the Dream World panel, and `portals/app.js` links to it from the world directory/activities. Keep the other eleven portal definitions intact.

Do not change founder geometry or scoring within model version 1. Version the model when its contracts change, so existing test histories stay reproducible.
