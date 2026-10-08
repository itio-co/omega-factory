import { describe, expect, it, vi } from 'vitest';
import { ALL_OFF, loadFeatures } from './features';

const respond = (body: unknown, status = 200) =>
  vi.fn(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );

describe('loadFeatures', () => {
  it('reads config.json relative to the app base without caching', async () => {
    const fetcher = respond({ features: { wishes: true } });
    expect(await loadFeatures(fetcher, undefined)).toEqual({ wishes: true });
    expect(fetcher).toHaveBeenCalledWith('./config.json', { cache: 'no-store' });
  });

  it('is off when config.json says so or omits the feature', async () => {
    expect(await loadFeatures(respond({ features: { wishes: false } }), undefined)).toEqual(
      ALL_OFF,
    );
    expect(await loadFeatures(respond({}), undefined)).toEqual(ALL_OFF);
    expect(await loadFeatures(respond({ features: null }), undefined)).toEqual(ALL_OFF);
  });

  it('only enables on a literal true', async () => {
    for (const wishes of ['true', 1, 'yes', {}, [true]])
      expect(await loadFeatures(respond({ features: { wishes } }), undefined)).toEqual(ALL_OFF);
  });

  it('is off on 404, server errors, invalid JSON and network failures', async () => {
    expect(await loadFeatures(respond('Not found', 404), undefined)).toEqual(ALL_OFF);
    expect(await loadFeatures(respond({ features: { wishes: true } }, 500), undefined)).toEqual(
      ALL_OFF,
    );
    expect(await loadFeatures(respond('<html>oops</html>'), undefined)).toEqual(ALL_OFF);
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await loadFeatures(offline, undefined)).toEqual(ALL_OFF);
  });

  it('lets a build-time VITE_FEATURE_WISHES=1|0 override the runtime file', async () => {
    const off = respond({ features: { wishes: false } });
    expect(await loadFeatures(off, '1')).toEqual({ wishes: true });
    expect(off).not.toHaveBeenCalled();
    expect(await loadFeatures(respond({ features: { wishes: true } }), '0')).toEqual(ALL_OFF);
    // Any other value is ignored and the runtime file decides.
    expect(await loadFeatures(respond({ features: { wishes: true } }), 'true')).toEqual({
      wishes: true,
    });
  });
});
