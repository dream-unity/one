# Dream World portals / God’s Earth integration

## Public route and source ownership

The main screen at https://dreamunity.one/ belongs to `dream-unity/one`. Its Dream World circle is a native link to `./dream-world/`. That hub offers two native portals: **God’s Earth View** at `./gods-earth-view/` and **God’s Minds Eye View** at `./gods-minds-eye-view/`. The latter is a dedicated Coming soon page with a link back to Dream World. The Earth portal always shows **New User** and **Continue** first. New User opens a short guide. Both Continue links navigate to https://november-1st-sable.vercel.app/, the complete God’s Earth application maintained in `dream-unity/November-1st`.

`one` owns the home navigation, Dream World hub, nested portal pages and publication boundary. `November-1st` continues to own the entire God’s Earth frontend, server/provider endpoints, camera and radio directories, third-party attribution and deployment configuration. This integration does not fork or copy a reduced God’s Earth implementation into static hosting. Future app improvements become available through the same entry without a second app build in `one`.

Top-level navigation keeps the existing frontend and APIs on their intended origin. It preserves their current microphone, fullscreen, media, storage and share-link behavior without an iframe permission layer or a second cross-origin API configuration. Browser Back returns to the welcome page; restoring it from the back/forward cache resets the two choices. God’s Earth already supplies a “↖ Dream Unity” link to https://dreamunity.one/.

## Scope

The destination is the existing complete application, including its globe, aircraft and satellite tracking, contextual layers, cockpit and visual modes, CCTV/live-video directory, radio, traffic and provider-backed features. No layer is removed or recreated by the gateway. Features still depend on the application’s current configuration and the availability of external sources. Linking the app does not create new camera feeds, make snapshots into live video, or activate paid APIs.

The integration audit checked the current production root, `/api/health`, `/api/capabilities` and `/build-info.json`. At inspection, the deployment served runtime commit `c2835decd275541225320848489e54e2691afe01` (subsequently updated by the rename-only release `42e809c2c573ba23f61c8ea3ad03578247ec23bc`), reported 21 provider plugins and 12 keyless capability groups. This is a point-in-time health observation, not proof that every third-party feed works continuously. Optional voice, traffic-flow, FIRMS, photorealistic imagery and other keyed services still require their own configuration; persistent AIS collection remains a separate backend requirement.

Dream Machine and Dream Maker stay disabled in HTML and compatibility handlers. The original home artwork and animation modules are retained. The hidden legacy dialog remains for the existing renderer’s DOM contract; selecting Dream World no longer opens it.

## URL and fallback behavior

- Home, hub and nested-page anchors are relative, so both a custom-domain root and a GitHub project subpath resolve correctly.
- The hub appends shared query/hash state only to its fixed nested Earth path and never auto-selects a portal. Minds Eye receives no Earth-specific state.
- The Earth entry appends the exact query string and hash to a fixed HTTPS application origin and root path. Shared feed, camera and target state survives the handoff. Parameters cannot choose another destination.
- There is no automatic redirect, timer, remembered-user bypass or URL-based bypass. Ordinary clicks, keyboard activation and opening a new tab use native Continue anchors.
- With JavaScript disabled Continue still works, and a visible notice explains that the guide and God’s Earth application require JavaScript.
- No provider keys, tokens or user configuration are included in the entry files.
- The external application is an operational dependency: if its deployment is unavailable, the entry cannot restore its services. Change both Continue anchors and `entry.js` together if its production address changes, then update the destination regression tests.

## Publication boundary

The Pages workflow publishes only `.public-site/`, generated from the explicit allowlist in `scripts/stage-public-site.mjs`. The Dream World public files are:

- `dream-world/index.html`
- `dream-world/entry.js`
- `dream-world/entry.css`
- `dream-world/hub.js`
- `dream-world/portals.css`
- `dream-world/gods-earth-view/index.html`
- `dream-world/gods-minds-eye-view/index.html`

The old `portals/dream-world` observatory, all other retained portals, exercises, games and these notes remain outside the public artifact. `_config.yml` also retains exclusions for legacy branch-based publication. The stage starts clean to avoid publishing stale activities.

## Verification

Hub regression tests check both portal names, native links, root/project-subpath routing, Minds Eye return navigation and exact state preservation through the extra portal step. Entry regression tests exercise the two initial choices, no automatic navigation, guide/back behavior and focus, browser-history restoration, both native Continue paths, exact query/hash preservation, fixed-origin enforcement, cached old home buttons and restricted compatibility hooks. Publication tests retain the existing file boundary.

The welcome page is owned by `one` and applies to Dream Unity portal entry. Direct bookmarks to the Vercel app bypass this outer page. The pending welcome implementation in `November-1st` must be coordinated with this entry before a later Vercel deployment to avoid two consecutive welcome screens.

Release verification must select Dream World from the live main screen, verify both portals and the Minds Eye return link, choose God’s Earth View, check both welcome routes and follow Continue to the existing complete app. This is distinct from verifying every optional upstream feature or external live stream.
