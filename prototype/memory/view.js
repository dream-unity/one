import { NODE_KINDS, NODE_STATUSES, EDGE_RELATIONS, MEMORY_LIMITS } from './store.js';

const clone = value => structuredClone(value);
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, label = text) {
  const node = element('button', text); node.type = 'button'; node.setAttribute('aria-label', label); node.addEventListener('click', action); return node;
}
function expected(state) { return { consentEpoch: state.consentEpoch, revision: state.revision }; }
function sameIdentifiers(a, b) { return a.length === b.length && a.every((item, index) => item === b[index]); }

/** Accessible text is authoritative; any constellation geometry is only a view of these notes. */
export function mountMemoryView(container, { store, controller, proposalsContainer = container, onSelectionChange = () => {}, onConfirmProposal } = {}) {
  if (!container || !store || !controller) throw new TypeError('A container, memory store and proposal controller are required.');
  let state = null, selection = [], desiredSelection = [], pending = null, closed = false, busy = false, message = '', selectionGeneration = 0;
  let editorOpen = false, editing = null, editExpected = null;
  let draft = { kind: 'goal', title: '', text: '', status: 'active' };
  let relationDraft = { from: '', to: '', relation: 'relates_to', label: '' };
  let relationsOpen = false;
  let edgeEditing = null, edgeDraft = null, edgeExpected = null;
  const prefix = `memory-${globalThis.crypto.randomUUID()}`;
  const status = element('p', '', 'memory-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const content = element('div', undefined, 'memory-content');
  const review = element('section', undefined, 'proposal-card'); review.setAttribute('aria-label', 'Review an AI memory suggestion'); review.hidden = true;
  container.replaceChildren(status, content);
  proposalsContainer.append(review);

  function say(value) { message = value; status.textContent = value; }
  function focusContent(key = 'add-note') {
    const target = [...content.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === key) || content.querySelector('[data-focus-key="add-note"]');
    target?.focus();
  }
  function notifySelection(identifiers) {
    try { const result = onSelectionChange([...identifiers]); result?.catch?.(error => say(`Selected notes were not shared. ${error.message}`)); } catch (error) { say(`Selected notes were not shared. ${error.message}`); }
  }
  function field(form, title, key, input, value, target) {
    const label = element('label', title); input.id = `${prefix}-${key}`; label.htmlFor = input.id;
    input.dataset.focusKey = key; input.value = value;
    input.addEventListener('input', () => { target[key] = input.value; });
    form.append(label, input); return input;
  }
  function select(values) {
    const input = element('select');
    for (const value of values) { const option = element('option', value.replaceAll('_', ' ')); option.value = value; input.append(option); }
    return input;
  }
  async function run(operation, success, completion = 'Saved on this device.') {
    if (busy || closed) return;
    const initiatingKey = container.contains(document.activeElement) ? document.activeElement.dataset?.focusKey : null;
    busy = true; render();
    try {
      const result = await operation();
      if (closed) return;
      if (success) success(result); say(result?.duplicate ? 'That relationship already exists. Its saved label was kept.' : completion);
    } catch (error) {
      if (closed) return;
      say(`Not saved. ${error.message}`);
      if (['STALE_STATE', 'STALE_RECORD', 'RECORD_NOT_FOUND'].includes(error.code)) { try { state = await store.load(); } catch { /* Keep the honest original error. */ } }
    } finally {
      busy = false;
      if (!closed) {
        render();
        if (initiatingKey && document.activeElement === document.body) {
          focusContent(initiatingKey);
        }
      }
    }
  }
  function resetEditor() { editorOpen = false; editing = null; editExpected = null; draft = { kind: 'goal', title: '', text: '', status: 'active' }; }
  function edit(node) { editorOpen = true; editing = node.id; editExpected = { ...expected(state), expectedRevision: node.revision }; draft = { kind: node.kind, title: node.title, text: node.text, status: node.status }; render(); content.querySelector('[data-focus-key="title"]')?.focus(); }
  function updateStatus(node, next) {
    run(() => store.commitProposal({ operation: 'update_node', nodeId: node.id, expectedRevision: node.revision, kind: node.kind, title: node.title, text: node.text, status: next }, expected(state)));
  }
  async function choose(identifier, checked) {
    const next = checked ? [...desiredSelection.filter(value => value !== identifier), identifier] : desiredSelection.filter(value => value !== identifier);
    if (next.length > MEMORY_LIMITS.selected) { say('Select at most six notes or relationships.'); render(); return; }
    const requestGeneration = ++selectionGeneration;
    desiredSelection = next;
    try {
      await store.selectContext(next);
      if (closed || requestGeneration !== selectionGeneration || !state?.consent.conversationUseEnabled) return;
      selection = next; desiredSelection = [...next]; say('Only these selected saved records will be offered to the conversation.'); notifySelection(selection);
    } catch (error) { if (!closed && requestGeneration === selectionGeneration) { desiredSelection = [...selection]; say(error.message); } }
    if (!closed) render();
  }
  function shareCheckbox(identifier, description) {
    const label = element('label', undefined, 'memory-share');
    const input = element('input'); input.type = 'checkbox'; input.checked = desiredSelection.includes(identifier); input.disabled = busy || !state.consent.conversationUseEnabled;
    input.dataset.focusKey = `share-${identifier}`;
    input.setAttribute('aria-label', `Use ${description} in this conversation`);
    input.addEventListener('change', () => choose(identifier, input.checked));
    label.append(input, element('span', 'Use in this conversation')); return label;
  }
  function renderEditor() {
    if (!editorOpen) return;
    const form = element('form', undefined, 'memory-card memory-editor');
    form.append(element('h3', editing ? 'Edit this saved note' : 'A new note'));
    const kind = field(form, 'Kind', 'kind', select(NODE_KINDS), draft.kind, draft);
    const title = field(form, 'Title', 'title', element('input'), draft.title, draft); title.required = true;
    const note = field(form, 'Note', 'text', element('textarea'), draft.text, draft); note.required = true; note.rows = 5;
    form.append(element('p', 'Title: up to 120 characters. Note: up to 1,200 characters. Nothing is saved until you choose Save.'));
    if (editing) {
      field(form, 'Status', 'status', select(NODE_STATUSES), draft.status, draft);
      const original = state.nodes.find(node => node.id === editing);
      const stale = !original || original.revision !== editExpected.expectedRevision || state.revision !== editExpected.revision || state.consentEpoch !== editExpected.consentEpoch;
      if (stale) {
        form.append(element('p', 'Memory changed while you were editing. Your draft remains here; review the current saved version before replacing it.', 'memory-error'));
        if (original) form.append(button('Reload saved version', () => edit(original)));
      }
    }
    const actions = element('div', undefined, 'memory-actions');
    const save = element('button', editing ? 'Save changes' : 'Remember this note'); save.type = 'submit'; save.dataset.focusKey = 'save-note'; save.disabled = busy || !state.consent.storageEnabled;
    actions.append(save, button('Cancel editing', () => { const target = editing ? `edit-${editing}` : 'add-note'; resetEditor(); render(); focusContent(target); })); form.append(actions);
    for (const input of form.querySelectorAll('input, select, textarea')) input.disabled = busy;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const candidate = editing ? { operation: 'update_node', nodeId: editing, expectedRevision: editExpected.expectedRevision, ...clone(draft) } : { operation: 'create_node', kind: draft.kind, title: draft.title, text: draft.text };
      const binding = editing ? clone(editExpected) : expected(state);
      run(() => store.commitProposal(candidate, binding), resetEditor);
    });
    content.append(form);
  }
  function renderRelations() {
    if (state.nodes.length < 2) return;
    const details = element('details', undefined, 'memory-card memory-relations');
    details.open = relationsOpen; details.addEventListener('toggle', () => { if (details.isConnected) relationsOpen = details.open; });
    details.append(element('summary', 'Connect two saved notes'));
    const form = element('form');
    function options() { const input = element('select'); const empty = element('option', 'Choose a note'); empty.value = ''; input.append(empty); for (const note of state.nodes) { const option = element('option', note.title); option.value = note.id; input.append(option); } return input; }
    field(form, 'From', 'from', options(), relationDraft.from, relationDraft);
    field(form, 'To', 'to', options(), relationDraft.to, relationDraft);
    field(form, 'Relationship', 'relation', select(EDGE_RELATIONS), relationDraft.relation, relationDraft);
    const label = field(form, 'Optional label', 'label', element('input'), relationDraft.label, relationDraft);
    label.setAttribute('aria-describedby', `${prefix}-label-limit`);
    const limit = element('p', 'Up to 240 characters. The direction and relation are explicit; they do not measure you.'); limit.id = `${prefix}-label-limit`; form.append(limit);
    const submit = element('button', 'Save this relationship'); submit.type = 'submit'; submit.dataset.focusKey = 'save-new-edge'; submit.disabled = busy; form.append(submit);
    form.addEventListener('submit', event => {
      event.preventDefault(); const from = state.nodes.find(node => node.id === relationDraft.from), to = state.nodes.find(node => node.id === relationDraft.to);
      if (!from || !to) { say('Choose both saved notes first.'); return; }
      const candidate = { operation: 'create_edge', from: from.id, fromRevision: from.revision, to: to.id, toRevision: to.revision, relation: relationDraft.relation, label: relationDraft.label };
      run(() => store.commitProposal(candidate, expected(state)), () => { relationDraft = { from: '', to: '', relation: 'relates_to', label: '' }; });
    });
    details.append(form); content.append(details);
  }
  function render() {
    if (closed) return;
    const active = document.activeElement;
    const focusKey = container.contains(active) ? active.dataset?.focusKey : null;
    const caret = focusKey && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    content.replaceChildren(); status.textContent = message;
    if (!state) { content.append(element('p', 'Loading saved notes…')); return; }
    if (!state.consent.storageEnabled) { content.append(element('p', 'Saved notes are optional. Choose Remember on this device to begin.')); return; }
    const add = button(editorOpen && !editing ? 'New note form is open' : 'Add a note', () => { if (editorOpen && !editing) { content.querySelector('[data-focus-key="title"]')?.focus(); return; } resetEditor(); editorOpen = true; render(); content.querySelector('[data-focus-key="title"]')?.focus(); }); add.dataset.focusKey = 'add-note'; add.disabled = busy; content.append(add);
    renderEditor();
    if (!state.nodes.length) content.append(element('p', 'No notes are saved yet. A goal, question or possibility can begin here.'));
    for (const node of state.nodes) {
      const card = element('article', undefined, 'memory-card'); card.append(element('h3', node.title), element('p', `${node.kind} · ${node.status}`, 'memory-meta'), element('p', node.text));
      card.append(shareCheckbox(node.id, node.title));
      const actions = element('div', undefined, 'memory-actions');
      const editButton = button('Edit', () => edit(node), `Edit ${node.title}`); editButton.dataset.focusKey = `edit-${node.id}`; editButton.disabled = busy; actions.append(editButton);
      if (node.status !== 'paused') { const pause = button('Pause', () => updateStatus(node, 'paused'), `Pause ${node.title}`); pause.dataset.focusKey = `pause-${node.id}`; pause.disabled = busy; actions.append(pause); }
      if (node.status !== 'archived') { const archive = button('Archive', () => updateStatus(node, 'archived'), `Archive ${node.title}`); archive.dataset.focusKey = `archive-${node.id}`; archive.disabled = busy; actions.append(archive); }
      if (node.status !== 'active') { const resume = button('Make active', () => updateStatus(node, 'active'), `Make ${node.title} active`); resume.dataset.focusKey = `resume-${node.id}`; resume.disabled = busy; actions.append(resume); }
      const remove = button('Delete', () => {
        const binding = { ...expected(state), expectedRevision: node.revision };
        const confirmation = element('div', undefined, 'memory-delete-review'); confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', `Confirm deleting ${node.title}`);
        const confirm = button('Delete this note', () => run(() => store.deleteNode(node.id, binding), () => { if (editing === node.id) resetEditor(); }, 'Deleted this note and its connected relationships from this device.'));
        // The review itself disappears on render; recover to its owning control on failure.
        confirm.dataset.focusKey = `delete-${node.id}`;
        confirmation.append(element('p', `Delete “${node.title}” and its connected relationships from this device?`), confirm, button('Keep it', () => { confirmation.remove(); focusContent(`delete-${node.id}`); }));
        card.append(confirmation); confirmation.querySelector('button')?.focus();
      }, `Review deleting ${node.title}`); remove.dataset.focusKey = `delete-${node.id}`; remove.disabled = busy; actions.append(remove); card.append(actions); content.append(card);
    }
    renderRelations();
    for (const edge of state.edges) {
      const from = state.nodes.find(node => node.id === edge.from), to = state.nodes.find(node => node.id === edge.to);
      const card = element('article', undefined, 'memory-card memory-edge'); const description = `${from.title} ${edge.relation.replaceAll('_', ' ')} ${to.title}`;
      card.append(element('h3', description), element('p', edge.label || 'No additional label'), shareCheckbox(edge.id, description));
      const editEdge = button('Edit relationship', () => {
        edgeEditing = edge.id; edgeDraft = { relation: edge.relation, label: edge.label }; edgeExpected = { ...expected(state), expectedRevision: edge.revision }; render(); content.querySelector('[data-focus-key="edge-relation"]')?.focus();
      }, `Edit the relationship from ${from.title} to ${to.title}`); editEdge.dataset.focusKey = `edit-edge-${edge.id}`; editEdge.disabled = busy;
      if (edgeEditing === edge.id) {
        const form = element('form', undefined, 'memory-edge-editor');
        const relation = select(EDGE_RELATIONS); relation.value = edgeDraft.relation; relation.dataset.focusKey = 'edge-relation'; relation.id = `${prefix}-edge-relation`;
        const relationLabel = element('label', 'Relationship'); relationLabel.htmlFor = relation.id; relation.addEventListener('input', () => { edgeDraft.relation = relation.value; }); form.append(relationLabel, relation);
        const label = element('input'); label.value = edgeDraft.label; label.id = `${prefix}-edge-label`; label.dataset.focusKey = 'edge-label';
        const labelText = element('label', 'Optional label'); labelText.htmlFor = label.id; label.addEventListener('input', () => { edgeDraft.label = label.value; }); form.append(labelText, label);
        if (edgeExpected.revision !== state.revision || edgeExpected.consentEpoch !== state.consentEpoch || edgeExpected.expectedRevision !== edge.revision) {
          form.append(element('p', 'Memory changed. Your relationship draft remains here; reload the saved version before replacing it.', 'memory-error'), button('Reload saved relationship', () => { edgeDraft = { relation: edge.relation, label: edge.label }; edgeExpected = { ...expected(state), expectedRevision: edge.revision }; render(); }));
        }
        const submit = element('button', 'Save relationship changes'); submit.type = 'submit'; submit.dataset.focusKey = 'save-edge'; submit.disabled = busy; form.append(submit, button('Cancel', () => { edgeEditing = null; edgeDraft = null; edgeExpected = null; render(); focusContent(`edit-edge-${edge.id}`); }));
        relation.disabled = busy; label.disabled = busy;
        form.addEventListener('submit', event => { event.preventDefault(); const candidate = { operation: 'update_edge', edgeId: edge.id, expectedRevision: edgeExpected.expectedRevision, ...clone(edgeDraft) }, binding = clone(edgeExpected); run(() => store.commitProposal(candidate, binding), () => { edgeEditing = null; edgeDraft = null; edgeExpected = null; }); });
        card.append(form);
      }
      const remove = button('Delete relationship', () => {
        const binding = { ...expected(state), expectedRevision: edge.revision };
        const confirmation = element('div'); confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', `Confirm deleting the relationship from ${from.title} to ${to.title}`);
        const confirm = button('Delete this relationship', () => run(() => store.deleteEdge(edge.id, binding), null, 'Deleted this relationship from this device. The notes remain.')); confirm.dataset.focusKey = `delete-edge-${edge.id}`;
        confirmation.append(element('p', 'Delete this relationship from the device? The notes remain.'), confirm, button('Keep it', () => { confirmation.remove(); focusContent(`delete-edge-${edge.id}`); })); card.append(confirmation); confirmation.querySelector('button')?.focus();
      }, `Review deleting the relationship from ${from.title} to ${to.title}`); remove.dataset.focusKey = `delete-edge-${edge.id}`; remove.disabled = busy; card.append(editEdge, remove); content.append(card);
    }
    if (focusKey) { const target = [...content.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focusKey) || content.querySelector('[data-focus-key="add-note"]'); target?.focus(); if (caret && target?.setSelectionRange) { try { target.setSelectionRange(...caret); } catch { /* Select elements do not have a caret. */ } } }
  }
  function renderProposal() {
    const active = document.activeElement;
    const focusedProposal = review.contains(active);
    const focusKey = focusedProposal ? active.dataset?.focusKey : null;
    review.replaceChildren(); review.hidden = !pending;
    if (!pending) { if (focusedProposal) focusContent(); return; }
    const exact = pending;
    review.append(element('h3', 'Review before remembering'), element('p', 'This AI suggestion is not saved. Confirm only if the exact change expresses what you want.'));
    function recordText(record) {
      if (!record) return 'Nothing is saved for this suggestion yet.';
      if (record.kind) return `Kind: ${record.kind}\nTitle: ${record.title}\nNote: ${record.text}\nStatus: ${record.status || 'active'}`;
      const from = record.from || exact.before?.from, to = record.to || exact.before?.to;
      return `From: ${state?.nodes.find(node => node.id === from)?.title || from}\nTo: ${state?.nodes.find(node => node.id === to)?.title || to}\nRelationship: ${record.relation}\nLabel: ${record.label}`;
    }
    review.append(element('h4', 'Before'), element('pre', recordText(exact.before), 'memory-review-text'), element('h4', exact.duplicate ? 'After: unchanged existing relationship' : 'After'), element('pre', recordText(exact.duplicate ? exact.before : exact.after), 'memory-review-text'));
    if (exact.duplicate) review.append(element('p', 'This directed relationship already exists. Confirmation keeps its saved identity and label; the proposed label will not overwrite it.'));
    const confirm = button(exact.duplicate ? 'Keep existing relationship' : 'Confirm this exact change', async () => {
      if (busy || pending?.proposalId !== exact.proposalId) return;
      busy = true; confirm.disabled = true;
      try {
        const result = await (onConfirmProposal ? onConfirmProposal(clone(exact)) : controller.confirm(exact.proposalId, { turnId: exact.turnId }));
        if (!closed) say(result?.duplicate ? 'Existing relationship kept.' : result?.dataset && result?.record ? 'Confirmed and saved on this device.' : 'Confirmation handled. Check the saved notes for the result.');
      } catch (error) { if (!closed) say(`Not saved. ${error.message}`); }
      finally { busy = false; if (!closed) { render(); renderProposal(); } }
    });
    confirm.disabled = busy; confirm.dataset.focusKey = 'confirm-proposal';
    const decline = button('Decline this suggestion', () => controller.reject(exact.proposalId)); decline.dataset.focusKey = 'decline-proposal';
    review.append(confirm, decline);
    if (focusKey) [...review.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focusKey)?.focus();
  }
  function acceptState(next) {
    state = clone(next); const validIds = new Set([...state.nodes, ...state.edges].map(record => record.id));
    const nextSelection = state.consent.conversationUseEnabled ? selection.filter(identifier => validIds.has(identifier)) : [];
    desiredSelection = state.consent.conversationUseEnabled ? desiredSelection.filter(identifier => validIds.has(identifier)) : [];
    if (!sameIdentifiers(selection, nextSelection)) { selectionGeneration++; selection = nextSelection; notifySelection(selection); }
    render(); renderProposal();
  }
  const unsubscribe = store.subscribe(acceptState);
  const api = {
    async refresh() { try { const next = await store.load(); if (!closed) acceptState(next); return next; } catch (error) { if (!closed) { say(`Saved notes are unavailable. ${error.message}`); content.replaceChildren(element('p', 'Nothing was saved or restored.')); } throw error; } },
    setProposal(value) { pending = value ? clone(value) : null; renderProposal(); },
    getSelection() { return [...selection]; },
    close() { closed = true; selectionGeneration++; unsubscribe(); review.remove(); container.replaceChildren(); }
  };
  render(); api.refresh().catch(() => {});
  return Object.freeze(api);
}
