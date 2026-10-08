import { describe, expect, it, vi } from 'vitest';
import { ALL_OFF, devOverrides, loadFeatures } from './features';

const respond = (body: unknown, status = 200) =>
  vi.fn(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );

describe('loadFeatures', () => {
  it('reads config.json relative to the app base without caching', async () => {
    const fetcher = respond({ features: { wishes: true } });
    expect(await loadFeatures(fetcher, {})).toEqual({ ...ALL_OFF, wishes: true });
    expect(fetcher).toHaveBeenCalledWith('./config.json', { cache: 'no-store' });
  });

  it('reads maximizeOnLaunch independently, default off', async () => {
    expect(await loadFeatures(respond({ features: { maximizeOnLaunch: true } }), {})).toEqual({
      wishes: false,
      maximizeOnLaunch: true,
    });
    expect(await loadFeatures(respond({ features: { maximizeOnLaunch: 'true' } }), {})).toEqual(
      ALL_OFF,
    );
    expect(await loadFeatures(respond('Not found', 404), {})).toEqual(ALL_OFF);
  });

  it('is off when config.json says so or omits the feature', async () => {
    expect(await loadFeatures(respond({ features: { wishes: false } }), {})).toEqual(ALL_OFF);
    expect(await loadFeatures(respond({}), {})).toEqual(ALL_OFF);
    expect(await loadFeatures(respond({ features: null }), {})).toEqual(ALL_OFF);
    expect(await loadFeatures(respond(null), {})).toEqual(ALL_OFF);
  });

  it('only enables on a literal true', async () => {
    for (const wishes of ['true', 1, 'yes', {}, [true]])
      expect(await loadFeatures(respond({ features: { wishes } }), {})).toEqual(ALL_OFF);
  });

  it('is off on 404, server errors, invalid JSON and network failures (e.g. offline)', async () => {
    expect(await loadFeatures(respond('Not found', 404), {})).toEqual(ALL_OFF);
    expect(await loadFeatures(respond({ features: { wishes: true } }, 500), {})).toEqual(ALL_OFF);
    expect(await loadFeatures(respond('<html>oops</html>'), {})).toEqual(ALL_OFF);
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await loadFeatures(offline, {})).toEqual(ALL_OFF);
  });

  it('applies dev overrides on top of the runtime file', async () => {
    expect(await loadFeatures(respond({ features: { wishes: false } }), { wishes: true })).toEqual({
      ...ALL_OFF,
      wishes: true,
    });
    expect(await loadFeatures(respond({ features: { wishes: true } }), { wishes: false })).toEqual(
      ALL_OFF,
    );
  });
});

describe('devOverrides', () => {
  it('honours VITE_FEATURE_WISHES=1|0 only on the dev server', () => {
    expect(devOverrides({ DEV: true, VITE_FEATURE_WISHES: '1' })).toEqual({ wishes: true });
    expect(devOverrides({ DEV: true, VITE_FEATURE_WISHES: '0' })).toEqual({ wishes: false });
    expect(devOverrides({ DEV: true, VITE_FEATURE_WISHES: 'true' })).toEqual({});
    expect(devOverrides({ DEV: true })).toEqual({});
  });

  it('honours VITE_FEATURE_MAXIMIZE_ON_LAUNCH the same way', () => {
    expect(devOverrides({ DEV: true, VITE_FEATURE_MAXIMIZE_ON_LAUNCH: '1' })).toEqual({
      maximizeOnLaunch: true,
    });
    expect(devOverrides({ DEV: false, VITE_FEATURE_MAXIMIZE_ON_LAUNCH: '1' })).toEqual({});
  });

  it('ignores the override in production builds, so config.json stays the off switch', () => {
    expect(devOverrides({ DEV: false, VITE_FEATURE_WISHES: '1' })).toEqual({});
    expect(devOverrides({ VITE_FEATURE_WISHES: '1' })).toEqual({});
  });
});
