import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { publisherMatches, selectPagesPublisher, runPagesPublisherSelection } from '../scripts/select-pages-publisher.mjs';

const repository = 'dream-unity/one';
const token = 'test-read-token';
const success = buildType => async () => ({ status: 200, json: async () => ({ build_type: buildType }) });
const input = { repository, token, eventName: 'push' };

test('publication event and actual Pages source select exactly one automatic path', () => {
  for (const [eventName, legacy, workflow] of [
    ['push', false, true], ['workflow_run', true, false], ['workflow_dispatch', true, true],
  ]) {
    assert.equal(publisherMatches(eventName, 'legacy'), legacy);
    assert.equal(publisherMatches(eventName, 'workflow'), workflow);
  }
  for (const buildType of [undefined, null, '', 'unknown', 'WORKFLOW']) {
    assert.throws(() => publisherMatches('workflow_dispatch', buildType), /Unknown Pages source/);
  }
  assert.throws(() => publisherMatches('pull_request', 'workflow'), /Unsupported Pages publication event/);
});

test('selection performs one bounded read on the fixed GitHub API and never follows a redirect', async () => {
  let requests = 0;
  const selection = await selectPagesPublisher({ ...input, fetcher: async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.github.com/repos/dream-unity/one/pages');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.headers['X-GitHub-Api-Version'], '2026-03-10');
    assert.ok(options.signal instanceof AbortSignal);
    return { status: 200, json: async () => ({ build_type: 'workflow' }) };
  } });
  assert.equal(requests, 1);
  assert.deepEqual(selection, { buildType: 'workflow', deploy: true });
});

test('failed reads and unrecognized API responses cannot emit an admission output or disclose errors', async () => {
  const env = { GITHUB_REPOSITORY: repository, GH_TOKEN: token, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_OUTPUT: '/fake/output' };
  const failures = [
    async () => { throw new Error(`Transport included ${token}`); },
    async () => ({ status: 403, json: async () => ({ build_type: 'workflow' }) }),
    async () => ({ status: 404, json: async () => ({ build_type: 'legacy' }) }),
    async () => ({ status: 200, json: async () => { throw new Error(`Invalid JSON included ${token}`); } }),
    async () => ({ status: 200, json: async () => ({}) }),
    success('future-publisher'),
  ];
  for (const fetcher of failures) {
    let writes = 0;
    await assert.rejects(runPagesPublisherSelection({ env, fetcher, writeOutput: async () => { writes++; } }), error => {
      assert.match(error.message, /No deployment is permitted/);
      assert.ok(!error.message.includes(token));
      return true;
    });
    assert.equal(writes, 0);
  }
});

test('a stalled source read is aborted and cannot admit publication', async () => {
  // Keep the isolated test process alive while AbortSignal's unreferenced timer fires.
  const keepAlive = setTimeout(() => {}, 1000);
  let aborted = false;
  try {
    await assert.rejects(selectPagesPublisher({ ...input, timeoutMs: 5,
      fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
      }),
    }), /Could not read the GitHub Pages source\. No deployment is permitted\./);
    assert.equal(aborted, true);
  } finally { clearTimeout(keepAlive); }
});

test('known but inactive publishers emit false while manual runs support both source modes', async () => {
  for (const buildType of ['legacy', 'workflow']) {
    for (const eventName of ['push', 'workflow_run', 'workflow_dispatch']) {
      const writes = [];
      const selection = await runPagesPublisherSelection({
        env: { GITHUB_REPOSITORY: repository, GH_TOKEN: token, GITHUB_EVENT_NAME: eventName, GITHUB_OUTPUT: '/fake/output' },
        fetcher: success(buildType), writeOutput: async (...values) => writes.push(values),
      });
      assert.equal(selection.deploy, publisherMatches(eventName, buildType));
      assert.deepEqual(writes, [['/fake/output', `deploy=${selection.deploy}\nbuild_type=${buildType}\n`]]);
    }
  }
});

test('a changed or no-longer-admitted publisher fails the final source recheck', async () => {
  for (const [eventName, expectedBuildType, actual] of [
    ['workflow_run', 'legacy', 'workflow'], ['push', 'workflow', 'legacy'],
    ['workflow_dispatch', 'legacy', 'workflow'], ['push', 'legacy', 'legacy'],
  ]) {
    await assert.rejects(selectPagesPublisher({ ...input, eventName, expectedBuildType, fetcher: success(actual) }), /publisher changed/);
  }
  assert.deepEqual(await selectPagesPublisher({ ...input, expectedBuildType: 'workflow', fetcher: success('workflow') }),
    { buildType: 'workflow', deploy: true });
});

test('invalid event or repository inputs cannot redirect a read token or cause a request', async () => {
  for (const override of [
    { repository: 'dream-unity/../../other' }, { repository: 'https://other.example/repo' },
    { repository: 'dream-unity/..' }, { token: '' }, { eventName: 'pull_request_target' },
    { expectedBuildType: 'unexpected' },
  ]) {
    let calls = 0;
    await assert.rejects(selectPagesPublisher({ ...input, ...override, fetcher: async () => { calls++; } }));
    assert.equal(calls, 0);
  }
});

test('workflow selects a publisher after trusted revision admission and gates its deploy job', async () => {
  const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /workflow_run:[\s\S]*?types: \[completed\][\s\S]*?branches: \[main\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /preflight:[\s\S]*?permissions:\s*\n\s+contents: read\s*\n\s+pages: read/);
  assert.match(workflow, /deploy:\s*\n\s+needs: preflight\s*\n\s+if: needs\.preflight\.outputs\.deploy == 'true'/);
  assert.ok(workflow.indexOf('if (current !== selected)') < workflow.indexOf('name: Check out the admitted revision'));
  assert.ok(workflow.indexOf('name: Check out the admitted revision') < workflow.indexOf('id: publisher'));
  assert.match(workflow, /ref: \$\{\{ steps\.revision\.outputs\.source_commit \}\}\s*\n\s+persist-credentials: false/);
  assert.equal((workflow.match(/run: node scripts\/select-pages-publisher\.mjs/g) || []).length, 2);
  assert.match(workflow, /DREAMUNITY_EXPECTED_PAGES_BUILD_TYPE: \$\{\{ needs\.preflight\.outputs\.build_type \}\}/);
  assert.ok(workflow.indexOf('name: Recheck the active Pages publisher') < workflow.indexOf('name: Recheck the exact current revision'));
  assert.ok(workflow.indexOf('name: Recheck the exact current revision') < workflow.indexOf('uses: actions/deploy-pages@'));
  assert.match(workflow, /checkedOut !== selected \|\| current !== selected/);
  assert.match(workflow, /artifact_name: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
});
