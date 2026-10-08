import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const SCOPE = 'https://game.example/omega-factory/';
const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

/** Evaluates public/sw.js against minimal stubs of the service-worker globals. */
function loadWorker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cache = { put: vi.fn(async () => {}), addAll: vi.fn(async () => {}) };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => undefined),
    keys: vi.fn(async () => ['omega-factory-v1', 'omega-factory-v2']),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async () => ({ ok: true, type: 'basic', clone: () => ({}) }));
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type: string, handler: (event: unknown) => void) =>
      (handlers[type] = handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetch);
  const request = (path: string) => {
    const respondWith = vi.fn();
    handlers.fetch({ request: new Request(new URL(path, SCOPE)), respondWith });
    return respondWith;
  };
  return { handlers, caches, cache, fetch, request };
}

describe('service worker', () => {
  it('never intercepts or caches config.json, so offline flags fall back to off', async () => {
    const sw = loadWorker();
    for (const path of ['config.json', 'config.json?v=2'])
      expect(sw.request(path)).not.toHaveBeenCalled();
    expect(sw.fetch).not.toHaveBeenCalled();
    expect(sw.cache.put).not.toHaveBeenCalled();
  });

  it('still serves other in-scope files network-first with a cache copy', async () => {
    const sw = loadWorker();
    const respondWith = sw.request('index.html');
    expect(respondWith).toHaveBeenCalledOnce();
    await respondWith.mock.calls[0][0];
    await vi.waitFor(() => expect(sw.cache.put).toHaveBeenCalledOnce());
    expect(sw.request('api/wishes')).not.toHaveBeenCalled();
  });

  it('drops the previous cache version on activate (stale config.json copies go away)', async () => {
    const sw = loadWorker();
    let done: Promise<unknown> = Promise.resolve();
    sw.handlers.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(sw.caches.delete).toHaveBeenCalledWith('omega-factory-v1');
    expect(sw.caches.delete).not.toHaveBeenCalledWith('omega-factory-v2');
  });
});
