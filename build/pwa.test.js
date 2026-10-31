import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { pwa } from './pwa.js';

function generate(content = 'application code') {
  let output;
  pwa().generateBundle.call({ emitFile(file) { output = file; } }, {}, {
    'index.html': { source: '<!doctype html><div id="root"></div>' },
    'assets/app-hash.js': { code: content },
    'assets/app-hash.css': { source: 'body{margin:0}' }
  });
  return output.source;
}
test('cache version changes with built content and includes hashed bundles', () => {
  const first = generate();
  assert.notEqual(first, generate('updated application code'));
  assert.match(first, /assets\/app-hash\.js/);
  assert.match(first, /manifest\.webmanifest/);
  assert.equal(first.includes('__APP_FILES__'), false);
});
for (const scope of ['https://example.com/', 'https://example.com/transport/']) {
  test(`offline production shell at ${scope} excludes private traffic`, async () => {
    const events = {};
    const stores = new Map();
    let offline = false;
    const prefix = 'all-transport-' + scope + '::';
    stores.set(prefix + 'v1', new Map());
    stores.set('another-app', new Map());
    stores.set('all-transport-' + scope + 'other/::v1', new Map());
    const caches = {
      async open(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return {
          async addAll(urls) { for (const url of urls) store.set(url, url.endsWith('index.html') ? '<!doctype html>' : 'cached-static-asset'); },
          async match(request) { return store.get(request.url || request); }
        };
      },
      async keys() { return [...stores.keys()]; },
      async delete(name) { return stores.delete(name); }
    };
    vm.runInNewContext(generate(), {
      URL, caches,
      self: { registration: { scope }, location: new URL(scope), clients: { async claim() {} }, addEventListener(name, handler) { events[name] = handler; } },
      async fetch() { if (offline) throw new Error('offline'); return 'network'; }
    });
    for (const name of ['install', 'activate']) {
      let pending;
      events[name]({ waitUntil(promise) { pending = promise; } });
      await pending;
    }
    async function fetchEvent(url, mode = 'cors', method = 'GET') {
      let pending;
      events.fetch({ request: { url, mode, method }, respondWith(promise) { pending = promise; } });
      return pending;
    }
    assert.equal(await fetchEvent(scope, 'navigate'), 'network');
    offline = true;
    assert.equal(await fetchEvent(scope, 'navigate'), '<!doctype html>');
    assert.equal(await fetchEvent(scope + '?recovery=1', 'navigate'), '<!doctype html>');
    assert.equal(await fetchEvent(scope + 'assets/app-hash.js'), 'cached-static-asset');
    for (const path of ['api/v1/me', 'api/v1/me/saved-routes', 'api/v1/buses']) {
      assert.equal(await fetchEvent(scope + path), undefined);
      assert.equal(await fetchEvent(scope + path, 'navigate'), undefined);
    }
    assert.equal(await fetchEvent('https://project.supabase.co/auth/v1/user'), undefined);
    assert.equal(await fetchEvent(scope, 'navigate', 'POST'), undefined);
    assert.equal(stores.has(prefix + 'v1'), false);
    assert.equal(stores.has('another-app'), true);
    assert.equal(stores.has('all-transport-' + scope + 'other/::v1'), true);
  });
}
