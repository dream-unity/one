import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUILD_TYPES = new Set(['legacy', 'workflow']);
const EVENTS = new Set(['push', 'workflow_run', 'workflow_dispatch']);

export function publisherMatches(eventName, buildType) {
  if (!EVENTS.has(eventName)) throw new Error('Unsupported Pages publication event. No deployment is permitted.');
  if (!BUILD_TYPES.has(buildType)) throw new Error('Unknown Pages source. No deployment is permitted.');
  return eventName === 'workflow_dispatch' ||
    eventName === 'push' && buildType === 'workflow' ||
    eventName === 'workflow_run' && buildType === 'legacy';
}

export async function selectPagesPublisher({ repository, token, eventName, expectedBuildType,
  fetcher = globalThis.fetch, timeoutMs = 10000 }) {
  if (!EVENTS.has(eventName)) throw new Error('Unsupported Pages publication event. No deployment is permitted.');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository || '') ||
      ['.', '..'].includes(repository.split('/')[1])) throw new Error('A valid GitHub repository is required.');
  if (typeof token !== 'string' || !token.trim()) throw new Error('A Pages read token is required.');
  if (expectedBuildType !== undefined && !BUILD_TYPES.has(expectedBuildType)) {
    throw new Error('Unknown expected Pages source. No deployment is permitted.');
  }
  let response, site;
  try {
    // Fixed origin and no redirects keep the read token on the authorized API.
    // This request observes source configuration; it never changes Pages settings.
    response = await fetcher(`https://api.github.com/repos/${repository}/pages`, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2026-03-10' },
    });
    if (response.status !== 200) throw new Error('Pages read was not successful.');
    site = await response.json();
  } catch {
    // Do not print response bodies or transport errors, which can contain credentials.
    throw new Error('Could not read the GitHub Pages source. No deployment is permitted.');
  }
  const buildType = site?.build_type;
  const deploy = publisherMatches(eventName, buildType);
  if (expectedBuildType !== undefined && (buildType !== expectedBuildType || !deploy)) {
    throw new Error('The Pages publisher changed during this run. No deployment is permitted; rerun the current publisher.');
  }
  return { buildType, deploy };
}

export async function runPagesPublisherSelection({ env = process.env, fetcher, writeOutput = appendFile } = {}) {
  if (!env.GITHUB_OUTPUT) throw new Error('The Pages selection output is unavailable.');
  const selection = await selectPagesPublisher({ repository: env.GITHUB_REPOSITORY, token: env.GH_TOKEN,
    eventName: env.GITHUB_EVENT_NAME, expectedBuildType: env.DREAMUNITY_EXPECTED_PAGES_BUILD_TYPE, fetcher });
  await writeOutput(env.GITHUB_OUTPUT, `deploy=${selection.deploy}\nbuild_type=${selection.buildType}\n`);
  return selection;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const selection = await runPagesPublisherSelection();
    console.log(`Pages source: ${selection.buildType}. This event ${selection.deploy ? 'may' : 'may not'} publish.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
