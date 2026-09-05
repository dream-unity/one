// Authored fictional transfer cases. Validity is judged only from the visible facts.
// Keep these rubric fields out of the choices shown before a learner commits.
export const TRANSFER_CASES = [
  {
    id: 'prototype-local', family: 'revised-prototype', title: 'One returned page',
    scene: 'Mina receives a booklet draft with one page returned. A note asks for a larger diagram. Mina puts the whole booklet aside, thinking every page must be unusable.',
    facts: ['Only page 4 is marked.', 'The note requests a larger diagram on page 4.', 'The other pages have not been evaluated.'],
    claim: 'Every page in this booklet is unusable.',
    options: [
      { id: 'a', label: 'Rewrite every page before asking for another review', effect: 'Mina starts replacing pages for which no problem has been identified.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Limit the conclusion to the marked diagram', effect: 'Mina keeps the specific correction and leaves the other pages unevaluated.', valid: true, reasonIds: ['r2'] },
      { id: 'c', label: 'Enlarge the marked diagram and request the next review', effect: 'Page 4 gets the requested change; the next review can assess what remains.', valid: true, reasonIds: ['r3'] },
      { id: 'd', label: 'Record the unmarked pages as approved', effect: 'The booklet receives an approval claim that the reviewer has not supplied.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'A problem on one page predicts the condition of all pages.' },
      { id: 'r2', text: 'The evidence identifies one diagram and leaves the other pages unevaluated.' },
      { id: 'r3', text: 'A specific correction is available without deciding the whole booklet’s quality.' },
      { id: 'r4', text: 'An unmarked page has already passed review.' }
    ],
    explanation: 'Narrowing the claim and making the known correction are both useful starting points. Neither requires treating the remaining pages as rejected or approved.',
    skill: 'scope', principle: 'Keep the finding within the evidence’s reach.'
  },
  {
    id: 'prototype-pattern', family: 'revised-prototype', title: 'The same scale error',
    scene: 'Jon’s new diagram uses the wrong scale. The review log shows the same error in two previous diagrams. Jon suggests treating the latest note as an isolated preference.',
    facts: ['Three dated reviews identify the same scale error.', 'All three diagrams use the same published scale rule.', 'A worked example and checking guide are available.'],
    claim: 'This is only a one-off reviewer preference.',
    options: [
      { id: 'a', label: 'Use the worked example, then check the current scale', effect: 'Jon practises the identified operation and checks the diagram against the rule.', valid: true, reasonIds: ['r1'] },
      { id: 'b', label: 'Discard the earlier reviews as irrelevant', effect: 'Two relevant instances disappear from Jon’s account without a reason.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Replace the claim with a recurring scale difficulty', effect: 'The account now includes the documented pattern without extending it to every skill.', valid: true, reasonIds: ['r3'] },
      { id: 'd', label: 'Conclude that no future diagram can meet the rule', effect: 'A recurring correctable error becomes a prediction that has not been tested.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'The recurring operation has an available practice and checking method.' },
      { id: 'r2', text: 'Repeated errors show that further practice cannot help.' },
      { id: 'r3', text: 'The same stated error appears across three dated tasks.' },
      { id: 'r4', text: 'Only the latest review can count as evidence.' }
    ],
    explanation: 'Broader evidence warrants a broader, still specific conclusion. Acknowledging the pattern or starting targeted practice is defensible; shrinking every concern would miss the actual problem.',
    skill: 'update', principle: 'Let a supported pattern remain visible.'
  },
  {
    id: 'reply-unknown', family: 'delayed-reply', title: 'The unanswered draft',
    scene: 'Lian sends a non-urgent draft at ten. At eleven there is no reply. The review agreement allows until tomorrow afternoon. Lian thinks the silence means the draft has been rejected.',
    facts: ['The agreed response window ends tomorrow at 3.', 'No reply or rejection has arrived.', 'There is no decision to make before that window ends.'],
    claim: 'The unanswered message means the draft was rejected.',
    options: [
      { id: 'a', label: 'Send the same question every ten minutes', effect: 'More messages accumulate without new information about the draft.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Mark the draft approved because nobody objected', effect: 'Silence is converted into an approval that has not been given.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Treat the rejection as final and delete the draft', effect: 'Lian removes work before receiving a decision.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Leave the decision open and review at the agreed time', effect: 'Lian keeps the draft and sets tomorrow at 3 as the next checking point.', valid: true, reasonIds: ['r2'] }
    ],
    reasons: [
      { id: 'r1', text: 'A delayed response reliably identifies a negative decision.' },
      { id: 'r2', text: 'The response window is still open and nothing requires an earlier decision.' },
      { id: 'r3', text: 'Waiting guarantees that the eventual response will be positive.' }
    ],
    explanation: 'No response yet leaves the outcome unresolved. The agreed window supplies a stopping point and a reason to return, without treating waiting as proof of either acceptance or rejection.',
    skill: 'uncertainty', principle: 'Leave unknowns open; define when to return.'
  },
  {
    id: 'reply-boundary', family: 'delayed-reply', title: 'A clear availability note',
    scene: 'Omar asks a volunteer to review a poster tonight. The volunteer replies that they cannot take on this review and will not be checking messages tonight. The poster can wait until Friday.',
    facts: ['The volunteer explicitly declined this review.', 'They are unavailable tonight.', 'A different reviewer is available tomorrow, before the deadline.'],
    claim: 'If Omar asks more gently tonight, this volunteer will probably review it.',
    options: [
      { id: 'a', label: 'Send a softer request to the same volunteer tonight', effect: 'The new request asks the volunteer to reverse an already stated limit.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Arrange tomorrow’s available review', effect: 'Omar moves the review to someone available within the deadline.', valid: true, reasonIds: ['r3'] },
      { id: 'c', label: 'Assume the volunteer has rejected every future request', effect: 'A limit on this review expands into an unsupported permanent conclusion.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Treat the decline as an ambiguous delayed response', effect: 'Omar overlooks information the volunteer has already communicated.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Every refusal is negotiable if the wording becomes more reassuring.' },
      { id: 'r2', text: 'Declining one review establishes permanent unavailability.' },
      { id: 'r3', text: 'The stated limit is clear and another workable route is available.' }
    ],
    explanation: 'The cause is not simply unknown here: an availability limit was communicated. Accept that information and choose a practical alternative without extending the refusal beyond its stated scope.',
    skill: 'action', principle: 'Respect clear limits and redirect the action.'
  },
  {
    id: 'attachment-practical', family: 'missing-attachment', title: 'The missing file',
    scene: 'Pia’s workshop registration is returned with a notice: “Please attach your signed permission form.” Pia has the completed file ready and wants the registration processed.',
    facts: ['The notice identifies one missing attachment.', 'Pia has the correct completed file.', 'The registration window is open.'],
    claim: 'No belief claim is needed here.',
    options: [
      { id: 'a', label: 'Attach the completed form and resubmit', effect: 'The submission now contains the identified missing item and returns to processing.', valid: true, reasonIds: ['r1'] },
      { id: 'b', label: 'Ask whether the office is disappointed in Pia', effect: 'The attachment remains missing while the question shifts away from processing.', valid: false, reasonIds: [] },
      { id: 'c', label: 'List alternative reasons the form might be missing', effect: 'Pia creates explanations without supplying the available required file.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Wait for approval without changing the submission', effect: 'The identified processing requirement remains unmet.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'The requirement and the available action are already clear.' },
      { id: 'r2', text: 'Every returned form requires examination of the sender’s beliefs.' },
      { id: 'r3', text: 'A missing attachment normally resolves without any change.' }
    ],
    explanation: 'This scene calls for completing a practical requirement. No unsupported personal interpretation has been supplied, so adding a belief exercise would create work that the situation does not require.',
    skill: 'action', principle: 'Fix a known requirement when that is enough.'
  },
  {
    id: 'attachment-added-claim', family: 'missing-attachment', title: 'A separate conclusion',
    scene: 'Theo attaches the missing page and the portal confirms the application is complete. The review has not started. Theo still concludes that the earlier omission means the application will be rejected.',
    facts: ['The missing page is now attached.', 'The portal confirms completeness only.', 'The application has not yet been reviewed.'],
    claim: 'The earlier omission means this application will be rejected.',
    options: [
      { id: 'a', label: 'Treat the completeness receipt as final acceptance', effect: 'Theo adds a positive decision that the receipt does not report.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Upload the same page repeatedly to reverse the omission', effect: 'Duplicate uploads do not provide evidence about the pending review.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Separate the repaired omission from the pending decision', effect: 'The account records a complete application and leaves the outcome unresolved.', valid: true, reasonIds: ['r2'] },
      { id: 'd', label: 'Withdraw before the presumed rejection arrives', effect: 'Theo ends the application based on a decision that has not been made.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Completeness and acceptance are the same decision.' },
      { id: 'r2', text: 'The receipt resolves the missing-page problem, not the review outcome.' },
      { id: 'r3', text: 'An initial omission fixes the outcome even after correction.' }
    ],
    explanation: 'The practical problem has been repaired, but an added prediction remains unsupported. Update each question separately: the application is complete; its eventual decision is still unknown.',
    skill: 'update', principle: 'A repair settles only what it actually changes.'
  },
  {
    id: 'rumour-one-origin', family: 'repeated-rumour', title: 'Three copies of one note',
    scene: 'Nia sees three group posts saying the community studio will close early. Each post includes the same cropped screenshot. The original notice has not been opened.',
    facts: ['All three posts copy one screenshot.', 'The cropped image hides the notice’s date.', 'The full studio notice is available to open.'],
    claim: 'Three separate sources confirm that the studio closes early today.',
    options: [
      { id: 'a', label: 'Count the posts as three independent confirmations', effect: 'One unverified source is counted three times.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Dismiss the closure because repeated posts never matter', effect: 'A possibly relevant original notice is ignored without inspection.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Ask a fourth person to forward the same screenshot', effect: 'Another copy adds no independent observation or missing date.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Open the original notice and check its date', effect: 'Nia can inspect the source and the date hidden by the copied crop.', valid: true, reasonIds: ['r3'] }
    ],
    reasons: [
      { id: 'r1', text: 'A claim becomes independent evidence each time someone repeats it.' },
      { id: 'r2', text: 'Copied information cannot contain anything accurate.' },
      { id: 'r3', text: 'The posts share one origin and omit information needed to apply it.' }
    ],
    explanation: 'Repeated copies are not independent observations. The original might still be accurate and relevant; checking its missing context is more useful than either multiplying or dismissing the copies.',
    skill: 'sources', principle: 'Trace the origin before counting the evidence.'
  },
  {
    id: 'rumour-independent', family: 'repeated-rumour', title: 'Two separate test runs',
    scene: 'A community printer smudges blue ink. Bea’s test at nine and Dev’s separate test at ten both show the issue. Their samples and run logs are available. No repair occurred between runs.',
    facts: ['The samples come from two separately logged print runs.', 'Both runs used the current blue cartridge and specified settings.', 'The job needs clean blue printing; another printer is available.'],
    claim: 'There is evidence that this printer’s current blue output has a problem.',
    options: [
      { id: 'a', label: 'Keep the concern and use the available printer for this job', effect: 'The job moves off the documented problem while the faulty printer awaits attention.', valid: true, reasonIds: ['r1'] },
      { id: 'b', label: 'Dismiss one result because it resembles the other', effect: 'A genuinely separate observation is discarded for having the same outcome.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Conclude that every printer in the studio is faulty', effect: 'The conclusion expands beyond the machine and setting that were tested.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Assume the next run will be clean without any change', effect: 'The needed job is assigned to output with an unresolved documented defect.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Two independent runs support a current, specific output concern.' },
      { id: 'r2', text: 'Similar results must always come from the same source.' },
      { id: 'r3', text: 'Two tests establish the condition of every printer.' }
    ],
    explanation: 'Similarity does not imply dependence. Here the distinct runs support retaining a bounded concern and choosing a practical alternative; they do not establish a fault in unrelated printers.',
    skill: 'sources', principle: 'Check independence; do not infer it from similarity.'
  },
  {
    id: 'feedback-question', family: 'short-feedback', title: '“Needs another pass”',
    scene: 'Ren’s tutor writes, “Needs another pass,” on a presentation outline. No section or criterion is marked. Ren wants to know whether the difficulty is structure, missing evidence, or both.',
    facts: ['The note does not identify the issue.', 'The tutor is available for one short question.', 'The outline has named sections that can be referenced.'],
    claim: 'The note probably means the outline’s structure is the problem.',
    options: [
      { id: 'a', label: 'Ask whether the tutor still thinks Ren can improve', effect: 'The question seeks general encouragement without distinguishing the possible issues.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Ask which section misses which criterion', effect: 'The question gives the tutor a way to identify the issue and its location.', valid: true, reasonIds: ['r2'] },
      { id: 'c', label: 'Replace the whole structure before identifying the issue', effect: 'Ren changes one possible cause while the actual feedback remains unspecified.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Count the short wording as proof of a structure problem', effect: 'The note’s length is used to answer a question its content leaves open.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Short feedback reveals which technical issue the writer intended.' },
      { id: 'r2', text: 'A criterion tied to a section can distinguish the possible problems.' },
      { id: 'r3', text: 'Encouragement is enough to identify which part needs revision.' }
    ],
    explanation: 'Choose a question whose possible answers would change the next revision. The length or warmth of a reply cannot substitute for information about the actual criterion.',
    skill: 'prediction', principle: 'Ask for information that separates possibilities.'
  },
  {
    id: 'feedback-kind-vague', family: 'short-feedback', title: 'A friendly reply',
    scene: 'Sasha asks whether a display meets the gallery’s mounting rules. The organiser replies, “Thanks for all the care you’ve put in!” The mounting sheet is available, but no measurements have been checked.',
    facts: ['The reply expresses appreciation.', 'It does not say whether the mounting rules are met.', 'The mounting sheet gives measurements Sasha can check.'],
    claim: 'The friendly reply confirms that the display meets the mounting rules.',
    options: [
      { id: 'a', label: 'Mark every mounting requirement as passed', effect: 'Unchecked measurements are recorded as if they had been inspected.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Treat the friendly wording as concealed criticism', effect: 'Sasha replaces one unsupported interpretation of the tone with another.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Check the display against the mounting sheet', effect: 'Sasha can compare the actual measurements with the published requirements.', valid: true, reasonIds: ['r1'] },
      { id: 'd', label: 'Ask explicitly whether any mounting requirements remain unmet', effect: 'The follow-up requests the compliance information that the first reply omitted.', valid: true, reasonIds: ['r3'] }
    ],
    reasons: [
      { id: 'r1', text: 'The available measurements directly address the unresolved requirement.' },
      { id: 'r2', text: 'Warm language is reliable technical approval.' },
      { id: 'r3', text: 'Appreciation and a compliance decision answer different questions.' },
      { id: 'r4', text: 'A reply that omits approval must mean disapproval.' }
    ],
    explanation: 'Appreciation can be sincere and still leave the technical question open. Either checking the stated criteria or requesting specific clarification can supply relevant information.',
    skill: 'sources', principle: 'Use what a message says, not what its tone promises.'
  },
  {
    id: 'first-step-available', family: 'difficult-first-step', title: 'The unopened slide file',
    scene: 'Ellis delays a short presentation because the final wording is uncertain. The topic and three required sections are already supplied. Opening a blank file brings some discomfort, but no further resources are needed.',
    facts: ['The topic and three section headings are known.', 'Headings can be added and changed without cost.', 'The complete wording is not needed to create the outline.'],
    claim: 'Ellis cannot begin until all the wording is settled.',
    options: [
      { id: 'a', label: 'Create three heading slides and inspect what remains', effect: 'The outline exists; missing wording becomes a smaller, visible next task.', valid: true, reasonIds: ['r2'] },
      { id: 'b', label: 'Wait until opening the file feels entirely comfortable', effect: 'No outline is created and the same unfinished task remains.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Plan the complete speech repeatedly without opening a file', effect: 'Ellis keeps rehearsing the unresolved whole rather than testing the available first step.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Promise that starting will remove all discomfort', effect: 'The plan gains an emotional guarantee that the available facts cannot support.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'A useful first step must make discomfort disappear immediately.' },
      { id: 'r2', text: 'A reversible step is available without solving the complete task.' },
      { id: 'r3', text: 'Uncertain wording makes every preparatory action impossible.' }
    ],
    explanation: 'A small action can reveal the next requirement while discomfort remains. The claim being tested is whether this outline can begin, not whether every later step will be easy.',
    skill: 'action', principle: 'Try the smallest available step and inspect its result.'
  },
  {
    id: 'first-step-blocked', family: 'difficult-first-step', title: 'The locked template',
    scene: 'Asha needs to add headings to a shared template. The file is locked, editing access is required, and the owner must approve it. The instructions forbid substituting a different file.',
    facts: ['Asha has viewing access only.', 'Only the owner can enable editing.', 'The task must be completed in this template.'],
    claim: 'The missing editing permission currently prevents this task from starting.',
    options: [
      { id: 'a', label: 'Keep attempting to type into the locked file', effect: 'The interface rejects the same action because the permission has not changed.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Replace the access problem with a claim about motivation', effect: 'The account loses the concrete dependency that is blocking the task.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Request editing access and resume when it is granted', effect: 'The owner receives the permission request and the task has a defined restart condition.', valid: true, reasonIds: ['r3'] },
      { id: 'd', label: 'Submit a different file as if it met the requirement', effect: 'A substitute is produced despite the stated requirement to use the shared template.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Any barrier can be removed by making the physical action smaller.' },
      { id: 'r2', text: 'A required tool can always be replaced without checking the instructions.' },
      { id: 'r3', text: 'The task depends on a permission that Asha cannot supply alone.' }
    ],
    explanation: 'The obstacle is a real dependency. An appropriate first action obtains the missing resource; asking Asha to overcome a belief would not unlock the file.',
    skill: 'action', principle: 'Check whether the next step has its required resources.'
  },
  {
    id: 'variable-noise', family: 'variable-task-result', title: 'One slower run',
    scene: 'Kai’s packing drill usually takes between four and six minutes with identical materials. Today it takes six. Kai concludes that the new packing method has stopped working.',
    facts: ['The last ten identical runs ranged from four to six minutes.', 'Today’s run took six minutes.', 'No change in materials or instructions is reported.'],
    claim: 'The method has stopped working.',
    options: [
      { id: 'a', label: 'Abandon the method because the latest run was slowest', effect: 'Kai discards the method on a result already inside its observed range.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Keep the method provisionally and compare the next scheduled runs', effect: 'Kai records today’s result and uses later comparable runs to assess a pattern.', valid: true, reasonIds: ['r1'] },
      { id: 'c', label: 'Delete today’s result so the method looks more reliable', effect: 'The record loses a valid observation that belongs in future comparisons.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Declare that the method can never become less effective', effect: 'A limited observation history becomes an unsupported permanent guarantee.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Today’s result fits the existing range and does not by itself establish a change.' },
      { id: 'r2', text: 'The most recent result always outweighs all earlier comparable runs.' },
      { id: 'r3', text: 'Variation should be removed from the record before drawing conclusions.' }
    ],
    explanation: 'Retain the observation without overreading it. A result within the previous range warrants neither immediate abandonment nor a guarantee of permanent reliability.',
    skill: 'update', principle: 'Compare a result with the variation already observed.'
  },
  {
    id: 'variable-condition-change', family: 'variable-task-result', title: 'A different-sized box',
    scene: 'Kai’s next packing job uses boxes twice as large. The old instructions leave gaps, and the supplier’s new sheet specifies an extra insert. Kai suggests ignoring this as ordinary variation.',
    facts: ['The box size has changed.', 'The new supplier sheet requires an extra insert.', 'The old method does not include that insert.'],
    claim: 'The old method applies unchanged because slow runs happened before.',
    options: [
      { id: 'a', label: 'Collect many more old-method runs before reading the new sheet', effect: 'Packing continues under instructions already missing a stated new requirement.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Discard every lesson from the earlier method', effect: 'Kai removes potentially useful steps along with the part that needs revision.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Call the missing insert a confidence problem', effect: 'The concrete packing requirement remains unaddressed.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Add the required insert and check one new-size box', effect: 'Kai updates the changed requirement and inspects the result under the new conditions.', valid: true, reasonIds: ['r2'] }
    ],
    reasons: [
      { id: 'r1', text: 'Past variation means later differences cannot reflect changed conditions.' },
      { id: 'r2', text: 'The relevant materials and published requirement have actually changed.' },
      { id: 'r3', text: 'Any change makes all prior task knowledge unusable.' }
    ],
    explanation: 'Known changes in conditions can justify prompt revision. Waiting for a long run of failures would ignore information already available about why the old method is incomplete.',
    skill: 'update', principle: 'Revise promptly when a relevant condition changes.'
  },
  {
    id: 'requirement-new', family: 'changed-requirement', title: 'A new upload limit',
    scene: 'A community exhibit now requires images under five megabytes. Yesterday’s written instructions allowed ten. Ivo’s eight-megabyte file followed yesterday’s rule and is rejected by today’s upload check.',
    facts: ['Yesterday’s saved instructions allow ten megabytes.', 'Today’s dated update reduces the limit to five.', 'Ivo’s file is eight megabytes and can be compressed.'],
    claim: 'This rejection proves Ivo ignored the instructions when preparing the file.',
    options: [
      { id: 'a', label: 'Record the changed limit and compress a copy for today’s upload', effect: 'The account preserves the rule change and the new copy targets the current limit.', valid: true, reasonIds: ['r3'] },
      { id: 'b', label: 'Insist yesterday’s limit must still govern today’s upload', effect: 'The unchanged file continues to miss the stated current requirement.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Treat the rejection as evidence that the dated update is false', effect: 'Ivo dismisses a relevant record without conflicting evidence.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Conclude that Ivo never follows any instructions', effect: 'A changed requirement becomes an unsupported general claim about past work.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'The result of today’s check reveals which rule existed yesterday.' },
      { id: 'r2', text: 'Following an earlier rule means a current requirement can be ignored.' },
      { id: 'r3', text: 'The file met the earlier size rule; the current rule requires a change.' }
    ],
    explanation: 'Separate the conditions at preparation from the conditions now. The earlier action matched its stated limit, while the file still needs adjustment to meet today’s requirement.',
    skill: 'scope', principle: 'Evaluate an action against the conditions at the time.'
  },
  {
    id: 'requirement-unchanged', family: 'changed-requirement', title: 'The same upload limit',
    scene: 'Sol’s eight-megabyte image is rejected. Sol thinks the exhibit must have changed its five-megabyte limit. Both the saved instructions from last week and today’s page specify five megabytes.',
    facts: ['Last week’s saved page states a five-megabyte limit.', 'Today’s page states the same limit.', 'Sol’s file is eight megabytes and can be compressed.'],
    claim: 'The organisers changed the size rule after Sol prepared the image.',
    options: [
      { id: 'a', label: 'Add an undocumented rule change to explain the rejection', effect: 'The explanation gains an exception unsupported by either dated record.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Correct the rule-change claim and compress a copy', effect: 'Sol keeps the documented rule and changes the file that currently exceeds it.', valid: true, reasonIds: ['r1'] },
      { id: 'c', label: 'Remove the saved instructions from the comparison', effect: 'Evidence relevant to the proposed rule change is discarded.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Conclude that all future uploads will be rejected', effect: 'One correctable size error becomes a prediction about every future file.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Both dated sources agree; the current file exceeds their stated limit.' },
      { id: 'r2', text: 'An explanation should be protected even when its predicted evidence is absent.' },
      { id: 'r3', text: 'One size error predicts every later upload’s outcome.' }
    ],
    explanation: 'A rule change is possible in some scenes, but these records do not support it. Revise the explanation and fix the specific mismatch rather than inventing a protecting exception.',
    skill: 'update', principle: 'Do not add an exception just to preserve a claim.'
  },
  {
    id: 'invitation-known-limit', family: 'missed-invitation', title: 'This workshop is full',
    scene: 'Mae does not receive a workshop place. The organiser confirms that places were allocated by booking time, the workshop is full, and Mae is on its waiting list. A second session opens next month.',
    facts: ['The organiser confirms no place is currently available for Mae.', 'The stated allocation rule is booking order.', 'The waiting list and next month’s session are available options.'],
    claim: 'Mae does not currently have a place in this workshop.',
    options: [
      { id: 'a', label: 'Replace the concern with certainty that a place is already reserved', effect: 'Mae’s plan relies on a reservation the organiser has explicitly not provided.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Treat this full session as exclusion from every future workshop', effect: 'The conclusion extends beyond this booking outcome.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Keep the current limit and choose a waiting-list or later-session plan', effect: 'Mae plans around the confirmed capacity limit while preserving the stated alternatives.', valid: true, reasonIds: ['r2'] },
      { id: 'd', label: 'Ask repeatedly whether the organiser truly means the session is full', effect: 'The same capacity question is repeated without a new fact or changed condition.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'An inconvenient fact should be replaced with a more encouraging belief.' },
      { id: 'r2', text: 'The current limit is confirmed, and the alternatives do not erase it.' },
      { id: 'r3', text: 'One booking outcome establishes access to every future session.' }
    ],
    explanation: 'Retain the accurate disappointment-relevant fact. A constructive next step can coexist with a real limitation; optimism is not evidence that the place already exists.',
    skill: 'action', principle: 'Keep the real limit and act within available options.'
  },
  {
    id: 'invitation-unresolved', family: 'missed-invitation', title: 'No email yet',
    scene: 'Jules has not received a craft-workshop email. One other applicant has. Messages are being sent in batches through Friday; it is Thursday. The booking page still lists Jules’s application as pending.',
    facts: ['The announced email window ends Friday.', 'Jules’s status is pending.', 'One other person has received a message.'],
    claim: 'Not receiving an email yet establishes that Jules was left out.',
    options: [
      { id: 'a', label: 'Cancel the application because the omission is confirmed', effect: 'Jules leaves the process while its recorded decision is still pending.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Record a guaranteed place because the status is pending', effect: 'An unresolved application becomes an unsupported acceptance.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Compare inboxes repeatedly until every applicant matches', effect: 'The comparisons do not resolve Jules’s pending decision during the announced window.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Leave the decision open and check after Friday’s window', effect: 'Jules preserves the application and sets a relevant time for a follow-up.', valid: true, reasonIds: ['r3'] }
    ],
    reasons: [
      { id: 'r1', text: 'A message to one applicant establishes the decision for every applicant.' },
      { id: 'r2', text: 'Pending status guarantees a positive outcome.' },
      { id: 'r3', text: 'The stated process is still running and Jules’s outcome is unresolved.' }
    ],
    explanation: 'This scene does not establish the exclusion confirmed in the full-workshop case. Keep both acceptance and rejection unresolved and use the published window to guide the next check.',
    skill: 'uncertainty', principle: 'An incomplete process is not a completed decision.'
  },
  {
    id: 'checking-complete', family: 'repeated-checking', title: 'The unchanged booking',
    scene: 'Em checks a room booking confirmation against the event plan: date, time and room all match. Nothing has changed. Em considers reopening the same confirmation again before beginning the display plan.',
    facts: ['The confirmation has just been checked against all three requirements.', 'No new message or change has arrived.', 'The display plan can begin from the confirmed booking.'],
    claim: 'Another reading of this unchanged confirmation is needed before planning can begin.',
    options: [
      { id: 'a', label: 'Start the display plan; recheck if a booking change arrives', effect: 'Em uses the completed check and defines what new information would reopen it.', valid: true, reasonIds: ['r1'] },
      { id: 'b', label: 'Repeat the same check until no doubt remains', effect: 'The same evidence is revisited without a defined new question or stopping rule.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Ignore all future booking messages because this check passed', effect: 'A useful current stopping point becomes a refusal to respond to possible changes.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Ask someone to repeat the same three details immediately', effect: 'The repeated information does not address any identified gap in the completed check.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'The defined check is complete; a new booking fact would justify reopening it.' },
      { id: 'r2', text: 'Planning requires the complete absence of uncertainty.' },
      { id: 'r3', text: 'Once a check passes, relevant later changes can be ignored.' }
    ],
    explanation: 'Stop because the relevant check is complete, not because certainty is perfect. A clear re-entry condition keeps stopping responsive to new evidence.',
    skill: 'stopping', principle: 'Complete the check; name what would reopen it.'
  },
  {
    id: 'checking-new-information', family: 'repeated-checking', title: 'A revised confirmation',
    scene: 'Em has already checked the room booking. A new email now arrives with the subject “Revised room allocation.” The event plan still shows the old room, and setup has not begun.',
    facts: ['A new allocation notice arrived after the earlier check.', 'The plan still uses the earlier room details.', 'Setup can still be adjusted before it begins.'],
    claim: 'Reopening the booking would be unnecessary because it has already been checked.',
    options: [
      { id: 'a', label: 'Keep the old plan without reading the new allocation', effect: 'The plan may rely on information superseded by the new notice.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Read the revised allocation and update only affected details', effect: 'Em compares the new notice with the plan before setup begins.', valid: true, reasonIds: ['r2'] },
      { id: 'c', label: 'Restart every event decision from the beginning', effect: 'Unrelated settled details are reopened without evidence that they changed.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Read only the earlier confirmation several more times', effect: 'Em reviews old evidence while the potentially changed allocation remains unread.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'A completed check makes all later checking unnecessary.' },
      { id: 'r2', text: 'New relevant information has met a reasonable condition for checking again.' },
      { id: 'r3', text: 'One changed detail means every earlier decision must be discarded.' }
    ],
    explanation: 'A new relevant notice changes the evidence state. Checking again is appropriate, while selectively updating prevents one change from reopening every unrelated decision.',
    skill: 'stopping', principle: 'Return when relevant evidence changes.'
  },
  {
    id: 'plan-false-comfort', family: 'overconfident-plan', title: 'An untested arrangement',
    scene: 'Alex plans a ten-minute equipment setup. It has never been timed, two necessary cables are missing, and the room opens only ten minutes before the session. Alex says enthusiasm will make it work.',
    facts: ['No full setup trial has been completed.', 'Two required cables are not yet available.', 'The current plan leaves no extra setup time.'],
    claim: 'The setup will certainly finish on time because Alex feels confident.',
    options: [
      { id: 'a', label: 'Increase the confidence estimate without changing the plan', effect: 'The untested timing and missing equipment remain unchanged.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Cancel all future use of the equipment', effect: 'A present planning gap becomes a permanent restriction without further assessment.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Obtain the cables, time a full setup, and revise the time plan', effect: 'Alex addresses the dependency and gathers timing evidence before committing to the schedule.', valid: true, reasonIds: ['r3'] },
      { id: 'd', label: 'Count a quick unpacking trial as proof that the complete setup fits', effect: 'A partial task is used to certify untested steps in the whole setup.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Feeling confident supplies the missing equipment and timing evidence.' },
      { id: 'r2', text: 'Completing one part establishes the duration of the entire setup.' },
      { id: 'r3', text: 'The plan depends on resources and a duration that have not been verified.' }
    ],
    explanation: 'Encouragement does not resolve missing dependencies. Test the actual task under relevant conditions, then let that evidence determine what timing or contingency changes are needed.',
    skill: 'prediction', principle: 'Check the conditions behind a confident forecast.'
  },
  {
    id: 'plan-supported-confidence', family: 'overconfident-plan', title: 'A rehearsed arrangement',
    scene: 'Alex has all the equipment and has completed five full setups in the same room, each within eight minutes. Twenty minutes are available, and a tested spare cable is packed. Nothing relevant has changed.',
    facts: ['Five complete comparable setups each took eight minutes or less.', 'The available window is twenty minutes.', 'Required equipment and a tested spare cable are present.'],
    claim: 'The setup is likely to fit within the available time, although it is not guaranteed.',
    options: [
      { id: 'a', label: 'Treat a successful setup as logically certain', effect: 'A well-supported forecast becomes a guarantee beyond the available evidence.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Restart the entire plan because confidence itself is suspect', effect: 'A supported plan is discarded without new conflicting information.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Repeat trials indefinitely before using the room', effect: 'Additional rehearsals replace action despite the existing evidence and time buffer.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Proceed with the tested plan and keep the spare available', effect: 'Alex acts on the relevant practice evidence while retaining a proportionate contingency.', valid: true, reasonIds: ['r1'] }
    ],
    reasons: [
      { id: 'r1', text: 'Comparable full trials and a time buffer support proceeding without a guarantee.' },
      { id: 'r2', text: 'Any confident forecast is evidence of a reasoning error.' },
      { id: 'r3', text: 'Repeated success removes every possibility of a later problem.' }
    ],
    explanation: 'Appropriate confidence can be earned. The facts support proceeding with a contingency; automatic doubt would be as unresponsive to the evidence as automatic optimism.',
    skill: 'prediction', principle: 'Allow confidence to reflect relevant evidence.'
  },
  {
    id: 'setback-repairable', family: 'repairable-setback', title: 'A returned entry',
    scene: 'A drawing-contest entry is returned because its caption is missing. The organisers explicitly allow resubmission until six. It is four, and the caption is ready. Dara predicts that nothing useful can happen after a returned entry.',
    facts: ['The entry was returned for a missing caption.', 'Resubmission is allowed until six.', 'The caption is ready and there are two hours remaining.'],
    claim: 'Once this entry has been returned, no useful next action remains.',
    options: [
      { id: 'a', label: 'Add the caption and resubmit within the allowed window', effect: 'Dara completes the identified repair and returns the entry for consideration.', valid: true, reasonIds: ['r2'] },
      { id: 'b', label: 'Record a guaranteed prize because resubmission is possible', effect: 'An available repair is converted into a prediction about an undecided competition result.', valid: false, reasonIds: [] },
      { id: 'c', label: 'Separate the actual return from the available repair', effect: 'Dara keeps the setback in the account and recognises that a permitted action remains.', valid: true, reasonIds: ['r3'] },
      { id: 'd', label: 'Wait until the resubmission window has closed', effect: 'The currently available repair route expires without being used.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'Being able to repair an entry predicts that it will win.' },
      { id: 'r2', text: 'The specific repair is ready and explicitly permitted before the deadline.' },
      { id: 'r3', text: 'A setback occurred, but the facts still identify a useful response.' },
      { id: 'r4', text: 'A returned submission permanently removes all later options.' }
    ],
    explanation: 'The return happened; it need not be denied. Both recognising the remaining option and taking it are justified. Completing the repair does not guarantee acceptance or a prize.',
    skill: 'action', principle: 'Separate what happened from what can happen next.'
  },
  {
    id: 'setback-outside-control', family: 'repairable-setback', title: 'The closed entry window',
    scene: 'Dara discovers the missing caption after the contest deadline. The published rule and organiser both confirm no late entries. Dara can save the completed drawing for a different open exhibition next week.',
    facts: ['This contest’s deadline has passed.', 'The rule and organiser confirm that late entries cannot be accepted.', 'Another exhibition is open and accepts this type of drawing.'],
    claim: 'A useful response can still restore Dara’s place in this contest.',
    options: [
      { id: 'a', label: 'Keep resubmitting until this contest accepts the file', effect: 'Repeated submissions do not change the confirmed closed-entry rule.', valid: false, reasonIds: [] },
      { id: 'b', label: 'Accept this closed window and prepare the other exhibition’s requirements', effect: 'Dara acknowledges that this contest is closed and begins preparing for the available exhibition.', valid: true, reasonIds: ['r1'] },
      { id: 'c', label: 'Call the missed contest an imaginary problem', effect: 'A real consequence is removed from the account instead of acknowledged.', valid: false, reasonIds: [] },
      { id: 'd', label: 'Conclude that the drawing cannot enter any exhibition', effect: 'One closed deadline is extended to an explicitly available alternative.', valid: false, reasonIds: [] }
    ],
    reasons: [
      { id: 'r1', text: 'This outcome cannot be reversed by the stated options, but a different opportunity remains.' },
      { id: 'r2', text: 'Having a coping plan means the original loss must be reversible.' },
      { id: 'r3', text: 'One missed deadline establishes that every other opportunity is closed.' }
    ],
    explanation: 'Useful coping does not undo every consequence. Preserve the real loss of this entry window while distinguishing it from the separate opportunity that remains available.',
    skill: 'scope', principle: 'A useful next move need not reverse the original outcome.'
  }
];
