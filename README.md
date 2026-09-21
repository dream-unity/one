# Dream Unity

The circular parchment front page for Dream Unity, using the original artwork and layout from the Breath Journal repository.

**Public availability:** [Dream Unity](https://dreamunity.one/) opens **Dream World**, a hub containing **God’s Earth View** and **God’s Minds Eye View**. Dream Machine and Dream Maker remain restricted. The published site contains the animated home page, its required assets and the `/dream-world/` hub and its two nested portals. The older activity descriptions below document retained repository source, which is excluded from publication.

Dream Unity models the circulation through which possibility becomes reality and returns transformed:

- **Dream Machine** — Heart · Mind · Body; Mind contains Perceive · Model · Predict
- **Dream Maker** — Intend · Act · Become
- **Dream World** — Matter · Structure · Emerge

## Experience

Select **Dream World** inside the illustrated circle to choose **God’s Earth View** or **God’s Minds Eye View**. God’s Earth View opens `/dream-world/gods-earth-view/`, where **New User** and **Continue** appear first. New User opens a short guide; either Continue link opens the full God’s Earth View application in the same tab. Its globe, layers, tracking, camera and radio directories, visual modes and provider APIs remain together at [the November-1st deployment](https://november-1st-sable.vercel.app/). Browser Back returns to the welcome choices; the application’s “↖ Dream Unity” link returns home. God’s Minds Eye View opens its own page at `/dream-world/gods-minds-eye-view/`, currently marked Coming soon. Its return link leads to the hub. Machine and Maker are visibly disabled.

The hub carries Earth-specific shared state into its Earth portal. The entry route preserves shared query and camera/hash state while fixing the destination to the complete application. It waits for an explicit Continue choice and uses normal browser navigation. No application subset, cross-origin iframe or secret credential is shipped by `one`. See [the integration notes](docs/DREAM_WORLD_INTEGRATION.md) for ownership, deployment and verification details. External data availability and optional provider credentials continue to determine which live services are available.

The original artwork forms a living 3D surface with clearly moving ink details. Bands of the original drawing turn clockwise at four degrees per second, while every ring keeps its original centre and radius. The outer construction guides, connecting spine, labels and portal positions stay fixed. Shallow relief and soft cast shadows preserve the ink-and-parchment style. There is no zoom, movement of the whole body, dragging, or control strip.

`symbol-motion.js` starts independently of Three.js and animates the original ink in SVG even if WebGL is unavailable or its module fails to load. The 3D renderer uses the same browser animation clock and rotating source coordinates, so context loss does not stop the visible movement. Source and destination masks keep the horizontal spine and label openings in place; rigid angular sampling avoids accumulated texture distortion. Reduced-motion preferences use half-speed ink and lower relief instead of silently freezing the page. Motion suspends behind a world dialog or hidden tab and resumes at its existing pose.

`symbol-3d.js` adds the locally vendored Three.js renderer and a 15-second relief rhythm from `symbol-surface.js`. The connected mesh's X/Y coordinates remain fixed; only its shallow Z relief, normals and sampled ink details change. Height and slope coefficients are computed once and shared by the surface and shadow pass. The complete source square fits the viewport without enlargement or cropping. The native Dream World link and restricted portal buttons work independently of both rendering modes.

## Retained, unpublished portal map

The source under `/portals/` retains eleven previous destinations. These are not published or opened from the current home screen. Heart practices and the CBT laboratory remain intact in source; Structure also retains its Empire Dawn integration.

| World | Portal | Working experience |
| --- | --- | --- |
| Machine | Heart | Heart-focused practice, feeling maps and comparisons |
| Machine | Body | Supported movement, notice-only practice and an eight-tap rhythm comparison |
| Machine | Mind / Perceive | Eight visible fields, majority judgments and confidence with assistance tracked separately |
| Machine | Mind / Model | The existing fictional CBT skills laboratory |
| Machine | Mind / Predict | Twelve locked probability forecasts, Brier scoring and small-sample calibration |
| Maker | Intend | A five-part plan builder with a starting cue, action and fallback |
| Maker | Act | Three inertial-control levels plus a focus timer that receives the chosen Intend plan |
| Maker | Become | Three process-rehearsal scenes, timed or self-paced, with distinct optional subjective ratings |
| World | Matter | Exact impact timing, adjustable bounce physics and a conserved energy account |
| World | Structure | A nine-node graph challenge that checks every single-link failure, plus the village game |
| World | Emerge | Two deterministic boids worlds sharing their initial state, with independently adjustable rules |

The nine native activities use independent JavaScript modules and no additional packages. `portals/core.js` contains the inspectable numerical models. The directory, HTML entrypoints and metadata are generated by `node scripts/generate-portals.mjs`; generated HTML remains tracked for reference and tests, and is excluded from public deployment. The root keeps its previous renderer files for reference but no longer loads them on the home screen.

### Scientific and interaction boundaries

Each new activity explains its mechanism, assumptions, limitations and sources in “Go deeper”. Original exercises are not represented as validated treatments, personality assessments or intelligence tests. Observation, explanation and forecasting remain distinct tasks. Inward attention and imagery offer an easy stop; no unsupervised TRE induction is included.

Timed practices pause when hidden and require deliberate resumption. Simulations use fixed foreground time steps and stop when paused. No new activity submits answers, requests sensors, or persists personal records; page memory can survive browser Back, and reloading resets it. Only an authored plan identifier travels from Intend to Act.

`npm test` verifies existing Heart/CBT behaviour and renderer integrity, plus all native routes and imports, proper scoring, timer boundaries, conservation of energy, bounce trajectories, graph resilience, deterministic flock comparisons and inertial control. These checks do not establish clinical efficacy or replace visual testing on target devices.

## Retained observatory: The World That Dreams Back

The earlier shared observatory remains as unpublished source at [`portals/dream-world/`](portals/dream-world/). It is distinct from the public `/dream-world/` portal hub. Its experiment lets participants enter two opposing network designs, trace their paths, predict the worst failure, and build a third world. All edge/vertex failure trials are enumerated from the actual design. A bounded local search can propose a one-bridge descendant from a completed test. Saved worlds, exact failed attempts, portable sharing links, notebook export/import and public GitHub submissions give an idea a history outside the current page.

The personal notebook is explicitly local to the device. The shared atlas is stored in the repository, with source issue attribution. Scheduled Astra review uses the connected GitHub app; it requires no public AI credential. See the [model notes](portals/dream-world/README.md) and [evolution procedure](portals/dream-world/EVOLUTION.md). The observatory does not collect private records from other Dream Unity activities or claim to measure human learning.

## Retained 3D renderer

The previous 3D source and bundled renderer remain in the repository and are not loaded by the circular home page. Their architecture is:

- Direct WebGL rendering with deterministic faceted materials and additive light sprites
- Device-aware geometry, antialiasing and pixel-ratio limits
- Automatic resolution and particle adaptation if sustained frame rate falls
- Refresh-rate-independent motion, visibility pausing and WebGL context recovery
- A lightweight vector depth scaffold that preserves the composition during GPU startup or recovery

The runtime deliberately avoids costly transmission materials, environment-map generation and full-screen bloom passes. Visual richness comes from composition, geometry, color and layered light rather than unstable post-processing.

## Run locally

```bash
npm install
npm run vendor
npm run build
npm run dev
```

Open the local address printed by Vite.

## Verify

```bash
npm run check
```

GitHub Pages publishes `.public-site/`, generated by `node scripts/stage-public-site.mjs` from an explicit allowlist of home assets and the Dream World hub and portal files. Never upload the repository root: it contains the unpublished portal, exercise and game sources. Staging recreates the output directory so removed or stale activity files cannot remain in the deployment. The home symbol imports its renderer directly from `vendor/three/`; no external CDN or bundling is required. The retained previous scene has a separate build pipeline and integrity-checked runtime segments. Run `npm test` for repository and integration tests, or `node --test tests/public-site.test.mjs tests/dream-world-entry.test.mjs` for the publication and entry checks alone.

Legacy branch-based Pages publishing is also covered by `_config.yml`, which excludes the retained activities and non-home sources. Do not restore a root `.nojekyll` file: that bypasses these exclusions. The staging script generates `.nojekyll` only inside its already-filtered output.

## Controls

- Tap or click Dream World, then choose God’s Earth View or God’s Minds Eye View
- Within God’s Earth View, choose New User for the guide or Continue for the complete app
- Tab and Enter activate the native Dream World link; modified clicks can open a new tab
- Browser Back returns to the welcome choices; “↖ Dream Unity” inside God’s Earth returns home
- Dream Machine and Dream Maker remain restricted

## License

Project-specific source and visual design are copyright Dream Unity. Three.js is distributed under the MIT license included in `vendor/three/LICENSE`.
