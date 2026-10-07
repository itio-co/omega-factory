import { describe, expect, it } from 'vitest';
import {
  addNode,
  configureNode,
  connect,
  createGame,
  disconnect,
  removeNode,
  tick,
  upgradeNode,
} from './engine';
import { routeFlowRate } from './flow';
import { deserialize, serialize } from './persistence';

const sourceRoute = 'supplier-1:import-1';

describe('measured route throughput', () => {
  it('counts actual transfers and includes idle steps in elapsed simulation time', () => {
    let game = createGame();
    expect(routeFlowRate(game, sourceRoute)).toBe(0);
    game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBe(0);
    game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBe(2);
    game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBeCloseTo(4 / 3);
    for (let i = 0; i < 17; i++) game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBe(2);
    expect(routeFlowRate(game, 'export-1:customer-1')).toBe(0);
    game = configureNode(game, 'supplier-1', { enabled: false });
    for (let i = 0; i < 10; i++) game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBe(1);
    for (let i = 0; i < 10; i++) game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBe(0);
  });

  it('measures each branch independently instead of assigning total production to both', () => {
    let game = addNode(upgradeNode(createGame(), 'supplier-1'), 'import');
    const inlet = game.definition.nodes.at(-1)!.id;
    game = connect(game, 'supplier-1', inlet);
    game = connect(game, inlet, 'storage-1');
    for (let i = 0; i < 20; i++) game = tick(game);
    expect(routeFlowRate(game, sourceRoute)).toBe(2);
    expect(routeFlowRate(game, `supplier-1:${inlet}`)).toBe(2);
  });

  it('restores measured rates and accepts earlier saves without route measurements', () => {
    const game = tick(tick(createGame()));
    expect(routeFlowRate(deserialize(serialize(game)), sourceRoute)).toBe(2);
    const legacy = JSON.parse(serialize(game));
    delete legacy.state.routeHistory;
    const restored = deserialize(JSON.stringify(legacy));
    expect(routeFlowRate(restored, sourceRoute)).toBe(0);
    expect(restored.state.nodes).toEqual(game.state.nodes);
    expect(() => tick(restored)).not.toThrow();
  });

  it('clears measurements when a route is removed and starts reconnected routes fresh', () => {
    const game = tick(tick(createGame()));
    const removed = disconnect(game, sourceRoute);
    expect(routeFlowRate(removed, sourceRoute)).toBe(0);
    expect(() => deserialize(serialize(removed))).not.toThrow();
    const reconnected = connect(removed, 'supplier-1', 'import-1');
    expect(routeFlowRate(reconnected, sourceRoute)).toBe(0);
    for (const edited of [
      removeNode(game, 'supplier-1'),
      configureNode(tick(createGame()), 'import-1', { resource: 'ingot' }),
    ]) {
      expect(routeFlowRate(edited, sourceRoute)).toBe(0);
      expect(() => deserialize(serialize(edited))).not.toThrow();
    }
  });

  it('rejects invalid measurements and histories for routes that no longer exist', () => {
    const game = tick(tick(createGame()));
    const invalidHistories: Record<string, number[]>[] = [
      { [sourceRoute]: [-1] },
      { [sourceRoute]: [2] },
      { [sourceRoute]: [0, 0, 0] },
      { 'missing:route': [1] },
    ];
    for (const history of invalidHistories) {
      const invalid = { ...game, state: { ...game.state, routeHistory: history } };
      expect(() => deserialize(serialize(invalid))).toThrow();
    }
  });
});
