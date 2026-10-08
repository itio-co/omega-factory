/** Feature flags. Every feature ships OFF and is turned on at runtime by ops. */
export type Features = { wishes: boolean };
export const ALL_OFF: Features = Object.freeze({ wishes: false });

/**
 * Reads `config.json` next to the app (same origin, relative to the base), e.g.
 * `{"features":{"wishes":true}}`. Only a literal `true` enables a feature; a missing
 * file, an HTTP error, invalid JSON or a network failure means all features are off.
 * `VITE_FEATURE_WISHES=1|0` at build time overrides the runtime value (local dev only).
 */
export async function loadFeatures(
  fetcher: typeof fetch = fetch,
  override: string | undefined = import.meta.env.VITE_FEATURE_WISHES,
): Promise<Features> {
  if (override === '1' || override === '0') return { wishes: override === '1' };
  try {
    const response = await fetcher('./config.json', { cache: 'no-store' });
    if (!response.ok) return ALL_OFF;
    const config = await response.json();
    return { wishes: config?.features?.wishes === true };
  } catch {
    return ALL_OFF;
  }
}
