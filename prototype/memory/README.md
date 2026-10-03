# Device-only constellation

`store.js` owns a single IndexedDB record. Every read, revision check, consent check and graph write occurs in one `readwrite` transaction. IndexedDB failures remain errors; there is no localStorage or session-memory persistence fallback. The optional persistence injection is for transactional tests only.

`createMemoryStore({ onChange, onRevoke })` returns:

- `load()` → a cloned dataset.
- `setConsent({ storageEnabled, conversationUseEnabled }, { consentEpoch, revision })` → the committed dataset. Sharing requires storage; turning storage off clears notes and edges.
- `commitProposal(proposal, { consentEpoch, revision, authorship })` → `{ dataset, record, before, duplicate, changed }`. Local authored saves use `authorship: 'user'` (the default). AI saves require an opaque exact-confirmation receipt issued only by the proposal controller.
- `deleteNode(id, { consentEpoch, revision, expectedRevision })` and `deleteEdge(...)` → the committed dataset. Node deletion removes incident edges in the same transaction.
- `clear({ consentEpoch, revision })` → a durable tombstone with storage and sharing off.
- `selectContext(ids)` → `{ consentEpoch, revision, records }`, at most six explicit node/edge records and 2,500 aggregate Unicode characters counting titles, note text and labels. It does not automatically include an edge's endpoint notes.
- `subscribe(listener)` → an unsubscribe function; `close()` releases the connection and broadcast channel.

`onChange(dataset, detail)` reports the authoritative local dataset. Broadcasts carry only schema version, revision and consent epoch; another tab must reread IndexedDB. `onRevoke({ pending: true, ... })` fires immediately when destructive action begins so the shell can cancel old replay, requests and pending proposals. A subsequent committed epoch callback is durable. **A pending callback is not proof of deletion:** display success only after the mutation promise resolves. A stale dataset/revision rejects rather than overwriting another tab's changes.

`createMemoryController({ store, onPendingChange })` keeps one volatile AI suggestion. `propose(proposal, { turnId, sharedIds, consentEpoch, revision, signal })` returns its exact review data. `confirm(proposalId, { turnId })` commits only that current proposal. `reject`, `invalidate` and `close` cancel confirmation-owned transactions even after `put` was queued. The shell must call `invalidate()` at new-turn, Stop, correction, navigation and conversation-clear boundaries, and pass the action's AbortSignal to `propose`. Targeted edits require currently shared record IDs and expected record revisions. Candidates are not persisted.

`mountMemoryView(container, { store, controller, proposalsContainer, onSelectionChange, onConfirmProposal })` renders accessible authored notes, edits, status choices, directed relationships, explicit context selection and exact AI before/after review. It returns `refresh`, `setProposal`, `getSelection` and `close`. The shell owns the separate storage/sharing/clear controls. `onConfirmProposal`, if provided, must execute the owned controller confirmation and return its actual result; it can then resolve the provider action continuation.

Bounds are 128 nodes (including archived notes) and 256 directed relationships. No raw audio, automatic biography extraction, conversation archive, exercise ingestion, personal state sent to Earth, or cloud memory sync is implemented.

Validation: `node --test tests/memory-prototype.test.mjs`. Tests cover transaction serialization, pre/post-transform cancellation, cross-tab tombstones, opaque confirmations, stable edits, referential integrity, both record bounds, Unicode context limits and native-adapter error classification through a controlled IDB event facade. Real browser IndexedDB/device verification remains an integration check.
