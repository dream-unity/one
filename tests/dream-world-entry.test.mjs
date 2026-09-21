import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const production = 'https://november-1st-sable.vercel.app/';
const script = await readFile(new URL('../dream-world/entry.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../dream-world/gods-earth-view/index.html', import.meta.url), 'utf8');
const hubHtml = await readFile(new URL('../dream-world/index.html', import.meta.url), 'utf8');
const hubScript = await readFile(new URL('../dream-world/hub.js', import.meta.url), 'utf8');
const mindsHtml = await readFile(new URL('../dream-world/gods-minds-eye-view/index.html', import.meta.url), 'utf8');
const navigationScript = await readFile(new URL('../portal-subnav.js', import.meta.url), 'utf8');

function openEntry(source) {
  const location = new URL(source);
  const navigations = [];
  location.replace = destination => navigations.push(destination);
  location.assign = destination => navigations.push(destination);
  const events = new Map();
  let focused;
  const element = id => ({
    id, hidden: id === 'welcome-guide', href: production,
    attributes: new Map(), listeners: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    focus() { focused = id; },
    click() { this.listeners.get('click')?.(); },
  });
  const nodes = Object.fromEntries(['welcome-start', 'welcome-guide', 'new-user',
    'guide-back', 'guide-title', 'open-world', 'guide-continue', 'main'].map(id => [id, element(id)]));
  const window = { location, addEventListener(name, listener) { events.set(name, listener); } };
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, {
    get() { throw new Error('Stored preferences must not bypass welcome'); },
  });
  vm.runInNewContext(script, {
    URL, window,
    document: { getElementById: id => nodes[id], querySelector: () => nodes.main },
    setTimeout() { throw new Error('Entry must not schedule automatic navigation'); },
  });
  return { nodes, navigations, events, focused: () => focused };
}

test('opening or reopening God’s Earth View always waits at the two-choice welcome screen', () => {
  for (const base of ['https://dreamunity.example/dream-world/gods-earth-view/', 'https://dream-unity.github.io/one/dream-world/gods-earth-view/']) {
    const page = openEntry(base + '?welcome=0&returning=true');
    assert.deepEqual(page.navigations, []);
    assert.equal(page.nodes['welcome-start'].hidden, false);
    assert.equal(page.nodes['welcome-guide'].hidden, true);
    page.nodes['new-user'].click();
    page.events.get('pageshow')({ persisted: true });
    assert.equal(page.nodes['welcome-start'].hidden, false);
    assert.equal(page.nodes['welcome-guide'].hidden, true);
    assert.deepEqual(page.navigations, []);
  }
});

test('New User opens instructions; Back restores the choices without starting the app', () => {
  const page = openEntry('https://dreamunity.example/dream-world/gods-earth-view/');
  page.nodes['new-user'].click();
  assert.equal(page.nodes['welcome-start'].hidden, true);
  assert.equal(page.nodes['welcome-guide'].hidden, false);
  assert.equal(page.focused(), 'guide-title');
  assert.equal(page.nodes.main.attributes.get('aria-labelledby'), 'guide-title');
  page.nodes['guide-back'].click();
  assert.equal(page.nodes['welcome-start'].hidden, false);
  assert.equal(page.nodes['welcome-guide'].hidden, true);
  assert.equal(page.focused(), 'new-user');
  assert.equal(page.nodes.main.attributes.get('aria-labelledby'), 'welcome-title');
  assert.deepEqual(page.navigations, []);
});

test('both Continue links open the same full app, preserving exact state and a fixed destination', () => {
  for (const suffix of [
    '',
    '?feed=cctv&country=AU&city=melbourne#camera=au-spotswood',
    '?feed=radio&query=ABC%20Melbourne&tag=a%2Bb&tag=a+b#target=%2F%3F%23',
    '?url=https%3A%2F%2Fevil.example&redirect=javascript%3Aalert(1)&return=//evil.example#//evil.example',
  ]) {
    const page = openEntry(`https://dream-unity.github.io/one/dream-world/gods-earth-view/${suffix}`);
    for (const id of ['open-world', 'guide-continue']) {
      assert.equal(page.nodes[id].href, `${production}${suffix}`);
      assert.equal(new URL(page.nodes[id].href).origin, new URL(production).origin);
      assert.equal(page.nodes[id].listeners.has('click'), false, 'Continue must retain native link behavior');
    }
    assert.deepEqual(page.navigations, []);
  }
});

test('initial HTML exposes exactly New User and Continue with the guide hidden and no redirect', () => {
  const start = html.split('<section id="welcome-start">')[1].split('</section>')[0];
  const choices = [...start.matchAll(/<(button|a)\b[^>]*>([^<]+)<\/\1>/g)].map(match => match[2]);
  assert.deepEqual(choices, ['New User', 'Continue']);
  assert.match(html, /<section[^>]*id="welcome-guide"[^>]*hidden/);
  assert.doesNotMatch(html, /http-equiv="refresh"|<iframe\b/i);
  for (const id of ['open-world', 'guide-continue']) {
    assert.match(html, new RegExp(`<a[^>]*id="${id}"[^>]*href="https://november-1st-sable\\.vercel\\.app/"[^>]*>Continue</a>`));
  }
  assert.match(html, /src="\.\.\/entry\.js\?v=20260921-welcome"/);
  assert.match(html, /href="\.\.\/entry\.css\?v=20260921-welcome"/);
});

test('Dream World exposes both named native portals and Minds Eye has its own return route', () => {
  for (const [id, path, name] of [
    ['earth-portal', './gods-earth-view/', "God's Earth View"],
    ['minds-eye-portal', './gods-minds-eye-view/', "God's Minds Eye View"],
  ]) {
    const anchor = [...hubHtml.matchAll(/<a\b[^>]*>/g)].map(match => match[0])
      .find(tag => tag.includes(`id="${id}"`));
    assert.ok(anchor, `${name} must be a native link`);
    assert.ok(anchor.includes(`href="${path}"`), `${name} must retain the project subpath`);
    const titleId = anchor.match(/aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(titleId, `${name} must identify its visible title`);
    const title = [...hubHtml.matchAll(/<h[1-6]\b[^>]*id="([^"]+)"[^>]*>([^<]+)<\/h[1-6]>/g)]
      .find(match => match[1] === titleId)?.[2];
    assert.equal(title?.replaceAll('’', "'"), name);
  }
  assert.doesNotMatch(hubHtml, /http-equiv="refresh"|<iframe\b|id="welcome-start"/i);
  assert.match(mindsHtml.replaceAll('’', "'"), />God's Minds Eye View</);
  assert.match(mindsHtml, /Coming soon/i);
  assert.match(mindsHtml, /<a\b[^>]*href="\.\.\/"/);
  assert.doesNotMatch(mindsHtml, /november-1st-sable\.vercel\.app|http-equiv="refresh"|<iframe\b/i);
});

test('the hub preserves old Earth link state through the nested welcome without redirecting', () => {
  for (const base of ['https://dreamunity.example/dream-world/', 'https://dream-unity.github.io/one/dream-world/']) {
    for (const suffix of [
      '',
      '?feed=radio&query=ABC%20Melbourne&tag=a%2Bb&tag=a+b#target=%2F%3F%23',
      '?url=https%3A%2F%2Fevil.example&redirect=javascript%3Aalert(1)#//evil.example',
    ]) {
      const source = base + suffix;
      const location = new URL(source);
      const navigations = [];
      location.assign = destination => navigations.push(destination);
      location.replace = destination => navigations.push(destination);
      const links = Object.fromEntries([
        ['earth-portal', './gods-earth-view/'],
        ['minds-eye-portal', './gods-minds-eye-view/'],
      ].map(([id, path]) => [id, {
        href: new URL(path, base).href,
        listeners: new Map(),
        addEventListener(name, listener) { this.listeners.set(name, listener); },
      }]));
      const window = { location };
      vm.runInNewContext(hubScript, {
        URL, window, location,
        document: { baseURI: source, getElementById: id => links[id] },
        setTimeout() { throw new Error('The hub must not schedule automatic navigation'); },
      });
      const earth = new URL('./gods-earth-view/', base).href + suffix;
      assert.equal(links['earth-portal'].href, earth);
      assert.equal(links['minds-eye-portal'].href, new URL('./gods-minds-eye-view/', base).href);
      assert.deepEqual(navigations, []);
      assert.equal(window.location.href, source);
      for (const link of Object.values(links)) assert.equal(link.listeners.has('click'), false);
      const entry = openEntry(earth);
      assert.equal(entry.nodes['open-world'].href, production + suffix);
      assert.equal(entry.nodes['guide-continue'].href, production + suffix);
      assert.deepEqual(entry.navigations, []);
    }
  }
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
  assert.deepEqual(page.assignments, [], 'loading the main screen must not open God’s Earth automatically');
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
