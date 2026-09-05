# Heart practice

Native practice at `Dream Machine → Heart`, with a plain action layer and optional source-linked explanations. This research-led revision replaces the earlier requirement to preserve the supplied Project Meaning wording verbatim, following the user's 5 September 2026 instruction to correct the science and improve the training.

## Practices

- **Breathe with ease:** 3, 5, 10 or 15 minutes. Easy breathing, optional kind attention, then ordinary breathing and outward attention. The guide offers four or five seconds each way, or an unpaced option. The child setting selects ordinary breathing and a short session; it is not a claim of validated preschool treatment.
- **Try both ways:** a prediction, four one-minute blocks, and a private ease report after each block. Breath-only and breath-plus-kind-wish conditions run in randomly selected ABBA or BAAB order, with equal scheduled time. Untimed answer cards require an answer or explicit skip before continuing. All reports and interruptions are shown; there is no winner, average, physiological score or causal conclusion.
- **Notice your body:** 4, 8 or 12 minutes. Each round contains eight 30-second steps: a gentle attention target, description, strength, certainty, outward attention, return/comparison, alternative explanations and a chosen response. Later rounds add questions about expectation, context and evidence rather than asking for stronger sensations.

The sequence and comparison are original educational adaptations, not clinical protocols established by the cited studies. The website has no physiological sensor. Subjective strength, confidence, ease and consistency are not objective accuracy or metacognitive calibration.

## Scientific changes

The visible explanations contain 20 expandable questions with nearby primary-study and review links. They distinguish acute breathing-related HRV changes from mood, cognition and resting HRV; HeartMath observational evidence from randomized comparisons; and cardiac anatomy from unsupported claims about love stored in tissue. The interoception material distinguishes attention, confidence, measured performance, context and response. It includes negative and qualified results, including 2026 evidence.

Unsupported claims about cellular regeneration, automatic emotion decoding, a sincerity-gated hormone pathway and guaranteed brainwave/creativity effects have been removed. Sound remains a preference. The original synthesis and its rates, envelopes, reverb and per-option bell levels are unchanged; the labels no longer promise rest, focus or creativity. Old timer-driven “coherence” indicators and instructions to provoke feared symptoms have been removed.

The two exercises offer short instructions first. Optional questions expose causal uncertainty and measurement problems in plain language. Readability is a design goal; it has not been validated in user studies with five-year-olds or experts.

## Runtime

- `practice.js` is a pure, validated plan/state engine with monotonic foreground time, wait gates, optional answers, stale-step protection and truthful partial summaries.
- `session.js` connects native controls to that engine with one 250 ms foreground clock. Pause, looking outward and hidden pages stop timing and audio; returning requires explicit resumption. Ending, restarting or leaving clears owned cues and page-memory answers. Waiting for an answer does not consume practice time.
- `audio.js` retains the prior sound implementation and cancellation protections. Native audio failure does not prevent silent practice. Sound controls express a preference, not a claim of successful playback or brain measurement.
- `styles.css` is scoped to the Heart route: large controls, pale surfaces, responsive stacking, keyboard focus, native dialogs, and a static circle for reduced motion. Pacing words and numbers remain available without animation.
- All answers remain in page memory. No personal stories, sensors, analytics, network submissions or persistent answer storage are added. The CSP disallows connections.

## Verification

Run `node --test tests/*.test.mjs` from the repository root. The Heart tests exercise actual controls against the HTML fixture, all offered durations, both comparison orders, zero/unclear/skipped answers, pause and hidden time, stale clicks, partial completion, audio failure and cancellation, child pace selection, and privacy cleanup. Original audio graph tests remain. Separate structural tests protect the existing scene and renderer.

The new live page should also be checked for entry/setup/session/finish layouts, the paced and unpaced views, the complete four-round comparison, body attention transitions, source expansion, and return navigation. Unit DOM fixtures do not verify rendered layout or prove clinical effectiveness.
