# Dream World / God’s Eye integration

## Public route and source ownership

The main screen at https://dreamunity.one/ belongs to `dream-unity/one`. Its Dream World circle is a native link to `./dream-world/`. That entry route replaces itself in browser history with https://november-1st-sable.vercel.app/, the complete God’s Eye application maintained in `dream-unity/November-1st`.

`one` owns the home navigation, entry page and publication boundary. `November-1st` continues to own the entire God’s Eye frontend, server/provider endpoints, camera and radio directories, third-party attribution and deployment configuration. This integration does not fork or copy a reduced God’s Eye implementation into static hosting. Future app improvements become available through the same entry without a second app build in `one`.

Top-level navigation keeps the existing frontend and APIs on their intended origin. It preserves their current microphone, fullscreen, media, storage and share-link behavior without an iframe permission layer or a second cross-origin API configuration. Browser Back returns to the home screen without reopening the entry redirect. God’s Eye already supplies a “↖ Dream Unity” link to https://dreamunity.one/.

## Scope

The destination is the existing complete application, including its globe, aircraft and satellite tracking, contextual layers, cockpit and visual modes, CCTV/live-video directory, radio, traffic and provider-backed features. No layer is removed or recreated by the gateway. Features still depend on the application’s current configuration and the availability of external sources. Linking the app does not create new camera feeds, make snapshots into live video, or activate paid APIs.

The integration audit checked the current production root, `/api/health`, `/api/capabilities` and `/build-info.json`. At inspection, the deployment served runtime commit `c2835decd275541225320848489e54e2691afe01`, reported 21 provider plugins and 12 keyless capability groups. This is a point-in-time health observation, not proof that every third-party feed works continuously. Optional voice, traffic-flow, FIRMS, photorealistic imagery and other keyed services still require their own configuration; persistent AIS collection remains a separate backend requirement.

Dream Machine and Dream Maker stay disabled in HTML and compatibility handlers. The original home artwork and animation modules are retained. The hidden legacy dialog remains for the existing renderer’s DOM contract; selecting Dream World no longer opens it.

## URL and fallback behavior

- The main anchor is relative, so both a custom-domain root and a GitHub project subpath resolve correctly.
- The entry appends the exact query string and hash to a fixed HTTPS application origin and root path. Shared feed, camera and target state survives the handoff. Parameters cannot choose another destination.
- `location.replace` avoids an extra redirect entry on Back. Ordinary clicks, keyboard activation and opening a new tab use native anchor behavior.
- A visible link remains available if automatic navigation fails. With JavaScript disabled the link still works, but the God’s Eye application itself requires JavaScript.
- No provider keys, tokens or user configuration are included in the entry files.
- The external application is an operational dependency: if its deployment is unavailable, the entry cannot restore its services. Change both the fallback anchor and `entry.js` together if its production address changes, then update the destination regression tests.

## Publication boundary

The Pages workflow publishes only `.public-site/`, generated from the explicit allowlist in `scripts/stage-public-site.mjs`. The integration adds exactly:

- `dream-world/index.html`
- `dream-world/entry.js`
- `dream-world/entry.css`

The old `portals/dream-world` observatory, all other retained portals, exercises, games and these notes remain outside the public artifact. `_config.yml` also retains exclusions for legacy branch-based publication. The stage starts clean to avoid publishing stale activities.

## Verification

The repository’s full Node test suite passes (134 tests), including publication closure, retained numerical models, home structure and artwork/renderer integrity. New integration tests exercise the fixed destination, root and project paths, exact query/hash preservation, hostile destination-like parameters, blocked navigation fallback, missing fallback element, native anchor behavior, cached old buttons and restricted compatibility hooks.

Release verification additionally checks the actual GitHub Pages deployment, selects Dream World on the live main screen, confirms arrival at the complete application, and follows its return-home link. A successful navigation is distinct from verifying every optional upstream feature or every external live stream.
