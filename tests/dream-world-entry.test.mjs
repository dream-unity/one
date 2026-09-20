import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const production = 'https://november-1st-sable.vercel.app/';
const script = await readFile(new URL('../dream-world/entry.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../dream-world/index.html', import.meta.url), 'utf8');
const navigationScript = await readFile(new URL('../portal-subnav.js', import.meta.url), 'utf8');

function openEntry(source, { missingLink = false, blockedNavigation = false } = {}) {
  const location = new URL(source);
  const link = { href: production };
  const status = { textContent: '' };
  const navigations = [];
  location.replace = destination => {
    navigations.push(destination);
    if (blockedNavigation) throw new Error('Navigation blocked by browser');
  };
  vm.runInNewContext(script, {
    URL,
    window: { location },
    document: {
      getElementById: id => id === 'open-world' ? (missingLink ? null : link) :
        id === 'entry-status' ? status : null,
    },
  });
  return { link, status, navigations };
}

test('Dream World entry opens the complete hosted application from root and project subpaths', () => {
  for (const base of ['https://dreamunity.example/dream-world/', 'https://dream-unity.github.io/one/dream-world/']) {
    const { link, navigations } = openEntry(base);
    assert.deepEqual(navigations, [production]);
    assert.equal(link.href, production);
  }
});

test('Dream World preserves exact feed, camera and target state without accepting another destination', () => {
  for (const suffix of [
    '?feed=cctv&country=AU&city=melbourne#camera=au-spotswood',
    '?feed=radio&query=ABC%20Melbourne&tag=a%2Bb&tag=a+b#target=%2F%3F%23',
    '?url=https%3A%2F%2Fevil.example&redirect=javascript%3Aalert(1)&return=//evil.example#//evil.example',
  ]) {
    const source = `https://dream-unity.github.io/one/dream-world/${suffix}`;
    const { link, navigations } = openEntry(source);
    assert.deepEqual(navigations, [`${production}${suffix}`]);
    assert.equal(link.href, `${production}${suffix}`);
    const target = new URL(navigations[0]);
    assert.equal(target.origin, new URL(production).origin);
    assert.equal(target.pathname, '/');
  }
});

test('automatic entry works without its fallback link and blocked navigation leaves a useful fallback', () => {
  const source = 'https://dream-unity.github.io/one/dream-world/?feed=radio#station';
  const expected = `${production}?feed=radio#station`;
  assert.deepEqual(openEntry(source, { missingLink: true }).navigations, [expected]);
  const blocked = openEntry(source, { blockedNavigation: true });
  assert.equal(blocked.link.href, expected);
  assert.ok(blocked.status.textContent.trim(), 'a blocked redirect must leave readable guidance');
});

test('the public entry provides a real link without scripts and does not embed a reduced application', () => {
  const fallback = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0])
    .find(anchor => /id="open-world"/.test(anchor));
  assert.ok(fallback, 'script-free users need a visible native entry link');
  assert.match(fallback, /href="https:\/\/november-1st-sable\.vercel\.app\/"/);
  assert.doesNotMatch(html, /<iframe\b|gods-eye-view-live\.vercel\.app/i);
  assert.match(html, /src="\.\/entry\.js(?:\?[^\"]*)?"/);
  assert.match(html, /href="\.\/entry\.css(?:\?[^\"]*)?"/);
});

function homeNavigation({ worldTag = 'A' } = {}) {
  const element = (tagName = 'DIV', world = '') => ({
    tagName, dataset: { world }, attributes: new Map(), listeners: new Map(),
    classList: { remove() {} },
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    querySelectorAll() { return []; },
    replaceChildren() {},
  });
  const world = element(worldTag, 'world');
  const machine = element('BUTTON', 'machine');
  const maker = element('BUTTON', 'maker');
  const ids = Object.fromEntries(['world-panel', 'world-title', 'world-steps', 'return-unity']
    .map(id => [id, element()]));
  const assignments = [];
  const listeners = new Map();
  const window = {
    location: {
      href: 'https://dream-unity.github.io/one/',
      assign(destination) { assignments.push(destination); },
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  vm.runInNewContext(navigationScript, {
    URL, window,
    document: {
      baseURI: window.location.href,
      body: { dataset: {} },
      getElementById: id => ids[id] || null,
      querySelector: () => world,
      querySelectorAll: () => [world, machine, maker],
    },
  });
  return { world, machine, maker, ids, assignments, listeners, window };
}

test('native Dream World links retain browser navigation and legacy hooks cannot unlock restricted portals', () => {
  const page = homeNavigation();
  assert.ok(!page.world.listeners.has('click'), 'normal and modified link clicks must remain native');
  assert.ok(!page.world.attributes.has('aria-expanded'), 'the link must not be exposed as a dialog button');
  assert.equal(page.ids['world-panel'].attributes.get('aria-hidden'), 'true');
  assert.equal(page.machine.disabled, true);
  assert.equal(page.maker.disabled, true);
  assert.deepEqual(page.assignments, [], 'loading the main screen must not open God’s Eye automatically');
  for (const key of ['machine', 'maker', 'https://other.example/']) {
    assert.equal(page.window.__DREAM_UNITY_DOMAIN_NAV__.render(key), false);
    page.listeners.get('dreamunity:worldfocus')({ detail: { key } });
  }
  assert.deepEqual(page.assignments, []);
  assert.equal(page.window.__DREAM_UNITY_DOMAIN_NAV__.render('world'), true);
  assert.deepEqual(page.assignments, ['https://dream-unity.github.io/one/dream-world/']);
});

test('older cached Dream World buttons reach the same permitted public entry', () => {
  const page = homeNavigation({ worldTag: 'BUTTON' });
  assert.equal(typeof page.world.listeners.get('click'), 'function');
  page.world.listeners.get('click')();
  assert.deepEqual(page.assignments, ['https://dream-unity.github.io/one/dream-world/']);
  assert.equal(page.ids['world-panel'].attributes.get('aria-hidden'), 'true');
});
