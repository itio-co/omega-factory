/** Feature flags. Every feature ships OFF and is turned on at runtime by ops. */
const FEATURES = {
  wishes: 'VITE_FEATURE_WISHES',
  maximizeOnLaunch: 'VITE_FEATURE_MAXIMIZE_ON_LAUNCH',
} as const;
export type Feature = keyof typeof FEATURES;
export type Features = Record<Feature, boolean>;
export const ALL_OFF: Features = Object.freeze({ wishes: false, maximizeOnLaunch: false });

type Env = { DEV?: boolean; [key: string]: unknown };

/**
 * Build-time overrides (`VITE_FEATURE_<NAME>=1|0`) for local development. They are
 * honoured only when `DEV` is true, so production bundles always follow `config.json`
 * and ops keep the runtime off switch.
 */
export function devOverrides(env: Env = import.meta.env): Partial<Features> {
  const overrides: Partial<Features> = {};
  if (env.DEV !== true) return overrides;
  for (const [feature, name] of Object.entries(FEATURES) as [Feature, string][]) {
    const value = env[name];
    if (value === '1' || value === '0') overrides[feature] = value === '1';
  }
  return overrides;
}

/**
 * Reads `config.json` next to the app (same origin, relative to the base), e.g.
 * `{"features":{"wishes":true}}`. Only a literal `true` enables a feature; a missing
 * file, an HTTP error, invalid JSON or a network failure means all features are off.
 * The service worker never caches this file, so offline also means off.
 */
export async function loadFeatures(
  fetcher: typeof fetch = fetch,
  overrides: Partial<Features> = devOverrides(),
): Promise<Features> {
  let config: { features?: Record<string, unknown> } | null = null;
  try {
    const response = await fetcher('./config.json', { cache: 'no-store' });
    if (response.ok) config = await response.json();
  } catch {
    config = null;
  }
  const features = { ...ALL_OFF };
  for (const feature of Object.keys(FEATURES) as Feature[])
    features[feature] = config?.features?.[feature] === true;
  return { ...features, ...overrides };
}

let shared: Promise<Features> | undefined;
/** The app's flags, fetched once per page load and shared by `main.ts` and `App.svelte`. */
export const appFeatures = (): Promise<Features> => (shared ??= loadFeatures());
