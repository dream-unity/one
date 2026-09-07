# Heart practice

Native training at **Dream Machine → Heart**. The September 2026 update restores the full Project Meaning exercise structure while following the user's instruction to explain advanced material in clear language. It preserves physiological questions and experimental ambition while distinguishing measured results, subjective reports, and hypotheses.

## Core exercises

**Heart and feeling** keeps chest attention and deliberate felt emotion together. Love is the default; gratitude, appreciation, and compassion are distinct selectable practices. A cue or memory invites the emotion; the user attends to its bodily experience while sustaining heart-area attention, then explores deeper, finer, steadier and potentially stronger expression without forcing it. The exercise never substitutes a thought or a kind wish for the target feeling.

- Original lengths: 15/30/60/120/180 minutes. Additional short practices: 3/5/10 minutes.
- Original default breathing: 5 seconds in, 5 seconds out, continuously across the 33% and 66% teaching boundaries. Four seconds and natural breathing remain optional accommodations.
- Original 210px pacer, 128px circle, 0.8→1.55 linear scale and phase countdown.
- Three stages: heart-focused breathing; felt emotion plus heart attention; sustained deepening. Distinct inhale/exhale prompts remain.
- Original timed reminders at 400ms/4s/9s are explicitly labelled cues, never achievements or sensor readings.
- The child option selects a brief practice and natural breathing. Adult long-session availability is not a validated preschool dose.

**Map the feeling** restores all seven dimensions in their original order: location/edges; sensory quality; sensation intensity distinct from emotional intensity; movement; direction; agreement/conflict across sensation, image, action urge and emotional tone; pleasantness/approach/avoidance followed by tentative emotion naming.

- Original 15/30/60-minute lengths and 30-second rotation. Every dimension returns each round; the final round can be partial.
- Native question buttons allow rereading without resetting the clock or sounding a bell. Current, visited and reread states are distinct; automatic transitions clear the reread.
- Optional sensation-intensity and feeling-tone taps add reports without gating or shortening the rotation.
- A heart-session completion offers mapping the just-practised feeling. No sensor-derived state is claimed.

The reference HTML's unused `S2_PHASES` did not run its advertised calibration or fear-testing phases. This release does not make those false promises. It preserves the complete operational mapping loop and offers a separate working confidence/attention exercise.

## Additional experiments

**Compare two ways** preserves the working ABBA/BAAB design. Four 60-second rounds compare heart-focused breathing alone with the same breathing and chest focus plus the selected felt emotion. Initial prediction and subsequent ease reports are untimed. Both conditions receive equal time; the starting condition is randomized. Ratings, skips and interruptions remain visible, with no winner or causal claim. Breathing depth, carryover and expectations remain possible confounds.

**Check a body clue** retains the previously implemented eight-step attention/confidence protocol as a separate 8-minute option: find, describe, rate strength, rate certainty, attend outward, return and compare, consider alternative causes, choose an action. It supplements rather than replaces the seven-part map.

## Scientific teaching

Thirty expandable questions explain the full physiology, heart-focused imagery, emotion activation, positive-emotion distinctions, local cardiac neurons and pacemakers, rat oxytocin research, HRV and baroreflex resonance, neural studies, sincerity, telomere evidence, audio mechanisms, interoceptive channels, predictive processing, confidence, body maps, temporal activation, transfer and experimental design. Scientific claims have nearby source links. Stronger or longer feelings are not promised as better outcomes.

The exact exercises are experimental educational designs, not validated treatments. Subjective strength, clarity, certainty, consistency and emotion cannot be converted into objective accuracy or heart-rhythm coherence without appropriate measurement. Physiological findings remain distinct from personal experience and from claims about stored love in heart tissue.

## Runtime and sound

`practice.js` builds immutable owned plans and advances monotonic foreground time. `session.js` handles native controls, a 250ms clock, pausing, safe departure and truthful summaries. Hidden pages pause and require deliberate resumption. No answer consumes extra time in the core map; the comparison's explicit answer gates pause its clock.

`audio.js` preserves the original bowl partials, frequencies, filters, reverb, independent ambient pad, 60-second rate settling, delta/alpha carrier sets, per-option bell volumes and nonlinear boost above 100%. Quiet listening, zero volume, rejected audio startup, pause, End and restart are handled. The 3-second fade also fades slow gain modulation so it cannot leave an audible tail. Sound labels state frequency, not promised brain state.

All personal answers stay in page memory and are cleared on leaving the practice. There are no sensors, network submissions or persistent body records. CSP disallows connections.

## Verification

Run `npm test`. Tests cover complete plan lengths, continuous breathing, seven-part rotation, rereading, optional reports, comparison gates, stale callbacks, pause/hidden time, partial completion, cleanup, audio parameters and failure modes. Existing structure tests protect the front scene and renderer. Readability and exercise efficacy have not been validated in studies with children or expert users.
