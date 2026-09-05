# Cognitive behavioural therapy (CBT)

The Model exercise at **Dream Machine → Mind → Model** is a guided, fictional CBT skills laboratory. The canonical route is `/exercises/cbt/`; the former exercise URL remains only as a redirect. The familiar picture story uses visible dots and boxes so the reasoning does not depend on adult technical knowledge.

## Experience

- Brief CBT introduction; 4-, 8- and 12-minute windows; eight minutes by default; self-paced option.
- One continuing case with a visible original fact and interpretation.
- Source attachment, scope selection, tap-to-construct maintenance loop and one or two working explanations.
- A prediction tied to the explanation actually constructed, plus a prospective condition for widening concern.
- Six actions with different observable consequences, limited to one optional follow-up.
- Conclusions and updates evaluated against **released evidence**, never unseen world state.
- Editing the original claim while preserving the original revision request.
- A working-copy operation: add or remove visible dots, preserve the required colour, apply a box-count rule, practise a second count when relevant, or prepare a question for a missing rule.
- Conditional stopping; relevant new information or an agreed review is a reason to return.
- 24 authored strategy-selection cases, two per twelve families, with different actions producing different consequences. Several cases admit more than one defensible route.
- Longer practice adds source-dependence and controlled-intervention comparisons.

The four-minute route is a focused prediction → action → result → update → next-step unit. It does not claim to assess independent transfer. Eight minutes contains the full connected sequence and one unfamiliar case. Twelve minutes adds contrasts and another case when time permits. These windows are design settings, not validated treatment doses.

## World and evidence contract

`engine.js` contains four worlds: local corrections, a documented broader skill concern, mixed external/skill causes, and unresolved information. The world is selected before entry, then remains fixed. Repeated sessions rotate through all four variants.

| Action | Available evidence |
| --- | --- |
| Inspect rubric | Available current criteria and specification record only |
| Inspect and clarify scope | Available criteria, history and reviewer response |
| General reassurance | A nondiagnostic invitation to discuss the work later |
| Cosmetic edit | The colour changed; relevant requirements remain untested |
| Accusatory question | An altered exchange that cannot establish the prior opinion |
| Scheduled review | A review plan; no fabricated future outcome |

A rubric-only action in the broader world establishes the dot-count criterion, not the unseen history. In the mixed world it establishes the two current corrections, not the unseen recurrence. Unresolved worlds remain unresolved after a clear question. Asking clearly never guarantees access to a person's private opinion.

The extra controlled comparison is explicitly authored, happens after the first action/update, and does not retroactively change the evidence used to score that attempt.

## Learning records

Attempts are append-only snapshots. First independent responses, repairs, demonstrations, cue retrieval and delayed application remain separate. Sequence reconstruction does not overwrite unfamiliar-case performance. Summary language distinguishes a completed cycle from an early finish and reports unassessed skills honestly.

The local selector favours unused cases and recently difficult skills, using different families in a session. After at least a day, a fresh case can revisit a previously attempted skill. The recall case is reserved so it cannot reappear as an allegedly unfamiliar case later in that session. Two successful independent attempts across distinct cases can shorten guidance for that skill; optional hints and evidence access remain available. These adaptation thresholds are pilot rules, not validated mastery cut-offs.

## Reading and interaction

Guidance uses short, concrete sentences. Navigation pairs a large plain action with the established area name. Source sorting and evidence judgments show one card at a time; a card picker lets the learner review any answer. Predictions have two short steps. Counters change visible pictures, and feedback distinguishes practice from a supplied answer. Longer cases still require source independence, uncertainty, causal comparisons and context-sensitive choices.

The silver, blue and violet palette follows the home screen. Exercise text is 18–20 px, supporting text at least 16 px, and primary touch controls at least 56 px. Reading ease and clinical suitability have not been established by testing with children.

## Timing and access

The active clock pauses in dialogs and when the page is hidden. Expiry asks the participant to extend, switch to self-paced practice or finish; it never submits an answer or reveals a result. Optional enrichment can be omitted near the end, but committed results, updates and actions are not silently skipped.

All construction has tap and keyboard controls. No dragging, typing, voice, camera, audio, autobiographical disclosure or motion is required. Controls have visible focus; the layout supports narrow touch screens and reduced-motion preferences. The case and source cards stay available during reasoning.

Progress defaults to memory for the current page only. Remembering progress is explicitly optional and uses the versioned `dreamunity:cbt:progress:v3` localStorage key. Persisted records contain skill, case ID, result, support mode and practice timestamp, not personal stories or raw responses. Storage failures do not block practice. There are no analytics, remote inference calls or network data submissions from the exercise. Normal static hosting still receives ordinary page requests.

## Evidence and scope

CBT includes behavioural action and practical problem-solving as well as examining interpretations. This exercise is skills practice, not a complete clinical treatment. Its effectiveness and everyday transfer have not been established.

Selected sources informing the design:

- [NICE NG222: depression treatment and management](https://www.nice.org.uk/guidance/ng222/chapter/recommendations) — CBT, behavioural activation and problem-solving in structured clinical care.
- [McManus et al., 2012](https://pubmed.ncbi.nlm.nih.gov/21819813/) — thought records and behavioural experiments, with limited direct comparison evidence.
- [Yilmaz et al., 2025](https://pubmed.ncbi.nlm.nih.gov/40753820/) — experiments did not significantly outperform verbal cognitive therapy on the primary post-treatment outcome in this small trial.
- [Pan & Rickard, 2018](https://pubmed.ncbi.nlm.nih.gov/29733621/) — qualified transfer benefits of retrieval practice in educational tasks.
- [Cepeda et al., 2006](https://pubmed.ncbi.nlm.nih.gov/16719566/) — spacing and intended retention interval.
- [Brunmair & Richter, 2019](https://pubmed.ncbi.nlm.nih.gov/31556629/) — interleaving depends on the material and discrimination task.
- [Simons et al., 2016](https://pubmed.ncbi.nlm.nih.gov/27697851/) — trained-task gains cannot establish everyday cognitive transfer.

Original combinations of these principles are design hypotheses. Clinical review, active-comparator studies and delayed unfamiliar-case evaluation would be needed before making stronger efficacy claims. No personal or clinical profile is inferred from mistakes or response time.

## Development

This is dependency-free browser JavaScript served directly by GitHub Pages. `index.html`, `styles.css`, `app.js`, `engine.js` and `scenarios.js` form the application. The parent navigation and 3D runtime remain separate.

Run the behavioral contract suite from the repository root:

```sh
node --test tests/cbt.test.mjs
```

The tests cover world/action evidence boundaries, committed forecasts, one-follow-up limits, selective updating, real working-copy values, transfer action/reason combinations, record preservation, unique delayed cases and protected completion.
