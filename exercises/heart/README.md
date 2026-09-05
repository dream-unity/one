# Heart training

Local integration at `Dream Machine → Heart`, served from `/exercises/heart/`.

## Implementation authority

The user-supplied Project Meaning `index(4).html` is the authority for exercise text, audio and runtime behavior. Its SHA-256 is `9b273d55b47ed3b0719e128b074a13b86d3ccd5b42864f265fdd11decc3a197f`. The public [Project Meaning site](https://o0ooooooooooo0o.github.io/Project-Meaning/) was also opened and both working exercises were inspected interactively.

Only the two operational exercises are included. The Project Meaning essay, branding shell, global typography, decorative artwork and locked stages are excluded. Teaching, safety and completion wording are retained as supplied. This transfer does not independently establish the scientific claims in that teaching.

## Preserved behavior

- Stage One durations: 900, 1800, 3600, 7200 and 10800 seconds.
- A 210 × 210 px breathing stage, 128 × 128 px ball, .8 / 1.55 scales and 5-second linear phases.
- Source thirds at elapsed fractions below .33, below .66 and the remainder. Prompt changes occur at breath transitions.
- Rhythm, Heart focus and Feeling indicators after 400, 4000 and 9000 ms. These are authored training cues, not sensor measurements.
- Stage Two durations: 900, 1800 and 3600 seconds. Seven source questions rotate every 30 seconds and wrap until the overall session ends.
- Re-reading a chip leaves the current countdown running, rings no extra bell, and ends at the next automatic step. Active, done and peek remain distinct.
- The source's 300 / 320 ms label/prompt fades. Reduced motion removes the visual transition without changing session cadence.
- Exact `PHASES`, `S2_DIMENSIONS` and unused `S2_PHASES` constants. `S2_PHASES` is deliberately not scheduled; activating it would change the actual source exercise.
- Shared 1/2/3 Hz delta, 8/10/12 Hz alpha and Off controls; 10 Hz default. Rate changes configure the next session.
- Per-option bell-volume values held in page memory. The 0–1.5 slider retains the source's steeper gain above 100%.
- Separate bell and pad graphs: generated 4.5-second stereo convolution response, original partials and envelopes, 392 / 293.66 Hz cues, source delta/alpha carriers, 60-second settling, modulation, brown noise, filters and three-second pad fade.
- Original completion sequence and exact closing messages. Manual End returns to setup without completion bells.

`audio.js` and `session.js` transplant the source logic. `index.html` preserves the instructional hierarchy. Styles are restricted to the new Heart page and `#heart-training`; global Dream Unity styles and its compiled scene are untouched.

## Integration and lifecycle differences

- Existing Heart navigation opens the local route. Returning to Dream Machine restores Heart selection.
- Native buttons and accessible completion dialogs replace inline event handlers and nonsemantic clickable elements.
- All session, indicator, fade, preview and completion timers are owned and cancelled appropriately. A stopped or replaced session cannot alter the next one.
- Manual End retains the source pad fade. Leaving the Heart screen, starting another session or unloading cancels old graphs immediately.
- Suspended audio contexts resume following explicit interaction. Rejected or delayed resume requests cannot create orphan audio after leaving.
- Zero bell volume creates no strike; this avoids the invalid exponential ramp to zero in the supplied source.
- No voice, personal-input fields, analytics, network submissions or external audio/font dependencies are added. Browser background timer throttling remains subject to platform behavior, as in the source.

## Verification

Run `node --test tests/*.test.mjs`. Heart tests cover exact prompt fingerprints, duration/timing contracts, progress, repeated seven-step rotations, peek behavior, completion and cleanup, per-option volume, source audio graph constants, zero volume and browser-resume races. Existing tests continue to protect the Dream Unity scene, geometry, soundtrack and CBT behavior.
