import type { Game } from './types';

export const SIMULATION_STEP_MS = 250;
export const FLOW_WINDOW_STEPS = 20;

/** Actual transferred items per simulated second, averaged over up to five seconds. */
export function routeFlowRate(game: Game, routeId: string): number {
  const samples = game.state.routeHistory[routeId] ?? [];
  if (!samples.length) return 0;
  return (
    samples.reduce((sum, amount) => sum + amount, 0) /
    ((samples.length * SIMULATION_STEP_MS) / 1000)
  );
}
